/**
 * Tool Routing System Types
 *
 * Types for keyword/regex-based tool routing that forces tool_choice
 * when user messages match configured patterns.
 */

// ============ Force Modes ============

/**
 * How strongly to force a tool call
 * - required: Force this specific tool (tool_choice = {type: "function", function: {name: X}})
 * - preferred: Force some tool call (tool_choice = "required")
 * - suggested: Hint but don't force (tool_choice = "auto")
 */
export type ForceMode = 'required' | 'preferred' | 'suggested';

/**
 * Rule matching type
 * - keyword: Word boundary matching (case-insensitive)
 * - regex: Regular expression matching
 */
export type RuleType = 'keyword' | 'regex';

// ============ Routing Rules ============

/**
 * Tool routing rule configuration
 */
export interface ToolRoutingRule {
  id: string;
  toolName: string;
  ruleName: string;
  ruleType: RuleType;
  patterns: string[];
  forceMode: ForceMode;
  priority: number;
  categoryIds: number[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Input for creating/updating routing rules
 */
export interface ToolRoutingRuleInput {
  toolName: string;
  ruleName: string;
  ruleType: RuleType;
  patterns: string[];
  forceMode?: ForceMode;
  priority?: number;
  categoryIds?: number[] | null;
  isActive?: boolean;
}

// ============ Routing Results ============

/**
 * Result of a routing rule match
 */
export interface ToolRoutingResult {
  toolName: string;
  forceMode: ForceMode;
  ruleName: string;
  matchedPattern: string;
}

/**
 * Complete routing decision
 */
export interface RoutingDecision {
  matches: ToolRoutingResult[];
  toolChoice: 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

// ============ API Response Types ============

/**
 * Routing test result for admin UI
 */
export interface RoutingTestResult {
  message: string;
  categoryIds: number[];
  matches: {
    ruleName: string;
    toolName: string;
    pattern: string;
    forceMode: ForceMode;
  }[];
  finalToolChoice: string;
}
