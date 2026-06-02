export type VaultPath = string;

export interface RawSourceRecord {
  id: string;
  title: string;
  slug: string;
  sourceType:
    | 'article'
    | 'paper'
    | 'book-chapter'
    | 'note'
    | 'transcript'
    | 'image-set'
    | 'pdf'
    | 'web-clip'
    | 'manual';
  rawPath: VaultPath;
  assetPaths: VaultPath[];
  importedAt: number;
  sourceDate?: number | null;
  checksum?: string | null;
  mimeType?: string | null;
  status: 'queued' | 'ingested' | 'failed';
  summaryPageId?: string | null;
  tags?: string[];
}

export type WikiPageType =
  | 'source-summary'
  | 'entity'
  | 'concept'
  | 'topic'
  | 'comparison'
  | 'timeline'
  | 'question'
  | 'synthesis'
  | 'index'
  | 'log';

export interface WikiPageRecord {
  id: string;
  title: string;
  slug: string;
  pageType: WikiPageType;
  wikiPath: VaultPath;
  summary: string;
  backlinks: string[];
  sourceIds: string[];
  entityKeys: string[];
  lastUpdatedAt: number;
  lastUpdatedReason: 'ingest' | 'query-filed' | 'lint' | 'manual-review';
  confidence?: 'low' | 'medium' | 'high';
  openQuestions?: string[];
}

export interface WikiMutationRecord {
  id: string;
  runId: string;
  timestamp: number;
  triggerType: 'ingest' | 'query' | 'lint';
  sourceIds: string[];
  changedPageIds: string[];
  createdPageIds: string[];
  notes: string;
}
