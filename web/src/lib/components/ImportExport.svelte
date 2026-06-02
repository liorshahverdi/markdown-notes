<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import { notes, saveNote } from '$lib/stores/notes';
	import { parseImportedMarkdown, parseImportedJSON } from '$lib/markdown/importExport';
	import type { NoteRecord } from '../../types/note';

	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let isDragOver = $state(false);
	let fileInput: HTMLInputElement;

	function clearMessage() {
		setTimeout(() => {
			message = null;
		}, 4000);
	}

	async function handleFiles(files: FileList | File[]) {
		const fileArray = Array.from(files);
		let imported = 0;
		let errors = 0;

		for (const file of fileArray) {
			try {
				const text = await file.text();

				if (file.name.endsWith('.json')) {
					const parsedNotes = parseImportedJSON(text);
					for (const note of parsedNotes) {
						const newNote: NoteRecord = {
							...note,
							id: uuidv4(),
							dateModified: Date.now(),
						};
						await saveNote(newNote);
						notes.update((n) => [...n, newNote]);
						imported++;
					}
				} else if (file.name.endsWith('.md')) {
					const partial = parseImportedMarkdown(file.name, text);
					const newNote: NoteRecord = {
						id: uuidv4(),
						title: partial.title ?? 'Untitled',
						content: partial.content ?? '',
						dateModified: Date.now(),
						isPinned: false,
					};
					await saveNote(newNote);
					notes.update((n) => [...n, newNote]);
					imported++;
				} else {
					errors++;
				}
			} catch (e) {
				errors++;
			}
		}

		if (imported > 0 && errors === 0) {
			message = { type: 'success', text: `Successfully imported ${imported} note${imported !== 1 ? 's' : ''}.` };
		} else if (imported > 0 && errors > 0) {
			message = { type: 'success', text: `Imported ${imported} note${imported !== 1 ? 's' : ''}, ${errors} file${errors !== 1 ? 's' : ''} failed.` };
		} else {
			message = { type: 'error', text: `Failed to import files. Please check the file format.` };
		}
		clearMessage();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		if (e.dataTransfer?.files) {
			handleFiles(e.dataTransfer.files);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			handleFiles(target.files);
		}
	}
</script>

<div class="space-y-4">
	<!-- Drop zone -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors {isDragOver
			? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
			: 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50'}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		role="region"
		aria-label="File drop zone"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
		</svg>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Drop <strong>.md</strong> or <strong>.json</strong> files here
		</p>
		<p class="text-xs text-gray-400 dark:text-gray-500">or</p>
		<button
			type="button"
			class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			onclick={() => fileInput.click()}
		>
			Browse files
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept=".md,.json"
			multiple
			class="hidden"
			onchange={handleFileSelect}
		/>
	</div>

	<!-- Status message -->
	{#if message}
		<div
			class="rounded-md px-4 py-3 text-sm {message.type === 'success'
				? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
				: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}"
			role="status"
		>
			{message.text}
		</div>
	{/if}
</div>
