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
  setPrivateDns(hostname: string): boolean;
  hasWriteSecureSettings(): boolean;
  getPrivateDns(): { mode: string; specifier: string };
  getBlockStats(): { totalAttempts: number; todayAttempts: number };
};
