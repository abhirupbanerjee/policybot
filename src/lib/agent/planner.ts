/**
 * Planner Agent
 *
 * Creates task breakdowns from user requests with:
 * - Dependency validation (no circular dependencies)
 * - JSON schema validation
 * - DAG (Directed Acyclic Graph) structure
 */

import type { AgentTask, AgentModelConfig, PlannerResponse } from '@/types/agent';
import { generateWithModel, getModelForRole } from './llm-router';
import { parsePlannerResponse } from './json-parser';
import { validateDependencyGraph } from './dependency-validator';

/**
 * Create a task plan from user request
 *
 * @param userRequest - The user's autonomous mode request
 * @param context - Additional context (RAG results, conversation history, etc.)
 * @param modelConfig - Model configuration for agent roles
 * @returns Array of tasks with validated dependencies
 */
export async function createPlan(
  userRequest: string,
  context: {
    ragContext?: string;
    conversationHistory?: string;
    categoryContext?: string;
  },
  modelConfig: AgentModelConfig
): Promise<{ tasks: AgentTask[]; title: string; error?: string }> {
  const prompt = buildPlannerPrompt(userRequest, context);

  try {
    // Get planner model
    const plannerModel = getModelForRole('planner', modelConfig);

    // Generate plan
    const response = await generateWithModel(plannerModel, prompt, {
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      temperature: 0.3, // Moderate creativity for planning
    });

    // Parse with schema validation
    const parseResult = await parsePlannerResponse(response.content, plannerModel);

    if (!parseResult.success) {
      console.error('[Planner] Parse failed:', parseResult.error);
      return {
        tasks: [],
        title: 'Failed to create plan',
        error: `Failed to parse plan: ${parseResult.error}`,
      };
    }

    const { title, tasks: rawTasks } = parseResult.data;

    // Convert to AgentTask format
    const tasks: AgentTask[] = rawTasks.map((t) => ({
      id: t.id,
      type: t.type,
      target: t.target,
      description: t.description,
      status: 'pending',
      priority: t.priority || 1,
      dependencies: t.dependencies || [],
      state_history: [],
    }));

    // Validate dependency graph
    const validation = validateDependencyGraph(tasks);

    if (!validation.valid) {
      console.error('[Planner] Dependency validation failed:', validation.errors);
      return {
        tasks: [],
        title,
        error: `Invalid dependencies: ${validation.errors.join('; ')}`,
      };
    }

    // Log warnings (non-fatal)
    if (validation.warnings.length > 0) {
      console.warn('[Planner] Dependency warnings:', validation.warnings);
    }

    return { tasks, title };
  } catch (error) {
    console.error('[Planner] Error creating plan:', error);
    return {
      tasks: [],
      title: 'Error',
      error: `Planning error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Build planner prompt
 */
function buildPlannerPrompt(
  userRequest: string,
  context: {
    ragContext?: string;
    conversationHistory?: string;
    categoryContext?: string;
  }
): string {
  let prompt = `Break down this user request into a structured task plan.

**User Request:**
${userRequest}
`;

  if (context.ragContext) {
    prompt += `\n**Available Knowledge:**
${context.ragContext.substring(0, 1000)}...
`;
  }

  if (context.categoryContext) {
    prompt += `\n**Category Context:**
${context.categoryContext}
`;
  }

  prompt += `
**Instructions:**
1. Create 3-10 tasks that break down the request into logical steps
2. Each task should be specific and measurable
3. Use dependencies to define execution order (task IDs)
4. Assign appropriate task types based on the work needed
5. Ensure no circular dependencies
6. IMPORTANT: When creating documents, use "generate" type with target mentioning "Word document", "PDF", or "report"
7. IMPORTANT: When creating images/visuals, use "generate" type with target mentioning "infographic", "image", or "visual"
8. IMPORTANT: When searching the web, use "search" type with target mentioning "web search"

**Task Types:**
- **analyze**: Examine and interpret information (LLM-based analysis)
- **search**: Find information - use target "web search" for internet searches, otherwise searches internal documents
- **compare**: Compare multiple items or options
- **generate**: Create new content - TRIGGERS TOOLS based on target:
  - Target contains "document", "report", "Word", "PDF", "docx" → Creates downloadable Word/PDF document
  - Target contains "infographic", "image", "visual", "diagram", "chart" → Creates AI-generated image
  - Otherwise → LLM text generation
- **summarize**: Condense information into a summary
- **extract**: Pull out specific information
- **validate**: Check correctness or compliance

**Example Response with Tool Usage:**
{
  "title": "SOE Assessment Report Generation",
  "tasks": [
    {
      "id": 1,
      "type": "search",
      "target": "web search SOE information",
      "description": "Search the web for information about the SOE",
      "priority": 1,
      "dependencies": []
    },
    {
      "id": 2,
      "type": "analyze",
      "target": "SOE assessment criteria",
      "description": "Analyze the SOE based on standard assessment criteria",
      "priority": 1,
      "dependencies": [1]
    },
    {
      "id": 3,
      "type": "generate",
      "target": "Word document report",
      "description": "Generate a Word document with the SOE assessment report",
      "priority": 1,
      "dependencies": [2]
    },
    {
      "id": 4,
      "type": "generate",
      "target": "infographic visualization",
      "description": "Create an infographic visualizing the SOE assessment results",
      "priority": 1,
      "dependencies": [2]
    }
  ]
}

Respond with JSON only.`;

  return prompt;
}

/**
 * System prompt for the planner agent
 */
const PLANNER_SYSTEM_PROMPT = `You are an expert task planner. You break down complex requests into structured, executable task plans.

Key principles:
- Create clear, specific tasks
- Define proper dependencies (no circular references)
- Use appropriate task types
- Keep plans concise (3-10 tasks)
- Ensure logical execution order

Output valid JSON matching the schema provided.`;
