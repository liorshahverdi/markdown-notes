<script lang="ts">
	import { ragResponse, ragSources, ragLoading, ragError } from '$lib/stores/rag';
	import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, isSpeaking } from '$lib/voice/speechSynthesis';
	import { loadVoicePreferences } from '$lib/voice/voicePreferences';
	import AssistantAvatar from './AssistantAvatar.svelte';

	let {
		active = false,
		transcript = '',
		interimTranscript = '',
		onFollowUp = () => {},
		onClear = () => {},
		onSourceClick = (_noteId: string) => {},
	}: {
		active?: boolean;
		transcript?: string;
		interimTranscript?: string;
		onFollowUp?: () => void;
		onClear?: () => void;
		onSourceClick?: (noteId: string) => void;
	} = $props();

	let speaking = $state(false);
	let playbackSpeed = $state(1);

	let avatarState = $derived.by(() => {
		if ($ragLoading) return 'thinking' as const;
		if (speaking) return 'speaking' as const;
		if (interimTranscript || transcript) return 'listening' as const;
		return 'idle' as const;
	});

	function handleSpeak() {
		if (speaking) {
			stopSpeaking();
			speaking = false;
		} else if ($ragResponse) {
			const prefs = loadVoicePreferences();
			speak($ragResponse, { rate: playbackSpeed * prefs.speechRate, pitch: prefs.speechPitch });
			speaking = true;
		}
	}

	function handlePause() {
		if (isSpeaking()) {
			pauseSpeaking();
		} else {
			resumeSpeaking();
		}
	}

	function handleCopy() {
		if ($ragResponse) {
			navigator.clipboard.writeText($ragResponse);
		}
	}

	function handleClear() {
		stopSpeaking();
		speaking = false;
		onClear();
	}
</script>

{#if active}
	<div class="voice-panel" role="complementary" aria-label="Voice query panel">
		<div class="panel-content">
			<!-- Left: Avatar -->
			<div class="avatar-section">
				<AssistantAvatar state={avatarState} />
			</div>

			<!-- Right: Content sections -->
			<div class="content-section">
				<!-- 1. Transcription -->
				{#if interimTranscript || transcript}
					<div class="transcription">
						{#if transcript}
							<span class="final-text">{transcript}</span>
						{/if}
						{#if interimTranscript}
							<span class="interim-text">{interimTranscript}</span>
						{/if}
					</div>
				{/if}

				<!-- 2. Thinking indicator -->
				{#if $ragLoading}
					<div class="thinking" aria-label="Thinking">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				{/if}

				<!-- 3. Error -->
				{#if $ragError}
					<div class="error-msg">{$ragError}</div>
				{/if}

				<!-- 3. Response -->
				{#if $ragResponse}
					<div class="response">{$ragResponse}</div>
				{/if}

				<!-- 4. Source note chips -->
				{#if $ragSources.length > 0}
					<div class="sources">
						{#each $ragSources as source}
							<button
								class="source-chip"
								onclick={() => onSourceClick(source.noteId)}
								title="Relevance: {(source.relevanceScore * 100).toFixed(0)}%"
							>
								{source.title}
							</button>
						{/each}
					</div>
				{/if}

				<!-- 5. Playback bar -->
				{#if $ragResponse}
					<div class="playback-bar">
						<button class="playback-btn" onclick={handleSpeak} aria-label={speaking ? 'Stop' : 'Play'}>
							{#if speaking}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
									<rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
								</svg>
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
									<polygon points="5,3 19,12 5,21" />
								</svg>
							{/if}
						</button>
						<label class="speed-control">
							<span class="speed-label">{playbackSpeed}x</span>
							<input
								type="range"
								min="0.5"
								max="2"
								step="0.25"
								bind:value={playbackSpeed}
								aria-label="Playback speed"
							/>
						</label>
					</div>
				{/if}

				<!-- 6. Actions -->
				<div class="actions">
					<button class="action-btn" onclick={onFollowUp}>Ask follow-up</button>
					{#if $ragResponse}
						<button class="action-btn" onclick={handleCopy}>Copy response</button>
					{/if}
					<button class="action-btn action-clear" onclick={handleClear}>Clear</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.voice-panel {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--panel-bg, #ffffff);
		border-top: 1px solid var(--panel-border, #e5e7eb);
		box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
		animation: slide-up 0.3s ease-out;
		z-index: 50;
		max-height: 50vh;
		overflow-y: auto;
	}

	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.panel-content {
		display: flex;
		gap: 16px;
		padding: 16px 24px;
		max-width: 900px;
		margin: 0 auto;
	}

	.avatar-section {
		flex-shrink: 0;
		padding-top: 4px;
	}

	.content-section {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.transcription {
		font-size: 14px;
		line-height: 1.5;
	}

	.final-text {
		color: var(--text-primary, #111827);
	}

	.interim-text {
		color: var(--text-muted, #9ca3af);
		font-style: italic;
	}

	.thinking {
		display: flex;
		gap: 4px;
		align-items: center;
		padding: 4px 0;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--dot-color, #6366f1);
		animation: thinking-dots 1.2s ease-in-out infinite;
	}
	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes thinking-dots {
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

	.error-msg {
		color: #ef4444;
		font-size: 13px;
	}

	.response {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-primary, #111827);
		white-space: pre-wrap;
	}

	.sources {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.source-chip {
		display: inline-flex;
		align-items: center;
		padding: 2px 10px;
		font-size: 12px;
		border-radius: 9999px;
		border: 1px solid var(--chip-border, #d1d5db);
		background: var(--chip-bg, #f9fafb);
		color: var(--chip-color, #4b5563);
		cursor: pointer;
		transition: background 0.15s;
	}
	.source-chip:hover {
		background: var(--chip-hover-bg, #e5e7eb);
	}

	.playback-bar {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.playback-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--btn-border, #d1d5db);
		background: var(--btn-bg, #ffffff);
		color: var(--btn-color, #374151);
		cursor: pointer;
	}

	.speed-control {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted, #9ca3af);
	}

	.speed-label {
		min-width: 30px;
	}

	.speed-control input[type='range'] {
		width: 80px;
		height: 4px;
	}

	.actions {
		display: flex;
		gap: 8px;
		padding-top: 4px;
	}

	.action-btn {
		padding: 4px 12px;
		font-size: 12px;
		border-radius: 6px;
		border: 1px solid var(--action-border, #d1d5db);
		background: var(--action-bg, #ffffff);
		color: var(--action-color, #374151);
		cursor: pointer;
		transition: background 0.15s;
	}
	.action-btn:hover {
		background: var(--action-hover, #f3f4f6);
	}
	.action-clear {
		color: var(--clear-color, #6b7280);
	}

	@media (prefers-color-scheme: dark) {
		.voice-panel {
			--panel-bg: #1f2937;
			--panel-border: #374151;
		}
		.final-text,
		.response {
			--text-primary: #f3f4f6;
		}
		.interim-text {
			--text-muted: #6b7280;
		}
		.source-chip {
			--chip-border: #4b5563;
			--chip-bg: #374151;
			--chip-color: #d1d5db;
			--chip-hover-bg: #4b5563;
		}
		.playback-btn {
			--btn-border: #4b5563;
			--btn-bg: #374151;
			--btn-color: #d1d5db;
		}
		.action-btn {
			--action-border: #4b5563;
			--action-bg: #374151;
			--action-color: #d1d5db;
			--action-hover: #4b5563;
		}
	}
</style>
