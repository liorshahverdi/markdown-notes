<script lang="ts">
  import type { FolderTreeNode } from '$lib/stores/folders';
  import { selectedFolderId, expandedFolderIds, toggleFolderExpanded, expandFolder, renameFolder, deleteFolder, createFolder, moveFolder, getMovableFolders, moveNoteToFolder, getFolderPath } from '$lib/stores/folders';
  import { selectedNoteId, deleteNote, togglePin } from '$lib/stores/notes';
  import SidebarNoteItem from './SidebarNoteItem.svelte';
  import ConfirmModal from './ConfirmModal.svelte';

  interface Props {
    folder: FolderTreeNode;
    depth?: number;
  }

  let { folder, depth = 0 }: Props = $props();

  let contextMenuOpen = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let isRenaming = $state(false);
  let renameValue = $state('');
  let showMovePicker = $state(false);
  let movePickerJustOpened = false;
  let isDragOver = $state(false);

  // Confirm delete modal state
  let confirmDeleteOpen = $state(false);
  let confirmDeleteNoteId = $state<string | null>(null);
  let confirmDeleteMessage = $state('');

  let hasExpandableContent = $derived(folder.children.length > 0 || folder.notes.length > 0);
  let isExpanded = $derived($expandedFolderIds.has(folder.id));
  let isSelected = $derived($selectedFolderId === folder.id);

  function handleClick() {
    selectedFolderId.set(folder.id);
    // Auto-expand if has expandable content and collapsed
    if (hasExpandableContent && !isExpanded) {
      expandFolder(folder.id);
    }
  }

  function handleChevronClick(e: MouseEvent) {
    e.stopPropagation();
    toggleFolderExpanded(folder.id);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuOpen = true;
  }

  function closeContextMenu() {
    contextMenuOpen = false;
  }

  function handleRename() {
    closeContextMenu();
    renameValue = folder.name;
    isRenaming = true;
  }

  function confirmRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      renameFolder(folder.id, trimmed);
    }
    isRenaming = false;
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmRename();
    } else if (e.key === 'Escape') {
      isRenaming = false;
    }
  }

  function handleNewSubfolder() {
    closeContextMenu();
    createFolder('New Folder', folder.id);
    expandFolder(folder.id);
  }

  function handleDelete() {
    closeContextMenu();
    confirmDeleteMessage = `Delete folder "${folder.name}"? Contents will be moved to the parent folder.`;
    confirmDeleteNoteId = null;
    confirmDeleteOpen = true;
  }

  function confirmFolderDelete() {
    if (confirmDeleteNoteId) {
      deleteNote(confirmDeleteNoteId);
    } else {
      deleteFolder(folder.id);
    }
    confirmDeleteOpen = false;
    confirmDeleteNoteId = null;
  }

  function showNoteDeleteConfirm(noteId: string, noteTitle: string) {
    confirmDeleteMessage = `Are you sure you want to delete "${noteTitle}"?`;
    confirmDeleteNoteId = noteId;
    confirmDeleteOpen = true;
  }

  function handleMoveTo() {
    closeContextMenu();
    showMovePicker = true;
    movePickerJustOpened = true;
    requestAnimationFrame(() => { movePickerJustOpened = false; });
  }

  function handleMoveSelect(targetId: string | null) {
    moveFolder(folder.id, targetId);
    showMovePicker = false;
  }

  function handleWindowClick() {
    if (contextMenuOpen) closeContextMenu();
    if (showMovePicker && !movePickerJustOpened) showMovePicker = false;
  }

  function handleDblClick() {
    renameValue = folder.name;
    isRenaming = true;
  }

  // Drag and drop: accept notes
  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('text/note-id')) {
      e.preventDefault();
      e.stopPropagation();
      isDragOver = true;
    }
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    isDragOver = false;
    const noteId = e.dataTransfer?.getData('text/note-id');
    if (noteId) {
      e.preventDefault();
      e.stopPropagation();
      moveNoteToFolder(noteId, folder.id);
    }
  }

  let movableFolders = $derived(showMovePicker ? getMovableFolders(folder.id) : []);
</script>

<svelte:window onclick={handleWindowClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="folder-item"
  class:is-selected={isSelected}
  class:is-drag-over={isDragOver}
  style="padding-left: {6 + depth * 14}px;"
  onclick={handleClick}
  ondblclick={handleDblClick}
  oncontextmenu={handleContextMenu}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="button"
  tabindex="0"
>
  {#if hasExpandableContent}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="folder-item__chevron"
      class:is-open={isExpanded}
      onclick={handleChevronClick}
      role="button"
      tabindex="-1"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </span>
  {:else}
    <span class="folder-item__chevron"></span>
  {/if}

  <svg class="folder-item__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>

  {#if isRenaming}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="text"
      class="folder-item__rename"
      bind:value={renameValue}
      onblur={confirmRename}
      onkeydown={handleRenameKeydown}
      onclick={(e) => e.stopPropagation()}
      autofocus
    />
  {:else}
    <span class="folder-item__name">{folder.name}</span>
  {/if}

  {#if folder.noteCount > 0}
    <span class="folder-item__count">{folder.noteCount}</span>
  {/if}
</div>

<style>
  .folder-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 5px 6px;
    margin: 1px 0;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 120ms ease, border-color 120ms ease;
  }

  .folder-item:hover {
    background: var(--color-surface);
  }

  .folder-item.is-selected {
    background: var(--brand-tint);
    border-color: var(--brand-tint-strong);
  }

  .folder-item.is-drag-over {
    background: var(--brand-tint);
    border-color: var(--brand-500);
    border-style: dashed;
  }

  .folder-item__chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    transition: transform 120ms ease, color 120ms ease;
  }

  .folder-item__chevron > svg {
    width: 11px;
    height: 11px;
    transition: transform 120ms ease;
  }

  .folder-item__chevron.is-open > svg {
    transform: rotate(90deg);
  }

  .folder-item__chevron:hover {
    color: var(--color-text-secondary);
  }

  .folder-item__icon {
    width: 15px;
    height: 15px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .folder-item.is-selected .folder-item__icon {
    color: var(--brand-600);
  }

  :global(.dark) .folder-item.is-selected .folder-item__icon {
    color: var(--brand-500);
  }

  .folder-item__name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-item__count {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .folder-item__rename {
    flex: 1;
    font-size: 13px;
    padding: 1px 4px;
    background: var(--color-surface-raised);
    color: var(--color-text);
    border: 1px solid var(--brand-500);
    border-radius: 4px;
    outline: none;
  }
</style>

<!-- Expanded content: subfolders then notes -->
{#if hasExpandableContent && isExpanded}
  {#each folder.children as child (child.id)}
    <svelte:self folder={child} depth={depth + 1} />
  {/each}
  {#each folder.notes as note (note.id)}
    <div style="padding-left: {8 + (depth + 1) * 16}px;">
      <SidebarNoteItem
        {note}
        selected={$selectedNoteId === note.id}
        onselect={() => selectedNoteId.set(note.id)}
        ontogglePin={() => togglePin(note.id)}
        ondelete={() => showNoteDeleteConfirm(note.id, note.title)}
      />
    </div>
  {/each}
{/if}

<!-- Context menu -->
{#if contextMenuOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[160px]"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    role="menu"
  >
    <button type="button" class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick={handleRename} role="menuitem">
      Rename
    </button>
    <button type="button" class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick={handleNewSubfolder} role="menuitem">
      New Subfolder
    </button>
    <button type="button" class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick={handleMoveTo} role="menuitem">
      Move to...
    </button>
    <button type="button" class="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick={handleDelete} role="menuitem">
      Delete
    </button>
  </div>
{/if}

<!-- Move picker overlay -->
{#if showMovePicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[200px] max-h-60 overflow-y-auto"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Move to</div>
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      onclick={() => handleMoveSelect(null)}
    >
      Root
    </button>
    {#each movableFolders as target (target.id)}
      <button
        type="button"
        class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer truncate"
        onclick={() => handleMoveSelect(target.id)}
      >
        {getFolderPath(target.id) || target.name}
      </button>
    {/each}
  </div>
{/if}

<ConfirmModal
  open={confirmDeleteOpen}
  title={confirmDeleteNoteId ? 'Delete Note' : 'Delete Folder'}
  message={confirmDeleteMessage}
  onConfirm={confirmFolderDelete}
  onCancel={() => { confirmDeleteOpen = false; confirmDeleteNoteId = null; }}
/>
