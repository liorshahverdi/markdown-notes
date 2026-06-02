/**
 * Trace store for the UI.
 */

import { writable } from 'svelte/store';
import type { TraceRecord } from '../../types/graph';
import { loadRecentTraces } from '../graph/traceLogger';

export const traces = writable<TraceRecord[]>([]);

export async function loadTraces(limit: number = 50): Promise<void> {
  const loaded = await loadRecentTraces(limit);
  traces.set(loaded);
}

export function clearTraces(): void {
  traces.set([]);
}
