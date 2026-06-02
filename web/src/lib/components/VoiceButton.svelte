<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createSpeechRecognition } from '$lib/voice/speechRecognition';
	import { loadVoicePreferences } from '$lib/voice/voicePreferences';
	import { dictationActive } from '$lib/stores/dictation';

	let {
		onTranscript = (_t: string) => {},
		alwaysListening = false,
	}: {
		onTranscript?: (transcript: string) => void;
		alwaysListening?: boolean;
	} = $props();

	let isListening = $state(false);
	let recognition: ReturnType<typeof createSpeechRecognition> | null = $state(null);
	let supported = $state(false);

	onMount(() => {
		const prefs = loadVoicePreferences();
		recognition = createSpeechRecognition({
			language: prefs.language,
			continuous: false,
			interimResults: true,
		});
		supported = recognition.isSupported();
	});

	function toggleListening() {
		if (!recognition) return;
		if (isListening) {
			recognition.stop();
			isListening = false;
		} else {
			recognition.start();
			isListening = true;

			// Watch for final transcript
			const checkInterval = setInterval(() => {
				if (!recognition) {
					clearInterval(checkInterval);
					return;
				}
				if (recognition.state.transcript) {
					onTranscript(recognition.state.transcript);
					clearInterval(checkInterval);
					isListening = false;
				}
				if (recognition.state.error || !recognition.state.isListening) {
					clearInterval(checkInterval);
					isListening = false;
				}
			}, 100);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'V') {
			e.preventDefault();
			toggleListening();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<button
	class="voice-button"
	class:listening={isListening}
	onclick={toggleListening}
	disabled={!supported || $dictationActive}
	aria-label={isListening ? 'Stop listening' : 'Start voice input'}
	title="Voice input (Cmd/Ctrl+Shift+V)"
>
	{#if isListening}
		<span class="pulse-ring"></span>
	{/if}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		width="18"
		height="18"
	>
		<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
		<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
		<line x1="12" x2="12" y1="19" y2="22" />
	</svg>
	{#if alwaysListening}
		<span class="always-dot"></span>
	{/if}
</button>

<style>
	.voice-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid var(--btn-border, #d1d5db);
		background: var(--btn-bg, #ffffff);
		color: var(--btn-color, #374151);
		cursor: pointer;
		transition:
			background 0.2s,
			color 0.2s,
			box-shadow 0.2s;
	}

	.voice-button:hover:not(:disabled) {
		background: var(--btn-hover-bg, #f3f4f6);
	}

	.voice-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.voice-button.listening {
		background: var(--btn-active-bg, #ef4444);
		color: white;
		border-color: var(--btn-active-border, #ef4444);
	}

	.pulse-ring {
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 2px solid var(--pulse-color, #ef4444);
		animation: pulse-ring 1.5s ease-out infinite;
	}

	@keyframes pulse-ring {
		0% {
			opacity: 0.8;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.4);
		}
	}

	.always-dot {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
	}

	@media (prefers-color-scheme: dark) {
		.voice-button {
			--btn-border: #4b5563;
			--btn-bg: #1f2937;
			--btn-color: #d1d5db;
			--btn-hover-bg: #374151;
			--btn-active-bg: #dc2626;
			--btn-active-border: #dc2626;
			--pulse-color: #dc2626;
		}
	}
</style>
