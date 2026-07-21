import { requireNativeModule } from 'expo-modules-core';
import type { BlockedAppEntry, InstalledApp, PhoneLockDurationMs, PhoneLockState } from './index.d';

const AppBlockerModule = requireNativeModule('AppBlocker');

export type { BlockedAppEntry, InstalledApp, PhoneLockDurationMs, PhoneLockState };

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

  startPhoneLock(durationMs: PhoneLockDurationMs): PhoneLockState {
    return AppBlockerModule.startPhoneLock(durationMs);
  },

  getPhoneLockState(): PhoneLockState {
    return AppBlockerModule.getPhoneLockState();
  },
};
