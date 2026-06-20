import { requireNativeModule } from 'expo-modules-core';
import type { BlockedAppEntry, InstalledApp } from './index.d';

const AppBlockerModule = requireNativeModule('AppBlocker');

export type { BlockedAppEntry, InstalledApp };

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

  setTemporaryAllow(packageName: string, untilMillis: number): boolean {
    return AppBlockerModule.setTemporaryAllow(packageName, untilMillis);
  },
};
