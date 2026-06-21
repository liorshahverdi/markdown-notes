# Roadmap

## Immediate priorities

### Knowledge graph UX/functionality

The graph has useful extraction, provenance, scoring, review, and skill hooks, but the current UI does not yet make those capabilities obvious. The review queue exists and has helper coverage, but it is not a primary user workflow today.

Priorities:

- Redesign `/graph` around exploration first: search, filters, clusters, selected-node details, and clear edge evidence.
- Make every edge answer "why is this connected?" with note excerpts/provenance.
- Continue hardening persisted graph review state so accepted/rejected decisions stay consistent across graph UI, graph API, chat retrieval, and diagnostics.
- Demote or reframe the review queue as an advanced evidence/review panel until users understand why items matter.
- Add clearer empty states and onboarding for graph generation.
- Improve graph-to-chat handoff: ask about selected node, selected edge, or cluster.
- Improve graph-to-skill selection and explain what evidence will be used.

### Chat quality

- Continue preventing raw graph-edge syntax from leaking into answers.
- Keep note text ahead of graph context in prompts.
- Add more regression tests for questions where graph context is useful for retrieval but note text must provide the answer.
- Improve instrumentation for retrieval, embedding, graph expansion, and model-generation timing.

## Product hardening

- Improve local data backup/export documentation.
- Harden authentication before any non-local deployment.
- Keep Ollama requests restricted to loopback by default.
- Code-split heavy experimental/vector features.
- Add screenshots/demo media with private data removed.

## Experimental wiki subsystem

The source/wiki system remains useful but should stay opt-in until the note-first workflow is fully polished.

Planned work:

- Keep wiki/source import under experimental or maintenance navigation.
- Keep ordinary note saves out of wiki/source synchronization unless a user explicitly opts into an experimental workflow.
- Maintain tests for ingest, query, lint, answer filing, and migration.
- Avoid making generated wiki pages the default source of truth for chat.

## Open-source readiness

- Keep web, CLI, and Swift checks green.
- Continue dependency audit cleanup before releases.
- Clarify production deployment support and limitations.
- Document backup/restore and data portability.
