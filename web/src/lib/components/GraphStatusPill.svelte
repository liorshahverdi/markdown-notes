<script lang="ts">
  import type { GraphLoopStatus } from '../graph/proposals';

  interface Props {
    status: GraphLoopStatus | null;
    /** True while the Laguna lease/start request is in flight. */
    modelStarting?: boolean;
    onStartModel?: () => void;
    href?: string;
  }

  let { status, modelStarting = false, onStartModel, href = '/experimental/knowledge-graph' }: Props = $props();

  let label = $derived.by(() => {
    if (!status) return '';
    if (status.running) return 'Graph · analyzing…';
    if (status.pendingReview > 0) return `Graph · ${status.pendingReview} to review`;
    return 'Graph · up to date';
  });
</script>

{#if status}
  <span class="graph-pill">
    <a
      class="graph-pill__link"
      {href}
      aria-busy={status.running ? 'true' : 'false'}
      title={status.queuedNotes > 0 ? `${status.queuedNotes} notes waiting for model analysis` : 'Knowledge graph review queue'}
    >
      <span class="graph-pill__dot" class:is-running={status.running} class:has-work={status.pendingReview > 0} aria-hidden="true"></span>
      <span class="label-meta">{label}</span>
      {#if status.queuedNotes > 0}
        <span class="label-meta graph-pill__queued">· {status.queuedNotes} queued</span>
      {/if}
    </a>
    {#if status.modelSkipped && !modelStarting && onStartModel}
      <button
        type="button"
        class="graph-pill__start"
        onclick={() => onStartModel?.()}
        aria-label={`Start Laguna to analyze ${status.queuedNotes} notes`}
        title="The last pass skipped model analysis because Laguna was not loaded"
      >Start</button>
    {/if}
  </span>
{/if}

<style>
  .graph-pill {
    white-space: nowrap;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border-radius: 999px;
    background: var(--color-surface);
    border: 1px solid var(--color-border-subtle);
  }

  .graph-pill__link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: inherit;
    text-decoration: none;
  }

  .graph-pill__link:hover .label-meta {
    color: var(--color-text);
  }

  .graph-pill__queued {
    opacity: 0.75;
  }

  .graph-pill__dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--color-text-secondary);
  }

  .graph-pill__dot.has-work {
    background: #d97706;
  }

  .graph-pill__dot.is-running {
    background: #6366f1;
    animation: graph-pill-pulse 1.2s ease-in-out infinite;
  }

  .graph-pill__start {
    border: 0;
    border-radius: 999px;
    padding: 1px 7px;
    font-size: 11px;
    background: #d97706;
    color: white;
    cursor: pointer;
  }

  @keyframes graph-pill-pulse {
    50% {
      opacity: 0.35;
    }
  }
</style>
