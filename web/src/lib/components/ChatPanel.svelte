<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { ragConfig } from '$lib/stores/rag';
	import { notes, selectedNote, selectedNoteId } from '$lib/stores/notes';
	import { selectedFolderId } from '$lib/stores/folders';
	import { buildRAGMessages, extractRelevantExcerpt, type ChatHistoryEntry } from '$lib/vector/ragPipeline';
	import { proxyQueryOllama, proxyCheckHealth } from '$lib/llm/ollamaProxy';
	import { TraceLogger } from '$lib/graph/traceLogger';
	import { searchNotes, vectorStoreReady } from '$lib/vector/vectorStoreManager';
	import { getGraphBoosts, applyGraphBoosts, getGraphContext } from '$lib/graph/graphRetriever';
	import { rerankResults } from '$lib/vector/reranker';
	import { createSpeechRecognition } from '$lib/voice/speechRecognition';
	import { speak, stopSpeaking, isSpeaking } from '$lib/voice/speechSynthesis';
	import { loadVoicePreferences } from '$lib/voice/voicePreferences';
	import { db, type ChatMessageRecord } from '$lib/db/index';
	import AssistantAvatar from './AssistantAvatar.svelte';

	/**
	 * Score a note's relevance to a query using keyword overlap.
	 * Returns a 0–1 score based on the fraction of query terms found in the note.
	 */
	function scoreNote(query: string, title: string, content: string): number {
		const queryTerms = query
			.toLowerCase()
			.split(/\s+/)
			.filter((t) => t.length > 2); // skip tiny words
		if (queryTerms.length === 0) return 0;

		const text = `${title} ${content}`.toLowerCase();
		let matches = 0;
		for (const term of queryTerms) {
			if (text.includes(term)) matches++;
		}
		return matches / queryTerms.length;
	}

	interface Source {
		noteId: string;
		title: string;
		relevanceScore: number;
	}

	interface Message {
		role: 'user' | 'assistant';
		text: string;
		sources?: Source[];
	}

	let { onSourceClick = (_noteId: string) => {} }: { onSourceClick?: (noteId: string) => void } =
		$props();

	let messages = $state<Message[]>([]);
	let inputText = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isListening = $state(false);
	let abortController: AbortController | null = null;
	let messagesEndEl: HTMLDivElement;
	let scrollContainerEl: HTMLDivElement;

	// Speech recognition
	let speechRec: ReturnType<typeof createSpeechRecognition> | null = null;

	// Track current noteId for chat persistence
	let currentChatNoteId: string | null = null;

	/** Load persisted chat messages for the current note context. */
	async function loadChatHistory() {
		const noteId = get(selectedNoteId);
		currentChatNoteId = noteId;
		try {
			const records = await db.chatMessages
				.where('noteId')
				.equals(noteId ?? '__global__')
				.sortBy('timestamp');
			messages = records.map((r) => ({
				role: r.role,
				text: r.content,
				sources: r.sources,
			}));
		} catch {
			messages = [];
		}
	}

	/** Persist a single message to IndexedDB. */
	async function persistMessage(msg: Message) {
		const noteId = currentChatNoteId ?? '__global__';
		const record: ChatMessageRecord = {
			id: uuidv4(),
			noteId,
			role: msg.role,
			content: msg.text,
			sources: msg.sources,
			timestamp: Date.now(),
		};
		try {
			await db.chatMessages.put(record);
		} catch {
			// IndexedDB not available
		}
	}

	/** Clear conversation for the current note context. */
	async function clearConversation() {
		const noteId = currentChatNoteId ?? '__global__';
		try {
			await db.chatMessages.where('noteId').equals(noteId).delete();
		} catch {}
		messages = [];
		error = null;
	}

	onMount(() => {
		loadChatHistory();
	});

	// Reload chat when selected note changes
	$effect(() => {
		const noteId = $selectedNoteId;
		if (noteId !== currentChatNoteId) {
			loadChatHistory();
		}
	});

	let speakingMsgIdx = $state<number | null>(null);

	function handleSpeak(text: string, msgIdx: number) {
		if (isSpeaking()) {
			stopSpeaking();
			speakingMsgIdx = null;
			return;
		}
		const prefs = loadVoicePreferences();
		const voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
		const voice = prefs.voiceName ? voices.find((v) => v.name === prefs.voiceName) ?? null : null;
		const utterance = speak(text, {
			voice,
			rate: prefs.speechRate,
			pitch: prefs.speechPitch,
		});
		speakingMsgIdx = msgIdx;
		utterance.onend = () => { speakingMsgIdx = null; };
		utterance.onerror = () => { speakingMsgIdx = null; };
	}

	function scrollToBottom() {
		if (scrollContainerEl) {
			scrollContainerEl.scrollTop = scrollContainerEl.scrollHeight;
		}
	}

	async function handleSubmit() {
		const query = inputText.trim();
		if (!query || isLoading) return;

		inputText = '';
		error = null;
		const userMsg: Message = { role: 'user', text: query };
		messages = [...messages, userMsg];
		persistMessage(userMsg);
		isLoading = true;
		scrollToBottom();

		const config = get(ragConfig);
		const tracer = new TraceLogger('query');

		// Check Ollama health
		const healthy = await proxyCheckHealth(config.ollamaUrl);
		if (!healthy) {
			error = 'Ollama not reachable. Make sure it is running.';
			isLoading = false;
			return;
		}

		// Find relevant notes — semantic search if ready, keyword fallback otherwise
		const topK = config.topK || 5;
		let contextNotes: Array<{ title: string; content: string }>;
		let sources: Source[];
		let graphContextStr = '';

		if (get(vectorStoreReady)) {
			const currentFolderId = get(selectedFolderId);
			tracer.beginStage('vector_search', { query, topK });
			const semanticResults = await searchNotes(query, topK, currentFolderId);
			for (const r of semanticResults) {
				tracer.addDecision({ action: 'accepted', subject: r.title, reason: `Semantic similarity score ${(r.score * 100).toFixed(0)}%${currentFolderId ? ' (filtered to current folder)' : ''}`, confidence: r.score });
			}
			if (semanticResults.length === 0) {
				tracer.addDecision({ action: 'rejected', subject: 'All notes', reason: `No notes matched query "${query.slice(0, 50)}" above similarity threshold${currentFolderId ? ' in current folder' : ''}` });
			}
			tracer.endStage({ resultCount: semanticResults.length });

			// Apply knowledge graph boosts to expand and re-rank results
			tracer.beginStage('graph_boost', { vectorResultCount: semanticResults.length });
			const vectorNoteIds = semanticResults.map((r) => r.noteId);
			const graphBoosts = await getGraphBoosts(query, vectorNoteIds, currentFolderId);
			const graphBoosted = applyGraphBoosts(semanticResults, graphBoosts);
			for (const boost of graphBoosts) {
				tracer.addDecision({ action: 'accepted', subject: boost.noteId, reason: `Knowledge graph boost: connected to search results via entity relationships (boost ${(boost.boost * 100).toFixed(0)}%)`, confidence: boost.boost });
			}
			tracer.endStage({ boostCount: graphBoosts.length, boostedResultCount: graphBoosted.length });

			// Extract knowledge graph context for the prompt
			graphContextStr = await getGraphContext(query, graphBoosted.map((r) => r.noteId));

			// Cross-encoder reranking for precision (falls back gracefully if unavailable)
			tracer.beginStage('rerank', { inputCount: graphBoosted.length });
			const boostedResults = await rerankResults(query, graphBoosted);
			tracer.endStage({ outputCount: boostedResults.length });

			// Vector search returns chunks, but we want the full note content
			// so the model has complete context. Look up each note by ID.
			const allNotes = get(notes);
			const noteById = new Map(allNotes.map((n) => [n.id, n]));

			// Score each result by title match to query terms
			const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
			const scored = boostedResults.map((r) => {
				const titleLower = r.title.toLowerCase();
				const titleHits = queryWords.filter((w) => titleLower.includes(w)).length;
				return { ...r, titleHits };
			});
			scored.sort((a, b) => b.titleHits - a.titleHits || b.score - a.score);

			// If the top result's title matches the query significantly better
			// than the rest, focus on just that note (gives the model more context
			// and avoids confusion from unrelated notes).
			tracer.beginStage('note_selection', { candidateCount: scored.length });
			const best = scored[0];
			let focused: typeof scored;
			if (best && best.titleHits > 0 && scored.every((s, i) => i === 0 || s.titleHits < best.titleHits)) {
				focused = [best];
				tracer.addDecision({ action: 'accepted', subject: best.title, reason: `Title matches ${best.titleHits}/${queryWords.length} query terms — significantly better than other results, focusing on this note only`, confidence: best.score });
				for (const s of scored.slice(1)) {
					tracer.addDecision({ action: 'rejected', subject: s.title, reason: `Only ${s.titleHits}/${queryWords.length} title term matches vs ${best.titleHits} for top result — excluded to avoid diluting context` });
				}
			} else {
				focused = scored;
				for (const s of scored) {
					tracer.addDecision({ action: 'accepted', subject: s.title, reason: `${s.titleHits}/${queryWords.length} title term matches, similarity ${(s.score * 100).toFixed(0)}% — included in context`, confidence: s.score });
				}
			}

			const CONTEXT_BUDGET = 10000;
			const perNote = Math.floor(CONTEXT_BUDGET / Math.max(focused.length, 1));

			contextNotes = focused.map((r) => {
				const fullNote = noteById.get(r.noteId);
				let content = fullNote ? fullNote.content : r.chunkText;
				if (content.length > perNote) {
					content = extractRelevantExcerpt(content, query, perNote);
				}
				return { title: r.title, content };
			});
			sources = focused.map((r) => ({
				noteId: r.noteId,
				title: r.title,
				relevanceScore: r.score,
			}));
			tracer.endStage({ selectedCount: focused.length, contextBudget: CONTEXT_BUDGET });
		} else {
			// Keyword fallback while embeddings model loads
			tracer.beginStage('keyword_fallback', { query, reason: 'Vector store not ready — using keyword matching' });
			const allNotes = get(notes);
			const scored = allNotes
				.map((n) => ({ note: n, score: scoreNote(query, n.title, n.content) }))
				.filter((s) => s.score > 0)
				.sort((a, b) => b.score - a.score)
				.slice(0, topK);

			for (const s of scored) {
				tracer.addDecision({ action: 'accepted', subject: s.note.title, reason: `Keyword overlap ${(s.score * 100).toFixed(0)}% of query terms found in title+content`, confidence: s.score });
			}
			if (scored.length === 0) {
				tracer.addDecision({ action: 'rejected', subject: 'All notes', reason: 'No notes contain any query keywords' });
			}

			contextNotes = scored.map((s) => ({
				title: s.note.title,
				content: s.note.content.length > 2000
					? extractRelevantExcerpt(s.note.content, query, 2000)
					: s.note.content,
			}));
			sources = scored.map((s) => ({
				noteId: s.note.id,
				title: s.note.title,
				relevanceScore: s.score,
			}));
			tracer.endStage({ resultCount: scored.length });
		}

		// Title-match injection: if a note's title is substantially contained
		// in the query (or vice versa), make sure it's in the results even if
		// vector search missed it (e.g. note not yet indexed, or embedding
		// similarity was low despite an exact title match).
		// When found, use ONLY that note so the LLM focuses on the right content.
		tracer.beginStage('title_match', { query });
		const allNotesForTitleMatch = get(notes);
		const queryLower = query.toLowerCase();
		const strippedQuery = queryLower.replace(/^(summarize|summarise|explain|describe|recap|review|tell me about|what is|what are|who is|what did|what was)\s+(the\s+)?(discussion\s+)?(in\s+)?/i, '').trim();
		let titleMatchNote: (typeof allNotesForTitleMatch)[0] | null = null;
		for (const note of allNotesForTitleMatch) {
			const titleLower = note.title.toLowerCase();
			if (titleLower.length < 4) continue;
			if (queryLower.includes(titleLower) || titleLower.includes(strippedQuery)) {
				titleMatchNote = note;
				break;
			}
		}
		if (titleMatchNote) {
			const MAX_INJECTED_CHARS = 10000;
			const content = titleMatchNote.content.length > MAX_INJECTED_CHARS
				? extractRelevantExcerpt(titleMatchNote.content, query, MAX_INJECTED_CHARS)
				: titleMatchNote.content;
			tracer.addDecision({ action: 'accepted', subject: titleMatchNote.title, reason: `Query references this note by title — overriding search results to focus on this note (${titleMatchNote.content.length} chars)` });
			contextNotes = [{ title: titleMatchNote.title, content }];
			sources = [{ noteId: titleMatchNote.id, title: titleMatchNote.title, relevanceScore: 1 }];
		} else {
			tracer.addDecision({ action: 'rejected', subject: 'Title match', reason: 'No note title found in query text — using search results as-is' });
		}
		tracer.endStage({ matched: !!titleMatchNote });

		// If the query explicitly refers to "this note" or "current note",
		// ensure the selected note is included in context (but don't override search results).
		const current = get(selectedNote);
		const implicitReference = /\b(this note|current note)\b/i.test(query);

		if (current && implicitReference) {
			const alreadyIncluded = sources.some((s) => s.noteId === current.id);
			if (!alreadyIncluded) {
				const MAX_SELECTED_CHARS = 6000;
				const content = current.content.length > MAX_SELECTED_CHARS
					? extractRelevantExcerpt(current.content, query, MAX_SELECTED_CHARS)
					: current.content;
				tracer.beginStage('implicit_reference', {});
				tracer.addDecision({ action: 'accepted', subject: current.title, reason: `Query references "this note" — adding selected note to context` });
				tracer.endStage({});
				contextNotes.unshift({ title: current.title, content });
				sources.unshift({ noteId: current.id, title: current.title, relevanceScore: 1 });
			}
		}

		// Add empty assistant message for streaming
		messages = [...messages, { role: 'assistant' as const, text: '', sources }];
		const assistantIdx = messages.length - 1;

		try {
			tracer.beginStage('llm_generation', { sourceCount: sources.length, model: config.model });
			// Total timeout: auto-cancel after 120s so the UI never hangs indefinitely.
			const timeoutSignal = AbortSignal.timeout(120_000);
			abortController = new AbortController();
			const combinedSignal = AbortSignal.any([abortController.signal, timeoutSignal]);

			// Build chat history for multi-turn context (last 3 exchanges, excluding current)
			const priorMessages = messages.slice(0, -1); // exclude the empty assistant msg we just added
			// Drop the immediately preceding exchange if the user is retrying the
			// same question — the previous (wrong) answer would poison the model.
			let historyMessages = priorMessages.filter((m) => m.text);
			if (historyMessages.length >= 2) {
				const lastUserIdx = historyMessages.findLastIndex((m) => m.role === 'user');
				if (lastUserIdx >= 1) {
					const prevUserMsg = historyMessages[lastUserIdx - (historyMessages[lastUserIdx - 1]?.role === 'assistant' ? 2 : 1)];
					if (prevUserMsg && prevUserMsg.role === 'user' && prevUserMsg.text.trim().toLowerCase() === query.trim().toLowerCase()) {
						// Same question asked again — drop the failed Q&A pair
						historyMessages = historyMessages.slice(0, lastUserIdx - (historyMessages[lastUserIdx - 1]?.role === 'assistant' ? 2 : 1));
					}
				}
			}
			const chatHistory: ChatHistoryEntry[] = historyMessages
				.slice(-6) // last 3 Q&A pairs
				.map((m) => ({ role: m.role, text: m.text }));

			// Collect note summaries for broader context
			const allNotesForSummaries = get(notes);
			const summaryNoteMap = new Map(allNotesForSummaries.map((n) => [n.title, n.summary]));
			const noteSummaries = sources
				.map((s) => {
					const summary = summaryNoteMap.get(s.title);
					return summary ? { title: s.title, summary } : null;
				})
				.filter((s): s is { title: string; summary: string } => s !== null);

			const messages_to_send = buildRAGMessages(query, contextNotes, chatHistory, graphContextStr, noteSummaries.length > 0 ? noteSummaries : undefined);
			for await (const token of proxyQueryOllama(messages_to_send, config, combinedSignal)) {
				// Mutate through the reactive $state array so Svelte 5 tracks the change
				messages[assistantIdx].text += token;
				scrollToBottom();
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				// User stopped generation — keep partial response
			} else {
				let msg = err instanceof Error ? err.message : 'Failed to query Ollama';
				if (msg.includes('stalled') || msg.includes('TimeoutError') || msg.includes('timed out')) {
					msg = 'Response timed out. Ollama may be overloaded or the model is too slow for this query.';
				}
				error = msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
				// Remove the empty assistant message on error
				if (messages[assistantIdx].text === '') {
					messages = messages.slice(0, -1);
				}
			}
		} finally {
			tracer.endStage({ responseLength: messages[assistantIdx]?.text?.length ?? 0 });
			tracer.finalize(`Query: "${query.slice(0, 50)}" — ${sources.length} sources`).catch(() => {});
			abortController = null;
			isLoading = false;
			scrollToBottom();
			// Persist assistant response
			const assistantMsg = messages[assistantIdx];
			if (assistantMsg && assistantMsg.text) {
				persistMessage(assistantMsg);
			}
		}
	}

	function handleStop() {
		abortController?.abort();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function toggleMic() {
		if (!speechRec) {
			speechRec = createSpeechRecognition({ continuous: false, interimResults: true });
		}

		if (!speechRec.isSupported()) {
			error = 'Speech recognition is not supported in this browser.';
			return;
		}

		if (isListening) {
			speechRec.stop();
			isListening = false;
		} else {
			speechRec.start();
			isListening = true;

			// Poll for results (the API uses mutable state)
			const interval = setInterval(() => {
				if (!speechRec) {
					clearInterval(interval);
					return;
				}
				const { state } = speechRec;

				if (state.transcript) {
					inputText = state.transcript;
					state.transcript = '';
					isListening = false;
					clearInterval(interval);
					handleSubmit();
				}

				if (state.error || !state.isListening) {
					isListening = false;
					clearInterval(interval);
				}
			}, 100);
		}
	}
</script>

<div class="flex h-full flex-col bg-white dark:bg-gray-900" data-testid="chat-panel">
	<!-- Header -->
	<div
		class="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700"
	>
		<div class="flex items-center gap-2">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4 text-indigo-500"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
				/>
			</svg>
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Chat</span>
		</div>
		{#if messages.length > 0}
			<button
				type="button"
				class="text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
				onclick={clearConversation}
				title="Clear conversation"
			>
				Clear
			</button>
		{/if}
	</div>

	<!-- Messages area -->
	<div bind:this={scrollContainerEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center" data-testid="empty-state">
				<p class="text-sm text-gray-400 dark:text-gray-500">
					Ask a question about your notes
				</p>
			</div>
		{/if}

		{#each messages as msg}
			{#if msg.role === 'user'}
				<div class="flex justify-end" data-testid="user-message">
					<div
						class="max-w-[80%] rounded-lg bg-indigo-500 px-3 py-2 text-sm text-white"
					>
						{msg.text}
					</div>
				</div>
			{:else}
				<div class="flex items-start gap-2" data-testid="assistant-message">
					<div class="mt-1 flex-shrink-0" style="width: 32px; height: 32px;">
						<AssistantAvatar state={isLoading && msg === messages[messages.length - 1] ? 'thinking' : 'idle'} />
					</div>
					<div class="min-w-0 flex-1">
						<div
							class="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200"
						>
							{#if msg.text}
								<span class="whitespace-pre-wrap">{msg.text}</span>
							{:else}
								<!-- Thinking dots -->
								<span class="inline-flex gap-1">
									<span class="thinking-dot"></span>
									<span class="thinking-dot"></span>
									<span class="thinking-dot"></span>
								</span>
							{/if}
						</div>

						<!-- Read aloud button -->
						{#if msg.text && !isLoading}
							<button
								type="button"
								class="mt-1 inline-flex items-center gap-1 text-xs transition-colors {speakingMsgIdx === messages.indexOf(msg)
									? 'text-indigo-600 dark:text-indigo-400'
									: 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}"
								onclick={() => handleSpeak(msg.text, messages.indexOf(msg))}
								title={speakingMsgIdx === messages.indexOf(msg) ? 'Stop reading' : 'Read aloud'}
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
								</svg>
								{speakingMsgIdx === messages.indexOf(msg) ? 'Stop' : 'Read aloud'}
							</button>
						{/if}

						<!-- Source chips -->
						{#if msg.sources && msg.sources.length > 0}
							<div class="mt-1 flex flex-wrap gap-1">
								{#each msg.sources as source}
									<button
										class="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
										onclick={() => onSourceClick(source.noteId)}
										title="Relevance: {(source.relevanceScore * 100).toFixed(0)}%"
									>
										{source.title}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}

		{#if isLoading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant')}
			<div class="flex items-start gap-2">
				<div class="mt-1 flex-shrink-0" style="width: 32px; height: 32px;">
					<AssistantAvatar state="thinking" />
				</div>
				<div class="rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
					<span class="inline-flex gap-1">
						<span class="thinking-dot"></span>
						<span class="thinking-dot"></span>
						<span class="thinking-dot"></span>
					</span>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
				{error}
			</div>
		{/if}

		<div bind:this={messagesEndEl}></div>
	</div>

	<!-- Input bar -->
	<div class="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
		<div class="flex items-center gap-2">
			<input
				type="text"
				bind:value={inputText}
				onkeydown={handleKeydown}
				placeholder="Ask about your notes..."
				class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
				disabled={isLoading}
				data-testid="chat-input"
			/>

			<!-- Mic button -->
			<button
				type="button"
				class="rounded-lg p-2 transition-colors {isListening
					? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
					: 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}"
				onclick={toggleMic}
				aria-label={isListening ? 'Stop listening' : 'Start voice input'}
				disabled={isLoading}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z"
					/>
				</svg>
			</button>

			<!-- Send / Stop button -->
			{#if isLoading}
				<button
					type="button"
					class="rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
					onclick={handleStop}
					aria-label="Stop generating"
					data-testid="stop-button"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<rect x="6" y="6" width="12" height="12" rx="2" />
					</svg>
				</button>
			{:else}
				<button
					type="button"
					class="rounded-lg bg-indigo-500 p-2 text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
					onclick={handleSubmit}
					disabled={!inputText.trim()}
					aria-label="Send message"
					data-testid="send-button"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.thinking-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: #6366f1;
		animation: thinking-bounce 1.2s ease-in-out infinite;
		display: inline-block;
	}
	.thinking-dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	.thinking-dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes thinking-bounce {
		0%,
		80%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
