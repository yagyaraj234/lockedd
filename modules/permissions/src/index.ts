import { requireNativeModule } from 'expo-modules-core';

const PermissionsModule = requireNativeModule('Permissions');

export const Permissions = {
  requestAccessibility: (): Promise<boolean> => PermissionsModule.requestAccessibility(),
  requestOverlay: (): Promise<boolean> => PermissionsModule.requestOverlay(),
  requestBatteryOptimization: (): Promise<boolean> =>
    PermissionsModule.requestBatteryOptimization(),
  checkAccessibility: (): Promise<boolean> => PermissionsModule.checkAccessibility(),
  checkOverlay: (): Promise<boolean> => PermissionsModule.checkOverlay(),
  checkBatteryOptimization: (): Promise<boolean> =>
    PermissionsModule.checkBatteryOptimization(),
  openAppInfo: (): Promise<boolean> => PermissionsModule.openAppInfo(),
};
