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

import mermaid from 'mermaid';
import { renderMarkdown } from '$lib/markdown/renderer';
import { computeTextStatistics } from '$lib/markdown/textStatistics';

// ─────────────────────────────────────────────────────────
// Preview.svelte — renderMarkdown integration & debounce
// ─────────────────────────────────────────────────────────

describe('Preview', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.mocked(renderMarkdown).mockImplementation((md: string) => `<p>${md}</p>`);
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

	it('shows an actionable Mermaid error without removing the diagram source', async () => {
		vi.mocked(renderMarkdown).mockReturnValue(
			'<pre><code class="language-mermaid">graph TD\nA --&gt; </code></pre>'
		);
		vi.mocked(mermaid.run).mockRejectedValueOnce(new Error('Parse error on line 2'));

		const { render, act, waitFor } = await import('@testing-library/svelte');
		const { default: Preview } = await import('./Preview.svelte');
		const { container } = render(Preview, { props: { markdown: '```mermaid\ngraph TD\nA --> \n```' } });

		await act(() => vi.advanceTimersByTime(300));
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		await waitFor(() => expect(container.querySelector('.mermaid-error')).toBeTruthy());
		const error = container.querySelector('.mermaid-error');
		expect(error?.textContent).toContain('Mermaid diagram could not be rendered');
		expect(error?.textContent).toContain('Parse error on line 2');
		expect(error?.textContent).toContain('graph TD');
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

	it('shows conflict recovery status and retry action', async () => {
		const retry = vi.fn();
		const { render, fireEvent } = await import('@testing-library/svelte');
		const { default: StatusBar } = await import('./StatusBar.svelte');

		const { getByRole, container } = render(StatusBar, {
			props: {
				content: 'Hello',
				saveStatus: 'conflict',
				saveIssue: {
					kind: 'conflict',
					noteId: 'n1',
					message: 'Changed elsewhere',
					timestamp: 1,
					serverNote: { id: 'n1', title: 'N1', content: 'server', dateModified: 1, isPinned: false },
				},
				onRetry: retry,
			},
		});

		expect(container.textContent).toContain('Save conflict');
		await fireEvent.click(getByRole('button', { name: /Retry now/i }));
		expect(retry).toHaveBeenCalledOnce();
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

		expect(container.textContent).toContain('Write markdown notes and diagrams.');
		expect(container.textContent).toContain('Create a note');
		expect(container.textContent).toContain('knowledge graph');
		expect(container.textContent).toContain('chat memory');
		expect(container.textContent).toContain('agent skills');
		expect(container.textContent).not.toContain('generated wiki pages');
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
