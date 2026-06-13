<script lang="ts">
  import type { GraphEntity, GraphRelation } from '../../types/graph';

  interface NoteSummary {
    id: string;
    title: string;
    content?: string;
  }

  interface Props {
    edge: GraphRelation | null;
    entities: GraphEntity[];
    notes?: NoteSummary[];
    onOpenNote?: (noteId: string) => void;
    onAccept?: (edge: GraphRelation) => void;
    onReject?: (edge: GraphRelation) => void;
    onEdit?: (edge: GraphRelation, patch: Partial<GraphRelation>) => void;
    onGenerateSkill?: (edge: GraphRelation, from: GraphEntity | null, to: GraphEntity | null) => void;
  }

  let {
    edge,
    entities,
    notes = [],
    onOpenNote,
    onAccept,
    onReject,
    onEdit,
    onGenerateSkill,
  }: Props = $props();

  let editType = $state('');

  const entityById = $derived(new Map(entities.map((entity) => [entity.id, entity])));
  const noteById = $derived(new Map(notes.map((note) => [note.id, note])));
  const fromEntity = $derived(edge ? entityById.get(edge.fromEntityId) ?? null : null);
  const toEntity = $derived(edge ? entityById.get(edge.toEntityId) ?? null : null);
  const status = $derived(edge?.rejected ? 'rejected' : edge?.accepted ? 'accepted' : 'unreviewed');
  const confidenceLabel = $derived(
    edge?.confidence != null
      ? `${Math.round(edge.confidence * 100)}% confidence`
      : edge?.weight != null
        ? `${Math.round(edge.weight * 100)}% weight`
        : 'unknown confidence'
  );

  $effect(() => {
    editType = edge?.type ?? '';
  });

  function saveType() {
    if (!edge || !editType.trim() || editType === edge.type) return;
    onEdit?.(edge, { type: editType.trim() as GraphRelation['type'] });
  }
</script>

<section class="edge-drawer" aria-label="Graph edge details">
  {#if edge}
    <header class="edge-drawer__header">
      <p class="edge-drawer__eyebrow">Selected edge</p>
      <h2>{fromEntity?.name ?? edge.fromEntityId} --{edge.type}--&gt; {toEntity?.name ?? edge.toEntityId}</h2>
      <div class="edge-drawer__badges">
        <span class="edge-badge edge-badge--confidence">{confidenceLabel}</span>
        <span class="edge-badge" class:edge-badge--accepted={status === 'accepted'} class:edge-badge--rejected={status === 'rejected'}>{status}</span>
      </div>
    </header>

    <div class="edge-drawer__actions">
      <button type="button" onclick={() => onAccept?.(edge)}>Accept edge</button>
      <button type="button" onclick={() => onReject?.(edge)}>Reject edge</button>
      <button type="button" onclick={() => onGenerateSkill?.(edge, fromEntity, toEntity)}>Generate skill from this edge</button>
    </div>

    <label class="edge-drawer__edit">
      <span>Relationship type</span>
      <input bind:value={editType} aria-label="Relationship type" />
      <button type="button" onclick={saveType}>Save edit</button>
    </label>

    <section>
      <h3>Provenance</h3>
      {#if edge.provenance?.length}
        <ul class="edge-provenance">
          {#each edge.provenance as item}
            {@const note = noteById.get(item.noteId)}
            <li>
              <div class="edge-provenance__meta">
                <button type="button" onclick={() => onOpenNote?.(item.noteId)} aria-label={`Open ${note?.title ?? item.noteId}`}>
                  {note?.title ?? item.noteId}
                </button>
                <span>{item.method}</span>
              </div>
              {#if item.excerpt}
                <blockquote>{item.excerpt}</blockquote>
              {:else}
                <p class="edge-drawer__muted">No excerpt captured.</p>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="edge-drawer__muted">No provenance captured for this edge.</p>
      {/if}
    </section>
  {:else}
    <p class="edge-drawer__muted">Select a graph edge to inspect its evidence.</p>
  {/if}
</section>

<style>
  .edge-drawer { display: flex; flex-direction: column; gap: 14px; }
  .edge-drawer__eyebrow { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; color: var(--color-text-tertiary); letter-spacing: 0.08em; }
  h2 { margin: 0; font-size: 16px; color: var(--color-text); overflow-wrap: anywhere; }
  h3 { margin: 0 0 8px; font-size: 13px; color: var(--color-text-secondary); }
  .edge-drawer__badges, .edge-drawer__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .edge-badge { border: 1px solid var(--color-border-subtle); border-radius: 999px; padding: 2px 8px; font-size: 11px; color: var(--color-text-secondary); }
  .edge-badge--accepted { color: #15803d; }
  .edge-badge--rejected { color: #b91c1c; }
  button { border: 1px solid var(--color-border-subtle); background: var(--color-surface); color: var(--color-text-secondary); border-radius: 6px; padding: 5px 8px; font-size: 12px; cursor: pointer; }
  button:hover { color: var(--color-text); border-color: var(--color-border); }
  .edge-drawer__edit { display: grid; gap: 6px; font-size: 12px; color: var(--color-text-secondary); }
  input { border: 1px solid var(--color-border-subtle); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 6px 8px; }
  .edge-provenance { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .edge-provenance__meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .edge-provenance__meta span { font-size: 11px; border-radius: 999px; background: var(--brand-tint); color: var(--brand-700); padding: 1px 7px; }
  blockquote { margin: 6px 0 0; padding-left: 10px; border-left: 2px solid var(--color-border); color: var(--color-text-secondary); font-size: 12px; line-height: 1.45; }
  .edge-drawer__muted { margin: 0; color: var(--color-text-tertiary); font-size: 12px; }
</style>
