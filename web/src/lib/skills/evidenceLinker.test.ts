import { describe, it, expect } from 'vitest';
import { extractCitations, linkCitationsToNotes, type EvidenceLink } from './evidenceLinker';

describe('evidenceLinker', () => {
  describe('extractCitations', () => {
    it('should extract [Note: "..."] citations from markdown', () => {
      const md = 'This is based on [Note: "TypeScript Basics"] and [Note: "Design Patterns"].';
      const citations = extractCitations(md);
      expect(citations).toHaveLength(2);
      expect(citations).toContain('TypeScript Basics');
      expect(citations).toContain('Design Patterns');
    });

    it('should return empty array when no citations present', () => {
      const md = 'No citations here.';
      expect(extractCitations(md)).toEqual([]);
    });

    it('should handle single-quoted citations', () => {
      const md = "Based on [Note: 'My Note'].";
      const citations = extractCitations(md);
      expect(citations).toHaveLength(1);
      expect(citations).toContain('My Note');
    });

    it('should handle citations without quotes', () => {
      const md = 'See [Note: Project Architecture] for details.';
      const citations = extractCitations(md);
      expect(citations).toHaveLength(1);
      expect(citations).toContain('Project Architecture');
    });

    it('should handle multiple citations on separate lines', () => {
      const md = `First [Note: "Note A"]
Second [Note: "Note B"]
Third [Note: "Note C"]`;
      const citations = extractCitations(md);
      expect(citations).toHaveLength(3);
    });

    it('should not extract duplicate citations', () => {
      const md = '[Note: "Same"] and again [Note: "Same"]';
      const citations = extractCitations(md);
      expect(citations).toHaveLength(1);
    });
  });

  describe('linkCitationsToNotes', () => {
    const notes = [
      { id: 'n1', title: 'TypeScript Basics', content: 'TypeScript is a typed superset of JavaScript. It compiles to plain JS.' },
      { id: 'n2', title: 'Design Patterns', content: 'Common patterns include Factory, Observer, and Strategy patterns.' },
      { id: 'n3', title: 'Project Architecture', content: 'The architecture follows a clean layered approach.' },
    ];

    it('should link exact title matches', () => {
      const links = linkCitationsToNotes(['TypeScript Basics'], notes);
      expect(links).toHaveLength(1);
      expect(links[0].noteId).toBe('n1');
      expect(links[0].noteTitle).toBe('TypeScript Basics');
    });

    it('should return citation text in the link', () => {
      const links = linkCitationsToNotes(['TypeScript Basics'], notes);
      expect(links[0].citation).toContain('TypeScript Basics');
    });

    it('should handle case-insensitive matching', () => {
      const links = linkCitationsToNotes(['typescript basics'], notes);
      expect(links).toHaveLength(1);
      expect(links[0].noteId).toBe('n1');
    });

    it('should handle partial/fuzzy title matching', () => {
      const links = linkCitationsToNotes(['TypeScript'], notes);
      expect(links).toHaveLength(1);
      expect(links[0].noteId).toBe('n1');
    });

    it('should return empty array for unmatched citations', () => {
      const links = linkCitationsToNotes(['Nonexistent Note'], notes);
      expect(links).toHaveLength(0);
    });

    it('should include matched passage from the note', () => {
      const links = linkCitationsToNotes(['TypeScript Basics'], notes);
      expect(links[0].matchedPassage).toBeTruthy();
      expect(typeof links[0].matchedPassage).toBe('string');
    });

    it('should include startIndex for the passage', () => {
      const links = linkCitationsToNotes(['TypeScript Basics'], notes);
      expect(typeof links[0].startIndex).toBe('number');
      expect(links[0].startIndex).toBeGreaterThanOrEqual(0);
    });

    it('should link multiple citations to different notes', () => {
      const links = linkCitationsToNotes(['TypeScript Basics', 'Design Patterns'], notes);
      expect(links).toHaveLength(2);
      const noteIds = links.map(l => l.noteId);
      expect(noteIds).toContain('n1');
      expect(noteIds).toContain('n2');
    });
  });
});
