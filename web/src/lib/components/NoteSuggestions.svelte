<script lang="ts">
  import { presentProposal } from '../graph/proposalPresenter';
  import type { GraphProposal } from '../graph/proposals';
  import { refreshGraphStatus } from '../stores/graph';

  interface Props {
    noteId: string;
    /** Changes when a new enrichment pass finishes, to pick up new suggestions. */
    refreshKey?: string | null;
    /** Highlight (or clear with null) the quoted evidence in the rendered note. */
    onHighlight?: (quote: string | null) => void;
  }

  let { noteId, refreshKey = null, onHighlight }: Props = $props();

  let proposals = $state<GraphProposal[]>([]);
  let busyId = $state<string | null>(null);
  let expanded = $state(false);
  const COLLAPSED_COUNT = 6;

  async function load(id: string) {
    try {
      const response = await fetch(`/api/graph/proposals?noteId=${encodeURIComponent(id)}&status=pending`);
      if (!response.ok) return;
      const data = (await response.json()) as { proposals: GraphProposal[] };
      if (id === noteId) proposals = data.proposals;
    } catch {
      // Suggestions are optional; ignore hub hiccups.
    }
  }

  $effect(() => {
    void refreshKey;
    proposals = [];
    expanded = false;
    void load(noteId);
  });

  let items = $derived(proposals.map((proposal) => ({ proposal, view: presentProposal(proposal, noteId) })));
  let visible = $derived(expanded ? items : items.slice(0, COLLAPSED_COUNT));

  async function decide(proposal: GraphProposal, action: 'accept' | 'reject') {
    if (busyId) return;
    busyId = proposal.id;
    try {
      const response = await fetch(`/api/graph/proposals/${encodeURIComponent(proposal.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        proposals = proposals.filter((item) => item.id !== proposal.id);
        onHighlight?.(null);
        void refreshGraphStatus();
      }
    } finally {
      busyId = null;
    }
  }
</script>

{#if items.length > 0}
  <section class="note-suggestions" aria-label="Graph suggestions for this note">
    <p class="note-suggestions__title">
      Laguna · {items.length} {items.length === 1 ? 'suggestion' : 'suggestions'} for this note
    </p>
    <ul class="note-suggestions__list">
      {#each visible as { proposal, view } (proposal.id)}
        <li
          class="note-suggestions__item"
          onmouseenter={() => onHighlight?.(view.quote)}
          onmouseleave={() => onHighlight?.(null)}
          onfocusin={() => onHighlight?.(view.quote)}
          onfocusout={() => onHighlight?.(null)}
          title={proposal.description}
        >
          <span class="note-suggestions__label">{view.label}</span>
          <span class="note-suggestions__detail">{view.detail}</span>
          <button
            type="button"
            class="note-suggestions__action is-accept"
            aria-label={`Approve ${view.label}`}
            disabled={busyId === proposal.id}
            onclick={() => decide(proposal, 'accept')}
          >✓</button>
          <button
            type="button"
            class="note-suggestions__action"
            aria-label={`Reject ${view.label}`}
            disabled={busyId === proposal.id}
            onclick={() => decide(proposal, 'reject')}
          >✕</button>
        </li>
      {/each}
    </ul>
    {#if items.length > COLLAPSED_COUNT}
      <button type="button" class="note-suggestions__more" onclick={() => (expanded = !expanded)}>
        {expanded ? 'Show fewer' : `Show all ${items.length}`}
      </button>
    {/if}
  </section>
{/if}

<style>
  .note-suggestions {
    /* Stay visible while the preview scrolls to the highlighted evidence. */
    position: sticky;
    top: 0;
    z-index: 5;
    margin: 12px 16px 0;
    padding: 8px 10px;
    border: 1px solid var(--color-border-subtle);
    border-radius: 10px;
    background: var(--color-surface);
  }

  .note-suggestions__title {
    margin: 0 0 6px;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .note-suggestions__list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .note-suggestions__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 2px 9px;
    border: 1px solid var(--color-border-subtle);
    border-radius: 999px;
    font-size: 12px;
    background: var(--color-bg);
  }

  .note-suggestions__item:hover,
  .note-suggestions__item:focus-within {
    border-color: #d97706;
  }

  .note-suggestions__label {
    color: var(--color-text);
  }

  .note-suggestions__detail {
    color: var(--color-text-secondary);
    font-size: 11px;
  }

  .note-suggestions__action {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .note-suggestions__action:hover:not(:disabled) {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .note-suggestions__action.is-accept:hover:not(:disabled) {
    color: #15803d;
  }

  .note-suggestions__more {
    margin-top: 6px;
    border: 0;
    background: transparent;
    font-size: 11px;
    color: var(--color-text-secondary);
    cursor: pointer;
  }
</style>
