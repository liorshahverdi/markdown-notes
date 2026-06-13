import type { GraphEntity, GraphRelation } from '../../types/graph';
import type { Cluster } from './clusterDetector';
import { buildSkillPromptFromSelection } from './skillGenerator';

export type SkillWizardSourceType = 'edge' | 'selected-subgraph' | 'cluster' | 'bridge' | 'notes' | 'existing-skills';

export interface SkillWizardSource {
  type: SkillWizardSourceType;
  selectedEntityIds: string[];
  selectedRelationIds: string[];
}

export interface SkillWizardEvidenceInput {
  name: string;
  source: SkillWizardSource;
  entities: GraphEntity[];
  relations: GraphRelation[];
  notes: Array<{ id: string; title: string; content: string }>;
  includeRejected?: boolean;
}

export interface ApprovedSkillArtifactInput {
  name: string;
  domain: string;
  markdown: string;
  source: SkillWizardSource;
  approvedAt?: number;
}

export interface ApprovedSkillArtifacts {
  skillPath: string;
  skillMarkdown: string;
  metadataPath: string;
  metadataJson: string;
}

export function createEdgeWizardSource(
  edge: GraphRelation,
  entities: GraphEntity[]
): SkillWizardSource {
  const entityIds = new Set(entities.map((entity) => entity.id));
  return {
    type: 'edge',
    selectedEntityIds: [edge.fromEntityId, edge.toEntityId].filter((id) => entityIds.has(id)),
    selectedRelationIds: [edge.id],
  };
}

export function buildFocusedNodeSkillCluster(input: {
  selectedEntityId: string;
  entities: GraphEntity[];
  relations: GraphRelation[];
}): Cluster | null {
  const selected = input.entities.find((entity) => entity.id === input.selectedEntityId);
  if (!selected) return null;

  const directRelations = input.relations.filter(
    (relation) =>
      !relation.rejected &&
      (relation.fromEntityId === selected.id || relation.toEntityId === selected.id)
  );
  const directRelationIds = new Set(directRelations.map((relation) => relation.id));
  const entityIds = new Set<string>([selected.id]);
  const noteIds = new Set<string>(selected.sourceNoteIds);
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));

  for (const relation of directRelations) {
    entityIds.add(relation.fromEntityId);
    entityIds.add(relation.toEntityId);
    for (const item of relation.provenance ?? []) noteIds.add(item.noteId);

    // Pull in source notes only for directly connected note entities. Avoid using
    // broad tag/topic sourceNoteIds because shared tags can drag unrelated notes
    // (for example a Java cheat sheet) into a selected-note skill prompt.
    for (const endpointId of [relation.fromEntityId, relation.toEntityId]) {
      const endpoint = entityById.get(endpointId);
      if (endpoint?.type === 'note') {
        for (const noteId of endpoint.sourceNoteIds) noteIds.add(noteId);
      }
    }
  }

  const internalRelationCount = input.relations.filter(
    (relation) =>
      directRelationIds.has(relation.id) &&
      entityIds.has(relation.fromEntityId) &&
      entityIds.has(relation.toEntityId)
  ).length;
  const n = entityIds.size;
  const possibleEdges = n * (n - 1) / 2;

  return {
    id: `selection-${selected.id}`,
    name: selected.name,
    entityIds: Array.from(entityIds),
    noteIds: Array.from(noteIds),
    density: possibleEdges > 0 ? internalRelationCount / possibleEdges : 0,
    modularity: 1,
  };
}

export function buildSkillPromptFromWizardEvidence(input: SkillWizardEvidenceInput): string {
  const selectedRelationIds = new Set(input.source.selectedRelationIds);
  const selectedEntityIds = new Set(input.source.selectedEntityIds);
  const relations = input.relations.filter((relation) => {
    if (!input.includeRejected && relation.rejected) return false;
    return (
      selectedRelationIds.has(relation.id) ||
      (selectedEntityIds.has(relation.fromEntityId) && selectedEntityIds.has(relation.toEntityId))
    );
  });

  const citedNoteIds = new Set<string>();
  for (const relation of relations) {
    for (const item of relation.provenance ?? []) citedNoteIds.add(item.noteId);
  }
  if (citedNoteIds.size === 0) {
    const selectedEntityIds = new Set(input.source.selectedEntityIds);
    for (const entity of input.entities) {
      if (selectedEntityIds.has(entity.id)) {
        for (const noteId of entity.sourceNoteIds) citedNoteIds.add(noteId);
      }
    }
  }

  const prompt = buildSkillPromptFromSelection({
    name: input.name,
    selectedEntityIds: input.source.selectedEntityIds,
    selectedRelationIds: relations.map((relation) => relation.id),
    entities: input.entities,
    relations,
    notes: input.notes.filter((note) => citedNoteIds.has(note.id)),
  });

  return prompt.includes('## Evidence')
    ? prompt
    : `${prompt}\n\n## Evidence\nUse only the cited source notes and graph edge provenance above.`;
}

export function createApprovedSkillArtifacts(input: ApprovedSkillArtifactInput): ApprovedSkillArtifacts {
  const slug = slugify(input.name);
  const metadata = {
    name: input.name,
    domain: input.domain,
    sourceType: input.source.type,
    entityIds: input.source.selectedEntityIds,
    relationIds: input.source.selectedRelationIds,
    approvedAt: input.approvedAt ?? Date.now(),
    version: 1,
  };

  return {
    skillPath: `skills/${slug}/SKILL.md`,
    skillMarkdown: input.markdown,
    metadataPath: `skills/${slug}/metadata.json`,
    metadataJson: JSON.stringify(metadata, null, 2),
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'skill';
}
