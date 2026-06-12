package expo.modules.permissions

import android.content.Context
import android.content.Intent
import android.manifest.permission.POST_NOTIFICATIONS
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

    AsyncFunction("requestAccessibility") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("requestOverlay") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
        intent.data = Uri.parse("package:${context.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
          true
        } catch (e: Exception) {
          false
        }
      } else {
        true
      }
    }

    AsyncFunction("requestUsageStats") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("requestActivityRecognition") {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val activity = appContext.currentActivity
          if (activity != null) {
            ActivityCompat.requestPermissions(
              activity,
              arrayOf("android.permission.ACTIVITY_RECOGNITION"),
              100
            )
          }
        }
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("requestBatteryOptimization") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        intent.data = Uri.parse("package:${context.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
          true
        } catch (e: Exception) {
          false
        }
      } else {
        true
      }
    }

    AsyncFunction("requestNotifications") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val activity = appContext.currentActivity
        if (activity != null) {
          ActivityCompat.requestPermissions(
            activity,
            arrayOf(POST_NOTIFICATIONS),
            1002
          )
        }
        true
      } else {
        true
      }
    }
  }
}
