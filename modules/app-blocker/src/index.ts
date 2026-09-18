import { requireNativeModule } from 'expo-modules-core';
import type {
  BlockedAppEntry,
  InstalledApp,
  OverlayDesign,
  PhoneLockDurationMs,
  PhoneLockSchedule,
  PhoneLockScheduleInput,
  PhoneLockState,
} from './index.d';

const AppBlockerModule = requireNativeModule('AppBlocker');

export type {
  BlockedAppEntry,
  InstalledApp,
  OverlayDesign,
  PhoneLockDurationMs,
  PhoneLockSchedule,
  PhoneLockScheduleInput,
  PhoneLockState,
};

export const AppBlocker = {
  async getInstalledApps(): Promise<InstalledApp[]> {
    return AppBlockerModule.getInstalledApps();
  },

  async isAccessibilityEnabled(): Promise<boolean> {
    return AppBlockerModule.isAccessibilityEnabled();
  },

  setBlockedApps(apps: BlockedAppEntry[]): boolean {
    return AppBlockerModule.setBlockedApps(apps);
  },

  unlockPermanentBlockForTwoMinutes(packageName: string): number {
    return AppBlockerModule.unlockPermanentBlockForTwoMinutes(packageName);
  },

  setPrivateDns(hostname: string): boolean {
    return AppBlockerModule.setPrivateDns(hostname);
  },

  hasWriteSecureSettings(): boolean {
    return AppBlockerModule.hasWriteSecureSettings();
  },

  getPrivateDns(): { mode: string; specifier: string } {
    return AppBlockerModule.getPrivateDns();
  },

  getBlockStats(): { totalAttempts: number; todayAttempts: number } {
    return AppBlockerModule.getBlockStats();
  },

  canScheduleExactAlarms(): boolean {
    return AppBlockerModule.canScheduleExactAlarms();
  },

  openExactAlarmSettings(): boolean {
    return AppBlockerModule.openExactAlarmSettings();
  },

  getPhoneLockSchedules(): PhoneLockSchedule[] {
    return AppBlockerModule.getPhoneLockSchedules();
  },

  upsertPhoneLockSchedule(schedule: PhoneLockScheduleInput): PhoneLockSchedule {
    return AppBlockerModule.upsertPhoneLockSchedule(schedule);
  },

  deletePhoneLockSchedule(id: string): boolean {
    return AppBlockerModule.deletePhoneLockSchedule(id);
  },

  setPhoneLockScheduleEnabled(id: string, enabled: boolean): PhoneLockSchedule {
    return AppBlockerModule.setPhoneLockScheduleEnabled(id, enabled);
  },

  startPhoneLock(
    durationMs: PhoneLockDurationMs,
    allowedPackageNames: string[] = []
  ): PhoneLockState {
    return AppBlockerModule.startPhoneLock(durationMs, allowedPackageNames);
  },

  getPhoneLockState(): PhoneLockState {
    return AppBlockerModule.getPhoneLockState();
  },

  getOverlayDesign(): OverlayDesign {
    return AppBlockerModule.getOverlayDesign();
  },

  getCustomWallpaperUri(): string | null {
    return AppBlockerModule.getCustomWallpaperUri();
  },

  openCustomWallpaperPicker(): boolean {
    return AppBlockerModule.openCustomWallpaperPicker();
  },

  setOverlayDesign(design: OverlayDesign): OverlayDesign {
    return AppBlockerModule.setOverlayDesign(design);
  },
};
