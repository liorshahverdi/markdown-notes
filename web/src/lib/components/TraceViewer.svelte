<script lang="ts">
  import type { TraceRecord, TraceType } from '../../types/graph';

  interface Props {
    traces: TraceRecord[];
    entityId?: string | null;
    entityName?: string | null;
  }

  let { traces, entityId = null, entityName = null }: Props = $props();

  let filterType = $state<TraceType | 'all'>('all');
  let expandedTraceId = $state<string | null>(null);
  let expandedStageIdx = $state<number | null>(null);
  let scopeMode = $state<'all' | 'entity'>('entity');

  // When entityId changes, reset to entity scope
  $effect(() => {
    if (entityId) {
      scopeMode = 'entity';
    } else {
      scopeMode = 'all';
    }
  });

  let scopedTraces = $derived.by(() => {
    if (!entityId || !entityName || scopeMode === 'all') return traces;

    const nameLower = entityName.toLowerCase();
    return traces.filter((t) => {
      // Match if trace noteId is in entity's source notes — we can't check sourceNoteIds
      // from here since we only get entityId, so we match on decision subjects
      for (const stage of t.stages) {
        for (const decision of stage.decisions) {
          if (decision.subject.toLowerCase().includes(nameLower)) {
            return true;
          }
        }
      }
      // Also match on trace summary
      if (t.summary.toLowerCase().includes(nameLower)) return true;
      return false;
    });
  });

  let filteredTraces = $derived(
    filterType === 'all'
      ? scopedTraces
      : scopedTraces.filter((t) => t.type === filterType)
  );

  function toggleTrace(id: string) {
    if (expandedTraceId === id) {
      expandedTraceId = null;
      expandedStageIdx = null;
    } else {
      expandedTraceId = id;
      expandedStageIdx = null;
    }
  }

  function toggleStage(idx: number) {
    expandedStageIdx = expandedStageIdx === idx ? null : idx;
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  const typeLabels: Record<TraceType, string> = {
    extraction: 'Extraction',
    query: 'Query',
    self_improvement: 'Self-Improvement',
  };

  const typeColors: Record<TraceType, string> = {
    extraction: 'bg-blue-500/20 text-blue-400',
    query: 'bg-purple-500/20 text-purple-400',
    self_improvement: 'bg-amber-500/20 text-amber-400',
  };

  const decisionColors = {
    accepted: 'text-green-400',
    rejected: 'text-red-400',
    modified: 'text-yellow-400',
  };
</script>

<div class="space-y-3">
  <!-- Scope toggle (only when an entity is selected) -->
  {#if entityId && entityName}
    <div class="flex gap-1 bg-gray-900/50 rounded p-1">
      <button
        class="flex-1 px-2 py-1 text-xs rounded transition-colors {scopeMode === 'entity' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}"
        onclick={() => scopeMode = 'entity'}
      >
        This entity
      </button>
      <button
        class="flex-1 px-2 py-1 text-xs rounded transition-colors {scopeMode === 'all' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}"
        onclick={() => scopeMode = 'all'}
      >
        All traces
      </button>
    </div>
  {/if}

  <!-- Filter tabs -->
  <div class="flex gap-1">
    <button
      class="px-2 py-1 text-xs rounded transition-colors {filterType === 'all' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}"
      onclick={() => filterType = 'all'}
    >
      All ({scopedTraces.length})
    </button>
    {#each (['extraction', 'query', 'self_improvement'] as const) as type}
      {@const count = scopedTraces.filter((t) => t.type === type).length}
      <button
        class="px-2 py-1 text-xs rounded transition-colors {filterType === type ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}"
        onclick={() => filterType = type}
      >
        {typeLabels[type]} ({count})
      </button>
    {/each}
  </div>

  <!-- Trace list -->
  {#if filteredTraces.length === 0}
    <p class="text-xs text-gray-500">
      {#if entityId && scopeMode === 'entity'}
        No traces for this entity.
      {:else}
        No traces recorded yet.
      {/if}
    </p>
  {:else}
    <div class="space-y-2 max-h-96 overflow-y-auto">
      {#each filteredTraces as trace (trace.id)}
        <div class="bg-gray-800 rounded border border-gray-700">
          <!-- Trace header -->
          <button
            class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-750 transition-colors"
            onclick={() => toggleTrace(trace.id)}
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="px-1.5 py-0.5 text-xs rounded {typeColors[trace.type]}">
                {typeLabels[trace.type]}
              </span>
              <span class="text-xs text-gray-300 truncate">{trace.summary}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <span class="text-xs text-gray-500">{formatDuration(trace.durationMs)}</span>
              <span class="text-xs text-gray-600">{formatTime(trace.timestamp)}</span>
            </div>
          </button>

          <!-- Expanded trace details -->
          {#if expandedTraceId === trace.id}
            <div class="border-t border-gray-700 px-3 py-2 space-y-2">
              {#each trace.stages as stage, idx}
                <div class="bg-gray-900/50 rounded p-2">
                  <!-- Stage header with timing bar -->
                  <button
                    class="w-full flex items-center justify-between text-left"
                    onclick={() => toggleStage(idx)}
                  >
                    <span class="text-xs font-medium text-gray-300">{stage.name}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-blue-500 rounded-full"
                          style="width: {Math.min(100, (stage.durationMs / Math.max(trace.durationMs, 1)) * 100)}%"
                        ></div>
                      </div>
                      <span class="text-xs text-gray-500">{formatDuration(stage.durationMs)}</span>
                    </div>
                  </button>

                  <!-- Stage decisions -->
                  {#if expandedStageIdx === idx && stage.decisions.length > 0}
                    <div class="mt-2 space-y-1 pl-2 border-l border-gray-700">
                      {#each stage.decisions as decision}
                        <div class="flex items-start gap-1.5 text-xs">
                          <span class={decisionColors[decision.action]}>
                            {decision.action === 'accepted' ? '+' : decision.action === 'rejected' ? '-' : '~'}
                          </span>
                          <span class="text-gray-400">
                            <span class="text-gray-300">{decision.subject}</span>
                            — {decision.reason}
                            {#if decision.confidence != null}
                              <span class="text-gray-600">({(decision.confidence * 100).toFixed(0)}%)</span>
                            {/if}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
