import { MMKV } from 'react-native-mmkv';

// Use a lazy singleton
let _storage: any = null;
const getStorage = (): any => {
  if (!_storage) {
    try {
      // @ts-ignore
      _storage = new MMKV();
    } catch {
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
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const setBlockedApps = (apps: BlockedApp[]) => {
  getStorage().set('blockedApps', JSON.stringify(apps));
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

export const updateSettings = (updates: Partial<Settings>) => {
  const current = getSettings();
  getStorage().set('settings', JSON.stringify({ ...current, ...updates }));
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
