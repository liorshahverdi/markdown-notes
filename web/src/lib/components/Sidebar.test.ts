import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helper function tests (unit-testable without component rendering) ──

// We'll extract these helpers into a module and test them directly.
import { formatRelativeDate, getContentPreview } from './sidebar-helpers';

describe('formatRelativeDate', () => {
  it('should return "just now" for timestamps less than 60 seconds ago', () => {
    const now = Date.now();
    expect(formatRelativeDate(now)).toBe('just now');
    expect(formatRelativeDate(now - 30_000)).toBe('just now');
    expect(formatRelativeDate(now - 59_000)).toBe('just now');
  });

  it('should return "1 minute ago" for timestamps ~1 minute ago', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 60_000)).toBe('1 minute ago');
    expect(formatRelativeDate(now - 90_000)).toBe('1 minute ago');
  });

  it('should return "X minutes ago" for timestamps < 1 hour', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 2 * 60_000)).toBe('2 minutes ago');
    expect(formatRelativeDate(now - 45 * 60_000)).toBe('45 minutes ago');
  });

  it('should return "1 hour ago" for timestamps ~1 hour ago', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 60 * 60_000)).toBe('1 hour ago');
    expect(formatRelativeDate(now - 80 * 60_000)).toBe('1 hour ago');
  });

  it('should return "X hours ago" for timestamps < 1 day', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 2 * 3600_000)).toBe('2 hours ago');
    expect(formatRelativeDate(now - 23 * 3600_000)).toBe('23 hours ago');
  });

  it('should return "1 day ago" for timestamps ~1 day ago', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 24 * 3600_000)).toBe('1 day ago');
    expect(formatRelativeDate(now - 36 * 3600_000)).toBe('1 day ago');
  });

  it('should return "X days ago" for timestamps < 30 days', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 7 * 86400_000)).toBe('7 days ago');
    expect(formatRelativeDate(now - 29 * 86400_000)).toBe('29 days ago');
  });

  it('should return "1 month ago" for timestamps ~30 days ago', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 30 * 86400_000)).toBe('1 month ago');
    expect(formatRelativeDate(now - 50 * 86400_000)).toBe('1 month ago');
  });

  it('should return "X months ago" for timestamps < 1 year', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 90 * 86400_000)).toBe('3 months ago');
  });

  it('should return "1 year ago" for timestamps ~1 year ago', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 365 * 86400_000)).toBe('1 year ago');
  });

  it('should return "X years ago" for older timestamps', () => {
    const now = Date.now();
    expect(formatRelativeDate(now - 730 * 86400_000)).toBe('2 years ago');
  });
});

describe('getContentPreview', () => {
  it('should return first 80 characters of content', () => {
    const content = 'a'.repeat(100);
    expect(getContentPreview(content)).toBe('a'.repeat(80));
  });

  it('should replace newlines with spaces', () => {
    const content = 'line one\nline two\nline three';
    expect(getContentPreview(content)).toBe('line one line two line three');
  });

  it('should replace carriage returns with spaces', () => {
    const content = 'line one\r\nline two';
    expect(getContentPreview(content)).toBe('line one  line two');
  });

  it('should return full content when under 80 chars', () => {
    const content = 'short content';
    expect(getContentPreview(content)).toBe('short content');
  });

  it('should return empty string for empty content', () => {
    expect(getContentPreview('')).toBe('');
  });

  it('should handle content that is exactly 80 characters', () => {
    const content = 'x'.repeat(80);
    expect(getContentPreview(content)).toBe('x'.repeat(80));
  });

  it('should trim leading/trailing whitespace after replacement', () => {
    const content = '\n  some content  \n';
    expect(getContentPreview(content)).toBe('some content');
  });
});
