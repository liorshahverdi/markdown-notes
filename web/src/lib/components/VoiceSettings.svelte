<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadVoicePreferences,
		saveVoicePreferences,
		getDefaultPreferences,
		type VoicePreferences,
	} from '$lib/voice/voicePreferences';
	import { getAvailableVoices, speak, stopSpeaking } from '$lib/voice/speechSynthesis';

	let prefs = $state<VoicePreferences>(getDefaultPreferences());
	let voices = $state<SpeechSynthesisVoice[]>([]);

	onMount(() => {
		prefs = loadVoicePreferences();
		voices = getAvailableVoices();
		// Voices may load asynchronously
		if (typeof speechSynthesis !== 'undefined') {
			speechSynthesis.onvoiceschanged = () => {
				voices = getAvailableVoices();
			};
		}
	});

	function save() {
		saveVoicePreferences(prefs);
	}

	function previewVoice() {
		stopSpeaking();
		const voice = voices.find((v) => v.name === prefs.voiceName) ?? null;
		speak('Hello, I am your notes assistant.', {
			voice,
			rate: prefs.speechRate,
			pitch: prefs.speechPitch,
		});
	}

	const languages = [
		{ code: 'en-US', label: 'English (US)' },
		{ code: 'en-GB', label: 'English (UK)' },
		{ code: 'es-ES', label: 'Spanish' },
		{ code: 'fr-FR', label: 'French' },
		{ code: 'de-DE', label: 'German' },
		{ code: 'it-IT', label: 'Italian' },
		{ code: 'pt-BR', label: 'Portuguese (BR)' },
		{ code: 'ja-JP', label: 'Japanese' },
		{ code: 'ko-KR', label: 'Korean' },
		{ code: 'zh-CN', label: 'Chinese (Simplified)' },
	];
</script>

<div class="voice-settings" role="form" aria-label="Voice settings">
	<!-- Activation mode -->
	<fieldset class="setting-group">
		<legend class="setting-label">Activation mode</legend>
		<label class="radio-label">
			<input
				type="radio"
				name="activation"
				value="push-to-talk"
				bind:group={prefs.activationMode}
				onchange={save}
			/>
			Push-to-talk
		</label>
		<label class="radio-label">
			<input
				type="radio"
				name="activation"
				value="always-listening"
				bind:group={prefs.activationMode}
				onchange={save}
			/>
			Always listening
		</label>
	</fieldset>

	<!-- Wake phrase (shown only in always-listening mode) -->
	{#if prefs.activationMode === 'always-listening'}
		<div class="setting-group">
			<label class="setting-label" for="wake-phrase">Wake phrase</label>
			<input
				id="wake-phrase"
				class="text-input"
				type="text"
				bind:value={prefs.wakePhrase}
				onchange={save}
				placeholder="e.g., Hey Notes"
			/>
		</div>
	{/if}

	<!-- Voice selector -->
	<div class="setting-group">
		<label class="setting-label" for="voice-select">Voice</label>
		<div class="voice-row">
			<select
				id="voice-select"
				class="select-input"
				bind:value={prefs.voiceName}
				onchange={save}
			>
				<option value={null}>System default</option>
				{#each voices as voice}
					<option value={voice.name}>{voice.name} ({voice.lang})</option>
				{/each}
			</select>
			<button class="preview-btn" onclick={previewVoice} aria-label="Preview voice">
				Preview
			</button>
		</div>
	</div>

	<!-- Speech rate -->
	<div class="setting-group">
		<label class="setting-label" for="speech-rate">
			Speech rate: {prefs.speechRate.toFixed(1)}x
		</label>
		<input
			id="speech-rate"
			type="range"
			min="0.5"
			max="2"
			step="0.1"
			bind:value={prefs.speechRate}
			onchange={save}
			class="range-input"
		/>
	</div>

	<!-- Speech pitch -->
	<div class="setting-group">
		<label class="setting-label" for="speech-pitch">
			Speech pitch: {prefs.speechPitch.toFixed(1)}
		</label>
		<input
			id="speech-pitch"
			type="range"
			min="0.5"
			max="2"
			step="0.1"
			bind:value={prefs.speechPitch}
			onchange={save}
			class="range-input"
		/>
	</div>

	<!-- Auto-speak toggle -->
	<div class="setting-group">
		<label class="toggle-label">
			<input
				type="checkbox"
				bind:checked={prefs.autoSpeak}
				onchange={save}
			/>
			Auto-speak responses
		</label>
	</div>

	<!-- Language -->
	<div class="setting-group">
		<label class="setting-label" for="language-select">Language</label>
		<select
			id="language-select"
			class="select-input"
			bind:value={prefs.language}
			onchange={save}
		>
			{#each languages as lang}
				<option value={lang.code}>{lang.label}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.voice-settings {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		font-size: 13px;
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		border: none;
		margin: 0;
		padding: 0;
	}

	.setting-label {
		font-weight: 600;
		color: var(--label-color, #374151);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--text-color, #4b5563);
		cursor: pointer;
	}

	.text-input,
	.select-input {
		padding: 6px 10px;
		border: 1px solid var(--input-border, #d1d5db);
		border-radius: 6px;
		background: var(--input-bg, #ffffff);
		color: var(--input-color, #111827);
		font-size: 13px;
	}

	.voice-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.voice-row .select-input {
		flex: 1;
	}

	.preview-btn {
		padding: 6px 12px;
		border: 1px solid var(--btn-border, #d1d5db);
		border-radius: 6px;
		background: var(--btn-bg, #f9fafb);
		color: var(--btn-color, #374151);
		cursor: pointer;
		font-size: 12px;
		white-space: nowrap;
	}
	.preview-btn:hover {
		background: var(--btn-hover, #e5e7eb);
	}

	.range-input {
		width: 100%;
		height: 4px;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-color, #4b5563);
		cursor: pointer;
	}

	@media (prefers-color-scheme: dark) {
		.voice-settings {
			--label-color: #d1d5db;
			--text-color: #9ca3af;
			--input-border: #4b5563;
			--input-bg: #1f2937;
			--input-color: #f3f4f6;
			--btn-border: #4b5563;
			--btn-bg: #374151;
			--btn-color: #d1d5db;
			--btn-hover: #4b5563;
		}
	}
</style>
