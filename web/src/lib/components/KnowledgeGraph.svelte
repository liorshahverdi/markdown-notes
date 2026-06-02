<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GraphNode, GraphEdge } from '../../types/graph';
  import { NODE_COLORS } from '../graph/graphBuilder';

  interface Props {
    nodes: GraphNode[];
    edges: GraphEdge[];
    onNodeClick: (nodeId: string) => void;
  }

  let { nodes, edges, onNodeClick }: Props = $props();

  let container: HTMLDivElement;
  let network: any = null;

  const groupColors: Record<string, { background: string; border: string }> = {
    note: { background: NODE_COLORS.note, border: '#2980b9' },
    Person: { background: NODE_COLORS.Person, border: '#27ae60' },
    Object: { background: NODE_COLORS.Object, border: '#e67e22' },
    Location: { background: NODE_COLORS.Location, border: '#d4ac0d' },
    Event: { background: NODE_COLORS.Event, border: '#db2777' },
    Other: { background: NODE_COLORS.Other, border: '#16a085' },
    folder: { background: NODE_COLORS.folder, border: '#7c3aed' },
  };

  async function initNetwork() {
    const { Network } = await import('vis-network');
    const { DataSet } = await import('vis-data');

    const nodeDataSet = new DataSet(
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        group: n.group,
        title: n.title,
        size: n.size ?? 15,
      }))
    );

    const edgeDataSet = new DataSet(
      edges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.label,
        dashes: e.dashes ?? false,
        width: e.width ?? 1,
      }))
    );

    const options = {
      groups: Object.fromEntries(
        Object.entries(groupColors).map(([key, val]) => [
          key,
          {
            color: val,
            font: { color: '#ffffff' },
            shape: 'dot',
          },
        ])
      ),
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
        },
        stabilization: { iterations: 150 },
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
        font: { size: 10, color: '#888' },
        color: { color: '#aaa', highlight: '#3498db' },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
      },
    };

    network = new Network(container, { nodes: nodeDataSet, edges: edgeDataSet }, options);

    network.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        onNodeClick(params.nodes[0]);
      }
    });
  }

  onMount(() => {
    if (container) {
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
    // Track nodes and edges so effect re-runs when they change
    const _n = nodes.length;
    const _e = edges.length;
    if (network && container) {
      network.destroy();
      initNetwork();
    }
  });
</script>

<div
  bind:this={container}
  class="w-full h-full min-h-[400px] bg-gray-900 rounded-lg border border-gray-700"
></div>
