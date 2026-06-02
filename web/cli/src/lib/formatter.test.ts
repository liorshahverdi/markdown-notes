import { describe, it, expect } from 'vitest';
import { formatNote, formatResponse, formatSkill, formatStats } from './formatter';

describe('formatter', () => {
  describe('formatNote', () => {
    it('formats a note with title, date, and content preview', () => {
      const note = {
        id: '1',
        title: 'My Note',
        content: '# My Note\n\nThis is the content of my note with lots of text.',
        dateModified: new Date('2025-01-15T10:30:00Z').getTime(),
        isPinned: false,
      };

      const result = formatNote(note);

      expect(result).toContain('My Note');
      expect(result).toContain('2025');
      expect(result).toContain('This is the content');
    });

    it('shows pinned indicator for pinned notes', () => {
      const note = {
        id: '1',
        title: 'Pinned Note',
        content: '# Pinned Note\n\nContent here.',
        dateModified: Date.now(),
        isPinned: true,
      };

      const result = formatNote(note);
      expect(result).toContain('pinned');
    });

    it('truncates long content preview', () => {
      const longContent = '# Title\n\n' + 'A'.repeat(300);
      const note = {
        id: '1',
        title: 'Long Note',
        content: longContent,
        dateModified: Date.now(),
        isPinned: false,
      };

      const result = formatNote(note);
      expect(result).toContain('...');
      // The preview should be significantly shorter than the full content
      expect(result.length).toBeLessThan(longContent.length);
    });

    it('handles notes with empty content', () => {
      const note = {
        id: '1',
        title: 'Empty Note',
        content: '',
        dateModified: Date.now(),
        isPinned: false,
      };

      const result = formatNote(note);
      expect(result).toContain('Empty Note');
    });
  });

  describe('formatResponse', () => {
    it('formats a RAG response with sources', () => {
      const response = 'TypeScript is a typed superset of JavaScript.';
      const sources = [
        { noteId: '1', title: 'TypeScript Basics', relevanceScore: 0.95 },
        { noteId: '2', title: 'JS Notes', relevanceScore: 0.72 },
      ];

      const result = formatResponse(response, sources);

      expect(result).toContain('TypeScript is a typed superset of JavaScript.');
      expect(result).toContain('TypeScript Basics');
      expect(result).toContain('JS Notes');
      expect(result).toContain('Sources');
    });

    it('formats response with no sources', () => {
      const result = formatResponse('No relevant notes found.', []);

      expect(result).toContain('No relevant notes found.');
      // Should still be valid output without sources section
      expect(result).not.toContain('undefined');
    });

    it('includes relevance scores', () => {
      const sources = [
        { noteId: '1', title: 'Note 1', relevanceScore: 0.95 },
      ];

      const result = formatResponse('answer', sources);
      expect(result).toContain('95%');
    });
  });

  describe('formatSkill', () => {
    it('formats a skill with name, domain, and type', () => {
      const skill = {
        id: 's1',
        name: 'TypeScript Patterns',
        domain: 'programming',
        type: 'single' as const,
        content: '# TypeScript Patterns\n\nContent here.',
        sourceNoteIds: ['1', '2'],
        parentSkillIds: [],
        dependencies: { requires: [], enhances: [] },
        confidence: 'high' as const,
        versions: [],
        createdAt: new Date('2025-01-15').getTime(),
        updatedAt: new Date('2025-01-15').getTime(),
      };

      const result = formatSkill(skill);

      expect(result).toContain('TypeScript Patterns');
      expect(result).toContain('programming');
      expect(result).toContain('single');
      expect(result).toContain('high');
    });

    it('shows source note count', () => {
      const skill = {
        id: 's1',
        name: 'Skill',
        domain: 'general',
        type: 'merged' as const,
        content: '',
        sourceNoteIds: ['1', '2', '3'],
        parentSkillIds: ['p1'],
        dependencies: { requires: [], enhances: [] },
        confidence: 'medium' as const,
        versions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = formatSkill(skill);
      expect(result).toContain('3');
    });
  });

  describe('formatStats', () => {
    it('formats graph statistics', () => {
      const stats = {
        nodes: 42,
        edges: 85,
        clusters: 7,
      };

      const result = formatStats(stats);

      expect(result).toContain('42');
      expect(result).toContain('85');
      expect(result).toContain('7');
    });

    it('includes labels for each stat', () => {
      const stats = { nodes: 1, edges: 2, clusters: 3 };
      const result = formatStats(stats);

      expect(result.toLowerCase()).toContain('node');
      expect(result.toLowerCase()).toContain('edge');
      expect(result.toLowerCase()).toContain('cluster');
    });

    it('handles zero stats', () => {
      const stats = { nodes: 0, edges: 0, clusters: 0 };
      const result = formatStats(stats);

      expect(result).toContain('0');
    });
  });
});
