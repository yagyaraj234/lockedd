package expo.modules.preventionmode

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class DeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onEnabled(context: Context, intent: Intent) {
    super.onEnabled(context, intent)
  }

  override fun onDisabled(context: Context, intent: Intent) {
    super.onDisabled(context, intent)
  }

  override fun onPasswordChanged(context: Context, intent: Intent) {
    super.onPasswordChanged(context, intent)
  }
}
