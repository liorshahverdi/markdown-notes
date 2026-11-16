import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/query notes+graph pipeline order', () => {
  it('streams interactive chat before slower retrieval work, while non-streaming callers use fast memory first', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/api/query/+server.ts'), 'utf-8');

    const streamingStart = source.indexOf('return streamNoteGraphResponse');
    const firstSynth = source.indexOf('synthesizeAnswerFromMemory({ query, citations: quickContext.citations })');
    const modelFallback = source.indexOf('queryOllama(queryContext.messages, config', firstSynth);

    expect(firstSynth).toBeGreaterThan(-1);
    expect(streamingStart).toBeGreaterThan(-1);
    expect(source).not.toContain('searchLocalMemory');
    expect(modelFallback).toBeGreaterThan(-1);
    expect(source).not.toContain('checkOllamaHealth');
    expect(streamingStart).toBeLessThan(firstSynth);
    expect(firstSynth).toBeLessThan(modelFallback);
    expect(source).toContain('Searching your notes and graph');
    expect(source).toContain('I do not have enough evidence in your notes or graph to answer that directly.');
  });
});
