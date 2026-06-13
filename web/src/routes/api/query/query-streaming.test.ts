import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/query streaming mode', () => {
  it('supports streaming tokens instead of waiting for full model completion', () => {
    const server = readFileSync(resolve(process.cwd(), 'src/routes/api/query/+server.ts'), 'utf-8');
    const panel = readFileSync(resolve(process.cwd(), 'src/lib/components/ChatPanel.svelte'), 'utf-8');

    expect(server).toContain('body.stream === true');
    expect(server).toContain('return streamNoteGraphResponse({');
    expect(server).toContain('signal: request.signal');
    expect(server).toContain('searchLocalMemory');
    expect(server).not.toContain('!includeExperimentalWiki && body.stream !== true');
    expect(server).toContain('new ReadableStream');
    expect(server).toContain('sanitizeCitationsForClient');
    expect(server).toContain('Searching your notes and graph');
    expect(server).toContain('I found relevant notes. Asking Ollama to reason over them');
    expect(server).toContain('synthesizeAnswerFromMemory');
    expect(server).toContain('queryOllama(queryContext.messages, config, input.signal)');
    expect(panel).toContain('buildClientFastRecall');
    expect(panel).toContain("text: instantRecall,");
    expect(panel).toContain('Still waiting for the chat stream to start');
    expect(panel).toContain('stream: true');
    expect(panel).toContain('response.body.getReader()');
    expect(panel).not.toContain('await proxyCheckHealth(config.ollamaUrl)');
  });
});
