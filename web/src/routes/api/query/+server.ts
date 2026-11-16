import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database';
import { getDataDir } from '$lib/server/dataDir';
import { DEFAULT_LLAMACPP_BASE_URL, DEFAULT_LLAMACPP_MODEL } from '$lib/server/llamaCpp';
import { readGraphRelationReviews } from '$lib/server/graphRelationReviews';
import { queryLlamaCpp as queryOllama } from '$lib/server/llamaCpp';
import { readFolders, readNotes } from '$lib/server/notesFile';
import { buildNoteMemoryContext, type VectorMatch } from '$lib/memory/noteMemoryPipeline';
import { synthesizeAnswerFromMemory } from '$lib/memory/answerSynthesizer';
import { buildWikiFirstQueryContext } from '$lib/wiki/query/queryPipeline';
import type { GraphRelationReviewMap } from '$lib/graph/relationReviewKey';
import { getUserGraph } from '$lib/server/graph/graphService';
import { recordEdgeUsage } from '$lib/server/graph/graphStore';
import type { GraphMemorySource } from '$lib/memory/graphMemoryRetriever';
import type { FolderRecord, NoteRecord } from '../../../types/note';

const DEFAULT_TOP_K = 5;
const DEFAULT_MODEL = DEFAULT_LLAMACPP_MODEL;
const DEFAULT_USER_ID = 'user-1';
const INSUFFICIENT_EVIDENCE_RESPONSE = 'I do not have enough evidence in your notes or graph to answer that directly.';
const SEARCHING_MEMORY_STATUS = 'Searching your notes and graph…\n\n';
const OLLAMA_REASONING_STATUS = 'I found relevant notes. Asking Laguna XS 2.1 to reason over them…\n\n';

/** Materialized graph (base + enrichment overlay); falls back to the regex snapshot on failure. */
function loadMaterializedGraph(userId: string, notes: NoteRecord[], folders: FolderRecord[]): GraphMemorySource | undefined {
  try {
    return getUserGraph(userId, { notes, folders });
  } catch (err) {
    console.warn('[query] materialized graph unavailable, using regex snapshot', err);
    return undefined;
  }
}

/** Usage signal: graph edges cited in an answer stay fresh; unused automatic edges decay. */
function recordGraphUsage(userId: string, citations: Array<{ kind?: string; id?: string }>): void {
  try {
    const ids = citations.filter((citation) => citation.kind === 'graph-edge' && typeof citation.id === 'string').map((citation) => citation.id!);
    if (ids.length > 0) recordEdgeUsage(getDb(), userId, ids);
  } catch {
    // Usage tracking must never break answering.
  }
}

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
  relationReviews?: GraphRelationReviewMap;
  loadGraph?: () => GraphMemorySource | undefined;
  model?: string;
  signal?: AbortSignal;
}): Response {
  const abort = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, abort.signal]) : abort.signal;
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
            // Keyword + graph retrieval only; no embedding model is called.
            const vectorMatches: VectorMatch[] = [];

            const queryContext = buildNoteMemoryContext({
              notes: input.userNotes,
              folders: input.folders,
              query: input.query,
              topK: DEFAULT_TOP_K,
              vectorMatches,
              relationReviews: input.relationReviews,
              graph: input.loadGraph?.(),
            });
            recordGraphUsage(input.userId, queryContext.citations);
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
            for await (const token of queryOllama(queryContext.messages, config, signal)) {
              tokenCount += token.length;
              send({ type: 'token', token });
            }
            if (tokenCount === 0) {
              send({ type: 'error', message: 'Laguna returned an empty response. Check the llama.cpp fleet status.' });
              return;
            }
            send({ type: 'done' });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            send({ type: 'error', message: `Error querying llama.cpp: ${message}` });
          } finally {
            close();
          }
        })();
      },
      cancel() { abort.abort(); },
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

  // Ignore legacy browser settings: the hub owns backend selection.
  const resolvedOllamaUrl = DEFAULT_LLAMACPP_BASE_URL;

  const userId = locals.user?.id ?? DEFAULT_USER_ID;
  const userNotes = readNotes(userId);
  const folders = readFolders(userId);
  const relationReviews = includeExperimentalWiki ? undefined : readGraphRelationReviews(getDb(), userId);
  const loadGraph = () => (includeExperimentalWiki ? undefined : loadMaterializedGraph(userId, userNotes, folders));

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
      relationReviews,
      loadGraph,
      model,
      signal: request.signal,
    });
  }

  const graph = loadGraph();

  if (!includeExperimentalWiki) {
    // 1. Fast exact/full-text note + graph pass for non-streaming API callers.
    const quickContext = buildNoteMemoryContext({
      notes: userNotes,
      folders,
      query,
      topK: DEFAULT_TOP_K,
      vectorMatches: [],
      relationReviews,
      graph,
    });
    recordGraphUsage(userId, quickContext.citations);
    const groundedAnswer = synthesizeAnswerFromMemory({ query, citations: quickContext.citations });
    if (groundedAnswer.confidence === 'high') {
      return memoryJsonResponse({
        response: groundedAnswer.answer,
        queryContext: quickContext,
        stream: body.stream === true,
      });
    }
  }

  const vectorMatches: VectorMatch[] = [];

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
        relationReviews,
        graph,
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
    const abort = new AbortController();
    const signal = AbortSignal.any([request.signal, abort.signal]);
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
              for await (const token of queryOllama(queryContext.messages, config, signal)) {
                send({ type: 'token', token });
              }
              send({ type: 'done' });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              send({ type: 'error', message: `Error querying llama.cpp: ${message}` });
            } finally {
              close();
            }
          })();
        },
        cancel() { abort.abort(); },
      }),
      { headers: { 'Content-Type': 'application/x-ndjson' } }
    );
  }

  try {
    let fullResponse = '';
    for await (const token of queryOllama(queryContext.messages, config, request.signal)) {
      fullResponse += token;
    }
    if (!fullResponse.trim()) {
      fullResponse = 'Laguna returned an empty response. Check the llama.cpp fleet status.';
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
      response: `Error querying llama.cpp: ${message}`,
      sources: clientCitations,
      citations: clientCitations,
      coverage: queryContext.coverage,
      usedRawFallback: 'usedRawFallback' in queryContext ? queryContext.usedRawFallback : false,
      retrievalMode: 'retrievalMode' in queryContext ? queryContext.retrievalMode : 'experimental-wiki',
      usedWikiContext: includeExperimentalWiki === true,
    });
  }
};
