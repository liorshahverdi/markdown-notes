import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readNotes } from '$lib/server/notesFile';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';
import { buildRAGMessages, queryOllama, checkOllamaHealth } from '$lib/vector/ragPipeline';
import { serverSemanticSearch } from '$lib/vector/serverEmbeddings';

const DEFAULT_TOP_K = 5;
const DEFAULT_MODEL = 'llama3.2:3b';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { query, model, ollamaUrl } = body as { query: string; model?: string; ollamaUrl?: string };

  if (!query || typeof query !== 'string') {
    throw error(400, 'Missing or invalid query parameter');
  }

  let resolvedOllamaUrl: string;
  try {
    resolvedOllamaUrl = resolveOllamaBaseUrl(ollamaUrl);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }

  const isHealthy = await checkOllamaHealth(resolvedOllamaUrl);
  if (!isHealthy) {
    throw error(503, 'Ollama is not reachable. Make sure it is running.');
  }

  const allNotes = readNotes(locals.user!.id);
  const { results, contextNotes } = await serverSemanticSearch(query, allNotes, DEFAULT_TOP_K);

  const sources = results.map((result) => ({
    noteId: result.noteId,
    title: result.title,
    relevanceScore: result.score,
  }));

  const contextWithScores = contextNotes.map((note, index) => ({
    ...note,
    relevanceScore: results[index]?.score ?? 1,
  }));

  const noteById = new Map(allNotes.map((note) => [note.id, note]));
  const noteSummaries = results
    .map((result) => {
      const note = noteById.get(result.noteId);
      return note?.summary ? { title: result.title, summary: note.summary } : null;
    })
    .filter((summary): summary is { title: string; summary: string } => summary !== null);

  const messages = buildRAGMessages(
    query,
    contextWithScores,
    undefined,
    undefined,
    noteSummaries.length > 0 ? noteSummaries : undefined
  );
  const config = { ollamaUrl: resolvedOllamaUrl, model: model || DEFAULT_MODEL, topK: DEFAULT_TOP_K };

  try {
    let fullResponse = '';
    for await (const token of queryOllama(messages, config)) {
      fullResponse += token;
    }

    return json({
      response: fullResponse,
      sources,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({
      response: `Error querying Ollama: ${message}`,
      sources,
    });
  }
};
