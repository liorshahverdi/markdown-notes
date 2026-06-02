import { describe, expect, it } from 'vitest';
import { detectContradictoryClaims } from './contradictionDetector';

describe('detectContradictoryClaims', () => {
  it('finds deterministic claim conflicts across wiki pages', () => {
    const findings = detectContradictoryClaims(new Map([
      ['entity-ada', '# Ada\n\nClaim: analytical-engine-programmer = true'],
      ['concept-history', '# History\n\nClaim: analytical-engine-programmer = false'],
      ['source-summary', '# Source\n\nClaim: other = true'],
    ]));

    expect(findings).toEqual([
      expect.objectContaining({
        id: 'contradiction:analytical-engine-programmer',
        type: 'contradiction',
        severity: 'error',
        pageIds: ['entity-ada', 'concept-history'],
        action: 'Review conflicting claims and either reconcile them or add provenance/context.',
      }),
    ]);
  });
});
