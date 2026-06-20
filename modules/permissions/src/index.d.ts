export declare const Permissions: {
  requestAccessibility(): Promise<boolean>;
  requestOverlay(): Promise<boolean>;
  requestUsageStats(): Promise<boolean>;
  requestActivityRecognition(): Promise<boolean>;
  requestBatteryOptimization(): Promise<boolean>;
  requestNotifications(): Promise<boolean>;
  checkAccessibility(): Promise<boolean>;
  checkOverlay(): Promise<boolean>;
  checkUsageStats(): Promise<boolean>;
  checkActivityRecognition(): Promise<boolean>;
  checkBatteryOptimization(): Promise<boolean>;
  checkNotifications(): Promise<boolean>;
  openAppInfo(): Promise<boolean>;
};
