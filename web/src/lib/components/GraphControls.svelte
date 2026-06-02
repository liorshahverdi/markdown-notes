<script lang="ts">
  import { entityTypeFilter, graphSearchText } from '$lib/stores/graph';
  import { NODE_COLORS } from '../graph/graphBuilder';
  import type { EntityType } from '../../types/graph';

  const entityTypes: { type: EntityType; label: string }[] = [
    { type: 'note', label: 'Notes' },
    { type: 'Person', label: 'People' },
    { type: 'Object', label: 'Objects' },
    { type: 'Location', label: 'Locations' },
    { type: 'Event', label: 'Events' },
    { type: 'Other', label: 'Other' },
  ];

  interface Props {
    onLayoutChange?: (layout: 'force' | 'hierarchical') => void;
  }

  let { onLayoutChange }: Props = $props();

  let layout: 'force' | 'hierarchical' = $state('force');

  function toggleType(type: string) {
    entityTypeFilter.update((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function handleLayoutToggle() {
    layout = layout === 'force' ? 'hierarchical' : 'force';
    onLayoutChange?.(layout);
  }
</script>

<div class="flex flex-col gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
  <div>
    <label class="block text-sm font-medium text-gray-300 mb-2" for="graph-search">Search</label>
    <input
      id="graph-search"
      type="text"
      bind:value={$graphSearchText}
      placeholder="Search entities..."
      class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
    />
  </div>

  <div>
    <p class="text-sm font-medium text-gray-300 mb-2">Entity Types</p>
    <div class="flex flex-col gap-1">
      {#each entityTypes as { type, label }}
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white">
          <input
            type="checkbox"
            checked={$entityTypeFilter.has(type)}
            onchange={() => toggleType(type)}
            class="rounded border-gray-600"
          />
          <span
            class="inline-block w-3 h-3 rounded-full"
            style="background-color: {NODE_COLORS[type]}"
          ></span>
          {label}
        </label>
      {/each}
    </div>
  </div>

  <div>
    <button
      onclick={handleLayoutToggle}
      class="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded border border-gray-600 transition-colors"
    >
      Layout: {layout === 'force' ? 'Force-Directed' : 'Hierarchical'}
    </button>
  </div>
</div>
