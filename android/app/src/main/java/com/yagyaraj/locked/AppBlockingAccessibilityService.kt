package com.yagyaraj.locked

import android.accessibilityservice.AccessibilityService
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Shared SharedPreferences contract between the JS-facing AppBlockerModule
// (package expo.modules.appblocker) and this service. Same app, so the prefs
// file is shared by appId. Keep these literals identical to the ones in
// AppBlockerModule.blockerPrefs().
object BlockerPrefs {
  const val FILE = "locked_blocker"
  const val BLOCKED_PACKAGES = "blockedPackages"
  const val ALLOW_PREFIX = "allow_"
  const val UNTIL_PREFIX = "until_"

  // Block-attempt stats. Counts each distinct time a blocked app was intercepted,
  // so the RN app can show "opens stopped" / "time saved" on Home. Daily counter
  // resets at date rollover (mirrors StepCounter's stepDate/stepCount pattern);
  // total is all-time. Read back via AppBlockerModule.getBlockStats().
  const val STATS_TOTAL = "stats_total"
  const val STATS_TODAY_COUNT = "stats_today_count"
  const val STATS_TODAY_DATE = "stats_today_date"

  // Package names for the Android Settings app across major OEMs.
  val SETTINGS_PACKAGES = setOf(
    "com.android.settings",
    "com.samsung.android.settings",
    "com.miui.settings",
    "com.oneplus.settings",
  )

  // Markers that identify the Private DNS chooser dialog specifically — NOT the
  // Connections/Network menu row that merely links to it. View-id substrings are
  // locale-independent (preferred); the text marker is an English-only fallback.
  // Detection also requires an editable hostname field to be present, so we bounce
  // only on the chooser dialog (which has the input) and never on the menu list.
  // NOTE: these were derived for AOSP. To confirm the exact Samsung One UI ids,
  // flip DNS_LOG=true, open the Private DNS dialog, and read the logcat dump.
  val PRIVATE_DNS_ID_HINTS = listOf("private_dns", "privatedns")
  val PRIVATE_DNS_TEXT_HINTS = listOf("private dns provider hostname")

  // --- Prevention-mode tamper guard markers --------------------------------
  // Used only while device admin is active (isPreventionActive()). They identify
  // the two Settings screens the user must not reach while Prevention Mode is on.
  //
  // Device Admin Apps screen: matched primarily by the Activity class name from
  // the accessibility event (locale-independent). AOSP uses
  // com.android.settings.deviceadmin.{DeviceAdminSettings,DeviceAdminAdd}; the
  // "deviceadmin" substring covers both. Text hints are an English fallback for
  // OEMs whose class name doesn't contain it. TUNE from TAMPER_LOG if it fails.
  val DEVICE_ADMIN_CLASS_HINTS = listOf("deviceadmin")
  val DEVICE_ADMIN_TEXT_HINTS = listOf(
    "device admin", "device administrator", "deactivate this device admin"
  )

  // Locked accessibility detail/toggle page: matched by the unique service
  // description (see @string/accessibility_service_description) so we hit only
  // that page and not the accessibility list or other apps. The "turn off"
  // phrasings catch the confirm dialog that some OEMs show on toggle-off.
  // TUNE from TAMPER_LOG against the real device.
  val LOCKED_A11Y_HINTS = listOf(
    "locked watches for blocked apps",
    "turn off locked",
    "stop using locked",
  )
}

// Flip to true to dump the Settings node tree (class + view-id + text) to logcat
// under tag "DnsBlock" while a Settings screen is foreground. Use it once on a
// real device to pin the Private DNS chooser's view-ids, then set back to false.
private const val DNS_LOG = false

// Flip to true to dump the foreground Settings node tree AND the triggering
// Activity class name to logcat under tag "Tamper". Use it once on a real device
// to pin the exact markers for the Device Admin Apps screen and the Locked
// accessibility detail/toggle page, then set markers in BlockerPrefs and flip
// this back to false. See handleSettingsLockdown().
private const val TAMPER_LOG = false

// Flip to true to log the block latency chain to logcat under tag "BlockLatency":
// the epoch-ms when the foreground-app event was received, when startActivity was
// called, and (from BlockingActivity) when its onCreate ran. The deltas split
// detection time (framework → callback) from render time (callback → visible) so
// you can see exactly where any remaining gap lives. Leave false in release.
const val LATENCY_LOG = false

/**
 * Watches foreground-app changes. When a blocked app (and not currently
 * temporarily allowed) comes to the foreground, launches BlockingActivity over
 * it. Also monitors window set changes to catch blocked apps entering
 * split-screen without a direct user tap.
 */
class AppBlockingAccessibilityService : AccessibilityService() {

  // Last package we put up the block screen for. Prevents relaunching
  // BlockingActivity on top of itself while the same app keeps emitting events.
  private var lastBlocked: String? = null

  // Epoch millis of the last time onWindowsChanged launched BlockingActivity.
  // Debounces re-triggers that fire as our own BlockingActivity comes to front
  // and changes the window list again.
  private var lastWindowsBlockAt: Long = 0L

  // Epoch millis of the last GLOBAL_ACTION_BACK fired to leave the Private DNS
  // chooser. Debounces the burst of window events the dialog emits so we send
  // BACK once — repeated BACKs would walk the user out of Settings entirely.
  private var lastDnsBackAt: Long = 0L

  // Epoch millis of the last GLOBAL_ACTION_BACK fired by the prevention-mode
  // tamper guard. Same debounce rationale as lastDnsBackAt.
  private var lastTamperBackAt: Long = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return

    val prefs = getSharedPreferences(BlockerPrefs.FILE, Context.MODE_PRIVATE)

    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onWindowStateChanged(event, prefs)
      AccessibilityEvent.TYPE_WINDOWS_CHANGED -> onWindowsChanged(prefs)
    }
  }

  private fun onWindowStateChanged(event: AccessibilityEvent, prefs: SharedPreferences) {
    val pkg = event.packageName?.toString() ?: return

    if (LATENCY_LOG && pkg != packageName) {
      Log.d("BlockLatency", "event pkg=$pkg t=${System.currentTimeMillis()}")
    }

    // Our own windows (including BlockingActivity) — never block ourselves.
    if (pkg == packageName) {
      return
    }

    // DNS protection is always on: if this is the Private DNS chooser, bounce out
    // of it (BACK) and leave the user in Settings. Everything else in Settings stays
    // reachable. onWindowsChanged runs the same check for dialog/overlay windows.
    if (handlePrivateDnsChooser()) return

    // Prevention-mode tamper guard: while device admin is active, bounce out of the
    // Device Admin Apps screen and the Locked accessibility detail page so the user
    // can't dismantle Locked. event.className is the locale-independent signal for
    // the device-admin Activity. No-op when prevention mode is off.
    if (handleSettingsLockdown(event.className?.toString())) return

    // Skip only while the device is still locked. We do NOT add a post-unlock
    // grace window: if you unlock straight into a blocked app (it was foreground
    // when the screen turned off), it must be blocked immediately, not left
    // usable for the grace period. The re-block loop is broken by the lastBlocked
    // guard below, not by a timer.
    if (isKeyguardActive()) return

    val blocked = prefs.getStringSet(BlockerPrefs.BLOCKED_PACKAGES, emptySet()) ?: emptySet()

    if (!blocked.contains(pkg)) {
      // A non-blocked app came forward; clear the guard.
      lastBlocked = null
      return
    }

    // Timed block already expired? Self-expire without needing the RN app to
    // be opened (it prunes the stale entry on its next launch). 0 = permanent.
    val blockedUntil = prefs.getLong(BlockerPrefs.UNTIL_PREFIX + pkg, 0L)
    if (blockedUntil > 0L && System.currentTimeMillis() > blockedUntil) {
      lastBlocked = null
      return
    }

    // Temporary pass still valid?
    val allowedUntil = prefs.getLong(BlockerPrefs.ALLOW_PREFIX + pkg, 0L)
    if (allowedUntil > System.currentTimeMillis()) return

    // Already showing the block screen for this package — don't relaunch.
    if (lastBlocked == pkg) return
    lastBlocked = pkg

    launchBlockingActivity(pkg, prefs)
  }

  // Fires when the set of visible windows changes. Catches blocked apps that:
  //   (a) enter a split-screen pane without a direct user tap, or
  //   (b) open as a floating/freeform/popup window on OEMs that don't fire
  //       TYPE_WINDOW_STATE_CHANGED with the correct package name for overlays.
  // Requires canRetrieveWindowContent="true" in the accessibility config so that
  // window.root?.packageName is readable.
  private fun onWindowsChanged(prefs: SharedPreferences) {
    // DNS protection is always on — check before the empty-list short-circuit so it
    // runs even when no apps are blocked. Catches the chooser as a dialog/overlay.
    if (handlePrivateDnsChooser()) return

    // Tamper guard also runs here so the device-admin / Locked-accessibility pages
    // get caught when they surface as dialog/overlay windows. No event class is
    // available on this path, so detection is content-based only.
    if (handleSettingsLockdown(null)) return

    val blocked = prefs.getStringSet(BlockerPrefs.BLOCKED_PACKAGES, emptySet()) ?: emptySet()

    if (blocked.isEmpty()) {
      if (isInSplitScreen()) performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
      return
    }

    val now = System.currentTimeMillis()
    if (isKeyguardActive()) return

    // Debounce: when we launch BlockingActivity, the window list changes again
    // (our activity appears), which re-fires this callback. Skip for 2 s after
    // any window-initiated launch so we don't loop.
    if (now - lastWindowsBlockAt < 2000L) {
      if (isInSplitScreen()) performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
      return
    }

    // Only check the active foreground window, not all windows. Iterating all
    // windows caused BlockingActivity to fire when a blocked app was in the
    // background but not actually in front of the user. Split-screen is still
    // handled: isInSplitScreen() exits it below regardless of which app is active.
    val root = try { rootInActiveWindow } catch (_: Exception) { null }
    if (root != null) {
      val pkg = root.packageName?.toString()
      root.recycle()
      if (pkg != null && pkg != packageName && blocked.contains(pkg)) {
        val blockedUntil = prefs.getLong(BlockerPrefs.UNTIL_PREFIX + pkg, 0L)
        val allowedUntil = prefs.getLong(BlockerPrefs.ALLOW_PREFIX + pkg, 0L)
        if ((blockedUntil == 0L || now <= blockedUntil) && allowedUntil <= now && lastBlocked != pkg) {
          lastWindowsBlockAt = now
          lastBlocked = pkg
          launchBlockingActivity(pkg, prefs)
          return
        }
      }
    }

    if (isInSplitScreen()) {
      performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
    }
  }

  // Increment the block-attempt counters. Called once per distinct open episode
  // because both call sites guard on lastBlocked before reaching here. Daily
  // counter resets when the date changes (same pattern as the step counter).
  private fun recordBlockAttempt(prefs: SharedPreferences) {
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    val editor = prefs.edit()
    val todayCount =
      if (prefs.getString(BlockerPrefs.STATS_TODAY_DATE, "") == today) {
        prefs.getInt(BlockerPrefs.STATS_TODAY_COUNT, 0)
      } else {
        editor.putString(BlockerPrefs.STATS_TODAY_DATE, today)
        0
      }
    editor.putInt(BlockerPrefs.STATS_TODAY_COUNT, todayCount + 1)
    editor.putInt(BlockerPrefs.STATS_TOTAL, prefs.getInt(BlockerPrefs.STATS_TOTAL, 0) + 1)
    editor.apply()
  }

  private fun launchBlockingActivity(pkg: String, prefs: SharedPreferences) {
    recordBlockAttempt(prefs)

    // Background the blocked app IMMEDIATELY, before doing anything else. HOME is a
    // system transition that takes the app out of the foreground in ~tens of ms —
    // far faster than our activity can render. This is what actually closes the
    // "usable window": the app stops being interactive at detection time, not when
    // the block screen finishes drawing. Worst case (if the activity launch below
    // loses the race) the user lands on the home screen with the app backgrounded —
    // still blocked, just without the breathing UI. It can never leave the app usable.
    performGlobalAction(GLOBAL_ACTION_HOME)

    // Exit split-screen before launching so BlockingActivity covers the full
    // screen rather than just one pane. The manifest flag resizeableActivity=false
    // is a system hint, but an explicit global action is more reliable.
    if (isInSplitScreen()) {
      performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
    }

    val intent = Intent(this, BlockingActivity::class.java).apply {
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          // No open animation: the launch slide-in is ~300-500ms during which the
          // blocked app underneath is still visible and touchable. Popping the
          // block screen in instantly closes that usable window.
          Intent.FLAG_ACTIVITY_NO_ANIMATION
      )
      putExtra(BlockingActivity.EXTRA_BLOCKED_PACKAGE, pkg)
    }
    if (LATENCY_LOG) Log.d("BlockLatency", "startActivity pkg=$pkg t=${System.currentTimeMillis()}")
    startActivity(intent)
  }

  private fun isKeyguardActive(): Boolean {
    val km = getSystemService(KEYGUARD_SERVICE) as? android.app.KeyguardManager
    return km?.isKeyguardLocked == true
  }

  // True when a split-screen divider or multiple application windows are
  // visible. On API 26+ the divider window type is the definitive indicator.
  // On API 24-25 fall back to counting application windows.
  private fun isInSplitScreen(): Boolean {
    return try {
      val ws = windows
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ws.any { it.type == AccessibilityWindowInfo.TYPE_SPLIT_SCREEN_DIVIDER }
      } else {
        ws.count { it.type == AccessibilityWindowInfo.TYPE_APPLICATION } >= 2
      }
    } catch (e: Exception) {
      false
    }
  }

  // If the active window is a Settings app showing the Private DNS chooser, send
  // BACK to dismiss it (the user stays in Settings) and return true. Debounced so
  // the dialog's window-event burst fires BACK exactly once. Returns false for any
  // other window so the caller can fall through to its normal app-block logic.
  private fun handlePrivateDnsChooser(): Boolean {
    val root = rootInActiveWindow ?: return false
    val pkg = root.packageName?.toString()
    if (pkg == null || pkg !in BlockerPrefs.SETTINGS_PACKAGES) {
      root.recycle()
      return false
    }

    val isChooser = try {
      isPrivateDnsChooser(root)
    } finally {
      root.recycle()
    }
    if (!isChooser) return false

    val now = System.currentTimeMillis()
    if (now - lastDnsBackAt < 1000L) return true // BACK already in flight
    lastDnsBackAt = now
    performGlobalAction(GLOBAL_ACTION_BACK)
    return true
  }

  // True when the node tree is the Private DNS chooser. The chooser is the only
  // Settings screen that pairs a private-dns marker (view-id, locale-independent;
  // or English text) with an editable hostname field — the menu row that links to
  // it has the marker but no input. Requiring both avoids bouncing the menu list.
  private fun isPrivateDnsChooser(root: AccessibilityNodeInfo): Boolean {
    var mentionsDns = false
    var hasEditable = false
    var hasMarkerText = false

    fun visit(node: AccessibilityNodeInfo?) {
      if (node == null) return

      val id = node.viewIdResourceName?.lowercase()
      if (id != null && BlockerPrefs.PRIVATE_DNS_ID_HINTS.any { id.contains(it) }) {
        mentionsDns = true
      }

      val text = (
        (node.text?.toString() ?: "") + " " + (node.contentDescription?.toString() ?: "")
      ).lowercase()
      if (text.contains("private dns") || text.contains("private_dns")) mentionsDns = true
      if (BlockerPrefs.PRIVATE_DNS_TEXT_HINTS.any { text.contains(it) }) hasMarkerText = true

      if (node.isEditable || node.className?.toString() == "android.widget.EditText") {
        hasEditable = true
      }

      if (DNS_LOG) {
        Log.d(
          "DnsBlock",
          "class=${node.className} id=${node.viewIdResourceName} " +
            "text=${node.text} desc=${node.contentDescription}"
        )
      }

      for (i in 0 until node.childCount) {
        val child = node.getChild(i)
        visit(child)
        child?.recycle()
      }
    }

    visit(root)
    return hasMarkerText || (mentionsDns && hasEditable)
  }

  // True while Prevention Mode is on, i.e. our device-admin component is active.
  // This is the single gate for the tamper guard: when prevention is disabled
  // properly (in-app, after its cooldown), isAdminActive() goes false and every
  // settings screen becomes reachable again — no separate flag to keep in sync.
  private fun isPreventionActive(): Boolean {
    return try {
      val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
      val admin = ComponentName(this, "expo.modules.preventionmode.LockedDeviceAdminReceiver")
      dpm.isAdminActive(admin)
    } catch (e: Exception) {
      false
    }
  }

  // While Prevention Mode is active, bounce the user out of the two Settings
  // screens that would let them dismantle Locked:
  //   (a) the Device Admin Apps screen / per-admin deactivate page, and
  //   (b) the Locked accessibility service's own detail/toggle page.
  // The accessibility list and every other app's detail page stay reachable.
  // Fires BACK once (debounced). Returns true when it acted so the caller skips
  // its normal logic. eventClassName (when available) is the locale-independent
  // signal for the device-admin Activity; otherwise detection is content-based.
  private fun handleSettingsLockdown(eventClassName: String?): Boolean {
    if (!isPreventionActive()) return false

    val root = rootInActiveWindow ?: return false
    val pkg = root.packageName?.toString()
    if (pkg == null || pkg !in BlockerPrefs.SETTINGS_PACKAGES) {
      root.recycle()
      return false
    }

    val cls = eventClassName?.lowercase() ?: ""
    val tamper = try {
      if (TAMPER_LOG) {
        Log.d("Tamper", "settings screen className=$eventClassName")
        dumpTree(root)
      }
      val isDeviceAdmin =
        BlockerPrefs.DEVICE_ADMIN_CLASS_HINTS.any { cls.contains(it) } ||
          treeContainsAny(root, BlockerPrefs.DEVICE_ADMIN_TEXT_HINTS)
      val isLockedA11y = treeContainsAny(root, BlockerPrefs.LOCKED_A11Y_HINTS)
      isDeviceAdmin || isLockedA11y
    } finally {
      root.recycle()
    }

    if (!tamper) return false

    val now = System.currentTimeMillis()
    if (now - lastTamperBackAt < 1000L) return true // BACK already in flight
    lastTamperBackAt = now
    performGlobalAction(GLOBAL_ACTION_BACK)
    return true
  }

  // True if any node's text or contentDescription (lowercased) contains any of the
  // given hints. Walks the whole tree; recycles every child it fetches but leaves
  // the caller-owned root for the caller to recycle.
  private fun treeContainsAny(root: AccessibilityNodeInfo, hints: List<String>): Boolean {
    fun visit(node: AccessibilityNodeInfo?): Boolean {
      if (node == null) return false
      val text = (
        (node.text?.toString() ?: "") + " " + (node.contentDescription?.toString() ?: "")
      ).lowercase()
      if (hints.any { text.contains(it) }) return true
      for (i in 0 until node.childCount) {
        val child = node.getChild(i)
        val hit = visit(child)
        child?.recycle()
        if (hit) return true
      }
      return false
    }
    return visit(root)
  }

  // Logcat dump of the node tree for marker tuning (gated by TAMPER_LOG). Mirrors
  // the DNS_LOG dump but under tag "Tamper". Does not recycle the root.
  private fun dumpTree(root: AccessibilityNodeInfo) {
    fun visit(node: AccessibilityNodeInfo?) {
      if (node == null) return
      Log.d(
        "Tamper",
        "class=${node.className} id=${node.viewIdResourceName} " +
          "text=${node.text} desc=${node.contentDescription}"
      )
      for (i in 0 until node.childCount) {
        val child = node.getChild(i)
        visit(child)
        child?.recycle()
      }
    }
    visit(root)
  }

  override fun onInterrupt() {
    // No-op.
  }
}
