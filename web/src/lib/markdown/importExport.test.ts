import { describe, it, expect } from 'vitest';
import {
	exportNoteAsMarkdown,
	exportAllAsJSON,
	parseImportedMarkdown,
	parseImportedJSON,
	exportNotesAsMarkdown,
} from './importExport';
import type { NoteRecord } from '../../types/note';

const sampleNote: NoteRecord = {
	id: 'note-1',
	title: 'My Test Note',
	content: '# My Test Note\n\nHello world',
	dateModified: 1700000000000,
	isPinned: false,
};

const sampleNote2: NoteRecord = {
	id: 'note-2',
	title: 'Second Note',
	content: '# Second Note\n\nSome content here',
	dateModified: 1700001000000,
	isPinned: true,
};

describe('exportNoteAsMarkdown', () => {
	it('returns a Blob with text/markdown type', () => {
		const blob = exportNoteAsMarkdown(sampleNote);
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('text/markdown');
	});

	it('contains the note content', async () => {
		const blob = exportNoteAsMarkdown(sampleNote);
		const text = await blob.text();
		expect(text).toBe(sampleNote.content);
	});

	it('handles empty content', async () => {
		const emptyNote: NoteRecord = { ...sampleNote, content: '' };
		const blob = exportNoteAsMarkdown(emptyNote);
		const text = await blob.text();
		expect(text).toBe('');
	});
});

describe('exportNotesAsMarkdown', () => {
	it('returns an array of objects with filename and blob', () => {
		const result = exportNotesAsMarkdown([sampleNote, sampleNote2]);
		expect(result).toHaveLength(2);
		expect(result[0].filename).toBe('My Test Note.md');
		expect(result[0].blob).toBeInstanceOf(Blob);
		expect(result[1].filename).toBe('Second Note.md');
	});

	it('returns empty array for empty input', () => {
		const result = exportNotesAsMarkdown([]);
		expect(result).toHaveLength(0);
	});

	it('sanitizes filenames with special characters', () => {
		const noteWithSpecialChars: NoteRecord = {
			...sampleNote,
			title: 'Note/with:special*chars?',
		};
		const result = exportNotesAsMarkdown([noteWithSpecialChars]);
		expect(result[0].filename).not.toMatch(/[/:*?]/);
		expect(result[0].filename).toMatch(/\.md$/);
	});
});

describe('parseImportedMarkdown', () => {
	it('extracts title from filename without .md extension', () => {
		const result = parseImportedMarkdown('My Note.md', '# My Note\n\nContent');
		expect(result.title).toBe('My Note');
	});

	it('uses the raw filename if no .md extension', () => {
		const result = parseImportedMarkdown('My Note', 'Some content');
		expect(result.title).toBe('My Note');
	});

	it('sets content from file content', () => {
		const content = '# Title\n\nHello world';
		const result = parseImportedMarkdown('test.md', content);
		expect(result.content).toBe(content);
	});

	it('handles empty content', () => {
		const result = parseImportedMarkdown('empty.md', '');
		expect(result.title).toBe('empty');
		expect(result.content).toBe('');
	});

	it('returns a partial NoteRecord without id or dateModified', () => {
		const result = parseImportedMarkdown('test.md', 'content');
		// It should have title and content but not necessarily id/dateModified
		expect(result.title).toBeDefined();
		expect(result.content).toBeDefined();
	});
});

describe('exportAllAsJSON', () => {
	it('returns a Blob with application/json type', () => {
		const blob = exportAllAsJSON([sampleNote]);
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('application/json');
	});

	it('contains valid JSON with all notes', async () => {
		const blob = exportAllAsJSON([sampleNote, sampleNote2]);
		const text = await blob.text();
		const parsed = JSON.parse(text);
		expect(parsed).toHaveLength(2);
		expect(parsed[0].id).toBe('note-1');
		expect(parsed[1].id).toBe('note-2');
	});

	it('preserves all note fields', async () => {
		const blob = exportAllAsJSON([sampleNote]);
		const text = await blob.text();
		const parsed = JSON.parse(text);
		expect(parsed[0]).toEqual(sampleNote);
	});

	it('handles empty notes array', async () => {
		const blob = exportAllAsJSON([]);
		const text = await blob.text();
		const parsed = JSON.parse(text);
		expect(parsed).toEqual([]);
	});
});

describe('parseImportedJSON', () => {
	it('parses valid JSON array of notes', () => {
		const json = JSON.stringify([sampleNote, sampleNote2]);
		const result = parseImportedJSON(json);
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('note-1');
		expect(result[1].title).toBe('Second Note');
	});

	it('validates required fields are present', () => {
		const invalid = JSON.stringify([{ foo: 'bar' }]);
		expect(() => parseImportedJSON(invalid)).toThrow();
	});

	it('throws on invalid JSON', () => {
		expect(() => parseImportedJSON('not json at all')).toThrow();
	});

	it('throws on non-array JSON', () => {
		expect(() => parseImportedJSON('{"id": "1"}')).toThrow();
	});

	it('validates each note has required fields', () => {
		const incomplete = JSON.stringify([
			{ id: '1', title: 'Test' }, // missing content, dateModified, isPinned
		]);
		expect(() => parseImportedJSON(incomplete)).toThrow();
	});

	it('accepts notes with all required fields', () => {
		const valid = JSON.stringify([sampleNote]);
		const result = parseImportedJSON(valid);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(sampleNote);
	});
});
