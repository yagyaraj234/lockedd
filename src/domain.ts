import type { ThemePreference } from './colors';

export type CorePermissionStatuses = {
  accessibility: boolean;
  overlay: boolean;
};

export const migrateThemePreference = (value: unknown): ThemePreference =>
  value === 'dark' || value === 'light' || value === 'system' ? value : 'system';

export const areCorePermissionsReady = (statuses: CorePermissionStatuses): boolean =>
  statuses.accessibility && statuses.overlay;

export const filterEligibleApps = <T extends { packageName: string }>(
  installed: T[],
  blocked: Array<{ packageName: string }>
): T[] => {
  const blockedPackages = new Set(blocked.map((app) => app.packageName));
  return installed.filter((app) => !blockedPackages.has(app.packageName));
};
