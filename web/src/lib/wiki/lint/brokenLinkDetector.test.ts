import { describe, expect, it } from 'vitest';
import { detectBrokenWikiLinks } from './brokenLinkDetector';

describe('detectBrokenWikiLinks', () => {
  it('finds Obsidian wiki links that do not target an existing wiki page path', () => {
    const findings = detectBrokenWikiLinks({
      existingWikiPaths: ['wiki/entities/ada-lovelace.md', 'wiki/index.md'],
      markdownByPageId: new Map([
        ['entity-ada', '# Ada\n\nSee [[concepts/symbolic-programming|symbolic programming]] and [[entities/ada-lovelace|Ada]].'],
      ]),
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: 'broken-link:entity-ada:concepts/symbolic-programming',
        type: 'broken-link',
        severity: 'error',
        pageId: 'entity-ada',
        target: 'concepts/symbolic-programming',
        action: 'Create the missing page or update/remove the wiki link.',
      }),
    ]);
  });
});
