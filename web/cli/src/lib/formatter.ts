import type { NoteRecord, SkillRecord } from './apiClient';

const MAX_PREVIEW_LENGTH = 200;

export function formatNote(note: NoteRecord): string {
  const date = new Date(note.dateModified).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const pinnedTag = note.isPinned ? ' [pinned]' : '';

  // Strip the markdown heading if it matches the title
  let preview = note.content;
  const headingMatch = preview.match(/^#\s+.+\n+/);
  if (headingMatch) {
    preview = preview.slice(headingMatch[0].length);
  }
  preview = preview.trim();

  if (preview.length > MAX_PREVIEW_LENGTH) {
    preview = preview.slice(0, MAX_PREVIEW_LENGTH) + '...';
  }

  const lines: string[] = [
    `${note.title}${pinnedTag}`,
    `  Modified: ${date}`,
  ];

  if (preview) {
    lines.push(`  ${preview}`);
  }

  return lines.join('\n');
}

export function formatResponse(
  response: string,
  sources: Array<{ noteId: string; title: string; relevanceScore: number }>
): string {
  const lines: string[] = [response];

  if (sources.length > 0) {
    lines.push('');
    lines.push('Sources:');
    for (const source of sources) {
      const pct = Math.round(source.relevanceScore * 100);
      lines.push(`  - ${source.title} (${pct}%)`);
    }
  }

  return lines.join('\n');
}

export function formatSkill(skill: {
  id: string;
  name: string;
  domain: string;
  type: string;
  sourceNoteIds: string[];
  confidence?: string;
}): string {
  const lines: string[] = [
    `${skill.name}`,
    `  Domain: ${skill.domain}`,
    `  Type: ${skill.type}`,
  ];

  if (skill.confidence) {
    lines.push(`  Confidence: ${skill.confidence}`);
  }

  lines.push(`  Source notes: ${skill.sourceNoteIds.length}`);

  return lines.join('\n');
}

export function formatStats(stats: { nodes: number; edges: number; clusters: number }): string {
  const lines: string[] = [
    'Graph Statistics:',
    `  Nodes: ${stats.nodes}`,
    `  Edges: ${stats.edges}`,
    `  Clusters: ${stats.clusters}`,
  ];

  return lines.join('\n');
}
