import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LintFindingsPanel from './LintFindingsPanel.svelte';

describe('LintFindingsPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  it('renders actionable findings from the lint API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: { total: 1, errors: 1, warnings: 0, info: 0 },
        findings: [{
          id: 'broken-link:entity-ada:concepts/missing',
          type: 'broken-link',
          severity: 'error',
          message: 'Missing wiki link concepts/missing',
          pageId: 'entity-ada',
          target: 'concepts/missing',
          action: 'Create the missing page or update/remove the wiki link.',
        }],
      }),
    }));

    const { getByText } = render(LintFindingsPanel);

    expect(getByText('Wiki Health')).toBeTruthy();
    await waitFor(() => expect(getByText('Missing wiki link concepts/missing')).toBeTruthy());
    expect(getByText('Create the missing page or update/remove the wiki link.')).toBeTruthy();
  });
});
