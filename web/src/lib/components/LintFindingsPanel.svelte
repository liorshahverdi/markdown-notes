<script lang="ts">
  import { onMount } from 'svelte';
  import type { WikiLintFinding, WikiLintSummary } from '$lib/wiki/lint/types';

  let findings = $state<WikiLintFinding[]>([]);
  let summary = $state<WikiLintSummary>({ total: 0, errors: 0, warnings: 0, info: 0 });
  let error = $state('');
  let loading = $state(true);

  async function loadFindings() {
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/wiki/lint');
      if (!response.ok) throw new Error('Failed to load wiki health findings');
      const payload = await response.json();
      findings = payload.findings ?? [];
      summary = payload.summary ?? { total: findings.length, errors: 0, warnings: 0, info: 0 };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load wiki health findings';
    } finally {
      loading = false;
    }
  }

  onMount(loadFindings);
</script>

<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="lint-findings-panel">
  <div class="mb-3 flex items-center justify-between gap-2">
    <div>
      <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Wiki Health</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {summary.total} findings · {summary.errors} errors · {summary.warnings} warnings
      </p>
    </div>
    <button type="button" class="rounded border px-2 py-1 text-xs text-gray-600 dark:text-gray-300" onclick={loadFindings}>
      Refresh
    </button>
  </div>

  {#if loading}
    <p class="text-sm text-gray-500 dark:text-gray-400">Checking wiki health…</p>
  {:else if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {:else if findings.length === 0}
    <p class="text-sm text-green-600 dark:text-green-400">No actionable wiki health findings.</p>
  {:else}
    <div class="space-y-2">
      {#each findings as finding}
        <article class="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
          <div class="flex items-center gap-2">
            <span class="rounded px-1.5 py-0.5 text-xs {finding.severity === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'}">
              {finding.severity}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{finding.type}</span>
          </div>
          <p class="mt-1 font-medium text-gray-900 dark:text-gray-100">{finding.message}</p>
          <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">{finding.action}</p>
        </article>
      {/each}
    </div>
  {/if}
</section>
