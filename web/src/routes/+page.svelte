<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		loadNotes,
		startSync,
		stopSync,
		selectedNote,
		selectedNoteId,
		updateNoteContent,
		toggleShare,
		viewingShared,
		sharedNotes,
		notes,
		importNotes,
	} from '$lib/stores/notes';
	import { loadFolders } from '$lib/stores/folders';
	import { initVectorStore } from '$lib/vector/vectorStoreManager';
	import { dictationActive } from '$lib/stores/dictation';
	import { createDictationManager, type DictationManager } from '$lib/voice/dictationManager';
	import { db } from '$lib/db/index';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Preview from '$lib/components/Preview.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SourcesPane from '$lib/components/SourcesPane.svelte';
	import IngestReviewPanel from '$lib/components/IngestReviewPanel.svelte';
	import WikiIndexView from '$lib/components/WikiIndexView.svelte';
	import WikiLogView from '$lib/components/WikiLogView.svelte';
	import LintFindingsPanel from '$lib/components/LintFindingsPanel.svelte';
	import LegacyMigrationPanel from '$lib/components/LegacyMigrationPanel.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import { chatOpen } from '$lib/stores/chat';

	// Dictation state
	let isDictating = $state(false);
	let dictationManager: DictationManager | null = null;
	let insertAtCursor: ((text: string) => void) | null = null;
	let setGhostText: ((text: string) => void) | null = null;
	let clearGhostText: (() => void) | null = null;

	// Is the current note read-only (shared from another user)?
	let isReadOnly = $derived(
		$viewingShared && $selectedNote != null && $sharedNotes.some((n) => n.id === $selectedNote!.id)
	);

	onMount(async () => {
		await Promise.all([loadNotes(), loadFolders()]);

		// One-time migration: if server has no notes but IndexedDB does, offer import
		try {
			const serverNotes = $notes;
			if (serverNotes.length === 0) {
				const localNotes = await db.notes.toArray();
				if (localNotes.length > 0) {
					const doImport = confirm(
						`Found ${localNotes.length} note(s) in browser storage. Import them to your account?`
					);
					if (doImport) {
						await importNotes(localNotes);
					}
				}
			}
		} catch {
			// IndexedDB not available or migration already done
		}

		startSync();
		initVectorStore();

		dictationManager = createDictationManager({
			onInterim(text) {
				setGhostText?.(text);
			},
			onFinal(text) {
				clearGhostText?.();
				insertAtCursor?.(text + ' ');
			},
			onError() {
				stopDictation();
			},
			onActiveChange(active) {
				isDictating = active;
				dictationActive.set(active);
			},
		});

		window.addEventListener('keydown', handleDictationShortcut);
	});

	onDestroy(() => {
		stopSync();
		stopDictation();
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleDictationShortcut);
		}
	});

	function handleDictationShortcut(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
			e.preventDefault();
			handleDictateToggle();
		}
	}

	function handleDictateToggle() {
		if (!dictationManager || isReadOnly) return;
		if (isDictating) {
			stopDictation();
		} else {
			dictationManager.start();
		}
	}

	function stopDictation() {
		clearGhostText?.();
		dictationManager?.stop();
	}

	function handleRegisterInsert(
		insert: (text: string) => void,
		setGhost: (text: string) => void,
		clearGhost: () => void
	) {
		insertAtCursor = insert;
		setGhostText = setGhost;
		clearGhostText = clearGhost;
	}

	// Stop dictation on note switch
	let prevNoteId: string | null = null;
	$effect(() => {
		const currentId = $selectedNoteId;
		if (prevNoteId !== null && prevNoteId !== currentId && isDictating) {
			stopDictation();
		}
		prevNoteId = currentId;
	});

	function handleEditorChange(content: string) {
		if ($selectedNoteId && !isReadOnly) updateNoteContent($selectedNoteId, content);
	}

	function handleToolbarUpdate(content: string) {
		if ($selectedNoteId && !isReadOnly) updateNoteContent($selectedNoteId, content);
	}

	function handleToggleShare() {
		if ($selectedNoteId && !isReadOnly) {
			toggleShare($selectedNoteId);
		}
	}

	// Resizable panes
	let sidebarWidth = $state(250);
	let editorFraction = $state(0.5);
	let isDragging = $state<'sidebar' | 'editor' | null>(null);
	let containerEl: HTMLDivElement;

	// Mobile responsive state
	let isMobile = $state(false);
	let sidebarOpen = $state(false);

	function checkMobile() {
		isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
		if (!isMobile) sidebarOpen = false;
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		checkMobile();
		const handler = () => checkMobile();
		window.addEventListener('resize', handler);
		return () => window.removeEventListener('resize', handler);
	});

	// Close sidebar when selecting a note on mobile
	$effect(() => {
		if (isMobile && $selectedNoteId) {
			sidebarOpen = false;
		}
	});

	function onMouseDown(pane: 'sidebar' | 'editor') {
		isDragging = pane;
	}

	function onMouseMove(e: MouseEvent) {
		if (!isDragging || !containerEl) return;
		e.preventDefault();

		const containerRect = containerEl.getBoundingClientRect();

		if (isDragging === 'sidebar') {
			const newWidth = e.clientX - containerRect.left;
			sidebarWidth = Math.max(200, Math.min(400, newWidth));
		} else if (isDragging === 'editor') {
			const contentStart = containerRect.left + sidebarWidth + 4;
			const contentWidth = containerRect.width - sidebarWidth - 4 - 4;
			const mouseInContent = e.clientX - contentStart;
			const fraction = mouseInContent / contentWidth;
			editorFraction = Math.max(0.2, Math.min(0.8, fraction));
		}
	}

	function onMouseUp() {
		isDragging = null;
	}
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<!-- Mobile sidebar toggle -->
{#if isMobile}
	<button
		type="button"
		class="fixed top-14 left-2 z-40 rounded-md bg-white p-2 shadow-md dark:bg-gray-800 md:hidden"
		onclick={() => sidebarOpen = !sidebarOpen}
		aria-label="Toggle sidebar"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>
{/if}

<div
	bind:this={containerEl}
	class="flex h-full overflow-hidden relative"
	class:select-none={isDragging !== null}
	class:cursor-col-resize={isDragging !== null}
>
	<!-- Sidebar: slide-out drawer on mobile, fixed on desktop -->
	{#if isMobile}
		{#if sidebarOpen}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-30 bg-black/40" onclick={() => sidebarOpen = false}></div>
			<div class="fixed inset-y-0 left-0 z-30 w-72 shadow-xl">
				<Sidebar />
			</div>
		{/if}
	{:else}
		<div
			class="h-full flex-shrink-0 overflow-hidden"
			style="width: {sidebarWidth}px;"
		>
			<Sidebar />
		</div>

		<!-- Sidebar drag handle -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="resize-handle"
			onmousedown={() => onMouseDown('sidebar')}
		></div>
	{/if}

	<!-- Content area (fills remaining space) -->
	{#if $selectedNote}
		<div class="flex h-full flex-1 min-w-0 overflow-hidden {isMobile ? 'flex-col' : ''}">
			<!-- Editor pane -->
			<div
				class="flex h-full flex-col overflow-hidden {isMobile ? 'min-h-[200px]' : 'min-w-[300px]'}"
				style="flex: {isReadOnly ? 0 : editorFraction};"
			>
				<Toolbar
					content={$selectedNote.content}
					onUpdate={handleToolbarUpdate}
					onDictate={isReadOnly ? undefined : handleDictateToggle}
					{isDictating}
					isShared={$selectedNote.isShared ?? false}
					readOnly={isReadOnly}
					onToggleShare={isReadOnly ? undefined : handleToggleShare}
					onImageInsert={isReadOnly ? undefined : (md) => insertAtCursor?.(md)}
				/>
				{#if !isReadOnly}
					<div class="flex-1 overflow-hidden">
						<Editor
							content={$selectedNote.content}
							onChange={handleEditorChange}
							onRegisterInsert={handleRegisterInsert}
							onImageInsert={isReadOnly ? undefined : (md) => insertAtCursor?.(md)}
						/>
					</div>
					<StatusBar content={$selectedNote.content} />
				{/if}
			</div>

			{#if !isReadOnly && !isMobile}
				<!-- Editor/Preview drag handle -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="h-full w-1 flex-shrink-0 cursor-col-resize border-x border-transparent hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
					style="background: var(--color-border);"
					onmousedown={() => onMouseDown('editor')}
				></div>
			{/if}

			<!-- Preview / Chat pane -->
			<div
				class="h-full overflow-auto {isMobile ? 'min-h-[200px]' : 'min-w-[300px]'}"
				style="flex: {isReadOnly ? 1 : 1 - editorFraction};"
			>
				{#if $chatOpen}
					<ChatPanel onSourceClick={(id) => selectedNoteId.set(id)} />
				{:else}
					<Preview markdown={$selectedNote.content} />
				{/if}
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-auto">
			{#if $chatOpen}
				<ChatPanel onSourceClick={(id) => selectedNoteId.set(id)} />
			{:else}
				<div class="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-8">
					<EmptyState />
					<div class="grid w-full max-w-6xl grid-cols-1 gap-4 xl:grid-cols-2">
						<SourcesPane />
						<IngestReviewPanel />
						<WikiIndexView />
						<WikiLogView />
						<LintFindingsPanel />
						<LegacyMigrationPanel />
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.resize-handle {
		height: 100%;
		width: 4px;
		flex-shrink: 0;
		cursor: col-resize;
		background: transparent;
		position: relative;
		transition: background-color 120ms ease;
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--color-border-subtle);
		transition: background-color 120ms ease, width 120ms ease;
	}

	.resize-handle:hover::after {
		width: 2px;
		background: var(--brand-500);
	}
</style>
