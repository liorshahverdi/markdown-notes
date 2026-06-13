import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryOllama, type ChatMessage } from '$lib/vector/ragPipeline';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';
const DEFAULT_MODEL = 'qwen2.5:3b';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { messages, prompt, model, ollamaUrl, topK } = body as {
    messages?: ChatMessage[];
    prompt?: string;
    model?: string;
    ollamaUrl?: string;
    topK?: number;
  };

  // Accept either messages array (new) or prompt string (legacy)
  if (!messages && (!prompt || typeof prompt !== 'string')) {
    throw error(400, 'Missing or invalid prompt/messages');
  }

  let resolvedOllamaUrl: string;
  try {
    resolvedOllamaUrl = resolveOllamaBaseUrl(ollamaUrl);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }

  const config = {
    ollamaUrl: resolvedOllamaUrl,
    model: model || DEFAULT_MODEL,
    topK: topK ?? 5,
  };

  const input = messages ?? prompt!;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const token of queryOllama(input, config, request.signal)) {
          const data = `data: ${JSON.stringify({ token })}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Client disconnected
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error';
          const data = `data: ${JSON.stringify({ error: message })}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
