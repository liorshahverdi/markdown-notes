import { describe, expect, it } from 'vitest';
import type { GraphEntity, GraphRelation } from '../../../types/graph';
import {
  calibrateThreshold,
  findCooccurrenceCandidates,
  findDuplicateCandidates,
  normalizeEntityName,
  pairKey,
  relationDedupeKey,
} from './candidates';

function entity(id: string, name: string, type: GraphEntity['type'], notes: string[], subtype?: string): GraphEntity {
  return { id, name, type, subtype, sourceNoteIds: notes };
}

const ALL = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'];

describe('findCooccurrenceCandidates', () => {
  it('links specific co-occurring entities but not ubiquitous tags, notes or folders', () => {
    const entities = [
      entity('object:kafka', 'Kafka', 'Object', ['n1', 'n2', 'n3']),
      entity('object:zookeeper', 'Zookeeper', 'Object', ['n1', 'n2', 'n3']),
      entity('other:tag:#work', '#work', 'Other', ALL, 'tag'),
      entity('folder:projects', 'Projects', 'folder', ALL),
      entity('note:n1', 'Kafka setup', 'note', ['n1']),
    ];
    const candidates = findCooccurrenceCandidates({ entities, relations: [], totalNotes: 10 });
    const pairs = candidates.map((c) => pairKey(c.a.id, c.b.id));
    expect(pairs).toContain(pairKey('object:kafka', 'object:zookeeper'));
    expect(pairs.some((pair) => pair.includes('#work'))).toBe(false);
    expect(pairs.some((pair) => pair.includes('folder:') || pair.includes('note:'))).toBe(false);
  });

  it('filters already-proposed and already-related pairs before applying the limit', () => {
    const entities = Array.from({ length: 6 }, (_, i) => entity(`object:e${i}`, `Entity${i}`, 'Object', ['n1', 'n2']));
    const excluded = new Set<string>();
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) excluded.add(pairKey(`object:e${i}`, `object:e${j}`));
    const fresh = pairKey('object:e4', 'object:e5');
    excluded.delete(fresh);
    const related: GraphRelation[] = [];
    const candidates = findCooccurrenceCandidates({ entities, relations: related, totalNotes: 10, excludedPairKeys: excluded, limit: 1 });
    expect(candidates.map((c) => pairKey(c.a.id, c.b.id))).toEqual([fresh]);
  });
});

describe('findDuplicateCandidates', () => {
  it('never merges across types or merges notes and folders', () => {
    const entities = [
      entity('note:n1', 'Docker', 'note', ['n1']),
      entity('other:tag:docker', 'Docker', 'Other', ['n2'], 'tag'),
      entity('folder:docker', 'Docker', 'folder', ['n3']),
    ];
    expect(findDuplicateCandidates({ entities })).toEqual([]);
  });

  it('finds normalized and near-duplicate names of the same type and keeps the better-supported one', () => {
    const entities = [
      entity('object:react.js', 'React.js', 'Object', ['n1']),
      entity('object:reactjs', 'ReactJS', 'Object', ['n1', 'n2']),
      entity('person:jonathan', 'Jonathan', 'Person', ['n1']),
      entity('person:jonathon', 'Jonathon', 'Person', ['n2']),
      entity('object:java', 'Java', 'Object', ['n1']),
      entity('object:javascript', 'JavaScript', 'Object', ['n2']),
    ];
    const candidates = findDuplicateCandidates({ entities });
    const react = candidates.find((c) => c.keep.id.includes('react'));
    expect(react).toMatchObject({ keep: { id: 'object:reactjs' }, remove: { id: 'object:react.js' } });
    expect(candidates.some((c) => c.keep.type === 'Person')).toBe(true);
    expect(candidates.some((c) => [c.keep.id, c.remove.id].includes('object:javascript'))).toBe(false);
  });

  it('never fuzzy-matches names that differ in their numbers', () => {
    const entities = [
      entity('other:7/13/2026', '7/13/2026', 'Other', ['n1']),
      entity('other:7/16/2026', '7/16/2026', 'Other', ['n2']),
      entity('other:untitled 2', 'Untitled 2', 'Other', ['n1']),
      entity('other:untitled 3', 'Untitled 3', 'Other', ['n2']),
    ];
    expect(findDuplicateCandidates({ entities })).toEqual([]);
  });

  it('normalizes punctuation, case, accents and simple plurals', () => {
    expect(normalizeEntityName('Café APIs')).toBe(normalizeEntityName('cafe api'));
  });
});

describe('relationDedupeKey', () => {
  it('is symmetric for related_to and directional otherwise', () => {
    expect(relationDedupeKey('related_to', 'a', 'b')).toBe(relationDedupeKey('related_to', 'b', 'a'));
    expect(relationDedupeKey('depends_on', 'a', 'b')).not.toBe(relationDedupeKey('depends_on', 'b', 'a'));
  });
});

describe('calibrateThreshold', () => {
  it('uses the base threshold until enough reviews exist', () => {
    expect(calibrateThreshold('cooccurrence', { accepted: 1, rejected: 1 }).threshold).toBe(0.85);
  });

  it('disables auto-apply for sources that are mostly rejected', () => {
    expect(calibrateThreshold('llm_implicit', { accepted: 1, rejected: 5 }).threshold).toBe(Infinity);
  });

  it('relaxes the threshold for sources that are reliably accepted', () => {
    expect(calibrateThreshold('cooccurrence', { accepted: 19, rejected: 1 }).threshold).toBeCloseTo(0.75);
  });

  it('keeps model-found entities review-only until they have earned trust', () => {
    expect(calibrateThreshold('llm_missed', undefined).threshold).toBe(Infinity);
    expect(calibrateThreshold('llm_missed', { accepted: 10, rejected: 0 }).threshold).toBeCloseTo(0.8);
  });

  it('never auto-applies type corrections and only tightens with a configured threshold', () => {
    expect(calibrateThreshold('llm_validation', { accepted: 50, rejected: 0 }).threshold).toBe(Infinity);
    expect(calibrateThreshold('cooccurrence', undefined, 0.95).threshold).toBe(0.95);
    expect(calibrateThreshold('cooccurrence', undefined, 0.5).threshold).toBe(0.85);
  });
});
