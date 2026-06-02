import { describe, it, expect } from 'vitest';
import { extractCSV } from './tableExporter';

describe('extractCSV', () => {
	it('returns null for text without a table', () => {
		expect(extractCSV('no table here')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(extractCSV('')).toBeNull();
	});

	it('extracts a simple table', () => {
		const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
		const csv = extractCSV(md);
		expect(csv).toBe('Name,Age\nAlice,30\nBob,25');
	});

	it('filters out the separator row', () => {
		const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
		const csv = extractCSV(md);
		expect(csv).not.toContain('---');
	});

	it('filters separator with alignment colons', () => {
		const md = '| A | B |\n| :---: | ---: |\n| 1 | 2 |';
		const csv = extractCSV(md);
		expect(csv).not.toContain('---');
		expect(csv).toBe('A,B\n1,2');
	});

	it('quotes cells containing commas', () => {
		const md = '| Name | Value |\n| --- | --- |\n| a,b | 1 |';
		const csv = extractCSV(md);
		expect(csv).toContain('"a,b"');
	});

	it('quotes cells containing double quotes and escapes them', () => {
		const md = '| Name | Value |\n| --- | --- |\n| say "hi" | 1 |';
		const csv = extractCSV(md);
		expect(csv).toContain('"say ""hi"""');
	});

	it('trims cell whitespace', () => {
		const md = '|  Name  |  Age  |\n| --- | --- |\n|  Alice  |  30  |';
		const csv = extractCSV(md);
		expect(csv).toBe('Name,Age\nAlice,30');
	});

	it('finds first table in mixed content', () => {
		const md = 'Some text\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nMore text';
		const csv = extractCSV(md);
		expect(csv).toBe('A,B\n1,2');
	});

	it('handles table with single column', () => {
		const md = '| A |\n| --- |\n| 1 |\n| 2 |';
		const csv = extractCSV(md);
		expect(csv).toBe('A\n1\n2');
	});
});
