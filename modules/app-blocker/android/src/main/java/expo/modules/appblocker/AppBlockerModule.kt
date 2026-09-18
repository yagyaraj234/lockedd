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

class PhoneLockScheduleRecord : Record {
  @Field val id: String = ""
  @Field val name: String = ""
  @Field val enabled: Boolean = true
  @Field val days: List<Int> = emptyList()
  @Field val startMinute: Int = 0
  @Field val endMinute: Int = 0
  @Field val allowedPackageNames: List<String> = emptyList()
}

class AppBlockerModule : Module() {
  companion object {
    private const val PHONE_LOCK_MIN_DURATION_MS = 5 * 60 * 1000L
    private const val PHONE_LOCK_MAX_DURATION_MS = 24 * 60 * 60 * 1000L
    private const val PHONE_LOCK_DURATION_STEP_MS = 5 * 60 * 1000L
    private const val PERMANENT_BLOCK_UNLOCK_MS = 2 * 60 * 1000L
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
        val alwaysAllowedPackages = PhoneLockScheduler.alwaysAllowedPackages(context)
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
              "iconBase64" to (icon?.let { encodeIconToBase64(it) } ?: ""),
              "canAllowDuringPhoneLock" to !PhoneLockScheduler.isProtectedPackage(context, pkg),
              "isAlwaysAllowedDuringPhoneLock" to (pkg in alwaysAllowedPackages),
            )
          }
      } catch (e: Exception) {
        emptyList<Map<String, Any>>()
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

    // A permanent block can receive one, fixed two-minute pass. Native validation
    // prevents JS callers from granting access to timed or no-longer-blocked apps,
    // and an active pass is returned unchanged so it cannot be topped up.
    Function("unlockPermanentBlockForTwoMinutes") { packageName: String ->
      val prefs = blockerPrefs()
      val blocked = prefs.getStringSet("blockedPackages", emptySet()) ?: emptySet()
      require(packageName in blocked) { "App is not currently blocked" }
      require(prefs.getLong("until_$packageName", 0L) == 0L) {
        "Only permanent blocks can be temporarily unlocked"
      }

      val now = System.currentTimeMillis()
      val allowKey = "allow_$packageName"
      val activeUntil = prefs.getLong(allowKey, 0L)
      if (activeUntil > now) {
        activeUntil.toDouble()
      } else {
        val endsAt = now + PERMANENT_BLOCK_UNLOCK_MS
        prefs.edit().putLong(allowKey, endsAt).apply()
        endsAt.toDouble()
      }
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

    Function("canScheduleExactAlarms") {
      PhoneLockScheduler.canScheduleExactAlarms(context)
    }

    Function("openExactAlarmSettings") {
      PhoneLockScheduler.openExactAlarmSettings(context)
      true
    }

    Function("getPhoneLockSchedules") {
      PhoneLockScheduler.refresh(context)
      PhoneLockScheduler.getSchedules(context).map(::scheduleMap)
    }

    Function("upsertPhoneLockSchedule") { input: PhoneLockScheduleRecord ->
      scheduleMap(
        PhoneLockScheduler.upsertSchedule(
          context,
          PhoneLockScheduleNative(
            id = input.id,
            name = input.name,
            enabled = input.enabled,
            days = input.days.toSet(),
            startMinute = input.startMinute,
            endMinute = input.endMinute,
            allowedPackageNames = input.allowedPackageNames.toSet(),
            activationNotBefore = 0L,
          )
        )
      )
    }

    Function("deletePhoneLockSchedule") { id: String ->
      PhoneLockScheduler.deleteSchedule(context, id)
      true
    }

    Function("setPhoneLockScheduleEnabled") { id: String, enabled: Boolean ->
      scheduleMap(PhoneLockScheduler.setScheduleEnabled(context, id, enabled))
    }

    Function("startPhoneLock") { durationMs: Double, allowedPackageNames: List<String> ->
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
      val allowedPackages =
        allowedPackageNames.toSet() - PhoneLockScheduler.alwaysAllowedPackages(context)
      require(allowedPackages.size <= PhoneLockScheduler.PHONE_LOCK_ALLOWED_APP_LIMIT) {
        "Choose up to ${PhoneLockScheduler.PHONE_LOCK_ALLOWED_APP_LIMIT} allowed apps"
      }
      require(allowedPackages.none { PhoneLockScheduler.isProtectedPackage(context, it) }) {
        "Settings, installers, and Locked cannot be allowed"
      }

      val prefs = blockerPrefs()
      val now = System.currentTimeMillis()
      val currentEnd = prefs.getLong(PhoneLockScheduler.PHONE_LOCK_END, 0L)
      check(currentEnd <= now) { "A phone lock is already active" }
      val conflict = PhoneLockScheduler.firstManualConflict(context, now, now + duration)
      check(conflict == null) {
        val time = java.text.SimpleDateFormat("EEE h:mm a", java.util.Locale.getDefault())
          .format(java.util.Date(conflict!!.startsAt))
        "Manual lock overlaps ${conflict.scheduleName} at $time"
      }

      prefs.edit()
        .putLong(PhoneLockScheduler.PHONE_LOCK_END, now + duration)
        .remove(PhoneLockScheduler.PHONE_LOCK_PASS_END)
        .remove(PhoneLockScheduler.PHONE_LOCK_COOLDOWN_END)
        .putInt(
          PhoneLockScheduler.PHONE_LOCK_PASSES_REMAINING,
          PhoneLockScheduler.PHONE_LOCK_PASS_COUNT
        )
        .putStringSet(PhoneLockScheduler.PHONE_LOCK_ALLOWED_PACKAGES, allowedPackages)
        .putString(PhoneLockScheduler.PHONE_LOCK_SOURCE, "manual")
        .remove(PhoneLockScheduler.PHONE_LOCK_ACTIVE_SCHEDULE_ID)
        .apply()

      PhoneLockScheduler.notifyLockChanged(context)
      context.startActivity(Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })

      getPhoneLockState(prefs, now)
    }

    Function("getPhoneLockState") {
      PhoneLockScheduler.refresh(context)
      getPhoneLockState(blockerPrefs())
    }

    Function("getOverlayDesign") {
      overlayDesign()
    }

    Function("getCustomWallpaperUri") {
      blockerPrefs().getString(PhoneLockScheduler.CUSTOM_WALLPAPER_URI, null)
    }

    Function("openCustomWallpaperPicker") {
      context.startActivity(
        Intent()
          .setClassName(context, "${context.packageName}.WallpaperPickerActivity")
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      true
    }

    Function("setOverlayDesign") { design: String ->
      require(design in PhoneLockScheduler.OVERLAY_DESIGNS) { "Unknown overlay design" }
      require(
        design != "custom" ||
          blockerPrefs().getString(PhoneLockScheduler.CUSTOM_WALLPAPER_URI, null) != null
      ) { "Import a custom wallpaper first" }
      blockerPrefs().edit().putString(PhoneLockScheduler.OVERLAY_DESIGN, design).apply()
      PhoneLockScheduler.notifyLockChanged(context)
      design
    }

  }

  private fun getPhoneLockState(
    prefs: android.content.SharedPreferences,
    now: Long = System.currentTimeMillis()
  ): Map<String, Any?> {
    PhoneLockScheduler.resolveAccessCycle(prefs, now)
    val endsAt = prefs.getLong(PhoneLockScheduler.PHONE_LOCK_END, 0L)
    if (endsAt <= now) {
      if (endsAt != 0L) {
        PhoneLockScheduler.clearActiveLock(prefs)
      }
      return mapOf(
        "active" to false,
        "endsAt" to null,
        "passEndsAt" to null,
        "passesRemaining" to 0,
        "source" to null,
        "activeScheduleId" to null,
        "allowedPackageNames" to emptyList<String>(),
      )
    }

    val storedPassEnd = prefs.getLong(PhoneLockScheduler.PHONE_LOCK_PASS_END, 0L)
    val passEndsAt = storedPassEnd.takeIf { it > now }
    return mapOf(
      "active" to true,
      "endsAt" to endsAt,
      "passEndsAt" to passEndsAt,
      "passesRemaining" to prefs.getInt(PhoneLockScheduler.PHONE_LOCK_PASSES_REMAINING, 0),
      "source" to prefs.getString(PhoneLockScheduler.PHONE_LOCK_SOURCE, null),
      "activeScheduleId" to
        prefs.getString(PhoneLockScheduler.PHONE_LOCK_ACTIVE_SCHEDULE_ID, null),
      "allowedPackageNames" to
        (prefs.getStringSet(PhoneLockScheduler.PHONE_LOCK_ALLOWED_PACKAGES, emptySet())
          ?: emptySet()).sorted(),
    )
  }

  private fun overlayDesign(prefs: android.content.SharedPreferences = blockerPrefs()): String =
    prefs.getString(PhoneLockScheduler.OVERLAY_DESIGN, PhoneLockScheduler.DEFAULT_OVERLAY_DESIGN)
      ?.takeIf { it in PhoneLockScheduler.OVERLAY_DESIGNS }
      ?: PhoneLockScheduler.DEFAULT_OVERLAY_DESIGN

  private fun scheduleMap(schedule: PhoneLockScheduleNative): Map<String, Any?> =
    mapOf(
      "id" to schedule.id,
      "name" to schedule.name,
      "enabled" to schedule.enabled,
      "days" to schedule.days.sorted(),
      "startMinute" to schedule.startMinute,
      "endMinute" to schedule.endMinute,
      "allowedPackageNames" to schedule.allowedPackageNames.sorted(),
      "activationNotBefore" to schedule.activationNotBefore.takeIf { it > 0L },
    )

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
