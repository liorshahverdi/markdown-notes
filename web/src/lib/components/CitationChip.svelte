<script lang="ts" module>
  export interface CitationSource {
    id?: string;
    noteId: string;
    title: string;
    relevanceScore: number;
    kind?: 'wiki-page' | 'raw-source' | 'note' | 'note-chunk' | 'graph-edge' | 'wiki';
    wikiPath?: string;
    excerpt?: string;
    edge?: {
      id: string;
      fromEntityId: string;
      toEntityId: string;
      type: string;
      fromName?: string;
      toName?: string;
      reviewState?: string;
    };
  }
</script>

<script lang="ts">
  interface Props {
    source: CitationSource;
    onOpen?: (source: CitationSource) => void;
  }

  let { source, onOpen }: Props = $props();

  let edgePath = $derived(
    source.kind === 'graph-edge' && source.edge?.fromName && source.edge?.toName
      ? { from: source.edge.fromName, relation: source.edge.type.replace(/_/g, ' '), to: source.edge.toName }
      : null
  );
  let unreviewed = $derived(source.kind === 'graph-edge' && source.edge?.reviewState === 'auto');
  let tooltip = $derived(
    [
      source.excerpt ? `“${source.excerpt}”` : null,
      unreviewed ? 'Unreviewed suggestion' : null,
      `Relevance: ${(source.relevanceScore * 100).toFixed(0)}%`,
    ]
      .filter(Boolean)
      .join('\n')
  );
</script>

<button
  type="button"
  class="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
  onclick={() => onOpen?.(source)}
  title={tooltip}
>
  {#if edgePath}
    <span>{edgePath.from} → {edgePath.relation} → {edgePath.to}</span>
    {#if unreviewed}
      <span class="rounded bg-amber-100 px-1 text-[10px] uppercase tracking-wide text-amber-800 dark:bg-amber-900 dark:text-amber-200">unreviewed</span>
    {/if}
  {:else}
    {#if source.kind}
      <span class="opacity-70">{source.kind}</span>
    {/if}
    <span>{source.title}</span>
  {/if}
</button>
