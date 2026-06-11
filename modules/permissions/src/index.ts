import { requireNativeModule } from 'expo-modules-core';

const PermissionsModule = requireNativeModule('Permissions');

export const Permissions = {
  async requestAccessibility(): Promise<boolean> {
    return PermissionsModule.requestAccessibility();
  },

  async requestOverlay(): Promise<boolean> {
    return PermissionsModule.requestOverlay();
  },

  async requestUsageStats(): Promise<boolean> {
    return PermissionsModule.requestUsageStats();
  },

  async requestActivityRecognition(): Promise<boolean> {
    return PermissionsModule.requestActivityRecognition();
  },

  async requestBatteryOptimization(): Promise<boolean> {
    return PermissionsModule.requestBatteryOptimization();
  },
};
