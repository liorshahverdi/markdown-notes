import type { SkillRecord } from './skillTemplate';
import type { Cluster } from './clusterDetector';
import type { GraphEntity } from '../../types/graph';

export function buildMergePrompt(skills: SkillRecord[]): string {
  const skillSections = skills
    .map(
      (s, i) =>
        `### Skill ${i + 1}: ${s.name}\nDomain: ${s.domain}\n\n${s.content}`
    )
    .join('\n\n---\n\n');

  return `You are merging multiple skills into a single unified skill.

## Skills to Merge
${skillSections}

## Task
Merge these skills into a single comprehensive skill document. The merged skill should:
1. Combine the knowledge and instructions from all input skills
2. Remove redundancy while preserving all unique information
3. Create a cohesive Description, Trigger Conditions, Instructions, Knowledge Base, Examples, and Evidence section
4. Preserve all citation references from the original skills
5. Output the result as a markdown skill document

Generate the merged skill markdown now.
`;
}

export function buildChainPrompt(skill: SkillRecord, dependency: SkillRecord): string {
  return `You are composing a skill that depends on and builds upon another skill.

## Primary Skill
### ${skill.name}
${skill.content}

## Dependency Skill (required prerequisite)
### ${dependency.name}
${dependency.content}

## Task
Create a composed skill that chains "${skill.name}" with its dependency "${dependency.name}".
The composed skill should:
1. Clearly state that it requires "${dependency.name}" as a prerequisite
2. Describe how the primary skill builds on the dependency
3. Include instructions that reference when to apply the dependency first
4. Combine the knowledge bases, noting what comes from each source
5. Preserve all citation references

Generate the composed skill markdown now.
`;
}

export function buildBridgePrompt(
  clusterA: Cluster,
  clusterB: Cluster,
  sharedEntities: GraphEntity[],
  notes: Array<{ title: string; content: string }>
): string {
  const sharedNames = sharedEntities.map(e => e.name).join(', ');

  const noteContext = notes
    .map(n => `---\nNote: ${n.title}\n${n.content}`)
    .join('\n');

  return `You are creating a bridge skill that connects two knowledge clusters.

## Cluster A: ${clusterA.name}
Entities: ${clusterA.entityIds.join(', ')}

## Cluster B: ${clusterB.name}
Entities: ${clusterB.entityIds.join(', ')}

## Shared Entities (Bridge Points)
${sharedNames}

## Source Notes
${noteContext}

## Task
Create a bridge skill that connects the knowledge from "${clusterA.name}" and "${clusterB.name}" through their shared concepts (${sharedNames}).
The bridge skill should:
1. Describe the connection between the two knowledge domains
2. Explain how concepts from one cluster relate to the other
3. Provide instructions for when and how to apply knowledge from both domains together
4. Include practical examples of cross-domain application
5. Include citation references using [Note: "Title"] format

Generate the bridge skill markdown now.
`;
}
