<script lang="ts">
  import LintFindingsPanel from '$lib/components/LintFindingsPanel.svelte';
  import LegacyMigrationPanel from '$lib/components/LegacyMigrationPanel.svelte';
  import WikiIndexView from '$lib/components/WikiIndexView.svelte';
  import WikiLogView from '$lib/components/WikiLogView.svelte';
</script>

<svelte:head>
  <title>Maintenance · MarkdownNotes</title>
</svelte:head>

<div class="maintenance-page">
  <header class="maintenance-header">
    <p class="eyebrow">Admin</p>
    <h1>Maintenance</h1>
    <p>Operational wiki tools live here instead of the everyday writing homepage.</p>
  </header>

  <div class="maintenance-grid">
    <LintFindingsPanel />
    <LegacyMigrationPanel />
    <WikiIndexView />
    <WikiLogView />
  </div>
</div>

<style>
  .maintenance-page {
    min-height: 100%;
    overflow: auto;
    padding: 32px;
    background: var(--color-bg);
  }

  .maintenance-header {
    margin: 0 auto 24px;
    max-width: 1100px;
  }

  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
  }

  h1 {
    margin: 4px 0 8px;
    font-size: 28px;
    color: var(--color-text);
  }

  p {
    color: var(--color-text-secondary);
  }

  .maintenance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    max-width: 1100px;
    margin: 0 auto;
  }
</style>
