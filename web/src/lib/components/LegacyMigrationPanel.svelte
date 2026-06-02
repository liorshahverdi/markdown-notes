<script lang="ts">
  let loading = $state(false);
  let error = $state('');
  let result = $state<{ totalNotes: number; migrated: number; skipped: number; sourceIds: string[] } | null>(null);

  async function runMigration() {
    loading = true;
    error = '';
    result = null;
    try {
      const response = await fetch('/api/migration/notes-to-sources', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to migrate legacy notes');
      result = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to migrate legacy notes';
    } finally {
      loading = false;
    }
  }
</script>

<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="legacy-migration-panel">
  <div class="mb-3">
    <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Legacy Notes Migration</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400">Bring existing notes into the raw-source/wiki model without deleting legacy notes.</p>
  </div>

  <button
    type="button"
    class="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
    disabled={loading}
    onclick={runMigration}
  >
    {loading ? 'Migrating…' : 'Migrate legacy notes'}
  </button>

  {#if error}
    <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#if result}
    <p class="mt-3 text-sm text-gray-700 dark:text-gray-200">
      Migrated {result.migrated} of {result.totalNotes} notes. Skipped {result.skipped} already migrated notes.
    </p>
  {/if}
</section>
