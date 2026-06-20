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

  async requestNotifications(): Promise<boolean> {
    return PermissionsModule.requestNotifications();
  },

  async checkAccessibility(): Promise<boolean> {
    return PermissionsModule.checkAccessibility();
  },

  async checkOverlay(): Promise<boolean> {
    return PermissionsModule.checkOverlay();
  },

  async checkUsageStats(): Promise<boolean> {
    return PermissionsModule.checkUsageStats();
  },

  async checkActivityRecognition(): Promise<boolean> {
    return PermissionsModule.checkActivityRecognition();
  },

  async checkBatteryOptimization(): Promise<boolean> {
    return PermissionsModule.checkBatteryOptimization();
  },

  async checkNotifications(): Promise<boolean> {
    return PermissionsModule.checkNotifications();
  },

  async openAppInfo(): Promise<boolean> {
    return PermissionsModule.openAppInfo();
  },
};
