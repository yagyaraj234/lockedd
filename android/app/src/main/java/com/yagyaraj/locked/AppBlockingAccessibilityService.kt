package com.yagyaraj.locked

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

// Shared SharedPreferences contract between the JS-facing AppBlockerModule
// (package expo.modules.appblocker) and this service. Same app, so the prefs
// file is shared by appId. Keep these literals identical to the ones in
// AppBlockerModule.blockerPrefs().
object BlockerPrefs {
  const val FILE = "locked_blocker"
  const val BLOCKED_PACKAGES = "blockedPackages"
  const val ALLOW_PREFIX = "allow_"
  const val UNTIL_PREFIX = "until_"
}

/**
 * Watches foreground-app changes. When a blocked app (and not currently
 * temporarily allowed) comes to the foreground, launches BlockingActivity over
 * it. The service stays alive on its own while enabled in Accessibility
 * settings — no foreground service required.
 */
class AppBlockingAccessibilityService : AccessibilityService() {

  // Last package we put up the block screen for. Prevents relaunching
  // BlockingActivity on top of itself while the same app keeps emitting events.
  private var lastBlocked: String? = null

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

    val pkg = event.packageName?.toString() ?: return

    // Our own windows (including BlockingActivity) — never block ourselves, and
    // reset the guard so the blocked app re-triggers when reopened later.
    if (pkg == packageName) {
      lastBlocked = null
      return
    }

    val prefs = getSharedPreferences(BlockerPrefs.FILE, Context.MODE_PRIVATE)
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

  override fun onInterrupt() {
    // No-op.
  }
}
