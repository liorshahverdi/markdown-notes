<script lang="ts">
  import type { GraphEntity, GraphRelation, TraceRecord } from '../../types/graph';
  import type { ImprovementRecord } from '../graph/improvementLog';
  import { NODE_COLORS } from '../graph/graphBuilder';

  interface Props {
    entity: GraphEntity | null;
    relations: GraphRelation[];
    allEntities?: GraphEntity[];
    improvements?: ImprovementRecord[];
    traces?: TraceRecord[];
    onOpenNote?: (noteId: string) => void;
  }

  let { entity, relations, allEntities = [], improvements = [], traces = [], onOpenNote }: Props = $props();

  let expandedRelId = $state<string | null>(null);

  function getEntityName(entityId: string): string {
    const found = allEntities.find((e) => e.id === entityId);
    return found?.name ?? entityId;
  }

  function getEntity(entityId: string): GraphEntity | undefined {
    return allEntities.find((e) => e.id === entityId);
  }

  function resolveNoteTitle(noteId: string): string {
    // Note entities have the raw noteId in their sourceNoteIds array
    const noteEntity = allEntities.find(
      (e) => e.type === 'note' && e.sourceNoteIds.includes(noteId)
    );
    return noteEntity?.name ?? noteId;
  }

  function getRelatedRelations(entityId: string): GraphRelation[] {
    return relations.filter(
      (r) => r.fromEntityId === entityId || r.toEntityId === entityId
    );
  }

  function toggleProvenance(relId: string) {
    expandedRelId = expandedRelId === relId ? null : relId;
  }

  interface ProvenanceInfo {
    source: 'improvement' | 'trace' | 'shared-notes';
    description: string;
    confidence?: number;
  }

  function getRelationProvenance(rel: GraphRelation, entityId: string): ProvenanceInfo | null {
    const otherId = rel.fromEntityId === entityId ? rel.toEntityId : rel.fromEntityId;

    // 1. Check improvement records where affectedIds contains both entities
    const matchingImprovement = improvements.find(
      (imp) =>
        (imp.status === 'auto-applied' || imp.status === 'pending-review') &&
        imp.affectedIds.includes(entityId) &&
        imp.affectedIds.includes(otherId)
    );
    if (matchingImprovement) {
      return {
        source: 'improvement',
        description: matchingImprovement.description,
        confidence: matchingImprovement.confidence,
      };
    }

    // 2. Check extraction traces where a decision subject mentions both entity names
    const entityName = getEntityName(entityId).toLowerCase();
    const otherName = getEntityName(otherId).toLowerCase();
    for (const trace of traces) {
      for (const stage of trace.stages) {
        for (const decision of stage.decisions) {
          const subjectLower = decision.subject.toLowerCase();
          if (subjectLower.includes(entityName) && subjectLower.includes(otherName)) {
            return {
              source: 'trace',
              description: `${decision.subject} — ${decision.reason}`,
              confidence: decision.confidence,
            };
          }
        }
      }
    }

    // 3. Fallback: shared source notes
    const otherEntity = getEntity(otherId);
    if (otherEntity && entity) {
      const sharedNotes = entity.sourceNoteIds.filter((id) =>
        otherEntity.sourceNoteIds.includes(id)
      );
      if (sharedNotes.length > 0) {
        const noteNames = sharedNotes.map((noteId) => resolveNoteTitle(noteId));
        return {
          source: 'shared-notes',
          description: `Extracted from ${sharedNotes.length} shared note${sharedNotes.length > 1 ? 's' : ''}: ${noteNames.join(', ')}`,
        };
      }
    }

    return null;
  }

  const sourceLabels: Record<ProvenanceInfo['source'], string> = {
    improvement: 'Self-improved',
    trace: 'Extraction',
    'shared-notes': 'Co-occurrence',
  };

  const sourceColors: Record<ProvenanceInfo['source'], string> = {
    improvement: 'text-amber-400',
    trace: 'text-blue-400',
    'shared-notes': 'text-gray-400',
  };
</script>

<div class="p-4 bg-gray-800 rounded-lg border border-gray-700 min-w-[250px]">
  {#if entity}
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <span
          class="inline-block w-3 h-3 rounded-full"
          style="background-color: {NODE_COLORS[entity.type]}"
        ></span>
        <h3 class="text-lg font-semibold text-white">{entity.name}</h3>
      </div>
      <p class="text-sm text-gray-400 capitalize">{entity.type}</p>
      {#if entity.confidence != null}
        <p class="text-xs text-gray-500 mt-1">
          Confidence: {(entity.confidence * 100).toFixed(0)}%
        </p>
      {/if}
    </div>

    {#if entity.sourceNoteIds.length > 0}
      <div class="mb-4">
        <h4 class="text-sm font-medium text-gray-300 mb-1">Source Notes</h4>
        <ul class="text-sm text-gray-400 space-y-1">
          {#each entity.sourceNoteIds as noteId}
            <li>
              {#if entity.type === 'note' && onOpenNote}
                <button
                  onclick={() => onOpenNote?.(noteId)}
                  class="text-blue-400 hover:text-blue-300 underline"
                >
                  Open in editor
                </button>
              {:else}
                <span class="text-gray-500">{noteId}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {@const related = getRelatedRelations(entity.id)}
    {#if related.length > 0}
      <div>
        <h4 class="text-sm font-medium text-gray-300 mb-1">Relations</h4>
        <ul class="text-sm text-gray-400 space-y-2">
          {#each related as rel}
            {@const provenance = getRelationProvenance(rel, entity.id)}
            <li>
              <div class="flex items-center gap-1">
                <span class="text-gray-500">{rel.type}</span>
                <span class="text-gray-300">
                  {rel.fromEntityId === entity.id
                    ? getEntityName(rel.toEntityId)
                    : getEntityName(rel.fromEntityId)}
                </span>
                {#if provenance?.confidence != null}
                  <span class="ml-auto px-1 py-0.5 text-[10px] rounded bg-gray-700 text-gray-400">
                    {(provenance.confidence * 100).toFixed(0)}%
                  </span>
                {/if}
                {#if provenance}
                  <button
                    onclick={() => toggleProvenance(rel.id)}
                    class="ml-1 px-1 py-0.5 text-[10px] rounded transition-colors {expandedRelId === rel.id ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-500 hover:text-gray-300'}"
                    title="Show provenance"
                  >
                    Why?
                  </button>
                {/if}
              </div>
              {#if expandedRelId === rel.id && provenance}
                <div class="mt-1 ml-2 pl-2 border-l border-gray-700 text-xs">
                  <span class="{sourceColors[provenance.source]} font-medium">
                    {sourceLabels[provenance.source]}:
                  </span>
                  <span class="text-gray-400 ml-1">{provenance.description}</span>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {:else}
    <p class="text-gray-500 text-sm">Click a node to see details</p>
  {/if}
</div>
