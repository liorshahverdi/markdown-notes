import { describe, it, expect } from 'vitest';
import { buildImplicitExtractionPrompt, parseExtractionResponse, buildEntityValidationPrompt, parseValidationResponse } from './implicitExtractor';

describe('implicitExtractor', () => {
  describe('buildImplicitExtractionPrompt', () => {
    it('includes note title and content', () => {
      const prompt = buildImplicitExtractionPrompt('My Note', 'Some content here');
      expect(prompt).toContain('My Note');
      expect(prompt).toContain('Some content here');
    });

    it('asks for causal relationships', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt.toLowerCase()).toContain('causal');
    });

    it('asks for temporal sequences', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt.toLowerCase()).toContain('temporal');
    });

    it('asks for hierarchical structures', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt.toLowerCase()).toContain('hierarch');
    });

    it('asks for attendance relationships', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt.toLowerCase()).toContain('attendance');
    });

    it('asks for location relationships', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt.toLowerCase()).toContain('location');
    });

    it('asks for ownership relationships', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt.toLowerCase()).toContain('ownership');
    });

    it('includes POLE+O-aware relationship types', () => {
      const prompt = buildImplicitExtractionPrompt('Title', 'Content');
      expect(prompt).toContain('attended');
      expect(prompt).toContain('located_at');
      expect(prompt).toContain('owns');
      expect(prompt).toContain('created');
    });
  });

  describe('parseExtractionResponse', () => {
    it('parses a valid JSON array response', () => {
      const response = JSON.stringify([
        { fromEntity: 'A', toEntity: 'B', type: 'causes', confidence: 0.8 },
        { fromEntity: 'C', toEntity: 'D', type: 'part_of', confidence: 0.7 },
      ]);
      const result = parseExtractionResponse(response);
      expect(result).toHaveLength(2);
      expect(result[0].fromEntity).toBe('A');
      expect(result[0].toEntity).toBe('B');
      expect(result[0].type).toBe('causes');
      expect(result[0].confidence).toBe(0.8);
    });

    it('returns empty array for invalid JSON', () => {
      const result = parseExtractionResponse('not valid json');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty response', () => {
      const result = parseExtractionResponse('');
      expect(result).toEqual([]);
    });

    it('filters out entries missing required fields', () => {
      const response = JSON.stringify([
        { fromEntity: 'A', toEntity: 'B', type: 'causes', confidence: 0.8 },
        { fromEntity: 'C' }, // missing fields
        { toEntity: 'D', type: 'x', confidence: 0.5 }, // missing fromEntity
      ]);
      const result = parseExtractionResponse(response);
      expect(result).toHaveLength(1);
    });

    it('handles JSON wrapped in markdown code block', () => {
      const response = '```json\n[{"fromEntity":"A","toEntity":"B","type":"causes","confidence":0.9}]\n```';
      const result = parseExtractionResponse(response);
      expect(result).toHaveLength(1);
      expect(result[0].fromEntity).toBe('A');
    });
  });

  describe('buildEntityValidationPrompt', () => {
    it('includes entity names and types', () => {
      const prompt = buildEntityValidationPrompt(
        [{ name: 'React', type: 'Other', subtype: 'topic' }],
        'Some note content'
      );
      expect(prompt).toContain('React');
      expect(prompt).toContain('Other');
      expect(prompt).toContain('topic');
    });

    it('includes note content', () => {
      const prompt = buildEntityValidationPrompt(
        [{ name: 'Test', type: 'Person' }],
        'The quick brown fox'
      );
      expect(prompt).toContain('The quick brown fox');
    });

    it('mentions POLE+O entity types', () => {
      const prompt = buildEntityValidationPrompt([], 'content');
      expect(prompt).toContain('Person');
      expect(prompt).toContain('Object');
      expect(prompt).toContain('Location');
      expect(prompt).toContain('Event');
      expect(prompt).toContain('Other');
    });
  });

  describe('parseValidationResponse', () => {
    it('parses valid corrections', () => {
      const result = parseValidationResponse({
        corrections: [
          { name: 'React', currentType: 'Other', suggestedType: 'Object', suggestedSubtype: 'tool', reason: 'React is a tool/framework' },
        ],
        missed: [],
      });
      expect(result.corrections).toHaveLength(1);
      expect(result.corrections[0].name).toBe('React');
      expect(result.corrections[0].suggestedType).toBe('Object');
    });

    it('parses valid missed entities', () => {
      const result = parseValidationResponse({
        corrections: [],
        missed: [
          { name: 'Docker', type: 'Object', subtype: 'tool', confidence: 0.8 },
        ],
      });
      expect(result.missed).toHaveLength(1);
      expect(result.missed[0].name).toBe('Docker');
    });

    it('returns empty arrays for null input', () => {
      const result = parseValidationResponse(null);
      expect(result.corrections).toEqual([]);
      expect(result.missed).toEqual([]);
    });

    it('filters out malformed corrections', () => {
      const result = parseValidationResponse({
        corrections: [
          { name: 'Valid', currentType: 'A', suggestedType: 'B', suggestedSubtype: null, reason: 'test' },
          { name: 'Invalid' }, // missing fields
        ],
        missed: [],
      });
      expect(result.corrections).toHaveLength(1);
    });
  });
});
