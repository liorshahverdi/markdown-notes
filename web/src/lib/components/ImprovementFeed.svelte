<script lang="ts">
  import type { GraphProposal, GraphProposalStatus } from '../graph/proposals';

  interface Props {
    improvements: GraphProposal[];
    onAccept?: (proposal: GraphProposal) => void;
    onReject?: (proposal: GraphProposal) => void;
    onUndo?: (proposal: GraphProposal) => void;
  }

  let { improvements, onAccept, onReject, onUndo }: Props = $props();

  type Filter = 'pending' | 'applied' | 'all';
  let filter = $state<Filter>('pending');
  let busyId = $state<string | null>(null);

  const kindIcons: Record<GraphProposal['kind'], string> = {
    relation: '🔗',
    merge: '🔀',
    type_correction: '✏️',
    new_entity: '➕',
  };

  const sourceLabels: Record<string, string> = {
    cooccurrence: 'co-occurrence',
    duplicate: 'duplicate',
    llm_implicit: 'model: relation',
    llm_validation: 'model: type check',
    llm_missed: 'model: missed entity',
    transitive: 'multi-hop',
    user: 'you',
  };

  const statusClasses: Record<GraphProposalStatus, string> = {
    applied: 'bg-green-900 text-green-300',
    pending: 'bg-yellow-900 text-yellow-300',
    rejected: 'bg-red-900 text-red-300',
    undone: 'bg-gray-700 text-gray-300',
  };

  let visible = $derived(
    improvements.filter((proposal) =>
      filter === 'all' ? true : filter === 'pending' ? proposal.status === 'pending' : proposal.status === 'applied'
    )
  );
  let pendingCount = $derived(improvements.filter((proposal) => proposal.status === 'pending').length);

  function statusLabel(proposal: GraphProposal): string {
    if (proposal.status === 'applied') {
      if (proposal.reviewOutcome === 'accepted') return 'approved';
      return proposal.decidedBy === 'auto' ? 'auto-applied' : 'applied';
    }
    return proposal.status;
  }

  async function act(proposal: GraphProposal, handler?: (proposal: GraphProposal) => void | Promise<void>) {
    if (!handler || busyId) return;
    busyId = proposal.id;
    try {
      await handler(proposal);
    } finally {
      busyId = null;
    }
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex gap-1 text-xs" role="tablist" aria-label="Proposal filter">
    {#each [['pending', `Review (${pendingCount})`], ['applied', 'Applied'], ['all', 'All']] as [value, label] (value)}
      <button
        role="tab"
        aria-selected={filter === value}
        class="px-2 py-1 rounded border {filter === value ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}"
        onclick={() => (filter = value as Filter)}
      >
        {label}
      </button>
    {/each}
  </div>

  <div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
    {#if visible.length === 0}
      <p class="text-gray-400 text-sm text-center py-4">
        {filter === 'pending' ? 'Nothing waiting for review' : 'No improvements yet'}
      </p>
    {:else}
      {#each visible as proposal (proposal.id)}
        <div class="flex items-start gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <span class="text-lg" title={proposal.kind}>{kindIcons[proposal.kind] ?? '?'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-200 break-words">{proposal.description}</p>
            <p class="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-1">
              <span>{sourceLabels[proposal.source] ?? proposal.source}</span>
              <span>· {(proposal.confidence * 100).toFixed(0)}%</span>
              <span class="px-1.5 py-0.5 rounded text-xs {statusClasses[proposal.status]}">{statusLabel(proposal)}</span>
            </p>
          </div>
          <div class="flex flex-col gap-1 shrink-0">
            {#if proposal.status === 'pending'}
              <button
                disabled={busyId === proposal.id}
                onclick={() => act(proposal, onAccept)}
                class="text-xs px-2 py-1 bg-green-800 hover:bg-green-700 text-green-100 rounded border border-green-700"
              >Approve</button>
              <button
                disabled={busyId === proposal.id}
                onclick={() => act(proposal, onReject)}
                class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600"
              >Reject</button>
            {:else if proposal.status === 'applied'}
              {#if proposal.decidedBy === 'auto' && !proposal.reviewOutcome}
                <button
                  disabled={busyId === proposal.id}
                  onclick={() => act(proposal, onAccept)}
                  class="text-xs px-2 py-1 bg-green-900 hover:bg-green-800 text-green-200 rounded border border-green-800"
                >Confirm</button>
              {/if}
              <button
                disabled={busyId === proposal.id}
                onclick={() => act(proposal, onUndo)}
                class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600"
              >Undo</button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
