export type FrontmatterValue = string | string[];
export type FrontmatterData = Record<string, FrontmatterValue>;

export interface ParsedMarkdownWithFrontmatter {
  data: FrontmatterData;
  body: string;
}

export function parseMarkdownWithFrontmatter(document: string): ParsedMarkdownWithFrontmatter {
  if (!document.startsWith('---\n')) {
    return { data: {}, body: document };
  }

  const closingMarkerIndex = document.indexOf('\n---\n', 4);
  if (closingMarkerIndex === -1) {
    return { data: {}, body: document };
  }

  const frontmatterBlock = document.slice(4, closingMarkerIndex);
  const body = document.slice(closingMarkerIndex + 5);
  const data: FrontmatterData = {};
  const lines = frontmatterBlock.split('\n');

  let currentArrayKey: string | null = null;

  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (!currentArrayKey) {
        throw new Error('Array entry found before a frontmatter array key');
      }
      const existing = data[currentArrayKey];
      if (!Array.isArray(existing)) {
        throw new Error(`Frontmatter key ${currentArrayKey} is not an array`);
      }
      existing.push(line.slice(4));
      continue;
    }

    currentArrayKey = null;
    if (!line.trim()) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (rawValue === '') {
      data[key] = [];
      currentArrayKey = key;
    } else {
      data[key] = rawValue;
    }
  }

  return { data, body };
}

export function serializeMarkdownWithFrontmatter(data: FrontmatterData, body: string): string {
  const keys = Object.keys(data).sort();
  if (keys.length === 0) {
    return body;
  }

  const lines: string[] = ['---'];

  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');

  return `${lines.join('\n')}\n${body}`;
}
