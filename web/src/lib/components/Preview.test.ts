import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock mermaid before any imports ──
vi.mock('mermaid', () => ({
	default: {
		initialize: vi.fn(),
		run: vi.fn()
	}
}));

// ── Mock renderMarkdown ──
vi.mock('$lib/markdown/renderer', () => ({
	renderMarkdown: vi.fn((md: string) => `<p>${md}</p>`)
}));

// ── Mock computeTextStatistics ──
vi.mock('$lib/markdown/textStatistics', () => ({
	computeTextStatistics: vi.fn((text: string) => ({
		wordCount: text.split(/\s+/).filter((w: string) => w.length > 0).length,
		characterCount: text.length,
		lineCount: text.split('\n').length
	}))
}));

import { renderMarkdown } from '$lib/markdown/renderer';
import { computeTextStatistics } from '$lib/markdown/textStatistics';

// ─────────────────────────────────────────────────────────
// Preview.svelte — renderMarkdown integration & debounce
// ─────────────────────────────────────────────────────────

describe('Preview', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('calls renderMarkdown after 300ms debounce', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: Preview } = await import('./Preview.svelte');

		render(Preview, { props: { markdown: '# Hello' } });

		// Should NOT have been called yet (debounce pending)
		expect(renderMarkdown).not.toHaveBeenCalled();

		// Advance past debounce
		vi.advanceTimersByTime(300);

		expect(renderMarkdown).toHaveBeenCalledWith('# Hello');
	});

	it('debounces rapid changes — only renders final value', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: Preview } = await import('./Preview.svelte');

		const { rerender } = render(Preview, { props: { markdown: 'first' } });

		vi.advanceTimersByTime(100);
		await rerender({ markdown: 'second' });

		vi.advanceTimersByTime(100);
		await rerender({ markdown: 'third' });

		// Not yet — debounce restarted
		expect(renderMarkdown).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);

		// Should only have rendered the final value
		expect(renderMarkdown).toHaveBeenCalledTimes(1);
		expect(renderMarkdown).toHaveBeenCalledWith('third');
	});

	it('renders HTML into the preview container', async () => {
		const { render, act } = await import('@testing-library/svelte');
		const { default: Preview } = await import('./Preview.svelte');

		const { container } = render(Preview, { props: { markdown: 'Hello world' } });

		await act(() => vi.advanceTimersByTime(300));

		// The mock returns `<p>Hello world</p>`
		const previewEl = container.querySelector('.preview-content');
		expect(previewEl).toBeTruthy();
		expect(previewEl!.innerHTML).toContain('Hello world');
	});

	it('renders empty string for empty markdown', async () => {
		vi.mocked(renderMarkdown).mockReturnValue('');
		const { render } = await import('@testing-library/svelte');
		const { default: Preview } = await import('./Preview.svelte');

		const { container } = render(Preview, { props: { markdown: '' } });

		vi.advanceTimersByTime(300);

		const previewEl = container.querySelector('.preview-content');
		expect(previewEl).toBeTruthy();
		expect(previewEl!.innerHTML.trim()).toBe('');
	});
});

// ─────────────────────────────────────────────────────────
// StatusBar.svelte — text statistics display
// ─────────────────────────────────────────────────────────

describe('StatusBar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('displays word count, character count, and line count', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: StatusBar } = await import('./StatusBar.svelte');

		const { container } = render(StatusBar, { props: { content: 'Hello world\nSecond line' } });

		expect(computeTextStatistics).toHaveBeenCalledWith('Hello world\nSecond line');

		// 4 words, 23 chars, 2 lines based on mock
		expect(container.textContent).toContain('4 words');
		expect(container.textContent).toContain('23 chars');
		expect(container.textContent).toContain('2 lines');
	});

	it('displays correct stats for single word', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: StatusBar } = await import('./StatusBar.svelte');

		const { container } = render(StatusBar, { props: { content: 'Hello' } });

		expect(container.textContent).toContain('1 word');
		expect(container.textContent).toContain('5 chars');
		expect(container.textContent).toContain('1 line');
	});

	it('displays zero stats for empty content', async () => {
		vi.mocked(computeTextStatistics).mockReturnValueOnce({
			wordCount: 0,
			characterCount: 0,
			lineCount: 0
		});
		const { render } = await import('@testing-library/svelte');
		const { default: StatusBar } = await import('./StatusBar.svelte');

		const { container } = render(StatusBar, { props: { content: '' } });

		expect(container.textContent).toContain('0 words');
		expect(container.textContent).toContain('0 chars');
		expect(container.textContent).toContain('0 lines');
	});
});

// ─────────────────────────────────────────────────────────
// EmptyState.svelte — placeholder display
// ─────────────────────────────────────────────────────────

describe('EmptyState', () => {
	it('shows the empty state message', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: EmptyState } = await import('./EmptyState.svelte');

		const { container } = render(EmptyState);

		expect(container.textContent).toContain('Build your local markdown wiki.');
		expect(container.textContent).toContain('Import sources');
		expect(container.textContent).toContain('markdown vault');
		expect(container.textContent).toContain('folders');
		expect(container.textContent).toContain('generated wiki pages');
	});

	it('renders a document icon', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: EmptyState } = await import('./EmptyState.svelte');

		const { container } = render(EmptyState);

		// Should have an SVG icon
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('is centered in available space', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: EmptyState } = await import('./EmptyState.svelte');

		const { container } = render(EmptyState);

		const wrapper = container.firstElementChild as HTMLElement;
		expect(wrapper).toBeTruthy();
		// Check for centering styles (flex + center)
		const style = window.getComputedStyle(wrapper);
		// The component should have centering classes or styles
		expect(
			wrapper.classList.contains('empty-state') ||
			wrapper.style.display === 'flex' ||
			wrapper.className.includes('flex')
		).toBe(true);
	});
});
