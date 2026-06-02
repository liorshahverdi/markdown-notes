<script lang="ts">
  import type { ImprovementRecord } from '../graph/improvementLog';
  import { canUndo } from '../graph/improvementLog';

  interface Props {
    improvements: ImprovementRecord[];
    onUndo?: (record: ImprovementRecord) => void;
  }

  let { improvements, onUndo }: Props = $props();

  const typeIcons: Record<ImprovementRecord['type'], string> = {
    relationship_added: '🔗',
    entity_merged: '🔀',
    implicit_extracted: '💡',
    transitive_inferred: '🔄',
    entity_corrected: '✏️',
  };

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }
</script>

<div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
  {#if improvements.length === 0}
    <p class="text-gray-400 text-sm text-center py-4">No improvements yet</p>
  {:else}
    {#each improvements as record (record.id)}
      <div
        class="flex items-start gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700"
      >
        <span class="text-lg" title={record.type}>
          {typeIcons[record.type] ?? '?'}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-200 truncate">{record.description}</p>
          <p class="text-xs text-gray-400 mt-1">
            {formatTimestamp(record.timestamp)}
            <span
              class="ml-2 px-1.5 py-0.5 rounded text-xs {record.status === 'auto-applied'
                ? 'bg-green-900 text-green-300'
                : record.status === 'pending-review'
                  ? 'bg-yellow-900 text-yellow-300'
                  : record.status === 'rejected'
                    ? 'bg-red-900 text-red-300'
                    : 'bg-gray-700 text-gray-300'}"
            >
              {record.status}
            </span>
          </p>
        </div>
        {#if canUndo(record) && onUndo}
          <button
            onclick={() => onUndo?.(record)}
            class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors shrink-0"
          >
            Undo
          </button>
        {/if}
      </div>
    {/each}
  {/if}
</div>
