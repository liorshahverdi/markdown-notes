<script lang="ts">
  import type { CitationSource } from './CitationChip.svelte';

  interface Props {
    query: string;
    sources: CitationSource[];
  }

  let { query, sources }: Props = $props();

  let vote = $state<'up' | 'down' | null>(null);

  let noteSources = $derived(sources.filter((source) => source.kind === 'note' || source.kind === 'note-chunk'));
  let edgeIds = $derived(
    sources.filter((source) => source.kind === 'graph-edge' && source.id).map((source) => source.id as string)
  );
  let hasMemoryEvidence = $derived(noteSources.length > 0 || edgeIds.length > 0);

  function send(body: Record<string, unknown>) {
    void fetch('/api/graph/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }

  function rate(helpful: boolean) {
    if (vote) return;
    vote = helpful ? 'up' : 'down';
    if (helpful) {
      send({ query, noteId: noteSources[0]?.noteId, relationIds: edgeIds, helpful: true });
    } else if (edgeIds.length > 0) {
      send({ query, relationIds: edgeIds, helpful: false });
    }
  }
</script>

{#if hasMemoryEvidence}
  <span class="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
    {#if vote}
      <span>{vote === 'up' ? 'Thanks — the graph will lean on these sources.' : 'Thanks — these links will count for less.'}</span>
    {:else}
      <button
        type="button"
        class="rounded px-1 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="This answer was helpful"
        title="This answer was helpful"
        onclick={() => rate(true)}
      >👍</button>
      <button
        type="button"
        class="rounded px-1 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="This answer was not helpful"
        title="This answer was not helpful"
        onclick={() => rate(false)}
      >👎</button>
    {/if}
  </span>
{/if}
