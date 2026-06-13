/// <reference lib="webworker" />

// Message types
export type WorkerMessage =
  | { type: 'embed'; id: string; texts: string[] }
  | { type: 'status' };

export type WorkerResponse =
  | { type: 'embeddings'; id: string; vectors: number[][] }
  | { type: 'status'; ready: boolean; modelLoaded: boolean }
  | { type: 'error'; id: string; message: string };

let pipeline: any = null;
let modelLoaded = false;
let loadPromise: Promise<void> | null = null;

async function loadModel(): Promise<void> {
  if (pipeline) return;
  if (loadPromise) return loadPromise; // wait for in-progress load

  loadPromise = (async () => {
    try {
      const { pipeline: createPipeline, env } = await import('@xenova/transformers');
      // Skip Transformers.js' default /models/... probe. In dev, those probes
      // show up as noisy 404s before the library falls back to Hugging Face.
      env.allowLocalModels = false;
      pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      modelLoaded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load model';
      self.postMessage({ type: 'error', id: 'init', message } satisfies WorkerResponse);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

async function generateEmbeddings(id: string, texts: string[]): Promise<void> {
  try {
    if (!pipeline) {
      await loadModel();
    }

    if (!pipeline) {
      self.postMessage({
        type: 'error',
        id,
        message: 'Model not loaded',
      } satisfies WorkerResponse);
      return;
    }

    const vectors: number[][] = [];
    for (const text of texts) {
      const output = await pipeline(text, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data));
    }

    self.postMessage({
      type: 'embeddings',
      id,
      vectors,
    } satisfies WorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Embedding generation failed';
    self.postMessage({ type: 'error', id, message } satisfies WorkerResponse);
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'embed':
      generateEmbeddings(msg.id, msg.texts);
      break;
    case 'status':
      self.postMessage({
        type: 'status',
        ready: modelLoaded,
        modelLoaded,
      } satisfies WorkerResponse);
      break;
  }
});

// Load lazily on the first fallback embed request. Ollama is the preferred
// embedding path, so eagerly loading Xenova causes unnecessary network traffic.
