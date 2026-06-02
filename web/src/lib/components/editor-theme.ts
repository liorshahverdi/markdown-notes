import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * CodeMirror theme matching the Swift MarkdownHighlighter colors.
 */
export const markdownTheme: Extension = EditorView.theme(
	{
		'&': {
			fontFamily: '"SF Mono", ui-monospace, monospace',
			fontSize: '14px'
		},
		'.cm-content': {
			fontFamily: '"SF Mono", ui-monospace, monospace',
			fontSize: '14px'
		},
		'&.cm-focused .cm-cursor': {
			borderLeftColor: '#0a84ff',
			borderLeftWidth: '2px'
		},
		'.cm-cursor': {
			borderLeftColor: '#0a84ff',
			borderLeftWidth: '2px'
		},
		'&.cm-focused .cm-activeLine': {
			backgroundColor: 'rgba(10, 132, 255, 0.08)'
		},
		'.cm-activeLineGutter': {
			backgroundColor: 'rgba(10, 132, 255, 0.08)'
		}
	}
);

/**
 * Highlight style matching Swift MarkdownHighlighter colors.
 */
const highlightStyleDef = HighlightStyle.define([
	// Headings: blue, bold
	{
		tag: tags.heading,
		color: '#0a84ff',
		fontWeight: 'bold'
	},
	// Bold/italic/strikethrough markers: gray/dimmed
	{
		tag: tags.processingInstruction,
		color: '#636366'
	},
	// Emphasis (italic)
	{
		tag: tags.emphasis,
		fontStyle: 'italic'
	},
	// Strong (bold)
	{
		tag: tags.strong,
		fontWeight: 'bold'
	},
	// Strikethrough
	{
		tag: tags.strikethrough,
		textDecoration: 'line-through'
	},
	// Inline code — no background, just subtle color change
	{
		tag: tags.monospace,
		color: '#bf5af2'
	},
	// Links
	{
		tag: tags.link,
		color: '#6cb6ff',
		textDecoration: 'underline'
	},
	// URL in links
	{
		tag: tags.url,
		color: '#6cb6ff'
	},
	// Code fence markers (```)
	{
		tag: tags.meta,
		color: '#636366'
	},
	// Content inside code blocks
	{
		tag: tags.content,
		color: '#98989d'
	}
]);

export const markdownHighlightStyle: Extension = syntaxHighlighting(highlightStyleDef);

/**
 * Pure computation for wrap/insert logic — extracted for testability.
 * Takes selection range info and returns the transaction spec.
 */
export function computeWrap(
	selection: { from: number; to: number; docLength: number },
	wrapper: string,
	selectedText: string
): { changes: { from: number; to?: number; insert: string }; selection?: { anchor: number; head: number } } {
	const { from, to } = selection;

	if (from === to) {
		// No selection — insert wrapper + "text" + wrapper
		const insert = `${wrapper}text${wrapper}`;
		return {
			changes: { from, insert },
			selection: {
				anchor: from + wrapper.length,
				head: from + wrapper.length + 4
			}
		};
	} else {
		// Wrap selected text
		return {
			changes: { from, to, insert: `${wrapper}${selectedText}${wrapper}` }
		};
	}
}

/**
 * CodeMirror command that wraps the current selection (or inserts placeholder).
 */
export function wrapSelection(view: EditorView, wrapper: string): boolean {
	const { from, to } = view.state.selection.main;
	const selectedText = view.state.sliceDoc(from, to);
	const spec = computeWrap(
		{ from, to, docLength: view.state.doc.length },
		wrapper,
		selectedText
	);

	view.dispatch({
		changes: spec.changes,
		...(spec.selection ? { selection: spec.selection } : {})
	});

	return true;
}
