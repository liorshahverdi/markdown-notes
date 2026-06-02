/// <reference lib="webworker" />

/**
 * Web Worker for cross-encoder reranking using Xenova/ms-marco-MiniLM-L-6-v2.
 * Takes (query, candidate) pairs and returns relevance scores.
 */

export type RerankerMessage = {
  type: 'rerank';
  id: string;
  query: string;
  candidates: string[]; // chunk texts to score against query
};

export type RerankerResponse =
  | { type: 'scores'; id: string; scores: number[] }
  | { type: 'error'; id: string; message: string };

let classifier: any = null;
let loadPromise: Promise<void> | null = null;

async function loadModel(): Promise<void> {
  if (classifier) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const { pipeline } = await import('@xenova/transformers');
      // Cross-encoder for passage reranking
      classifier = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load reranker model';
      self.postMessage({ type: 'error', id: 'init', message } satisfies RerankerResponse);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

async function rerank(id: string, query: string, candidates: string[]): Promise<void> {
  try {
    if (!classifier) await loadModel();
    if (!classifier) {
      self.postMessage({ type: 'error', id, message: 'Reranker model not loaded' } satisfies RerankerResponse);
      return;
    }

    const scores: number[] = [];
    for (const candidate of candidates) {
      // Cross-encoder takes a query-document pair
      const result = await classifier(`${query} [SEP] ${candidate}`, { topk: 1 });
      // The model returns a score — higher means more relevant
      scores.push(result[0]?.score ?? 0);
    }

    self.postMessage({ type: 'scores', id, scores } satisfies RerankerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reranking failed';
    self.postMessage({ type: 'error', id, message } satisfies RerankerResponse);
  }
}

self.addEventListener('message', (event: MessageEvent<RerankerMessage>) => {
  const msg = event.data;
  if (msg.type === 'rerank') {
    rerank(msg.id, msg.query, msg.candidates);
  }
});
