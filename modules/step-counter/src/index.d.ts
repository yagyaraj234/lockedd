export declare const StepCounter: {
  startListening(): void;
  stopListening(): void;
  getTodaySteps(): Promise<number>;
  getStepGoal(): Promise<number>;
  setStepGoal(goal: number): Promise<boolean>;
};
