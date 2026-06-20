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

    // Grant a blocked app a temporary pass until the given epoch-millis. The
    // service skips blocking while now < allow_<pkg>.
    Function("setTemporaryAllow") { packageName: String, untilMillis: Double ->
      blockerPrefs().edit()
        .putLong("allow_$packageName", untilMillis.toLong())
        .apply()
      true
    }
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
