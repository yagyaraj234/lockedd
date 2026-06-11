import { requireNativeModule } from 'expo-modules-core';
import type { InstalledApp } from './index.d';

const AppBlockerModule = requireNativeModule('AppBlocker');

export type { InstalledApp };

export const AppBlocker = {
  async getInstalledApps(): Promise<InstalledApp[]> {
    return AppBlockerModule.getInstalledApps();
  },

  async isAccessibilityEnabled(): Promise<boolean> {
    return AppBlockerModule.isAccessibilityEnabled();
  },

  setBlockedApps(packages: string[]): boolean {
    return AppBlockerModule.setBlockedApps(packages);
  },
};
