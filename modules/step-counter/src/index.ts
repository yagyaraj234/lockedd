import { requireNativeModule } from 'expo-modules-core';

const StepCounterModule = requireNativeModule('StepCounter');

export const StepCounter = {
  startListening(): void {
    StepCounterModule.startListening();
  },

  stopListening(): void {
    StepCounterModule.stopListening();
  },

  async getTodaySteps(): Promise<number> {
    return StepCounterModule.getTodaySteps();
  },

  async getStepGoal(): Promise<number> {
    return StepCounterModule.getStepGoal();
  },

  async setStepGoal(goal: number): Promise<boolean> {
    return StepCounterModule.setStepGoal(goal);
  },
};
