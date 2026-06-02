<script lang="ts">
  import { onMount } from 'svelte';

  let markdown = $state('');
  let errorMessage = $state<string | null>(null);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const response = await fetch('/api/wiki/log');
      if (!response.ok) throw new Error('Failed to load wiki log');
      const data = await response.json();
      markdown = data.markdown ?? '';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load wiki log';
    } finally {
      isLoading = false;
    }
  });
</script>

<section data-testid="wiki-log-view" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
  <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Wiki Log</h2>
  {#if isLoading}
    <p class="text-sm text-gray-500">Loading wiki log…</p>
  {:else if errorMessage}
    <p class="text-sm text-red-600">{errorMessage}</p>
  {:else}
    <pre class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{markdown}</pre>
  {/if}
</section>
