<svelte:head>
  <title>Skills</title>
</svelte:head>

<main class="skills-page">
  <header>
    <p class="eyebrow">Agent skills</p>
    <h1>Generate reusable skills from graph evidence</h1>
    <p>
      Skills are markdown artifacts distilled from notes, entities, and graph connections.
      Select graph evidence, review citations, then export a SKILL.md-ready instruction set.
    </p>
  </header>

  <section class="placeholder" aria-label="Skill workflow status">
    <h2>Skill workflow</h2>
    <ul>
      <li>Choose graph nodes, edges, clusters, or bridges.</li>
      <li>Generate a cited markdown skill from the selected evidence.</li>
      <li>Review, approve, and export as <code>SKILL.md</code>.</li>
    </ul>
  </section>
</main>

<style>
  .skills-page {
    min-height: 100%;
    padding: 32px;
    background: var(--color-bg);
    color: var(--color-text);
  }

  header,
  .placeholder {
    max-width: 760px;
  }

  header {
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

  .placeholder {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 20px;
    background: var(--color-surface);
  }

  .placeholder h2 {
    margin: 0 0 10px;
    font-size: 16px;
  }

  .placeholder ul {
    margin: 0;
    padding-left: 20px;
    color: var(--color-text-secondary);
    line-height: 1.7;
  }
</style>
