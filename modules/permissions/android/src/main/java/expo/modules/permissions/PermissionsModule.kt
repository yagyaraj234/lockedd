package expo.modules.permissions

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PermissionsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("No React context")

  override fun definition() = ModuleDefinition {
    Name("Permissions")

    AsyncFunction("requestAccessibility") { promise: (Any?) -> Unit ->
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        promise(true)
      } catch (e: Exception) {
        promise(false)
      }
    }

    AsyncFunction("requestOverlay") { promise: (Any?) -> Unit ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
        intent.data = Uri.parse("package:${context.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
          promise(true)
        } catch (e: Exception) {
          promise(false)
        }
      } else {
        promise(true)
      }
    }

    AsyncFunction("requestUsageStats") { promise: (Any?) -> Unit ->
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        promise(true)
      } catch (e: Exception) {
        promise(false)
      }
    }

    AsyncFunction("requestActivityRecognition") { promise: (Any?) -> Unit ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val permission = "android.permission.ACTIVITY_RECOGNITION"
        ActivityCompat.requestPermissions(
          appContext.currentActivity ?: return@AsyncFunction,
          arrayOf(permission),
          100
        )
        promise(true)
      } else {
        promise(true)
      }
    }

    AsyncFunction("requestBatteryOptimization") { promise: (Any?) -> Unit ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        intent.data = Uri.parse("package:${context.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
          promise(true)
        } catch (e: Exception) {
          promise(false)
        }
      } else {
        promise(true)
      }
    }
  }
}
