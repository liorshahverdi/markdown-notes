import { describe, it, expect } from 'vitest';
import { computeTextStatistics, type TextStats } from './textStatistics';

describe('computeTextStatistics', () => {
	it('returns zeros for empty string', () => {
		const stats = computeTextStatistics('');
		expect(stats).toEqual({ wordCount: 0, characterCount: 0, lineCount: 0 });
	});

	it('counts a single word', () => {
		const stats = computeTextStatistics('hello');
		expect(stats.wordCount).toBe(1);
		expect(stats.characterCount).toBe(5);
		expect(stats.lineCount).toBe(1);
	});

	it('counts multiple words', () => {
		const stats = computeTextStatistics('hello world foo');
		expect(stats.wordCount).toBe(3);
		expect(stats.characterCount).toBe(15);
		expect(stats.lineCount).toBe(1);
	});

	it('counts multiple lines', () => {
		const stats = computeTextStatistics('line1\nline2\nline3');
		expect(stats.lineCount).toBe(3);
		expect(stats.wordCount).toBe(3);
	});

	it('handles extra whitespace between words', () => {
		const stats = computeTextStatistics('  hello   world  ');
		expect(stats.wordCount).toBe(2);
		expect(stats.characterCount).toBe(17);
	});

	it('handles tabs and mixed whitespace', () => {
		const stats = computeTextStatistics('hello\tworld');
		expect(stats.wordCount).toBe(2);
	});

	it('counts lines with trailing newline', () => {
		const stats = computeTextStatistics('line1\n');
		expect(stats.lineCount).toBe(2);
	});

	it('handles Windows-style line endings', () => {
		const stats = computeTextStatistics('line1\r\nline2');
		// \r\n has two chars that are newline-like; matching Swift where \r and \n are both newlines
		expect(stats.lineCount).toBe(3);
	});

	it('handles only whitespace', () => {
		const stats = computeTextStatistics('   ');
		expect(stats.wordCount).toBe(0);
		expect(stats.characterCount).toBe(3);
		expect(stats.lineCount).toBe(1);
	});
});
