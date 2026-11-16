import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerSummaryGeneration } from './noteSummarizer';
import { completeLlamaCpp } from './llamaCpp';
import { updateNoteSummary } from './notesFile';

vi.mock('./llamaCpp', () => ({ completeLlamaCpp: vi.fn() }));
vi.mock('./notesFile', () => ({ updateNoteSummary: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('background summaries through the hub backend', () => {
  it('debounces saves and ignores old Ollama settings', async () => {
    vi.useFakeTimers(); vi.mocked(completeLlamaCpp).mockResolvedValue('A concise grounded summary.');
    triggerSummaryGeneration('u', 'n', 'Old title', 'Original note text. '.repeat(10), 'http://stale.invalid:11434', 'old-model');
    triggerSummaryGeneration('u', 'n', 'Current title', 'Latest note text. '.repeat(10));
    await vi.advanceTimersByTimeAsync(2000);
    expect(completeLlamaCpp).toHaveBeenCalledTimes(1);
    expect(completeLlamaCpp).toHaveBeenCalledWith(expect.stringContaining('Current title'));
    expect(updateNoteSummary).toHaveBeenCalledWith('u', 'n', 'A concise grounded summary.');
  });
  it('does not update a note when the model is unavailable', async () => {
    vi.useFakeTimers(); vi.mocked(completeLlamaCpp).mockRejectedValue(new Error('offline'));
    triggerSummaryGeneration('u', 'offline', 'Title', 'A sufficiently long note. '.repeat(10));
    await vi.advanceTimersByTimeAsync(2000);
    expect(updateNoteSummary).not.toHaveBeenCalled();
  });
});
