/**
 * Trace logging for reasoning transparency.
 * Records structured logs of extraction decisions, RAG queries,
 * and self-improvement runs.
 */

import { v4 as uuidv4 } from 'uuid';
import { db, type TraceDBRecord } from '../db/index';
import type { TraceType, TraceRecord, TraceStage, TraceDecision } from '../../types/graph';

export class TraceLogger {
  private id: string;
  private type: TraceType;
  private noteId?: string;
  private startTime: number;
  private stages: TraceStage[] = [];
  private currentStage: {
    name: string;
    startTime: number;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    decisions: TraceDecision[];
  } | null = null;

  constructor(type: TraceType, noteId?: string) {
    this.id = uuidv4();
    this.type = type;
    this.noteId = noteId;
    this.startTime = performance.now();
  }

  beginStage(name: string, inputs: Record<string, unknown> = {}): void {
    // End any open stage first
    if (this.currentStage) {
      this.endStage();
    }
    this.currentStage = {
      name,
      startTime: performance.now(),
      inputs,
      outputs: {},
      decisions: [],
    };
  }

  addDecision(decision: TraceDecision): void {
    if (this.currentStage) {
      this.currentStage.decisions.push(decision);
    }
  }

  endStage(outputs: Record<string, unknown> = {}): void {
    if (!this.currentStage) return;

    this.stages.push({
      name: this.currentStage.name,
      durationMs: performance.now() - this.currentStage.startTime,
      inputs: this.currentStage.inputs,
      outputs: { ...this.currentStage.outputs, ...outputs },
      decisions: this.currentStage.decisions,
    });
    this.currentStage = null;
  }

  async finalize(summary: string): Promise<TraceRecord> {
    // End any open stage
    if (this.currentStage) {
      this.endStage();
    }

    const trace: TraceRecord = {
      id: this.id,
      type: this.type,
      timestamp: Date.now(),
      noteId: this.noteId,
      durationMs: performance.now() - this.startTime,
      stages: this.stages,
      summary,
    };

    // Persist to DB
    try {
      const dbRecord: TraceDBRecord = {
        id: trace.id,
        type: trace.type,
        timestamp: trace.timestamp,
        noteId: trace.noteId,
        data: JSON.stringify(trace),
      };
      await db.traces.put(dbRecord);
    } catch (e) {
      console.warn('[TraceLogger] Failed to persist trace:', e);
    }

    return trace;
  }
}

/**
 * Delete traces older than the specified retention period.
 */
export async function pruneOldTraces(retentionDays: number = 7): Promise<number> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  try {
    const oldTraces = await db.traces
      .where('timestamp')
      .below(cutoff)
      .toArray();
    const ids = oldTraces.map((t) => t.id);
    if (ids.length > 0) {
      await db.traces.bulkDelete(ids);
    }
    return ids.length;
  } catch (e) {
    console.warn('[TraceLogger] Failed to prune traces:', e);
    return 0;
  }
}

/**
 * Load recent traces from the database.
 */
export async function loadRecentTraces(limit: number = 50): Promise<TraceRecord[]> {
  try {
    const records = await db.traces
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();

    return records.map((r) => {
      try {
        return JSON.parse(r.data) as TraceRecord;
      } catch {
        return {
          id: r.id,
          type: r.type as TraceType,
          timestamp: r.timestamp,
          noteId: r.noteId,
          durationMs: 0,
          stages: [],
          summary: 'Failed to parse trace data',
        };
      }
    });
  } catch (e) {
    console.warn('[TraceLogger] Failed to load traces:', e);
    return [];
  }
}
