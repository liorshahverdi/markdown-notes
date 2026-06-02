import { describe, it, expect, beforeEach } from 'vitest';
import { TraceLogger, pruneOldTraces, loadRecentTraces } from './traceLogger';
import { db } from '../db/index';

describe('traceLogger', () => {
  beforeEach(async () => {
    await db.traces.clear();
  });

  describe('TraceLogger', () => {
    it('creates a trace with stages', async () => {
      const logger = new TraceLogger('extraction', 'note-1');
      logger.beginStage('regex', { contentLength: 100 });
      logger.addDecision({
        action: 'accepted',
        subject: 'Person: John',
        reason: 'NER extraction',
        confidence: 0.9,
      });
      logger.endStage({ entityCount: 5 });

      logger.beginStage('ner', { contentLength: 100 });
      logger.endStage({ entityCount: 2 });

      const trace = await logger.finalize('Extracted 7 entities');

      expect(trace.id).toBeTruthy();
      expect(trace.type).toBe('extraction');
      expect(trace.noteId).toBe('note-1');
      expect(trace.durationMs).toBeGreaterThanOrEqual(0);
      expect(trace.stages).toHaveLength(2);
      expect(trace.stages[0].name).toBe('regex');
      expect(trace.stages[0].decisions).toHaveLength(1);
      expect(trace.stages[0].decisions[0].action).toBe('accepted');
      expect(trace.stages[1].name).toBe('ner');
      expect(trace.summary).toBe('Extracted 7 entities');
    });

    it('persists trace to database', async () => {
      const logger = new TraceLogger('query');
      logger.beginStage('vector_search', { query: 'test' });
      logger.endStage({ resultCount: 3 });
      await logger.finalize('Query completed');

      const records = await db.traces.toArray();
      expect(records.length).toBe(1);
      expect(records[0].type).toBe('query');
    });

    it('auto-closes open stage on finalize', async () => {
      const logger = new TraceLogger('extraction');
      logger.beginStage('regex');
      // Don't call endStage — finalize should close it

      const trace = await logger.finalize('Auto-closed');
      expect(trace.stages).toHaveLength(1);
      expect(trace.stages[0].name).toBe('regex');
    });

    it('handles multiple decisions per stage', async () => {
      const logger = new TraceLogger('extraction');
      logger.beginStage('ner');
      logger.addDecision({ action: 'accepted', subject: 'A', reason: 'good' });
      logger.addDecision({ action: 'rejected', subject: 'B', reason: 'low confidence' });
      logger.addDecision({ action: 'modified', subject: 'C', reason: 'type correction' });
      logger.endStage();

      const trace = await logger.finalize('Done');
      expect(trace.stages[0].decisions).toHaveLength(3);
    });
  });

  describe('pruneOldTraces', () => {
    it('deletes traces older than retention period', async () => {
      // Insert an old trace
      await db.traces.put({
        id: 'old-trace',
        type: 'extraction',
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        data: JSON.stringify({ id: 'old-trace', type: 'extraction', timestamp: 0, durationMs: 0, stages: [], summary: 'old' }),
      });
      // Insert a recent trace
      await db.traces.put({
        id: 'new-trace',
        type: 'query',
        timestamp: Date.now(),
        data: JSON.stringify({ id: 'new-trace', type: 'query', timestamp: Date.now(), durationMs: 0, stages: [], summary: 'new' }),
      });

      const pruned = await pruneOldTraces(7);
      expect(pruned).toBe(1);

      const remaining = await db.traces.toArray();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('new-trace');
    });

    it('returns 0 when no old traces exist', async () => {
      const pruned = await pruneOldTraces(7);
      expect(pruned).toBe(0);
    });
  });

  describe('loadRecentTraces', () => {
    it('loads traces in reverse chronological order', async () => {
      for (let i = 0; i < 3; i++) {
        const logger = new TraceLogger('extraction');
        logger.beginStage('regex');
        logger.endStage();
        await logger.finalize(`Trace ${i}`);
        // Small delay to ensure different timestamps
        await new Promise((r) => setTimeout(r, 10));
      }

      const loaded = await loadRecentTraces(10);
      expect(loaded.length).toBe(3);
      // Most recent first
      expect(loaded[0].timestamp).toBeGreaterThanOrEqual(loaded[1].timestamp);
      expect(loaded[1].timestamp).toBeGreaterThanOrEqual(loaded[2].timestamp);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        const logger = new TraceLogger('extraction');
        await logger.finalize(`Trace ${i}`);
      }

      const loaded = await loadRecentTraces(2);
      expect(loaded.length).toBe(2);
    });

    it('returns empty array when no traces exist', async () => {
      const loaded = await loadRecentTraces();
      expect(loaded).toEqual([]);
    });
  });
});
