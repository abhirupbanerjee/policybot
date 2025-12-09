/**
 * Category Prompt Database Operations
 *
 * Manages category-specific prompt addendums that are appended to the global system prompt.
 * Combined prompt = Global System Prompt + Category Addendum
 */

import { execute, queryOne, queryAll } from './index';
import { getSystemPrompt } from './config';
import { getCategoryById } from './categories';

// ============ Types ============

export interface CategoryPrompt {
  categoryId: number;
  promptAddendum: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CategoryPromptRow {
  category_id: number;
  prompt_addendum: string;
  updated_at: string;
  updated_by: string;
}

// Maximum combined prompt length (global + category)
export const MAX_COMBINED_PROMPT_LENGTH = 8000;

// ============ Read Operations ============

/**
 * Get category prompt addendum by category ID
 * Returns undefined if no custom prompt is set
 */
export function getCategoryPrompt(categoryId: number): CategoryPrompt | undefined {
  const row = queryOne<CategoryPromptRow>(
    'SELECT category_id, prompt_addendum, updated_at, updated_by FROM category_prompts WHERE category_id = ?',
    [categoryId]
  );

  if (!row) return undefined;

  return {
    categoryId: row.category_id,
    promptAddendum: row.prompt_addendum,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/**
 * Get all category prompts
 */
export function getAllCategoryPrompts(): CategoryPrompt[] {
  const rows = queryAll<CategoryPromptRow>(
    'SELECT category_id, prompt_addendum, updated_at, updated_by FROM category_prompts ORDER BY category_id'
  );

  return rows.map(row => ({
    categoryId: row.category_id,
    promptAddendum: row.prompt_addendum,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}

/**
 * Get resolved system prompt for a category
 * Combines global system prompt with category-specific addendum
 *
 * @param categoryId - Optional category ID. If not provided, returns global prompt only.
 * @returns Combined system prompt string
 */
export function getResolvedSystemPrompt(categoryId?: number): string {
  const globalPrompt = getSystemPrompt();

  if (!categoryId) {
    return globalPrompt;
  }

  const categoryPrompt = getCategoryPrompt(categoryId);

  if (!categoryPrompt || !categoryPrompt.promptAddendum) {
    return globalPrompt;
  }

  // Append category-specific addendum with a separator
  return `${globalPrompt}\n\n--- Category-Specific Guidelines ---\n\n${categoryPrompt.promptAddendum}`;
}

/**
 * Get available character limit for category addendum
 * Calculated as: MAX_COMBINED_PROMPT_LENGTH - global prompt length
 */
export function getAvailableCharLimit(): number {
  const globalPrompt = getSystemPrompt();
  const available = MAX_COMBINED_PROMPT_LENGTH - globalPrompt.length;
  return Math.max(0, available);
}

/**
 * Get character counts for UI display
 */
export function getPromptCharacterInfo(categoryId?: number): {
  globalLength: number;
  categoryLength: number;
  combinedLength: number;
  availableForCategory: number;
  maxCombined: number;
} {
  const globalPrompt = getSystemPrompt();
  const globalLength = globalPrompt.length;

  let categoryLength = 0;
  if (categoryId) {
    const categoryPrompt = getCategoryPrompt(categoryId);
    categoryLength = categoryPrompt?.promptAddendum?.length || 0;
  }

  // Account for separator text length
  const separatorLength = categoryLength > 0 ? '\n\n--- Category-Specific Guidelines ---\n\n'.length : 0;
  const combinedLength = globalLength + separatorLength + categoryLength;
  const availableForCategory = MAX_COMBINED_PROMPT_LENGTH - globalLength - separatorLength;

  return {
    globalLength,
    categoryLength,
    combinedLength,
    availableForCategory: Math.max(0, availableForCategory),
    maxCombined: MAX_COMBINED_PROMPT_LENGTH,
  };
}

// ============ Write Operations ============

/**
 * Set or update category prompt addendum
 *
 * @param categoryId - Category ID
 * @param promptAddendum - The prompt text to append to global prompt
 * @param updatedBy - Email of user making the change
 * @throws Error if category doesn't exist or prompt exceeds character limit
 */
export function setCategoryPrompt(
  categoryId: number,
  promptAddendum: string,
  updatedBy: string
): CategoryPrompt {
  // Validate category exists
  const category = getCategoryById(categoryId);
  if (!category) {
    throw new Error(`Category with ID ${categoryId} does not exist`);
  }

  // Validate character limit
  const charInfo = getPromptCharacterInfo();
  if (promptAddendum.length > charInfo.availableForCategory) {
    throw new Error(
      `Prompt addendum exceeds available character limit. ` +
      `Available: ${charInfo.availableForCategory}, Provided: ${promptAddendum.length}`
    );
  }

  // Upsert the category prompt
  execute(`
    INSERT INTO category_prompts (category_id, prompt_addendum, updated_by, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(category_id) DO UPDATE SET
      prompt_addendum = excluded.prompt_addendum,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `, [categoryId, promptAddendum, updatedBy]);

  return getCategoryPrompt(categoryId)!;
}

/**
 * Delete category prompt (reset to using global prompt only)
 */
export function deleteCategoryPrompt(categoryId: number): boolean {
  const result = execute('DELETE FROM category_prompts WHERE category_id = ?', [categoryId]);
  return result.changes > 0;
}

// ============ Validation ============

/**
 * Forbidden phrases that could be used for prompt injection
 */
const FORBIDDEN_PHRASES = [
  'ignore previous',
  'disregard',
  'system:',
  'assistant:',
  'ignore above',
  'forget all',
  'new instructions',
  'override',
];

/**
 * Validate prompt addendum content
 * Returns array of validation errors (empty if valid)
 */
export function validatePromptAddendum(content: string): string[] {
  const errors: string[] = [];

  // Check for empty content
  if (!content || content.trim().length === 0) {
    errors.push('Prompt addendum cannot be empty');
    return errors;
  }

  // Check for forbidden phrases (case-insensitive)
  const lowerContent = content.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      errors.push(`Prompt contains forbidden phrase: "${phrase}"`);
    }
  }

  // Check character limit
  const charInfo = getPromptCharacterInfo();
  if (content.length > charInfo.availableForCategory) {
    errors.push(
      `Prompt exceeds character limit. ` +
      `Available: ${charInfo.availableForCategory}, Provided: ${content.length}`
    );
  }

  return errors;
}

// ============ Bulk Operations ============

/**
 * Get category prompts for multiple categories
 */
export function getCategoryPromptsForCategories(categoryIds: number[]): Map<number, CategoryPrompt> {
  if (categoryIds.length === 0) return new Map();

  const placeholders = categoryIds.map(() => '?').join(', ');
  const rows = queryAll<CategoryPromptRow>(
    `SELECT category_id, prompt_addendum, updated_at, updated_by
     FROM category_prompts
     WHERE category_id IN (${placeholders})`,
    categoryIds
  );

  const result = new Map<number, CategoryPrompt>();
  for (const row of rows) {
    result.set(row.category_id, {
      categoryId: row.category_id,
      promptAddendum: row.prompt_addendum,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });
  }

  return result;
}
