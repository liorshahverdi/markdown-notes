<script lang="ts">
  import type { ClusterQuality } from '../graph/clusterMetrics';

  interface Props {
    qualities: ClusterQuality[];
  }

  let { qualities }: Props = $props();

  function qualityScore(q: ClusterQuality): number {
    // Composite quality: weighted average of modularity, density, and coverage
    return q.modularity * 0.4 + q.internalDensity * 0.3 + q.coverage * 0.3;
  }

  function qualityColor(score: number): string {
    if (score >= 0.7) return 'border-green-500 bg-green-900/30';
    if (score >= 0.4) return 'border-yellow-500 bg-yellow-900/30';
    return 'border-red-500 bg-red-900/30';
  }

  function qualityBadgeColor(score: number): string {
    if (score >= 0.7) return 'bg-green-800 text-green-200';
    if (score >= 0.4) return 'bg-yellow-800 text-yellow-200';
    return 'bg-red-800 text-red-200';
  }
</script>

<div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
  <h3 class="text-sm font-semibold text-gray-200 mb-3">Cluster Quality</h3>

  {#if qualities.length === 0}
    <p class="text-gray-400 text-sm text-center py-4">No clusters detected</p>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {#each qualities as quality (quality.clusterId)}
        {@const score = qualityScore(quality)}
        <div class="rounded-lg border-2 p-3 {qualityColor(score)}">
          <div class="flex items-start justify-between mb-2">
            <h4 class="text-sm font-medium text-gray-200 truncate flex-1">{quality.clusterName}</h4>
            <span class="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded {qualityBadgeColor(score)}">
              {(score * 100).toFixed(0)}%
            </span>
          </div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-400">Modularity</span>
              <span class="text-gray-300">{(quality.modularity * 100).toFixed(0)}%</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Density</span>
              <span class="text-gray-300">{(quality.internalDensity * 100).toFixed(0)}%</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Entities</span>
              <span class="text-gray-300">{quality.entityCount}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Notes</span>
              <span class="text-gray-300">{quality.noteCount}</span>
            </div>
            <div class="flex justify-between col-span-2">
              <span class="text-gray-400">Coverage</span>
              <span class="text-gray-300">{(quality.coverage * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
