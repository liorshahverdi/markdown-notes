import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LegacyMigrationPanel from './LegacyMigrationPanel.svelte';

describe('LegacyMigrationPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  it('runs the note-to-source migration and renders the result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totalNotes: 2, migrated: 2, skipped: 0, sourceIds: ['source-1', 'source-2'] }),
    }));

    const { getByText } = render(LegacyMigrationPanel);
    await fireEvent.click(getByText('Migrate legacy notes'));

    await waitFor(() => expect(getByText('Migrated 2 of 2 notes. Skipped 0 already migrated notes.')).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/migration/notes-to-sources', { method: 'POST' });
  });
});
