package expo.modules.preventionmode

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.react.native.mmkv.MMKVModule

class PreventionModeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("No React context")

  override fun definition() = ModuleDefinition {
    Name("PreventionMode")

    AsyncFunction("enable") { promise: (Any?) -> Unit ->
      try {
        val admin = ComponentName(context, DeviceAdminReceiver::class.java)
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

        // Check if already enabled
        if (dpm.isAdminActive(admin)) {
          promise(true)
          return@AsyncFunction
        }

        // Would need user to activate in settings
        // For now, just mark as enabled in MMKV
        val mmkv = MMKVModule.getMMKVInstance() ?: return@AsyncFunction
        val settingsJson = mmkv.decodeString("settings") ?: "{}"
        val updated = settingsJson
          .replace(
            Regex("\"preventionMode\":\\s*\\w+"),
            "\"preventionMode\":true"
          )
          .let {
            if (!it.contains("\"preventionMode\"")) {
              it.replace("}", ",\"preventionMode\":true}")
            } else {
              it
            }
          }
        mmkv.encodeString("settings", updated)
        promise(true)
      } catch (e: Exception) {
        promise(false)
      }
    }

    AsyncFunction("disable") { promise: (Any?) -> Unit ->
      try {
        val mmkv = MMKVModule.getMMKVInstance() ?: return@AsyncFunction
        val settingsJson = mmkv.decodeString("settings") ?: "{}"

        // Check if 12 hours have passed
        val requestedAt = settingsJson
          .substringAfter("\"preventionModeOffRequestedAt\":")
          .substringBefore(",")
          .substringBefore("}")
          .toLongOrNull() ?: 0

        val now = System.currentTimeMillis()
        val twelveHours = 12 * 60 * 60 * 1000

        if (requestedAt > 0 && now - requestedAt >= twelveHours) {
          // Can disable now
          val updated = settingsJson
            .replace(
              Regex("\"preventionMode\":\\s*\\w+"),
              "\"preventionMode\":false"
            )
            .replace(
              Regex("\"preventionModeOffRequestedAt\":\\s*\\d+"),
              "\"preventionModeOffRequestedAt\":null"
            )
          mmkv.encodeString("settings", updated)
          promise(true)
        } else {
          promise(false)
        }
      } catch (e: Exception) {
        promise(false)
      }
    }

    AsyncFunction("requestDisable") { promise: (Any?) -> Unit ->
      try {
        val mmkv = MMKVModule.getMMKVInstance() ?: return@AsyncFunction
        val settingsJson = mmkv.decodeString("settings") ?: "{}"

        // Store the request time
        val now = System.currentTimeMillis()
        val updated = settingsJson
          .replace(
            Regex("\"preventionModeOffRequestedAt\":\\s*\\w*"),
            "\"preventionModeOffRequestedAt\":$now"
          )
          .let {
            if (!it.contains("\"preventionModeOffRequestedAt\"")) {
              it.replace("}", ",\"preventionModeOffRequestedAt\":$now}")
            } else {
              it
            }
          }
        mmkv.encodeString("settings", updated)
        promise(true)
      } catch (e: Exception) {
        promise(false)
      }
    }

    AsyncFunction("getStatus") { promise: (Any?) -> Unit ->
      try {
        val mmkv = MMKVModule.getMMKVInstance() ?: return@AsyncFunction
        val settingsJson = mmkv.decodeString("settings") ?: "{}"

        val enabled = settingsJson.contains("\"preventionMode\":true")
        val requestedAtStr = settingsJson
          .substringAfter("\"preventionModeOffRequestedAt\":")
          .substringBefore(",")
          .substringBefore("}")
        val requestedAt = requestedAtStr.toLongOrNull() ?: 0

        val result = mapOf(
          "enabled" to enabled,
          "requestedOffAt" to requestedAt
        )
        promise(result)
      } catch (e: Exception) {
        promise(mapOf("enabled" to false, "requestedOffAt" to 0))
      }
    }
  }
}
