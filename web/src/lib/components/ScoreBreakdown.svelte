<script lang="ts">
  interface Props {
    score: number;
    breakdown: Record<string, number>;
  }

  let { score, breakdown }: Props = $props();

  const entries = $derived(Object.entries(breakdown).sort((a, b) => b[1] - a[1]));

  const scoreColor = $derived(
    score >= 0.7
      ? 'text-green-400'
      : score >= 0.4
        ? 'text-yellow-400'
        : 'text-red-400'
  );

  function barColor(value: number): string {
    if (value >= 0.7) return 'bg-green-500';
    if (value >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  const labelMap: Record<string, string> = {
    density: 'Density',
    entityCount: 'Entity Count',
    noteCount: 'Note Count',
    freshness: 'Freshness',
    modularity: 'Modularity',
    coverage: 'Coverage',
  };
</script>

<div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-semibold text-gray-200">Score Breakdown</h3>
    <span class="text-lg font-bold {scoreColor}">
      {(score * 100).toFixed(0)}%
    </span>
  </div>

  <div class="flex flex-col gap-2">
    {#each entries as [key, value]}
      <div>
        <div class="flex items-center justify-between mb-0.5">
          <span class="text-xs text-gray-400">{labelMap[key] ?? key}</span>
          <span class="text-xs text-gray-300">{(value * 100).toFixed(0)}%</span>
        </div>
        <div class="h-2 bg-gray-700 rounded overflow-hidden">
          <div
            class="h-full rounded {barColor(value)}"
            style="width: {Math.min(value * 100, 100)}%"
          ></div>
        </div>
      </div>
    {/each}
  </div>
</div>
