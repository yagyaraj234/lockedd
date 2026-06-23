package com.yagyaraj.locked

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.view.accessibility.AccessibilityEvent
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
  const val BLOCK_DNS_SETTINGS = "block_dns_settings"

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
}

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

    // Block the entire Settings app when DNS-settings protection is on.
    // Checking only for a PrivateDns class name is unreliable — on most OEMs
    // TYPE_WINDOW_STATE_CHANGED fires with a generic Activity class (SubSettings,
    // Settings$NetworkDashboardActivity, etc.), never "PrivateDns". Block the whole
    // Settings package so the user can't reach the Private DNS screen regardless of
    // which Activity is used. onWindowsChanged does the same thing.
    if (prefs.getBoolean(BlockerPrefs.BLOCK_DNS_SETTINGS, false) &&
        pkg in BlockerPrefs.SETTINGS_PACKAGES) {
      performGlobalAction(GLOBAL_ACTION_HOME)
      return
    }

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
    val blocked = prefs.getStringSet(BlockerPrefs.BLOCKED_PACKAGES, emptySet()) ?: emptySet()
    val blockDns = prefs.getBoolean(BlockerPrefs.BLOCK_DNS_SETTINGS, false)

    if (blocked.isEmpty() && !blockDns) {
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

        if (blockDns && pkg in BlockerPrefs.SETTINGS_PACKAGES) {
          lastWindowsBlockAt = now
          performGlobalAction(GLOBAL_ACTION_HOME)
          return
        }

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

  override fun onInterrupt() {
    // No-op.
  }
}
