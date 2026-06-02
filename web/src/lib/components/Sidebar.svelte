<script lang="ts">
  import { searchText, filteredNotes, filteredSharedNotes, selectedNoteId, createNote, deleteNote, togglePin, viewingShared, loadSharedNotes, notes } from '$lib/stores/notes';
  import { selectedFolderId, folderTree, rootNotes, expandFolder, createFolder, moveNoteToFolder } from '$lib/stores/folders';
  import SidebarNoteItem from './SidebarNoteItem.svelte';
  import SidebarFolderItem from './SidebarFolderItem.svelte';
  import ConfirmModal from './ConfirmModal.svelte';

  // Confirm modal state
  let confirmOpen = $state(false);
  let confirmMessage = $state('');
  let confirmNoteId = $state<string | null>(null);
  let deletedNote: { id: string; title: string; content: string; dateModified: number; isPinned: boolean; folderId?: string | null } | null = null;

  function handleCreateNote() {
    createNote();
  }

  function handleCreateFolder() {
    createFolder('New Folder', $selectedFolderId);
    if ($selectedFolderId) {
      expandFolder($selectedFolderId);
    }
  }

  function handleDeleteSelected() {
    if ($selectedNoteId) {
      const note = $filteredNotes.find((n) => n.id === $selectedNoteId);
      confirmMessage = `Are you sure you want to delete "${note?.title ?? 'this note'}"?`;
      confirmNoteId = $selectedNoteId;
      confirmOpen = true;
    }
  }

  function handleSelectNote(id: string) {
    $selectedNoteId = id;
  }

  function handleTogglePin(id: string) {
    togglePin(id);
  }

  function handleDeleteNote(id: string) {
    const note = $notes.find((n) => n.id === id);
    confirmMessage = `Are you sure you want to delete "${note?.title ?? 'this note'}"?`;
    confirmNoteId = id;
    confirmOpen = true;
  }

  function confirmDelete() {
    if (!confirmNoteId) return;
    // Save for undo
    const note = $notes.find((n) => n.id === confirmNoteId);
    if (note) {
      deletedNote = { id: note.id, title: note.title, content: note.content, dateModified: note.dateModified, isPinned: note.isPinned, folderId: note.folderId };
    }
    deleteNote(confirmNoteId);
    confirmOpen = false;
    confirmNoteId = null;
  }

  async function undoDelete() {
    if (!deletedNote) return;
    const { saveNote } = await import('$lib/stores/notes');
    const restored = { ...deletedNote, dateModified: Date.now() } as any;
    notes.update((n) => [...n, restored]);
    await saveNote(restored);
    deletedNote = null;
  }

  function cancelDelete() {
    confirmOpen = false;
    confirmNoteId = null;
  }

  function switchTab(shared: boolean) {
    viewingShared.set(shared);
    selectedNoteId.set(null);
    if (shared) {
      loadSharedNotes();
    }
  }

  // Drop zone: move notes/folders to current level
  let isDragOverBg = $state(false);

  function handleBgDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('text/note-id')) {
      e.preventDefault();
      isDragOverBg = true;
    }
  }

  function handleBgDragLeave() {
    isDragOverBg = false;
  }

  function handleBgDrop(e: DragEvent) {
    isDragOverBg = false;
    const noteId = e.dataTransfer?.getData('text/note-id');
    if (noteId) {
      e.preventDefault();
      moveNoteToFolder(noteId, null);
    }
  }
</script>

<aside class="sidebar">
  <!-- Tab toggle -->
  <div class="sidebar-tabs">
    <button
      type="button"
      class="sidebar-tab"
      class:is-active={!$viewingShared}
      onclick={() => switchTab(false)}
    >
      Library
    </button>
    <button
      type="button"
      class="sidebar-tab"
      class:is-active={$viewingShared}
      onclick={() => switchTab(true)}
    >
      Shared
    </button>
  </div>

  <!-- Header with action buttons (only for My Notes) -->
  {#if !$viewingShared}
    <div class="sidebar-header">
      <span class="label-meta">Workspace</span>
      <div class="sidebar-actions">
        <button
          type="button"
          class="icon-btn"
          onclick={handleCreateFolder}
          title="New folder"
          aria-label="New folder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          onclick={handleCreateNote}
          title="New note"
          aria-label="New note"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          onclick={handleDeleteSelected}
          disabled={!$selectedNoteId}
          title="Delete note"
          aria-label="Delete note"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  {/if}

  <!-- Search input -->
  <div class="sidebar-search">
    <svg xmlns="http://www.w3.org/2000/svg" class="sidebar-search__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path stroke-linecap="round" d="M21 21l-4.35-4.35" />
    </svg>
    <input
      type="text"
      placeholder="Search library"
      class="sidebar-search__input"
      bind:value={$searchText}
    />
    {#if $searchText}
      <button
        type="button"
        class="sidebar-search__clear"
        onclick={() => ($searchText = '')}
        aria-label="Clear search"
      >×</button>
    {/if}
  </div>

  <!-- Notes list -->
  <div
    class="sidebar-list"
    class:is-drag-over={isDragOverBg}
    role="listbox"
    aria-label="Notes list"
    ondragover={handleBgDragOver}
    ondragleave={handleBgDragLeave}
    ondrop={handleBgDrop}
  >
    {#if $viewingShared}
      {#each $filteredSharedNotes as note (note.id)}
        <SidebarNoteItem
          {note}
          selected={$selectedNoteId === note.id}
          onselect={() => handleSelectNote(note.id)}
          shared
        />
      {/each}
      {#if $filteredSharedNotes.length === 0}
        <p class="sidebar-empty">
          {$searchText ? 'No matching shared notes' : 'Nothing shared with you'}
        </p>
      {/if}
    {:else}
      {#if $searchText.trim()}
        <div class="sidebar-section-label">
          <span class="label-meta">Results · {$filteredNotes.length}</span>
        </div>
        {#each $filteredNotes as note (note.id)}
          <SidebarNoteItem
            {note}
            selected={$selectedNoteId === note.id}
            onselect={() => handleSelectNote(note.id)}
            ontogglePin={() => handleTogglePin(note.id)}
            ondelete={() => handleDeleteNote(note.id)}
          />
        {/each}
        {#if $filteredNotes.length === 0}
          <p class="sidebar-empty">No matches</p>
        {/if}
      {:else}
        {#each $folderTree as node (node.id)}
          <SidebarFolderItem folder={node} depth={0} />
        {/each}

        {#each $rootNotes as note (note.id)}
          <SidebarNoteItem
            {note}
            selected={$selectedNoteId === note.id}
            onselect={() => handleSelectNote(note.id)}
            ontogglePin={() => handleTogglePin(note.id)}
            ondelete={() => handleDeleteNote(note.id)}
          />
        {/each}

        {#if $folderTree.length === 0 && $rootNotes.length === 0}
          <p class="sidebar-empty">Your library is empty.<br/><span class="label-meta">Press the + above to begin</span></p>
        {/if}
      {/if}
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--color-bg-grain);
    border-right: 1px solid var(--color-border-subtle);
  }

  :global(.dark) .sidebar { background: var(--color-surface-sunken); }

  .sidebar-tabs {
    display: flex;
    padding: 6px 8px 0;
    gap: 4px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .sidebar-tab {
    flex: 1;
    position: relative;
    padding: 8px 0 9px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .sidebar-tab:hover {
    color: var(--color-text-secondary);
  }

  .sidebar-tab.is-active {
    color: var(--color-text);
  }

  .sidebar-tab.is-active::after {
    content: '';
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: -1px;
    height: 2px;
    background: var(--brand-600);
    border-radius: 2px 2px 0 0;
  }

  :global(.dark) .sidebar-tab.is-active::after {
    background: var(--brand-500);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
  }

  .sidebar-actions {
    display: flex;
    gap: 2px;
  }

  .sidebar-actions :global(.icon-btn) {
    width: 26px;
    height: 26px;
  }

  .sidebar-actions :global(.icon-btn:disabled) {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sidebar-search {
    position: relative;
    margin: 4px 12px 8px;
  }

  .sidebar-search__icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--color-text-tertiary);
    pointer-events: none;
  }

  .sidebar-search__input {
    width: 100%;
    padding: 7px 28px 7px 30px;
    font-size: 13px;
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border-subtle);
    border-radius: 7px;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  :global(.dark) .sidebar-search__input {
    background: var(--color-surface);
  }

  .sidebar-search__input:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-tint);
  }

  .sidebar-search__input::placeholder {
    color: var(--color-text-tertiary);
  }

  .sidebar-search__clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    line-height: 18px;
    border-radius: 999px;
    border: 0;
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;
  }

  .sidebar-search__clear:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 24px;
    transition: background-color 120ms ease;
  }

  .sidebar-list.is-drag-over {
    background: var(--brand-tint);
  }

  .sidebar-section-label {
    padding: 6px 8px 4px;
  }

  .sidebar-empty {
    padding: 32px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--color-text-tertiary);
    line-height: 1.6;
  }
</style>

<ConfirmModal
  open={confirmOpen}
  title="Delete Note"
  message={confirmMessage}
  onConfirm={confirmDelete}
  onCancel={cancelDelete}
  onUndo={undoDelete}
/>
