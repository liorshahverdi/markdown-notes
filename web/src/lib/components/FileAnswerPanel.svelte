<script lang="ts">
  import type { WikiCitation } from '$lib/wiki/query/queryPipeline';
  import type { WikiCoverage } from '$lib/wiki/query/wikiSearch';

  let {
    question,
    answer,
    citations = [],
    coverage = 'weak',
    usedRawFallback = false,
  }: {
    question: string;
    answer: string;
    citations?: WikiCitation[];
    coverage?: WikiCoverage;
    usedRawFallback?: boolean;
  } = $props();

  let statusMessage = $state('');
  let isFiling = $state(false);

  async function fileAnswer() {
    isFiling = true;
    statusMessage = '';
    try {
      const response = await fetch('/api/wiki/file-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, citations, coverage, usedRawFallback }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Failed to file answer');
      if (payload.status === 'filed') {
        statusMessage = `Filed to ${payload.wikiPath}`;
      } else {
        statusMessage = `Not filed: ${(payload.reasons ?? []).join(', ') || 'answer was not useful enough'}`;
      }
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Failed to file answer';
    } finally {
      isFiling = false;
    }
  }
</script>

<div class="mt-2 text-xs">
  <button
    type="button"
    class="rounded border border-indigo-300 px-2 py-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950"
    onclick={fileAnswer}
    disabled={isFiling}
  >
    {isFiling ? 'Filing…' : 'File answer to wiki'}
  </button>
  {#if statusMessage}
    <div class="mt-1 text-gray-500 dark:text-gray-400">{statusMessage}</div>
  {/if}
</div>
