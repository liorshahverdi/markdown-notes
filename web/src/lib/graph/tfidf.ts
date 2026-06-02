/**
 * TF-IDF computation for document term analysis.
 */

export function computeTFIDF(
  documents: Array<{ id: string; text: string }>
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  const totalDocs = documents.length;

  // Tokenize all documents
  const docTokens = new Map<string, string[]>();
  for (const doc of documents) {
    const tokens = doc.text
      .split(/\s+/)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length > 0);
    docTokens.set(doc.id, tokens);
  }

  // Count how many documents contain each term (for IDF)
  const docFrequency = new Map<string, number>();
  for (const [, tokens] of docTokens) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
  }

  // Compute TF-IDF for each document
  for (const doc of documents) {
    const scores = new Map<string, number>();
    const tokens = docTokens.get(doc.id)!;
    const totalTerms = tokens.length;

    if (totalTerms === 0) {
      result.set(doc.id, scores);
      continue;
    }

    // Count term frequencies
    const termCounts = new Map<string, number>();
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
    }

    for (const [term, count] of termCounts) {
      const tf = count / totalTerms;
      const idf = Math.log(totalDocs / docFrequency.get(term)!);
      scores.set(term, tf * idf);
    }

    result.set(doc.id, scores);
  }

  return result;
}

export function getTopTerms(
  tfidfScores: Map<string, number>,
  topK: number = 10
): Array<{ term: string; score: number }> {
  const entries = Array.from(tfidfScores.entries())
    .map(([term, score]) => ({ term, score }))
    .sort((a, b) => b.score - a.score);
  return entries.slice(0, topK);
}
