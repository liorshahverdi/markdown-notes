import { VectorStore } from './vectorStore';

export interface RAGResult {
  response: string;
  sourceNotes: Array<{ noteId: string; title: string; relevanceScore: number }>;
  isStreaming: boolean;
}

export interface RAGConfig {
  ollamaUrl: string;         // default 'http://localhost:11434'
  model: string;              // default 'llama3.2:3b'
  topK: number;               // default 5
  embeddingModel?: string;    // default 'nomic-embed-text'
}

export const MAX_PROMPT_CHARS = 100_000;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
  'been', 'has', 'had', 'have', 'do', 'did', 'does', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'shall', 'not', 'no',
  'what', 'when', 'where', 'who', 'which', 'how', 'why', 'that', 'this',
  'there', 'their', 'they', 'them', 'then', 'than', 'these', 'those',
  'its', 'his', 'her', 'our', 'your', 'all', 'any', 'some', 'such',
  'about', 'during', 'before', 'after', 'above', 'below', 'between',
  'into', 'through', 'out', 'up', 'down', 'over', 'under', 'again',
  'say', 'said', 'tell', 'told', 'ask', 'asked', 'get', 'got',
]);

/**
 * Extract the most relevant excerpt from content by scoring paragraphs
 * against the query and returning top-scoring ones up to maxChars.
 */
export function extractRelevantExcerpt(content: string, query: string, maxChars: number = 2000): string {
  if (content.length <= maxChars) return content;

  const allTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const queryTerms = allTerms.filter(t => !STOP_WORDS.has(t));
  // Fall back to all terms if stop-word filtering removed everything
  if (queryTerms.length === 0 && allTerms.length > 0) queryTerms.push(...allTerms);
  if (queryTerms.length === 0) return content.slice(0, maxChars);

  const broad = isBroadQuery(query);

  // Split into sections by markdown headers, falling back to paragraph splits
  const sections = splitIntoSections(content);

  const scored = sections.map(s => {
    const lower = s.text.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (lower.includes(term)) score++;
    }
    // Bonus for header matches (headers are strong relevance signals)
    if (s.header) {
      const headerLower = s.header.toLowerCase();
      for (const term of queryTerms) {
        if (headerLower.includes(term)) score += 2;
      }
    }
    return { text: s.text, header: s.header, score: score / queryTerms.length };
  });

  scored.sort((a, b) => b.score - a.score);

  // For broad queries, give the top section more budget so it can include
  // wider coverage; for focused queries, distribute more evenly.
  const relevantCount = scored.filter(s => s.score > 0).length || 1;
  const perSectionCap = broad
    ? Math.max(2000, Math.floor(maxChars * 0.7))   // top section gets up to 70%
    : Math.max(1000, Math.floor(maxChars / relevantCount));

  let result = '';
  let isFirst = true;
  for (const { text, header } of scored) {
    // Only the first (highest-scored) section gets the large cap for broad queries
    const cap = (broad && isFirst) ? perSectionCap : Math.max(1000, Math.floor(maxChars / relevantCount));
    isFirst = false;

    let excerpt = text;
    if (text.length > cap) {
      excerpt = extractParagraphsFromSection(text, header, queryTerms, cap, broad);
    }
    if (result.length + excerpt.length + 2 > maxChars) {
      const remaining = maxChars - result.length;
      if (remaining > 50) {
        result += excerpt.slice(0, remaining);
      }
      break;
    }
    result += (result ? '\n\n' : '') + excerpt;
  }

  return result;
}

/** Detect whether a query is broad (summary/overview) vs focused (specific entity). */
function isBroadQuery(query: string): boolean {
  const broad = /\b(summarize|summary|summarise|overview|recap|all|everyone|everything|describe|what happened|what was discussed)\b/i;
  return broad.test(query);
}

/**
 * Extract the most query-relevant paragraphs from a large section.
 * Keeps the header, then fills budget with paragraphs selected by strategy:
 *  - Broad queries (summaries): evenly sample across the section for coverage
 *  - Focused queries (specific person/topic): prioritise highest-scoring paragraphs
 */
function extractParagraphsFromSection(
  sectionText: string,
  header: string | null,
  queryTerms: string[],
  maxChars: number,
  broad: boolean
): string {
  // Split the section body into paragraphs (separated by blank lines)
  const paragraphs = sectionText.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length <= 1) return sectionText.slice(0, maxChars);

  // Always include the header paragraph if present
  let result = '';
  const headerPara = header ? paragraphs.find(p => p.includes(header)) : null;
  if (headerPara) {
    result = headerPara;
  }

  const remaining = paragraphs.filter(p => p !== headerPara).map(p => ({ text: p }));

  let ordered: Array<{ text: string }>;

  if (broad) {
    // Even sampling: take paragraphs at regular intervals across the section
    // so every speaker / topic gets representation
    ordered = evenSample(remaining, maxChars - result.length);
  } else {
    // Focused: score by query term matches, take highest-scoring
    ordered = remaining
      .map(p => {
        const lower = p.text.toLowerCase();
        let matches = 0;
        for (const term of queryTerms) {
          if (lower.indexOf(term) !== -1) matches++;
        }
        return { text: p.text, score: matches };
      })
      .sort((a, b) => b.score - a.score);
  }

  for (const { text } of ordered) {
    if (result.length + text.length + 2 > maxChars) {
      const rem = maxChars - result.length;
      if (rem > 50) {
        result += '\n\n' + text.slice(0, rem) + '\n...(trimmed)';
      }
      break;
    }
    result += (result ? '\n\n' : '') + text;
  }

  return result;
}

/**
 * Select paragraphs at even intervals across the array so the excerpt
 * covers the beginning, middle, and end of a long section.
 */
function evenSample(
  paragraphs: Array<{ text: string }>,
  budget: number
): Array<{ text: string }> {
  if (paragraphs.length === 0) return [];

  // Estimate how many paragraphs we can fit
  const avgLen = paragraphs.reduce((s, p) => s + p.text.length, 0) / paragraphs.length;
  const targetCount = Math.max(1, Math.floor(budget / (avgLen + 2)));

  if (targetCount >= paragraphs.length) return paragraphs;

  const step = paragraphs.length / targetCount;
  const sampled: Array<{ text: string }> = [];
  for (let i = 0; i < targetCount; i++) {
    sampled.push(paragraphs[Math.floor(i * step)]);
  }
  return sampled;
}

/** Split content into sections by markdown headers. Each section includes its header and body. */
function splitIntoSections(content: string): Array<{ header: string | null; text: string }> {
  const lines = content.split('\n');
  const sections: Array<{ header: string | null; text: string }> = [];
  let currentHeader: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      // Flush previous section
      if (currentLines.length > 0) {
        sections.push({ header: currentHeader, text: currentLines.join('\n').trim() });
      }
      currentHeader = line;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  // Flush last section
  if (currentLines.length > 0) {
    sections.push({ header: currentHeader, text: currentLines.join('\n').trim() });
  }

  // If no headers found, fall back to paragraph splitting
  if (sections.length <= 1) {
    return content.split(/\n\n+/).filter(p => p.trim().length > 0).map(p => ({ header: null, text: p }));
  }

  return sections.filter(s => s.text.length > 0);
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const RAG_SYSTEM_PROMPT = `You are a helpful assistant for a personal notes app. Relevant notes from the user's collection are included below their question. Answer using the provided note content and cite which note(s) the information comes from.`;

/**
 * Build a messages array for the /api/chat endpoint.
 * Returns ChatMessage[] with system prompt, chat history, and user query + context.
 */
export function buildRAGMessages(
  query: string,
  contextNotes: Array<{ title: string; content: string; relevanceScore?: number }>,
  chatHistory?: ChatHistoryEntry[],
  graphContext?: string,
  noteSummaries?: Array<{ title: string; summary: string }>
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // System message
  messages.push({ role: 'system', content: RAG_SYSTEM_PROMPT });

  // Chat history as user/assistant pairs
  if (chatHistory && chatHistory.length > 0) {
    const recent = chatHistory.slice(-6); // last 3 Q&A pairs
    for (const entry of recent) {
      messages.push({
        role: entry.role,
        content: entry.role === 'assistant' ? entry.text.slice(0, 500) : entry.text,
      });
    }
  }

  // Build the user message with context
  let userContent = '';

  // Graph context (if available)
  if (graphContext) {
    userContent += graphContext + '\n\n';
  }

  // Note summaries (if available, gives LLM orientation)
  if (noteSummaries && noteSummaries.length > 0) {
    userContent += 'Note summaries:\n';
    for (const s of noteSummaries) {
      userContent += `- "${s.title}": ${s.summary}\n`;
    }
    userContent += '\n';
  }

  userContent += `Question: ${query}\n\nRelevant notes (most relevant last):\n`;
  const footer = '\n---\nAnswer based on the notes above.';
  const cap = MAX_PROMPT_CHARS - userContent.length - footer.length;

  // Check if all notes fit without any excerpting
  const totalRaw = contextNotes.reduce((s, n) => s + n.title.length + n.content.length + 20, 0);
  const needsExcerpting = totalRaw > cap;

  // Reverse order: put highest-relevance notes LAST, closest to the
  // instruction, to combat "lost in the middle" attention bias in LLMs.
  const reversed = [...contextNotes].reverse();

  // Pre-compute per-note budgets only if excerpting is needed
  let budgetMap: Map<number, number> | null = null;
  if (needsExcerpting) {
    const totalScore = contextNotes.reduce((s, n) => s + ((n.relevanceScore ?? 0.5) ** 2), 0) || 1;
    budgetMap = new Map();
    for (let i = 0; i < contextNotes.length; i++) {
      const weight = ((contextNotes[i].relevanceScore ?? 0.5) ** 2) / totalScore;
      budgetMap.set(i, Math.max(2000, Math.floor(cap * weight)));
    }
  }

  for (let ri = 0; ri < reversed.length; ri++) {
    const note = reversed[ri];
    const origIdx = contextNotes.length - 1 - ri;

    let noteContent: string;
    if (needsExcerpting) {
      const budget = budgetMap!.get(origIdx) ?? 2000;
      noteContent = extractRelevantExcerpt(note.content, query, budget);
    } else {
      noteContent = note.content;
    }

    const section = `---\nNote: ${note.title}\n${noteContent}\n`;
    if (userContent.length + section.length + footer.length > MAX_PROMPT_CHARS) {
      const remaining = MAX_PROMPT_CHARS - userContent.length - footer.length;
      if (remaining > 100) {
        userContent += section.slice(0, remaining) + '\n...(truncated)';
      }
      break;
    }
    userContent += section;
  }

  userContent += footer;
  messages.push({ role: 'user', content: userContent });

  return messages;
}

/** @deprecated Use buildRAGMessages instead */
export function buildRAGPrompt(
  query: string,
  contextNotes: Array<{ title: string; content: string; relevanceScore?: number }>,
  chatHistory?: ChatHistoryEntry[]
): string {
  const msgs = buildRAGMessages(query, contextNotes, chatHistory);
  // Flatten to a single string for backward compatibility
  return msgs.map(m => m.role === 'system' ? m.content : `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
}

/** Default timeout for the initial fetch (waiting for model load + first byte). */
const FETCH_TIMEOUT_MS = 30_000;
/** Default timeout between successive stream reads (stall detection). */
const READ_TIMEOUT_MS = 30_000;

export async function* queryOllama(
  messagesOrPrompt: ChatMessage[] | string,
  config: RAGConfig,
  signal?: AbortSignal,
  fetchTimeoutMs: number = FETCH_TIMEOUT_MS,
  readTimeoutMs: number = READ_TIMEOUT_MS
): AsyncGenerator<string> {
  // Use a manual AbortController so we can clear the fetch timeout once
  // the connection is established. AbortSignal.timeout would kill the entire
  // stream (including body reads) when it fires, even if tokens are flowing.
  const controller = new AbortController();
  const fetchTimer = setTimeout(() => controller.abort(new Error(`Ollama fetch timed out after ${fetchTimeoutMs / 1000} s`)), fetchTimeoutMs);
  // If the caller's signal fires, propagate to our controller.
  signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });

  // Support both messages array (new) and string prompt (legacy)
  const isMessages = Array.isArray(messagesOrPrompt);
  const endpoint = isMessages ? '/api/chat' : '/api/generate';
  const body = isMessages
    ? { model: config.model, messages: messagesOrPrompt, stream: true, keep_alive: -1 }
    : { model: config.model, prompt: messagesOrPrompt, stream: true, keep_alive: -1 };

  const response = await fetch(`${config.ollamaUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  // Connection established — clear the fetch timeout so it doesn't kill the stream.
  clearTimeout(fetchTimer);

  if (!response.ok || !response.body) {
    let detail = '';
    try { detail = await response.text(); } catch { /* ignore */ }
    throw new Error(`Ollama request failed: ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    // Per-read timeout: if no data arrives within READ_TIMEOUT_MS the stream
    // is considered stalled and we abort rather than hanging forever.
    const readResult = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        const id = setTimeout(() => reject(new Error(`Ollama stream stalled — no data received for ${readTimeoutMs / 1000} s`)), readTimeoutMs);
        // If the caller already aborted, clean up immediately.
        signal?.addEventListener('abort', () => { clearTimeout(id); reject(signal.reason); }, { once: true });
      }),
    ]);

    const { done, value } = readResult;
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        // /api/chat returns content in message.content, /api/generate returns in response
        const token = parsed.message?.content ?? parsed.response;
        if (token) {
          yield token;
        }
        if (parsed.done) return;
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function checkOllamaHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ragQuery(
  query: string,
  queryVector: number[],
  vectorStore: VectorStore,
  config: RAGConfig,
  noteTitleMap?: Map<string, string>
): Promise<RAGResult> {
  // 1. Search vectorStore for top-K chunks
  const searchResults = vectorStore.search(queryVector, config.topK);

  if (searchResults.length === 0) {
    return {
      response: 'No relevant notes found for your query.',
      sourceNotes: [],
      isStreaming: false,
    };
  }

  // 2. Deduplicate by noteId, keep highest score per note
  const noteMap = new Map<string, { noteId: string; chunkText: string; score: number }>();
  for (const result of searchResults) {
    const { noteId, chunkText } = result.entry;
    const existing = noteMap.get(noteId);
    if (!existing || result.score > existing.score) {
      noteMap.set(noteId, { noteId, chunkText, score: result.score });
    }
  }

  // 3. Build context from chunks — look up actual note titles when available
  const contextNotes = Array.from(noteMap.values()).map((n) => ({
    title: noteTitleMap?.get(n.noteId) ?? n.noteId,
    content: n.chunkText,
  }));

  const sourceNotes = Array.from(noteMap.values()).map((n) => ({
    noteId: n.noteId,
    title: noteTitleMap?.get(n.noteId) ?? n.noteId,
    relevanceScore: n.score,
  }));

  // 4. Build messages
  const messages = buildRAGMessages(query, contextNotes);

  // 5. Call Ollama and collect response
  try {
    let fullResponse = '';
    for await (const token of queryOllama(messages, config)) {
      fullResponse += token;
    }

    return {
      response: fullResponse,
      sourceNotes,
      isStreaming: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      response: `Error querying Ollama: ${message}`,
      sourceNotes,
      isStreaming: false,
    };
  }
}
