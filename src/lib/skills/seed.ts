/**
 * Core Skills Seeder
 *
 * Seeds the initial core skills that are part of the base system.
 * These skills are marked as is_core=true and cannot be deleted.
 */

import { seedCoreSkill } from '../db/skills';
import type { TriggerType } from './types';

interface CoreSkillDefinition {
  name: string;
  description: string;
  promptContent: string;
  triggerType: TriggerType;
  triggerValue: string | null;
  priority: number;
}

/**
 * Core skills definitions
 * These are seeded on app startup if they don't exist
 */
const CORE_SKILLS: CoreSkillDefinition[] = [
  {
    name: 'Base Response Guidelines',
    description: 'Core guidelines for response formatting and behavior',
    promptContent: `## Response Guidelines

- Answer questions using information from the provided context documents
- If information is not available in the context, clearly state that
- Always cite sources with document names and page numbers when referencing specific information
- Use markdown formatting for better readability
- Be concise but thorough in your responses
- Maintain a professional and helpful tone`,
    triggerType: 'always',
    triggerValue: null,
    priority: 1,
  },
  {
    name: 'Citation Format',
    description: 'Standard citation format for document references',
    promptContent: `## Citation Format

When citing sources, use this format:
- For specific facts: "According to [Document Name] (page X), ..."
- For general references: "As described in [Document Name], ..."
- Include page numbers when available for precise references
- If multiple sources support the same point, cite all relevant ones`,
    triggerType: 'always',
    triggerValue: null,
    priority: 2,
  },
  {
    name: 'Knowledge Boundaries',
    description: 'Guidelines for handling questions outside knowledge base',
    promptContent: `## Knowledge Boundaries

When the question cannot be fully answered from the provided context:
1. Acknowledge what IS covered in the available documents
2. Clearly state what information is NOT available
3. Suggest where the user might find the missing information if known
4. Never fabricate information not present in the documents`,
    triggerType: 'always',
    triggerValue: null,
    priority: 3,
  },
];

/**
 * Seed core skills into the database
 * This is idempotent - skills are only created if they don't exist
 */
export function seedCoreSkills(): void {
  console.log('[Skills] Seeding core skills...');

  for (const skill of CORE_SKILLS) {
    seedCoreSkill(
      skill.name,
      skill.description,
      skill.promptContent,
      skill.triggerType,
      skill.triggerValue,
      skill.priority
    );
  }

  console.log('[Skills] Core skills seeded');
}
