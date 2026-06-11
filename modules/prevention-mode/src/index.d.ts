export interface PreventionModeStatus {
  enabled: boolean;
  requestedOffAt: number;
}

export declare const PreventionMode: {
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
  requestDisable(): Promise<boolean>;
  getStatus(): Promise<PreventionModeStatus>;
};
