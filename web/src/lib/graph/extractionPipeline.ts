/**
 * Multi-stage extraction pipeline orchestrator.
 * Coordinates regex extraction and NER extraction with timing metadata.
 */

import { extractEntities, extractNEREntities, type ExtractedEntity, type ExtractedRelation } from './entityExtractor';
import { TraceLogger } from './traceLogger';

export interface PipelineConfig {
  enableRegex: boolean;
  enableNER: boolean;
  ollamaUrl?: string;
  ollamaModel?: string;
}

export interface StageResult {
  name: string;
  durationMs: number;
  entityCount: number;
  relationCount: number;
}

export interface PipelineResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  stages: StageResult[];
}

const DEFAULT_CONFIG: PipelineConfig = {
  enableRegex: true,
  enableNER: true,
};

/**
 * Run the multi-stage extraction pipeline on a note.
 * Stage 1 (regex): always runs on every save
 * Stage 2 (NER): always runs on every save
 * Stages 3-4 (LLM refinement) are handled separately by the self-improver.
 */
export async function runExtractionPipeline(
  noteId: string,
  title: string,
  content: string,
  folderPath?: string[],
  config?: Partial<PipelineConfig>
): Promise<PipelineResult> {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  const allEntities: ExtractedEntity[] = [];
  const allRelations: ExtractedRelation[] = [];
  const stages: StageResult[] = [];
  const tracer = new TraceLogger('extraction', noteId);

  // Stage 1: Regex extraction
  if (resolvedConfig.enableRegex) {
    tracer.beginStage('regex', { title, contentLength: content.length });
    const start = performance.now();
    const { entities, relations } = extractEntities(noteId, title, content, folderPath);
    const durationMs = performance.now() - start;

    allEntities.push(...entities);
    allRelations.push(...relations);
    stages.push({
      name: 'regex',
      durationMs,
      entityCount: entities.length,
      relationCount: relations.length,
    });

    for (const e of entities) {
      tracer.addDecision({
        action: 'accepted',
        subject: `${e.type}: ${e.name}`,
        reason: `Matched ${e.type.toLowerCase()} pattern in ${e.name === title ? 'note title' : 'note body'}; appears in text with confidence ${(e.confidence * 100).toFixed(0)}%`,
        confidence: e.confidence,
      });
    }
    tracer.endStage({ entityCount: entities.length, relationCount: relations.length });
  }

  // Stage 2: NER extraction
  if (resolvedConfig.enableNER) {
    tracer.beginStage('ner', { contentLength: content.length });
    const start = performance.now();
    try {
      const { entities: nerEntities, relations: nerRelations } =
        await extractNEREntities(title, content);
      const durationMs = performance.now() - start;

      // Merge NER entities, avoiding duplicates
      let accepted = 0;
      let rejected = 0;
      for (const ne of nerEntities) {
        if (!allEntities.some((e) => e.type === ne.type && e.name.toLowerCase() === ne.name.toLowerCase())) {
          allEntities.push(ne);
          accepted++;
          tracer.addDecision({
            action: 'accepted',
            subject: `${ne.type}: ${ne.name}`,
            reason: `NER model identified "${ne.name}" as ${ne.type} (not already known from regex stage)`,
            confidence: ne.confidence,
          });
        } else {
          rejected++;
          tracer.addDecision({
            action: 'rejected',
            subject: `${ne.type}: ${ne.name}`,
            reason: `Already extracted by regex stage — skipping duplicate`,
            confidence: ne.confidence,
          });
        }
      }
      for (const nr of nerRelations) {
        if (!allRelations.some((r) => r.fromName === nr.fromName && r.toName === nr.toName)) {
          allRelations.push(nr);
        }
      }

      stages.push({
        name: 'ner',
        durationMs,
        entityCount: nerEntities.length,
        relationCount: nerRelations.length,
      });
      tracer.endStage({ entityCount: accepted, rejected, relationCount: nerRelations.length });
    } catch {
      stages.push({
        name: 'ner',
        durationMs: performance.now() - start,
        entityCount: 0,
        relationCount: 0,
      });
      tracer.endStage({ error: 'NER pipeline not available' });
    }
  }

  // Finalize trace (non-blocking)
  tracer.finalize(`Extracted ${allEntities.length} entities, ${allRelations.length} relations from "${title}"`).catch(() => {});

  return { entities: allEntities, relations: allRelations, stages };
}
