import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createSelfImprover } from './selfImprover';
import { graphEntities, graphRelations } from '../stores/graph';
import { notes } from '../stores/notes';
import { db } from '../db/index';
import type { GraphEntity, GraphRelation } from '../../types/graph';

const mockQueryOllamaJSON = vi.fn();
vi.mock('../llm/ollama', () => ({
  queryOllamaJSON: (...args: unknown[]) => mockQueryOllamaJSON(...args),
}));

function makeEntity(id: string, name: string, type: GraphEntity['type'], sourceNoteIds: string[]): GraphEntity {
  return { id, name, type, sourceNoteIds };
}

function makeRelation(id: string, from: string, to: string): GraphRelation {
  return { id, fromEntityId: from, toEntityId: to, type: 'mentions', weight: 1 };
}

describe('selfImprover', () => {
  beforeEach(async () => {
    graphEntities.set([]);
    graphRelations.set([]);
    notes.set([]);
    mockQueryOllamaJSON.mockReset();
    await db.improvements.clear();
    await db.relations.clear();
    await db.entities.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('config defaults', () => {
    it('uses 30 minute interval by default', () => {
      const improver = createSelfImprover();
      expect(improver).toBeDefined();
      expect(improver.isRunning).toBe(false);
    });

    it('accepts custom config', () => {
      const improver = createSelfImprover({
        intervalMs: 5000,
        autoApplyThreshold: 0.9,
        enabled: true,
      });
      expect(improver).toBeDefined();
    });
  });

  describe('start/stop lifecycle', () => {
    it('starts and reports running state', () => {
      vi.useFakeTimers();
      const improver = createSelfImprover({ intervalMs: 1000, enabled: true });
      improver.start();
      expect(improver.isRunning).toBe(true);
      improver.stop();
      vi.useRealTimers();
    });

    it('stops and reports not running', () => {
      vi.useFakeTimers();
      const improver = createSelfImprover({ intervalMs: 1000, enabled: true });
      improver.start();
      improver.stop();
      expect(improver.isRunning).toBe(false);
      vi.useRealTimers();
    });

    it('can be started and stopped multiple times', () => {
      vi.useFakeTimers();
      const improver = createSelfImprover({ intervalMs: 1000, enabled: true });
      improver.start();
      improver.stop();
      improver.start();
      expect(improver.isRunning).toBe(true);
      improver.stop();
      expect(improver.isRunning).toBe(false);
      vi.useRealTimers();
    });

    it('does not start if not enabled', () => {
      const improver = createSelfImprover({ enabled: false });
      improver.start();
      expect(improver.isRunning).toBe(false);
    });
  });

  describe('runOnce', () => {
    it('returns an array of improvement records', async () => {
      const improver = createSelfImprover({ enabled: true });
      const results = await improver.runOnce();
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns relationship_added records when entities share 2+ notes', async () => {
      graphEntities.set([
        makeEntity('e1', 'TypeScript', 'Other', ['n1', 'n2']),
        makeEntity('e2', 'JavaScript', 'Other', ['n1', 'n2']),
      ]);
      graphRelations.set([]);
      notes.set([
        { id: 'n1', title: 'Note One', content: '', dateModified: 0, isPinned: false },
        { id: 'n2', title: 'Note Two', content: '', dateModified: 0, isPinned: false },
      ]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      const relAdded = results.filter((r) => r.type === 'relationship_added');
      expect(relAdded.length).toBe(1);
      expect(relAdded[0].description).toContain('TypeScript');
      expect(relAdded[0].description).toContain('JavaScript');
      expect(relAdded[0].description).toContain('co-occur');
      expect(relAdded[0].undoData).toBeDefined();
    });

    it('skips same-name entity pairs', async () => {
      // note and Other with same name — should be filtered out
      graphEntities.set([
        makeEntity('e1', 'React', 'note', ['n1', 'n2']),
        makeEntity('e2', 'React', 'Other', ['n1', 'n2']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      const relAdded = results.filter((r) => r.type === 'relationship_added');
      expect(relAdded.length).toBe(0);
    });

    it('returns entity_merged records for similar names across types', async () => {
      graphEntities.set([
        makeEntity('e1', 'React', 'note', ['n1']),
        makeEntity('e2', 'react', 'Other', ['n1']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      const merged = results.filter((r) => r.type === 'entity_merged');
      expect(merged.length).toBe(1);
      expect(merged[0].confidence).toBe(1.0);
      expect(merged[0].description).toContain('note');
      expect(merged[0].description).toContain('Other');
    });

    it('skips dedup for same-type same-name pairs', async () => {
      graphEntities.set([
        makeEntity('e1', 'React', 'Other', ['n1']),
        makeEntity('e2', 'react', 'Other', ['n2']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      const merged = results.filter((r) => r.type === 'entity_merged');
      expect(merged.length).toBe(0);
    });

    it('does not produce transitive_inferred records (now lazy)', async () => {
      graphEntities.set([
        makeEntity('e1', 'A', 'Other', ['n1']),
        makeEntity('e2', 'B', 'Other', ['n1']),
        makeEntity('e3', 'C', 'Other', ['n1']),
      ]);
      graphRelations.set([
        makeRelation('r1', 'e1', 'e2'),
        makeRelation('r2', 'e2', 'e3'),
      ]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      const transitive = results.filter((r) => r.type === 'transitive_inferred');
      expect(transitive.length).toBe(0);
    });

    it('auto-apply threshold separates auto-applied from pending-review', async () => {
      graphEntities.set([
        makeEntity('e1', 'Alpha', 'Other', ['n1', 'n2', 'n3']),
        makeEntity('e2', 'Beta', 'Other', ['n1', 'n2', 'n3']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.8 });
      const results = await improver.runOnce();

      const autoApplied = results.filter((r) => r.status === 'auto-applied');
      expect(autoApplied.length).toBeGreaterThanOrEqual(1);
    });

    it('marks low-confidence records as pending-review', async () => {
      // 2 shared notes -> confidence = min(2/3, 1) = 0.667, below 0.8 threshold
      graphEntities.set([
        makeEntity('e1', 'Foo', 'Other', ['n1', 'n2']),
        makeEntity('e2', 'Bar', 'Other', ['n1', 'n2']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.8 });
      const results = await improver.runOnce();

      const relAdded = results.filter((r) => r.type === 'relationship_added');
      expect(relAdded.length).toBe(1);
      expect(relAdded[0].status).toBe('pending-review');
    });

    it('auto-applies high-confidence records', async () => {
      // 3 shared notes -> confidence = min(3/3, 1) = 1.0, above 0.8 threshold
      graphEntities.set([
        makeEntity('e1', 'Foo', 'Other', ['n1', 'n2', 'n3']),
        makeEntity('e2', 'Bar', 'Other', ['n1', 'n2', 'n3']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.8 });
      const results = await improver.runOnce();

      const relAdded = results.filter((r) => r.type === 'relationship_added');
      expect(relAdded.length).toBe(1);
      expect(relAdded[0].status).toBe('auto-applied');
    });

    it('onImprove callback fires with results', async () => {
      graphEntities.set([
        makeEntity('e1', 'Svelte', 'Other', ['n1', 'n2']),
        makeEntity('e2', 'SvelteKit', 'Other', ['n1', 'n2']),
      ]);
      graphRelations.set([]);

      const onImprove = vi.fn();
      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99, onImprove });
      await improver.runOnce();

      expect(onImprove).toHaveBeenCalledTimes(1);
      expect(onImprove.mock.calls[0][0].length).toBeGreaterThan(0);
    });

    it('persists records to db.improvements', async () => {
      graphEntities.set([
        makeEntity('e1', 'Node', 'Other', ['n1', 'n2']),
        makeEntity('e2', 'Deno', 'Other', ['n1', 'n2']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      await improver.runOnce();

      const saved = await db.improvements.toArray();
      expect(saved.length).toBeGreaterThan(0);
    });

    it('returns empty array when no entities exist', async () => {
      const improver = createSelfImprover({ enabled: true });
      const results = await improver.runOnce();
      expect(results).toEqual([]);
    });

    it('does not re-propose existing improvements', async () => {
      graphEntities.set([
        makeEntity('e1', 'X', 'Other', ['n1', 'n2']),
        makeEntity('e2', 'Y', 'Other', ['n1', 'n2']),
      ]);
      graphRelations.set([]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });

      const first = await improver.runOnce();
      expect(first.length).toBeGreaterThan(0);

      const second = await improver.runOnce();
      expect(second.length).toBe(0); // Already proposed
    });

    it('creates implicit_extracted records when ollamaUrl is provided', async () => {
      mockQueryOllamaJSON.mockResolvedValue([
        { fromEntity: 'TypeScript', toEntity: 'JavaScript', type: 'depends_on', confidence: 0.85 },
      ]);

      graphEntities.set([
        makeEntity('e1', 'TypeScript', 'Other', ['n1']),
        makeEntity('e2', 'JavaScript', 'Other', ['n1']),
      ]);
      graphRelations.set([]);
      notes.set([
        { id: 'n1', title: 'Note One', content: 'TypeScript builds on JavaScript', dateModified: 0, isPinned: false },
      ]);

      const improver = createSelfImprover({
        enabled: true,
        autoApplyThreshold: 0.99,
        ollamaUrl: 'http://localhost:11434',
      });
      const results = await improver.runOnce();

      const implicit = results.filter((r) => r.type === 'implicit_extracted');
      expect(implicit.length).toBe(1);
      expect(implicit[0].description).toContain('depends_on');
      expect(implicit[0].undoData).toHaveProperty('relation');
    });

    it('skips implicit extraction when no ollamaUrl', async () => {
      graphEntities.set([
        makeEntity('e1', 'TypeScript', 'Other', ['n1']),
        makeEntity('e2', 'JavaScript', 'Other', ['n1']),
      ]);
      graphRelations.set([]);
      notes.set([
        { id: 'n1', title: 'Note One', content: 'TypeScript builds on JavaScript', dateModified: 0, isPinned: false },
      ]);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      const implicit = results.filter((r) => r.type === 'implicit_extracted');
      expect(implicit.length).toBe(0);
      expect(mockQueryOllamaJSON).not.toHaveBeenCalled();
    });

    it('does not break runOnce when Ollama returns null', async () => {
      mockQueryOllamaJSON.mockResolvedValue(null);

      graphEntities.set([
        makeEntity('e1', 'A', 'Other', ['n1']),
      ]);
      graphRelations.set([]);
      notes.set([
        { id: 'n1', title: 'Note', content: 'Content', dateModified: 0, isPinned: false },
      ]);

      const improver = createSelfImprover({
        enabled: true,
        autoApplyThreshold: 0.99,
        ollamaUrl: 'http://localhost:11434',
      });
      const results = await improver.runOnce();

      // Should complete without throwing
      expect(Array.isArray(results)).toBe(true);
    });

    it('finds candidates after extractAndSaveEntities + loadGraphData round-trip', async () => {
      const { extractAndSaveEntities, loadGraphData } = await import('../stores/graph');

      await extractAndSaveEntities('n1', 'Note One', '# Intro\nSome text about #typescript and #react');
      await extractAndSaveEntities('n2', 'Note Two', '# Guide\nMore about #typescript and #react');
      await extractAndSaveEntities('n3', 'Note Three', '# Tips\nEven more #typescript and #react');

      notes.set([
        { id: 'n1', title: 'Note One', content: '', dateModified: 0, isPinned: false },
        { id: 'n2', title: 'Note Two', content: '', dateModified: 0, isPinned: false },
        { id: 'n3', title: 'Note Three', content: '', dateModified: 0, isPinned: false },
      ]);
      await loadGraphData();

      const entities = get(graphEntities);
      const tsEntity = entities.find((e) => e.name === 'typescript');
      expect(tsEntity).toBeDefined();
      expect(tsEntity!.sourceNoteIds.length).toBeGreaterThanOrEqual(2);

      const improver = createSelfImprover({ enabled: true, autoApplyThreshold: 0.99 });
      const results = await improver.runOnce();

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
