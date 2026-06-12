import { requireNativeModule } from 'expo-modules-core';

const PreventionModeModule = requireNativeModule('PreventionMode');

export const PreventionMode = {
  // True if the app currently holds active device-admin (uninstall protection).
  async isActive(): Promise<boolean> {
    return PreventionModeModule.isActive();
  },

  // Launches the system device-admin grant screen. Resolves once the intent is
  // fired, NOT once the user grants — confirm the result with isActive() after
  // the app returns to the foreground.
  async enable(): Promise<boolean> {
    return PreventionModeModule.enable();
  },

  // Revokes active device admin immediately. The 12-hour cooldown gating WHEN
  // this may be called lives in JS (see store/storage.ts).
  async disable(): Promise<boolean> {
    return PreventionModeModule.disable();
  },
};
