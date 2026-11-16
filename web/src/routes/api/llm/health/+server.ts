import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkLlamaCppHealth, DEFAULT_LLAMACPP_MODEL } from '$lib/server/llamaCpp';
import { getModelLease } from '$lib/server/modelLease';

export const GET: RequestHandler = async ({ url, locals }) => {
  const lease = getModelLease();
  // Visible browser tabs keep the hub lease alive; abandoned tabs let it lapse.
  if (url.searchParams.get('active') === '1' && locals.auth?.type === 'session') lease.touch();
  return json({
    ok: await checkLlamaCppHealth(),
    provider: 'llama.cpp',
    model: process.env.LLAMACPP_MODEL || DEFAULT_LLAMACPP_MODEL,
    embeddings: false,
    retrieval: 'keyword-graph',
    lease: lease.snapshot(),
  });
};
