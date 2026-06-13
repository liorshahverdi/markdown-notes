import { writable, derived, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { NoteRecord } from '../../types/note';

// Import selectedFolderId lazily to avoid circular dependency
// (folders.ts imports notes store; we import folders store here)
let _selectedFolderId: typeof import('./folders').selectedFolderId | null = null;
function getSelectedFolderId(): string | null {
  if (!_selectedFolderId) {
    try {
      // Dynamic require won't work in ESM, so we use a lazy getter set from folders store
      return null;
    } catch {
      return null;
    }
  }
  return get(_selectedFolderId);
}

/** Called by folders store to wire up the dependency without circular imports. */
export function _setSelectedFolderIdStore(store: typeof import('./folders').selectedFolderId): void {
  _selectedFolderId = store;
}

export const notes = writable<NoteRecord[]>([]);
export const selectedNoteId = writable<string | null>(null);
export const searchText = writable<string>('');
export const sharedNotes = writable<NoteRecord[]>([]);
export const viewingShared = writable<boolean>(false);
export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';
export type SaveIssue =
  | { kind: 'error'; noteId: string; message: string; timestamp: number }
  | { kind: 'conflict'; noteId: string; message: string; timestamp: number; serverNote: NoteRecord };

export const saveStatus = writable<SaveStatus>('saved');
export const saveIssue = writable<SaveIssue | null>(null);

class SaveConflictError extends Error {
  constructor(
    public readonly noteId: string,
    public readonly serverNote: NoteRecord
  ) {
    super(`Save conflict for note ${noteId}: newer version exists`);
  }
}

// Re-export a writable that folders store can subscribe to for triggering re-derivation
export const _folderFilterTrigger = writable(0);

export const filteredNotes = derived(
  [notes, searchText, _folderFilterTrigger],
  ([$notes, $searchText]) => {
    let filtered = $notes;

    // When searching, search globally; otherwise filter to selected folder
    if ($searchText.trim() !== '') {
      const query = $searchText.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query)
      );
    } else {
      const folderId = getSelectedFolderId();
      filtered = filtered.filter((n) => {
        const noteFolderId = n.folderId ?? null;
        return noteFolderId === folderId;
      });
    }

    const pinned = filtered
      .filter((n) => n.isPinned)
      .sort((a, b) => b.dateModified - a.dateModified);

    const unpinned = filtered
      .filter((n) => !n.isPinned)
      .sort((a, b) => b.dateModified - a.dateModified);

    return [...pinned, ...unpinned];
  }
);

export const filteredSharedNotes = derived(
  [sharedNotes, searchText],
  ([$sharedNotes, $searchText]) => {
    if ($searchText.trim() === '') return $sharedNotes;
    const query = $searchText.toLowerCase();
    return $sharedNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  }
);

export const selectedNote = derived(
  [notes, sharedNotes, selectedNoteId],
  ([$notes, $sharedNotes, $selectedNoteId]) => {
    if ($selectedNoteId == null) return null;
    return (
      $notes.find((n) => n.id === $selectedNoteId) ??
      $sharedNotes.find((n) => n.id === $selectedNoteId) ??
      null
    );
  }
);

function generateUniqueTitle(existingNotes: NoteRecord[]): string {
  const base = 'Untitled';
  const existingTitles = new Set(existingNotes.map((n) => n.title));
  if (!existingTitles.has(base)) return base;
  let counter = 2;
  while (existingTitles.has(`${base} ${counter}`)) {
    counter++;
  }
  return `${base} ${counter}`;
}

// Debounce timers for auto-save
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Notes with local edits that are not yet confirmed by the server. Keep these
// protected from background sync so a stale server response cannot overwrite
// recently typed content if a save is slow or fails.
const dirtyNoteIds = new Set<string>();
const savingNoteIds = new Set<string>();

async function persistNote(note: NoteRecord): Promise<NoteRecord | null> {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, expectedVersion: note.version }),
  });

  if (!res.ok) {
    if (res.status === 409) {
      const payload = await res.json().catch(() => null);
      throw new SaveConflictError(note.id, payload?.serverNote ?? note);
    }
    throw new Error(`Failed to save note ${note.id}: ${res.status}`);
  }

  const payload = await res.json().catch(() => null);
  return payload?.note ?? null;
}

function sendNoteBeacon(note: NoteRecord): boolean {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  const payload = new Blob([JSON.stringify({ note })], { type: 'application/json' });
  return navigator.sendBeacon('/api/notes', payload);
}

async function flushNote(id: string): Promise<void> {
  const existing = debounceTimers.get(id);
  if (existing) {
    clearTimeout(existing);
    debounceTimers.delete(id);
  }

  const snapshot = get(notes).find((n) => n.id === id);
  if (!snapshot) {
    dirtyNoteIds.delete(id);
    return;
  }

  savingNoteIds.add(id);
  saveStatus.set('saving');
  try {
    const savedNote = await persistNote(snapshot);
    const latest = get(notes).find((n) => n.id === id);
    if (!latest) {
      dirtyNoteIds.delete(id);
    } else if (latest.dateModified === snapshot.dateModified && latest.content === snapshot.content) {
      if (savedNote?.version !== undefined) {
        notes.update((all) => all.map((n) => (n.id === id ? { ...n, version: savedNote.version } : n)));
      }
      dirtyNoteIds.delete(id);
      saveIssue.set(null);
    } else {
      scheduleAutosave(id);
    }
    saveStatus.set(dirtyNoteIds.size === 0 ? 'saved' : 'saving');
  } catch (err) {
    if (err instanceof SaveConflictError) {
      saveStatus.set('conflict');
      saveIssue.set({
        kind: 'conflict',
        noteId: id,
        message: 'This note changed elsewhere. Your local edits are preserved; review or retry saving.',
        timestamp: Date.now(),
        serverNote: err.serverNote,
      });
      console.warn(`Auto-save conflict for note "${snapshot.title}"; local edits preserved.`, err);
    } else {
      saveStatus.set('error');
      saveIssue.set({
        kind: 'error',
        noteId: id,
        message: err instanceof Error ? err.message : `Failed to save note ${id}`,
        timestamp: Date.now(),
      });
      console.warn(`Auto-save failed for note "${snapshot.title}"; will retry.`, err);
      scheduleAutosave(id, 3000);
    }
  } finally {
    savingNoteIds.delete(id);
  }
}

function scheduleAutosave(id: string, delay = 1000): void {
  const existing = debounceTimers.get(id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    flushNote(id);
  }, delay);

  debounceTimers.set(id, timer);
}

export async function createNote(folderId?: string | null): Promise<void> {
  const currentNotes = get(notes);
  const title = generateUniqueTitle(currentNotes);
  const note: NoteRecord = {
    id: uuidv4(),
    title,
    content: `# ${title}\n\n`,
    dateModified: Date.now(),
    isPinned: false,
    isShared: false,
    folderId: folderId ?? getSelectedFolderId() ?? null,
  };

  notes.update((n) => [...n, note]);
  selectedNoteId.set(note.id);
  viewingShared.set(false);
  await persistNote(note);
}

export async function deleteNote(id: string): Promise<void> {
  await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

  const currentSelectedId = get(selectedNoteId);

  notes.update((n) => {
    const updated = n.filter((note) => note.id !== id);

    if (currentSelectedId === id) {
      if (updated.length > 0) {
        const $searchText = get(searchText);
        let filtered = updated;
        if ($searchText.trim() !== '') {
          const query = $searchText.toLowerCase();
          filtered = filtered.filter(
            (note) =>
              note.title.toLowerCase().includes(query) ||
              note.content.toLowerCase().includes(query)
          );
        }
        const pinned = filtered.filter((note) => note.isPinned).sort((a, b) => b.dateModified - a.dateModified);
        const unpinned = filtered.filter((note) => !note.isPinned).sort((a, b) => b.dateModified - a.dateModified);
        const sorted = [...pinned, ...unpinned];
        selectedNoteId.set(sorted.length > 0 ? sorted[0].id : null);
      } else {
        selectedNoteId.set(null);
      }
    }

    return updated;
  });
}

function extractTitleFromContent(content: string): string | null {
  const match = content.match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function updateNoteContent(id: string, content: string): void {
  const now = Date.now();
  const derivedTitle = extractTitleFromContent(content);

  dirtyNoteIds.add(id);
  saveStatus.set('saving');
  notes.update((n) =>
    n.map((note) =>
      note.id === id
        ? { ...note, content, dateModified: now, ...(derivedTitle ? { title: derivedTitle } : {}) }
        : note
    )
  );

  scheduleAutosave(id);
}

export async function togglePin(id: string): Promise<void> {
  notes.update((n) =>
    n.map((note) =>
      note.id === id ? { ...note, isPinned: !note.isPinned } : note
    )
  );
  const updatedNote = get(notes).find((n) => n.id === id);
  if (updatedNote) {
    await persistNote(updatedNote);
  }
}

export async function toggleShare(id: string): Promise<void> {
  notes.update((n) =>
    n.map((note) =>
      note.id === id ? { ...note, isShared: !note.isShared } : note
    )
  );
  const updatedNote = get(notes).find((n) => n.id === id);
  if (updatedNote) {
    await persistNote(updatedNote);
  }
}

export async function loadNotes(): Promise<void> {
  try {
    const res = await fetch('/api/notes');
    if (!res.ok) return;
    const data = await res.json();
    notes.set(data.notes ?? []);
  } catch {
    // offline or error — keep empty
  }
}

export async function loadSharedNotes(): Promise<void> {
  try {
    const res = await fetch('/api/notes/shared');
    if (!res.ok) return;
    const data = await res.json();
    sharedNotes.set(data.notes ?? []);
  } catch {
    // ignore
  }
}

export async function saveNote(note: NoteRecord): Promise<void> {
  await persistNote(note);
}

/** Flush pending auto-saves immediately. Useful before navigating away. */
export async function flushPendingSaves(): Promise<void> {
  await Promise.all(Array.from(dirtyNoteIds).map((id) => flushNote(id)));
}

/** Retry every locally dirty note now. Keeps local edits as the source of the retry. */
export async function retryPendingSaves(): Promise<void> {
  saveIssue.set(null);
  saveStatus.set(dirtyNoteIds.size > 0 ? 'saving' : 'saved');
  await flushPendingSaves();
}

/** Best-effort synchronous-ish flush for pagehide/beforeunload. */
function flushPendingSavesBeacon(): void {
  for (const id of dirtyNoteIds) {
    const note = get(notes).find((n) => n.id === id);
    if (note && sendNoteBeacon(note)) {
      const timer = debounceTimers.get(id);
      if (timer) clearTimeout(timer);
      debounceTimers.delete(id);
    }
  }
}

/** Import notes from a bulk array (used for IndexedDB migration). */
export async function importNotes(notesToImport: NoteRecord[]): Promise<void> {
  await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notesToImport }),
  });
  await loadNotes();
}

/** Check if a note has a pending debounce (user is actively editing it). */
export function hasPendingEdit(id: string): boolean {
  return debounceTimers.has(id) || dirtyNoteIds.has(id) || savingNoteIds.has(id);
}

// --- Adaptive sync ---
const ACTIVE_INTERVAL = 3000;   // editing in progress
const IDLE_INTERVAL = 15000;    // visible but idle
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncRunning = false;
let lastETag: string | null = null;

function hasAnyPendingEdit(): boolean {
  return debounceTimers.size > 0 || dirtyNoteIds.size > 0 || savingNoteIds.size > 0;
}

async function syncFromServer(): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (lastETag) headers['If-None-Match'] = lastETag;

    const res = await fetch('/api/notes', { headers });
    if (res.status === 304) return; // not modified
    if (!res.ok) return;

    const etag = res.headers.get('ETag');
    if (etag) lastETag = etag;

    const data = await res.json();
    const serverNotes: NoteRecord[] = data.notes ?? [];

    notes.update((local) => {
      const serverMap = new Map(serverNotes.map((n) => [n.id, n]));
      const localMap = new Map(local.map((n) => [n.id, n]));

      const merged: NoteRecord[] = [];
      for (const localNote of local) {
        const serverVersion = serverMap.get(localNote.id);
        if (!serverVersion) {
          if (hasPendingEdit(localNote.id)) {
            merged.push(localNote);
          }
          continue;
        }
        if (hasPendingEdit(localNote.id)) {
          merged.push(localNote);
        } else {
          merged.push(serverVersion);
        }
      }

      for (const serverNote of serverNotes) {
        if (!localMap.has(serverNote.id)) {
          merged.push(serverNote);
        }
      }

      return merged;
    });
  } catch {
    // offline or error — skip this cycle
  }
}

function scheduleNextSync(): void {
  if (!syncRunning) return;
  if (typeof document !== 'undefined' && document.hidden) return; // paused while hidden

  const interval = hasAnyPendingEdit() ? ACTIVE_INTERVAL : IDLE_INTERVAL;
  syncTimer = setTimeout(async () => {
    await syncFromServer();
    scheduleNextSync();
  }, interval);
}

function handleVisibilityChange(): void {
  if (!syncRunning) return;
  if (document.hidden) {
    // Flush edits before the page is backgrounded, then pause polling.
    flushPendingSaves();
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  } else {
    // Resume: immediate sync then schedule
    syncFromServer().then(() => scheduleNextSync());
  }
}

function handlePageHide(): void {
  flushPendingSavesBeacon();
}

function handleOnline(): void {
  if (!syncRunning) return;
  syncFromServer().then(() => scheduleNextSync());
}

function handleOffline(): void {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
}

export function startSync(): void {
  stopSync();
  syncRunning = true;
  scheduleNextSync();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }
}

export function stopSync(): void {
  syncRunning = false;
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handlePageHide);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }
}

// Backwards-compatible aliases
export const startPolling = startSync;
export const stopPolling = stopSync;

/** Clear all pending debounce timers. Useful for testing. */
export function clearPendingTimers(): void {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  dirtyNoteIds.clear();
  savingNoteIds.clear();
  saveStatus.set('saved');
  saveIssue.set(null);
}
