import { describe, expect, it } from 'vitest';
import { parseMarkdownWithFrontmatter, serializeMarkdownWithFrontmatter } from './vaultFrontmatter';

describe('parseMarkdownWithFrontmatter', () => {
  it('parses frontmatter and preserves the markdown body', () => {
    const document = `---
id: wiki-concept-llm-wiki
page_type: concept
title: LLM Wiki
source_ids:
  - src-1
  - src-2
backlinks:
  - wiki-topic-retrieval-vs-compilation
last_updated_reason: ingest
---
# LLM Wiki

Compiled knowledge beats re-deriving it every time.
`;

    const parsed = parseMarkdownWithFrontmatter(document);

    expect(parsed.data).toEqual({
      id: 'wiki-concept-llm-wiki',
      page_type: 'concept',
      title: 'LLM Wiki',
      source_ids: ['src-1', 'src-2'],
      backlinks: ['wiki-topic-retrieval-vs-compilation'],
      last_updated_reason: 'ingest',
    });
    expect(parsed.body).toBe('# LLM Wiki\n\nCompiled knowledge beats re-deriving it every time.\n');
  });

  it('returns an empty metadata object when there is no frontmatter', () => {
    const parsed = parseMarkdownWithFrontmatter('# Just body\n');

    expect(parsed.data).toEqual({});
    expect(parsed.body).toBe('# Just body\n');
  });
});

describe('serializeMarkdownWithFrontmatter', () => {
  it('serializes frontmatter in a stable key order and round-trips the body', () => {
    const serialized = serializeMarkdownWithFrontmatter(
      {
        title: 'LLM Wiki',
        id: 'wiki-concept-llm-wiki',
        source_ids: ['src-1', 'src-2'],
        page_type: 'concept',
      },
      '# LLM Wiki\n\nCompiled knowledge beats re-deriving it every time.\n'
    );

    expect(serialized).toBe(`---
id: wiki-concept-llm-wiki
page_type: concept
source_ids:
  - src-1
  - src-2
title: LLM Wiki
---
# LLM Wiki

Compiled knowledge beats re-deriving it every time.
`);

    expect(parseMarkdownWithFrontmatter(serialized)).toEqual({
      data: {
        id: 'wiki-concept-llm-wiki',
        page_type: 'concept',
        source_ids: ['src-1', 'src-2'],
        title: 'LLM Wiki',
      },
      body: '# LLM Wiki\n\nCompiled knowledge beats re-deriving it every time.\n',
    });
  });
});
