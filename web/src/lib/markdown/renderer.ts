import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from 'rehype-sanitize';
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

const sanitizeSchema: RehypeSanitizeOptions = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		a: [...(defaultSchema.attributes?.a ?? []), 'dataFootnoteBackref', 'dataFootnoteRef', 'ariaDescribedBy'],
		code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-[\w-]+$/]],
		div: [...(defaultSchema.attributes?.div ?? []), ['className', 'table-wrapper']],
		input: [...(defaultSchema.attributes?.input ?? []), ['type', 'checkbox'], ['checked'], ['disabled']],
		li: [...(defaultSchema.attributes?.li ?? []), ['className', 'task-list-item']],
		section: [...(defaultSchema.attributes?.section ?? []), ['className', 'footnotes'], 'dataFootnotes'],
		td: [...(defaultSchema.attributes?.td ?? []), 'align'],
		th: [...(defaultSchema.attributes?.th ?? []), 'align'],
		ol: [...(defaultSchema.attributes?.ol ?? []), 'start'],
	},
	protocols: {
		...defaultSchema.protocols,
		src: ['http', 'https', 'data'],
	},
};

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype, { footnoteLabel: 'Footnotes', footnoteBackLabel: 'Back to content' })
	.use(rehypeTableWrapper)
	.use(rehypeLocalImages)
	.use(rehypeSanitize, sanitizeSchema)
	.use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
	if (!markdown) return '';
	return String(processor.processSync(markdown));
}
