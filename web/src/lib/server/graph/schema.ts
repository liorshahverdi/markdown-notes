import type Database from 'better-sqlite3';

/**
 * Server-owned knowledge-graph enrichment tables.
 *
 * The deterministic (regex/diagram/folder) graph is always recomputed from the
 * current notes, so it shrinks naturally when notes change. Everything the
 * enrichment loop or a human adds lives in these tables as an *overlay* that is
 * applied on top of that base graph at read time.
 */
export function initializeGraphTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_note_state (
      userId TEXT NOT NULL,
      noteId TEXT NOT NULL,
      stage TEXT NOT NULL,
      contentHash TEXT NOT NULL,
      processedAt INTEGER NOT NULL,
      resultCount INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      PRIMARY KEY (userId, noteId, stage)
    );

    CREATE TABLE IF NOT EXISTS graph_proposals (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      dedupeKey TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      description TEXT NOT NULL,
      payloadJson TEXT NOT NULL,
      noteId TEXT,
      runId TEXT,
      createdAt INTEGER NOT NULL,
      decidedAt INTEGER,
      decidedBy TEXT,
      reviewOutcome TEXT,
      UNIQUE (userId, dedupeKey)
    );

    CREATE TABLE IF NOT EXISTS graph_overlay_relations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      proposalId TEXT,
      fromKey TEXT NOT NULL,
      toKey TEXT NOT NULL,
      type TEXT NOT NULL,
      confidence REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      provenanceJson TEXT NOT NULL DEFAULT '[]',
      metadataJson TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_entity_aliases (
      userId TEXT NOT NULL,
      aliasKey TEXT NOT NULL,
      canonicalKey TEXT NOT NULL,
      proposalId TEXT,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (userId, aliasKey)
    );

    CREATE TABLE IF NOT EXISTS graph_entity_overrides (
      userId TEXT NOT NULL,
      entityKey TEXT NOT NULL,
      type TEXT NOT NULL,
      subtype TEXT,
      proposalId TEXT,
      PRIMARY KEY (userId, entityKey)
    );

    CREATE TABLE IF NOT EXISTS graph_custom_entities (
      userId TEXT NOT NULL,
      entityKey TEXT NOT NULL,
      noteId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      subtype TEXT,
      proposalId TEXT,
      status TEXT NOT NULL DEFAULT 'auto',
      PRIMARY KEY (userId, entityKey, noteId)
    );

    CREATE TABLE IF NOT EXISTS graph_edge_usage (
      userId TEXT NOT NULL,
      relationId TEXT NOT NULL,
      useCount INTEGER NOT NULL DEFAULT 0,
      helpfulCount INTEGER NOT NULL DEFAULT 0,
      lastUsedAt INTEGER,
      lastHelpfulAt INTEGER,
      PRIMARY KEY (userId, relationId)
    );

    CREATE TABLE IF NOT EXISTS graph_eval_queries (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      query TEXT NOT NULL,
      expectedNoteId TEXT NOT NULL,
      source TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      UNIQUE (userId, query, expectedNoteId)
    );

    CREATE TABLE IF NOT EXISTS graph_runs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      finishedAt INTEGER,
      statsJson TEXT NOT NULL DEFAULT '{}',
      evalJson TEXT,
      metricsJson TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_graph_note_state_user ON graph_note_state(userId, stage);
    CREATE INDEX IF NOT EXISTS idx_graph_proposals_user_status ON graph_proposals(userId, status);
    CREATE INDEX IF NOT EXISTS idx_graph_overlay_relations_user ON graph_overlay_relations(userId);
    CREATE INDEX IF NOT EXISTS idx_graph_overlay_relations_proposal ON graph_overlay_relations(proposalId);
    CREATE INDEX IF NOT EXISTS idx_graph_edge_usage_user ON graph_edge_usage(userId);
    CREATE INDEX IF NOT EXISTS idx_graph_eval_queries_user ON graph_eval_queries(userId);
    CREATE INDEX IF NOT EXISTS idx_graph_runs_user ON graph_runs(userId, startedAt);
  `);

  try {
    db.exec('ALTER TABLE graph_edge_usage ADD COLUMN unhelpfulCount INTEGER NOT NULL DEFAULT 0');
  } catch {
    // Column already exists.
  }
}
