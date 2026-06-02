<script lang="ts">
  import { onMount } from 'svelte';

  interface MutationSummary {
    triggerType: string;
    notes: string;
    sourceIds: string[];
    changedPageIds: string[];
    createdPageIds: string[];
  }

  let mutation = $state<MutationSummary | null>(null);
  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);

  onMount(async () => {
    try {
      const response = await fetch('/api/wiki/mutations/latest');
      if (!response.ok) throw new Error('Failed to load ingest review');
      const data = await response.json();
      mutation = data.mutation ?? null;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load ingest review';
    } finally {
      isLoading = false;
    }
  });
</script>

<section data-testid="ingest-review-panel" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
  <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Latest Ingest Review</h2>
  {#if isLoading}
    <p class="text-sm text-gray-500">Loading latest ingest…</p>
  {:else if errorMessage}
    <p class="text-sm text-red-600">{errorMessage}</p>
  {:else if mutation}
    <p class="text-sm text-gray-700 dark:text-gray-300">{mutation.notes}</p>
    <dl class="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
      <div>
        <dt class="font-semibold">Sources</dt>
        <dd>{mutation.sourceIds.join(', ') || 'none'}</dd>
      </div>
      <div>
        <dt class="font-semibold">Changed pages</dt>
        <dd>{mutation.changedPageIds.join(', ') || 'none'}</dd>
      </div>
      <div>
        <dt class="font-semibold">Created pages</dt>
        <dd>{mutation.createdPageIds.join(', ') || 'none'}</dd>
      </div>
    </dl>
  {:else}
    <p class="text-sm text-gray-500">No ingest mutations recorded yet.</p>
  {/if}
</section>
