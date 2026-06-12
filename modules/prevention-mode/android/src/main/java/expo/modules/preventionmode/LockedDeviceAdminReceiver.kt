package expo.modules.preventionmode

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

// Renamed from DeviceAdminReceiver to avoid the self-referential name clash with
// the android.app.admin.DeviceAdminReceiver superclass. Referenced by
// PreventionModeModule.adminComponent and by the <receiver> in AndroidManifest.xml.
class LockedDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onEnabled(context: Context, intent: Intent) {
    super.onEnabled(context, intent)
  }

  override fun onDisabled(context: Context, intent: Intent) {
    super.onDisabled(context, intent)
  }
}
