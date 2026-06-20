export interface InstalledApp {
  packageName: string;
  appName: string;
  iconBase64: string;
}

export interface BlockedAppEntry {
  packageName: string;
  /** Epoch millis the block expires at; null = permanent. */
  blockUntil: number | null;
}

export declare const AppBlocker: {
  getInstalledApps(): Promise<InstalledApp[]>;
  isAccessibilityEnabled(): Promise<boolean>;
  setBlockedApps(apps: BlockedAppEntry[]): boolean;
  setTemporaryAllow(packageName: string, untilMillis: number): boolean;
};
