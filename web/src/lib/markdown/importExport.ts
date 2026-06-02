import type { NoteRecord } from '../../types/note';

/**
 * Export a single note as a .md file Blob.
 */
export function exportNoteAsMarkdown(note: NoteRecord): Blob {
	return new Blob([note.content], { type: 'text/markdown' });
}

/**
 * Sanitize a filename by removing characters not allowed in most file systems.
 */
function sanitizeFilename(name: string): string {
	return name.replace(/[/:*?"<>|\\]/g, '_');
}

/**
 * Export multiple notes as individual .md file blobs with filenames.
 */
export function exportNotesAsMarkdown(
	notes: NoteRecord[]
): Array<{ filename: string; blob: Blob }> {
	return notes.map((note) => ({
		filename: `${sanitizeFilename(note.title)}.md`,
		blob: exportNoteAsMarkdown(note),
	}));
}

/**
 * Parse an imported .md file into a partial NoteRecord.
 * Title is derived from the filename (without .md extension).
 */
export function parseImportedMarkdown(
	filename: string,
	content: string
): Partial<NoteRecord> {
	const title = filename.endsWith('.md')
		? filename.slice(0, -3)
		: filename;

	return {
		title,
		content,
	};
}

/**
 * Export all notes as a single JSON blob.
 */
export function exportAllAsJSON(notes: NoteRecord[]): Blob {
	const json = JSON.stringify(notes, null, 2);
	return new Blob([json], { type: 'application/json' });
}

/**
 * Parse imported JSON string into an array of NoteRecords.
 * Validates that the JSON is an array and each element has required fields.
 */
export function parseImportedJSON(json: string): NoteRecord[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		throw new Error('Invalid JSON format');
	}

	if (!Array.isArray(parsed)) {
		throw new Error('Expected a JSON array of notes');
	}

	const requiredFields: Array<keyof NoteRecord> = [
		'id',
		'title',
		'content',
		'dateModified',
		'isPinned',
	];

	for (const item of parsed) {
		if (typeof item !== 'object' || item === null) {
			throw new Error('Each note must be an object');
		}
		for (const field of requiredFields) {
			if (!(field in item)) {
				throw new Error(`Missing required field: ${field}`);
			}
		}
	}

	return parsed as NoteRecord[];
}
