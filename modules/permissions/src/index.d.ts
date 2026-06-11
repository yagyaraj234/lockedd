export declare const Permissions: {
  requestAccessibility(): Promise<boolean>;
  requestOverlay(): Promise<boolean>;
  requestUsageStats(): Promise<boolean>;
  requestActivityRecognition(): Promise<boolean>;
  requestBatteryOptimization(): Promise<boolean>;
};
