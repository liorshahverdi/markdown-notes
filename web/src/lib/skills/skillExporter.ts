import type { SkillRecord } from './skillTemplate';

/**
 * Export a skill as a markdown file with YAML frontmatter.
 */
export function exportSkillAsMarkdown(skill: SkillRecord): Blob {
  const frontmatter = [
    '---',
    `name: "${skill.name}"`,
    `domain: "${skill.domain}"`,
    `type: ${skill.type}`,
    `confidence: ${skill.confidence}`,
    `createdAt: ${new Date(skill.createdAt).toISOString()}`,
    `updatedAt: ${new Date(skill.updatedAt).toISOString()}`,
    `sourceNoteIds:`,
    ...skill.sourceNoteIds.map((id) => `  - "${id}"`),
    `parentSkillIds:`,
    ...skill.parentSkillIds.map((id) => `  - "${id}"`),
    `dependencies:`,
    `  requires:`,
    ...skill.dependencies.requires.map((id) => `    - "${id}"`),
    `  enhances:`,
    ...skill.dependencies.enhances.map((id) => `    - "${id}"`),
    '---',
    '',
  ].join('\n');

  const content = frontmatter + (skill.content || `# ${skill.name}\n\nNo content generated.\n`);
  return new Blob([content], { type: 'text/markdown' });
}

/**
 * Export a skill as JSON.
 */
export function exportSkillAsJSON(skill: SkillRecord): Blob {
  const json = JSON.stringify(skill, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Export all skills as a single JSON file.
 */
export function exportAllSkillsAsJSON(skills: SkillRecord[]): Blob {
  const json = JSON.stringify({ skills, exportedAt: new Date().toISOString() }, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Download a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
