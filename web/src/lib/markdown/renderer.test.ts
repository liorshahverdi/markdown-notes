import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './renderer';

describe('renderMarkdown', () => {
	it('renders a paragraph', () => {
		const html = renderMarkdown('Hello world');
		expect(html).toContain('<p>Hello world</p>');
	});

	it('renders headings', () => {
		const html = renderMarkdown('# Heading 1\n## Heading 2');
		expect(html).toContain('<h1>Heading 1</h1>');
		expect(html).toContain('<h2>Heading 2</h2>');
	});

	it('renders bold and italic', () => {
		const html = renderMarkdown('**bold** and *italic*');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<em>italic</em>');
	});

	it('renders links', () => {
		const html = renderMarkdown('[click](https://example.com)');
		expect(html).toContain('<a href="https://example.com">click</a>');
	});

	it('renders code blocks', () => {
		const html = renderMarkdown('```js\nconst x = 1;\n```');
		expect(html).toContain('<code');
		expect(html).toContain('const x = 1;');
	});

	it('renders inline code', () => {
		const html = renderMarkdown('Use `console.log`');
		expect(html).toContain('<code>console.log</code>');
	});

	it('renders unordered lists', () => {
		const html = renderMarkdown('- item 1\n- item 2');
		expect(html).toContain('<ul>');
		expect(html).toContain('<li>item 1</li>');
		expect(html).toContain('<li>item 2</li>');
	});

	it('renders GFM tables wrapped in table-wrapper', () => {
		const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
		const html = renderMarkdown(md);
		expect(html).toContain('<div class="table-wrapper"><table>');
		expect(html).toContain('<th>A</th>');
		expect(html).toContain('<td>1</td>');
	});

	it('renders GFM strikethrough', () => {
		const html = renderMarkdown('~~deleted~~');
		expect(html).toContain('<del>deleted</del>');
	});

	it('renders GFM task lists', () => {
		const html = renderMarkdown('- [x] done\n- [ ] todo');
		expect(html).toContain('type="checkbox"');
	});

	it('returns empty string for empty input', () => {
		const html = renderMarkdown('');
		expect(html).toBe('');
	});

	it('renders footnotes', () => {
		const md = 'Text with a footnote[^1].\n\n[^1]: This is the footnote.';
		const html = renderMarkdown(md);
		expect(html).toContain('data-footnote-ref');
		expect(html).toContain('class="footnotes"');
		expect(html).toContain('This is the footnote.');
	});

	it('rewrites relative image src to /api/images', () => {
		const html = renderMarkdown('![alt](photo.png)');
		expect(html).toContain('src="/api/images?path=photo.png"');
	});

	it('does not rewrite absolute image URLs', () => {
		const html = renderMarkdown('![alt](https://example.com/img.png)');
		expect(html).toContain('src="https://example.com/img.png"');
	});

	it('does not rewrite data URI images', () => {
		const html = renderMarkdown('![alt](data:image/png;base64,abc)');
		expect(html).toContain('src="data:image/png;base64,abc"');
	});

	it('preserves GFM table column alignment', () => {
		const md = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |';
		const html = renderMarkdown(md);
		expect(html).toContain('align="left"');
		expect(html).toContain('align="center"');
		expect(html).toContain('align="right"');
	});

	it('sanitizes raw HTML and event handlers', () => {
		const html = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('<script');
	});

	it('removes unsafe javascript links', () => {
		const html = renderMarkdown('[bad](javascript:alert(1))');
		expect(html).toContain('<a>bad</a>');
		expect(html).not.toContain('javascript:');
	});
});
