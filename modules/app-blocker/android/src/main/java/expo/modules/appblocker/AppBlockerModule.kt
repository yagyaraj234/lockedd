package expo.modules.appblocker

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import androidx.core.graphics.drawable.toBitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.ByteArrayOutputStream

class BlockedAppEntry : Record {
  @Field val packageName: String = ""

  // Epoch millis the block expires at; null = permanent. Exact in Double
  // (epoch millis < 2^53).
  @Field val blockUntil: Double? = null
}

class AppBlockerModule : Module() {
  companion object {
    private const val PHONE_LOCK_END = "phone_lock_end"
    private const val PHONE_LOCK_PASS_END = "phone_lock_pass_end"
    private const val PHONE_LOCK_PASSES_REMAINING = "phone_lock_passes_remaining"
    private const val PHONE_LOCK_CHANGED_ACTION = "com.yagyaraj.locked.PHONE_LOCK_CHANGED"
    private const val PHONE_LOCK_MIN_DURATION_MS = 5 * 60 * 1000L
    private const val PHONE_LOCK_MAX_DURATION_MS = 24 * 60 * 60 * 1000L
    private const val PHONE_LOCK_DURATION_STEP_MS = 5 * 60 * 1000L
    private const val PHONE_LOCK_PASS_COUNT = 3
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exception("No React context")

  // Bridge file shared with the accessibility service / BlockingActivity. Same
  // app, so SharedPreferences are shared by appId. The service cannot read MMKV
  // (Nitro), so the enabled blocked list + temporary-allow grants are mirrored
  // here. Keep these literals in sync with com.yagyaraj.locked.BlockerPrefs.
  private fun blockerPrefs() =
    context.getSharedPreferences("locked_blocker", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("AppBlocker")

    // Only apps with a launcher icon — what the user sees in the app drawer.
    // Skips system binaries/services the user could never open anyway, which
    // also keeps the bridge payload small (this list ships base64 icons).
    AsyncFunction("getInstalledApps") {
      try {
        val pm = context.packageManager
        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.queryIntentActivities(launcherIntent, PackageManager.ResolveInfoFlags.of(0L))
        } else {
          @Suppress("DEPRECATION")
          pm.queryIntentActivities(launcherIntent, 0)
        }
        resolved
          .distinctBy { it.activityInfo.packageName }
          .filter { it.activityInfo.packageName != context.packageName }
          .map { info ->
            val pkg = info.activityInfo.packageName
            val label = try {
              info.loadLabel(pm).toString()
            } catch (e: Exception) {
              pkg
            }

            val icon = try {
              info.loadIcon(pm)
            } catch (e: Exception) {
              null
            }

            mapOf(
              "packageName" to pkg,
              "appName" to label,
              "iconBase64" to (icon?.let { encodeIconToBase64(it) } ?: "")
            )
          }
      } catch (e: Exception) {
        emptyList<Map<String, String>>()
      }
    }

    AsyncFunction("isAccessibilityEnabled") {
      try {
        isAccessibilityServiceEnabled()
      } catch (e: Exception) {
        false
      }
    }

    // Mirror the (already enabled-filtered) blocked list into the bridge prefs
    // so the accessibility service can read it. Each entry carries its expiry
    // (until_<pkg>, 0 = permanent) so the service can self-expire timed blocks
    // without the RN app being opened. Kept a sync Function: callers fire and
    // forget, and a conversion failure must throw into JS, not vanish in an
    // unawaited promise.
    Function("setBlockedApps") { apps: List<BlockedAppEntry> ->
      val prefs = blockerPrefs()
      val pkgs = apps.map { it.packageName }.toSet()
      val editor = prefs.edit()
      // Prune stale until_/allow_ keys for packages no longer blocked.
      prefs.all.keys
        .filter {
          (it.startsWith("until_") && it.removePrefix("until_") !in pkgs) ||
            (it.startsWith("allow_") && it.removePrefix("allow_") !in pkgs)
        }
        .forEach { editor.remove(it) }
      editor.putStringSet("blockedPackages", pkgs)
      apps.forEach { editor.putLong("until_${it.packageName}", it.blockUntil?.toLong() ?: 0L) }
      editor.apply()
      true
    }

    // Set Android Private DNS (DNS-over-TLS) to a custom hostname.
    // Uses Settings.Global — requires WRITE_SECURE_SETTINGS, which is a
    // development-level permission not auto-granted. Grant once via ADB:
    //   adb shell pm grant com.yagyaraj.locked android.permission.WRITE_SECURE_SETTINGS
    // Survives app updates; cleared on uninstall. Returns false on API < 28 or if
    // the permission hasn't been granted yet.
    Function("setPrivateDns") { hostname: String ->
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          val cr = context.contentResolver
          android.provider.Settings.Global.putString(cr, "private_dns_mode", "hostname")
          android.provider.Settings.Global.putString(cr, "private_dns_specifier", hostname)
          true
        } else {
          false
        }
      } catch (e: Exception) {
        android.util.Log.e("AppBlocker", "setPrivateDns failed: ${e.javaClass.simpleName}: ${e.message}")
        false
      }
    }

    // Returns true when WRITE_SECURE_SETTINGS is granted (via ADB). Without it,
    // setPrivateDns always fails silently.
    Function("hasWriteSecureSettings") {
      context.checkCallingOrSelfPermission("android.permission.WRITE_SECURE_SETTINGS") ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    // Reads back the current Private DNS settings so the UI can verify whether
    // setPrivateDns actually took effect. Returns a map with "mode" and "specifier".
    Function("getPrivateDns") {
      try {
        val cr = context.contentResolver
        val mode = android.provider.Settings.Global.getString(cr, "private_dns_mode") ?: "off"
        val specifier = android.provider.Settings.Global.getString(cr, "private_dns_specifier") ?: ""
        mapOf("mode" to mode, "specifier" to specifier)
      } catch (e: Exception) {
        android.util.Log.e("AppBlocker", "getPrivateDns failed: ${e.javaClass.simpleName}: ${e.message}")
        mapOf("mode" to "unknown", "specifier" to "")
      }
    }

    // Block-attempt stats for the Home dashboard. The accessibility service
    // increments these in the shared prefs on each interception (see
    // BlockerPrefs.STATS_*). todayAttempts is gated on the stored date so a
    // stale day reads 0 here without needing the service to write first.
    Function("getBlockStats") {
      try {
        val prefs = blockerPrefs()
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
          .format(java.util.Date())
        val total = prefs.getInt("stats_total", 0)
        val todayAttempts =
          if (prefs.getString("stats_today_date", "") == today) {
            prefs.getInt("stats_today_count", 0)
          } else {
            0
          }
        mapOf("totalAttempts" to total, "todayAttempts" to todayAttempts)
      } catch (e: Exception) {
        android.util.Log.e("AppBlocker", "getBlockStats failed: ${e.javaClass.simpleName}: ${e.message}")
        mapOf("totalAttempts" to 0, "todayAttempts" to 0)
      }
    }

    Function("startPhoneLock") { durationMs: Double ->
      val duration = durationMs.toLong()
      require(
        durationMs == duration.toDouble() &&
          duration in PHONE_LOCK_MIN_DURATION_MS..PHONE_LOCK_MAX_DURATION_MS &&
          duration % PHONE_LOCK_DURATION_STEP_MS == 0L
      ) {
        "Phone lock duration must be 5-minute increments from 5 minutes through 24 hours"
      }
      check(isAccessibilityServiceEnabled() && android.provider.Settings.canDrawOverlays(context)) {
        "Accessibility and overlay permissions are required"
      }

      val prefs = blockerPrefs()
      val now = System.currentTimeMillis()
      val currentEnd = prefs.getLong(PHONE_LOCK_END, 0L)
      check(currentEnd <= now) { "A phone lock is already active" }

      prefs.edit()
        .putLong(PHONE_LOCK_END, now + duration)
        .remove(PHONE_LOCK_PASS_END)
        .putInt(PHONE_LOCK_PASSES_REMAINING, PHONE_LOCK_PASS_COUNT)
        .apply()

      context.sendBroadcast(
        Intent(PHONE_LOCK_CHANGED_ACTION).setPackage(context.packageName)
      )
      context.startActivity(Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })

      getPhoneLockState(prefs, now)
    }

    Function("getPhoneLockState") {
      getPhoneLockState(blockerPrefs())
    }

  }

  private fun getPhoneLockState(
    prefs: android.content.SharedPreferences,
    now: Long = System.currentTimeMillis()
  ): Map<String, Any?> {
    val endsAt = prefs.getLong(PHONE_LOCK_END, 0L)
    if (endsAt <= now) {
      if (endsAt != 0L) {
        prefs.edit()
          .remove(PHONE_LOCK_END)
          .remove(PHONE_LOCK_PASS_END)
          .remove(PHONE_LOCK_PASSES_REMAINING)
          .apply()
      }
      return mapOf(
        "active" to false,
        "endsAt" to null,
        "passEndsAt" to null,
        "passesRemaining" to 0
      )
    }

    val storedPassEnd = prefs.getLong(PHONE_LOCK_PASS_END, 0L)
    val passEndsAt = storedPassEnd.takeIf { it > now }
    if (storedPassEnd != 0L && passEndsAt == null) {
      prefs.edit().remove(PHONE_LOCK_PASS_END).apply()
    }
    return mapOf(
      "active" to true,
      "endsAt" to endsAt,
      "passEndsAt" to passEndsAt,
      "passesRemaining" to prefs.getInt(PHONE_LOCK_PASSES_REMAINING, 0)
    )
  }

  private fun encodeIconToBase64(drawable: Drawable): String {
    return try {
      // 96px is plenty for a 48dp list icon; full-size adaptive icons (often
      // 432px+) made the bridge payload megabytes and the picker list crawl.
      val bitmap = drawable.toBitmap(96, 96)
      val outputStream = ByteArrayOutputStream()
      bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, outputStream)
      val iconBytes = outputStream.toByteArray()
      Base64.encodeToString(iconBytes, Base64.NO_WRAP)
    } catch (e: Exception) {
      ""
    }
  }

  private fun isAccessibilityServiceEnabled(): Boolean {
    val context = appContext.reactContext ?: return false
    val accessibilityManager =
      context.getSystemService(Context.ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager
    val enabledServices =
      android.provider.Settings.Secure.getString(
        context.contentResolver,
        android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: return false
    return enabledServices.contains(context.packageName)
  }
}
