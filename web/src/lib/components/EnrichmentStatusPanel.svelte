<script lang="ts">
  import type { EnrichmentStatus } from '../stores/graph';

  interface Props {
    status: EnrichmentStatus;
  }

  let { status }: Props = $props();

  function pct(value: number | null | undefined): string {
    return value == null ? '—' : `${Math.round(value * 100)}%`;
  }

  let lastRun = $derived(status.runs[0] ?? null);
  let metrics = $derived(status.metrics);
</script>

<div class="flex flex-col gap-3 text-xs text-gray-800 dark:text-gray-200">
  {#if metrics}
    <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
      <dt class="text-gray-500 dark:text-gray-400">Precision (reviewed)</dt><dd>{pct(metrics.precision)}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Edges with provenance</dt><dd>{pct(metrics.provenanceCoverage)}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Wrong-merge rate</dt><dd>{pct(metrics.wrongMergeRate)}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Duplicate rate</dt><dd>{pct(metrics.duplicateRate)}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Waiting for review</dt><dd>{metrics.pendingProposals}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Auto-applied, unreviewed</dt><dd>{metrics.autoAppliedUnreviewed}</dd>
    </dl>
  {/if}

  {#if status.evalResult}
    <p>
      <span class="text-gray-500 dark:text-gray-400">Retrieval check:</span>
      {#if status.evalResult.queryCount > 0}
        recall {pct(status.evalResult.recallAtK)} · MRR {status.evalResult.mrr?.toFixed(2)} over {status.evalResult.queryCount} saved questions
      {:else}
        no saved questions yet — opening a cited note from a chat answer adds one
      {/if}
    </p>
  {/if}

  {#if lastRun}
    <div>
      <p class="text-gray-500 dark:text-gray-400">
        Last pass · {new Date(lastRun.startedAt).toLocaleString()} · {lastRun.trigger} · {lastRun.status}
      </p>
      <p>
        {lastRun.stats.cooccurrenceProposals ?? 0} links · {lastRun.stats.duplicateProposals ?? 0} merges ·
        {lastRun.stats.implicitProposals ?? 0} model links · {lastRun.stats.typeProposals ?? 0} type fixes ·
        {lastRun.stats.missedEntityProposals ?? 0} new entities · {lastRun.stats.autoApplied ?? 0} auto-applied
      </p>
      <p class="text-gray-500 dark:text-gray-400">
        Model {lastRun.stats.llmAvailable ? 'available' : 'offline (model stages skipped)'}
        {#if lastRun.stats.llmQueueRemaining}· {lastRun.stats.llmQueueRemaining} notes queued{/if}
      </p>
      {#if lastRun.gateReverted}
        <p class="text-amber-700 dark:text-amber-400">Retrieval got worse — {lastRun.gateReverted} auto-applied changes were sent back to review.</p>
      {/if}
      {#if lastRun.error}
        <p class="text-red-700 dark:text-red-400">{lastRun.error}</p>
      {/if}
    </div>
  {/if}

  {#if status.thresholds.some((threshold) => threshold.reviewed > 0)}
    <div>
      <p class="text-gray-500 dark:text-gray-400 mb-1">Auto-apply thresholds (learned from your reviews)</p>
      <ul class="space-y-0.5">
        {#each status.thresholds.filter((threshold) => threshold.reviewed > 0) as threshold (threshold.source)}
          <li>
            {threshold.source}: {threshold.threshold == null ? 'review only' : pct(threshold.threshold)}
            <span class="text-gray-500 dark:text-gray-400">({threshold.reviewed} reviewed, {pct(threshold.acceptanceRate)} accepted — {threshold.reason})</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
