<script lang="ts">
  import type { GraphHealthMetrics } from '../graph/graphScorer';

  interface Props {
    metrics: GraphHealthMetrics;
  }

  let { metrics }: Props = $props();

  const scoreColor = $derived(
    metrics.overallScore >= 70
      ? '#2ecc71'
      : metrics.overallScore >= 40
        ? '#f39c12'
        : '#e74c3c'
  );

  const circumference = 2 * Math.PI * 45;
  const strokeOffset = $derived(
    circumference - (metrics.overallScore / 100) * circumference
  );
</script>

<div class="relative inline-flex items-center justify-center group" title="Graph Health Score">
  <svg width="100" height="100" viewBox="0 0 100 100">
    <!-- Background circle -->
    <circle
      cx="50"
      cy="50"
      r="45"
      fill="none"
      stroke="#374151"
      stroke-width="8"
    />
    <!-- Progress circle -->
    <circle
      cx="50"
      cy="50"
      r="45"
      fill="none"
      stroke={scoreColor}
      stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={strokeOffset}
      transform="rotate(-90 50 50)"
      class="transition-all duration-500"
    />
    <!-- Score text -->
    <text
      x="50"
      y="50"
      text-anchor="middle"
      dominant-baseline="central"
      fill={scoreColor}
      font-size="20"
      font-weight="bold"
    >
      {metrics.overallScore}
    </text>
  </svg>

  <!-- Tooltip -->
  <div
    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-gray-200 text-xs rounded-lg border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10"
  >
    <p>Nodes: {metrics.totalNodes} | Edges: {metrics.totalEdges}</p>
    <p>Clusters: {metrics.totalClusters} (avg: {metrics.avgClusterSize.toFixed(1)})</p>
    <p>Connectivity: {(metrics.connectivity * 100).toFixed(1)}%</p>
    <p>Orphans: {metrics.orphanCount}</p>
  </div>
</div>
