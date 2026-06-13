// POLE+O entity types (Person, Object, Location, Event, Other)
export type POLEOType = 'Person' | 'Object' | 'Location' | 'Event' | 'Other';
export type StructuralType = 'note' | 'folder';
export type EntityType = POLEOType | StructuralType;

export interface GraphEntity {
  id: string;
  name: string;
  type: EntityType;
  subtype?: string;
  sourceNoteIds: string[];
  confidence?: number;
}

export type GraphExtractionMethod = 'regex' | 'ner' | 'cooccurrence' | 'llm' | 'user' | 'diagram';

export interface GraphEdgeProvenance {
  noteId: string;
  excerpt?: string;
  method: GraphExtractionMethod;
}

export interface GraphRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type:
    | 'mentions'
    | 'related_to'
    | 'links_to'
    | 'transitive'
    | 'contains'
    | 'child_of'
    | 'causes'
    | 'precedes'
    | 'part_of'
    | 'depends_on'
    | 'implements'
    | 'contrasts_with'
    | 'inferred_by_model'
    | 'used_by_skill'
    | 'derived_from'
    | 'attended'
    | 'located_at'
    | 'owns'
    | 'created'
    | 'mentioned_in';
  weight?: number;
  confidence?: number;
  provenance?: GraphEdgeProvenance[];
  accepted?: boolean;
  rejected?: boolean;
  createdAt?: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  label: string;
  group: string; // entity type for color coding
  title?: string; // tooltip
  size?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  dashes?: boolean; // true for transitive edges
  width?: number;
}

// Reasoning trace types
export type TraceType = 'extraction' | 'query' | 'self_improvement';

export interface TraceRecord {
  id: string;
  type: TraceType;
  timestamp: number;
  noteId?: string;
  durationMs: number;
  stages: TraceStage[];
  summary: string;
}

export interface TraceStage {
  name: string;
  durationMs: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  decisions: TraceDecision[];
}

export interface TraceDecision {
  action: 'accepted' | 'rejected' | 'modified';
  subject: string;
  reason: string;
  confidence?: number;
}
