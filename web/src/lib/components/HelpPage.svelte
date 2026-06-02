<script lang="ts">
	import { onMount } from 'svelte';
	import { helpSections, searchHelp } from './help-content';
	import type { HelpSectionData } from './help-content';
	import HelpSection from './HelpSection.svelte';
	import KeyboardShortcutCard from './KeyboardShortcutCard.svelte';

	let searchQuery = $state('');
	let filteredSections = $derived(searchHelp(searchQuery));
	let expandedId = $state<string | null>(null);

	onMount(() => {
		const hash = window.location.hash.slice(1);
		if (hash) {
			expandedId = hash;
			// Scroll to the section after a tick to allow rendering
			requestAnimationFrame(() => {
				const el = document.getElementById(hash);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		}
	});

	function handleHashClick(id: string) {
		expandedId = id;
		window.history.replaceState(null, '', `#${id}`);
	}
</script>

<div class="flex h-full overflow-hidden">
	<!-- Table of Contents Sidebar -->
	<nav class="hidden w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4 md:block dark:border-gray-700 dark:bg-gray-900">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Contents</h2>
		<ul class="space-y-1">
			{#each helpSections as section}
				<li>
					<button
						type="button"
						class="w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
						class:text-blue-600={expandedId === section.id}
						class:font-medium={expandedId === section.id}
						class:text-gray-700={expandedId !== section.id}
						class:dark:text-gray-300={expandedId !== section.id}
						class:dark:text-blue-400={expandedId === section.id}
						onclick={() => handleHashClick(section.id)}
					>
						{section.title}
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Main Content -->
	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-3xl">
			<h1 class="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Help &amp; Documentation</h1>

			<!-- Search bar -->
			<div class="mb-6">
				<div class="relative">
					<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search help topics..."
						class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
					/>
				</div>
				{#if searchQuery && filteredSections.length === 0}
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No results found for "{searchQuery}"</p>
				{/if}
			</div>

			<!-- Sections -->
			<div class="space-y-3">
				{#each filteredSections as section (section.id)}
					<HelpSection
						{section}
						expanded={expandedId === section.id}
					/>
				{/each}
			</div>

			<!-- Keyboard Shortcuts -->
			{#if !searchQuery}
				<div class="mt-8">
					<KeyboardShortcutCard />
				</div>
			{/if}
		</div>
	</div>
</div>
