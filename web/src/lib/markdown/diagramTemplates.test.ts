import { describe, it, expect } from 'vitest';
import { diagramTemplates } from './diagramTemplates';

describe('diagramTemplates', () => {
	it('exports exactly 6 templates', () => {
		expect(Object.keys(diagramTemplates)).toHaveLength(6);
	});

	it('has the correct template keys', () => {
		const keys = Object.keys(diagramTemplates);
		expect(keys).toContain('flowchart');
		expect(keys).toContain('sequence');
		expect(keys).toContain('classDiagram');
		expect(keys).toContain('decisionTree');
		expect(keys).toContain('mindMap');
		expect(keys).toContain('timeline');
	});

	it('flowchart starts with graph TD', () => {
		expect(diagramTemplates.flowchart.trimStart()).toMatch(/^graph TD/);
	});

	it('sequence starts with sequenceDiagram', () => {
		expect(diagramTemplates.sequence.trimStart()).toMatch(/^sequenceDiagram/);
	});

	it('classDiagram starts with classDiagram', () => {
		expect(diagramTemplates.classDiagram.trimStart()).toMatch(/^classDiagram/);
	});

	it('decisionTree starts with graph TD', () => {
		expect(diagramTemplates.decisionTree.trimStart()).toMatch(/^graph TD/);
	});

	it('mindMap contains mindmap keyword', () => {
		expect(diagramTemplates.mindMap).toContain('mindmap');
	});

	it('timeline starts with timeline', () => {
		expect(diagramTemplates.timeline.trimStart()).toMatch(/^timeline/);
	});

	it('flowchart contains classDef definitions', () => {
		expect(diagramTemplates.flowchart).toContain('classDef green');
		expect(diagramTemplates.flowchart).toContain('classDef blue');
		expect(diagramTemplates.flowchart).toContain('classDef orange');
		expect(diagramTemplates.flowchart).toContain('classDef red');
	});

	it('sequence contains actor and participant', () => {
		expect(diagramTemplates.sequence).toContain('actor User');
		expect(diagramTemplates.sequence).toContain('participant App');
		expect(diagramTemplates.sequence).toContain('participant Server');
	});

	it('classDiagram contains Animal, Dog, Cat', () => {
		expect(diagramTemplates.classDiagram).toContain('class Animal');
		expect(diagramTemplates.classDiagram).toContain('class Dog');
		expect(diagramTemplates.classDiagram).toContain('class Cat');
		expect(diagramTemplates.classDiagram).toContain('Animal <|-- Dog');
		expect(diagramTemplates.classDiagram).toContain('Animal <|-- Cat');
	});

	it('all templates are non-empty strings', () => {
		for (const [key, value] of Object.entries(diagramTemplates)) {
			expect(typeof value).toBe('string');
			expect(value.length).toBeGreaterThan(0);
		}
	});
});
