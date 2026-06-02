import { describe, it, expect } from 'vitest';
import { extractEntities, isLowValueHeading } from './entityExtractor';

describe('entityExtractor', () => {
  describe('note entity', () => {
    it('always includes the note itself as an entity', () => {
      const result = extractEntities('note-1', 'My Note', '');
      const noteEntity = result.entities.find(
        (e) => e.type === 'note' && e.name === 'My Note'
      );
      expect(noteEntity).toBeDefined();
      expect(noteEntity!.confidence).toBe(1.0);
    });

    it('creates a note entity even with empty content', () => {
      const result = extractEntities('note-1', 'Empty Note', '');
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      expect(result.entities[0]).toEqual({
        name: 'Empty Note',
        type: 'note',
        confidence: 1.0,
      });
    });
  });

  describe('heading extraction', () => {
    it('extracts h2 headings as Other entities with topic subtype', () => {
      const content = '## Machine Learning\n\nSome text here.';
      const result = extractEntities('note-1', 'My Note', content);
      const topic = result.entities.find(
        (e) => e.type === 'Other' && e.subtype === 'topic' && e.name === 'Machine Learning'
      );
      expect(topic).toBeDefined();
      expect(topic!.confidence).toBeGreaterThan(0);
    });

    it('extracts h3 headings as Other entities with topic subtype', () => {
      const content = '### Deep Learning\n\nDetails.';
      const result = extractEntities('note-1', 'My Note', content);
      const topic = result.entities.find(
        (e) => e.type === 'Other' && e.subtype === 'topic' && e.name === 'Deep Learning'
      );
      expect(topic).toBeDefined();
    });

    it('extracts multiple headings', () => {
      const content = '## First Topic\n\nText\n\n### Second Topic\n\nMore text';
      const result = extractEntities('note-1', 'My Note', content);
      const topics = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'topic');
      expect(topics.length).toBe(2);
    });

    it('creates mentions relations from headings to note', () => {
      const content = '## Machine Learning\n\nSome text.';
      const result = extractEntities('note-1', 'My Note', content);
      const mentionRelation = result.relations.find(
        (r) =>
          r.fromName === 'Machine Learning' &&
          r.toName === 'My Note' &&
          r.type === 'mentions'
      );
      expect(mentionRelation).toBeDefined();
    });
  });

  describe('hashtag extraction', () => {
    it('extracts hashtags as Other entities with tag subtype', () => {
      const content = 'This is about #javascript and #typescript';
      const result = extractEntities('note-1', 'My Note', content);
      const tags = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'tag');
      expect(tags.length).toBe(2);
      expect(tags.map((t) => t.name)).toContain('javascript');
      expect(tags.map((t) => t.name)).toContain('typescript');
    });

    it('creates mentions relations from tags to note', () => {
      const content = 'Tagged with #ai';
      const result = extractEntities('note-1', 'My Note', content);
      const mentionRelation = result.relations.find(
        (r) =>
          r.fromName === 'ai' &&
          r.toName === 'My Note' &&
          r.type === 'mentions'
      );
      expect(mentionRelation).toBeDefined();
    });

    it('does not extract heading markers as hashtags', () => {
      const content = '## Heading\n\nSome #realtag here';
      const result = extractEntities('note-1', 'My Note', content);
      const tags = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'tag');
      expect(tags.length).toBe(1);
      expect(tags[0].name).toBe('realtag');
    });
  });

  describe('link extraction', () => {
    it('extracts markdown links as links_to relations', () => {
      const content = 'Check out [Google](https://google.com) for more.';
      const result = extractEntities('note-1', 'My Note', content);
      const linkRelation = result.relations.find(
        (r) => r.type === 'links_to'
      );
      expect(linkRelation).toBeDefined();
      expect(linkRelation!.fromName).toBe('My Note');
      expect(linkRelation!.toName).toBe('Google');
    });

    it('extracts multiple links', () => {
      const content =
        '[Link A](url1) and [Link B](url2)';
      const result = extractEntities('note-1', 'My Note', content);
      const linkRelations = result.relations.filter(
        (r) => r.type === 'links_to'
      );
      expect(linkRelations.length).toBe(2);
    });
  });

  describe('Event extraction', () => {
    it('extracts ISO date patterns as Event entities', () => {
      const content = 'The meeting is on 2024-03-15 at 3pm.';
      const result = extractEntities('note-1', 'My Note', content);
      const events = result.entities.filter((e) => e.type === 'Event');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].name).toBe('2024-03-15');
    });

    it('extracts Month DD, YYYY date patterns as Event entities', () => {
      const content = 'The conference is on January 15, 2024.';
      const result = extractEntities('note-1', 'My Note', content);
      const events = result.entities.filter((e) => e.type === 'Event');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].name).toBe('January 15, 2024');
    });

    it('creates mentioned_in relations for Event entities', () => {
      const content = 'Deadline: 2024-06-30';
      const result = extractEntities('note-1', 'My Note', content);
      const eventRelation = result.relations.find(
        (r) => r.fromName === '2024-06-30' && r.type === 'mentioned_in'
      );
      expect(eventRelation).toBeDefined();
    });
  });

  describe('Object extraction', () => {
    it('extracts tool/framework mentions as Object entities', () => {
      const content = 'This project was built with React and using TypeScript for types.';
      const result = extractEntities('note-1', 'My Note', content);
      const objects = result.entities.filter((e) => e.type === 'Object');
      expect(objects.length).toBeGreaterThanOrEqual(1);
    });

    it('creates mentioned_in relations for Object entities', () => {
      const content = 'Powered by Docker for containerization.';
      const result = extractEntities('note-1', 'My Note', content);
      const objectRelation = result.relations.find(
        (r) => r.type === 'mentioned_in' && result.entities.some((e) => e.type === 'Object' && e.name === r.fromName)
      );
      if (objectRelation) {
        expect(objectRelation.toName).toBe('My Note');
      }
    });
  });

  describe('low-value heading filter', () => {
    it('filters structural headings like Summary, Overview, Introduction', () => {
      expect(isLowValueHeading('Summary')).toBe(true);
      expect(isLowValueHeading('overview')).toBe(true);
      expect(isLowValueHeading('Introduction')).toBe(true);
      expect(isLowValueHeading('usage')).toBe(true);
    });

    it('filters ALL_CAPS constants like QUERY_BODY', () => {
      expect(isLowValueHeading('QUERY_BODY')).toBe(true);
      expect(isLowValueHeading('MAX_RETRIES')).toBe(true);
    });

    it('filters CLI flags like --verbose', () => {
      expect(isLowValueHeading('--verbose')).toBe(true);
      expect(isLowValueHeading('-h')).toBe(true);
    });

    it('filters single short words (<=2 chars)', () => {
      expect(isLowValueHeading('A')).toBe(true);
      expect(isLowValueHeading('OK')).toBe(true);
    });

    it('filters headings longer than 60 chars', () => {
      expect(isLowValueHeading('How environments are detected in priority order and why it matters a lot')).toBe(true);
    });

    it('filters sentence-style headings ending with punctuation', () => {
      expect(isLowValueHeading('How environments are detected:')).toBe(true);
      expect(isLowValueHeading('This is a sentence.')).toBe(true);
    });

    it('filters headings with code-like patterns', () => {
      expect(isLowValueHeading('Use `az login` to authenticate')).toBe(true);
      expect(isLowValueHeading('parseJSON(input)')).toBe(true);
    });

    it('filters numbered list headings', () => {
      expect(isLowValueHeading('2. Falls back to parsing')).toBe(true);
    });

    it('keeps meaningful headings', () => {
      expect(isLowValueHeading('Machine Learning')).toBe(false);
      expect(isLowValueHeading('Neural Networks')).toBe(false);
      expect(isLowValueHeading('React Hooks')).toBe(false);
    });

    it('caps headings at 10 per note', () => {
      const headings = Array.from({ length: 15 }, (_, i) => `## Topic Number ${i + 1}`);
      const content = headings.join('\n\nSome text\n\n');
      const result = extractEntities('note-1', 'Big Note', content);
      const topics = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'topic');
      expect(topics.length).toBeLessThanOrEqual(10);
    });

    it('does not extract filtered headings as entities', () => {
      const content = '## Summary\n\nText\n\n## Machine Learning\n\nMore text';
      const result = extractEntities('note-1', 'My Note', content);
      const topics = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'topic');
      expect(topics.map((t) => t.name)).not.toContain('Summary');
      expect(topics.map((t) => t.name)).toContain('Machine Learning');
    });
  });

  describe('combined extraction', () => {
    it('extracts entities and relations from complex content', () => {
      const content = `## Introduction

This note covers #machinelearning topics.

### Neural Networks

See [TensorFlow](https://tensorflow.org) for implementations.

#deeplearning #ai`;
      const result = extractEntities('note-1', 'Research Notes', content);

      // Note entity
      expect(result.entities.find((e) => e.type === 'note')).toBeDefined();

      // Topics from headings (Introduction is filtered as structural)
      const topics = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'topic');
      expect(topics.map((t) => t.name)).not.toContain('Introduction');
      expect(topics.map((t) => t.name)).toContain('Neural Networks');

      // Tags
      const tags = result.entities.filter((e) => e.type === 'Other' && e.subtype === 'tag');
      expect(tags.length).toBe(3);

      // Links
      const linkRelations = result.relations.filter(
        (r) => r.type === 'links_to'
      );
      expect(linkRelations.length).toBe(1);
    });

    it('deduplicates entities by name and type', () => {
      const content = '#javascript\n\nMore about #javascript';
      const result = extractEntities('note-1', 'My Note', content);
      const jsTags = result.entities.filter(
        (e) => e.type === 'Other' && e.subtype === 'tag' && e.name === 'javascript'
      );
      expect(jsTags.length).toBe(1);
    });
  });
});
