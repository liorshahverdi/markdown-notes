export interface EvidenceLink {
  citation: string;
  noteId: string;
  noteTitle: string;
  matchedPassage: string;
  startIndex: number;
}

/**
 * Extract all [Note: "..."] or [Note: '...'] or [Note: ...] patterns from skill markdown.
 * Returns deduplicated note title strings.
 */
export function extractCitations(skillMarkdown: string): string[] {
  const pattern = /\[Note:\s*(?:"([^"]+)"|'([^']+)'|([^\]]+))\]/g;
  const citations = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(skillMarkdown)) !== null) {
    const title = (match[1] || match[2] || match[3]).trim();
    citations.add(title);
  }

  return Array.from(citations);
}

/**
 * Match citations to actual note passages using fuzzy title matching.
 */
export function linkCitationsToNotes(
  citations: string[],
  notes: Array<{ id: string; title: string; content: string }>
): EvidenceLink[] {
  const links: EvidenceLink[] = [];

  for (const citation of citations) {
    const citationLower = citation.toLowerCase();

    // Try exact match first, then substring match
    let matched = notes.find(n => n.title.toLowerCase() === citationLower);

    if (!matched) {
      // Fuzzy: find notes whose title contains the citation or vice versa
      matched = notes.find(
        n =>
          n.title.toLowerCase().includes(citationLower) ||
          citationLower.includes(n.title.toLowerCase())
      );
    }

    if (matched) {
      // Extract a meaningful passage (first sentence or first 200 chars)
      const content = matched.content;
      const firstSentenceEnd = content.search(/[.!?]\s/);
      const passageEnd = firstSentenceEnd > 0 ? firstSentenceEnd + 1 : Math.min(content.length, 200);
      const matchedPassage = content.substring(0, passageEnd);

      links.push({
        citation: `[Note: "${citation}"]`,
        noteId: matched.id,
        noteTitle: matched.title,
        matchedPassage,
        startIndex: 0,
      });
    }
  }

  return links;
}
