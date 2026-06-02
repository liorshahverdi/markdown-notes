<script lang="ts">
	import { helpSections } from './help-content';

	let { sectionId }: { sectionId: string } = $props();

	const sectionTitle = $derived(
		helpSections.find((s) => s.id === sectionId)?.title ?? 'Help'
	);
</script>

<a
	href="/help#{sectionId}"
	class="group relative inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
	title={sectionTitle}
	aria-label="Help: {sectionTitle}"
>
	?
	<span class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-gray-700">
		{sectionTitle}
	</span>
</a>
