import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getModelLease } from '$lib/server/modelLease';
import { queryLlamaCpp } from '$lib/server/llamaCpp';
import type { ChatMessage } from '$lib/vector/ragPipeline';

export const POST: RequestHandler = async ({ request }) => {
  const { messages, prompt } = await request.json();
  getModelLease().touch();
  if (messages !== undefined && (!Array.isArray(messages) || messages.length === 0 || messages.some((m: ChatMessage) => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string'))) {
    throw error(400, 'Invalid messages');
  }
  if (!messages && (typeof prompt !== 'string' || !prompt.trim())) throw error(400, 'Missing prompt/messages');
  const abort = new AbortController();
  const signal = AbortSignal.any([request.signal, abort.signal]);
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const token of queryLlamaCpp(messages ?? prompt, undefined, signal)) send({ token });
        if (!signal.aborted) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        if (!signal.aborted) { try { send({ error: err instanceof Error ? err.message : 'llama.cpp request failed' }); } catch {} }
      } finally { try { controller.close(); } catch {} }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
};
