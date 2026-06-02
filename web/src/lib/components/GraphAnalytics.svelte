<script lang="ts">
  import type { GraphAnalytics } from '../graph/analyticsComputer';

  interface Props {
    analytics: GraphAnalytics;
  }

  let { analytics }: Props = $props();

  const distributionEntries = $derived(
    Array.from(analytics.entityDistribution.entries()).sort((a, b) => b[1] - a[1])
  );

  const maxCount = $derived(
    distributionEntries.length > 0
      ? Math.max(...distributionEntries.map(([, count]) => count))
      : 1
  );

  const modularityColor = $derived(
    analytics.overallModularity >= 0.7
      ? 'text-green-400'
      : analytics.overallModularity >= 0.4
        ? 'text-yellow-400'
        : 'text-red-400'
  );

  const typeColors: Record<string, string> = {
    note: 'bg-blue-500',
    person: 'bg-purple-500',
    place: 'bg-green-500',
    organization: 'bg-orange-500',
    topic: 'bg-cyan-500',
    tag: 'bg-pink-500',
  };
</script>

<div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
  <h3 class="text-sm font-semibold text-gray-200 mb-3">Graph Analytics</h3>

  <!-- Stats row -->
  <div class="grid grid-cols-4 gap-3 mb-4">
    <div class="bg-gray-750 rounded p-2 text-center bg-gray-700/50">
      <p class="text-lg font-bold text-white">{analytics.totalNodes}</p>
      <p class="text-xs text-gray-400">Nodes</p>
    </div>
    <div class="bg-gray-750 rounded p-2 text-center bg-gray-700/50">
      <p class="text-lg font-bold text-white">{analytics.totalEdges}</p>
      <p class="text-xs text-gray-400">Edges</p>
    </div>
    <div class="bg-gray-750 rounded p-2 text-center bg-gray-700/50">
      <p class="text-lg font-bold text-white">{analytics.totalClusters}</p>
      <p class="text-xs text-gray-400">Clusters</p>
    </div>
    <div class="bg-gray-750 rounded p-2 text-center bg-gray-700/50">
      <p class="text-lg font-bold text-white">{analytics.avgClusterSize.toFixed(1)}</p>
      <p class="text-xs text-gray-400">Avg Size</p>
    </div>
  </div>

  <!-- Entity distribution -->
  {#if distributionEntries.length > 0}
    <div class="mb-4">
      <h4 class="text-xs font-medium text-gray-400 mb-2">Entity Distribution</h4>
      <div class="flex flex-col gap-1.5">
        {#each distributionEntries as [type, count]}
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-300 w-20 truncate capitalize">{type}</span>
            <div class="flex-1 h-4 bg-gray-700 rounded overflow-hidden">
              <div
                class="h-full rounded {typeColors[type] ?? 'bg-gray-500'}"
                style="width: {(count / maxCount) * 100}%"
              ></div>
            </div>
            <span class="text-xs text-gray-400 w-6 text-right">{count}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Overall modularity -->
  <div class="flex items-center justify-between">
    <span class="text-xs text-gray-400">Overall Modularity</span>
    <span class="text-sm font-semibold {modularityColor}">
      {(analytics.overallModularity * 100).toFixed(1)}%
    </span>
  </div>
</div>
