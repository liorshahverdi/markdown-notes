<script lang="ts">
  import type { Cluster } from '../skills/clusterDetector';

  interface Props {
    cluster: Cluster & { score: number };
    onGenerate: (cluster: Cluster) => void;
  }

  let { cluster, onGenerate }: Props = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
  <div class="flex items-start justify-between">
    <div class="flex-1 min-w-0">
      <h3 class="text-sm font-semibold text-gray-900 truncate">{cluster.name}</h3>
      <div class="mt-1 flex items-center gap-3 text-xs text-gray-500">
        <span>{cluster.entityIds.length} entities</span>
        <span>{cluster.noteIds.length} notes</span>
        <span>density: {cluster.density.toFixed(2)}</span>
      </div>
    </div>
    <div class="ml-2 flex-shrink-0">
      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        class:bg-green-100={cluster.score >= 0.7}
        class:text-green-800={cluster.score >= 0.7}
        class:bg-yellow-100={cluster.score >= 0.4 && cluster.score < 0.7}
        class:text-yellow-800={cluster.score >= 0.4 && cluster.score < 0.7}
        class:bg-gray-100={cluster.score < 0.4}
        class:text-gray-800={cluster.score < 0.4}
      >
        {(cluster.score * 100).toFixed(0)}%
      </span>
    </div>
  </div>
  <div class="mt-3">
    <button
      onclick={() => onGenerate(cluster)}
      class="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
    >
      Generate Skill
    </button>
  </div>
</div>
