package expo.modules.preventionmode

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Thin device-admin wrapper. All prevention-mode state (enabled flag, the 12-hour
// disable cooldown) lives in JS/MMKV; this module only performs the privileged
// device-admin operations that JS cannot. The actual grant result is verified by
// JS via isActive() after the system prompt returns (on app resume), because
// ACTION_ADD_DEVICE_ADMIN runs in a separate Activity and startActivity() returns
// before the user has answered.
class PreventionModeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("No React context")

  private val adminComponent: ComponentName
    get() = ComponentName(context, LockedDeviceAdminReceiver::class.java)

  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  override fun definition() = ModuleDefinition {
    Name("PreventionMode")

    AsyncFunction("isActive") {
      try {
        dpm.isAdminActive(adminComponent)
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("enable") {
      try {
        if (dpm.isAdminActive(adminComponent)) {
          true
        } else {
          val activity = appContext.currentActivity ?: throw Exception("No Activity context")
          val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
            putExtra(
              DevicePolicyManager.EXTRA_ADD_EXPLANATION,
              "Prevention Mode stops you from uninstalling Locked during focus blocks."
            )
          }
          activity.startActivity(intent)
          // Intent launched only; JS confirms the real result via isActive() on resume.
          true
        }
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("disable") {
      try {
        if (dpm.isAdminActive(adminComponent)) {
          dpm.removeActiveAdmin(adminComponent)
        }
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
