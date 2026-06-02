<script lang="ts">
	import { keyboardShortcuts } from './help-content';

	// Group shortcuts by section
	const grouped = $derived.by(() => {
		const groups: Record<string, Array<{ key: string; description: string }>> = {};
		for (const shortcut of keyboardShortcuts) {
			if (!groups[shortcut.section]) {
				groups[shortcut.section] = [];
			}
			groups[shortcut.section].push({ key: shortcut.key, description: shortcut.description });
		}
		return groups;
	});
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>

	{#each Object.entries(grouped) as [section, shortcuts]}
		<div class="mb-4 last:mb-0">
			<h3 class="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{section}</h3>
			<table class="w-full">
				<tbody>
					{#each shortcuts as shortcut}
						<tr class="border-b border-gray-100 last:border-0 dark:border-gray-700">
							<td class="py-1.5 pr-4">
								<kbd class="inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">{shortcut.key}</kbd>
							</td>
							<td class="py-1.5 text-sm text-gray-600 dark:text-gray-400">{shortcut.description}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
</div>
