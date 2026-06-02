import { describe, it, expect } from 'vitest';
import { helpSections, keyboardShortcuts, searchHelp } from './help-content';
import type { HelpSectionData } from './help-content';

// ── helpSections structure ──

describe('helpSections', () => {
	it('contains all required sections', () => {
		const requiredIds = [
			'getting-started',
			'editor',
			'notes-management',
			'voice-assistant',
			'rag-system',
			'knowledge-graph',
			'graph-self-improvement',
			'skill-generation',
			'cli',
			'settings',
			'troubleshooting'
		];
		const ids = helpSections.map((s) => s.id);
		for (const id of requiredIds) {
			expect(ids).toContain(id);
		}
	});

	it('has unique section IDs', () => {
		const ids = helpSections.map((s) => s.id);
		const unique = new Set(ids);
		expect(unique.size).toBe(ids.length);
	});

	it('each section has non-empty title, content, and keywords', () => {
		for (const section of helpSections) {
			expect(section.id).toBeTruthy();
			expect(section.title).toBeTruthy();
			expect(section.content.length).toBeGreaterThan(0);
			expect(section.keywords.length).toBeGreaterThan(0);
		}
	});
});

// ── keyboardShortcuts ──

describe('keyboardShortcuts', () => {
	it('contains at least 4 shortcuts', () => {
		expect(keyboardShortcuts.length).toBeGreaterThanOrEqual(4);
	});

	it('each shortcut has key, description, and section', () => {
		for (const shortcut of keyboardShortcuts) {
			expect(shortcut.key).toBeTruthy();
			expect(shortcut.description).toBeTruthy();
			expect(shortcut.section).toBeTruthy();
		}
	});

	it('references valid section names', () => {
		const validSections = ['Editor', 'Voice', 'Navigation', 'General'];
		for (const shortcut of keyboardShortcuts) {
			expect(validSections).toContain(shortcut.section);
		}
	});
});

// ── searchHelp ──

describe('searchHelp', () => {
	it('returns all sections for empty query', () => {
		const results = searchHelp('');
		expect(results).toHaveLength(helpSections.length);
	});

	it('matches section title', () => {
		const results = searchHelp('Getting Started');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some((s) => s.id === 'getting-started')).toBe(true);
	});

	it('matches section title case-insensitively', () => {
		const results = searchHelp('getting started');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some((s) => s.id === 'getting-started')).toBe(true);
	});

	it('matches content text', () => {
		const results = searchHelp('markdown');
		expect(results.length).toBeGreaterThanOrEqual(1);
	});

	it('matches keywords', () => {
		const results = searchHelp('ollama');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some((s) => s.id === 'rag-system')).toBe(true);
	});

	it('returns empty array when no match found', () => {
		const results = searchHelp('xyznonexistentqueryxyz');
		expect(results).toHaveLength(0);
	});

	it('handles partial word matches', () => {
		const results = searchHelp('voice');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some((s) => s.id === 'voice-assistant')).toBe(true);
	});

	it('matches across multiple fields', () => {
		// 'editor' should match the Editor section by title
		const results = searchHelp('editor');
		expect(results.some((s) => s.id === 'editor')).toBe(true);
	});
});
