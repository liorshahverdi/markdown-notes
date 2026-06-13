import type { MemoryCitation } from './memoryCitation';

export interface SynthesizedMemoryAnswer {
  answer: string;
  confidence: 'high' | 'none';
  sourceIds: string[];
}

interface InputCitation {
  id: string;
  title: string;
  kind?: string;
  noteId?: string;
  excerpt?: string;
  relevanceScore?: number;
}

const QUESTION_WORDS = new Set([
  'what', 'which', 'who', 'where', 'when', 'why', 'how', 'does', 'did', 'do', 'is', 'are', 'was', 'were', 'the', 'a',
  'an', 'for', 'to', 'of', 'in', 'on', 'about', 'related', 'relate', 'relation', 'use', 'uses', 'used', 'using',
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !QUESTION_WORDS.has(word));
}

function normalizeSentence(sentence: string): string {
  return sentence
    .replace(/^#+\s*/, '')
    .replace(/\bproject\s+uses\b/i, 'uses')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[;:,.!?]*$/, '.')
    .replace(/^the\s+/i, '');
}

function splitSentences(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normalizeSentence)
    .filter((sentence) => sentence.length > 8);
}

function isUseQuestion(query: string): boolean {
  return /\bwhat\b/i.test(query) && /\b(use|uses|used|using)\b/i.test(query);
}

function importantQueryWords(query: string): string[] {
  return words(query).filter((word) => word.length > 2);
}

function scoreSentence(sentence: string, queryWords: string[]): number {
  const normalized = sentence.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (normalized.includes(word)) score += 1;
  }
  if (/\b(use|uses|used|using)\b/i.test(sentence)) score += 3;
  return score;
}

function requiredUseAspectWords(query: string): string[] {
  const forMatch = query.match(/\bfor\s+(.+?)[?.!]*$/i);
  if (forMatch) return importantQueryWords(forMatch[1]);

  const objectMatch = query.match(/^(?:what|which)\s+(.+?)\s+(?:does|do|did)\b/i);
  if (objectMatch) return importantQueryWords(objectMatch[1]);

  return [];
}

function bestUseSentence(query: string, citations: InputCitation[]): SynthesizedMemoryAnswer | null {
  if (!isUseQuestion(query)) return null;
  const queryWords = importantQueryWords(query);
  const requiredAspectWords = requiredUseAspectWords(query);

  let best: { sentence: string; sourceId: string; score: number } | null = null;
  for (const citation of citations) {
    if (!citation.excerpt) continue;
    for (const sentence of splitSentences(citation.excerpt)) {
      const sentenceScore = scoreSentence(sentence, queryWords);
      const answersAspect = requiredAspectWords.length === 0 || requiredAspectWords.some((word) => sentence.toLowerCase().includes(word));
      if (!answersAspect || !/\b(use|uses|used|using)\b/i.test(sentence)) continue;
      if (!best || sentenceScore > best.score) {
        best = { sentence, sourceId: citation.id, score: sentenceScore };
      }
    }
  }

  if (!best || best.score < 4) return null;
  return {
    answer: best.sentence,
    confidence: 'high',
    sourceIds: [best.sourceId],
  };
}

function stripMarkdown(value: string): string {
  return value.replace(/[*_`]+/g, '').trim();
}

function isSummaryQuestion(query: string): boolean {
  return /\b(summarize|summary|summarise|recap|overview)\b/i.test(query);
}

function sentenceRelevance(sentence: string, queryTerms: string[]): number {
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (lower.includes(term)) score += 1;
  }
  if (/\b(action items?|decisions?|agreed|blocked|owner|next steps?|follow up|deadline|risk|matt)\b/i.test(sentence)) {
    score += 1;
  }
  return score;
}

function summaryAnswer(query: string, citations: InputCitation[]): SynthesizedMemoryAnswer | null {
  if (!isSummaryQuestion(query)) return null;
  const queryTerms = importantQueryWords(query);
  const candidates = citations
    .filter((citation) => citation.kind === 'note' && citation.excerpt)
    .map((citation) => {
      const haystack = `${citation.title}\n${citation.excerpt}`.toLowerCase();
      const matchScore = queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
      return { citation, matchScore };
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || (b.citation.relevanceScore ?? 0) - (a.citation.relevanceScore ?? 0));

  const best = candidates[0];
  if (!best?.citation.excerpt) return null;

  const sentences = splitSentences(best.citation.excerpt)
    .filter((sentence) => !/^#+\s*/.test(sentence))
    .map((sentence) => ({ sentence: stripMarkdown(sentence), score: sentenceRelevance(sentence, queryTerms) }))
    .filter((item) => item.sentence.length > 20)
    .sort((a, b) => b.score - a.score);

  const selected = sentences.slice(0, 5);
  if (selected.length === 0) return null;

  const bullets = selected.map((item) => `- ${item.sentence.replace(/[.]*$/, '.')}`);
  return {
    answer: `Summary of ${best.citation.title}:\n${bullets.join('\n')}`,
    confidence: 'high',
    sourceIds: [best.citation.id],
  };
}

function phraseAndCommandAnswer(query: string, citations: InputCitation[]): SynthesizedMemoryAnswer | null {
  const asksPhrase = /\b(phrase|strange|odd)\b/i.test(query);
  const asksCommand = /\b(command|shortcut|prefer|preferred)\b/i.test(query);
  if (!asksPhrase && !asksCommand) return null;

  for (const citation of citations) {
    const text = citation.excerpt ?? '';
    if (!text) continue;
    const phrase = asksPhrase
      ? text.match(/(?:odd|strange|phrase)[^\n:]*:\s*\n?\s*(?:\*\*)?([^*`\n.]+?)(?:\*\*)?[.\n]/i)?.[1] ??
        text.match(/\*\*([^*]+)\*\*/)?.[1]
      : null;
    const command = asksCommand
      ? text.match(/(?:preferred|prefer|shortcut|command)[^`\n]*`([^`]+)`/i)?.[1] ??
        text.match(/`(\/[a-z0-9][^`\s]*)`/i)?.[1]
      : null;
    const person = text.match(/named\s+\*\*([^*]+)\*\*/i)?.[1] ?? text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/)?.[1];

    const parts: string[] = [];
    if (asksPhrase && phrase) parts.push(`The strange phrase was "${stripMarkdown(phrase)}".`);
    if (asksCommand && command) {
      parts.push(`${person ? `${stripMarkdown(person)} preferred` : 'The preferred shortcut command was'} \`${command}\`.`);
    }
    if ((asksPhrase ? Boolean(phrase) : true) && (asksCommand ? Boolean(command) : true) && parts.length > 0) {
      return { answer: parts.join(' '), confidence: 'high', sourceIds: [citation.id] };
    }
  }

  return null;
}

function graphRelationAnswer(query: string, citations: InputCitation[]): SynthesizedMemoryAnswer | null {
  if (!/\b(related|relate|relationship|depend|depends|connect|connected)\b/i.test(query)) return null;
  const graph = citations.find((citation) => citation.kind === 'graph-edge' && citation.title);
  if (!graph) return null;
  const title = graph.title.replace(/_/g, ' ');
  const match = title.match(/^(.+?)\s+(depends on|depends|mentions|links to|connects to|uses)\s+(.+)$/i);
  if (!match) return null;
  const [, from, relation, to] = match;
  const normalizedRelation = relation.toLowerCase() === 'depends' ? 'depends on' : relation.toLowerCase();
  return {
    answer: `${from.trim()} ${normalizedRelation} ${to.trim()}.`,
    confidence: 'high',
    sourceIds: [graph.id],
  };
}

export function synthesizeAnswerFromMemory(input: {
  query: string;
  citations: Array<MemoryCitation | InputCitation>;
}): SynthesizedMemoryAnswer {
  const citations = input.citations as InputCitation[];
  const directUse = bestUseSentence(input.query, citations);
  if (directUse) return directUse;

  const summary = summaryAnswer(input.query, citations);
  if (summary) return summary;

  const phraseAndCommand = phraseAndCommandAnswer(input.query, citations);
  if (phraseAndCommand) return phraseAndCommand;

  const relation = graphRelationAnswer(input.query, citations);
  if (relation) return relation;

  return {
    answer: 'I do not have enough evidence in your notes or graph to answer that directly.',
    confidence: 'none',
    sourceIds: [],
  };
}
