export interface InstalledApp {
  packageName: string;
  appName: string;
  iconBase64: string;
  canAllowDuringPhoneLock: boolean;
  isAlwaysAllowedDuringPhoneLock: boolean;
}

export interface BlockedAppEntry {
  packageName: string;
  /** Epoch millis the block expires at; null = permanent. */
  blockUntil: number | null;
}

export type PhoneLockDurationMs = number;

export interface PhoneLockState {
  active: boolean;
  endsAt: number | null;
  passEndsAt: number | null;
  passesRemaining: number;
  cooldownEndsAt: number | null;
  source: 'manual' | 'schedule' | null;
  activeScheduleId: string | null;
  allowedPackageNames: string[];
}

export interface PhoneLockSchedule {
  id: string;
  name: string;
  enabled: boolean;
  days: number[];
  startMinute: number;
  endMinute: number;
  allowedPackageNames: string[];
  activationNotBefore: number | null;
}

export type PhoneLockScheduleInput = Omit<PhoneLockSchedule, 'activationNotBefore'>;

export declare const AppBlocker: {
  getInstalledApps(): Promise<InstalledApp[]>;
  isAccessibilityEnabled(): Promise<boolean>;
  setBlockedApps(apps: BlockedAppEntry[]): boolean;
  setPrivateDns(hostname: string): boolean;
  hasWriteSecureSettings(): boolean;
  getPrivateDns(): { mode: string; specifier: string };
  getBlockStats(): { totalAttempts: number; todayAttempts: number };
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): boolean;
  getPhoneLockSchedules(): PhoneLockSchedule[];
  upsertPhoneLockSchedule(schedule: PhoneLockScheduleInput): PhoneLockSchedule;
  deletePhoneLockSchedule(id: string): boolean;
  setPhoneLockScheduleEnabled(id: string, enabled: boolean): PhoneLockSchedule;
  startPhoneLock(
    durationMs: PhoneLockDurationMs,
    allowedPackageNames?: string[]
  ): PhoneLockState;
  getPhoneLockState(): PhoneLockState;
};
