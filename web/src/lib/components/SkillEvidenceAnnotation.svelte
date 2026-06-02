<script lang="ts">
  import type { EvidenceLink } from '../skills/evidenceLinker';

  interface Props {
    link: EvidenceLink;
    onClick?: (link: EvidenceLink) => void;
  }

  let { link, onClick }: Props = $props();
  let showPassage = $state(false);
</script>

<span
  class="relative inline-block"
  role="button"
  tabindex="0"
  onmouseenter={() => (showPassage = true)}
  onmouseleave={() => (showPassage = false)}
  onclick={() => onClick?.(link)}
  onkeydown={(e) => e.key === 'Enter' && onClick?.(link)}
>
  <span class="cursor-pointer text-indigo-600 underline decoration-dotted hover:text-indigo-800 text-sm">
    {link.citation}
  </span>

  {#if showPassage}
    <div class="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
      <p class="text-xs font-semibold text-gray-700 mb-1">{link.noteTitle}</p>
      <p class="text-xs text-gray-600 line-clamp-4">{link.matchedPassage}</p>
    </div>
  {/if}
</span>
