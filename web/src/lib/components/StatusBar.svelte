<script lang="ts">
	import { computeTextStatistics } from '$lib/markdown/textStatistics';
	import type { SaveIssue, SaveStatus } from '$lib/stores/notes';

	let {
		content,
		saveStatus = 'saved',
		saveIssue = null,
		onRetry,
	}: {
		content: string;
		saveStatus?: SaveStatus;
		saveIssue?: SaveIssue | null;
		onRetry?: () => void;
	} = $props();

	let stats = $derived(computeTextStatistics(content));
</script>

<div class="status-bar">
	<span class="status-bar__group">
		<span class="status-bar__num">{stats.wordCount.toLocaleString()}</span>
		<span class="status-bar__unit">{stats.wordCount === 1 ? 'word' : 'words'}</span>
	</span>
	<span class="status-bar__sep">·</span>
	<span class="status-bar__group">
		<span class="status-bar__num">{stats.characterCount.toLocaleString()}</span>
		<span class="status-bar__unit">{stats.characterCount === 1 ? 'char' : 'chars'}</span>
	</span>
	<span class="status-bar__sep">·</span>
	<span class="status-bar__group">
		<span class="status-bar__num">{stats.lineCount.toLocaleString()}</span>
		<span class="status-bar__unit">{stats.lineCount === 1 ? 'line' : 'lines'}</span>
	</span>
	<span class="status-bar__sep">·</span>
	<span
		class="status-bar__save"
		class:is-saving={saveStatus === 'saving'}
		class:is-error={saveStatus === 'error' || saveStatus === 'conflict'}
		title={saveIssue?.message ?? undefined}
	>
		{saveStatus === 'saving'
			? 'Saving…'
			: saveStatus === 'conflict'
				? 'Save conflict — local edits preserved'
				: saveStatus === 'error'
					? 'Save failed — retrying'
					: 'Saved'}
	</span>
	{#if (saveStatus === 'error' || saveStatus === 'conflict') && onRetry}
		<button type="button" class="status-bar__retry" onclick={onRetry}>Retry now</button>
	{/if}
</div>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 18px;
		font-size: 11px;
		color: var(--color-text-tertiary);
		background: var(--color-bg-grain);
		border-top: 1px solid var(--color-border-subtle);
	}

	:global(.dark) .status-bar {
		background: var(--color-surface-sunken);
	}

	.status-bar__group {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
	}

	.status-bar__num {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: 11px;
		color: var(--color-text-secondary);
	}

	.status-bar__unit {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-tertiary);
	}

	.status-bar__sep {
		color: var(--color-border-strong);
		opacity: 0.6;
	}

	.status-bar__save {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-tertiary);
	}

	.status-bar__save.is-saving {
		color: var(--color-accent, #2563eb);
	}

	.status-bar__save.is-error {
		color: #dc2626;
	}

	.status-bar__retry {
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface, #fff);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 2px 8px;
		cursor: pointer;
	}

	.status-bar__retry:hover {
		color: var(--color-text);
		border-color: var(--color-border-strong);
	}
</style>
