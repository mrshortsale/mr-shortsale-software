export type InventorySource = 'Batch' | 'County' | 'Zillow' | 'Meta' | 'Manual';
export type InventoryLang = 'EN' | 'ES';
export type InventoryStatus = 'New' | 'Contacted' | 'Promoted' | 'Dismissed';
export type InventoryFilingType = 'NOD' | 'NTS' | 'LP' | 'Short Sale' | 'Inbound' | 'REO' | 'Other';
export type InventoryLeadType = 'Homeowner' | 'Realtor' | 'Inbound';

export type PipelineStage =
  | 'Initial Contact'
  | 'Docs Collected'
  | 'Bank Submitted'
  | 'Pending Approval';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Initial Contact',
  'Docs Collected',
  'Bank Submitted',
  'Pending Approval',
];

export interface InventoryLead {
  id: string;
  source: InventorySource;
  externalId?: string;
  batchListName?: string | null;
  owner: string;
  address: string;
  city: string;
  state: string;
  county: string;
  equityPct: number;
  daysToAuction: number;
  score: number;
  language: InventoryLang;
  receivedAt: number;
  status: InventoryStatus;
  // Extended fields populated by ingest pipeline (Batch)
  apn?: string | null;
  phone?: string | null;
  email?: string | null;
  filingType?: InventoryFilingType | null;
  leadType?: InventoryLeadType;
  ltvPct?: number | null;
  assignedRepId?: string | null;
  contactAttempts?: number;
  lastContactDate?: number | null;
  lastOutcome?: string | null;
  ingestedAt?: number | null;
  pipelineStage?: PipelineStage | null;
}
