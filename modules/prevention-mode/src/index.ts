import { requireNativeModule } from 'expo-modules-core';
import type { PreventionModeStatus } from './index.d';

const PreventionModeModule = requireNativeModule('PreventionMode');

export type { PreventionModeStatus };

export const PreventionMode = {
  async enable(): Promise<boolean> {
    return PreventionModeModule.enable();
  },

  async disable(): Promise<boolean> {
    return PreventionModeModule.disable();
  },

  async requestDisable(): Promise<boolean> {
    return PreventionModeModule.requestDisable();
  },

  async getStatus(): Promise<PreventionModeStatus> {
    return PreventionModeModule.getStatus();
  },
};
