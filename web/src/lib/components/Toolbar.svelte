<script lang="ts">
	import {
		wrapSelection,
		prependToLine,
		insertTable,
		addRow,
		addColumn,
		deleteRow,
		deleteColumn,
		insertDiagram,
		insertClassDef,
		insertImage
	} from './toolbar-actions';
	import { diagramTemplates } from '$lib/markdown/diagramTemplates';
	import { uploadImageFile } from './imageUpload';

	interface Props {
		content: string;
		onUpdate: (content: string) => void;
		onDictate?: () => void;
		isDictating?: boolean;
		isShared?: boolean;
		readOnly?: boolean;
		onToggleShare?: () => void;
		onImageInsert?: (markdown: string) => void;
	}

	let { content, onUpdate, onDictate, isDictating = false, isShared = false, readOnly = false, onToggleShare, onImageInsert }: Props = $props();

	// Dropdown menu states
	let headingsOpen = $state(false);
	let formattingOpen = $state(false);
	let listsOpen = $state(false);
	let tableMenuOpen = $state(false);
	let diagramMenuOpen = $state(false);
	let imageMenuOpen = $state(false);
	let colorPickerOpen = $state(false);
	let pickedColor = $state('#3498db');

	// Image menu state
	let imageUrlMode = $state(false);
	let imageUrl = $state('');
	let imageAlt = $state('');
	let fileInput: HTMLInputElement;
	let isUploading = $state(false);

	function closeAllMenus() {
		headingsOpen = false;
		formattingOpen = false;
		listsOpen = false;
		tableMenuOpen = false;
		diagramMenuOpen = false;
		imageMenuOpen = false;
		colorPickerOpen = false;
		imageUrlMode = false;
		imageUrl = '';
		imageAlt = '';
	}

	function handleHeading(level: string) {
		onUpdate(prependToLine(content, level));
		closeAllMenus();
	}

	function handleWrap(wrapper: string) {
		onUpdate(wrapSelection(content, wrapper));
		closeAllMenus();
	}

	function handleList(prefix: string) {
		onUpdate(prependToLine(content, prefix));
		closeAllMenus();
	}

	function handleInsertTable() {
		onUpdate(insertTable(content));
		closeAllMenus();
	}

	function handleAddRow() {
		onUpdate(addRow(content));
		closeAllMenus();
	}

	function handleAddColumn() {
		onUpdate(addColumn(content));
		closeAllMenus();
	}

	function handleDeleteRow() {
		onUpdate(deleteRow(content));
		closeAllMenus();
	}

	function handleDeleteColumn() {
		onUpdate(deleteColumn(content));
		closeAllMenus();
	}

	function handleDiagram(template: string) {
		onUpdate(insertDiagram(content, template));
		closeAllMenus();
	}

	function handleSetNodeColor() {
		onUpdate(insertClassDef(content, pickedColor));
		colorPickerOpen = false;
		diagramMenuOpen = false;
	}

	function toggleMenu(menu: 'headings' | 'formatting' | 'lists' | 'table' | 'diagram' | 'image') {
		const wasOpen = {
			headings: headingsOpen,
			formatting: formattingOpen,
			lists: listsOpen,
			table: tableMenuOpen,
			diagram: diagramMenuOpen,
			image: imageMenuOpen
		}[menu];
		closeAllMenus();
		if (!wasOpen) {
			if (menu === 'headings') headingsOpen = true;
			else if (menu === 'formatting') formattingOpen = true;
			else if (menu === 'lists') listsOpen = true;
			else if (menu === 'table') tableMenuOpen = true;
			else if (menu === 'diagram') diagramMenuOpen = true;
			else if (menu === 'image') imageMenuOpen = true;
		}
	}

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';

		isUploading = true;
		try {
			const filename = await uploadImageFile(file);
			const md = `![image](${filename})`;
			if (onImageInsert) {
				onImageInsert(md);
			} else {
				onUpdate(insertImage(content, 'image', filename));
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			isUploading = false;
			closeAllMenus();
		}
	}

	function handleInsertImageUrl() {
		const src = imageUrl.trim();
		if (!src) return;
		const alt = imageAlt.trim() || 'image';
		const md = `![${alt}](${src})`;
		if (onImageInsert) {
			onImageInsert(md);
		} else {
			onUpdate(insertImage(content, alt, src));
		}
		closeAllMenus();
	}

	const diagramItems: { label: string; key: keyof typeof diagramTemplates }[] = [
		{ label: 'Flowchart', key: 'flowchart' },
		{ label: 'Sequence', key: 'sequence' },
		{ label: 'Class Diagram', key: 'classDiagram' },
		{ label: 'Decision Tree', key: 'decisionTree' },
		{ label: 'Mind Map', key: 'mindMap' },
		{ label: 'Timeline', key: 'timeline' }
	];
</script>

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.toolbar-menu')) {
			closeAllMenus();
		}
	}}
/>

<div class="editor-toolbar">
	<!-- Headings: expanded at wide, dropdown at narrow -->
	<div class="toolbar-menu relative">
		<!-- Wide: show all buttons -->
		<div class="hidden gap-1 sm:flex">
			<button
				class="rounded px-2 py-1 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => handleHeading('# ')}
			>
				H1
			</button>
			<button
				class="rounded px-2 py-1 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => handleHeading('## ')}
			>
				H2
			</button>
			<button
				class="rounded px-2 py-1 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => handleHeading('### ')}
			>
				H3
			</button>
		</div>
		<!-- Narrow: dropdown -->
		<div class="relative sm:hidden">
			<button
				class="rounded px-2 py-1 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => toggleMenu('headings')}
			>
				H
			</button>
			{#if headingsOpen}
				<div
					class="absolute left-0 top-full z-10 mt-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md"
				>
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleHeading('# ')}
					>
						H1
					</button>
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleHeading('## ')}
					>
						H2
					</button>
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleHeading('### ')}
					>
						H3
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Formatting: expanded at wide, dropdown at narrow -->
	<div class="toolbar-menu relative">
		<div class="hidden gap-1 sm:flex">
			<button
				class="rounded px-2 py-1 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => handleWrap('**')}
			>
				B
			</button>
			<button
				class="rounded px-2 py-1 text-sm italic text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => handleWrap('_')}
			>
				I
			</button>
			<button
				class="rounded px-2 py-1 text-sm line-through text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => handleWrap('~~')}
			>
				S
			</button>
		</div>
		<div class="relative sm:hidden">
			<button
				class="rounded px-2 py-1 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => toggleMenu('formatting')}
			>
				Aa
			</button>
			{#if formattingOpen}
				<div
					class="absolute left-0 top-full z-10 mt-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md"
				>
					<button
						class="block w-full px-3 py-1 text-left text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleWrap('**')}
					>
						Bold
					</button>
					<button
						class="block w-full px-3 py-1 text-left text-sm italic text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleWrap('_')}
					>
						Italic
					</button>
					<button
						class="block w-full px-3 py-1 text-left text-sm line-through text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleWrap('~~')}
					>
						Strikethrough
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Lists: expanded at wide, dropdown at narrow -->
	<div class="toolbar-menu relative">
		<div class="hidden gap-1 sm:flex">
			<button
				class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				title="Checkbox"
				onclick={() => handleList('- [ ] ')}
			>
				&#9744;
			</button>
			<button
				class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				title="Bullet list"
				onclick={() => handleList('- ')}
			>
				&bull;
			</button>
			<button
				class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				title="Ordered list"
				onclick={() => handleList('1. ')}
			>
				1.
			</button>
		</div>
		<div class="relative sm:hidden">
			<button
				class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
				onclick={() => toggleMenu('lists')}
			>
				List
			</button>
			{#if listsOpen}
				<div
					class="absolute left-0 top-full z-10 mt-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md"
				>
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleList('- [ ] ')}
					>
						Checkbox
					</button>
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleList('- ')}
					>
						Bullet
					</button>
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleList('1. ')}
					>
						Ordered
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Table menu -->
	<div class="toolbar-menu relative">
		<button
			class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
			onclick={() => toggleMenu('table')}
		>
			Table
		</button>
		{#if tableMenuOpen}
			<div
				class="absolute left-0 top-full z-10 mt-1 min-w-[140px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md"
			>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={handleInsertTable}
				>
					Insert Table
				</button>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={handleAddRow}
				>
					Add Row
				</button>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={handleAddColumn}
				>
					Add Column
				</button>
				<div class="border-t border-gray-200 dark:border-gray-600"></div>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={handleDeleteRow}
				>
					Delete Row
				</button>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={handleDeleteColumn}
				>
					Delete Column
				</button>
			</div>
		{/if}
	</div>

	<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Diagram menu -->
	<div class="toolbar-menu relative">
		<button
			class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
			onclick={() => toggleMenu('diagram')}
		>
			Diagram
		</button>
		{#if diagramMenuOpen}
			<div
				class="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md"
			>
				{#each diagramItems as item}
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => handleDiagram(diagramTemplates[item.key])}
					>
						{item.label}
					</button>
				{/each}
				<div class="border-t border-gray-200 dark:border-gray-600">
					<button
						class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
						onclick={() => {
							colorPickerOpen = !colorPickerOpen;
						}}
					>
						Set Node Color...
					</button>
					{#if colorPickerOpen}
						<div class="flex items-center gap-2 px-3 py-2">
							<input
								type="color"
								bind:value={pickedColor}
								class="h-8 w-8 cursor-pointer rounded border-0"
							/>
							<span class="text-xs text-gray-500 dark:text-gray-400">{pickedColor}</span>
							<button
								class="rounded bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600"
								onclick={handleSetNodeColor}
							>
								Apply
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

	<!-- Image menu -->
	<div class="toolbar-menu relative">
		<button
			class="rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
			onclick={() => toggleMenu('image')}
			disabled={isUploading}
		>
			{isUploading ? 'Uploading...' : 'Image'}
		</button>
		{#if imageMenuOpen}
			<div
				class="absolute left-0 top-full z-10 mt-1 min-w-[200px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md"
			>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={() => fileInput.click()}
				>
					Upload Image
				</button>
				<button
					class="block w-full px-3 py-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={() => { imageUrlMode = !imageUrlMode; }}
				>
					Insert from URL
				</button>
				{#if imageUrlMode}
					<div class="border-t border-gray-200 dark:border-gray-600 px-3 py-2 flex flex-col gap-1">
						<input
							type="text"
							placeholder="Alt text"
							bind:value={imageAlt}
							class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
						/>
						<input
							type="text"
							placeholder="Image URL"
							bind:value={imageUrl}
							class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
							onkeydown={(e) => { if (e.key === 'Enter') handleInsertImageUrl(); }}
						/>
						<button
							class="rounded bg-blue-500 px-2 py-0.5 text-xs text-white hover:bg-blue-600"
							onclick={handleInsertImageUrl}
						>
							Insert
						</button>
					</div>
				{/if}
			</div>
		{/if}
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={handleImageUpload}
		/>
	</div>

	{#if onDictate && !readOnly}
		<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

		<!-- Dictation button -->
		<button
			class="dictate-btn rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
			class:dictating={isDictating}
			onclick={onDictate}
			title="Dictate into note (Cmd/Ctrl+Shift+D)"
			aria-label={isDictating ? 'Stop dictation' : 'Start dictation'}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				width="16"
				height="16"
				class="inline-block"
			>
				<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
				<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
				<line x1="12" x2="12" y1="19" y2="22" />
			</svg>
		</button>
	{/if}

	{#if onToggleShare && !readOnly}
		<div class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600"></div>

		<!-- Share toggle button -->
		<button
			class="rounded px-2 py-1 text-sm transition-colors {isShared
				? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
				: 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
			onclick={onToggleShare}
			title={isShared ? 'Stop sharing' : 'Share note'}
			aria-label={isShared ? 'Stop sharing' : 'Share note'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" class="inline-block">
				<circle cx="18" cy="5" r="3"/>
				<circle cx="6" cy="12" r="3"/>
				<circle cx="18" cy="19" r="3"/>
				<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
				<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
			</svg>
		</button>
	{/if}

	{#if readOnly}
		<div class="ml-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
			</svg>
			Read-only
		</div>
	{/if}
</div>

<style>
	.editor-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: 6px 10px;
		background: var(--color-bg-grain);
		border-bottom: 1px solid var(--color-border-subtle);
	}

	:global(.dark) .editor-toolbar {
		background: var(--color-surface-sunken);
	}

	/* Refine all toolbar buttons (text + icons) */
	.editor-toolbar :global(button) {
		color: var(--color-text-secondary);
		background: transparent;
		border-radius: 5px;
		font-size: 12.5px;
		transition: background-color 120ms ease, color 120ms ease;
	}

	.editor-toolbar :global(button:hover:not(:disabled)) {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.editor-toolbar :global(.bg-blue-100),
	.editor-toolbar :global(.dark\:bg-blue-900\/50) {
		background: var(--brand-tint) !important;
		color: var(--brand-700) !important;
	}

	:global(.dark) .editor-toolbar :global(.bg-blue-100),
	:global(.dark) .editor-toolbar :global(.dark\:bg-blue-900\/50) {
		color: var(--brand-500) !important;
	}

	/* Vertical dividers */
	.editor-toolbar :global(.h-5.w-px) {
		background: var(--color-border-subtle) !important;
		height: 16px !important;
		margin: 0 4px;
	}

	.dictate-btn.dictating {
		background: var(--color-danger) !important;
		color: white !important;
		animation: dictation-pulse 1.5s ease-in-out infinite;
	}

	@keyframes dictation-pulse {
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(184, 54, 43, 0.45);
		}
		50% {
			box-shadow: 0 0 0 5px rgba(184, 54, 43, 0);
		}
	}
</style>
