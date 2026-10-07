export interface MonitorStatus {
  active: boolean; until: number; session?: string; bytes: number; frames: number;
  events: number; rejected: number; reason?: string; maintenance?: "optimize" | "clear"; message?: string;
}
