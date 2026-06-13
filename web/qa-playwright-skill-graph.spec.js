import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('qa-artifacts/skill-graph-edge-drawer');
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

const notes = [
  {
    title: 'Orion Skill Pipeline',
    body: `# Orion Skill Pipeline\n\n## Graph Evidence Review\nThe Orion Skill Pipeline is built with Svelte and uses Knowledge Graph evidence. It depends on Evidence Drawer and Skill Wizard Notes.\n\n[Evidence Drawer Protocol](Evidence Drawer Protocol) and [Skill Wizard Notes](Skill Wizard Notes) describe the review loop.\n\n\`\`\`mermaid\ngraph TD\n  OrionPipeline --> EvidenceDrawer\n  EvidenceDrawer --> SkillWizard\n\`\`\`\n\n#skillgraph #orion`,
  },
  {
    title: 'Evidence Drawer Protocol',
    body: `# Evidence Drawer Protocol\n\n## Edge Provenance Review\nEvidence Drawer Protocol explains why graph edges exist. It links source notes, confidence, extraction method, and excerpts for Orion Skill Pipeline.\n\n[Orion Skill Pipeline](Orion Skill Pipeline) sends selected edges into [Skill Wizard Notes](Skill Wizard Notes).\n\n\`\`\`mermaid\ngraph TD\n  EvidenceDrawer --> SourceNotes\n  SourceNotes --> EdgeProvenance\n\`\`\`\n\n#skillgraph #evidence`,
  },
  {
    title: 'Skill Wizard Notes',
    body: `# Skill Wizard Notes\n\n## Skill Generation Wizard\nSkill Wizard Notes turns selected graph evidence into SKILL.md drafts with Trigger Conditions, Instructions, Knowledge Base, Examples, and Evidence.\n\nIt accepts input from Evidence Drawer Protocol and Orion Skill Pipeline.\n\n\`\`\`mermaid\ngraph TD\n  SkillWizard --> SkillDraft\n  SkillDraft --> ApprovedSkill\n\`\`\`\n\n#skillgraph #wizard`,
  },
  {
    title: 'Approved Skill Export',
    body: `# Approved Skill Export\n\n## Skill Artifact Persistence\nApproved Skill Export writes SKILL.md and metadata.json artifacts after the Skill Wizard Notes review step.\n\nIt depends on Skill Wizard Notes and cites Evidence Drawer Protocol.\n\n\`\`\`mermaid\ngraph TD\n  ApprovedSkill --> SkillMarkdown\n  ApprovedSkill --> SkillMetadata\n\`\`\`\n\n#skillgraph #export`,
  },
];

test('QA: edge drawer and skill generation from connected graph notes', async ({ page }) => {
  test.setTimeout(240_000);

  const bugs = [];
  page.on('pageerror', (err) => bugs.push(`Page error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') bugs.push(`Console error: ${msg.text()}`);
  });

  await page.goto('http://127.0.0.1:5173/login');
  await shot(page, '01-login');
  await page.getByRole('tab', { name: /create account/i }).click();
  await page.getByLabel('Username').fill(`qa-${Date.now()}`);
  await page.getByLabel('Password').fill('playwright-qa-password');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/');
  await expect(page.getByRole('button', { name: /new note/i })).toBeVisible({ timeout: 10_000 });
  await shot(page, '02-empty-workspace');

  for (let i = 0; i < notes.length; i++) {
    await page.getByRole('button', { name: /new note/i }).click();
    const editor = page.locator('.cm-content').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(notes[i].body);
    await page.waitForTimeout(1400);
    await expect(page.getByText(notes[i].title).first()).toBeVisible({ timeout: 10_000 });
    await shot(page, `03-note-${i + 1}-${notes[i].title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  }

  await page.goto('http://127.0.0.1:5173/graph');
  await expect(page.getByRole('heading', { name: /knowledge graph/i })).toBeVisible({ timeout: 15_000 });
  await shot(page, '04-graph-before-sync');

  await page.getByRole('button', { name: /sync notes/i }).click();
  await page.waitForTimeout(10_000);
  const stillSyncing = await page.getByRole('button', { name: /syncing/i }).isVisible().catch(() => false);
  if (stillSyncing) {
    bugs.push('Sync notes & analyze remained in “Syncing…” state for >10s even though graph counts were populated; likely self-improvement/Ollama work blocks the sync UI from completing.');
  }
  await shot(page, '05-graph-after-sync');

  const canvasBox = await page.locator('.kg-canvas').boundingBox();
  if (!canvasBox) throw new Error('Graph canvas not found');

  // Try to select a rendered graph edge first by clicking around the center and nearby points.
  const clickPoints = [
    [0.50, 0.50], [0.45, 0.48], [0.55, 0.52], [0.50, 0.42], [0.40, 0.55], [0.60, 0.45],
  ];
  let drawerVisible = false;
  for (const [px, py] of clickPoints) {
    await page.mouse.click(canvasBox.x + canvasBox.width * px, canvasBox.y + canvasBox.height * py);
    await page.waitForTimeout(700);
    drawerVisible = await page.getByLabel('Graph edge details').isVisible().catch(() => false);
    if (drawerVisible) break;
  }

  if (!drawerVisible) {
    bugs.push('Could not reliably select a graph edge by clicking the vis-network canvas; edge hit targets are hard to discover and there is no keyboard/list fallback. Continuing with node selection flow.');
    await shot(page, '06-edge-selection-not-found');
  } else {
    await shot(page, '06-edge-drawer-open');
    const hasProvenance = await page.getByText(/No provenance captured/i).isVisible().catch(() => false);
    if (hasProvenance) bugs.push('Selected edge drawer opened but showed “No provenance captured”; graph extraction appears to drop method/excerpt provenance before persistence.');
    await page.getByRole('button', { name: /accept edge/i }).click().catch((e) => bugs.push(`Accept edge failed: ${e.message}`));
    await shot(page, '07-edge-accepted');
    await page.getByRole('button', { name: /generate skill from this edge/i }).click().catch((e) => bugs.push(`Generate skill from edge failed: ${e.message}`));
    await page.waitForTimeout(1000);
    await shot(page, '08-edge-skill-wizard-draft');
    if (await page.getByText(/Required SKILL\.md sections/i).isVisible().catch(() => false)) {
      bugs.push('Generate skill from edge opens the approval modal with the prompt text, not a generated skill draft; user must approve a prompt-shaped artifact unless an LLM generation step is added.');
    }
    await page.getByRole('button', { name: /^Reject$/ }).click().catch((e) => bugs.push(`Closing edge skill draft failed: ${e.message}`));
    await page.waitForTimeout(500);
  }

  // Node/subgraph skill flow: filter to one connected note first so the remaining node is easier to hit on the canvas.
  await page.getByRole('textbox', { name: /search/i }).fill('Orion Skill Pipeline');
  await page.waitForTimeout(1200);
  const filteredCanvasBox = await page.locator('.kg-canvas').boundingBox();
  if (!filteredCanvasBox) throw new Error('Filtered graph canvas not found');
  for (const [px, py] of [[0.50, 0.50], [0.45, 0.50], [0.55, 0.50], [0.50, 0.42], [0.50, 0.58]]) {
    await page.mouse.click(filteredCanvasBox.x + filteredCanvasBox.width * px, filteredCanvasBox.y + filteredCanvasBox.height * py);
    await page.waitForTimeout(600);
    if (await page.getByRole('button', { name: /generate skill from selection/i }).isVisible().catch(() => false)) break;
  }
  await shot(page, '09-node-selection');

  if (await page.getByRole('button', { name: /generate skill from selection/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /generate skill from selection/i }).click();
    await page.waitForTimeout(3000);
    await shot(page, '10-skill-generation-modal');
    const failed = await page.getByText(/Generation failed/i).isVisible().catch(() => false);
    if (failed) bugs.push('Skill generation from selected node/cluster failed, likely because Ollama is unavailable or not configured; UI does show the failure in the modal.');
    await page.getByRole('button', { name: /approve/i }).click().catch((e) => bugs.push(`Approve generated skill failed: ${e.message}`));
    await page.waitForTimeout(500);
    await shot(page, '11-after-skill-approve');
  } else {
    bugs.push('Could not select a graph node reliably from the canvas; no accessible node list or selection fallback was available.');
    await page.getByRole('button', { name: /analytics & insights/i }).click();
    await page.waitForTimeout(800);
    await shot(page, '10-analytics-skill-candidates');
    const firstGenerate = page.getByRole('button', { name: /^Generate Skill$/ }).first();
    if (await firstGenerate.isVisible().catch(() => false)) {
      await firstGenerate.click();
      await page.waitForTimeout(3000);
      await shot(page, '11-skill-generation-modal-from-candidate');
      const failed = await page.getByText(/Generation failed/i).isVisible().catch(() => false);
      if (failed) bugs.push('Skill generation from analytics candidate failed, likely because Ollama is unavailable or model generation errored; UI shows the failure in the modal.');
      await page.getByRole('button', { name: /approve/i }).click().catch((e) => bugs.push(`Approve candidate skill failed: ${e.message}`));
      await page.waitForTimeout(500);
      await shot(page, '12-after-candidate-skill-approve');
    } else {
      bugs.push('No Generate Skill button appeared under Analytics & insights despite graph clusters being present.');
    }
  }

  // Ensure any modal is closed before opening the side-panel skills list.
  if (await page.getByRole('heading', { name: /Skill Review/i }).isVisible().catch(() => false)) {
    bugs.push('Skill Review modal was still open before skills-list verification; closing it to continue QA.');
    await page.getByRole('button', { name: /^Reject$/ }).click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Open skills list to verify a persisted skill is visible if approval succeeded.
  const skillsDisclosure = page.getByRole('button').filter({ hasText: /Skills/ }).first();
  if (await skillsDisclosure.isVisible().catch(() => false)) {
    await skillsDisclosure.click();
    await shot(page, '13-skills-list-open');
  }

  fs.writeFileSync(path.join(outDir, 'bugs.json'), JSON.stringify(bugs, null, 2));
  console.log('QA_BUGS', JSON.stringify(bugs, null, 2));
});
