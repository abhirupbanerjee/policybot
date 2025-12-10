/**
 * Skills System Types
 *
 * Defines types for the modular prompt skills system
 */

export type TriggerType = 'always' | 'category' | 'keyword';

export interface Skill {
  id: number;
  name: string;
  description: string | null;
  prompt_content: string;
  trigger_type: TriggerType;
  trigger_value: string | null;
  category_restricted: boolean;
  is_index: boolean;
  priority: number;
  is_active: boolean;
  is_core: boolean;
  created_by_role: 'admin' | 'superuser';
  token_estimate: number | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface SkillWithCategories extends Skill {
  categories: {
    id: number;
    name: string;
    slug: string;
  }[];
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  prompt_content: string;
  trigger_type: TriggerType;
  trigger_value?: string;
  category_restricted?: boolean;
  is_index?: boolean;
  priority?: number;
  category_ids?: number[];
}

export interface ResolvedSkills {
  skills: Skill[];
  combinedPrompt: string;
  totalTokens: number;
  activatedBy: {
    always: string[];
    category: string[];
    keyword: string[];
  };
}

export interface SkillsSettings {
  enabled: boolean;
  maxTotalTokens: number;
  debugMode: boolean;
}
