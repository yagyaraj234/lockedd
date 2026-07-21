// react-native-mmkv 4.x (Nitro) no longer exports a constructable `MMKV` class —
// `MMKV` is a type-only export, so `new MMKV()` throws "undefined cannot be used
// as a constructor". The v4 API creates instances via createMMKV().
import { createMMKV } from 'react-native-mmkv';
import type { ThemePreference } from '../colors';
import { migrateThemePreference } from '../domain';

// Use a lazy singleton
let _storage: any = null;
const getStorage = (): any => {
  if (!_storage) {
    try {
      _storage = createMMKV();
    } catch (e) {
      console.error('[storage] MMKV init failed, using no-op fallback:', e);
      // Fallback to memory storage if MMKV fails
      _storage = {
        getString: () => null,
        set: () => {},
        getBoolean: () => false,
      };
    }
  }
  return _storage;
};


export interface BlockedApp {
  packageName: string;
  appName: string;
  iconBase64: string;
  enabled: boolean;
  blockType: 'timed' | 'permanent';
  blockUntil?: number;
  // Epoch ms before which this block cannot be disabled or removed. Stamped on
  // add so a block can't be undone impulsively.
  disableLockUntil?: number;
}

export const DISABLE_LOCK_MS = 30 * 60 * 1000;

export const stampDisableLock = (app: BlockedApp, durationMs: number = DISABLE_LOCK_MS): BlockedApp => ({
  ...app,
  disableLockUntil: Date.now() + durationMs,
});

// Remaining lock time in ms. 0 once the 30-min window has elapsed (or never set).
export const disableLockRemainingMs = (app: BlockedApp): number =>
  Math.max(0, (app.disableLockUntil ?? 0) - Date.now());

// True while the block is still inside its 30-min un-removable window.
export const isDisableLocked = (app: BlockedApp): boolean =>
  disableLockRemainingMs(app) > 0;

export interface Settings {
  preventionMode: boolean;
  preventionModeOffRequestedAt: number | null;
  preventionModeLockedUntil: number | null;
  onboardingComplete: boolean;
  theme: ThemePreference;
}

// Blocked apps
export const getBlockedApps = (): BlockedApp[] => {
  try {
    const data = getStorage().getString('blockedApps');
    if (!data) return [];
    const parsed = JSON.parse(data);
    // Ensure new fields exist with defaults for backward compatibility
    return parsed.map((app: any) => ({
      ...app,
      blockType: app.blockType || 'permanent',
      blockUntil: app.blockUntil,
    }));
  } catch {
    return [];
  }
};

// The accessibility service reads blocked packages / temp-allow grants from a
// native SharedPreferences bridge, not MMKV. Mirror every write here (the single
// choke point for all callers) so the service never desyncs. Lazy require +
// try/catch so a missing/old native build can't crash storage at import time.
const syncNativeBlockedApps = (apps: BlockedApp[]) => {
  try {
    const { AppBlocker } = require('../../modules/app-blocker/src');
    const now = Date.now();
    const enabledApps = apps.filter((a) => {
      if (!a.enabled) return false;
      // Exclude timed blocks that have expired
      if (a.blockType === 'timed' && a.blockUntil != null && a.blockUntil <= now) {
        return false;
      }
      return true;
    });
    AppBlocker.setBlockedApps(
      enabledApps.map((a) => ({
        packageName: a.packageName,
        // null = permanent. Never pass undefined — Record conversion expects
        // an explicit null for the nullable field.
        blockUntil: a.blockType === 'timed' ? a.blockUntil ?? null : null,
      }))
    );
  } catch (e) {
    // Surfaces both "native module unavailable" (old build) and type
    // conversion failures — a silent catch here once hid a broken mirror.
    console.error('[storage] native blocked-apps sync failed:', e);
  }
};

export const setBlockedApps = (apps: BlockedApp[]) => {
  // Ensure all apps have required fields with defaults
  const normalizedApps = apps.map((app) => ({
    ...app,
    blockType: app.blockType || 'permanent',
  }));
  getStorage().set('blockedApps', JSON.stringify(normalizedApps));
  syncNativeBlockedApps(normalizedApps);
};

export const cleanupExpiredBlocks = () => {
  const apps = getBlockedApps();
  const now = Date.now();
  const filtered = apps.filter((app) => {
    // Keep apps that are not timed, or timed apps that haven't expired
    if (app.blockType === 'permanent') return true;
    if (app.blockType === 'timed' && app.blockUntil != null && app.blockUntil > now) {
      return true;
    }
    return false;
  });

  // Only update if something was removed
  if (filtered.length < apps.length) {
    setBlockedApps(filtered);
  }
};

// Run once at app launch: prunes expired timed blocks, then unconditionally
// rewrites the native mirror (cleanupExpiredBlocks only syncs when something
// was removed). Repairs installs whose mirror was never written or desynced.
// DNS protection is always on natively (the accessibility service blocks the
// Private DNS chooser unconditionally), so there is nothing to sync for it.
export const resyncNativeBlockedApps = () => {
  cleanupExpiredBlocks();
  syncNativeBlockedApps(getBlockedApps());
};

// Settings
export const getSettings = (): Settings => {
  const defaults: Settings = {
    preventionMode: true,
    preventionModeOffRequestedAt: null,
    preventionModeLockedUntil: null,
    onboardingComplete: false,
    theme: 'system',
  };
  try {
    const data = getStorage().getString('settings');
    if (!data) return defaults;
    const { unlockMode: _legacyUnlockMode, ...stored } = JSON.parse(data);
    return { ...defaults, ...stored, theme: migrateThemePreference(stored.theme) };
  } catch {
    return defaults;
  }
};

// Settings change subscription. AppNavigator reads onboardingComplete into
// state once at mount, so without this it never learns when onboarding finishes
// and navigate('Home') fails (Home isn't registered yet) — the app gets stuck on
// the onboarding stack forever. Listeners let the navigator re-read and swap.
type SettingsListener = () => void;
const settingsListeners = new Set<SettingsListener>();

export const subscribeSettings = (listener: SettingsListener): (() => void) => {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
};

export const updateSettings = (updates: Partial<Settings>) => {
  const current = getSettings();
  getStorage().set('settings', JSON.stringify({ ...current, ...updates }));
  settingsListeners.forEach((l) => l());
};

// Prevention Mode: turning it off requires a 12-hour cooldown so it can't be
// disabled impulsively. The flag/timestamp live here; the native module only
// performs the device-admin grant/revoke. See modules/prevention-mode.
export const PREVENTION_DISABLE_DELAY_MS = 12 * 60 * 60 * 1000;

// Remaining cooldown in ms before a pending disable request can be confirmed.
// 0 means either no request is pending or the cooldown has fully elapsed.
export const preventionDisableRemainingMs = (): number => {
  const { preventionModeOffRequestedAt } = getSettings();
  if (preventionModeOffRequestedAt == null) return 0;
  return Math.max(
    0,
    PREVENTION_DISABLE_DELAY_MS - (Date.now() - preventionModeOffRequestedAt)
  );
};

// True only when a disable was requested AND the 12h cooldown has elapsed.
export const isPreventionDisableReady = (): boolean => {
  const { preventionModeOffRequestedAt } = getSettings();
  return (
    preventionModeOffRequestedAt != null &&
    Date.now() - preventionModeOffRequestedAt >= PREVENTION_DISABLE_DELAY_MS
  );
};

export const PREVENTION_LOCK_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const preventionLockRemainingMs = (): number => {
  const { preventionModeLockedUntil } = getSettings();
  if (preventionModeLockedUntil == null) return 0;
  return Math.max(0, preventionModeLockedUntil - Date.now());
};

export const isPreventionLocked = (): boolean => preventionLockRemainingMs() > 0;
