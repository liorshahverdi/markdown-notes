<script lang="ts">
  import type { ImprovementRecord } from '../graph/improvementLog';

  interface Props {
    items: ImprovementRecord[];
    onApprove?: (record: ImprovementRecord) => void;
    onReject?: (record: ImprovementRecord) => void;
  }

  let { items, onApprove, onReject }: Props = $props();

  const typeLabels: Record<ImprovementRecord['type'], string> = {
    relationship_added: 'New Relationship',
    entity_merged: 'Entity Merge',
    implicit_extracted: 'Implicit Extraction',
    transitive_inferred: 'Transitive Inference',
    entity_corrected: 'Entity Correction',
  };
</script>

<div class="flex flex-col gap-2">
  {#if items.length === 0}
    <p class="text-gray-400 text-sm text-center py-4">No items pending review</p>
  {:else}
    <p class="text-sm text-gray-300 mb-1">
      {items.length} item{items.length === 1 ? '' : 's'} pending review
    </p>
    {#each items as record (record.id)}
      <div
        class="p-3 bg-gray-800 rounded-lg border border-yellow-700/50"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs px-2 py-0.5 bg-yellow-900 text-yellow-300 rounded">
            {typeLabels[record.type] ?? record.type}
          </span>
          <span class="text-xs text-gray-400">
            Confidence: {(record.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <p class="text-sm text-gray-200 mb-3">{record.description}</p>
        <div class="flex gap-2">
          {#if onApprove}
            <button
              onclick={() => onApprove?.(record)}
              class="flex-1 px-3 py-1.5 bg-green-800 hover:bg-green-700 text-green-200 text-sm rounded border border-green-600 transition-colors"
            >
              Approve
            </button>
          {/if}
          {#if onReject}
            <button
              onclick={() => onReject?.(record)}
              class="flex-1 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-red-200 text-sm rounded border border-red-600 transition-colors"
            >
              Reject
            </button>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>
