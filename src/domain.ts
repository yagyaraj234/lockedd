import type { ThemePreference } from './colors';

export type CorePermissionStatuses = {
  accessibility: boolean;
  overlay: boolean;
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
