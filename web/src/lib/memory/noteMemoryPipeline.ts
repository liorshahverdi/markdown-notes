import { buildRAGMessages, extractRelevantExcerpt, type ChatMessage } from '$lib/vector/ragPipeline';
import { retrieveGraphMemory, formatGraphEvidence, type GraphMemoryEvidence } from './graphMemoryRetriever';
import { graphEdgeCitation, noteCitation, type MemoryCitation } from './memoryCitation';
import type { GraphRelationReviewMap } from '$lib/graph/relationReviewKey';
import type { FolderRecord, NoteRecord } from '../../types/note';

export interface VectorMatch {
  noteId: string;
  chunkText: string;
  score: number;
}

export interface NoteMemoryContext {
  messages: ChatMessage[];
  citations: MemoryCitation[];
  graphEvidence: GraphMemoryEvidence[];
  retrievalMode: 'notes-graph';
  usedWikiContext: false;
  coverage: {
    noteCount: number;
    graphEdgeCount: number;
    hasEvidence: boolean;
  };
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'from', 'what', 'how', 'why', 'does', 'did', 'are', 'was',
  'were', 'this', 'that', 'these', 'those', 'about', 'into', 'your', 'note', 'notes', 'remember',
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_#+.-]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function titleMatchRatio(note: NoteRecord, query: string): number {
  const titleTerms = tokenize(note.title);
  if (titleTerms.length === 0) return 0;
  const normalizedQuery = query.toLowerCase();
  return titleTerms.filter((term) => normalizedQuery.includes(term)).length / titleTerms.length;
}

function scoreNote(note: NoteRecord, query: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const title = note.title.toLowerCase();
  const content = note.content.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (title.includes(term)) score += 4;
    if (content.includes(term)) score += 1;
  }

  // Hybrid RAG systems weight exact lexical/title matches heavily so a semantically
  // plausible vector hit cannot outrank the note the user explicitly named.
  const titleTerms = tokenize(note.title);
  const titleMatches = titleTerms.filter((term) => normalizedQuery.includes(term)).length;
  if (titleTerms.length > 0) score += titleMatchRatio(note, query) * queryTerms.length * 6;
  if (normalizedQuery.includes(title)) score += queryTerms.length * 4;

  return score / Math.max(1, queryTerms.length * 4);
}

export function buildNoteMemoryContext(input: {
  notes: NoteRecord[];
  folders: FolderRecord[];
  query: string;
  topK?: number;
  vectorMatches?: VectorMatch[];
  relationReviews?: GraphRelationReviewMap;
}): NoteMemoryContext {
  const topK = input.topK ?? 5;
  const noteById = new Map(input.notes.map((note) => [note.id, note]));
  const queryTerms = tokenize(input.query);
  const ranked = new Map<string, { note: NoteRecord; score: number; content: string }>();

  for (const match of input.vectorMatches ?? []) {
    const note = noteById.get(match.noteId);
    if (!note) continue;
    ranked.set(note.id, {
      note,
      score: Math.max(ranked.get(note.id)?.score ?? 0, match.score * 0.55),
      content: match.chunkText,
    });
  }

  for (const note of input.notes) {
    const lexicalScore = scoreNote(note, input.query, queryTerms);
    if (lexicalScore <= 0) continue;
    const existing = ranked.get(note.id);
    const combinedScore = (existing?.score ?? 0) + lexicalScore;
    if (!existing || combinedScore > existing.score) {
      const shouldUseLexicalExcerpt = !existing || lexicalScore >= existing.score;
      ranked.set(note.id, {
        note,
        score: combinedScore,
        content: shouldUseLexicalExcerpt ? extractRelevantExcerpt(note.content, input.query, 1800) : existing.content,
      });
    }
  }

  const sorted = Array.from(ranked.values())
    .sort((a, b) => b.score - a.score || b.note.dateModified - a.note.dateModified);
  const namedFocus = sorted.find((item) => titleMatchRatio(item.note, input.query) >= 0.45);
  const selected = namedFocus ? [namedFocus] : sorted.slice(0, topK);

  const graphEvidence = retrieveGraphMemory({
    notes: input.notes,
    folders: input.folders,
    query: input.query,
    seedNoteIds: selected.map((item) => item.note.id),
    limit: Math.max(3, topK),
    relationReviews: input.relationReviews,
  });

  const graphNoteIds = new Set(graphEvidence.flatMap((item) => item.sourceNoteIds));
  for (const noteId of graphNoteIds) {
    if (selected.length >= topK) break;
    if (selected.some((item) => item.note.id === noteId)) continue;
    const note = noteById.get(noteId);
    if (!note) continue;
    selected.push({ note, score: 0.35, content: extractRelevantExcerpt(note.content, input.query, 1200) });
  }

  const graphContext = formatGraphEvidence(graphEvidence);
  const contextNotes = selected.map((item) => ({
    title: item.note.title,
    content: item.content,
    relevanceScore: item.score,
  }));
  const messages = buildRAGMessages(input.query, contextNotes, undefined, graphContext);
  const userMessage = messages[messages.length - 1];
  userMessage.content += '\n\nRecall instruction: I remember this because of these notes and graph edges. If the notes and edges do not contain enough evidence, say so.';
  if (/\b(risk|risks|watch|watchout|watch-out|concern|concerns|next week|next steps?)\b/i.test(input.query)) {
    userMessage.content += '\nRisk-analysis instruction: infer 3-5 concrete watchouts from the note evidence. Do not require the word "risk" to appear. Look for uncertainty, duplication, unclear definitions, evaluation gaps, ownership gaps, blockers, or follow-up work. Start with "Watch these risks:" and cite the source note title.';
  }

  const noteCitations = selected.map((item) => noteCitation(item.note, item.score, item.content));
  const graphCitations = graphEvidence.map((item) =>
    graphEdgeCitation(
      item.relation,
      `${item.from.name} ${item.relation.type} ${item.to.name}`,
      item.score,
      item.sourceNoteIds[0]
    )
  );

  return {
    messages,
    citations: [...noteCitations, ...graphCitations],
    graphEvidence,
    retrievalMode: 'notes-graph',
    usedWikiContext: false,
    coverage: {
      noteCount: selected.length,
      graphEdgeCount: graphEvidence.length,
      hasEvidence: selected.length > 0 || graphEvidence.length > 0,
    },
  };
}
