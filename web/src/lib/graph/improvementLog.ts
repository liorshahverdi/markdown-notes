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

function relationEndpointKey(record: ImprovementRecord): string | null {
  const relation = (record.undoData as { relation?: { fromEntityId?: string; toEntityId?: string } } | undefined)?.relation;
  if (!relation?.fromEntityId || !relation?.toEntityId) return null;
  return [relation.fromEntityId, relation.toEntityId].sort().join('::');
}

export function improvementDedupeKey(record: ImprovementRecord): string {
  const relationPair = relationEndpointKey(record);
  if (relationPair && (
    record.type === 'relationship_added' ||
    record.type === 'implicit_extracted' ||
    record.type === 'transitive_inferred'
  )) {
    return `${record.type}:${relationPair}`;
  }

  return `${record.type}:${[...record.affectedIds].sort().join('::')}:${record.description.toLowerCase().trim()}`;
}

export function dedupeImprovements(records: ImprovementRecord[]): ImprovementRecord[] {
  const byKey = new Map<string, ImprovementRecord>();
  for (const record of records) {
    const key = improvementDedupeKey(record);
    const existing = byKey.get(key);
    if (!existing || record.timestamp >= existing.timestamp) {
      byKey.set(key, record);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function canUndo(record: ImprovementRecord): boolean {
  if (!record.undoData) return false;
  if (record.status === 'rejected') return false;
  if (record.status === 'undone') return false;
  return true;
}
