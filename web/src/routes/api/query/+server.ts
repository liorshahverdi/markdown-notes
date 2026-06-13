import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getDataDir } from '$lib/server/dataDir';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';
import { queryOllama } from '$lib/vector/ragPipeline';
import { readFolders, readNotes } from '$lib/server/notesFile';
import { buildNoteMemoryContext, type VectorMatch } from '$lib/memory/noteMemoryPipeline';
import { synthesizeAnswerFromMemory } from '$lib/memory/answerSynthesizer';
import { ensureUserMemoryIndex, searchLocalMemory } from '$lib/memory/localMemoryIndex';
import { buildWikiFirstQueryContext } from '$lib/wiki/query/queryPipeline';
import type { FolderRecord, NoteRecord } from '../../../types/note';

const DEFAULT_TOP_K = 5;
const DEFAULT_MODEL = 'qwen2.5:3b';
const DEFAULT_USER_ID = 'user-1';
const INSUFFICIENT_EVIDENCE_RESPONSE = 'I do not have enough evidence in your notes or graph to answer that directly.';
const SEARCHING_MEMORY_STATUS = 'Searching your notes and graph…\n\n';
const OLLAMA_REASONING_STATUS = 'I found relevant notes. Asking Ollama to reason over them…\n\n';

function sanitizeCitationsForClient(citations: unknown[]): unknown[] {
  return citations.map((citation) => {
    if (!citation || typeof citation !== 'object') return citation;
    const item = { ...(citation as Record<string, unknown>) };
    if (typeof item.excerpt === 'string' && item.excerpt.length > 600) {
      item.excerpt = `${item.excerpt.slice(0, 600)}…`;
    }
    return item;
  });
}

function streamJsonLines(events: unknown[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } }
  );
}

function memoryJsonResponse(input: {
  response: string;
  queryContext: { citations: unknown[]; coverage: unknown };
  stream?: boolean;
  usedRawFallback?: boolean;
  retrievalMode?: string;
  usedWikiContext?: boolean;
}): Response {
  const citations = sanitizeCitationsForClient(input.queryContext.citations);
  const payload = {
    response: input.response,
    sources: citations,
    citations,
    coverage: input.queryContext.coverage,
    usedRawFallback: input.usedRawFallback ?? false,
    retrievalMode: input.retrievalMode ?? 'notes-graph',
    usedWikiContext: input.usedWikiContext ?? false,
  };

  if (input.stream) {
    return streamJsonLines([
      { type: 'meta', ...payload },
      { type: 'token', token: input.response },
      { type: 'done' },
    ]);
  }

  return json(payload);
}

function streamNoteGraphResponse(input: {
  query: string;
  userId: string;
  userNotes: NoteRecord[];
  folders: FolderRecord[];
  resolvedOllamaUrl: string;
  model?: string;
  signal?: AbortSignal;
}): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        let closed = false;
        const send = (value: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
          } catch {
            closed = true;
          }
        };
        const close = () => {
          if (closed) return;
          closed = true;
          try { controller.close(); } catch {}
        };

        // Return a visible response before embeddings, graph enrichment, or Ollama can block.
        send({ type: 'token', token: SEARCHING_MEMORY_STATUS });

        void (async () => {
          try {
            let vectorMatches: VectorMatch[] = [];
            try {
              let semantic = await searchLocalMemory({ userId: input.userId, query: input.query, topK: DEFAULT_TOP_K });
              if (semantic.length === 0 && input.userNotes.length > 0) {
                await ensureUserMemoryIndex({ userId: input.userId, notes: input.userNotes });
                semantic = await searchLocalMemory({ userId: input.userId, query: input.query, topK: DEFAULT_TOP_K });
              }
              vectorMatches = semantic.map((result) => ({
                noteId: result.noteId,
                chunkText: result.chunkText,
                score: result.score,
              }));
            } catch (err) {
              console.warn('[Query] Local memory index unavailable; continuing with full-text + graph memory.', err);
            }

            const queryContext = buildNoteMemoryContext({
              notes: input.userNotes,
              folders: input.folders,
              query: input.query,
              topK: DEFAULT_TOP_K,
              vectorMatches,
            });
            const clientCitations = sanitizeCitationsForClient(queryContext.citations);
            send({
              type: 'meta',
              sources: clientCitations,
              citations: clientCitations,
              coverage: queryContext.coverage,
              usedRawFallback: false,
              retrievalMode: 'notes-graph',
              usedWikiContext: false,
            });

            const groundedAnswer = synthesizeAnswerFromMemory({ query: input.query, citations: queryContext.citations });
            if (groundedAnswer.confidence === 'high') {
              send({ type: 'token', token: groundedAnswer.answer });
              send({ type: 'done' });
              return;
            }

            if (queryContext.coverage.noteCount === 0 && queryContext.coverage.graphEdgeCount === 0) {
              send({ type: 'token', token: INSUFFICIENT_EVIDENCE_RESPONSE });
              send({ type: 'done' });
              return;
            }

            send({ type: 'token', token: OLLAMA_REASONING_STATUS });
            const config = { ollamaUrl: input.resolvedOllamaUrl, model: input.model || DEFAULT_MODEL, topK: DEFAULT_TOP_K };
            let tokenCount = 0;
            for await (const token of queryOllama(queryContext.messages, config, input.signal)) {
              tokenCount += token.length;
              send({ type: 'token', token });
            }
            if (tokenCount === 0) {
              send({ type: 'error', message: 'Ollama returned an empty response. Check the selected model and Ollama server logs.' });
              return;
            }
            send({ type: 'done' });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            send({ type: 'error', message: `Error querying Ollama: ${message}` });
          } finally {
            close();
          }
        })();
      },
      cancel() {},
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } }
  );
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { query, model, ollamaUrl, includeExperimentalWiki } = body as {
    query: string;
    model?: string;
    ollamaUrl?: string;
    includeExperimentalWiki?: boolean;
    stream?: boolean;
  };

  if (!query || typeof query !== 'string') {
    throw error(400, 'Missing or invalid query parameter');
  }

  let resolvedOllamaUrl: string;
  try {
    resolvedOllamaUrl = resolveOllamaBaseUrl(ollamaUrl);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }

  const userId = locals.user?.id ?? DEFAULT_USER_ID;
  const userNotes = readNotes(userId);
  const folders = readFolders(userId);

  if (!includeExperimentalWiki && body.stream === true) {
    // In interactive chat, return the stream before any retrieval/model work so
    // the browser never sits on an apparently dead request while local indexing,
    // graph expansion, or Ollama startup is slow.
    return streamNoteGraphResponse({
      query,
      userId,
      userNotes,
      folders,
      resolvedOllamaUrl,
      model,
      signal: request.signal,
    });
  }

  if (!includeExperimentalWiki) {
    // 1. Fast exact/full-text note + graph pass for non-streaming API callers.
    const quickContext = buildNoteMemoryContext({
      notes: userNotes,
      folders,
      query,
      topK: DEFAULT_TOP_K,
      vectorMatches: [],
    });
    const groundedAnswer = synthesizeAnswerFromMemory({ query, citations: quickContext.citations });
    if (groundedAnswer.confidence === 'high') {
      return memoryJsonResponse({
        response: groundedAnswer.answer,
        queryContext: quickContext,
        stream: body.stream === true,
      });
    }
  }

  let vectorMatches: VectorMatch[] = [];
  if (!includeExperimentalWiki) {
    try {
      let semantic = await searchLocalMemory({ userId, query, topK: DEFAULT_TOP_K });
      if (semantic.length === 0 && userNotes.length > 0) {
        await ensureUserMemoryIndex({ userId, notes: userNotes });
        semantic = await searchLocalMemory({ userId, query, topK: DEFAULT_TOP_K });
      }
      vectorMatches = semantic.map((result) => ({
        noteId: result.noteId,
        chunkText: result.chunkText,
        score: result.score,
      }));
    } catch (err) {
      console.warn('[Query] Local memory index unavailable; continuing with full-text + graph memory.', err);
    }
  }

  const queryContext = includeExperimentalWiki
    ? buildWikiFirstQueryContext({
        db: getDb(),
        userId,
        baseDir: getDataDir(),
        query,
        topK: DEFAULT_TOP_K,
      })
    : buildNoteMemoryContext({
        notes: userNotes,
        folders,
        query,
        topK: DEFAULT_TOP_K,
        vectorMatches,
      });

  if (!includeExperimentalWiki) {
    const groundedAnswer = synthesizeAnswerFromMemory({ query, citations: queryContext.citations });
    if (groundedAnswer.confidence === 'high') {
      return memoryJsonResponse({
        response: groundedAnswer.answer,
        queryContext,
        stream: body.stream === true,
      });
    }

    if (typeof queryContext.coverage !== 'string' && queryContext.coverage.noteCount === 0 && queryContext.coverage.graphEdgeCount === 0) {
      return memoryJsonResponse({
        response: INSUFFICIENT_EVIDENCE_RESPONSE,
        queryContext,
        stream: body.stream === true,
      });
    }
  }

  const config = { ollamaUrl: resolvedOllamaUrl, model: model || DEFAULT_MODEL, topK: DEFAULT_TOP_K };

  if (body.stream === true) {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          let closed = false;
          const send = (value: unknown) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
            } catch {
              closed = true;
            }
          };
          const close = () => {
            if (closed) return;
            closed = true;
            try {
              controller.close();
            } catch {
              // The browser may have already closed the stream after receiving the fast recall answer.
            }
          };
          const clientCitations = sanitizeCitationsForClient(queryContext.citations);
          send({ type: 'token', token: OLLAMA_REASONING_STATUS });
          send({
            type: 'meta',
            sources: clientCitations,
            citations: clientCitations,
            coverage: queryContext.coverage,
            usedRawFallback: 'usedRawFallback' in queryContext ? queryContext.usedRawFallback : false,
            retrievalMode: 'retrievalMode' in queryContext ? queryContext.retrievalMode : 'experimental-wiki',
            usedWikiContext: includeExperimentalWiki === true,
          });
          void (async () => {
            try {
              if (!includeExperimentalWiki) {
                const groundedAnswer = synthesizeAnswerFromMemory({ query, citations: queryContext.citations });
                if (groundedAnswer.confidence === 'high') {
                  send({ type: 'token', token: groundedAnswer.answer });
                  send({ type: 'done' });
                  return;
                }
              }
              for await (const token of queryOllama(queryContext.messages, config, request.signal)) {
                send({ type: 'token', token });
              }
              send({ type: 'done' });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              send({ type: 'error', message: `Error querying Ollama: ${message}` });
            } finally {
              close();
            }
          })();
        },
        cancel() {},
      }),
      { headers: { 'Content-Type': 'application/x-ndjson' } }
    );
  }

  try {
    let fullResponse = '';
    for await (const token of queryOllama(queryContext.messages, config)) {
      fullResponse += token;
    }
    if (!fullResponse.trim()) {
      fullResponse = 'Ollama returned an empty response. Check the selected model and Ollama server logs.';
    }

    const clientCitations = sanitizeCitationsForClient(queryContext.citations);
    return json({
      response: fullResponse,
      sources: clientCitations,
      citations: clientCitations,
      coverage: queryContext.coverage,
      usedRawFallback: 'usedRawFallback' in queryContext ? queryContext.usedRawFallback : false,
      retrievalMode: 'retrievalMode' in queryContext ? queryContext.retrievalMode : 'experimental-wiki',
      usedWikiContext: includeExperimentalWiki === true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const clientCitations = sanitizeCitationsForClient(queryContext.citations);
    return json({
      response: `Error querying Ollama: ${message}`,
      sources: clientCitations,
      citations: clientCitations,
      coverage: queryContext.coverage,
      usedRawFallback: 'usedRawFallback' in queryContext ? queryContext.usedRawFallback : false,
      retrievalMode: 'retrievalMode' in queryContext ? queryContext.retrievalMode : 'experimental-wiki',
      usedWikiContext: includeExperimentalWiki === true,
    });
  }
};
