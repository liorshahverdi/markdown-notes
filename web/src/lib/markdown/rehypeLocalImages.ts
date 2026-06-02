import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

/**
 * Rehype plugin that rewrites relative image src attributes to use the
 * /api/images endpoint, so local images in data/images/ can be served.
 */
export function rehypeLocalImages() {
	return (tree: Root) => {
		visit(tree, 'element', (node: Element) => {
			if (node.tagName !== 'img') return;
			const src = node.properties?.src;
			if (typeof src !== 'string') return;
			// Skip absolute URLs and data URIs
			if (/^https?:\/\//.test(src) || src.startsWith('data:') || src.startsWith('//')) return;
			node.properties!.src = `/api/images?path=${encodeURIComponent(src)}`;
		});
	};
}
