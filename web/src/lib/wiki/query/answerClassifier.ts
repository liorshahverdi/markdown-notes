import type { WikiCitation } from './queryPipeline';
import type { WikiPageType } from '$lib/wiki/types';
import type { WikiCoverage } from './wikiSearch';

export interface ClassifyAnswerForFilingInput {
  question: string;
  answer: string;
  citations: WikiCitation[];
  coverage: WikiCoverage;
  usedRawFallback: boolean;
}

export interface AnswerFilingClassification {
  shouldFile: boolean;
  targetPageType: Extract<WikiPageType, 'question' | 'synthesis'>;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
}

const INSUFFICIENT_INFORMATION = /\b(i do not have enough information|not enough information|cannot answer|can't answer|no matching wiki context|i don't know)\b/i;
const ERROR_ANSWER = /\b(error querying|ollama is not reachable|failed to query|response timed out)\b/i;

export function classifyAnswerForFiling(input: ClassifyAnswerForFilingInput): AnswerFilingClassification {
  const reasons: string[] = [];
  const normalizedAnswer = input.answer.trim();

  if (normalizedAnswer.length < 40) reasons.push('answer is too short');
  if (INSUFFICIENT_INFORMATION.test(normalizedAnswer)) reasons.push('answer says there is insufficient information');
  if (ERROR_ANSWER.test(normalizedAnswer)) reasons.push('answer is an error response');
  if (input.citations.length === 0) reasons.push('answer has no citations');
  if (input.citations.some((citation) => citation.kind === 'wiki-page')) reasons.push('answer has wiki citations');
  if (input.usedRawFallback) reasons.push('answer used raw-source fallback');

  const blockingReasons = reasons.filter((reason) =>
    ['answer is too short', 'answer says there is insufficient information', 'answer is an error response', 'answer has no citations'].includes(reason)
  );

  if (blockingReasons.length > 0) {
    return { shouldFile: false, targetPageType: 'question', confidence: 'low', reasons };
  }

  const confidence = input.coverage === 'strong' && !input.usedRawFallback ? 'high' : 'medium';
  return { shouldFile: true, targetPageType: 'question', confidence, reasons };
}
