import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDataDir } from '$lib/server/dataDir';
import { readFolders, readNotes } from '$lib/server/notesFile';
import { buildGraphSnapshot, selectGraphSubsetForNotes } from '$lib/server/graphSnapshot';
import { resolveOllamaBaseUrl } from '$lib/server/ollamaUrl';
import { generateSkill } from '$lib/skills/skillGenerator';

const SKILLS_FILE = join(getDataDir(), 'skills.json');

function readSkills(): Array<Record<string, unknown>> {
  if (!existsSync(SKILLS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(SKILLS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export const GET: RequestHandler = async () => {
  const allSkills = readSkills();
  return json({ skills: allSkills });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { action, clusterId, noteIds } = body as {
    action: string;
    clusterId?: string;
    noteIds?: string[];
  };

  if (action !== 'generate') {
    throw error(400, `Unknown action: ${action}`);
  }

  if (!noteIds || noteIds.length === 0) {
    throw error(400, 'noteIds are required for skill generation');
  }

  const allNotes = readNotes(locals.user!.id);
  const selectedNotes = allNotes.filter((note) => noteIds.includes(note.id));

  if (selectedNotes.length === 0) {
    throw error(404, 'No matching notes found for the provided noteIds');
  }

  const snapshot = buildGraphSnapshot(allNotes, readFolders(locals.user!.id));
  const subset = selectGraphSubsetForNotes(snapshot, noteIds);

  const cluster = {
    id: clusterId || 'generated',
    name: `Skill from ${selectedNotes.length} notes`,
    entityIds: subset.entities.map((entity) => entity.id),
    noteIds,
    cohesion: 1,
    density: subset.relations.length > 0 ? Math.min(subset.relations.length / Math.max(subset.entities.length, 1), 1) : 0,
    modularity: subset.relations.length > 0 ? 1 : 0,
  };

  const noteContext = selectedNotes.map((note) => ({
    title: note.title,
    content: note.content,
  }));

  let ollamaUrl: string;
  try {
    ollamaUrl = resolveOllamaBaseUrl(body.ollamaUrl);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid Ollama URL');
  }

  const config = {
    ollamaUrl,
    model: body.model || 'llama3.2:3b',
    topK: 5,
  };

  try {
    const skillContent = await generateSkill(
      cluster,
      noteContext,
      subset.entities,
      subset.relations,
      config
    );

    return json({ skill: skillContent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw error(503, `Skill generation failed: ${message}`);
  }
};
