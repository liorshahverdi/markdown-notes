import { describe, it, expect, beforeAll } from 'vitest';
import mermaid from 'mermaid';
import { diagramTemplates } from './diagramTemplates';

const expectedTemplateKeys = [
	'flowchart',
	'sequence',
	'classDiagram',
	'stateDiagram',
	'erDiagram',
	'gantt',
	'pie',
	'userJourney',
	'gitGraph',
	'requirement',
	'quadrantChart',
	'mindMap',
	'timeline',
	'sankey',
	'xyChart',
	'blockDiagram',
	'packet',
	'architecture',
	'radar',
	'treemap',
	'kanban',
	'ishikawa',
	'c4Context',
] as const;

const expectedDetectedTypes = new Set([
	'flowchart-v2',
	'flowchart',
	'sequence',
	'class',
	'stateDiagram',
	'er',
	'gantt',
	'pie',
	'journey',
	'gitGraph',
	'requirement',
	'quadrantChart',
	'mindmap',
	'timeline',
	'sankey',
	'xychart',
	'block',
	'packet',
	'architecture',
	'radar',
	'treemap',
	'kanban',
	'ishikawa',
	'c4',
]);

describe('diagramTemplates', () => {
	beforeAll(() => {
		mermaid.initialize({ startOnLoad: false });
	});

	it('exports templates for every Mermaid diagram family exposed by the toolbar', () => {
		expect(Object.keys(diagramTemplates).sort()).toEqual([...expectedTemplateKeys].sort());
	});

	it('keeps every Mermaid template detectable by Mermaid before it is inserted into markdown', () => {
		const detectedTypes = new Set<string>();

		for (const key of expectedTemplateKeys) {
			const template = diagramTemplates[key];
			expect(template.trim().length, `${key} should not be empty`).toBeGreaterThan(0);
			detectedTypes.add(mermaid.detectType(template));
		}

		for (const type of detectedTypes) {
			expect(expectedDetectedTypes.has(type), `${type} should be a supported Mermaid type`).toBe(true);
		}
	});

	it('includes the markdown/wiki diagram types users commonly expect', () => {
		expect(diagramTemplates.flowchart.trimStart()).toMatch(/^(graph|flowchart) TD/);
		expect(diagramTemplates.sequence.trimStart()).toMatch(/^sequenceDiagram/);
		expect(diagramTemplates.classDiagram.trimStart()).toMatch(/^classDiagram/);
		expect(diagramTemplates.stateDiagram.trimStart()).toMatch(/^stateDiagram-v2/);
		expect(diagramTemplates.erDiagram.trimStart()).toMatch(/^erDiagram/);
		expect(diagramTemplates.gantt.trimStart()).toMatch(/^gantt/);
		expect(diagramTemplates.pie.trimStart()).toMatch(/^pie/);
		expect(diagramTemplates.mindMap).toContain('mindmap');
		expect(diagramTemplates.timeline.trimStart()).toMatch(/^timeline/);
	});
});
