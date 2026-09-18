import type { ThemePreference } from './colors';

export type CorePermissionStatuses = {
  accessibility: boolean;
  overlay: boolean;
};

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PhoneLockSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  days: Weekday[];
  startMinute: number;
  endMinute: number;
  allowedPackageNames: string[];
  activationNotBefore: number | null;
};

export type PhoneLockAccessState = {
  endsAt: number;
  passEndsAt: number | null;
  passesRemaining: number;
};

export type PhoneLockScheduleOccurrence = {
  schedule: PhoneLockSchedule;
  startsAt: Date;
  endsAt: Date;
};

export const PHONE_LOCK_ALLOWED_APP_LIMIT = 2;
export const PHONE_LOCK_PASS_COUNT = 2;
export const PHONE_LOCK_PASS_MS = 2 * 60_000;
export const PERMANENT_BLOCK_UNLOCK_MS = 2 * 60_000;

export const permanentBlockUnlockEndsAt = (now: number = Date.now()): number =>
  now + PERMANENT_BLOCK_UNLOCK_MS;

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export const getNewPhoneLockScheduleDefaults = (now: Date = new Date()) => {
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil((start.getMinutes() + 15) / 15) * 15);
  const startMinute = start.getHours() * 60 + start.getMinutes();
  return {
    days: [start.getDay() as Weekday],
    startMinute,
    endMinute: (startMinute + 60) % MINUTES_PER_DAY,
  };
};

const scheduleIntervals = (schedule: PhoneLockSchedule): Array<[number, number]> =>
  schedule.days.flatMap((day) => {
    const start = day * MINUTES_PER_DAY + schedule.startMinute;
    const duration =
      schedule.endMinute > schedule.startMinute
        ? schedule.endMinute - schedule.startMinute
        : MINUTES_PER_DAY - schedule.startMinute + schedule.endMinute;
    const end = start + duration;
    return end <= MINUTES_PER_WEEK
      ? [[start, end]]
      : [[start, MINUTES_PER_WEEK], [0, end - MINUTES_PER_WEEK]];
  });

export const getPhoneLockScheduleValidationError = (
  schedule: PhoneLockSchedule,
  existingSchedules: PhoneLockSchedule[]
): string | null => {
  if (schedule.days.length === 0) return 'Choose at least one day';
  if (
    !Number.isInteger(schedule.startMinute) ||
    !Number.isInteger(schedule.endMinute) ||
    schedule.startMinute < 0 ||
    schedule.startMinute >= MINUTES_PER_DAY ||
    schedule.endMinute < 0 ||
    schedule.endMinute >= MINUTES_PER_DAY
  ) {
    return 'Enter valid start and end times';
  }
  if (schedule.startMinute === schedule.endMinute) {
    return 'Start and end times must differ';
  }
  if (new Set(schedule.allowedPackageNames).size > PHONE_LOCK_ALLOWED_APP_LIMIT) {
    return `Choose up to ${PHONE_LOCK_ALLOWED_APP_LIMIT} allowed apps`;
  }
  if (!schedule.enabled) return null;
  const intervals = scheduleIntervals(schedule);
  const conflict = existingSchedules.find(
    (existing) =>
      existing.enabled &&
      existing.id !== schedule.id &&
      scheduleIntervals(existing).some(([existingStart, existingEnd]) =>
        intervals.some(([start, end]) => start < existingEnd && existingStart < end)
      )
  );
  return conflict ? `Schedule overlaps ${conflict.name || 'another schedule'}` : null;
};

const occurrenceStartingOn = (
  schedule: PhoneLockSchedule,
  startDay: Date
): PhoneLockScheduleOccurrence => {
  const startsAt = new Date(startDay);
  startsAt.setHours(
    Math.floor(schedule.startMinute / 60),
    schedule.startMinute % 60,
    0,
    0
  );
  const endsAt = new Date(startsAt);
  if (schedule.endMinute <= schedule.startMinute) endsAt.setDate(endsAt.getDate() + 1);
  endsAt.setHours(
    Math.floor(schedule.endMinute / 60),
    schedule.endMinute % 60,
    0,
    0
  );
  return { schedule, startsAt, endsAt };
};

export const getActivePhoneLockSchedule = (
  schedules: PhoneLockSchedule[],
  now: Date = new Date()
): PhoneLockScheduleOccurrence | null => {
  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    for (const dayOffset of [0, -1]) {
      const startDay = new Date(now);
      startDay.setDate(startDay.getDate() + dayOffset);
      if (!schedule.days.includes(startDay.getDay() as Weekday)) continue;
      const occurrence = occurrenceStartingOn(schedule, startDay);
      if (
        occurrence.startsAt.getTime() <= now.getTime() &&
        now.getTime() < occurrence.endsAt.getTime() &&
        (schedule.activationNotBefore == null ||
          occurrence.startsAt.getTime() >= schedule.activationNotBefore)
      ) {
        return occurrence;
      }
    }
  }
  return null;
};

export const getManualPhoneLockConflict = (
  schedules: PhoneLockSchedule[],
  startsAt: Date,
  endsAt: Date
): PhoneLockScheduleOccurrence | null => {
  const firstDay = new Date(startsAt);
  firstDay.setHours(0, 0, 0, 0);
  firstDay.setDate(firstDay.getDate() - 1);
  const lastDay = new Date(endsAt);
  lastDay.setHours(0, 0, 0, 0);
  lastDay.setDate(lastDay.getDate() + 1);
  let earliest: PhoneLockScheduleOccurrence | null = null;

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    for (
      const day = new Date(firstDay);
      day.getTime() <= lastDay.getTime();
      day.setDate(day.getDate() + 1)
    ) {
      if (!schedule.days.includes(day.getDay() as Weekday)) continue;
      const occurrence = occurrenceStartingOn(schedule, day);
      if (
        schedule.activationNotBefore != null &&
        occurrence.startsAt.getTime() < schedule.activationNotBefore
      ) {
        continue;
      }
      if (
        startsAt.getTime() < occurrence.endsAt.getTime() &&
        occurrence.startsAt.getTime() < endsAt.getTime() &&
        (earliest == null ||
          occurrence.startsAt.getTime() < earliest.startsAt.getTime())
      ) {
        earliest = occurrence;
      }
    }
  }
  return earliest;
};

export const resolvePhoneLockAccessState = (
  state: PhoneLockAccessState,
  now: number = Date.now()
): PhoneLockAccessState => {
  if (now >= state.endsAt) {
    return { ...state, passEndsAt: null, passesRemaining: 0 };
  }

  if (state.passEndsAt != null && state.passEndsAt <= now) {
    return {
      ...state,
      passEndsAt: null,
    };
  }
  return state;
};

export const requestPhoneLockPass = (
  state: PhoneLockAccessState,
  now: number = Date.now()
): PhoneLockAccessState | null => {
  const current = resolvePhoneLockAccessState(state, now);
  if (
    now >= current.endsAt ||
    current.passEndsAt != null ||
    current.passesRemaining <= 0
  ) {
    return null;
  }
  return {
    ...current,
    passEndsAt: Math.min(current.endsAt, now + PHONE_LOCK_PASS_MS),
    passesRemaining: current.passesRemaining - 1,
  };
};

export const migrateThemePreference = (value: unknown): ThemePreference =>
  value === 'dark' || value === 'light' || value === 'system' ? value : 'system';

export const areCorePermissionsReady = (statuses: CorePermissionStatuses): boolean =>
  statuses.accessibility && statuses.overlay;

export const filterEligibleApps = <T extends { packageName: string }>(
  installed: T[],
  blocked: Array<{ packageName: string }>
): T[] => {
  const blockedPackages = new Set(blocked.map((app) => app.packageName));
  return installed.filter((app) => !blockedPackages.has(app.packageName));
};

export const PHONE_LOCK_MIN_DURATION_MS = 5 * 60_000;
export const PHONE_LOCK_MAX_DURATION_MS = 24 * 60 * 60_000;
export const PHONE_LOCK_DURATION_STEP_MS = 5 * 60_000;

export const isPhoneLockDuration = (durationMs: number): boolean =>
  Number.isInteger(durationMs) &&
  durationMs >= PHONE_LOCK_MIN_DURATION_MS &&
  durationMs <= PHONE_LOCK_MAX_DURATION_MS &&
  durationMs % PHONE_LOCK_DURATION_STEP_MS === 0;

export const phoneLockDurationFromParts = (hours: number, minutes: number): number =>
  (hours * 60 + minutes) * 60_000;

export const formatPhoneLockDuration = (durationMs: number): string => {
  const totalMinutes = durationMs / 60_000;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours > 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : '', minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
};

export const phoneLockRemainingMs = (endsAt: number | null, now: number = Date.now()): number =>
  endsAt == null ? 0 : Math.max(0, endsAt - now);

export const formatPhoneLockCountdown = (endsAt: number | null, now: number = Date.now()): string => {
  const totalSeconds = Math.ceil(phoneLockRemainingMs(endsAt, now) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};
