import { writable, derived, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { FolderRecord, NoteRecord } from '../../types/note';
import { notes, _setSelectedFolderIdStore, _folderFilterTrigger } from './notes';
import { forceReembed } from '../vector/vectorStoreManager';

export interface FolderTreeNode extends FolderRecord {
  children: FolderTreeNode[];
  noteCount: number;
  notes: NoteRecord[];
}

export const folders = writable<FolderRecord[]>([]);
export const selectedFolderId = writable<string | null>(null);
export const expandedFolderIds = writable<Set<string>>(new Set());

export function toggleFolderExpanded(folderId: string): void {
  expandedFolderIds.update((set) => {
    const next = new Set(set);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    return next;
  });
}

export function expandFolder(folderId: string): void {
  expandedFolderIds.update((set) => {
    if (set.has(folderId)) return set;
    const next = new Set(set);
    next.add(folderId);
    return next;
  });
}

// Wire up selectedFolderId to the notes store so filteredNotes can read it
_setSelectedFolderIdStore(selectedFolderId);
// When selectedFolderId changes, bump the trigger so filteredNotes re-derives
selectedFolderId.subscribe(() => {
  _folderFilterTrigger.update((n) => n + 1);
});

/** Build a tree from the flat folder array, with notes attached to each node. */
export const folderTree = derived(
  [folders, notes],
  ([$folders, $notes]) => {
    // Group notes by folder
    const notesMap = new Map<string | null, NoteRecord[]>();
    for (const note of $notes) {
      const fid = note.folderId ?? null;
      if (!notesMap.has(fid)) notesMap.set(fid, []);
      notesMap.get(fid)!.push(note);
    }

    // Sort notes: pinned first, then by date descending
    const sortNotes = (arr: NoteRecord[]) =>
      arr.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.dateModified - a.dateModified;
      });

    const nodeMap = new Map<string, FolderTreeNode>();
    for (const f of $folders) {
      const folderNotes = notesMap.get(f.id) ?? [];
      sortNotes(folderNotes);
      nodeMap.set(f.id, { ...f, children: [], noteCount: folderNotes.length, notes: folderNotes });
    }

    const roots: FolderTreeNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentFolderId && nodeMap.has(node.parentFolderId)) {
        nodeMap.get(node.parentFolderId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort children by sortOrder
    const sortChildren = (nodes: FolderTreeNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      for (const n of nodes) sortChildren(n.children);
    };
    sortChildren(roots);

    return roots;
  }
);

/** Notes not in any folder (shown at root level of the tree). */
export const rootNotes = derived(
  notes,
  ($notes) => {
    const unfiled = $notes.filter((n) => !n.folderId);
    return unfiled.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.dateModified - a.dateModified;
    });
  }
);

/** Get sub-folders of the currently selected folder (direct children only). */
export const currentSubFolders = derived(
  [folders, selectedFolderId],
  ([$folders, $selectedFolderId]) => {
    return $folders
      .filter((f) =>
        $selectedFolderId === null
          ? f.parentFolderId === null
          : f.parentFolderId === $selectedFolderId
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }
);

/** Get full folder path as string, e.g. "Projects / Web / Frontend" */
export function getFolderPath(folderId: string | null): string {
  return getFolderPathArray(folderId).join(' / ');
}

/** Get folder path as array of names, e.g. ["Projects", "Web", "Frontend"] */
export function getFolderPathArray(folderId: string | null): string[] {
  if (!folderId) return [];
  const $folders = get(folders);
  const byId = new Map($folders.map((f) => [f.id, f]));
  const path: string[] = [];
  let current = byId.get(folderId);
  while (current) {
    path.unshift(current.name);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }
  return path;
}

/** Get breadcrumb entries for the currently selected folder (including ancestors). */
export function getBreadcrumbs(folderId: string | null): Array<{ id: string | null; name: string }> {
  const crumbs: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Root' }];
  if (!folderId) return crumbs;

  const $folders = get(folders);
  const byId = new Map($folders.map((f) => [f.id, f]));
  const chain: FolderRecord[] = [];
  let current = byId.get(folderId);
  while (current) {
    chain.unshift(current);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }
  for (const f of chain) {
    crumbs.push({ id: f.id, name: f.name });
  }
  return crumbs;
}

// --- Persistence ---

async function persistFolder(folder: FolderRecord): Promise<void> {
  await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
}

export async function loadFolders(): Promise<void> {
  try {
    const res = await fetch('/api/folders');
    if (!res.ok) return;
    const data = await res.json();
    const loaded: FolderRecord[] = data.folders ?? [];
    folders.set(loaded);
    // Auto-expand all folders so the full tree is visible on load
    expandedFolderIds.set(new Set(loaded.map((f) => f.id)));
  } catch {
    // offline
  }
}

// --- CRUD ---

export async function createFolder(name: string, parentFolderId: string | null = null): Promise<FolderRecord> {
  const $folders = get(folders);
  const siblings = $folders.filter((f) =>
    parentFolderId === null ? f.parentFolderId === null : f.parentFolderId === parentFolderId
  );
  const maxSort = siblings.reduce((max, f) => Math.max(max, f.sortOrder), 0);

  const folder: FolderRecord = {
    id: uuidv4(),
    name,
    parentFolderId,
    dateCreated: Date.now(),
    dateModified: Date.now(),
    sortOrder: maxSort + 1,
  };

  folders.update((f) => [...f, folder]);
  expandFolder(folder.id);
  await persistFolder(folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  let updated: FolderRecord | undefined;
  folders.update((all) =>
    all.map((f) => {
      if (f.id === id) {
        updated = { ...f, name, dateModified: Date.now() };
        return updated;
      }
      return f;
    })
  );
  if (updated) await persistFolder(updated);
}

export async function deleteFolder(id: string): Promise<void> {
  const $folders = get(folders);
  const target = $folders.find((f) => f.id === id);
  if (!target) return;

  const newParent = target.parentFolderId;

  // Re-parent sub-folders locally
  folders.update((all) =>
    all
      .filter((f) => f.id !== id)
      .map((f) => (f.parentFolderId === id ? { ...f, parentFolderId: newParent } : f))
  );

  // Re-parent notes locally
  notes.update((all) =>
    all.map((n) => (n.folderId === id ? { ...n, folderId: newParent } : n))
  );

  // If we were viewing the deleted folder, go to its parent
  if (get(selectedFolderId) === id) {
    selectedFolderId.set(newParent);
  }

  await fetch(`/api/folders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function moveFolder(id: string, newParentId: string | null): Promise<void> {
  // Prevent moving a folder into itself or its descendants
  const $folders = get(folders);
  const descendants = new Set<string>();
  const collectDescendants = (fid: string) => {
    for (const f of $folders) {
      if (f.parentFolderId === fid) {
        descendants.add(f.id);
        collectDescendants(f.id);
      }
    }
  };
  descendants.add(id);
  collectDescendants(id);
  if (newParentId && descendants.has(newParentId)) return;

  let updated: FolderRecord | undefined;
  folders.update((all) =>
    all.map((f) => {
      if (f.id === id) {
        updated = { ...f, parentFolderId: newParentId, dateModified: Date.now() };
        return updated;
      }
      return f;
    })
  );
  if (updated) await persistFolder(updated);
}

export async function moveNoteToFolder(noteId: string, folderId: string | null): Promise<void> {
  let updatedNote: import('../../types/note').NoteRecord | undefined;
  notes.update((all) =>
    all.map((n) => {
      if (n.id === noteId) {
        updatedNote = { ...n, folderId, dateModified: Date.now() };
        return updatedNote;
      }
      return n;
    })
  );
  if (updatedNote) {
    // Force re-embedding so folder context is included in the vector
    forceReembed(noteId);
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: updatedNote }),
    });
    // Re-extract knowledge graph entities with updated folder context
    const { extractAndSaveEntities } = await import('./graph');
    await extractAndSaveEntities(noteId, updatedNote.title, updatedNote.content, folderId);
  }
}

/** Get all folders except a given folder and its descendants (for move picker). */
export function getMovableFolders(excludeId: string): FolderRecord[] {
  const $folders = get(folders);
  const descendants = new Set<string>();
  const collectDescendants = (fid: string) => {
    for (const f of $folders) {
      if (f.parentFolderId === fid) {
        descendants.add(f.id);
        collectDescendants(f.id);
      }
    }
  };
  descendants.add(excludeId);
  collectDescendants(excludeId);
  return $folders.filter((f) => !descendants.has(f.id));
}
