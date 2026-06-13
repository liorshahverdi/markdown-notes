<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import VoiceSettings from './VoiceSettings.svelte';
	import { ragConfig } from '$lib/stores/rag';
	import { proxyCheckHealth } from '$lib/llm/ollamaProxy';
	import { notes } from '$lib/stores/notes';
	import { exportNotesAsMarkdown, exportAllAsJSON } from '$lib/markdown/importExport';

	let {
		open = false,
		onClose = () => {},
	}: {
		open?: boolean;
		onClose?: () => void;
	} = $props();

	let activeTab = $state<'general' | 'voice' | 'rag' | 'self-improvement' | 'export'>('general');

	// General settings
	let fontSize = $state(14);
	let theme = $state<'system' | 'light' | 'dark'>('system');

	// RAG settings
	let ollamaUrl = $state('http://localhost:11434');
	let ollamaModel = $state('qwen2.5:3b');
	let embeddingModel = $state('nomic-embed-text');
	let topK = $state(5);
	let ollamaSettingsStatus = $state<'disconnected' | 'checking' | 'connected'>('disconnected');

	// Self-improvement settings
	let selfImprovementEnabled = $state(false);
	let selfImprovementInterval = $state(30);
	let autoApplyThreshold = $state(0.8);

	// Debounce timer and generation counter for health check
	let healthCheckTimer: ReturnType<typeof setTimeout> | null = null;
	let healthCheckGeneration = 0;

	onMount(() => {
		loadSettings();
	});

	function loadSettings() {
		try {
			const saved = localStorage.getItem('app-settings');
			if (saved) {
				const s = JSON.parse(saved);
				fontSize = s.fontSize ?? 14;
				theme = s.theme ?? 'system';
				selfImprovementEnabled = s.selfImprovementEnabled ?? false;
				selfImprovementInterval = s.selfImprovementInterval ?? 30;
				autoApplyThreshold = s.autoApplyThreshold ?? 0.8;
			}
		} catch {
			// ignore parse errors
		}

		// Load RAG config from store
		const rc = get(ragConfig);
		ollamaUrl = rc.ollamaUrl;
		ollamaModel = rc.model;
		embeddingModel = rc.embeddingModel || 'nomic-embed-text';
		topK = rc.topK;

		// Check Ollama health on load
		recheckOllamaHealth();

		applyTheme();
		applyFontSize();
	}

	function recheckOllamaHealth() {
		if (healthCheckTimer) clearTimeout(healthCheckTimer);
		ollamaSettingsStatus = 'checking';
		const gen = ++healthCheckGeneration;
		healthCheckTimer = setTimeout(async () => {
			const ok = await proxyCheckHealth(ollamaUrl);
			if (gen === healthCheckGeneration) {
				ollamaSettingsStatus = ok ? 'connected' : 'disconnected';
			}
		}, 500);
	}

	function saveSettings() {
		const settings = {
			fontSize,
			theme,
			selfImprovementEnabled,
			selfImprovementInterval,
			autoApplyThreshold,
		};
		localStorage.setItem('app-settings', JSON.stringify(settings));

		// Update RAG config store
		ragConfig.set({ ollamaUrl, model: ollamaModel, topK, embeddingModel });

		applyTheme();
		applyFontSize();
	}

	function saveRagSettings() {
		saveSettings();
		recheckOllamaHealth();
	}

	function applyTheme() {
		const root = document.documentElement;
		root.classList.remove('dark');
		if (theme === 'dark') {
			root.classList.add('dark');
		} else if (theme === 'system') {
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
				root.classList.add('dark');
			}
		}
	}

	function applyFontSize() {
		document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`);
	}

	function handleExportJSON() {
		const allNotes = get(notes);
		const blob = exportAllAsJSON(allNotes);
		downloadBlob(blob, 'notes-export.json');
	}

	function handleExportMarkdown() {
		const allNotes = get(notes);
		const files = exportNotesAsMarkdown(allNotes);
		for (const file of files) {
			downloadBlob(file.blob, file.filename);
		}
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	const tabs = [
		{ id: 'general' as const, label: 'General' },
		{ id: 'voice' as const, label: 'Voice' },
		{ id: 'rag' as const, label: 'RAG' },
		{ id: 'self-improvement' as const, label: 'Self-Improvement' },
		{ id: 'export' as const, label: 'Export' },
	];

	let statusColor = $derived(
		ollamaSettingsStatus === 'connected'
			? 'bg-green-500'
			: ollamaSettingsStatus === 'checking'
				? 'bg-yellow-500'
				: 'bg-red-500'
	);
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex justify-end"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="absolute inset-0 bg-black/40"
			onclick={onClose}
			aria-label="Close settings"
		></button>

		<!-- Panel -->
		<div
			class="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-xl dark:bg-gray-900"
			role="dialog"
			aria-label="Settings"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
				<button
					type="button"
					class="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
					onclick={onClose}
					aria-label="Close settings"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Tabs -->
			<div class="flex gap-1 overflow-x-auto border-b border-gray-200 px-6 dark:border-gray-700">
				{#each tabs as tab}
					<button
						type="button"
						class="whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors {activeTab === tab.id
							? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
						onclick={() => (activeTab = tab.id)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if activeTab === 'general'}
					<div class="space-y-6">
						<div>
							<label for="font-size" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Font size: {fontSize}px
							</label>
							<input
								id="font-size"
								type="range"
								min="12"
								max="20"
								bind:value={fontSize}
								onchange={saveSettings}
								class="mt-2 w-full"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-400">
								<span>12px</span>
								<span>20px</span>
							</div>
						</div>

						<div>
							<label for="theme-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Theme
							</label>
							<select
								id="theme-select"
								bind:value={theme}
								onchange={saveSettings}
								class="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
							>
								<option value="system">System</option>
								<option value="light">Light</option>
								<option value="dark">Dark</option>
							</select>
						</div>
					</div>
				{:else if activeTab === 'voice'}
					<VoiceSettings />
				{:else if activeTab === 'rag'}
					<div class="space-y-6">
						<div>
							<label for="ollama-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Ollama URL
							</label>
							<input
								id="ollama-url"
								type="text"
								bind:value={ollamaUrl}
								onchange={saveRagSettings}
								class="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
								placeholder="http://localhost:11434"
							/>
						</div>

						<div>
							<label for="ollama-model" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Model
							</label>
							<input
								id="ollama-model"
								type="text"
								bind:value={ollamaModel}
								onchange={saveRagSettings}
								class="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
								placeholder="qwen2.5:3b"
							/>
						</div>

						<div>
							<label for="embedding-model" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Embedding Model
							</label>
							<input
								id="embedding-model"
								type="text"
								bind:value={embeddingModel}
								onchange={saveRagSettings}
								class="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
								placeholder="nomic-embed-text"
							/>
						</div>

						<div>
							<label for="top-k" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Top-K results: {topK}
							</label>
							<input
								id="top-k"
								type="range"
								min="1"
								max="20"
								bind:value={topK}
								onchange={saveRagSettings}
								class="mt-2 w-full"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-400">
								<span>1</span>
								<span>20</span>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Ollama status:</span>
							<span class="inline-block h-3 w-3 rounded-full {statusColor}"></span>
							<span class="text-sm text-gray-500 dark:text-gray-400 capitalize">{ollamaSettingsStatus}</span>
						</div>
					</div>
				{:else if activeTab === 'self-improvement'}
					<div class="space-y-6">
						<label class="flex items-center gap-3">
							<input
								type="checkbox"
								bind:checked={selfImprovementEnabled}
								onchange={saveSettings}
								class="h-4 w-4 rounded border-gray-300"
							/>
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Enable self-improvement
							</span>
						</label>

						{#if selfImprovementEnabled}
							<div>
								<label for="si-interval" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Improvement interval: {selfImprovementInterval} min
								</label>
								<input
									id="si-interval"
									type="range"
									min="10"
									max="120"
									step="5"
									bind:value={selfImprovementInterval}
									onchange={saveSettings}
									class="mt-2 w-full"
								/>
								<div class="mt-1 flex justify-between text-xs text-gray-400">
									<span>10 min</span>
									<span>120 min</span>
								</div>
							</div>

							<div>
								<label for="auto-apply" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Auto-apply threshold: {autoApplyThreshold.toFixed(2)}
								</label>
								<input
									id="auto-apply"
									type="range"
									min="0.5"
									max="1.0"
									step="0.05"
									bind:value={autoApplyThreshold}
									onchange={saveSettings}
									class="mt-2 w-full"
								/>
								<div class="mt-1 flex justify-between text-xs text-gray-400">
									<span>0.50</span>
									<span>1.00</span>
								</div>
							</div>
						{/if}
					</div>
				{:else if activeTab === 'export'}
					<div class="space-y-4">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							Export your notes for backup or transfer.
						</p>
						<button
							type="button"
							class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
							onclick={handleExportJSON}
						>
							Export all notes (JSON)
						</button>
						<button
							type="button"
							class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
							onclick={handleExportMarkdown}
						>
							Export all notes (Markdown files)
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
