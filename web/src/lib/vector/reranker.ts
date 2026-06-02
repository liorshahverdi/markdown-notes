/**
 * Cross-encoder reranker client.
 * Lazily initializes a Web Worker running Xenova/ms-marco-MiniLM-L-6-v2
 * and provides a simple rerank() function.
 */

let worker: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<
  string,
  { resolve: (scores: number[]) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

const RERANK_TIMEOUT = 30_000;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./reranker.worker.ts', import.meta.url), { type: 'module' });

    worker.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'scores') {
        const pending = pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(msg.id);
          pending.resolve(msg.scores);
        }
      } else if (msg.type === 'error') {
        const pending = pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(msg.id);
          pending.reject(new Error(msg.message));
        }
      }
    });

    worker.addEventListener('error', (event) => {
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Reranker worker error: ${event.message}`));
      }
      pendingRequests.clear();
    });
  }
  return worker;
}

/**
 * Rerank search results using a cross-encoder model.
 * Returns the same results array sorted by cross-encoder score.
 *
 * Falls back to original order if reranking fails (e.g., model not available).
 */
export async function rerankResults<T extends { chunkText: string; score: number }>(
  query: string,
  results: T[]
): Promise<T[]> {
  if (results.length <= 1) return results;

  // Only rerank top candidates to keep latency reasonable
  const MAX_RERANK = 15;
  const toRerank = results.slice(0, MAX_RERANK);
  const rest = results.slice(MAX_RERANK);

  try {
    const w = getWorker();
    const id = `rerank_${++requestCounter}`;
    const candidates = toRerank.map((r) => r.chunkText);

    const scores = await new Promise<number[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error('Rerank timed out'));
      }, RERANK_TIMEOUT);

      pendingRequests.set(id, { resolve, reject, timer });
      w.postMessage({ type: 'rerank', id, query, candidates });
    });

    // Combine cross-encoder scores with original scores (weighted blend)
    const reranked = toRerank.map((r, i) => ({
      ...r,
      score: scores[i] * 0.6 + r.score * 0.4, // blend cross-encoder + bi-encoder
    }));

    reranked.sort((a, b) => b.score - a.score);
    return [...reranked, ...rest];
  } catch (err) {
    console.warn('Reranking failed, using original order:', err);
    return results;
  }
}

/** Tear down the worker (for cleanup/testing) */
export function destroyReranker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('Reranker destroyed'));
  }
  pendingRequests.clear();
  requestCounter = 0;
}
