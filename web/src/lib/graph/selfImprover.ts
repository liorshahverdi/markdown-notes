/**
 * Self-improvement loop orchestrator.
 * Periodically analyzes the knowledge graph and proposes improvements
 * using purely algorithmic methods + Ollama LLM for implicit extraction.
 */

import { get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { ImprovementRecord } from './improvementLog';
import { createImprovement, dedupeImprovements, improvementDedupeKey } from './improvementLog';
import { graphEntities, graphRelations, addRelation, mergeGraphEntities } from '../stores/graph';
import { notes } from '../stores/notes';
import { db } from '../db/index';
import { findRelationshipCandidates } from './relationshipDiscoverer';
import { findDuplicateCandidates } from './entityDeduplicator';
// Transitive inference is now lazy (on-demand per entity click)
import { buildImplicitExtractionPrompt, parseExtractionResponse, buildEntityValidationPrompt, parseValidationResponse } from './implicitExtractor';
import type { GraphRelation } from '../../types/graph';
import { TraceLogger } from './traceLogger';

export interface SelfImproverConfig {
  intervalMs: number;
  autoApplyThreshold: number;
  enabled: boolean;
  ollamaUrl?: string;
  ollamaModel?: string;
  onImprove?: (records: ImprovementRecord[]) => void;
}

const DEFAULT_CONFIG: SelfImproverConfig = {
  intervalMs: 30 * 60 * 1000, // 30 minutes
  autoApplyThreshold: 0.8,
  enabled: true,
};

export function createSelfImprover(config?: Partial<SelfImproverConfig>): {
  start(): void;
  stop(): void;
  runOnce(): Promise<ImprovementRecord[]>;
  isRunning: boolean;
} {
  const resolvedConfig: SelfImproverConfig = { ...DEFAULT_CONFIG, ...config };
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function runOnce(): Promise<ImprovementRecord[]> {
    const tracer = new TraceLogger('self_improvement');
    const entities = get(graphEntities);
    const relations = get(graphRelations);
    const records: ImprovementRecord[] = [];

    // Load existing improvements to avoid re-proposing
    let existingImprovements: ImprovementRecord[] = [];
    try {
      existingImprovements = await db.improvements.toArray();
    } catch {
      // DB might not be ready
    }
    const existingPairs = new Set(
      existingImprovements
        .filter((r) => Array.isArray(r.affectedIds) && r.affectedIds.length > 0)
        .map((r) => [...r.affectedIds].sort().join('::'))
    );
    const existingImprovementKeys = new Set(
      existingImprovements
        .filter((r) => Array.isArray(r.affectedIds))
        .map((r) => improvementDedupeKey(r))
    );

    // Helper: resolve shared note IDs to titles for descriptions
    const allNotes = get(notes);
    const noteTitleMap = new Map(allNotes.map((n) => [n.id, n.title]));
    function sharedNoteTitles(noteIds: string[]): string {
      return noteIds
        .map((id) => noteTitleMap.get(id) ?? id)
        .slice(0, 3)
        .map((t) => `"${t}"`)
        .join(', ');
    }

    // Helper: find entity by name — exact match first, then substring containment
    function matchEntity(entityList: typeof entities, name: string) {
      const lower = name.toLowerCase();
      return (
        entityList.find((e) => e.name.toLowerCase() === lower) ??
        entityList.find((e) => e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase()))
      ) ?? null;
    }

    // 1. Relationship discovery — entities sharing 2+ notes but no direct relation
    tracer.beginStage('relationship_discovery', { entityCount: entities.length });
    try {
      const relCandidates = findRelationshipCandidates(entities, relations);
      for (const candidate of relCandidates) {
        if (candidate.entityA.name.toLowerCase() === candidate.entityB.name.toLowerCase()) {
          tracer.addDecision({ action: 'rejected', subject: `${candidate.entityA.name} ↔ ${candidate.entityB.name}`, reason: 'Same entity name — self-link not useful' });
          continue;
        }
        if (candidate.sharedNoteIds.length < 2) {
          tracer.addDecision({ action: 'rejected', subject: `${candidate.entityA.name} ↔ ${candidate.entityB.name}`, reason: `Only ${candidate.sharedNoteIds.length} shared note — need at least 2 to establish a link` });
          continue;
        }
        const pairKey = [candidate.entityA.id, candidate.entityB.id].sort().join('::');
        if (existingPairs.has(pairKey)) {
          tracer.addDecision({ action: 'rejected', subject: `${candidate.entityA.name} ↔ ${candidate.entityB.name}`, reason: 'Already proposed or applied in a previous run' });
          continue;
        }
        const confidence = Math.min(candidate.sharedNoteIds.length / 3, 1);
        const relation: GraphRelation = {
          id: uuidv4(),
          fromEntityId: candidate.entityA.id,
          toEntityId: candidate.entityB.id,
          type: 'related_to',
          weight: confidence,
        };
        const status = confidence >= resolvedConfig.autoApplyThreshold ? 'auto-applied' : 'pending-review';
        const noteNames = sharedNoteTitles(candidate.sharedNoteIds);
        tracer.addDecision({
          action: 'accepted',
          subject: `${candidate.entityA.name} → ${candidate.entityB.name}`,
          reason: `Co-occur in ${candidate.sharedNoteIds.length} notes (${noteNames}); confidence ${(confidence * 100).toFixed(0)}% → ${status}`,
          confidence,
        });
        records.push(
          createImprovement({
            type: 'relationship_added',
            description: `Link "${candidate.entityA.name}" (${candidate.entityA.type}) → "${candidate.entityB.name}" (${candidate.entityB.type}) — co-occur in ${noteNames}`,
            affectedIds: [candidate.entityA.id, candidate.entityB.id],
            confidence,
            status,
            undoData: { relation },
          })
        );
      }
    } catch (e) {
      console.warn('[SelfImprover] relationship discovery failed:', e);
    }
    tracer.endStage({ candidatesFound: records.filter((r) => r.type === 'relationship_added').length });

    // 2. Entity deduplication — similar names across different entities
    tracer.beginStage('deduplication', { entityCount: entities.length });
    try {
      const dupCandidates = findDuplicateCandidates(entities);
      for (const candidate of dupCandidates) {
        if (candidate.similarity < 0.7) {
          tracer.addDecision({ action: 'rejected', subject: `${candidate.entityA.name} ≈ ${candidate.entityB.name}`, reason: `Similarity ${(candidate.similarity * 100).toFixed(0)}% below 70% threshold`, confidence: candidate.similarity });
          continue;
        }
        if (candidate.entityA.type === candidate.entityB.type &&
            candidate.entityA.name.toLowerCase() === candidate.entityB.name.toLowerCase()) {
          tracer.addDecision({ action: 'rejected', subject: `${candidate.entityA.name} ≈ ${candidate.entityB.name}`, reason: 'Exact same name and type — already deduplicated' });
          continue;
        }
        const pairKey = [candidate.entityA.id, candidate.entityB.id].sort().join('::');
        if (existingPairs.has(pairKey)) {
          tracer.addDecision({ action: 'rejected', subject: `${candidate.entityA.name} ≈ ${candidate.entityB.name}`, reason: 'Already proposed or applied in a previous run' });
          continue;
        }
        const mergeStatus = candidate.similarity >= resolvedConfig.autoApplyThreshold ? 'auto-applied' : 'pending-review';
        tracer.addDecision({
          action: 'accepted',
          subject: `Merge ${candidate.entityA.name} ← ${candidate.entityB.name}`,
          reason: `${candidate.reason}; similarity ${(candidate.similarity * 100).toFixed(0)}% → ${mergeStatus}`,
          confidence: candidate.similarity,
        });
        records.push(
          createImprovement({
            type: 'entity_merged',
            description: `Merge "${candidate.entityA.name}" (${candidate.entityA.type}) with "${candidate.entityB.name}" (${candidate.entityB.type}) — ${candidate.reason}`,
            affectedIds: [candidate.entityA.id, candidate.entityB.id],
            confidence: candidate.similarity,
            status: mergeStatus,
            undoData: {
              keepId: candidate.entityA.id,
              removeId: candidate.entityB.id,
              keepEntity: { ...candidate.entityA },
              removeEntity: { ...candidate.entityB },
              originalRelations: [...relations],
            },
          })
        );
      }
    } catch (e) {
      console.warn('[SelfImprover] dedup discovery failed:', e);
    }
    tracer.endStage({ mergeCandidates: records.filter((r) => r.type === 'entity_merged').length });

    // 3. Transitive inference — removed from eager loop (now lazy, on-demand per entity)

    // 4. Entity validation via Ollama (when URL configured)
    tracer.beginStage('entity_validation', { ollamaConfigured: !!resolvedConfig.ollamaUrl });
    if (resolvedConfig.ollamaUrl) {
      try {
        const { queryOllamaJSON } = await import('../llm/ollama');
        // Find notes not yet analyzed for entity validation
        const validatedNoteIds = new Set(
          existingImprovements
            .filter((r) => r.type === 'entity_corrected')
            .flatMap((r) => r.affectedIds)
        );
        const unvalidatedNotes = allNotes.filter((n) => !validatedNoteIds.has(n.id)).slice(0, 3);

        for (const note of unvalidatedNotes) {
          try {
            const noteEntities = entities.filter((e) => e.sourceNoteIds.includes(note.id));
            if (noteEntities.length === 0) continue;

            const prompt = buildEntityValidationPrompt(
              noteEntities.map((e) => ({ name: e.name, type: e.type, subtype: e.subtype })),
              note.content
            );
            const result = await queryOllamaJSON(prompt, {
              ollamaUrl: resolvedConfig.ollamaUrl!,
              ollamaModel: resolvedConfig.ollamaModel ?? 'qwen2.5:3b',
            });
            if (!result) {
              tracer.addDecision({ action: 'rejected', subject: `Validate entities in "${note.title}"`, reason: 'LLM returned no response — model may be unavailable' });
              continue;
            }

            const validation = parseValidationResponse(result);
            for (const correction of validation.corrections) {
              const entity = noteEntities.find((e) => e.name.toLowerCase() === correction.name.toLowerCase());
              if (!entity) continue;

              tracer.addDecision({
                action: 'modified',
                subject: `${entity.name}: ${correction.currentType} → ${correction.suggestedType}`,
                reason: `LLM reviewed "${entity.name}" against note "${note.title}" and suggests reclassifying: ${correction.reason}`,
                confidence: 0.7,
              });
              records.push(
                createImprovement({
                  type: 'entity_corrected',
                  description: `Correct "${entity.name}" type: ${correction.currentType} → ${correction.suggestedType}${correction.suggestedSubtype ? ` (${correction.suggestedSubtype})` : ''} — ${correction.reason}`,
                  affectedIds: [entity.id, note.id],
                  confidence: 0.7,
                  status: 'pending-review',
                  undoData: {
                    entityId: entity.id,
                    oldType: entity.type,
                    oldSubtype: entity.subtype,
                    newType: correction.suggestedType,
                    newSubtype: correction.suggestedSubtype,
                  },
                })
              );
            }
          } catch (e) {
            console.warn('[SelfImprover] entity validation failed for note:', note.title, e);
          }
        }
      } catch (e) {
        console.warn('[SelfImprover] Ollama entity validation failed:', e);
      }
    } else {
      tracer.addDecision({ action: 'rejected', subject: 'Entity validation', reason: 'Ollama URL not configured — skipping LLM validation' });
    }
    tracer.endStage({ corrections: records.filter((r) => r.type === 'entity_corrected').length });

    // 5. Implicit extraction via Ollama (when URL configured)
    tracer.beginStage('implicit_extraction', { ollamaConfigured: !!resolvedConfig.ollamaUrl });
    if (resolvedConfig.ollamaUrl) {
      try {
        const { queryOllamaJSON } = await import('../llm/ollama');
        // Find notes not yet analyzed for implicit extraction
        const analyzedNoteIds = new Set(
          existingImprovements
            .filter((r) => r.type === 'implicit_extracted')
            .flatMap((r) => r.affectedIds)
        );
        const unanalyzedNotes = allNotes.filter((n) => !analyzedNoteIds.has(n.id)).slice(0, 5);

        for (const note of unanalyzedNotes) {
          try {
            const knownNames = entities.map((e) => e.name);
            const prompt = buildImplicitExtractionPrompt(note.title, note.content, knownNames);
            const result = await queryOllamaJSON<unknown[]>(prompt, {
              ollamaUrl: resolvedConfig.ollamaUrl!,
              ollamaModel: resolvedConfig.ollamaModel ?? 'qwen2.5:3b',
            });
            if (!result) {
              tracer.addDecision({ action: 'rejected', subject: `Analyze "${note.title}"`, reason: 'LLM returned no response — model may be unavailable' });
              continue;
            }

            // queryOllamaJSON returns parsed JSON, but we need to pass through parseExtractionResponse
            // for validation. Stringify and re-parse to reuse existing validation.
            const extracted = parseExtractionResponse(JSON.stringify(result));

            for (const rel of extracted) {
              const fromEntity = matchEntity(entities, rel.fromEntity);
              const toEntity = matchEntity(entities, rel.toEntity);
              if (!fromEntity || !toEntity) {
                tracer.addDecision({ action: 'rejected', subject: `${rel.fromEntity} → ${rel.toEntity}`, reason: `LLM suggested "${rel.type}" link but one or both entities not found in graph` });
                continue;
              }
              if (fromEntity.id === toEntity.id) continue;

              const pairKey = [fromEntity.id, toEntity.id].sort().join('::');
              if (existingPairs.has(pairKey)) {
                tracer.addDecision({ action: 'rejected', subject: `${fromEntity.name} → ${toEntity.name}`, reason: 'Link already exists or was previously proposed' });
                continue;
              }
              existingPairs.add(pairKey);

              const relation: GraphRelation = {
                id: uuidv4(),
                fromEntityId: fromEntity.id,
                toEntityId: toEntity.id,
                type: 'related_to',
                weight: rel.confidence,
                metadata: { implicitType: rel.type },
              };
              const implicitStatus = rel.confidence >= resolvedConfig.autoApplyThreshold ? 'auto-applied' : 'pending-review';
              tracer.addDecision({
                action: 'accepted',
                subject: `${fromEntity.name} —[${rel.type}]→ ${toEntity.name}`,
                reason: `LLM inferred implicit "${rel.type}" relationship from note "${note.title}"; confidence ${(rel.confidence * 100).toFixed(0)}% → ${implicitStatus}`,
                confidence: rel.confidence,
              });
              records.push(
                createImprovement({
                  type: 'implicit_extracted',
                  description: `Implicit "${rel.type}" link: "${fromEntity.name}" → "${toEntity.name}" (from "${note.title}")`,
                  affectedIds: [fromEntity.id, toEntity.id, note.id],
                  confidence: rel.confidence,
                  status: implicitStatus,
                  undoData: { relation },
                })
              );
            }
          } catch (e) {
            console.warn('[SelfImprover] Ollama extraction failed for note:', note.title, e);
          }
        }
      } catch (e) {
        console.warn('[SelfImprover] Ollama import/init failed:', e);
      }
    } else {
      tracer.addDecision({ action: 'rejected', subject: 'Implicit extraction', reason: 'Ollama URL not configured — skipping LLM extraction' });
    }
    tracer.endStage({ implicitLinks: records.filter((r) => r.type === 'implicit_extracted').length });

    // 6. Auto-apply only records above threshold; persist all (including pending-review)
    const uniqueNewRecords = dedupeImprovements(records).filter(
      (record) => !existingImprovementKeys.has(improvementDedupeKey(record))
    );
    const applied: ImprovementRecord[] = [];
    for (const record of uniqueNewRecords) {
      if (record.status === 'auto-applied') {
        try {
          if (record.type === 'relationship_added' || record.type === 'transitive_inferred' || record.type === 'implicit_extracted') {
            const undoData = record.undoData as { relation: GraphRelation };
            await addRelation(undoData.relation);
          } else if (record.type === 'entity_merged') {
            const undoData = record.undoData as { keepId: string; removeId: string };
            await mergeGraphEntities(undoData.keepId, undoData.removeId);
          }
        } catch {
          // Auto-apply failed — drop silently
          continue;
        }
      }
      applied.push(record);
    }

    // 7. Persist to DB (both auto-applied and pending-review)
    if (applied.length > 0) {
      try {
        await db.improvements.bulkPut(applied);
      } catch (e) {
        console.warn('[SelfImprover] failed to persist improvements:', e);
      }
    }

    // 8. Finalize trace
    tracer.finalize(`Self-improvement: ${applied.length} proposals (${applied.filter((r) => r.status === 'auto-applied').length} auto-applied)`).catch(() => {});

    // 9. Notify callback
    resolvedConfig.onImprove?.(applied);

    return applied;
  }

  function start(): void {
    if (!resolvedConfig.enabled) return;
    if (running) return;

    running = true;
    intervalId = setInterval(() => {
      runOnce();
    }, resolvedConfig.intervalMs);
  }

  function stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    running = false;
  }

  return {
    start,
    stop,
    runOnce,
    get isRunning() {
      return running;
    },
  };
}
