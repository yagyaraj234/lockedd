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

  override fun definition() = ModuleDefinition {
    Name("AppBlocker")

    AsyncFunction("getInstalledApps") { promise: (Any?) -> Unit ->
      try {
        val pm = context.packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        val result = apps.map { app ->
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
        promise(result)
      } catch (e: Exception) {
        promise(emptyList<Map<String, String>>())
      }
    }

    AsyncFunction("isAccessibilityEnabled") { promise: (Any?) -> Unit ->
      try {
        val enabled = isAccessibilityServiceEnabled()
        promise(enabled)
      } catch (e: Exception) {
        promise(false)
      }
    }

    Function("setBlockedApps") { packageNames: List<String> ->
      // This will be stored in MMKV from React side
      // Native side just confirms receipt
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
