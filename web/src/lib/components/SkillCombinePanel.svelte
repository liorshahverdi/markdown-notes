<script lang="ts">
  import type { SkillRecord } from '../skills/skillTemplate';

  interface Props {
    skills: SkillRecord[];
    onCombine: (selectedIds: string[], mode: 'merge' | 'chain' | 'bridge') => void;
  }

  let { skills, onCombine }: Props = $props();
  let selectedIds = $state<Set<string>>(new Set());
  let mode = $state<'merge' | 'chain' | 'bridge'>('merge');

  function toggleSkill(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }

  function handleCombine() {
    if (selectedIds.size < 2) return;
    onCombine(Array.from(selectedIds), mode);
  }

  let canCombine = $derived(selectedIds.size >= 2);
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
  <h2 class="text-sm font-semibold text-gray-900 mb-3">Combine Skills</h2>

  <div class="mb-3">
    <label class="block text-xs font-medium text-gray-700 mb-1">Mode</label>
    <div class="flex gap-2">
      {#each ['merge', 'chain', 'bridge'] as m}
        <button
          onclick={() => mode = m as typeof mode}
          class="rounded-md px-3 py-1 text-xs font-medium border transition-colors"
          class:bg-indigo-600={mode === m}
          class:text-white={mode === m}
          class:border-indigo-600={mode === m}
          class:bg-white={mode !== m}
          class:text-gray-700={mode !== m}
          class:border-gray-300={mode !== m}
        >
          {m}
        </button>
      {/each}
    </div>
  </div>

  <div class="mb-3 max-h-48 overflow-y-auto">
    <label class="block text-xs font-medium text-gray-700 mb-1">
      Select skills ({selectedIds.size} selected)
    </label>
    {#each skills as skill (skill.id)}
      <label class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
        <input
          type="checkbox"
          checked={selectedIds.has(skill.id)}
          onchange={() => toggleSkill(skill.id)}
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span class="text-sm text-gray-800 truncate">{skill.name}</span>
        <span class="text-xs text-gray-400 ml-auto">{skill.domain}</span>
      </label>
    {/each}
  </div>

  <button
    onclick={handleCombine}
    disabled={!canCombine}
    class="w-full rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
    class:bg-indigo-600={canCombine}
    class:hover:bg-indigo-700={canCombine}
    class:bg-gray-300={!canCombine}
    class:cursor-not-allowed={!canCombine}
  >
    Combine {selectedIds.size} Skills
  </button>
</div>
