export interface MonitorStatus {
  active: boolean; until: number; session?: string; bytes: number; frames: number;
  events: number; rejected: number; reason?: string; archive?: string; saving?: boolean;
}
