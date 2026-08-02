package com.yagyaraj.locked

import android.accessibilityservice.AccessibilityService
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telecom.TelecomManager
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.LinearLayout
import android.widget.TextView
import expo.modules.appblocker.PhoneLockScheduler
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
  // resets at date rollover;
  // total is all-time. Read back via AppBlockerModule.getBlockStats().
  const val STATS_TOTAL = "stats_total"
  const val STATS_TODAY_COUNT = "stats_today_count"
  const val STATS_TODAY_DATE = "stats_today_date"

  const val PHONE_LOCK_END = PhoneLockScheduler.PHONE_LOCK_END
  const val PHONE_LOCK_PASS_END = PhoneLockScheduler.PHONE_LOCK_PASS_END
  const val PHONE_LOCK_COOLDOWN_END = PhoneLockScheduler.PHONE_LOCK_COOLDOWN_END
  const val PHONE_LOCK_PASSES_REMAINING = PhoneLockScheduler.PHONE_LOCK_PASSES_REMAINING
  const val PHONE_LOCK_ALLOWED_PACKAGES = PhoneLockScheduler.PHONE_LOCK_ALLOWED_PACKAGES
  const val PHONE_LOCK_CHANGED_ACTION = PhoneLockScheduler.PHONE_LOCK_CHANGED_ACTION
  const val PHONE_LOCK_PASS_MS = PhoneLockScheduler.PHONE_LOCK_PASS_MS
  const val PHONE_LOCK_PASS_COUNT = PhoneLockScheduler.PHONE_LOCK_PASS_COUNT

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

  private enum class OverlayMode { NONE, APP_BLOCK, PHONE_LOCK }

  // Last package we put up the block screen for, plus when. Prevents relaunching
  // BlockingActivity on top of itself while the same app keeps emitting events in
  // one episode. This is a SHORT TIME DEBOUNCE, not a sticky package guard: a
  // sticky guard that only clears when a non-blocked app appears stays stuck on
  // the blocked package whenever the launcher emits no window event after HOME
  // (OEM-dependent), which permanently disables re-blocking — the user can then
  // just keep reopening the app. The debounce always expires, so a genuine reopen
  // re-blocks.
  private var lastBlocked: String? = null
  private var lastBlockLaunchAt: Long = 0L

  // How long after launching the block screen we suppress a relaunch for the same
  // package. Long enough to swallow the window-event burst from HOME + our own
  // activity coming to front; short enough that reopening the app re-blocks.
  private val RELAUNCH_DEBOUNCE_MS = 1200L

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

  // --- Overlay block screen ------------------------------------------------
  // Drawn directly on top of everything via WindowManager (TYPE_APPLICATION_OVERLAY).
  // Made visible synchronously inside the accessibility event callback so there is
  // zero render gap — no activity launch, no start animation, no race. The blocked
  // app cannot be interacted with the instant showOverlay() returns.
  private var overlayWm: WindowManager? = null
  private var overlayRoot: BlockOverlayRoot? = null
  private var overlayTitleText: TextView? = null
  private var overlayTimerText: TextView? = null
  private var overlayPhaseText: TextView? = null
  private var overlayAppText: TextView? = null
  private var overlayHintText: TextView? = null
  private var overlayPrimaryAction: TextView? = null
  private var overlaySecondaryAction: TextView? = null
  private var overlayAllowedActions: LinearLayout? = null
  private var renderedAllowedPackages: Set<String> = emptySet()
  private var overlayOrbView: BreathingOrbView? = null
  private var overlayBreathAnimator: ValueAnimator? = null
  private val overlayHandler = Handler(Looper.getMainLooper())
  private var overlaySecondsRemaining = 300
  private var overlayRunning = false
  private var overlayMode = OverlayMode.NONE

  private val phoneLockTick = object : Runnable {
    override fun run() {
      syncPhoneLockOverlay()
    }
  }

  private val phoneLockReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == BlockerPrefs.PHONE_LOCK_CHANGED_ACTION) {
        syncPhoneLockOverlay()
      }
    }
  }
  private var phoneLockReceiverRegistered = false

  private val phaseLabels = arrayOf("inhale", "hold", "exhale", "hold")
  private val phaseDurations = longArrayOf(4000L, 4000L, 4000L, 4000L)
  private val phaseScales = arrayOf(
    Pair(0.72f, 1.0f), Pair(1.0f, 1.0f), Pair(1.0f, 0.72f), Pair(0.72f, 0.72f)
  )

  override fun onServiceConnected() {
    super.onServiceConnected()
    try {
      registerPhoneLockReceiver()
      PhoneLockScheduler.refresh(this)
      if (BuildConfig.DEBUG) runPhoneLockSelfCheck()
      syncPhoneLockOverlay()
    } catch (_: Exception) {
      schedulePhoneLockTick()
    }
  }

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

    if (handlePhoneLock(pkg, prefs)) return

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

    // Just launched the block screen for this package — don't relaunch on top of
    // the event burst. Time-debounced (not sticky) so a genuine reopen re-blocks.
    val now = System.currentTimeMillis()
    if (lastBlocked == pkg && now - lastBlockLaunchAt < RELAUNCH_DEBOUNCE_MS) return
    lastBlocked = pkg
    lastBlockLaunchAt = now

    launchBlockingActivity(pkg, prefs)
  }

  // Fires when the set of visible windows changes. Catches blocked apps that:
  //   (a) enter a split-screen pane without a direct user tap, or
  //   (b) open as a floating/freeform/popup window on OEMs that don't fire
  //       TYPE_WINDOW_STATE_CHANGED with the correct package name for overlays.
  // Requires canRetrieveWindowContent="true" in the accessibility config so that
  // window.root?.packageName is readable.
  private fun onWindowsChanged(prefs: SharedPreferences) {
    if (handlePhoneLock(currentForegroundPackage(), prefs)) return

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
        val debounced = lastBlocked == pkg && now - lastBlockLaunchAt < RELAUNCH_DEBOUNCE_MS
        if ((blockedUntil == 0L || now <= blockedUntil) && allowedUntil <= now && !debounced) {
          lastWindowsBlockAt = now
          lastBlocked = pkg
          lastBlockLaunchAt = now
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
    if (isInSplitScreen()) performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
    // Background the app so it's not interactive under the overlay.
    performGlobalAction(GLOBAL_ACTION_HOME)
    if (LATENCY_LOG) Log.d("BlockLatency", "showOverlay pkg=$pkg t=${System.currentTimeMillis()}")
    // Show overlay synchronously — no activity, no race, no render gap.
    overlayHandler.post { showAppBlockOverlay(pkg) }
  }

  private fun setupOverlay() {
    if (overlayRoot != null) return
    val wm = getSystemService(WINDOW_SERVICE) as WindowManager
    overlayWm = wm
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.OPAQUE
    )
    val root = BlockOverlayRoot(this) { handleOverlayBack() }
    buildOverlayLayout(root)
    root.visibility = View.GONE
    overlayRoot = root
    wm.addView(root, params)
  }

  private fun buildOverlayLayout(root: LinearLayout) {
    val d = resources.displayMetrics.density
    root.orientation = LinearLayout.VERTICAL
    root.gravity = Gravity.CENTER_HORIZONTAL
    root.setPadding((28 * d).toInt(), 0, (28 * d).toInt(), 0)
    root.setBackgroundColor(Color.parseColor("#0B0C0A"))

    root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 0.7f))

    root.addView(TextView(this).apply {
      text = "LOCKED"
      textSize = 12f
      setTextColor(Color.parseColor("#B7D95B"))
      gravity = Gravity.CENTER
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      letterSpacing = 0.18f
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      bottomMargin = (18 * d).toInt()
    })

    val titleText = TextView(this).apply {
      text = "Blocked"
      textSize = 32f
      setTextColor(Color.parseColor("#F5F7F0"))
      gravity = Gravity.CENTER
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
    }
    overlayTitleText = titleText
    root.addView(titleText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER_HORIZONTAL
    })

    val appText = TextView(this).apply {
      textSize = 16f
      setTextColor(Color.parseColor("#A8ADA0"))
      gravity = Gravity.CENTER
      maxLines = 2
    }
    overlayAppText = appText
    root.addView(appText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      topMargin = (8 * d).toInt()
      bottomMargin = (26 * d).toInt()
    })

    val orb = BreathingOrbView(this)
    overlayOrbView = orb
    val orbSize = (176 * d).toInt()
    root.addView(orb, LinearLayout.LayoutParams(orbSize, orbSize).apply {
      gravity = Gravity.CENTER_HORIZONTAL
    })

    val phaseText = TextView(this).apply {
      text = "inhale"
      textSize = 13f
      setTextColor(Color.parseColor("#B7D95B"))
      gravity = Gravity.CENTER
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      letterSpacing = 0.12f
      alpha = 0.8f
    }
    overlayPhaseText = phaseText
    root.addView(phaseText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      topMargin = (20 * d).toInt()
    })

    root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (32 * d).toInt()))

    val timerText = TextView(this).apply {
      text = "05:00"
      textSize = 46f
      typeface = Typeface.MONOSPACE
      setTextColor(Color.parseColor("#F5F7F0"))
      gravity = Gravity.CENTER
      letterSpacing = 0.04f
    }
    overlayTimerText = timerText
    root.addView(timerText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER_HORIZONTAL
    })

    val hintText = TextView(this).apply {
      text = "Breathe slowly. You will return home when this pause ends."
      textSize = 13f
      setTextColor(Color.parseColor("#A8ADA0"))
      gravity = Gravity.CENTER
      maxLines = 2
    }
    overlayHintText = hintText
    root.addView(hintText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      topMargin = (8 * d).toInt()
    })

    val primaryAction = TextView(this).apply {
      text = "Return Home"
      textSize = 16f
      setTextColor(Color.parseColor("#12150B"))
      gravity = Gravity.CENTER
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      minHeight = (48 * d).toInt()
      minWidth = (180 * d).toInt()
      setPadding((24 * d).toInt(), 0, (24 * d).toInt(), 0)
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = 28 * d
        setColor(Color.parseColor("#B7D95B"))
      }
      setOnClickListener { handlePrimaryAction() }
      contentDescription = "Return Home"
      isFocusable = true
      isFocusableInTouchMode = true
    }
    overlayPrimaryAction = primaryAction
    root.addView(primaryAction, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, (52 * d).toInt()).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      topMargin = (26 * d).toInt()
    })

    val secondaryAction = TextView(this).apply {
      text = "Open Phone"
      textSize = 15f
      setTextColor(Color.parseColor("#B7D95B"))
      gravity = Gravity.CENTER
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      minHeight = (48 * d).toInt()
      minWidth = (160 * d).toInt()
      setPadding((20 * d).toInt(), 0, (20 * d).toInt(), 0)
      setOnClickListener { openPhone() }
      contentDescription = "Open Phone without using a pass"
      isFocusable = true
      isFocusableInTouchMode = true
      visibility = View.GONE
    }
    overlaySecondaryAction = secondaryAction
    root.addView(secondaryAction, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, (48 * d).toInt()).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      topMargin = (8 * d).toInt()
    })

    val allowedActions = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      visibility = View.GONE
    }
    overlayAllowedActions = allowedActions
    root.addView(
      allowedActions,
      LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      )
    )

    root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 0.8f))
  }

  private fun registerPhoneLockReceiver() {
    if (phoneLockReceiverRegistered) return
    val filter = IntentFilter(BlockerPrefs.PHONE_LOCK_CHANGED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(phoneLockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      registerReceiver(phoneLockReceiver, filter)
    }
    phoneLockReceiverRegistered = true
  }

  private fun syncPhoneLockOverlay() {
    if (overlayRoot == null) {
      try {
        setupOverlay()
      } catch (_: Exception) {
        schedulePhoneLockTick()
        return
      }
    }
    val prefs = getSharedPreferences(BlockerPrefs.FILE, Context.MODE_PRIVATE)
    if (!handlePhoneLock(currentForegroundPackage(), prefs)) {
      onWindowsChanged(prefs)
    }
  }

  private fun handlePhoneLock(foregroundPackage: String?, prefs: SharedPreferences): Boolean {
    val now = System.currentTimeMillis()
    val endsAt = prefs.getLong(BlockerPrefs.PHONE_LOCK_END, 0L)
    if (endsAt == 0L) {
      if (overlayMode == OverlayMode.PHONE_LOCK) clearPhoneLock(prefs)
      return false
    }
    if (isPhoneLockExpired(now, endsAt)) {
      clearPhoneLock(prefs)
      return false
    }
    PhoneLockScheduler.resolveAccessCycle(prefs, now)

    if (isKeyguardActive()) {
      hidePhoneLockOverlay()
      schedulePhoneLockTick()
      return true
    }

    val passEndsAt = prefs.getLong(BlockerPrefs.PHONE_LOCK_PASS_END, 0L)
    if (passEndsAt > now) {
      hidePhoneLockOverlay()
      schedulePhoneLockTick()
      return true
    }
    val activePackage = foregroundPackage ?: currentForegroundPackage()
    val allowedPackages =
      prefs.getStringSet(BlockerPrefs.PHONE_LOCK_ALLOWED_PACKAGES, emptySet()) ?: emptySet()
    if (
      activePackage != null &&
      (activePackage in phonePackages() || activePackage in allowedPackages)
    ) {
      hidePhoneLockOverlay()
      schedulePhoneLockTick()
      return true
    }

    val becameVisible = showPhoneLockOverlay(prefs, endsAt, now)
    if (becameVisible) {
      if (isInSplitScreen()) performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
    schedulePhoneLockTick()
    return true
  }

  private fun schedulePhoneLockTick() {
    overlayHandler.removeCallbacks(phoneLockTick)
    overlayHandler.postDelayed(phoneLockTick, 1000L)
  }

  private fun clearPhoneLock(prefs: SharedPreferences) {
    PhoneLockScheduler.clearActiveLock(prefs)
    overlayHandler.removeCallbacks(phoneLockTick)
    if (overlayMode == OverlayMode.PHONE_LOCK) {
      overlayRunning = false
      overlayMode = OverlayMode.NONE
      overlayBreathAnimator?.cancel()
      overlayRoot?.visibility = View.GONE
    }
  }

  private fun showPhoneLockOverlay(
    prefs: SharedPreferences,
    endsAt: Long,
    now: Long
  ): Boolean {
    val wasVisible = overlayMode == OverlayMode.PHONE_LOCK && overlayRoot?.visibility == View.VISIBLE
    if (overlayMode != OverlayMode.PHONE_LOCK) {
      overlayHandler.removeCallbacksAndMessages(null)
      overlayBreathAnimator?.cancel()
    }
    overlayMode = OverlayMode.PHONE_LOCK
    overlayRunning = true
    overlayTitleText?.text = "Phone locked"
    overlayTimerText?.text = formatCountdown(endsAt - now)
    val passes = prefs.getInt(BlockerPrefs.PHONE_LOCK_PASSES_REMAINING, 0)
    val allowedPackages =
      prefs.getStringSet(BlockerPrefs.PHONE_LOCK_ALLOWED_PACKAGES, emptySet()) ?: emptySet()
    val cooldownEndsAt = prefs.getLong(BlockerPrefs.PHONE_LOCK_COOLDOWN_END, 0L)
    val coolingDown = cooldownEndsAt > now
    overlayAppText?.text = if (coolingDown) {
      "Passes reset in ${formatCountdown(cooldownEndsAt - now)}"
    } else if (passes == 1) {
      "1 pass left · 1 minute"
    } else {
      "$passes passes left · 1 minute each"
    }
    overlayHintText?.text =
      "Phone and allowed apps stay available. This lock cannot end early."
    overlayAllowedActions?.apply {
      visibility = if (allowedPackages.isEmpty()) View.GONE else View.VISIBLE
      if (allowedPackages != renderedAllowedPackages) {
        renderedAllowedPackages = allowedPackages.toSet()
        removeAllViews()
        allowedPackages.sortedBy(::appLabel).forEach { packageName ->
          addView(
            TextView(this@AppBlockingAccessibilityService).apply {
              text = "Open ${appLabel(packageName)}"
              textSize = 15f
              setTextColor(Color.parseColor("#B7D95B"))
              gravity = Gravity.CENTER
              typeface = Typeface.create("sans-serif", Typeface.BOLD)
              minHeight = (44 * resources.displayMetrics.density).toInt()
              contentDescription = "$text without using a pass"
              setOnClickListener { openAllowedApp(packageName) }
              isFocusable = true
              isFocusableInTouchMode = true
            },
            LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              (44 * resources.displayMetrics.density).toInt()
            )
          )
        }
      }
    }
    overlayPrimaryAction?.apply {
      text = if (coolingDown) {
        "Cooldown · ${formatCountdown(cooldownEndsAt - now)}"
      } else if (passes > 0) {
        "Use a 1-minute pass"
      } else {
        "No passes available"
      }
      contentDescription = if (coolingDown) {
        "Phone pass cooldown, ${formatCountdown(cooldownEndsAt - now)} remaining"
      } else if (passes > 0) {
        "Use a 1-minute pass, $passes remaining"
      } else {
        "No phone passes available"
      }
      isEnabled = passes > 0 && !coolingDown
      alpha = if (isEnabled) 1f else 0.45f
    }
    overlaySecondaryAction?.visibility = View.VISIBLE
    overlayRoot?.visibility = View.VISIBLE
    if (!wasVisible) {
      overlayPrimaryAction?.requestFocus()
      if (animationsEnabled()) {
        runOverlayBreathingPhase(0)
      } else {
        overlayOrbView?.breathScale = 0.86f
        overlayPhaseText?.apply { text = "breathe slowly"; alpha = 1f }
      }
    }
    return !wasVisible
  }

  private fun hidePhoneLockOverlay() {
    if (overlayMode == OverlayMode.APP_BLOCK) {
      overlayHandler.removeCallbacksAndMessages(null)
    }
    overlayMode = OverlayMode.PHONE_LOCK
    overlayRunning = false
    overlayBreathAnimator?.cancel()
    overlayRoot?.visibility = View.GONE
  }

  private fun usePhonePass() {
    val prefs = getSharedPreferences(BlockerPrefs.FILE, Context.MODE_PRIVATE)
    val now = System.currentTimeMillis()
    PhoneLockScheduler.resolveAccessCycle(prefs, now)
    val endsAt = prefs.getLong(BlockerPrefs.PHONE_LOCK_END, 0L)
    val remaining = prefs.getInt(BlockerPrefs.PHONE_LOCK_PASSES_REMAINING, 0)
    if (
      prefs.getLong(BlockerPrefs.PHONE_LOCK_PASS_END, 0L) > now ||
      prefs.getLong(BlockerPrefs.PHONE_LOCK_COOLDOWN_END, 0L) > now
    ) {
      return
    }
    val next = nextPhonePass(now, endsAt, remaining) ?: return
    prefs.edit()
      .putInt(BlockerPrefs.PHONE_LOCK_PASSES_REMAINING, next.first)
      .putLong(BlockerPrefs.PHONE_LOCK_PASS_END, next.second)
      .apply()
    hidePhoneLockOverlay()
    schedulePhoneLockTick()
  }

  private fun nextPhonePass(now: Long, endsAt: Long, remaining: Int): Pair<Int, Long>? {
    if (now >= endsAt || remaining <= 0) return null
    return Pair(remaining - 1, minOf(endsAt, now + BlockerPrefs.PHONE_LOCK_PASS_MS))
  }

  private fun isPhoneLockExpired(now: Long, endsAt: Long): Boolean = endsAt != 0L && endsAt <= now

  private fun runPhoneLockSelfCheck() {
    val now = 1_000L
    val endsAt = now + 60 * 60 * 1000L
    var remaining = BlockerPrefs.PHONE_LOCK_PASS_COUNT
    repeat(BlockerPrefs.PHONE_LOCK_PASS_COUNT) { index ->
      val next = checkNotNull(nextPhonePass(now, endsAt, remaining))
      remaining = next.first
      check(remaining == 1 - index)
      check(next.second == now + BlockerPrefs.PHONE_LOCK_PASS_MS)
    }
    check(remaining == 0)
    check(nextPhonePass(now, endsAt, remaining) == null)
    check(nextPhonePass(endsAt, endsAt, BlockerPrefs.PHONE_LOCK_PASS_COUNT) == null)
    check(isPhoneLockExpired(endsAt, endsAt))
    check(!isPhoneLockExpired(now, endsAt))
  }

  private fun openPhone() {
    val intent = Intent(Intent.ACTION_DIAL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      hidePhoneLockOverlay()
      startActivity(intent)
      schedulePhoneLockTick()
    } catch (_: Exception) {
      syncPhoneLockOverlay()
    }
  }

  private fun openAllowedApp(packageName: String) {
    val intent = packageManager.getLaunchIntentForPackage(packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ?: return
    try {
      hidePhoneLockOverlay()
      startActivity(intent)
      schedulePhoneLockTick()
    } catch (_: Exception) {
      syncPhoneLockOverlay()
    }
  }

  private fun phonePackages(): Set<String> {
    val packages = mutableSetOf<String>()
    val telecom = getSystemService(TELECOM_SERVICE) as? TelecomManager
    telecom?.defaultDialerPackage?.let(packages::add)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      telecom?.systemDialerPackage?.let(packages::add)
    }
    @Suppress("DEPRECATION")
    packageManager.resolveActivity(Intent(Intent.ACTION_DIAL), 0)
      ?.activityInfo?.packageName?.let(packages::add)
    return packages
  }

  private fun currentForegroundPackage(): String? {
    val root = try { rootInActiveWindow } catch (_: Exception) { null } ?: return null
    return try {
      root.packageName?.toString()
    } finally {
      root.recycle()
    }
  }

  private fun formatCountdown(remainingMs: Long): String {
    val seconds = (maxOf(0L, remainingMs) + 999L) / 1000L
    val hours = seconds / 3600L
    val minutes = (seconds % 3600L) / 60L
    val remainingSeconds = seconds % 60L
    return "%02d:%02d:%02d".format(hours, minutes, remainingSeconds)
  }

  private fun showAppBlockOverlay(pkg: String) {
    overlayHandler.removeCallbacksAndMessages(null)
    overlayBreathAnimator?.cancel()
    overlayMode = OverlayMode.APP_BLOCK
    overlayRunning = true
    overlaySecondsRemaining = 300
    overlayTitleText?.text = "Blocked"
    overlayTimerText?.text = "05:00"
    overlayAppText?.text = "${appLabel(pkg)} is paused"
    overlayHintText?.text = "Breathe slowly. You will return home when this pause ends."
    overlayPrimaryAction?.apply {
      text = "Return Home"
      contentDescription = "Return Home"
      isEnabled = true
      alpha = 1f
    }
    overlaySecondaryAction?.visibility = View.GONE
    overlayRoot?.visibility = View.VISIBLE
    overlayRoot?.requestFocus()
    startOverlayTimer()
    if (animationsEnabled()) {
      runOverlayBreathingPhase(0)
    } else {
      overlayOrbView?.breathScale = 0.86f
      overlayPhaseText?.apply { text = "breathe slowly"; alpha = 1f }
    }
    if (LATENCY_LOG) Log.d("BlockLatency", "overlayVisible t=${System.currentTimeMillis()}")
  }

  private fun dismissOverlay() {
    if (overlayMode == OverlayMode.PHONE_LOCK) return
    overlayRunning = false
    overlayMode = OverlayMode.NONE
    overlayBreathAnimator?.cancel()
    overlayHandler.removeCallbacksAndMessages(null)
    overlayRoot?.visibility = View.GONE
    performGlobalAction(GLOBAL_ACTION_HOME)
  }

  private fun handleOverlayBack() {
    if (overlayMode == OverlayMode.PHONE_LOCK) {
      performGlobalAction(GLOBAL_ACTION_HOME)
      overlayRoot?.requestFocus()
    } else {
      dismissOverlay()
    }
  }

  private fun handlePrimaryAction() {
    if (overlayMode == OverlayMode.PHONE_LOCK) usePhonePass() else dismissOverlay()
  }

  private fun startOverlayTimer() {
    val tick = object : Runnable {
      override fun run() {
        if (!overlayRunning) return
        overlaySecondsRemaining--
        val m = overlaySecondsRemaining / 60
        val s = overlaySecondsRemaining % 60
        overlayTimerText?.text = "%02d:%02d".format(m, s)
        if (overlaySecondsRemaining > 0) overlayHandler.postDelayed(this, 1000L)
        else dismissOverlay()
      }
    }
    overlayHandler.postDelayed(tick, 1000L)
  }

  private fun runOverlayBreathingPhase(phase: Int) {
    if (!overlayRunning || !animationsEnabled()) return
    val pt = overlayPhaseText ?: return
    ObjectAnimator.ofFloat(pt, "alpha", 0.8f, 0.2f).apply {
      duration = 220
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: android.animation.Animator) {
          pt.text = phaseLabels[phase]
          ObjectAnimator.ofFloat(pt, "alpha", 0.2f, 0.8f).apply { duration = 280; start() }
        }
      })
      start()
    }
    val (startScale, endScale) = phaseScales[phase]
    overlayBreathAnimator?.cancel()
    overlayBreathAnimator = ValueAnimator.ofFloat(startScale, endScale).apply {
      duration = phaseDurations[phase]
      interpolator = when (phase) {
        0 -> DecelerateInterpolator(1.6f); 2 -> AccelerateInterpolator(1.6f)
        else -> LinearInterpolator()
      }
      addUpdateListener { overlayOrbView?.breathScale = it.animatedValue as Float }
      addListener(object : AnimatorListenerAdapter() {
        private var cancelled = false
        override fun onAnimationCancel(animation: android.animation.Animator) { cancelled = true }
        override fun onAnimationEnd(animation: android.animation.Animator) {
          if (!cancelled && overlayRunning) runOverlayBreathingPhase((phase + 1) % 4)
        }
      })
      start()
    }
  }

  private fun animationsEnabled(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ValueAnimator.areAnimatorsEnabled()

  private fun appLabel(pkg: String): String = try {
    val info = packageManager.getApplicationInfo(pkg, 0)
    packageManager.getApplicationLabel(info).toString()
  } catch (_: Exception) {
    "This app"
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
    if (now - lastDnsBackAt < 400L) return true // BACK already in flight
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

    // Returns true = stop walking (positive match found, no need to visit more nodes).
    fun visit(node: AccessibilityNodeInfo?): Boolean {
      if (node == null) return false

      val id = node.viewIdResourceName?.lowercase()
      if (id != null && BlockerPrefs.PRIVATE_DNS_ID_HINTS.any { id.contains(it) }) mentionsDns = true

      val text = (
        (node.text?.toString() ?: "") + " " + (node.contentDescription?.toString() ?: "")
      ).lowercase()
      if (text.contains("private dns") || text.contains("private_dns")) mentionsDns = true
      if (BlockerPrefs.PRIVATE_DNS_TEXT_HINTS.any { text.contains(it) }) hasMarkerText = true
      if (node.isEditable || node.className?.toString() == "android.widget.EditText") hasEditable = true

      if (DNS_LOG) {
        Log.d(
          "DnsBlock",
          "class=${node.className} id=${node.viewIdResourceName} " +
            "text=${node.text} desc=${node.contentDescription}"
        )
      }

      // Early exit: enough info to confirm the chooser — stop traversal.
      if (hasMarkerText || (mentionsDns && hasEditable)) return true

      for (i in 0 until node.childCount) {
        val child = node.getChild(i)
        val done = visit(child)
        child?.recycle()
        if (done) return true
      }
      return false
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

  override fun onDestroy() {
    overlayRunning = false
    overlayBreathAnimator?.cancel()
    overlayHandler.removeCallbacksAndMessages(null)
    if (phoneLockReceiverRegistered) {
      try { unregisterReceiver(phoneLockReceiver) } catch (_: Exception) {}
      phoneLockReceiverRegistered = false
    }
    try { overlayRoot?.let { overlayWm?.removeView(it) } } catch (_: Exception) {}
    super.onDestroy()
  }
}

// Root view for the overlay block screen. Intercepts the back key so the user
// is sent home rather than letting the key fall through to the blocked app.
class BlockOverlayRoot(context: Context, private val onBack: () -> Unit) : LinearLayout(context) {
  init {
    isFocusable = true
    isFocusableInTouchMode = true
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
      onBack()
      return true
    }
    return super.dispatchKeyEvent(event)
  }
}
