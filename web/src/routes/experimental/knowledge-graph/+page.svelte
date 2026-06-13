<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import KnowledgeGraph from '$lib/components/KnowledgeGraph.svelte';
  import GraphControls from '$lib/components/GraphControls.svelte';
  import GraphDetailPanel from '$lib/components/GraphDetailPanel.svelte';
  import GraphEdgeDetailDrawer from '$lib/components/GraphEdgeDetailDrawer.svelte';
  import GraphAnalyticsPanel from '$lib/components/GraphAnalytics.svelte';
  import ClusterQualityHeatmap from '$lib/components/ClusterQualityHeatmap.svelte';
  import ScoreBreakdown from '$lib/components/ScoreBreakdown.svelte';
  import GraphHealthIndicator from '$lib/components/GraphHealthIndicator.svelte';
  import ImprovementFeed from '$lib/components/ImprovementFeed.svelte';
  import TraceViewer from '$lib/components/TraceViewer.svelte';
  import SkillCandidateCard from '$lib/components/SkillCandidateCard.svelte';
  import SkillGeneratorPanel from '$lib/components/SkillGeneratorPanel.svelte';
  import SkillList from '$lib/components/SkillList.svelte';
  import SkillCombinePanel from '$lib/components/SkillCombinePanel.svelte';
  import SkillDependencyGraph from '$lib/components/SkillDependencyGraph.svelte';
  import SkillEvidenceAnnotation from '$lib/components/SkillEvidenceAnnotation.svelte';
  import { buildMergePrompt } from '$lib/skills/skillCombiner';
  import { extractCitations, linkCitationsToNotes, type EvidenceLink } from '$lib/skills/evidenceLinker';
  import { exportSkillAsMarkdown, exportAllSkillsAsJSON, downloadBlob } from '$lib/skills/skillExporter';
  import {
    graphNodes,
    graphEdges,
    graphEntities,
    graphRelations,
    selectedNodeId,
    selectedEdgeId,
    loadGraphData,
    extractAndSaveEntities,
    removeRelation,
    unmergeGraphEntities,
    rebuildGraph,
    acceptRelation,
    rejectRelation,
    updateRelation,
  } from '$lib/stores/graph';
  import { notes, loadNotes, selectedNoteId } from '$lib/stores/notes';
  import {
    skillCandidates,
    skills,
    selectedSkillId,
    detectSkillCandidates,
    loadSkills,
    saveSkill,
    deleteSkill,
    generatingSkill,
  } from '$lib/stores/skills';
  import { computeGraphAnalytics, type GraphAnalytics } from '$lib/graph/analyticsComputer';
  import { computeClusterQualities, type ClusterQuality } from '$lib/graph/clusterMetrics';
  import { computeGraphHealth, type GraphHealthMetrics } from '$lib/graph/graphScorer';
  import { detectClusters } from '$lib/skills/clusterDetector';
  import type { Cluster } from '$lib/skills/clusterDetector';
  import { dedupeImprovements, type ImprovementRecord } from '$lib/graph/improvementLog';
  import { createSelfImprover } from '$lib/graph/selfImprover';
  import { db } from '$lib/db/index';
  import type { GraphRelation } from '../../../types/graph';
  import { buildFocusedNodeSkillCluster, buildSkillPromptFromWizardEvidence, createEdgeWizardSource } from '$lib/skills/skillWizard';
  import { generateSkillFromSelectionStream, generateSkillStream } from '$lib/skills/skillGenerator';
  import { ragConfig } from '$lib/stores/rag';
  import { traces, loadTraces } from '$lib/stores/traces';
  import { pruneOldTraces } from '$lib/graph/traceLogger';

  let selectedEntity = $derived(
    $selectedNodeId
      ? $graphEntities.find((e) => e.id === $selectedNodeId) ?? null
      : null
  );
  let selectedEdge = $derived(
    $selectedEdgeId
      ? $graphRelations.find((r) => r.id === $selectedEdgeId) ?? null
      : null
  );

  // Analytics state
  let analytics = $state<GraphAnalytics>({
    totalNodes: 0,
    totalEdges: 0,
    totalClusters: 0,
    avgClusterSize: 0,
    entityDistribution: new Map(),
    overallModularity: 0,
  });
  let healthMetrics = $state<GraphHealthMetrics>({
    totalNodes: 0,
    totalEdges: 0,
    totalClusters: 0,
    avgClusterSize: 0,
    connectivity: 0,
    orphanCount: 0,
    overallScore: 0,
  });
  let clusterQualities = $state<ClusterQuality[]>([]);
  let improvements = $state<ImprovementRecord[]>([]);

  // Sync state
  let syncing = $state(false);
  let rebuilding = $state(false);
  let lastSyncedAt = $state<number | null>(null);

  // UI state
  let analyticsOpen = $state(false);
  let skillListOpen = $state(false);
  let showSkillGenerator = $state(false);
  let aiSettingsOpen = $state(false);
  let generatedSkillMarkdown = $state('');
  let edgeSkillDraft = $state<{ name: string; relation: GraphRelation; noteIds: string[] } | null>(null);
  let selectedCandidate = $state<(Cluster & { score: number }) | null>(null);
  let selectedCandidateBreakdown = $state<Record<string, number> | null>(null);

  // Skill combine/dependency/evidence state
  let showCombinePanel = $state(false);
  let showDependencyGraph = $state(false);
  let evidenceLinks = $state<EvidenceLink[]>([]);

  function recomputeAnalytics() {
    analytics = computeGraphAnalytics($graphEntities, $graphRelations);
    healthMetrics = computeGraphHealth($graphEntities, $graphRelations);
    const clusters = detectClusters($graphEntities, $graphRelations);
    clusterQualities = computeClusterQualities(clusters, $graphEntities, $graphRelations);
  }

  function handleNodeClick(nodeId: string) {
    $selectedNodeId = nodeId;
    $selectedEdgeId = null;
  }

  function handleEdgeClick(edgeId: string) {
    $selectedEdgeId = edgeId;
    $selectedNodeId = null;
  }

  function handleOpenNote(noteId: string) {
    $selectedNoteId = noteId;
    goto('/');
  }

  async function handleGenerateSkill(cluster: Cluster) {
    const scored = $skillCandidates.find((c) => c.id === cluster.id);
    if (scored) {
      selectedCandidate = scored;
      selectedCandidateBreakdown = {
        density: cluster.density,
        entityCount: Math.min(cluster.entityIds.length / 10, 1),
        noteCount: Math.min(cluster.noteIds.length / 10, 1),
        freshness: 0.8,
      };
    }

    const allEntities = $graphEntities;
    const allRelations = $graphRelations;
    const clusterEntities = allEntities.filter((e) => cluster.entityIds.includes(e.id));
    const entityNames = clusterEntities.map((e) => e.name).slice(0, 10).join(', ');

    // Show placeholder immediately while LLM generates
    generatedSkillMarkdown = `# ${cluster.name}\n\nGenerating skill from cluster with ${cluster.entityIds.length} entities and ${cluster.noteIds.length} notes...\n\n## Key Concepts\n\n${entityNames}\n`;
    showSkillGenerator = true;
    edgeSkillDraft = null;

    // Call LLM to generate the full skill
    const clusterRelations = allRelations.filter(
      (r) =>
        clusterEntities.some((e) => e.id === r.fromEntityId) &&
        clusterEntities.some((e) => e.id === r.toEntityId)
    );
    const clusterNotes = $notes
      .filter((n) => cluster.noteIds.includes(n.id))
      .map((n) => ({ title: n.title, content: n.content }));

    try {
      generatingSkill.set(true);
      for await (const snapshot of generateSkillStream(cluster, clusterNotes, clusterEntities, clusterRelations, $ragConfig)) {
        generatedSkillMarkdown = snapshot;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      generatedSkillMarkdown = `# ${cluster.name}\n\n**Generation failed:** ${msg}\n\n## Key Concepts\n\n${entityNames}\n`;
    } finally {
      generatingSkill.set(false);
    }
  }

  async function handleGenerateFromEdge(edge: GraphRelation) {
    const source = createEdgeWizardSource(edge, $graphEntities);
    const from = $graphEntities.find((entity) => entity.id === edge.fromEntityId);
    const to = $graphEntities.find((entity) => entity.id === edge.toEntityId);
    const name = [from?.name, to?.name].filter(Boolean).join(' → ') || 'Graph Edge Skill';
    const citedNoteIds = Array.from(new Set((edge.provenance ?? []).map((item) => item.noteId)));
    generatedSkillMarkdown = `# ${name}\n\nGenerating skill from selected edge evidence...\n\n${buildSkillPromptFromWizardEvidence({
      name,
      source,
      entities: $graphEntities,
      relations: $graphRelations,
      notes: $notes,
    })}`;
    edgeSkillDraft = {
      name,
      relation: edge,
      noteIds: citedNoteIds,
    };
    selectedCandidate = null;
    selectedCandidateBreakdown = null;
    showSkillGenerator = true;

    try {
      generatingSkill.set(true);
      for await (const snapshot of generateSkillFromSelectionStream({
        name,
        selectedEntityIds: source.selectedEntityIds,
        selectedRelationIds: source.selectedRelationIds,
        entities: $graphEntities,
        relations: $graphRelations.filter((relation) => !relation.rejected),
        notes: $notes,
      }, $ragConfig)) {
        generatedSkillMarkdown = snapshot;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      generatedSkillMarkdown = `# ${name}\n\n**Generation failed:** ${msg}\n\n## Evidence\n${edge.provenance?.map((item) => `- ${item.excerpt ?? 'No excerpt'} [${item.method}]`).join('\n') ?? '- No provenance captured.'}`;
    } finally {
      generatingSkill.set(false);
    }
  }

  async function handleGenerateFromSelection() {
    if (!$selectedNodeId) return;

    // Generate from a focused ego-subgraph around the selected node rather than
    // the full connected component. Full clusters can be polluted by shared tags
    // or generic bridge nodes and produce irrelevant skills.
    const focusedCluster = buildFocusedNodeSkillCluster({
      selectedEntityId: $selectedNodeId,
      entities: $graphEntities,
      relations: $graphRelations,
    });
    if (focusedCluster) {
      await handleGenerateSkill(focusedCluster);
    }
  }

  async function handleApproveSkill(markdown: string) {
    showSkillGenerator = false;
    if (selectedCandidate) {
      const skill = {
        id: `skill-${Date.now()}`,
        name: selectedCandidate.name,
        domain: 'general',
        type: 'single' as const,
        content: markdown,
        sourceNoteIds: selectedCandidate.noteIds,
        parentSkillIds: [],
        dependencies: { requires: [], enhances: [] },
        confidence: 'medium' as const,
        versions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveSkill(skill);
    } else if (edgeSkillDraft) {
      const now = Date.now();
      const skill = {
        id: `skill-${now}`,
        name: edgeSkillDraft.name,
        domain: 'graph-edge',
        type: 'single' as const,
        content: markdown,
        sourceNoteIds: edgeSkillDraft.noteIds,
        parentSkillIds: [],
        dependencies: { requires: [], enhances: [] },
        confidence: edgeSkillDraft.relation.confidence != null && edgeSkillDraft.relation.confidence >= 0.75 ? 'high' as const : 'medium' as const,
        versions: [],
        createdAt: now,
        updatedAt: now,
      };
      await saveSkill(skill);
    }
    selectedCandidate = null;
    edgeSkillDraft = null;
    selectedCandidateBreakdown = null;
  }

  function handleRejectSkill() {
    showSkillGenerator = false;
    selectedCandidate = null;
    edgeSkillDraft = null;
    selectedCandidateBreakdown = null;
  }

  function handleRegenerateSkill() {
    if (selectedCandidate) {
      handleGenerateSkill(selectedCandidate);
    } else if (edgeSkillDraft) {
      handleGenerateFromEdge(edgeSkillDraft.relation);
    }
  }

  function handleSelectSkill(id: string) {
    $selectedSkillId = id;
  }

  async function handleDeleteSkill(id: string) {
    await deleteSkill(id);
  }

  async function handleCombineSkills(selectedIds: string[], mode: 'merge' | 'chain' | 'bridge') {
    const allSkills = $skills;
    const selectedSkills = allSkills.filter((s) => selectedIds.includes(s.id));
    if (selectedSkills.length < 2) return;

    // Build the merge prompt and generate
    const prompt = buildMergePrompt(selectedSkills);
    const combinedName = selectedSkills.map((s) => s.name).join(' + ');

    generatedSkillMarkdown = `# ${combinedName}\n\nCombining ${selectedSkills.length} skills (${mode} mode)...\n`;
    showSkillGenerator = true;
    showCombinePanel = false;

    // Use the combined prompt through the RAG pipeline if available
    selectedCandidate = null;
    edgeSkillDraft = null;
    selectedCandidateBreakdown = null;

    try {
      generatingSkill.set(true);
      const config = $ragConfig;
      const { queryOllama } = await import('$lib/vector/ragPipeline');
      let markdown = '';
      for await (const token of queryOllama(prompt, config)) {
        markdown += token;
        generatedSkillMarkdown = markdown;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      generatedSkillMarkdown = `# ${combinedName}\n\n**Combination failed:** ${msg}\n`;
    } finally {
      generatingSkill.set(false);
    }
  }

  function handleEvidenceClick(link: EvidenceLink) {
    handleOpenNote(link.noteId);
  }

  function handleExportSkill(skill: typeof $skills[0]) {
    const blob = exportSkillAsMarkdown(skill);
    const safeName = skill.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    downloadBlob(blob, `${safeName}.md`);
  }

  function handleExportAllSkills() {
    const blob = exportAllSkillsAsJSON($skills);
    downloadBlob(blob, 'skills-export.json');
  }

  async function handleUndoImprovement(record: ImprovementRecord) {
    // Update UI immediately
    const updated: ImprovementRecord = { ...record, status: 'undone' };
    improvements = improvements.map((r) => (r.id === record.id ? updated : r));

    try {
      if (record.type === 'relationship_added' || record.type === 'transitive_inferred' || record.type === 'implicit_extracted') {
        const undoData = record.undoData as { relation: GraphRelation };
        await removeRelation(undoData.relation.id);
      } else if (record.type === 'entity_merged') {
        const undoData = record.undoData as { keepEntity: any; removeEntity: any; originalRelations: any[] };
        await unmergeGraphEntities(undoData);
      }
      recomputeAnalytics();
    } catch (e) {
      console.warn('[SelfImprover] undo graph mutation failed:', e);
    }
    try {
      await db.improvements.put(updated);
    } catch (e) {
      console.warn('[SelfImprover] undo DB persist failed:', e);
    }
  }

  let improver: ReturnType<typeof createSelfImprover> | null = null;

  async function handleSyncNotes() {
    if (syncing) return;
    syncing = true;
    let syncCompleted = false;
    try {
      for (const note of $notes) {
        await extractAndSaveEntities(note.id, note.title, note.content, note.folderId);
      }
      recomputeAnalytics();
      lastSyncedAt = Date.now();
      syncCompleted = true;
    } finally {
      // Keep the sync button tied only to deterministic extraction. Self-improvement
      // can call Ollama and should not leave the graph operations UI disabled.
      syncing = false;
    }

    if (!syncCompleted) return;

    // Run self-improvement analysis after sync in the background.
    const rc = $ragConfig;
    let siEnabled = true;
    let siInterval = 30 * 60 * 1000;
    let siThreshold = 0.8;
    try {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        const s = JSON.parse(saved);
        siEnabled = s.selfImprovementEnabled ?? true;
        siInterval = (s.selfImprovementInterval ?? 30) * 60 * 1000;
        siThreshold = s.autoApplyThreshold ?? 0.8;
      }
    } catch {}
    improver = createSelfImprover({
      enabled: siEnabled,
      intervalMs: siInterval,
      autoApplyThreshold: siThreshold,
      ollamaUrl: rc.ollamaUrl || undefined,
      ollamaModel: rc.model || undefined,
      onImprove(records) {
        improvements = dedupeImprovements([...improvements, ...records]);
        recomputeAnalytics();
      },
    });
    void improver.runOnce().catch((e) => {
      console.error('[SelfImprover] runOnce failed:', e);
    });
  }

  async function handleRebuildGraph() {
    if (rebuilding || syncing) return;
    rebuilding = true;
    try {
      await rebuildGraph();
      recomputeAnalytics();
      lastSyncedAt = Date.now();
    } finally {
      rebuilding = false;
    }
  }

  onMount(async () => {
    await loadNotes();

    // Fast load from DB — no heavy extraction
    await loadGraphData();
    await loadSkills();
    await detectSkillCandidates();
    recomputeAnalytics();

    // Load traces and prune old ones
    await pruneOldTraces();
    await loadTraces();

    // Load persisted improvements (guard against old records missing fields)
    let allImprovements: ImprovementRecord[] = [];
    try {
      const raw = await db.improvements.toArray();
      allImprovements = dedupeImprovements(raw.filter((r): r is ImprovementRecord =>
        typeof r.description === 'string' && Array.isArray(r.affectedIds)
      ));
    } catch {
      // DB not ready or schema mismatch
    }
    improvements = allImprovements;
  });

  onDestroy(() => {
    improver?.stop();
  });
</script>

<div class="kg-shell">
  <!-- Left sidebar: controls -->
  <aside class="kg-aside kg-aside--left">
    <header class="kg-page-header">
      <span class="label-meta">Experimental</span>
      <h1 class="kg-page-title">Knowledge Graph</h1>
      <p class="kg-page-sub">Experimental entity graph, skills, and self-improvement tooling kept outside the primary wiki workflow.</p>
    </header>

    <section class="kg-section">
      <GraphControls />
    </section>

    <section class="kg-section kg-section--health">
      <GraphHealthIndicator metrics={healthMetrics} />
    </section>

    {#if $selectedNodeId}
      <section class="kg-section">
        <button
          onclick={handleGenerateFromSelection}
          class="kg-btn kg-btn--primary"
        >
          <span>Generate skill from selection</span>
          <span aria-hidden="true">→</span>
        </button>
      </section>
    {/if}

    <section class="kg-section">
      <span class="label-meta kg-section__label">Operations</span>
      <button
        onclick={handleSyncNotes}
        disabled={syncing}
        class="kg-btn kg-btn--success"
        class:is-busy={syncing}
      >
        {syncing ? 'Syncing…' : 'Sync notes & analyze'}
      </button>
      {#if lastSyncedAt}
        <p class="kg-mono-note">last synced · {new Date(lastSyncedAt).toLocaleTimeString()}</p>
      {/if}
      <button
        onclick={handleRebuildGraph}
        disabled={rebuilding || syncing}
        class="kg-btn kg-btn--warning"
        class:is-busy={rebuilding}
      >
        {rebuilding ? 'Rebuilding…' : 'Rebuild graph'}
      </button>
      <p class="kg-help-note">Clears entities &amp; re-extracts from scratch.</p>
    </section>

    <section class="kg-section kg-section--collapsible">
      <button class="kg-disclosure" onclick={() => aiSettingsOpen = !aiSettingsOpen}>
        <span class="kg-disclosure__title">AI Settings</span>
        <span class="kg-disclosure__chev" class:is-open={aiSettingsOpen} aria-hidden="true">▾</span>
      </button>
      {#if aiSettingsOpen}
        <div class="kg-fieldset">
          <label class="kg-field">
            <span class="label-meta">Ollama URL</span>
            <input
              type="text"
              value={$ragConfig.ollamaUrl}
              oninput={(e) => $ragConfig = { ...$ragConfig, ollamaUrl: e.currentTarget.value }}
              placeholder="http://localhost:11434"
              class="kg-input"
            />
          </label>
          <label class="kg-field">
            <span class="label-meta">Ollama Model</span>
            <input
              type="text"
              value={$ragConfig.model}
              oninput={(e) => $ragConfig = { ...$ragConfig, model: e.currentTarget.value }}
              placeholder="qwen2.5:3b"
              class="kg-input"
            />
          </label>
          <p class="kg-help-note">Used for implicit extraction &amp; entity validation during self-improvement.</p>
        </div>
      {/if}
    </section>

    <section class="kg-section">
      <a href="/" class="kg-btn kg-btn--ghost">← Back to wiki</a>
    </section>
  </aside>

  <!-- Center: graph + bottom panels -->
  <main class="kg-main">
    <div class="kg-canvas">
      <KnowledgeGraph
        nodes={$graphNodes}
        edges={$graphEdges}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
      />
    </div>

    <div class="kg-analytics">
      <button
        onclick={() => analyticsOpen = !analyticsOpen}
        class="kg-disclosure kg-disclosure--bar"
      >
        <span class="kg-disclosure__title">Analytics &amp; insights</span>
        <span class="kg-disclosure__chev" class:is-open={analyticsOpen} aria-hidden="true">▾</span>
      </button>

      {#if analyticsOpen}
        <div class="kg-analytics__body">
          <GraphAnalyticsPanel {analytics} />
          <ClusterQualityHeatmap qualities={clusterQualities} />

          {#if $skillCandidates.length > 0}
            <div class="kg-card">
              <h3 class="kg-card__title">Skill candidates</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {#each $skillCandidates as candidate (candidate.id)}
                  <SkillCandidateCard cluster={candidate} onGenerate={handleGenerateSkill} />
                {/each}
              </div>
            </div>
          {/if}

          {#if selectedCandidate && selectedCandidateBreakdown}
            <ScoreBreakdown score={selectedCandidate.score} breakdown={selectedCandidateBreakdown} />
          {/if}
        </div>
      {/if}
    </div>
  </main>

  <!-- Right sidebar: detail panel + self-improvement -->
  <aside class="kg-aside kg-aside--right">
    {#if selectedEdge}
      <section class="kg-panel">
        <GraphEdgeDetailDrawer
          edge={selectedEdge}
          entities={$graphEntities}
          notes={$notes}
          onOpenNote={handleOpenNote}
          onAccept={(edge) => acceptRelation(edge.id)}
          onReject={(edge) => rejectRelation(edge.id)}
          onEdit={(edge, patch) => updateRelation(edge.id, patch)}
          onGenerateSkill={(edge) => handleGenerateFromEdge(edge)}
        />
      </section>
    {:else}
      <GraphDetailPanel
        entity={selectedEntity}
        relations={$graphRelations}
        allEntities={$graphEntities}
        {improvements}
        traces={$traces}
        onOpenNote={handleOpenNote}
      />
    {/if}

    <section class="kg-panel">
      <h3 class="kg-panel__title">Self-improvement</h3>
      <ImprovementFeed {improvements} onUndo={handleUndoImprovement} />
    </section>

    <section class="kg-panel">
      <h3 class="kg-panel__title">Reasoning traces</h3>
      <TraceViewer traces={$traces} entityId={selectedEntity?.id} entityName={selectedEntity?.name} />
    </section>

    <section class="kg-panel">
      <button
        onclick={() => skillListOpen = !skillListOpen}
        class="kg-disclosure"
      >
        <span class="kg-disclosure__title">Skills <span class="kg-disclosure__count">{$skills.length}</span></span>
        <span class="kg-disclosure__chev" class:is-open={skillListOpen} aria-hidden="true">▾</span>
      </button>
      {#if skillListOpen}
        <SkillList
          skills={$skills}
          onSelect={handleSelectSkill}
          onDelete={handleDeleteSkill}
        />

        {#if $skills.length > 0}
          <button
            onclick={handleExportAllSkills}
            class="kg-btn kg-btn--ghost kg-btn--small"
          >
            Export all skills · JSON
          </button>
        {/if}

        {#if $skills.length >= 2}
          <div class="kg-actions-row">
            <button
              onclick={() => showCombinePanel = !showCombinePanel}
              class="kg-btn kg-btn--accent kg-btn--small"
            >
              Combine
            </button>
            <button
              onclick={() => showDependencyGraph = !showDependencyGraph}
              class="kg-btn kg-btn--ghost kg-btn--small"
            >
              View deps
            </button>
          </div>
        {/if}

        {#if showCombinePanel}
          <div class="kg-stack-top">
            <SkillCombinePanel skills={$skills} onCombine={handleCombineSkills} />
          </div>
        {/if}

        {#if showDependencyGraph}
          <div class="kg-stack-top">
            <SkillDependencyGraph skills={$skills} onNodeClick={handleSelectSkill} />
          </div>
        {/if}
      {/if}
    </section>
  </aside>
</div>

<style>
  .kg-shell {
    display: flex;
    height: 100%;
    color: var(--color-text);
    background:
      radial-gradient(circle at 50% 0%, var(--brand-tint) 0%, transparent 40%),
      var(--color-bg);
  }

  .kg-aside {
    width: 272px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: 18px 18px 32px;
    background: var(--color-bg-grain);
  }

  :global(.dark) .kg-aside {
    background: var(--color-surface-sunken);
  }

  .kg-aside--left {
    border-right: 1px solid var(--color-border-subtle);
  }

  .kg-aside--right {
    width: 300px;
    border-left: 1px solid var(--color-border-subtle);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .kg-page-header {
    margin-bottom: 18px;
  }

  .kg-page-header :global(.label-meta) {
    display: block;
    margin-bottom: 4px;
  }

  .kg-page-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--color-text);
  }

  .kg-page-sub {
    margin: 4px 0 0;
    font-size: 12.5px;
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }

  .kg-section {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border-subtle);
  }

  .kg-section:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  .kg-section--health {
    display: flex;
    justify-content: center;
  }

  .kg-section__label {
    display: block;
    margin-bottom: 8px;
  }

  .kg-btn {
    display: inline-flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 7px;
    border: 1px solid;
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, transform 80ms ease;
  }

  .kg-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .kg-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .kg-btn--small {
    padding: 6px 10px;
    font-size: 12px;
    border-radius: 6px;
  }

  .kg-btn--primary {
    color: white;
    background: var(--brand-600);
    border-color: var(--brand-700);
  }
  .kg-btn--primary:hover:not(:disabled) { background: var(--brand-700); }

  .kg-btn--accent {
    color: var(--brand-700);
    background: var(--brand-tint);
    border-color: var(--brand-tint-strong);
  }
  :global(.dark) .kg-btn--accent { color: var(--brand-500); }
  .kg-btn--accent:hover:not(:disabled) { background: var(--brand-tint-strong); }

  .kg-btn--success {
    margin-top: 6px;
    color: white;
    background: #2f8f5e;
    border-color: #277749;
  }
  .kg-btn--success:hover:not(:disabled) { background: #277749; }

  .kg-btn--warning {
    margin-top: 8px;
    color: white;
    background: #b87a1a;
    border-color: #976316;
  }
  .kg-btn--warning:hover:not(:disabled) { background: #976316; }

  .kg-btn.is-busy {
    background: var(--color-surface);
    color: var(--color-text-tertiary);
    border-color: var(--color-border);
    cursor: progress;
  }

  .kg-btn--ghost {
    color: var(--color-text-secondary);
    background: var(--color-surface);
    border-color: var(--color-border-subtle);
    text-decoration: none;
    text-align: center;
    margin-top: 8px;
  }
  .kg-btn--ghost:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-surface-raised);
    border-color: var(--color-border);
  }

  .kg-mono-note {
    margin: 6px 0 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--color-text-tertiary);
  }

  .kg-help-note {
    margin: 6px 0 0;
    text-align: center;
    font-size: 11.5px;
    color: var(--color-text-tertiary);
    line-height: 1.45;
  }

  .kg-disclosure {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 4px 0;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: color 120ms ease;
  }

  .kg-disclosure:hover {
    color: var(--color-text);
  }

  .kg-disclosure--bar {
    padding: 12px 18px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .kg-disclosure--bar:hover {
    background: var(--color-surface);
  }

  .kg-disclosure__title {
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .kg-disclosure__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
    margin-left: 4px;
  }

  .kg-disclosure__chev {
    display: inline-block;
    transition: transform 120ms ease;
    color: var(--color-text-tertiary);
    font-size: 11px;
  }

  .kg-disclosure__chev.is-open {
    transform: rotate(180deg);
  }

  .kg-fieldset {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kg-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .kg-input {
    padding: 7px 10px;
    font-size: 12.5px;
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  :global(.dark) .kg-input {
    background: var(--color-surface);
  }

  .kg-input:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-tint);
  }

  .kg-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .kg-canvas {
    flex: 1;
    min-height: 0;
    padding: 16px;
  }

  .kg-analytics {
    border-top: 1px solid var(--color-border-subtle);
    background: var(--color-bg-grain);
  }

  :global(.dark) .kg-analytics {
    background: var(--color-surface-sunken);
  }

  .kg-analytics__body {
    padding: 4px 18px 18px;
    max-height: 384px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kg-card {
    padding: 16px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border-subtle);
    border-radius: 10px;
  }

  :global(.dark) .kg-card {
    background: var(--color-surface);
  }

  .kg-card__title {
    margin: 0 0 12px;
    font-family: var(--font-display);
    font-size: 14.5px;
    font-weight: 500;
    color: var(--color-text);
    letter-spacing: -0.01em;
  }

  .kg-panel {
    padding-top: 18px;
    border-top: 1px solid var(--color-border-subtle);
  }

  .kg-panel:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  .kg-panel__title {
    margin: 0 0 10px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
  }

  .kg-actions-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .kg-actions-row .kg-btn {
    flex: 1;
    margin-top: 0;
  }

  .kg-stack-top {
    margin-top: 10px;
  }
</style>

<!-- Skill Generator Modal -->
{#if showSkillGenerator}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-2xl max-h-[80vh] mx-4">
      <SkillGeneratorPanel
        skillMarkdown={generatedSkillMarkdown}
        onApprove={handleApproveSkill}
        onReject={handleRejectSkill}
        onRegenerate={handleRegenerateSkill}
      />
      <!-- Evidence annotations from citations -->
      {#if generatedSkillMarkdown}
        {@const citations = extractCitations(generatedSkillMarkdown)}
        {@const links = linkCitationsToNotes(citations, $notes)}
        {#if links.length > 0}
          <div class="mt-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Source Citations</p>
            <div class="flex flex-wrap gap-2">
              {#each links as link}
                <SkillEvidenceAnnotation {link} onClick={handleEvidenceClick} />
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
