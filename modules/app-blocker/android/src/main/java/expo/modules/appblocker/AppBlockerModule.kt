package expo.modules.appblocker

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import android.util.Base64
import androidx.core.graphics.drawable.toBitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

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

    AsyncFunction("getInstalledApps") {
      try {
        val pm = context.packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        apps.map { app ->
          val label = try {
            pm.getApplicationLabel(app).toString()
          } catch (e: Exception) {
            app.packageName
          }

          val icon = try {
            pm.getApplicationIcon(app)
          } catch (e: Exception) {
            null
          }

          val iconBase64 = icon?.let { encodeIconToBase64(it) } ?: ""

          mapOf(
            "packageName" to app.packageName,
            "appName" to label,
            "iconBase64" to iconBase64
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

    // Mirror the (already enabled-filtered) blocked package list into the bridge
    // prefs so the accessibility service can read it.
    Function("setBlockedApps") { packageNames: List<String> ->
      blockerPrefs().edit()
        .putStringSet("blockedPackages", packageNames.toSet())
        .apply()
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
      val bitmap = drawable.toBitmap()
      val outputStream = ByteArrayOutputStream()
      bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, outputStream)
      val iconBytes = outputStream.toByteArray()
      Base64.encodeToString(iconBytes, Base64.DEFAULT)
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
