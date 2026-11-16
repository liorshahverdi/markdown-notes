import { writable } from 'svelte/store';
import type { RAGConfig } from '../vector/ragPipeline';

export const ragResponse = writable<string>('');
export const ragSources = writable<Array<{ noteId: string; title: string; relevanceScore: number }>>([]);
export const ragLoading = writable<boolean>(false);
export const ragError = writable<string | null>(null);
export const ollamaStatus = writable<'connected' | 'disconnected' | 'checking'>('checking');

export const ragConfig = writable<RAGConfig>({
  // Compatibility fields only; backend configuration is server-owned.
  ollamaUrl: '',
  model: 'laguna-xs-2.1-q4_k_m',
  topK: 3,
  embeddingModel: '',
});
