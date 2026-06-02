/**
 * Background self-improvement loop.
 * Runs hourly from the app layout. On startup, checks if a run
 * happened in the past hour (via trace timestamps) and skips if so.
 */

import { get } from 'svelte/store';
import { db } from '../db/index';
import { graphEntities, loadGraphData } from '../stores/graph';
import { notes } from '../stores/notes';
import { ragConfig } from '../stores/rag';
import { createSelfImprover } from './selfImprover';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Check the timestamp of the most recent self_improvement trace.
 * Returns null if no trace exists.
 */
async function lastRunTimestamp(): Promise<number | null> {
  try {
    const recent = await db.traces
      .where('type')
      .equals('self_improvement')
      .reverse()
      .sortBy('timestamp');
    return recent.length > 0 ? recent[0].timestamp : null;
  } catch {
    return null;
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
      const s = JSON.parse(saved);
      return {
        enabled: s.selfImprovementEnabled ?? false,
        threshold: s.autoApplyThreshold ?? 0.8,
      };
    }
  } catch {}
  return { enabled: false, threshold: 0.8 };
}

async function runIfDue(): Promise<void> {
  if (running) return;

  const settings = loadSettings();
  if (!settings.enabled) return;

  // Check if we ran recently
  const lastRun = await lastRunTimestamp();
  if (lastRun && Date.now() - lastRun < INTERVAL_MS) return;

  // Need notes loaded
  if (get(notes).length === 0) return;

  // Ensure graph data is in stores
  if (get(graphEntities).length === 0) {
    await loadGraphData();
  }

  const rc = get(ragConfig);

  running = true;
  try {
    const improver = createSelfImprover({
      enabled: true,
      intervalMs: INTERVAL_MS,
      autoApplyThreshold: settings.threshold,
      ollamaUrl: rc.ollamaUrl || undefined,
      ollamaModel: rc.model || undefined,
    });
    await improver.runOnce();
  } catch (e) {
    console.warn('[SelfImprover] background run failed:', e);
  } finally {
    running = false;
  }
}

/**
 * Start the background self-improvement loop.
 * Checks immediately on startup, then every hour.
 */
export function startSelfImproverBackground(): void {
  if (intervalId) return;

  // Delay initial check to let the app finish loading notes/stores
  setTimeout(() => {
    runIfDue();
  }, 10_000);

  intervalId = setInterval(runIfDue, INTERVAL_MS);
}

/**
 * Stop the background self-improvement loop.
 */
export function stopSelfImproverBackground(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
