<script lang="ts">
  import { generatingSkill } from '../stores/skills';

  interface Props {
    skillMarkdown: string;
    onApprove: (markdown: string) => void;
    onReject: () => void;
    onRegenerate: () => void;
  }

  let { skillMarkdown, onApprove, onReject, onRegenerate }: Props = $props();
  let editableMarkdown = $state(skillMarkdown);

  $effect(() => {
    editableMarkdown = skillMarkdown;
  });

  function handleApprove() {
    onApprove(editableMarkdown);
  }
</script>

<div class="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm">
  <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
    <h2 class="text-sm font-semibold text-gray-900">Skill Review</h2>
    {#if $generatingSkill}
      <span class="text-xs text-indigo-600 animate-pulse">Generating...</span>
    {/if}
  </div>

  <div class="flex-1 overflow-auto p-4">
    <textarea
      bind:value={editableMarkdown}
      class="w-full h-full min-h-[400px] resize-none rounded-md border border-gray-300 p-3 text-sm font-mono text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      placeholder="Generated skill markdown will appear here..."
    ></textarea>
  </div>

  <div class="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
    <button
      onclick={onReject}
      class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      Reject
    </button>
    <button
      onclick={onRegenerate}
      class="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
    >
      Regenerate
    </button>
    <button
      onclick={handleApprove}
      class="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
    >
      Approve & Save
    </button>
  </div>
</div>
