<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { ragConfig } from '$lib/stores/rag';
	import { notes, selectedNote } from '$lib/stores/notes';
	import { synthesizeAnswerFromMemory } from '$lib/memory/answerSynthesizer';
	import { createSpeechRecognition } from '$lib/voice/speechRecognition';
	import { speak, stopSpeaking, isSpeaking } from '$lib/voice/speechSynthesis';
	import { loadVoicePreferences } from '$lib/voice/voicePreferences';
	import { db, type ChatMessageRecord } from '$lib/db/index';
	import AssistantAvatar from './AssistantAvatar.svelte';
	import FileAnswerPanel from './FileAnswerPanel.svelte';

	interface Source {
		id?: string;
		noteId: string;
		title: string;
		relevanceScore: number;
		kind?: 'wiki-page' | 'raw-source' | 'note' | 'note-chunk' | 'graph-edge' | 'wiki';
		wikiPath?: string;
	}

	type ChatCoverage = 'strong' | 'weak' | { noteCount: number; graphEdgeCount: number; hasEvidence: boolean };

	interface Message {
		role: 'user' | 'assistant';
		text: string;
		sources?: Source[];
		coverage?: ChatCoverage;
		usedRawFallback?: boolean;
	}

	let { onSourceClick = (_noteId: string) => {} }: { onSourceClick?: (noteId: string) => void } =
		$props();

	let messages = $state<Message[]>([]);
	let inputText = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isListening = $state(false);
	let abortController: AbortController | null = null;
	let includeExperimentalWiki = $state(false);
	let messagesEndEl: HTMLDivElement;
	let scrollContainerEl: HTMLDivElement;

	// Speech recognition
	let speechRec: ReturnType<typeof createSpeechRecognition> | null = null;

	const GLOBAL_CHAT_NOTE_ID = '__global__';

	function isTransientAssistantText(text: string): boolean {
		const normalized = text.trim();
		return normalized === ''
			|| normalized === 'Searching your notes and graph…'
			|| normalized === 'Searching your notes and graph...'
			|| normalized.startsWith('Still waiting for the chat stream to start')
			|| normalized === 'I found relevant notes. Asking Ollama to reason over them…'
			|| normalized === 'I found relevant notes. Asking Ollama to reason over them...';
	}

	async function deleteTransientChatPlaceholders(records: ChatMessageRecord[]) {
		const transientIds = records
			.filter((record) => record.role === 'assistant' && isTransientAssistantText(record.content))
			.map((record) => record.id);
		if (transientIds.length === 0) return;
		try {
			await db.chatMessages.bulkDelete(transientIds);
		} catch {}
	}

	/** Load the single global chat history, independent of the open note. */
	async function loadChatHistory() {
		try {
			const records = await db.chatMessages
				.where('noteId')
				.equals(GLOBAL_CHAT_NOTE_ID)
				.sortBy('timestamp');
			await deleteTransientChatPlaceholders(records);
			messages = records
				.filter((r) => !(r.role === 'assistant' && isTransientAssistantText(r.content)))
				.map((r) => ({
					role: r.role,
					text: r.content,
					sources: r.sources,
					coverage: (r as ChatMessageRecord & { coverage?: ChatCoverage }).coverage,
					usedRawFallback: (r as ChatMessageRecord & { usedRawFallback?: boolean }).usedRawFallback,
				}));
		} catch {
			messages = [];
		}
	}

	/** Persist a single message to the global chat thread in IndexedDB. */
	async function persistMessage(msg: Message) {
		if (msg.role === 'assistant' && isTransientAssistantText(msg.text)) return;
		const record: ChatMessageRecord = {
			id: uuidv4(),
			noteId: GLOBAL_CHAT_NOTE_ID,
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

	/** Clear the global conversation. */
	async function clearConversation() {
		try {
			await db.chatMessages.where('noteId').equals(GLOBAL_CHAT_NOTE_ID).delete();
		} catch {}
		messages = [];
		error = null;
	}

	onMount(() => {
		loadChatHistory();
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

	function buildClientFastRecall(query: string): string {
		const selected = get(selectedNote);
		const candidates = selected ? [selected, ...get(notes).filter((note) => note.id !== selected.id)] : get(notes);
		const answer = synthesizeAnswerFromMemory({
			query,
			citations: candidates.map((note) => ({
				id: note.id,
				noteId: note.id,
				kind: 'note',
				title: note.title,
				relevanceScore: 0.5,
				excerpt: note.content,
			})),
		});
		return answer.confidence === 'high' ? answer.answer : '';
	}

	function previousUserQuestion(index: number): string {
		for (let i = index - 1; i >= 0; i--) {
			if (messages[i]?.role === 'user') return messages[i].text;
		}
		return '';
	}

	function memoryCoverageLabel(coverage: ChatCoverage | undefined): string | null {
		if (!coverage) return null;
		if (typeof coverage === 'string') return `Wiki coverage: ${coverage}`;
		return `Memory evidence: ${coverage.noteCount} ${coverage.noteCount === 1 ? 'note' : 'notes'} · ${coverage.graphEdgeCount} ${coverage.graphEdgeCount === 1 ? 'graph edge' : 'graph edges'}`;
	}

	function wikiCitations(sources: Source[] | undefined) {
		return (sources ?? [])
			.filter((source) => source.kind === 'wiki-page' || source.kind === 'raw-source')
			.map((source) => ({
				id: source.id ?? source.noteId,
				title: source.title,
				kind: source.kind as 'wiki-page' | 'raw-source',
				wikiPath: source.wikiPath ?? source.noteId,
				relevanceScore: source.relevanceScore,
			}));
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

		const instantRecall = buildClientFastRecall(query);
		messages = [...messages, { role: 'assistant', text: instantRecall, sources: [] }];
		let assistantIndex = messages.length - 1;
		scrollToBottom();

		function getAssistantMessage(): Message | null {
			return assistantIndex >= 0 ? messages[assistantIndex] ?? null : null;
		}

		function updateAssistantMessage(updater: (message: Message) => void) {
			const current = getAssistantMessage();
			if (!current) return;
			const next: Message = { ...current, sources: current.sources ? [...current.sources] : undefined };
			updater(next);
			messages = messages.map((message, index) => index === assistantIndex ? next : message);
		}

		const config = get(ragConfig);
		let startupWatchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
			const assistant = getAssistantMessage();
			if (assistant && isTransientAssistantText(assistant.text)) {
				updateAssistantMessage((message) => {
					message.text = 'Still waiting for the chat stream to start. If this stays here, Ollama or the dev server is not returning data.';
				});
				abortController?.abort(new Error('Chat stream did not start within 12 seconds'));
			}
		}, 12_000);

		try {
			// Default chat uses notes + graph memory. Generated wiki context is opt-in/experimental.
			const timeoutSignal = AbortSignal.timeout(120_000);
			abortController = new AbortController();
			const combinedSignal = AbortSignal.any([abortController.signal, timeoutSignal]);
			const response = await fetch('/api/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query,
					model: config.model,
					ollamaUrl: config.ollamaUrl,
					includeExperimentalWiki,
					stream: true,
				}),
				signal: combinedSignal,
			});
			if (!response.ok || !response.body) {
				const message = await response.text();
				throw new Error(message || `Query failed with ${response.status}`);
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			async function handleStreamLine(line: string) {
				if (!line.trim()) return;
				if (startupWatchdog) {
					clearTimeout(startupWatchdog);
					startupWatchdog = null;
				}
				const event = JSON.parse(line) as {
					type: 'meta' | 'token' | 'done' | 'error';
					token?: string;
					message?: string;
					sources?: Source[];
					citations?: Source[];
					coverage?: ChatCoverage;
					usedRawFallback?: boolean;
				};
				updateAssistantMessage((assistantMsg) => {
					if (event.type === 'meta') {
						assistantMsg.sources = event.citations ?? event.sources ?? [];
						assistantMsg.coverage = event.coverage;
						assistantMsg.usedRawFallback = event.usedRawFallback;
					} else if (event.type === 'token') {
						const token = event.token ?? '';
						if (isTransientAssistantText(assistantMsg.text) || assistantMsg.text.startsWith('Still waiting for the chat stream to start')) {
							assistantMsg.text = token;
						} else if (!(assistantMsg.text.trim() && token.trim() && assistantMsg.text.trim() === token.trim())) {
							assistantMsg.text += token;
						}
					} else if (event.type === 'error') {
						assistantMsg.text += event.message ?? 'Error querying Ollama';
					}
				});
				scrollToBottom();
			}

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) await handleStreamLine(line);
			}
			if (buffer.trim()) await handleStreamLine(buffer);
			const assistantMsg = getAssistantMessage();
			if (assistantMsg) persistMessage(assistantMsg);
		} catch (err) {
			if (!(err instanceof DOMException && err.name === 'AbortError')) {
				let msg = err instanceof Error ? err.message : 'Failed to query notes';
				if (msg.includes('stalled') || msg.includes('TimeoutError') || msg.includes('timed out')) {
					msg = 'Response timed out. Ollama may be overloaded or the model is too slow for this query.';
				}
				const visibleMsg = msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
				error = visibleMsg;
				const assistant = getAssistantMessage();
				if (assistant && isTransientAssistantText(assistant.text)) {
					updateAssistantMessage((message) => {
						message.text = `I could not finish the query: ${visibleMsg}`;
					});
				}
			}
		} finally {
			if (startupWatchdog) clearTimeout(startupWatchdog);
			const assistant = getAssistantMessage();
			if (assistant && isTransientAssistantText(assistant.text)) {
				updateAssistantMessage((message) => {
					message.text = 'The chat request ended before the server returned any answer. Check Ollama/server logs and try again.';
				});
			}
			abortController = null;
			isLoading = false;
			scrollToBottom();
		}
		return;
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

						<!-- Retrieval coverage state -->
						{#if memoryCoverageLabel(msg.coverage)}
							<div class="mt-1 text-xs text-gray-500 dark:text-gray-400" data-testid="retrieval-coverage-state">
								{memoryCoverageLabel(msg.coverage)}{typeof msg.coverage === 'string' && msg.usedRawFallback ? ' · raw-source fallback used' : ''}
							</div>
						{/if}

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
										{#if source.kind}
											<span class="mr-1 opacity-70">{source.kind}</span>
										{/if}
										{source.title}
									</button>
								{/each}
							</div>
						{/if}

						{#if msg.text && wikiCitations(msg.sources).length > 0}
							<FileAnswerPanel
								question={previousUserQuestion(messages.indexOf(msg))}
								answer={msg.text}
								citations={wikiCitations(msg.sources)}
								coverage={typeof msg.coverage === 'string' ? msg.coverage : 'weak'}
								usedRawFallback={msg.usedRawFallback ?? false}
							/>
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
		<div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
			<span>Memory: notes + graph</span>
			<label class="inline-flex items-center gap-1">
				<input type="checkbox" bind:checked={includeExperimentalWiki} disabled={isLoading} />
				Use experimental wiki context
			</label>
		</div>
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
