<script lang="ts">
	import { renderMarkdown } from '$lib/markdown/renderer';
	import type { HelpSectionData } from './help-content';

	let { section, expanded = false }: { section: HelpSectionData; expanded: boolean } = $props();

	let isExpanded = $state(expanded);
	let html = $derived(renderMarkdown(section.content));

	function toggle() {
		isExpanded = !isExpanded;
	}
</script>

<div id={section.id} class="scroll-mt-20 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
	<button
		type="button"
		class="flex w-full items-center justify-between px-6 py-4 text-left"
		onclick={toggle}
		aria-expanded={isExpanded}
		aria-controls="help-section-{section.id}"
	>
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
		<svg
			class="h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400"
			class:rotate-180={isExpanded}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isExpanded}
		<div id="help-section-{section.id}" class="help-content border-t border-gray-200 px-6 py-4 dark:border-gray-700">
			{@html html}
		</div>
	{/if}
</div>

<style>
	.help-content :global(h2) {
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.25em;
		color: var(--tw-prose-headings, #1a1a1a);
	}

	.help-content :global(h3) {
		font-size: 1.1em;
		font-weight: 600;
		margin-top: 0.75em;
		margin-bottom: 0.25em;
	}

	.help-content :global(h4) {
		font-size: 1em;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.25em;
	}

	.help-content :global(p) {
		margin: 0.5em 0;
		line-height: 1.6;
		color: var(--tw-prose-body, #4b5563);
	}

	.help-content :global(ul),
	.help-content :global(ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	.help-content :global(li) {
		margin: 0.25em 0;
		line-height: 1.6;
		color: var(--tw-prose-body, #4b5563);
	}

	.help-content :global(code) {
		font-family: 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: #f3f4f6;
		padding: 1px 5px;
		border-radius: 4px;
		font-size: 0.875em;
	}

	.help-content :global(pre) {
		background: #f3f4f6;
		padding: 12px 16px;
		border-radius: 8px;
		overflow-x: auto;
		margin: 0.75em 0;
	}

	.help-content :global(pre code) {
		background: none;
		padding: 0;
	}

	.help-content :global(strong) {
		font-weight: 600;
	}

	.help-content :global(a) {
		color: #2563eb;
		text-decoration: underline;
	}

	:global(.dark) .help-content :global(p),
	:global(.dark) .help-content :global(li) {
		color: #d1d5db;
	}

	:global(.dark) .help-content :global(h2),
	:global(.dark) .help-content :global(h3),
	:global(.dark) .help-content :global(h4) {
		color: #f3f4f6;
	}

	:global(.dark) .help-content :global(code) {
		background: #374151;
		color: #d1d5db;
	}

	:global(.dark) .help-content :global(pre) {
		background: #374151;
	}

	:global(.dark) .help-content :global(a) {
		color: #60a5fa;
	}
</style>
