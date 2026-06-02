import { describe, it, expect } from 'vitest';

describe('editor-theme', () => {
	it('exports markdownTheme as a CodeMirror Extension', async () => {
		const { markdownTheme } = await import('./editor-theme');
		// CodeMirror Extensions are arrays or objects with an extension property
		expect(markdownTheme).toBeDefined();
		// Extension is typically an array from EditorView.theme()
		expect(markdownTheme).not.toBeNull();
	});

	it('exports markdownHighlightStyle as a CodeMirror Extension', async () => {
		const { markdownHighlightStyle } = await import('./editor-theme');
		expect(markdownHighlightStyle).toBeDefined();
		expect(markdownHighlightStyle).not.toBeNull();
	});

	it('exports both as distinct values', async () => {
		const { markdownTheme, markdownHighlightStyle } = await import('./editor-theme');
		expect(markdownTheme).not.toBe(markdownHighlightStyle);
	});
});

describe('wrapSelection', () => {
	// We test wrapSelection as a pure utility by importing it
	// and simulating EditorView-like behavior with transaction specs

	it('exports wrapSelection function', async () => {
		const { wrapSelection } = await import('./editor-theme');
		expect(typeof wrapSelection).toBe('function');
	});

	it('wraps selected text with bold markers', async () => {
		const { computeWrap } = await import('./editor-theme');
		const result = computeWrap({ from: 5, to: 10, docLength: 20 }, '**', 'hello');
		expect(result.changes).toEqual({ from: 5, to: 10, insert: '**hello**' });
	});

	it('inserts placeholder when no selection', async () => {
		const { computeWrap } = await import('./editor-theme');
		const result = computeWrap({ from: 5, to: 5, docLength: 20 }, '**', '');
		expect(result.changes).toEqual({ from: 5, insert: '**text**' });
		// Selection should cover the word "text"
		expect(result.selection).toEqual({ anchor: 7, head: 11 });
	});

	it('wraps selected text with italic markers', async () => {
		const { computeWrap } = await import('./editor-theme');
		const result = computeWrap({ from: 0, to: 3, docLength: 10 }, '_', 'abc');
		expect(result.changes).toEqual({ from: 0, to: 3, insert: '_abc_' });
	});

	it('wraps selected text with strikethrough markers', async () => {
		const { computeWrap } = await import('./editor-theme');
		const result = computeWrap({ from: 2, to: 7, docLength: 15 }, '~~', 'world');
		expect(result.changes).toEqual({ from: 2, to: 7, insert: '~~world~~' });
	});

	it('inserts italic placeholder when no selection', async () => {
		const { computeWrap } = await import('./editor-theme');
		const result = computeWrap({ from: 0, to: 0, docLength: 0 }, '_', '');
		expect(result.changes).toEqual({ from: 0, insert: '_text_' });
		expect(result.selection).toEqual({ anchor: 1, head: 5 });
	});
});

describe('Editor.svelte', () => {
	it('can be imported without errors', async () => {
		const module = await import('./Editor.svelte');
		expect(module.default).toBeDefined();
	});
});
