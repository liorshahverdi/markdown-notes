<script lang="ts">
  import type { SkillRecord } from '../skills/skillTemplate';
  import { selectedSkillId } from '../stores/skills';

  interface Props {
    skills: SkillRecord[];
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
  }

  let { skills, onSelect, onDelete }: Props = $props();

  const typeBadgeColors: Record<string, string> = {
    single: 'bg-blue-100 text-blue-800',
    merged: 'bg-purple-100 text-purple-800',
    bridge: 'bg-orange-100 text-orange-800',
    composed: 'bg-green-100 text-green-800',
  };

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<div class="flex flex-col gap-1">
  {#if skills.length === 0}
    <p class="px-4 py-8 text-center text-sm text-gray-400">No skills yet. Generate one from a cluster.</p>
  {:else}
    {#each skills as skill (skill.id)}
      <button
        onclick={() => onSelect(skill.id)}
        class="flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-gray-50 transition-colors"
        class:bg-indigo-50={$selectedSkillId === skill.id}
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">{skill.name}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-xs text-gray-500">{skill.domain}</span>
            <span class="text-xs text-gray-400">{formatDate(skill.createdAt)}</span>
            {#if skill.versions.length > 0}
              <span class="text-xs text-gray-400">v{skill.versions.length + 1}</span>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-2 ml-2">
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {typeBadgeColors[skill.type] || 'bg-gray-100 text-gray-800'}">
            {skill.type}
          </span>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            onclick={(e: MouseEvent) => { e.stopPropagation(); onDelete(skill.id); }}
            onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onDelete(skill.id); } }}
            class="text-gray-400 hover:text-red-500 text-xs p-1 cursor-pointer"
            role="button"
            tabindex="0"
            aria-label="Delete skill"
          >
            x
          </span>
        </div>
      </button>
    {/each}
  {/if}
</div>
