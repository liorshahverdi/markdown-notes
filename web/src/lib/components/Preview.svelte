<script lang="ts">
	import { tick } from 'svelte';
	import { renderMarkdown } from '$lib/markdown/renderer';
	import { exportDiagramSVG, exportDiagramPNG } from '$lib/markdown/diagramExporter';

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function addExportButtons(wrapper: HTMLDivElement, index: number) {
		const bar = document.createElement('div');
		bar.className = 'mermaid-export-bar';

		const svgBtn = document.createElement('button');
		svgBtn.textContent = 'SVG';
		svgBtn.addEventListener('click', () => {
			const svg = wrapper.querySelector('svg');
			if (!svg) return;
			const blob = exportDiagramSVG(svg.outerHTML);
			downloadBlob(blob, `diagram-${index + 1}.svg`);
		});

		const pngBtn = document.createElement('button');
		pngBtn.textContent = 'PNG';
		pngBtn.addEventListener('click', async () => {
			const svg = wrapper.querySelector('svg');
			if (!svg) return;
			const rect = svg.getBoundingClientRect();
			const blob = await exportDiagramPNG(svg.outerHTML, rect.width, rect.height);
			downloadBlob(blob, `diagram-${index + 1}.png`);
		});

		bar.appendChild(svgBtn);
		bar.appendChild(pngBtn);
		wrapper.appendChild(bar);
	}

	let { markdown }: { markdown: string } = $props();
	let html = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;
	let previewEl: HTMLDivElement;

	let mermaidInitialized = false;

	function showMermaidErrors(error: unknown) {
		if (!previewEl) return;
		const message = error instanceof Error ? error.message : 'Unknown Mermaid rendering error';
		previewEl.querySelectorAll<HTMLElement>('.mermaid').forEach((div) => {
			// Keep already-rendered diagrams intact if Mermaid partially succeeded.
			if (div.querySelector('svg')) return;

			const source = div.dataset.source || div.textContent || '';
			const errorBox = document.createElement('div');
			errorBox.className = 'mermaid-error';
			errorBox.setAttribute('role', 'alert');

			const title = document.createElement('strong');
			title.textContent = 'Mermaid diagram could not be rendered';

			const details = document.createElement('p');
			details.textContent = message;

			const code = document.createElement('pre');
			code.textContent = source;

			errorBox.appendChild(title);
			errorBox.appendChild(details);
			errorBox.appendChild(code);
			div.replaceWith(errorBox);
		});
	}

	async function runMermaid() {
		if (!previewEl) return;
		const mermaidBlocks = previewEl.querySelectorAll('code.language-mermaid');
		if (mermaidBlocks.length === 0) return;

		const { default: mermaid } = await import('mermaid');
		if (!mermaidInitialized) {
			mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
			mermaidInitialized = true;
		}

		mermaidBlocks.forEach((block) => {
			const pre = block.parentElement;
			if (pre && pre.tagName === 'PRE') {
				const div = document.createElement('div');
				const source = block.textContent || '';
				div.className = 'mermaid';
				div.textContent = source;
				div.dataset.source = source;
				pre.replaceWith(div);
			}
		});

		try {
			await mermaid.run({ nodes: previewEl.querySelectorAll('.mermaid') });
		} catch (error) {
			showMermaidErrors(error);
			return;
		}

		const diagrams = previewEl.querySelectorAll('.mermaid');
		diagrams.forEach((div, i) => {
			if (div.parentElement?.classList.contains('mermaid-wrapper')) return;
			const wrapper = document.createElement('div');
			wrapper.className = 'mermaid-wrapper';
			div.parentNode!.insertBefore(wrapper, div);
			wrapper.appendChild(div);
			addExportButtons(wrapper, i);
		});
	}

	$effect(() => {
		// Access markdown to track it as a dependency
		const md = markdown;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			html = renderMarkdown(md);
			// After DOM update, lazily load and run mermaid only if diagrams exist.
			await tick();
			runMermaid();
		}, 300);

		return () => {
			clearTimeout(debounceTimer);
		};
	});
</script>

<div class="preview-container" bind:this={previewEl}>
	<div class="preview-content">
		{@html html}
	</div>
</div>

<style>
	.preview-container {
		font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
		padding: 20px 24px;
		line-height: 1.6;
		color: var(--preview-text, #1d1d1f);
		background: var(--preview-bg, #ffffff);
		overflow-y: auto;
		height: 100%;
	}

	.preview-content {
		max-width: 100%;
	}

	/* Headings */
	.preview-content :global(h1) {
		font-size: 1.8em;
		font-weight: 700;
		margin-top: 0.8em;
		margin-bottom: 0.4em;
		color: var(--preview-heading, #1d1d1f);
	}

	.preview-content :global(h2) {
		font-size: 1.4em;
		font-weight: 600;
		margin-top: 0.8em;
		margin-bottom: 0.4em;
		color: var(--preview-heading, #1d1d1f);
	}

	.preview-content :global(h3) {
		font-size: 1.2em;
		font-weight: 600;
		margin-top: 0.8em;
		margin-bottom: 0.4em;
		color: var(--preview-heading, #1d1d1f);
	}

	/* Inline code */
	.preview-content :global(code) {
		font-family: 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: var(--preview-code-bg, #f0f0f0);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.9em;
	}

	/* Code blocks */
	.preview-content :global(pre) {
		background: var(--preview-code-bg, #f0f0f0);
		padding: 12px 16px;
		border-radius: 8px;
		overflow-x: auto;
	}

	.preview-content :global(pre code) {
		background: none;
		padding: 0;
		border-radius: 0;
	}

	/* Blockquote */
	.preview-content :global(blockquote) {
		border-left: 3px solid var(--preview-border, #ccc);
		padding: 0.2em 1em;
		color: var(--preview-secondary, #666);
		margin-left: 0;
	}

	/* Tables — responsive wrapper */
	.preview-content :global(.table-wrapper) {
		overflow-x: auto;
		margin: 1em 0;
	}

	.preview-content :global(table) {
		border-collapse: collapse;
		width: 100%;
	}

	.preview-content :global(th),
	.preview-content :global(td) {
		border: 1px solid var(--preview-border, #ddd);
		padding: 8px 12px;
	}

	.preview-content :global(th) {
		background: var(--preview-th-bg, #f6f6f6);
		font-weight: 600;
	}

	.preview-content :global(tr:nth-child(even)) {
		background: var(--preview-tr-stripe, rgba(0, 0, 0, 0.02));
	}

	/* Lists */
	.preview-content :global(ul),
	.preview-content :global(ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	.preview-content :global(li) {
		margin: 0.25em 0;
	}

	/* Nested list styles */
	.preview-content :global(ul) { list-style-type: disc; }
	.preview-content :global(ul ul) { list-style-type: circle; margin: 0.2em 0; }
	.preview-content :global(ul ul ul) { list-style-type: square; }
	.preview-content :global(ol) { list-style-type: decimal; }
	.preview-content :global(ol ol) { list-style-type: lower-alpha; margin: 0.2em 0; }
	.preview-content :global(ol ol ol) { list-style-type: lower-roman; }

	/* Footnotes */
	.preview-content :global(.footnotes) {
		border-top: 1px solid var(--preview-border, #ddd);
		margin-top: 2em;
		padding-top: 1em;
		font-size: 0.85em;
		color: var(--preview-secondary, #666);
	}

	.preview-content :global([data-footnote-ref]) {
		text-decoration: none;
		font-weight: 600;
	}

	.preview-content :global(sup) {
		line-height: 0;
	}

	/* Links */
	.preview-content :global(a) {
		color: var(--preview-link, #007aff);
		text-decoration: none;
	}

	.preview-content :global(a:hover) {
		text-decoration: underline;
	}

	/* Horizontal rule */
	.preview-content :global(hr) {
		border: none;
		border-top: 1px solid var(--preview-border, #ddd);
		margin: 1.5em 0;
	}

	/* Images */
	.preview-content :global(img) {
		max-width: 100%;
		border-radius: 4px;
	}

	/* Paragraphs */
	.preview-content :global(p) {
		margin: 0.5em 0;
	}

	/* Mermaid diagram export buttons */
	.preview-content :global(.mermaid-wrapper) {
		position: relative;
	}

	.preview-content :global(.mermaid-export-bar) {
		position: absolute;
		top: 4px;
		right: 4px;
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.preview-content :global(.mermaid-wrapper:hover .mermaid-export-bar) {
		opacity: 1;
	}

	.preview-content :global(.mermaid-export-bar button) {
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 600;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		background: rgba(0, 0, 0, 0.06);
		color: var(--preview-text, #1d1d1f);
	}

	.preview-content :global(.mermaid-export-bar button:hover) {
		background: rgba(0, 0, 0, 0.12);
	}

	.preview-content :global(.mermaid-error) {
		border: 1px solid #f2ba33;
		border-left-width: 4px;
		border-radius: 8px;
		background: rgba(242, 186, 51, 0.12);
		padding: 12px 14px;
		margin: 1em 0;
		color: var(--preview-text, #1d1d1f);
	}

	.preview-content :global(.mermaid-error strong) {
		display: block;
		margin-bottom: 4px;
	}

	.preview-content :global(.mermaid-error p) {
		margin: 0 0 8px;
		color: var(--preview-secondary, #666);
	}

	.preview-content :global(.mermaid-error pre) {
		margin: 0;
		white-space: pre-wrap;
	}

	/* Dark mode — class-based */
	:global(.dark) .preview-container {
		--preview-text: #f5f5f7;
		--preview-bg: #1c1c1e;
		--preview-heading: #f5f5f7;
		--preview-code-bg: #2c2c2e;
		--preview-border: #48484a;
		--preview-secondary: #98989d;
		--preview-th-bg: #2c2c2e;
		--preview-link: #0a84ff;
		--preview-tr-stripe: rgba(255, 255, 255, 0.03);
	}

	:global(.dark) .preview-content :global(.mermaid-export-bar button) {
		background: rgba(255, 255, 255, 0.1);
	}

	:global(.dark) .preview-content :global(.mermaid-export-bar button:hover) {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
