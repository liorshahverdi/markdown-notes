/** Neural embeddings are intentionally disabled: retrieval uses keywords + graph.
 * Laguna XS is a generative model, not a compatible embedding encoder.
 * Historical stored vectors are preserved, but neither Ollama nor Transformers
 * is loaded or called by this module.
 */
export async function embedText(_text: string): Promise<number[]> {
  throw new Error('Embedding inference is disabled; use keyword/graph retrieval');
}
export async function embedBatch(_texts: string[]): Promise<number[][]> {
  throw new Error('Embedding inference is disabled; use keyword/graph retrieval');
}
export async function serverSemanticSearch(_query: string, _notes: Array<{ id: string; title: string; content: string }>, _topK = 5): Promise<{ results: Array<{ noteId: string; title: string; score: number }>; contextNotes: Array<{ title: string; content: string }> }> {
  return { results: [], contextNotes: [] };
}
