<script lang="ts">
  import WikiIndexView from '$lib/components/WikiIndexView.svelte';
  import WikiLogView from '$lib/components/WikiLogView.svelte';
</script>

<svelte:head>
  <title>Experimental wiki</title>
</svelte:head>

<main class="wiki-page">
  <header>
    <p class="eyebrow">Experimental</p>
    <h1>Generated wiki artifacts</h1>
    <p>
      Generated wiki pages are optional derived artifacts. Notes and user-approved graph edits remain the canonical memory.
    </p>
  </header>

  <section class="wiki-grid">
    <WikiIndexView />
    <WikiLogView />
  </section>
</main>

<style>
  .wiki-page {
    min-height: 100%;
    padding: 32px;
    background: var(--color-bg);
    color: var(--color-text);
  }

  header {
    max-width: 760px;
    margin-bottom: 24px;
  }

  .eyebrow {
    margin: 0 0 8px;
    font: 600 11px/1 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
  }

  h1 {
    margin: 0 0 10px;
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  header p:last-child {
    margin: 0;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .wiki-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    gap: 20px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .wiki-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
