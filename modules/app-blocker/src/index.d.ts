export interface InstalledApp {
  packageName: string;
  appName: string;
  iconBase64: string;
}

export declare const AppBlocker: {
  getInstalledApps(): Promise<InstalledApp[]>;
  isAccessibilityEnabled(): Promise<boolean>;
  setBlockedApps(packages: string[]): boolean;
};
