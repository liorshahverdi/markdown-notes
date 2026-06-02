import { writable, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index';
import { graphEntities, graphRelations } from './graph';
import { detectClusters, scoreClusterAsSkillCandidate, type Cluster } from '../skills/clusterDetector';
import type { SkillRecord } from '../skills/skillTemplate';

export const skills = writable<SkillRecord[]>([]);
export const selectedSkillId = writable<string | null>(null);
export const skillCandidates = writable<Array<Cluster & { score: number }>>([]);
export const generatingSkill = writable<boolean>(false);

export async function loadSkills(): Promise<void> {
  const records = await db.skills.toArray();
  const fullSkills: SkillRecord[] = records.map(r => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    type: r.type as SkillRecord['type'],
    content: '',
    sourceNoteIds: r.sourceNoteIds,
    parentSkillIds: r.parentSkillIds,
    dependencies: { requires: [], enhances: [] },
    confidence: 'medium' as const,
    versions: [],
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
  }));
  skills.set(fullSkills);
}

export async function saveSkill(skill: SkillRecord): Promise<void> {
  await db.skills.put({
    id: skill.id,
    name: skill.name,
    domain: skill.domain,
    type: skill.type,
    createdAt: skill.createdAt,
    sourceNoteIds: skill.sourceNoteIds,
    parentSkillIds: skill.parentSkillIds,
  });
  skills.update(current => {
    const idx = current.findIndex(s => s.id === skill.id);
    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = skill;
      return updated;
    }
    return [...current, skill];
  });
}

export async function deleteSkill(id: string): Promise<void> {
  await db.skills.delete(id);
  skills.update(current => current.filter(s => s.id !== id));
  selectedSkillId.update(current => (current === id ? null : current));
}

export async function detectSkillCandidates(): Promise<void> {
  const entities = get(graphEntities);
  const relations = get(graphRelations);
  const clusters = detectClusters(entities, relations);
  const scored = clusters
    .map(c => ({ ...c, score: scoreClusterAsSkillCandidate(c) }))
    .sort((a, b) => b.score - a.score);
  skillCandidates.set(scored);
}
