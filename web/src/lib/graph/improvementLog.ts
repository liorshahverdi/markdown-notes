/**
 * Improvement logging for the self-improvement loop.
 */

export interface ImprovementRecord {
  id: string;
  timestamp: number;
  type: 'relationship_added' | 'entity_merged' | 'implicit_extracted' | 'transitive_inferred' | 'entity_corrected';
  description: string;
  affectedIds: string[];
  confidence: number;
  status: 'auto-applied' | 'pending-review' | 'rejected' | 'undone';
  undoData?: unknown;
}

let counter = 0;

export function createImprovement(
  record: Omit<ImprovementRecord, 'id' | 'timestamp'>
): ImprovementRecord {
  counter++;
  return {
    id: `imp_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...record,
  };
}

export function canUndo(record: ImprovementRecord): boolean {
  if (!record.undoData) return false;
  if (record.status === 'rejected') return false;
  if (record.status === 'undone') return false;
  return true;
}
