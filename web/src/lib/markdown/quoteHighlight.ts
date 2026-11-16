/**
 * Highlight a quoted piece of evidence inside rendered note content using the
 * CSS Custom Highlight API (no DOM mutation, so the renderer is unaffected).
 */

const HIGHLIGHT_NAME = 'graph-evidence';

interface CharRef {
  node: Text;
  offset: number;
}

/** Map normalized (lowercase, collapsed-whitespace) text back to DOM positions. */
export function findQuoteRange(root: Node, quote: string): Range | null {
  const needle = quote.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!needle) return null;

  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let haystack = '';
  const refs: CharRef[] = [];
  let lastWasSpace = true;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      const isSpace = /\s/.test(text[i]);
      if (isSpace) {
        if (lastWasSpace) continue;
        haystack += ' ';
      } else {
        haystack += text[i].toLowerCase();
      }
      refs.push({ node, offset: i });
      lastWasSpace = isSpace;
    }
  }

  const start = haystack.indexOf(needle);
  if (start < 0) return null;
  const first = refs[start];
  const last = refs[start + needle.length - 1];
  const range = doc.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  return range;
}

type HighlightRegistry = { set(name: string, value: unknown): void; delete(name: string): void };

function registry(): { highlights: HighlightRegistry; Highlight: new (...ranges: Range[]) => unknown } | null {
  const css = (globalThis as unknown as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Highlight = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  return css?.highlights && Highlight ? { highlights: css.highlights, Highlight } : null;
}

/**
 * Highlight `quote` inside `root` (or clear when null). Returns whether the
 * quote was found. Scrolls the match into view when highlighting is supported.
 */
export function highlightQuote(root: Element | null, quote: string | null): boolean {
  const api = registry();
  api?.highlights.delete(HIGHLIGHT_NAME);
  if (!root || !quote) return false;
  const range = findQuoteRange(root, quote);
  if (!range) return false;
  if (api) {
    api.highlights.set(HIGHLIGHT_NAME, new api.Highlight(range));
    const target = range.startContainer.parentElement;
    target?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  return true;
}
