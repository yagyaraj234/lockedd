package expo.modules.permissions

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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

    // App-info page. Needed for Android 13+ "Restricted setting" on sideloaded
    // installs: user must open App Info -> overflow menu -> "Allow restricted
    // settings" before the accessibility toggle can be enabled.
    AsyncFunction("openAppInfo") {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    // The request* functions above only open the relevant Settings page — they
    // cannot know whether the user actually flipped the toggle. These check*
    // functions report the real grant state; call them on mount and on app
    // resume.

    AsyncFunction("checkAccessibility") {
      try {
        val enabled = Settings.Secure.getString(
          context.contentResolver,
          Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        enabled.contains(context.packageName)
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("checkOverlay") {
      try {
        Settings.canDrawOverlays(context)
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("checkBatteryOptimization") {
      try {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.isIgnoringBatteryOptimizations(context.packageName)
      } catch (e: Exception) {
        false
      }
    }

  }
}
