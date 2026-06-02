/**
 * Entity co-occurrence matrix and PMI computation.
 */

export function buildCooccurrenceMatrix(
  documents: Array<{ id: string; entityNames: string[] }>
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (const doc of documents) {
    // Deduplicate entity names within a document
    const unique = [...new Set(doc.entityNames)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];
        if (a === b) continue;

        // Increment a→b
        if (!matrix.has(a)) matrix.set(a, new Map());
        matrix.get(a)!.set(b, (matrix.get(a)!.get(b) ?? 0) + 1);

        // Increment b→a (symmetric)
        if (!matrix.has(b)) matrix.set(b, new Map());
        matrix.get(b)!.set(a, (matrix.get(b)!.get(a) ?? 0) + 1);
      }
    }
  }

  return matrix;
}

export function computePMI(
  cooccurrence: Map<string, Map<string, number>>,
  entityFrequencies: Map<string, number>,
  totalDocs: number
): Map<string, Map<string, number>> {
  const pmiMatrix = new Map<string, Map<string, number>>();

  for (const [a, neighbors] of cooccurrence) {
    if (!pmiMatrix.has(a)) pmiMatrix.set(a, new Map());
    for (const [b, coCount] of neighbors) {
      const pAB = coCount / totalDocs;
      const pA = entityFrequencies.get(a)! / totalDocs;
      const pB = entityFrequencies.get(b)! / totalDocs;
      const pmi = Math.log2(pAB / (pA * pB));
      pmiMatrix.get(a)!.set(b, pmi);
    }
  }

  return pmiMatrix;
}
