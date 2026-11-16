import { afterEach, describe, expect, it } from 'vitest';
import { findQuoteRange, highlightQuote } from './quoteHighlight';

function container(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('findQuoteRange', () => {
  it('finds a quote that spans formatting elements, ignoring case and whitespace differences', () => {
    const el = container('<p>The <strong>Billing</strong>   service\ndepends on the <em>Ledger</em> for balances.</p>');
    const range = findQuoteRange(el, 'billing service depends on the ledger');
    expect(range?.toString().replace(/\s+/g, ' ')).toBe('Billing service depends on the Ledger');
  });

  it('returns null when the quote is not in the note', () => {
    expect(findQuoteRange(container('<p>Nothing relevant</p>'), 'Ledger')).toBeNull();
    expect(findQuoteRange(container('<p>Ledger</p>'), '   ')).toBeNull();
  });
});

describe('highlightQuote', () => {
  it('is a safe no-op when the CSS Highlight API is unavailable and reports whether it found the quote', () => {
    const el = container('<p>Billing depends on Ledger</p>');
    expect(highlightQuote(el, 'Ledger')).toBe(true);
    expect(highlightQuote(el, 'missing')).toBe(false);
    expect(highlightQuote(el, null)).toBe(false);
  });
});
