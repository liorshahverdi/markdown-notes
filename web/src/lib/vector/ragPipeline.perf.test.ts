import { describe, it, expect } from 'vitest';
import { buildRAGPrompt, extractRelevantExcerpt, MAX_PROMPT_CHARS } from './ragPipeline';

/**
 * Generate a realistic large transcript fixture (~50,000 chars, ~200 paragraphs).
 */
function generateTranscript(paragraphs: number = 200): string {
  const topics = [
    'quarterly revenue growth exceeded expectations driven by strong product adoption',
    'the engineering team completed the migration to microservices architecture last sprint',
    'customer feedback indicates high satisfaction with the new dashboard features',
    'we need to address the performance bottleneck in the data processing pipeline',
    'the marketing campaign generated significant leads through social media channels',
    'security audit findings require immediate attention for compliance requirements',
    'the mobile application release is scheduled for next quarter with key improvements',
    'partnership discussions with enterprise clients are progressing well this month',
    'infrastructure costs have been optimized through containerization and auto-scaling',
    'the hiring pipeline shows strong candidates for the senior engineering positions',
  ];

  const paras: string[] = [];
  for (let i = 0; i < paragraphs; i++) {
    const topic = topics[i % topics.length];
    // Each paragraph ~250 chars to reach ~50k total
    paras.push(
      `[${String(i).padStart(3, '0')}] ${topic}. ` +
      `Additional context and discussion points were raised about ${topic.split(' ').slice(0, 4).join(' ')} ` +
      `with further details covering implementation timeline and resource allocation needs.`
    );
  }
  return paras.join('\n\n');
}

const LARGE_TRANSCRIPT = generateTranscript(200);

describe('RAG pipeline performance benchmarks', () => {
  it('buildRAGPrompt completes in <5ms with 10 large notes', () => {
    const notes = Array.from({ length: 10 }, (_, i) => ({
      title: `Meeting Notes ${i + 1}`,
      content: LARGE_TRANSCRIPT.slice(0, 5000), // 5k chars each
    }));

    const start = performance.now();
    const prompt = buildRAGPrompt('quarterly revenue growth performance', notes);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS + 50);
  });

  it('extractRelevantExcerpt completes in <10ms for 50k char note', () => {
    expect(LARGE_TRANSCRIPT.length).toBeGreaterThan(40000);

    const start = performance.now();
    const excerpt = extractRelevantExcerpt(LARGE_TRANSCRIPT, 'security audit compliance requirements', 2000);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
    expect(excerpt.length).toBeLessThanOrEqual(2000);
  });

  it('end-to-end prompt prep completes in <20ms', () => {
    const query = 'engineering migration microservices architecture';

    const start = performance.now();

    // Step 1: Extract relevant excerpt from large transcript (simulates selected note)
    const excerpt = extractRelevantExcerpt(LARGE_TRANSCRIPT, query, 2000);

    // Step 2: Assemble context notes (excerpt + simulated chunk results)
    const contextNotes = [
      { title: 'Current Note', content: excerpt },
      { title: 'Chunk 1', content: 'The engineering team migrated core services to Kubernetes.' },
      { title: 'Chunk 2', content: 'Microservices architecture improved deployment frequency by 3x.' },
      { title: 'Chunk 3', content: 'Database sharding was implemented as part of the migration effort.' },
    ];

    // Step 3: Build final prompt
    const prompt = buildRAGPrompt(query, contextNotes);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS + 50);
  });
});
