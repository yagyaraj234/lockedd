package expo.modules.preventionmode

import android.app.admin.DeviceAdminReceiver

// Renamed from DeviceAdminReceiver to avoid the self-referential name clash with
// the android.app.admin.DeviceAdminReceiver superclass. Referenced by
// PreventionModeModule.adminComponent and by the <receiver> in AndroidManifest.xml.
class LockedDeviceAdminReceiver : DeviceAdminReceiver()
