// react-native-mmkv 4.x (Nitro) no longer exports a constructable `MMKV` class —
// `MMKV` is a type-only export, so `new MMKV()` throws "undefined cannot be used
// as a constructor". The v4 API creates instances via createMMKV().
import { createMMKV } from 'react-native-mmkv';

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
}

export interface Settings {
  unlockMode: 'temporary' | 'physical';
  stepGoal: number;
  preventionMode: boolean;
  preventionModeOffRequestedAt: number | null;
  onboardingComplete: boolean;
}

export interface TemporaryAllow {
  packageName: string;
  allowedUntil: number;
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
        blockUntil: a.blockType === 'timed' ? a.blockUntil : null,
      }))
    );
  } catch {
    // Native module unavailable (not yet rebuilt) — ignore.
  }
};

const syncNativeTemporaryAllow = (packageName: string, allowedUntil: number) => {
  try {
    const { AppBlocker } = require('../../modules/app-blocker/src');
    AppBlocker.setTemporaryAllow(packageName, allowedUntil);
  } catch {
    // Native module unavailable (not yet rebuilt) — ignore.
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

// Settings
export const getSettings = (): Settings => {
  try {
    const data = getStorage().getString('settings');
    return data
      ? JSON.parse(data)
      : {
          unlockMode: 'temporary',
          stepGoal: 10000,
          preventionMode: true,
          preventionModeOffRequestedAt: null,
          onboardingComplete: false,
        };
  } catch {
    return {
      unlockMode: 'temporary',
      stepGoal: 10000,
      preventionMode: true,
      preventionModeOffRequestedAt: null,
      onboardingComplete: false,
    };
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

// Temporary allow list
export const getTemporaryAllowList = (): TemporaryAllow[] => {
  try {
    const data = getStorage().getString('temporaryAllowList');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addTemporaryAllow = (packageName: string, durationMs: number) => {
  const list = getTemporaryAllowList();
  const allowedUntil = Date.now() + durationMs;
  const existing = list.find((a) => a.packageName === packageName);
  if (existing) {
    existing.allowedUntil = allowedUntil;
  } else {
    list.push({ packageName, allowedUntil });
  }
  getStorage().set('temporaryAllowList', JSON.stringify(list));
  syncNativeTemporaryAllow(packageName, allowedUntil);
};

export const isTemporarilyAllowed = (packageName: string): boolean => {
  const list = getTemporaryAllowList();
  const allow = list.find((a) => a.packageName === packageName);
  if (!allow) return false;
  const isAllowed = Date.now() < allow.allowedUntil;
  if (!isAllowed) {
    const updated = list.filter((a) => a.packageName !== packageName);
    getStorage().set('temporaryAllowList', JSON.stringify(updated));
  }
  return isAllowed;
};

// Step data
export const getTodaySteps = (): number => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = getStorage().getString('stepData');
    if (!data) return 0;
    const parsed = JSON.parse(data);
    return parsed.date === today ? parsed.steps : 0;
  } catch {
    return 0;
  }
};

export const setTodaySteps = (steps: number) => {
  const today = new Date().toISOString().split('T')[0];
  getStorage().set('stepData', JSON.stringify({ date: today, steps }));
};
