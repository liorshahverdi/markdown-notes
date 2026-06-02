import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { rehypeLocalImages } from './rehypeLocalImages';
import type { Root, Element } from 'hast';

/** Rehype plugin: wraps <table> elements in <div class="table-wrapper"> for overflow scrolling. */
function rehypeTableWrapper() {
	return (tree: Root) => {
		visit(tree, 'element', (node: Element, index, parent) => {
			if (node.tagName !== 'table' || !parent || index == null) return;
			const wrapper: Element = {
				type: 'element',
				tagName: 'div',
				properties: { className: ['table-wrapper'] },
				children: [node],
			};
			(parent.children as Element[])[index] = wrapper;
		});
	};
}

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype, { footnoteLabel: 'Footnotes', footnoteBackLabel: 'Back to content' })
	.use(rehypeTableWrapper)
	.use(rehypeLocalImages)
	.use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
	if (!markdown) return '';
	return String(processor.processSync(markdown));
}
