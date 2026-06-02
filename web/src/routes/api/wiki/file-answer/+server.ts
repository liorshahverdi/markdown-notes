import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { join } from 'node:path';
import { getDb } from '$lib/server/database';
import { fileAnswerToWiki } from '$lib/wiki/query/fileAnswerWorkflow';
import type { WikiCitation } from '$lib/wiki/query/queryPipeline';
import type { WikiCoverage } from '$lib/wiki/query/wikiSearch';

const DEFAULT_USER_ID = 'user-1';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json() as {
    question?: string;
    answer?: string;
    citations?: WikiCitation[];
    coverage?: WikiCoverage;
    usedRawFallback?: boolean;
  };

  if (!body.question || !body.answer) {
    return json({ message: 'Missing question or answer' }, { status: 400 });
  }

  const result = fileAnswerToWiki({
    db: getDb(),
    userId: locals.user?.id ?? DEFAULT_USER_ID,
    baseDir: join(process.cwd(), 'data'),
    question: body.question,
    answer: body.answer,
    citations: body.citations ?? [],
    coverage: body.coverage ?? 'weak',
    usedRawFallback: body.usedRawFallback ?? false,
  });

  return json(result);
};
