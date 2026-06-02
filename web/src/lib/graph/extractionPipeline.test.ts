import { describe, it, expect, vi } from 'vitest';
import { runExtractionPipeline } from './extractionPipeline';

// Mock the NER pipeline since it requires model loading
vi.mock('./entityExtractor', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./entityExtractor')>();
  return {
    ...mod,
    extractNEREntities: vi.fn().mockResolvedValue({ entities: [], relations: [] }),
  };
});

describe('extractionPipeline', () => {
  it('returns entities and relations from regex stage', async () => {
    const result = await runExtractionPipeline(
      'note-1',
      'My Note',
      '## Machine Learning\n\nContent about #ai'
    );

    expect(result.entities.length).toBeGreaterThanOrEqual(1);
    const noteEntity = result.entities.find((e) => e.type === 'note');
    expect(noteEntity).toBeDefined();

    const topic = result.entities.find((e) => e.type === 'Other' && e.subtype === 'topic');
    expect(topic).toBeDefined();
    expect(topic!.name).toBe('Machine Learning');

    const tag = result.entities.find((e) => e.type === 'Other' && e.subtype === 'tag');
    expect(tag).toBeDefined();
    expect(tag!.name).toBe('ai');
  });

  it('returns stage metadata with timing', async () => {
    const result = await runExtractionPipeline('note-1', 'Test', 'Content');

    expect(result.stages.length).toBeGreaterThanOrEqual(1);
    const regexStage = result.stages.find((s) => s.name === 'regex');
    expect(regexStage).toBeDefined();
    expect(regexStage!.durationMs).toBeGreaterThanOrEqual(0);
    expect(regexStage!.entityCount).toBeGreaterThanOrEqual(1);
  });

  it('runs NER stage', async () => {
    const result = await runExtractionPipeline('note-1', 'Test', 'Content');

    const nerStage = result.stages.find((s) => s.name === 'ner');
    expect(nerStage).toBeDefined();
  });

  it('respects config flags to disable stages', async () => {
    const result = await runExtractionPipeline(
      'note-1', 'Test', 'Content', undefined,
      { enableRegex: true, enableNER: false }
    );

    expect(result.stages.length).toBe(1);
    expect(result.stages[0].name).toBe('regex');
  });

  it('includes folder entities when folderPath provided', async () => {
    const result = await runExtractionPipeline(
      'note-1', 'Test', 'Content', ['Projects', 'Web']
    );

    const folders = result.entities.filter((e) => e.type === 'folder');
    expect(folders.length).toBe(2);
    expect(folders.map((f) => f.name)).toContain('Projects');
    expect(folders.map((f) => f.name)).toContain('Web');
  });
});
