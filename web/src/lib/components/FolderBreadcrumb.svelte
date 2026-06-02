<script lang="ts">
  import { selectedFolderId, getBreadcrumbs } from '$lib/stores/folders';

  let crumbs = $derived(getBreadcrumbs($selectedFolderId));
</script>

{#if crumbs.length > 1}
  <nav class="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto" aria-label="Folder breadcrumb">
    {#each crumbs as crumb, i (crumb.id ?? 'root')}
      {#if i > 0}
        <span class="text-gray-300 dark:text-gray-600">/</span>
      {/if}
      {#if i === crumbs.length - 1}
        <span class="font-medium text-gray-700 dark:text-gray-300 truncate">{crumb.name}</span>
      {:else}
        <button
          type="button"
          class="hover:text-blue-500 dark:hover:text-blue-400 truncate cursor-pointer"
          onclick={() => selectedFolderId.set(crumb.id)}
        >
          {crumb.name}
        </button>
      {/if}
    {/each}
  </nav>
{/if}
