package com.yagyaraj.locked

import android.accessibilityservice.AccessibilityService
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
}

// Flip to true to dump the Settings node tree (class + view-id + text) to logcat
// under tag "DnsBlock" while a Settings screen is foreground. Use it once on a
// real device to pin the Private DNS chooser's view-ids, then set back to false.
private const val DNS_LOG = false

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

    // Our own windows (including BlockingActivity) — never block ourselves, and
    // reset the guard so the blocked app re-triggers when reopened later.
    if (pkg == packageName) {
      lastBlocked = null
      return
    }

    // DNS protection is always on: if this is the Private DNS chooser, bounce out
    // of it (BACK) and leave the user in Settings. Everything else in Settings stays
    // reachable. onWindowsChanged runs the same check for dialog/overlay windows.
    if (handlePrivateDnsChooser()) return

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

    val blocked = prefs.getStringSet(BlockerPrefs.BLOCKED_PACKAGES, emptySet()) ?: emptySet()

    if (blocked.isEmpty()) {
      if (isInSplitScreen()) performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
      return
    }

    // Debounce: when we launch BlockingActivity, the window list changes again
    // (our activity appears), which re-fires this callback. Skip for 2 s after
    // any window-initiated launch so we don't loop.
    val now = System.currentTimeMillis()
    if (now - lastWindowsBlockAt < 2000L) {
      if (isInSplitScreen()) performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
      return
    }

    try {
      for (window in windows) {
        if (window.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue

        val root = window.root ?: continue
        val pkg = root.packageName?.toString()
        root.recycle()

        if (pkg == null || pkg == packageName) continue

        if (blocked.contains(pkg)) {
          val blockedUntil = prefs.getLong(BlockerPrefs.UNTIL_PREFIX + pkg, 0L)
          if (blockedUntil > 0L && now > blockedUntil) continue

          val allowedUntil = prefs.getLong(BlockerPrefs.ALLOW_PREFIX + pkg, 0L)
          if (allowedUntil > now) continue

          if (lastBlocked == pkg) continue

          lastWindowsBlockAt = now
          lastBlocked = pkg
          launchBlockingActivity(pkg, prefs)
          return
        }
      }
    } catch (_: Exception) {
      // Window list may change mid-iteration; safe to ignore.
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
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      )
      putExtra(BlockingActivity.EXTRA_BLOCKED_PACKAGE, pkg)
    }
    startActivity(intent)
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

  override fun onInterrupt() {
    // No-op.
  }
}
