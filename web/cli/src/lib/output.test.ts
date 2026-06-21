import { describe, expect, it, vi } from 'vitest';
import { APIError } from './apiClient';
import { formatErrorForJson, printJson } from './output';

describe('CLI JSON output helpers', () => {
  it('prints stable pretty JSON', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    printJson({ notes: [], count: 0 });

    expect(log).toHaveBeenCalledWith(JSON.stringify({ notes: [], count: 0 }, null, 2));
    log.mockRestore();
  });

  it('formats API errors with status and response body', () => {
    const error = new APIError(403, 'Forbidden', { error: 'Forbidden', requiredScope: 'notes:write' });

    expect(formatErrorForJson(error)).toEqual({
      ok: false,
      error: {
        message: 'API error: 403 Forbidden: Forbidden',
        code: 'API_ERROR',
        status: 403,
        statusText: 'Forbidden',
        body: { error: 'Forbidden', requiredScope: 'notes:write' },
      },
    });
  });

  it('formats generic errors without leaking stack traces', () => {
    expect(formatErrorForJson(new Error('Boom'))).toEqual({
      ok: false,
      error: { message: 'Boom', code: 'ERROR' },
    });
  });
});
