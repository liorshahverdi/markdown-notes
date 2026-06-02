import { describe, it, expect } from 'vitest';
import { generateSkillTemplate, parseSkillMarkdown, type SkillRecord } from './skillTemplate';

describe('skillTemplate', () => {
  describe('generateSkillTemplate', () => {
    it('should return a markdown string', () => {
      const result = generateSkillTemplate({
        name: 'TypeScript Development',
        domain: 'Programming',
        description: 'Skills for TypeScript development',
        triggerConditions: 'When writing TypeScript code',
        instructions: 'Follow best practices',
        knowledgeBase: 'TypeScript handbook notes',
        examples: '```ts\nconst x: number = 1;\n```',
        evidence: '[Note: "TS Basics"]',
        sourceNotes: ['note-1', 'note-2'],
        confidence: 'high',
      });
      expect(typeof result).toBe('string');
      expect(result).toContain('TypeScript Development');
    });

    it('should include all required sections in the output', () => {
      const result = generateSkillTemplate({
        name: 'Test Skill',
        domain: 'Testing',
        description: 'A test skill',
        triggerConditions: 'When testing',
        instructions: 'Write tests first',
        knowledgeBase: 'Testing knowledge',
        examples: 'Example code',
        evidence: '[Note: "Testing"]',
        sourceNotes: ['n1'],
        confidence: 'medium',
      });
      expect(result).toContain('# Test Skill');
      expect(result).toContain('## Description');
      expect(result).toContain('## Trigger Conditions');
      expect(result).toContain('## Instructions');
      expect(result).toContain('## Knowledge Base');
      expect(result).toContain('## Examples');
      expect(result).toContain('## Evidence');
      expect(result).toContain('## Metadata');
    });

    it('should include domain and confidence in metadata section', () => {
      const result = generateSkillTemplate({
        name: 'My Skill',
        domain: 'Engineering',
        description: 'desc',
        triggerConditions: 'trigger',
        instructions: 'instructions',
        knowledgeBase: 'kb',
        examples: 'ex',
        evidence: 'ev',
        sourceNotes: ['n1'],
        confidence: 'high',
      });
      expect(result).toContain('Engineering');
      expect(result).toContain('high');
    });

    it('should include source note IDs', () => {
      const result = generateSkillTemplate({
        name: 'Skill',
        domain: 'Domain',
        description: 'desc',
        triggerConditions: 'trigger',
        instructions: 'inst',
        knowledgeBase: 'kb',
        examples: 'ex',
        evidence: 'ev',
        sourceNotes: ['note-abc', 'note-def'],
        confidence: 'low',
      });
      expect(result).toContain('note-abc');
      expect(result).toContain('note-def');
    });
  });

  describe('parseSkillMarkdown', () => {
    it('should parse name from h1 heading', () => {
      const md = '# My Skill\n\n## Description\nSome description';
      const parsed = parseSkillMarkdown(md);
      expect(parsed.name).toBe('My Skill');
    });

    it('should parse description section', () => {
      const md = '# Skill\n\n## Description\nThis is the description.\n\n## Trigger Conditions\nTrigger';
      const parsed = parseSkillMarkdown(md);
      expect(parsed.content).toContain('This is the description.');
    });

    it('should parse domain from metadata', () => {
      const md = '# Skill\n\n## Metadata\n- **Domain**: Engineering\n- **Confidence**: high';
      const parsed = parseSkillMarkdown(md);
      expect(parsed.domain).toBe('Engineering');
    });

    it('should parse confidence from metadata', () => {
      const md = '# Skill\n\n## Metadata\n- **Domain**: Test\n- **Confidence**: medium';
      const parsed = parseSkillMarkdown(md);
      expect(parsed.confidence).toBe('medium');
    });

    it('should parse source note IDs from metadata', () => {
      const md = '# Skill\n\n## Metadata\n- **Source Notes**: note-1, note-2';
      const parsed = parseSkillMarkdown(md);
      expect(parsed.sourceNoteIds).toContain('note-1');
      expect(parsed.sourceNoteIds).toContain('note-2');
    });

    it('should round-trip: generate then parse should preserve key fields', () => {
      const original = generateSkillTemplate({
        name: 'Round Trip Skill',
        domain: 'Testing',
        description: 'A round trip test',
        triggerConditions: 'When round tripping',
        instructions: 'Follow the loop',
        knowledgeBase: 'KB data',
        examples: 'Example here',
        evidence: '[Note: "Test"]',
        sourceNotes: ['note-1'],
        confidence: 'high',
      });
      const parsed = parseSkillMarkdown(original);
      expect(parsed.name).toBe('Round Trip Skill');
      expect(parsed.domain).toBe('Testing');
      expect(parsed.confidence).toBe('high');
      expect(parsed.sourceNoteIds).toContain('note-1');
    });
  });
});
