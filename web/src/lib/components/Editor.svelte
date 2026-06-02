<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorState, StateEffect, StateField } from '@codemirror/state';
	import { EditorView, keymap, Decoration, WidgetType } from '@codemirror/view';
	import { defaultKeymap } from '@codemirror/commands';
	import { markdown } from '@codemirror/lang-markdown';
	import { markdownTheme, markdownHighlightStyle, wrapSelection } from './editor-theme';
	import { colorPickerPlugin } from './editor-color-picker';
	import { uploadImageFile } from './imageUpload';

	interface Props {
		content: string;
		onChange: (content: string) => void;
		onRegisterInsert?: (
			insert: (text: string) => void,
			setGhost: (text: string) => void,
			clearGhost: () => void
		) => void;
		onImageInsert?: (markdown: string) => void;
	}

	let { content, onChange, onRegisterInsert, onImageInsert }: Props = $props();

	let isUploading = $state(false);

	function insertTextAt(v: EditorView, text: string, pos: number) {
		v.dispatch({
			changes: { from: pos, insert: text },
			selection: { anchor: pos + text.length },
		});
	}

	async function handleImageFiles(files: File[], v: EditorView, pos: number) {
		for (const file of files) {
			if (!file.type.startsWith('image/')) continue;
			isUploading = true;
			try {
				const filename = await uploadImageFile(file);
				const md = `![image](${filename})\n`;
				insertTextAt(v, md, pos);
				pos += md.length;
			} catch (err) {
				alert(err instanceof Error ? err.message : 'Upload failed');
			} finally {
				isUploading = false;
			}
		}
	}

	let editorContainer: HTMLDivElement;
	let view: EditorView | undefined;
	let isExternalUpdate = false;

	// Ghost text decoration infrastructure
	const setGhostEffect = StateEffect.define<string>();
	const clearGhostEffect = StateEffect.define<null>();

	class GhostWidget extends WidgetType {
		text: string;
		constructor(text: string) {
			super();
			this.text = text;
		}
		toDOM() {
			const span = document.createElement('span');
			span.className = 'cm-dictation-ghost';
			span.textContent = this.text;
			return span;
		}
		eq(other: GhostWidget) {
			return this.text === other.text;
		}
	}

	const ghostField = StateField.define({
		create() {
			return Decoration.none;
		},
		update(value, tr) {
			// Clear ghost on any document change (user typing)
			if (tr.docChanged) {
				return Decoration.none;
			}
			for (const effect of tr.effects) {
				if (effect.is(clearGhostEffect)) {
					return Decoration.none;
				}
				if (effect.is(setGhostEffect)) {
					const pos = tr.state.selection.main.head;
					const deco = Decoration.widget({
						widget: new GhostWidget(effect.value),
						side: 1,
					}).range(pos);
					return Decoration.set([deco]);
				}
			}
			return value;
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	const markdownKeymap = keymap.of([
		{
			key: 'Mod-b',
			run: (v: EditorView) => wrapSelection(v, '**')
		},
		{
			key: 'Mod-i',
			run: (v: EditorView) => wrapSelection(v, '_')
		},
		{
			key: 'Mod-Shift-s',
			run: (v: EditorView) => wrapSelection(v, '~~')
		}
	]);

	const imageDropPasteHandler = EditorView.domEventHandlers({
		drop(event, v) {
			const files = event.dataTransfer?.files;
			if (!files || files.length === 0) return false;
			const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
			if (imageFiles.length === 0) return false;
			event.preventDefault();
			const pos = v.posAtCoords({ x: event.clientX, y: event.clientY }) ?? v.state.selection.main.head;
			handleImageFiles(imageFiles, v, pos);
			return true;
		},
		paste(event, v) {
			const files = event.clipboardData?.files;
			if (!files || files.length === 0) return false;
			const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
			if (imageFiles.length === 0) return false;
			event.preventDefault();
			const pos = v.state.selection.main.head;
			handleImageFiles(imageFiles, v, pos);
			return true;
		}
	});

	const updateListener = EditorView.updateListener.of((update) => {
		if (update.docChanged && !isExternalUpdate) {
			onChange(update.state.doc.toString());
		}
	});

	onMount(() => {
		const state = EditorState.create({
			doc: content,
			extensions: [
				markdown(),
				markdownTheme,
				markdownHighlightStyle,
				markdownKeymap,
				keymap.of(defaultKeymap),
				updateListener,
				ghostField,
				colorPickerPlugin,
				imageDropPasteHandler,
				EditorView.lineWrapping
			]
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});

		// Register insert/ghost callbacks
		if (onRegisterInsert) {
			onRegisterInsert(
				// insert at cursor
				(text: string) => {
					if (!view) return;
					const pos = view.state.selection.main.head;
					view.dispatch({
						changes: { from: pos, insert: text },
						selection: { anchor: pos + text.length },
					});
				},
				// set ghost text
				(text: string) => {
					if (!view) return;
					view.dispatch({
						effects: setGhostEffect.of(text),
					});
				},
				// clear ghost text
				() => {
					if (!view) return;
					view.dispatch({
						effects: clearGhostEffect.of(null),
					});
				}
			);
		}
	});

	onDestroy(() => {
		view?.destroy();
	});

	// React to external content changes (e.g., switching notes)
	$effect(() => {
		if (view && content !== view.state.doc.toString()) {
			isExternalUpdate = true;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: content
				}
			});
			isExternalUpdate = false;
		}
	});
</script>

<div class="editor-container-wrapper">
	{#if isUploading}
		<div class="upload-indicator">Uploading...</div>
	{/if}
	<div bind:this={editorContainer} class="editor-container"></div>
</div>

<style>
	.editor-container-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.upload-indicator {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 10;
		background: #3b82f6;
		color: white;
		padding: 2px 10px;
		border-radius: 4px;
		font-size: 12px;
		pointer-events: none;
	}

	.editor-container {
		width: 100%;
		height: 100%;
	}

	.editor-container :global(.cm-editor) {
		height: 100%;
	}

	.editor-container :global(.cm-scroller) {
		overflow: auto;
	}

	.editor-container :global(.cm-dictation-ghost) {
		color: #9ca3af;
		font-style: italic;
		pointer-events: none;
		user-select: none;
	}

	.editor-container :global(.cm-color-swatch) {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		border: 1px solid #d1d5db;
		vertical-align: middle;
		margin-left: 4px;
		cursor: pointer;
	}

	@media (prefers-color-scheme: dark) {
		.editor-container :global(.cm-dictation-ghost) {
			color: #6b7280;
		}
		.editor-container :global(.cm-color-swatch) {
			border-color: #4b5563;
		}
	}
</style>
