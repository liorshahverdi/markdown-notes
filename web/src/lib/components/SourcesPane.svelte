<script lang="ts">
  import { onMount } from 'svelte';
  import {
    importSource,
    loadSources,
    sourceImportDraft,
    sources,
    sourcesError,
    sourcesLoading,
  } from '$lib/stores/sources';

  onMount(() => {
    void loadSources();
  });

  function updateDraft<K extends 'title' | 'content' | 'sourceType'>(key: K, value: string) {
    sourceImportDraft.update((draft) => ({ ...draft, [key]: value }));
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    await importSource();
  }

  function formatImportedAt(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
</script>

<div class="sources-pane" data-testid="sources-pane">
  <div class="sources-pane__header">
    <div>
      <p class="sources-pane__eyebrow">LLM Wiki sources</p>
      <h3 class="sources-pane__title">Import source material</h3>
    </div>
  </div>

  <form class="sources-pane__form" onsubmit={handleSubmit}>
    <input
      data-testid="source-title-input"
      class="sources-pane__input"
      type="text"
      placeholder="Source title"
      value={$sourceImportDraft.title}
      oninput={(event) => updateDraft('title', (event.currentTarget as HTMLInputElement).value)}
    />
    <select
      data-testid="source-type-input"
      class="sources-pane__input"
      value={$sourceImportDraft.sourceType}
      onchange={(event) => updateDraft('sourceType', (event.currentTarget as HTMLSelectElement).value)}
    >
      <option value="manual">Manual</option>
      <option value="note">Note</option>
      <option value="article">Article</option>
      <option value="web-clip">Web clip</option>
      <option value="transcript">Transcript</option>
    </select>
    <textarea
      data-testid="source-content-input"
      class="sources-pane__textarea"
      rows="6"
      placeholder="Paste markdown or plain text to store as an immutable source"
      value={$sourceImportDraft.content}
      oninput={(event) => updateDraft('content', (event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>
    <button data-testid="source-import-submit" class="sources-pane__submit" type="submit">
      Import source
    </button>
  </form>

  {#if $sourcesError}
    <p class="sources-pane__error" data-testid="sources-error">{$sourcesError}</p>
  {/if}

  <div class="sources-pane__list" data-testid="sources-list">
    {#if $sourcesLoading}
      <p data-testid="sources-loading">Loading sources…</p>
    {:else if $sources.length === 0}
      <p data-testid="sources-empty">No sources imported yet.</p>
    {:else}
      {#each $sources as source (source.id)}
        <article class="sources-pane__item" data-testid={`source-item-${source.id}`}>
          <div class="sources-pane__item-head">
            <strong>{source.title}</strong>
            <span>{source.sourceType}</span>
          </div>
          <div class="sources-pane__item-meta">
            <span>{source.status}</span>
            <span>{formatImportedAt(source.importedAt)}</span>
          </div>
          <code>{source.rawPath}</code>
        </article>
      {/each}
    {/if}
  </div>
</div>

<style>
  .sources-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: 16px;
    background: color-mix(in srgb, var(--color-surface, #fff) 92%, var(--brand-500) 8%);
    max-width: 720px;
    width: 100%;
  }
  .sources-pane__eyebrow {
    margin: 0 0 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-text-tertiary);
  }
  .sources-pane__title {
    margin: 0;
    font-size: 18px;
    color: var(--color-text);
  }
  .sources-pane__form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sources-pane__input,
  .sources-pane__textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--color-surface, #fff);
    color: var(--color-text);
  }
  .sources-pane__submit {
    align-self: flex-start;
    border: 0;
    border-radius: 999px;
    padding: 10px 16px;
    background: var(--brand-600);
    color: white;
    cursor: pointer;
  }
  .sources-pane__error {
    margin: 0;
    color: #b42318;
  }
  .sources-pane__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sources-pane__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-surface, #fff);
  }
  .sources-pane__item-head,
  .sources-pane__item-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
  }
</style>
