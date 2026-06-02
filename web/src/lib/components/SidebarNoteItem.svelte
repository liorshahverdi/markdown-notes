<script lang="ts">
  import type { NoteRecord } from '../../types/note';
  import { formatRelativeDate, getContentPreview } from './sidebar-helpers';
  import { folders, moveNoteToFolder, getFolderPath } from '$lib/stores/folders';

  interface Props {
    note: NoteRecord;
    selected: boolean;
    shared?: boolean;
    onselect?: () => void;
    ontogglePin?: () => void;
    ondelete?: () => void;
  }

  let { note, selected, shared = false, onselect, ontogglePin, ondelete }: Props = $props();

  let contextMenuOpen = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let showMovePicker = $state(false);
  let movePickerJustOpened = false;

  function handleContextMenu(e: MouseEvent) {
    if (shared) return; // no context menu for shared notes
    e.preventDefault();
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuOpen = true;
  }

  function closeContextMenu() {
    contextMenuOpen = false;
  }

  function handlePinClick() {
    closeContextMenu();
    ontogglePin?.();
  }

  function handleDeleteClick() {
    closeContextMenu();
    ondelete?.();
  }

  function handleMoveToFolder() {
    closeContextMenu();
    showMovePicker = true;
    movePickerJustOpened = true;
    requestAnimationFrame(() => { movePickerJustOpened = false; });
  }

  function handleMoveSelect(folderId: string | null) {
    moveNoteToFolder(note.id, folderId);
    showMovePicker = false;
  }

  function handleWindowClick() {
    if (contextMenuOpen) closeContextMenu();
    if (showMovePicker && !movePickerJustOpened) showMovePicker = false;
  }

  // Drag support
  function handleDragStart(e: DragEvent) {
    if (shared) return;
    e.dataTransfer?.setData('text/note-id', note.id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<button
  type="button"
  class="note-item"
  class:is-selected={selected}
  onclick={onselect}
  oncontextmenu={handleContextMenu}
  draggable={!shared}
  ondragstart={handleDragStart}
  aria-selected={selected}
  role="option"
>
  <span class="note-item__rail" aria-hidden="true"></span>
  <div class="note-item__title-row">
    {#if note.isPinned && !shared}
      <span class="note-item__glyph note-item__glyph--pin" aria-label="Pinned" title="Pinned">▲</span>
    {/if}
    {#if note.isShared && !shared}
      <span class="note-item__glyph note-item__glyph--share" aria-label="Shared" title="Shared">↗</span>
    {/if}
    <span class="note-item__title">{note.title || 'Untitled'}</span>
  </div>
  {#if shared && note.ownerUsername}
    <div class="note-item__author">by {note.ownerUsername}</div>
  {/if}
  <div class="note-item__meta">
    <span class="label-meta">{formatRelativeDate(note.dateModified)}</span>
  </div>
  <div class="note-item__preview">
    {getContentPreview(note.content)}
  </div>
</button>

<style>
  .note-item {
    position: relative;
    display: block;
    width: 100%;
    padding: 9px 10px 9px 14px;
    margin: 1px 0;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease;
  }

  .note-item:hover {
    background: var(--color-surface);
  }

  .note-item.is-selected {
    background: var(--brand-tint);
    border-color: var(--brand-tint-strong);
  }

  .note-item__rail {
    position: absolute;
    left: 4px;
    top: 10px;
    bottom: 10px;
    width: 2px;
    border-radius: 2px;
    background: transparent;
    transition: background-color 120ms ease;
  }

  .note-item.is-selected .note-item__rail {
    background: var(--brand-600);
  }

  :global(.dark) .note-item.is-selected .note-item__rail {
    background: var(--brand-500);
  }

  .note-item__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .note-item__title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--color-text);
    letter-spacing: -0.005em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .note-item__glyph {
    flex-shrink: 0;
    font-size: 10px;
    line-height: 1;
    width: 12px;
    text-align: center;
  }

  .note-item__glyph--pin {
    color: var(--color-pin);
  }

  .note-item__glyph--share {
    color: var(--brand-600);
    font-size: 12px;
  }

  :global(.dark) .note-item__glyph--share {
    color: var(--brand-500);
  }

  .note-item__author {
    margin-top: 2px;
    font-size: 11px;
    color: var(--brand-600);
    font-style: italic;
  }

  :global(.dark) .note-item__author {
    color: var(--brand-500);
  }

  .note-item__meta {
    margin-top: 3px;
  }

  .note-item__meta :global(.label-meta) {
    font-size: 9.5px;
    letter-spacing: 0.1em;
  }

  .note-item__preview {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

{#if contextMenuOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[140px]"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    role="menu"
  >
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      onclick={handlePinClick}
      role="menuitem"
    >
      {note.isPinned ? 'Unpin' : 'Pin'}
    </button>
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      onclick={handleMoveToFolder}
      role="menuitem"
    >
      Move to folder...
    </button>
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      onclick={handleDeleteClick}
      role="menuitem"
    >
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
    <div class="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Move to folder</div>
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      onclick={() => handleMoveSelect(null)}
    >
      Root
    </button>
    {#each $folders as folder (folder.id)}
      <button
        type="button"
        class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer truncate"
        onclick={() => handleMoveSelect(folder.id)}
      >
        {getFolderPath(folder.id) || folder.name}
      </button>
    {/each}
  </div>
{/if}
