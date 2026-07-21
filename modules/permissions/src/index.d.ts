export declare const Permissions: {
  requestAccessibility(): Promise<boolean>;
  requestOverlay(): Promise<boolean>;
  requestBatteryOptimization(): Promise<boolean>;
  checkAccessibility(): Promise<boolean>;
  checkOverlay(): Promise<boolean>;
  checkBatteryOptimization(): Promise<boolean>;
  openAppInfo(): Promise<boolean>;
};
