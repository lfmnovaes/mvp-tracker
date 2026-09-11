export const EXCHANGE_LIMIT = 512000;
export type ExportFormat = "text" | "json" | "compressed";
export interface ImportSummary { total: number; added: number; refreshed: number; ignored: number; conflicted: number; disabled: number; expired: number }
