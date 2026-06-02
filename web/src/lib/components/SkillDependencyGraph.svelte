<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SkillRecord } from '../skills/skillTemplate';
  import { buildDependencyDAG } from '../skills/skillDependencyGraph';

  interface Props {
    skills: SkillRecord[];
    onNodeClick?: (skillId: string) => void;
  }

  let { skills, onNodeClick }: Props = $props();

  let container: HTMLDivElement;
  let network: any = null;

  const typeColors: Record<string, { background: string; border: string }> = {
    single: { background: '#93c5fd', border: '#3b82f6' },
    merged: { background: '#c4b5fd', border: '#8b5cf6' },
    bridge: { background: '#fdba74', border: '#f97316' },
    composed: { background: '#86efac', border: '#22c55e' },
  };

  async function initNetwork() {
    const { Network } = await import('vis-network');
    const { DataSet } = await import('vis-data');

    const { nodes: dagNodes, edges: dagEdges } = buildDependencyDAG(skills);

    const nodeDataSet = new DataSet(
      dagNodes.map((n) => ({
        id: n.skillId,
        label: n.name,
        color: typeColors[n.type] || typeColors.single,
        shape: 'box',
        font: { size: 12 },
      }))
    );

    const edgeDataSet = new DataSet(
      dagEdges.map((e, i) => ({
        id: `edge-${i}`,
        from: e.from,
        to: e.to,
        arrows: 'to',
        dashes: e.type === 'enhances',
        label: e.type,
        font: { size: 9, color: '#9ca3af' },
      }))
    );

    const options = {
      layout: {
        hierarchical: {
          direction: 'UD',
          sortMethod: 'directed',
          levelSeparation: 80,
          nodeSpacing: 120,
        },
      },
      physics: false,
      interaction: {
        hover: true,
      },
      edges: {
        smooth: { enabled: true, type: 'cubicBezier', roundness: 0.5 },
      },
    };

    network = new Network(container, { nodes: nodeDataSet, edges: edgeDataSet }, options);

    network.on('click', (params: { nodes: string[] }) => {
      if (params.nodes.length > 0 && onNodeClick) {
        onNodeClick(params.nodes[0]);
      }
    });
  }

  onMount(() => {
    if (skills.length > 0) {
      initNetwork();
    }
  });

  onDestroy(() => {
    if (network) {
      network.destroy();
      network = null;
    }
  });

  $effect(() => {
    // Re-init when skills change
    if (skills.length > 0 && container) {
      if (network) {
        network.destroy();
        network = null;
      }
      initNetwork();
    }
  });
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
  <div class="border-b border-gray-200 px-4 py-2">
    <h3 class="text-sm font-semibold text-gray-900">Skill Dependencies</h3>
  </div>
  <div bind:this={container} class="h-96 w-full"></div>
  {#if skills.length === 0}
    <p class="px-4 py-8 text-center text-sm text-gray-400">No skills to visualize.</p>
  {/if}
</div>
