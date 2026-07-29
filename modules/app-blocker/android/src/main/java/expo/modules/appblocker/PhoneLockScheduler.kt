package expo.modules.appblocker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

data class PhoneLockScheduleNative(
  val id: String,
  val name: String,
  val enabled: Boolean,
  val days: Set<Int>,
  val startMinute: Int,
  val endMinute: Int,
  val allowedPackageNames: Set<String>,
  val activationNotBefore: Long,
)

data class PhoneLockOccurrence(
  val schedule: PhoneLockScheduleNative,
  val startsAt: Long,
  val endsAt: Long,
)

data class PhoneLockConflict(
  val scheduleName: String,
  val startsAt: Long,
)

object PhoneLockScheduler {
  const val PREFS_FILE = "locked_blocker"
  const val SCHEDULES = "phone_lock_schedules"
  const val PHONE_LOCK_END = "phone_lock_end"
  const val PHONE_LOCK_PASS_END = "phone_lock_pass_end"
  const val PHONE_LOCK_COOLDOWN_END = "phone_lock_cooldown_end"
  const val PHONE_LOCK_PASSES_REMAINING = "phone_lock_passes_remaining"
  const val PHONE_LOCK_ALLOWED_PACKAGES = "phone_lock_allowed_packages"
  const val PHONE_LOCK_SOURCE = "phone_lock_source"
  const val PHONE_LOCK_ACTIVE_SCHEDULE_ID = "phone_lock_active_schedule_id"
  const val PHONE_LOCK_CHANGED_ACTION = "com.yagyaraj.locked.PHONE_LOCK_CHANGED"
  const val ALARM_ACTION = "com.yagyaraj.locked.PHONE_LOCK_SCHEDULE_ALARM"
  const val PHONE_LOCK_PASS_COUNT = 2
  const val PHONE_LOCK_PASS_MS = 60_000L
  const val PHONE_LOCK_COOLDOWN_MS = 5 * 60_000L

  private const val MINUTES_PER_DAY = 24 * 60
  private const val MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY
  private const val ALARM_REQUEST_CODE = 7401

  private val protectedPackages = setOf(
    "com.android.settings",
    "com.samsung.android.settings",
    "com.miui.settings",
    "com.oneplus.settings",
    "com.android.packageinstaller",
    "com.google.android.packageinstaller",
    "com.samsung.android.packageinstaller",
    "com.android.permissioncontroller",
  )

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)

  fun isProtectedPackage(context: Context, packageName: String): Boolean =
    packageName == context.packageName || packageName in protectedPackages

  fun alwaysAllowedPackages(context: Context): Set<String> = buildSet {
    val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
    telecom?.defaultDialerPackage?.let(::add)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      telecom?.systemDialerPackage?.let(::add)
    }
    @Suppress("DEPRECATION")
    context.packageManager.resolveActivity(Intent(Intent.ACTION_DIAL), 0)
      ?.activityInfo?.packageName?.let(::add)
  }

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return alarmManager.canScheduleExactAlarms()
  }

  fun openExactAlarmSettings(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    context.startActivity(
      Intent(
        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }

  fun getSchedules(context: Context): List<PhoneLockScheduleNative> {
    val encoded = prefs(context).getString(SCHEDULES, "[]") ?: "[]"
    return try {
      val array = JSONArray(encoded)
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          add(
            PhoneLockScheduleNative(
              id = item.getString("id"),
              name = item.optString("name"),
              enabled = item.optBoolean("enabled", true),
              days = item.getJSONArray("days").toIntSet(),
              startMinute = item.getInt("startMinute"),
              endMinute = item.getInt("endMinute"),
              allowedPackageNames =
                item.optJSONArray("allowedPackageNames")?.toStringSet() ?: emptySet(),
              activationNotBefore = item.optLong("activationNotBefore", 0L),
            )
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun upsertSchedule(
    context: Context,
    input: PhoneLockScheduleNative,
    now: Long = System.currentTimeMillis(),
  ): PhoneLockScheduleNative {
    checkNoActiveLock(context, now)
    val schedules = getSchedules(context)
    val existing = schedules.find { it.id == input.id }
    if (input.enabled) {
      check(canScheduleExactAlarms(context)) { "Allow Alarms & reminders before enabling schedules" }
    }

    val definitionChanged =
      existing == null ||
        (!existing.enabled && input.enabled) ||
        existing.days != input.days ||
        existing.startMinute != input.startMinute ||
        existing.endMinute != input.endMinute
    val activationNotBefore =
      if (!input.enabled) {
        0L
      } else if (definitionChanged) {
        currentOccurrence(input.copy(activationNotBefore = 0L), now)?.endsAt ?: now
      } else {
        existing.activationNotBefore
      }
    val schedule =
      input.copy(
        name = input.name.trim(),
        allowedPackageNames =
          input.allowedPackageNames.toSet() - alwaysAllowedPackages(context),
        activationNotBefore = activationNotBefore,
      )
    validateSchedule(context, schedule, schedules)
    writeSchedules(context, schedules.filterNot { it.id == schedule.id } + schedule)
    refresh(context, now)
    return schedule
  }

  fun deleteSchedule(context: Context, id: String, now: Long = System.currentTimeMillis()) {
    checkNoActiveLock(context, now)
    writeSchedules(context, getSchedules(context).filterNot { it.id == id })
    refresh(context, now)
  }

  fun setScheduleEnabled(
    context: Context,
    id: String,
    enabled: Boolean,
    now: Long = System.currentTimeMillis(),
  ): PhoneLockScheduleNative {
    val existing = getSchedules(context).find { it.id == id }
      ?: throw IllegalArgumentException("Schedule not found")
    return upsertSchedule(context, existing.copy(enabled = enabled), now)
  }

  fun firstManualConflict(
    context: Context,
    startsAt: Long,
    endsAt: Long,
  ): PhoneLockConflict? {
    var earliest: PhoneLockOccurrence? = null
    for (schedule in getSchedules(context).filter { it.enabled }) {
      for (offset in -1..8) {
        val occurrence = occurrenceStartingOn(schedule, startsAt, offset)
        if (
          occurrence.startsAt >= schedule.activationNotBefore &&
          startsAt < occurrence.endsAt &&
          occurrence.startsAt < endsAt &&
          (earliest == null || occurrence.startsAt < earliest.startsAt)
        ) {
          earliest = occurrence
        }
      }
    }
    return earliest?.let {
      PhoneLockConflict(it.schedule.name.ifBlank { "scheduled lock" }, it.startsAt)
    }
  }

  fun refresh(context: Context, now: Long = System.currentTimeMillis()) {
    val shared = prefs(context)
    resolveAccessCycle(shared, now)
    val active = getSchedules(context)
      .asSequence()
      .filter { it.enabled }
      .mapNotNull { currentOccurrence(it, now) }
      .minByOrNull { it.startsAt }
    val source = shared.getString(PHONE_LOCK_SOURCE, "")
    val currentEnd = shared.getLong(PHONE_LOCK_END, 0L)
    var changed = false

    if (active != null && (source != "manual" || currentEnd <= now)) {
      val sameOccurrence =
        source == "schedule" &&
          shared.getString(PHONE_LOCK_ACTIVE_SCHEDULE_ID, "") == active.schedule.id &&
          currentEnd == active.endsAt
      if (!sameOccurrence) {
        shared.edit()
          .putLong(PHONE_LOCK_END, active.endsAt)
          .remove(PHONE_LOCK_PASS_END)
          .remove(PHONE_LOCK_COOLDOWN_END)
          .putInt(PHONE_LOCK_PASSES_REMAINING, PHONE_LOCK_PASS_COUNT)
          .putStringSet(PHONE_LOCK_ALLOWED_PACKAGES, active.schedule.allowedPackageNames)
          .putString(PHONE_LOCK_SOURCE, "schedule")
          .putString(PHONE_LOCK_ACTIVE_SCHEDULE_ID, active.schedule.id)
          .apply()
        changed = true
      }
    } else if (source == "schedule" && (active == null || currentEnd <= now)) {
      clearActiveLock(shared)
      changed = true
    } else if (currentEnd != 0L && currentEnd <= now) {
      clearActiveLock(shared)
      changed = true
    }

    scheduleNextTransition(context, now)
    if (changed) notifyLockChanged(context)
  }

  fun resolveAccessCycle(
    shared: android.content.SharedPreferences,
    now: Long = System.currentTimeMillis(),
  ) {
    val endsAt = shared.getLong(PHONE_LOCK_END, 0L)
    if (endsAt == 0L || endsAt <= now) return
    val passEndsAt = shared.getLong(PHONE_LOCK_PASS_END, 0L)
    var cooldownEndsAt = shared.getLong(PHONE_LOCK_COOLDOWN_END, 0L)
    val editor = shared.edit()
    var changed = false
    if (passEndsAt != 0L && passEndsAt <= now) {
      editor.remove(PHONE_LOCK_PASS_END)
      if (shared.getInt(PHONE_LOCK_PASSES_REMAINING, 0) == 0 && cooldownEndsAt == 0L) {
        cooldownEndsAt = minOf(endsAt, passEndsAt + PHONE_LOCK_COOLDOWN_MS)
        editor.putLong(PHONE_LOCK_COOLDOWN_END, cooldownEndsAt)
      }
      changed = true
    }
    if (cooldownEndsAt != 0L && cooldownEndsAt <= now) {
      editor.remove(PHONE_LOCK_COOLDOWN_END)
      editor.putInt(PHONE_LOCK_PASSES_REMAINING, PHONE_LOCK_PASS_COUNT)
      changed = true
    }
    if (changed) editor.apply()
  }

  fun clearActiveLock(shared: android.content.SharedPreferences) {
    shared.edit()
      .remove(PHONE_LOCK_END)
      .remove(PHONE_LOCK_PASS_END)
      .remove(PHONE_LOCK_COOLDOWN_END)
      .remove(PHONE_LOCK_PASSES_REMAINING)
      .remove(PHONE_LOCK_ALLOWED_PACKAGES)
      .remove(PHONE_LOCK_SOURCE)
      .remove(PHONE_LOCK_ACTIVE_SCHEDULE_ID)
      .apply()
  }

  fun notifyLockChanged(context: Context) {
    context.sendBroadcast(Intent(PHONE_LOCK_CHANGED_ACTION).setPackage(context.packageName))
  }

  private fun checkNoActiveLock(context: Context, now: Long) {
    check(prefs(context).getLong(PHONE_LOCK_END, 0L) <= now) {
      "Schedules cannot change during an active Phone Lock"
    }
  }

  private fun validateSchedule(
    context: Context,
    schedule: PhoneLockScheduleNative,
    existing: List<PhoneLockScheduleNative>,
  ) {
    require(schedule.id.isNotBlank()) { "Schedule id is required" }
    require(schedule.days.isNotEmpty() && schedule.days.all { it in 0..6 }) {
      "Choose at least one day"
    }
    require(schedule.startMinute in 0 until MINUTES_PER_DAY) { "Invalid start time" }
    require(schedule.endMinute in 0 until MINUTES_PER_DAY) { "Invalid end time" }
    require(schedule.startMinute != schedule.endMinute) { "Start and end times must differ" }
    require(schedule.allowedPackageNames.size <= 5) { "Choose up to 5 allowed apps" }
    require(schedule.allowedPackageNames.none { isProtectedPackage(context, it) }) {
      "Settings, installers, and Locked cannot be allowed"
    }
    if (!schedule.enabled) return
    val intervals = weeklyIntervals(schedule)
    val conflict = existing.firstOrNull { candidate ->
      candidate.enabled &&
        candidate.id != schedule.id &&
        weeklyIntervals(candidate).any { other ->
          intervals.any { interval ->
            interval.first < other.second && other.first < interval.second
          }
        }
    }
    require(conflict == null) {
      "Schedule overlaps ${conflict?.name?.ifBlank { "another schedule" }}"
    }
  }

  private fun weeklyIntervals(schedule: PhoneLockScheduleNative): List<Pair<Int, Int>> =
    schedule.days.flatMap { day ->
      val start = day * MINUTES_PER_DAY + schedule.startMinute
      val duration =
        if (schedule.endMinute > schedule.startMinute) {
          schedule.endMinute - schedule.startMinute
        } else {
          MINUTES_PER_DAY - schedule.startMinute + schedule.endMinute
        }
      val end = start + duration
      if (end <= MINUTES_PER_WEEK) {
        listOf(start to end)
      } else {
        listOf(start to MINUTES_PER_WEEK, 0 to (end - MINUTES_PER_WEEK))
      }
    }

  private fun currentOccurrence(
    schedule: PhoneLockScheduleNative,
    now: Long,
  ): PhoneLockOccurrence? {
    for (offset in listOf(0, -1)) {
      val occurrence = occurrenceStartingOn(schedule, now, offset)
      if (
        occurrence.startsAt >= schedule.activationNotBefore &&
        occurrence.startsAt <= now &&
        now < occurrence.endsAt
      ) {
        return occurrence
      }
    }
    return null
  }

  private fun occurrenceStartingOn(
    schedule: PhoneLockScheduleNative,
    anchor: Long,
    dayOffset: Int,
  ): PhoneLockOccurrence {
    val start = Calendar.getInstance().apply {
      timeInMillis = anchor
      add(Calendar.DATE, dayOffset)
      set(Calendar.HOUR_OF_DAY, schedule.startMinute / 60)
      set(Calendar.MINUTE, schedule.startMinute % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    if ((start.get(Calendar.DAY_OF_WEEK) - 1) !in schedule.days) {
      return PhoneLockOccurrence(schedule, Long.MAX_VALUE, Long.MAX_VALUE)
    }
    val end = (start.clone() as Calendar).apply {
      if (schedule.endMinute <= schedule.startMinute) add(Calendar.DATE, 1)
      set(Calendar.HOUR_OF_DAY, schedule.endMinute / 60)
      set(Calendar.MINUTE, schedule.endMinute % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    return PhoneLockOccurrence(schedule, start.timeInMillis, end.timeInMillis)
  }

  private fun nextOccurrence(
    schedule: PhoneLockScheduleNative,
    now: Long,
  ): PhoneLockOccurrence? {
    var earliest: PhoneLockOccurrence? = null
    for (offset in 0..7) {
      val occurrence = occurrenceStartingOn(schedule, now, offset)
      if (
        occurrence.startsAt != Long.MAX_VALUE &&
        occurrence.startsAt > now &&
        occurrence.startsAt >= schedule.activationNotBefore &&
        (earliest == null || occurrence.startsAt < earliest.startsAt)
      ) {
        earliest = occurrence
      }
    }
    return earliest
  }

  private fun scheduleNextTransition(context: Context, now: Long) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = PendingIntent.getBroadcast(
      context,
      ALARM_REQUEST_CODE,
      Intent(context, PhoneLockAlarmReceiver::class.java).setAction(ALARM_ACTION),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    alarmManager.cancel(pendingIntent)
    if (!canScheduleExactAlarms(context)) return
    val schedules = getSchedules(context).filter { it.enabled }
    val activeEnd = schedules.mapNotNull { currentOccurrence(it, now)?.endsAt }.minOrNull()
    val nextStart = schedules.mapNotNull { nextOccurrence(it, now)?.startsAt }.minOrNull()
    val transition = listOfNotNull(activeEnd, nextStart).minOrNull() ?: return
    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, transition, pendingIntent)
  }

  private fun writeSchedules(context: Context, schedules: List<PhoneLockScheduleNative>) {
    val array = JSONArray()
    schedules.forEach { schedule ->
      array.put(JSONObject().apply {
        put("id", schedule.id)
        put("name", schedule.name)
        put("enabled", schedule.enabled)
        put("days", JSONArray(schedule.days.sorted()))
        put("startMinute", schedule.startMinute)
        put("endMinute", schedule.endMinute)
        put("allowedPackageNames", JSONArray(schedule.allowedPackageNames.sorted()))
        put("activationNotBefore", schedule.activationNotBefore)
      })
    }
    prefs(context).edit().putString(SCHEDULES, array.toString()).apply()
  }

  private fun JSONArray.toIntSet(): Set<Int> =
    buildSet { for (index in 0 until length()) add(getInt(index)) }

  private fun JSONArray.toStringSet(): Set<String> =
    buildSet { for (index in 0 until length()) add(getString(index)) }
}

class PhoneLockAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_TIMEZONE_CHANGED) {
      TimeZone.setDefault(null)
    }
    when (intent?.action) {
      PhoneLockScheduler.ALARM_ACTION,
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED ->
        PhoneLockScheduler.refresh(context)
    }
  }
}
