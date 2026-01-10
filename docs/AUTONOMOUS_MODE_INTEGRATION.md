# Autonomous Mode Integration Guide

## Overview

This guide explains how to integrate the autonomous mode functionality into the Policy Bot frontend and backend.

## Implementation Status

**✅ Phase 1: Core Infrastructure (COMPLETE)**
- Database schema extensions
- Type system definitions
- Budget tracking system
- JSON schema validation
- Dependency validation
- LLM router (multi-provider support)

**✅ Phase 2: Agent Components (COMPLETE)**
- Planner Agent
- Executor Agent
- Checker Agent (80% confidence threshold)
- Summarizer Agent
- Orchestrator (main coordinator)

**✅ Phase 3: API & Frontend Components (COMPLETE)**
- Extended streaming API
- StreamEvent types for autonomous mode
- ModeToggle component
- AgentPlanProgress component

**✅ Phase 4: Database Ready**
- All migrations applied
- Global budget settings configured

---

## Backend Integration

### 1. Database Schema

The following tables have been extended for autonomous mode:

#### `task_plans` Table
```sql
-- New columns added:
mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'autonomous'))
budget_json TEXT DEFAULT '{"max_llm_calls": 100, "max_tokens": 500000}'
budget_used_json TEXT DEFAULT '{"llm_calls": 0, "tokens_used": 0, "web_searches": 0}'
model_config_json TEXT DEFAULT '{}'
```

#### `messages` Table
```sql
-- New columns added:
mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'autonomous'))
plan_id TEXT REFERENCES task_plans(id)
```

#### `settings` Table
```sql
-- Global budget settings (already configured):
agent_budget_max_llm_calls = 500
agent_budget_max_tokens = 2000000
agent_budget_max_web_searches = 100
agent_confidence_threshold = 80
agent_budget_max_duration_minutes = 30
agent_task_timeout_minutes = 5
```

### 2. API Endpoints

#### Streaming Chat API (`/api/chat/stream`)

**Extended Request Body:**
```typescript
interface StreamChatRequest {
  message: string;
  threadId: string;
  mode?: 'normal' | 'autonomous'; // Defaults to 'normal'
  modelConfigPreset?: 'default' | 'quality' | 'economy' | 'compliance';
}
```

**New SSE Events:**
```typescript
| { type: 'agent_plan_created'; plan_id: string; title: string; task_count: number }
| { type: 'agent_task_started'; task_id: number; description: string; type: string }
| { type: 'agent_task_completed'; task_id: number; status: 'done' | 'skipped' | 'needs_review'; confidence?: number }
| { type: 'agent_budget_warning'; level: 'medium' | 'high'; percentage: number; message: string }
| { type: 'agent_budget_exceeded'; message: string }
| { type: 'agent_plan_summary'; summary: string; stats: AgentPlanStats }
| { type: 'agent_error'; error: string }
```

**New Stream Phases:**
```typescript
| 'agent_planning'    // Creating task plan
| 'agent_executing'   // Executing tasks
| 'agent_summarizing' // Generating summary
```

### 3. Core Agent Files

#### Agent Components
- **[src/lib/agent/planner.ts](src/lib/agent/planner.ts)** - Creates task breakdowns with dependency validation
- **[src/lib/agent/executor.ts](src/lib/agent/executor.ts)** - Executes tasks with fail-fast and idempotency
- **[src/lib/agent/checker.ts](src/lib/agent/checker.ts)** - Quality validation with 80% confidence threshold
- **[src/lib/agent/summarizer.ts](src/lib/agent/summarizer.ts)** - Generates final summaries
- **[src/lib/agent/orchestrator.ts](src/lib/agent/orchestrator.ts)** - Main coordinator (Plan → Execute → Check → Summarize)

#### Infrastructure
- **[src/lib/agent/llm-router.ts](src/lib/agent/llm-router.ts)** - Multi-provider LLM routing (OpenAI, Gemini, Mistral)
- **[src/lib/agent/json-parser.ts](src/lib/agent/json-parser.ts)** - Schema validation with LLM repair
- **[src/lib/agent/dependency-validator.ts](src/lib/agent/dependency-validator.ts)** - Circular dependency detection
- **[src/lib/agent/budget-tracker.ts](src/lib/agent/budget-tracker.ts)** - Global budget tracking with warnings
- **[src/lib/agent/streaming-executor.ts](src/lib/agent/streaming-executor.ts)** - Streaming integration

#### Database Operations
- **[src/lib/db/task-plans.ts](src/lib/db/task-plans.ts)** - Extended with autonomous mode functions
- **[src/lib/db/index.ts](src/lib/db/index.ts)** - Automatic migrations on startup

#### Types
- **[src/types/agent.ts](src/types/agent.ts)** - All agent-related types
- **[src/types/stream.ts](src/types/stream.ts)** - Extended StreamEvent types

---

## Frontend Integration

### 1. Components

#### ModeToggle Component
**Location:** [src/components/chat/ModeToggle.tsx](src/components/chat/ModeToggle.tsx)

```tsx
import ModeToggle, { ChatMode, ModelPreset } from '@/components/chat/ModeToggle';

// Usage:
<ModeToggle
  mode={mode}
  modelPreset={modelPreset}
  onModeChange={(mode) => setMode(mode)}
  onPresetChange={(preset) => setModelPreset(preset)}
  disabled={isStreaming}
/>
```

#### AgentPlanProgress Component
**Location:** [src/components/chat/AgentPlanProgress.tsx](src/components/chat/AgentPlanProgress.tsx)

```tsx
import AgentPlanProgress from '@/components/chat/AgentPlanProgress';

// Usage:
<AgentPlanProgress
  planTitle={planTitle}
  tasks={tasks}
  currentTaskId={currentTaskId}
  budgetWarning={budgetWarning}
  stats={stats}
  isComplete={isComplete}
/>
```

### 2. Integration Steps

#### Step 1: Add State Management to ChatWindow

```tsx
// In ChatWindow.tsx or your main chat component:
import { ChatMode, ModelPreset } from '@/components/chat/ModeToggle';

const [mode, setMode] = useState<ChatMode>('normal');
const [modelPreset, setModelPreset] = useState<ModelPreset>('default');
const [agentPlan, setAgentPlan] = useState<{
  planId?: string;
  title?: string;
  tasks: Array<{
    id: number;
    description: string;
    type: string;
    status: 'pending' | 'running' | 'done' | 'skipped' | 'needs_review';
    confidence?: number;
  }>;
  currentTaskId?: number;
  budgetWarning?: { level: 'medium' | 'high'; percentage: number };
  stats?: AgentPlanStats;
  isComplete?: boolean;
}>({ tasks: [] });
```

#### Step 2: Update Message Sending

```tsx
// When sending a message:
const sendMessage = async (message: string) => {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      threadId,
      mode, // Include mode
      modelConfigPreset: mode === 'autonomous' ? modelPreset : undefined,
    }),
  });

  // Handle SSE stream...
};
```

#### Step 3: Handle Autonomous Mode Events

```tsx
// In your SSE event handler:
const eventSource = new EventSource(/* ... */);

eventSource.addEventListener('message', (e) => {
  const event = JSON.parse(e.data) as StreamEvent;

  switch (event.type) {
    case 'agent_plan_created':
      setAgentPlan({
        planId: event.plan_id,
        title: event.title,
        tasks: [],
        isComplete: false,
      });
      break;

    case 'agent_task_started':
      setAgentPlan(prev => ({
        ...prev,
        currentTaskId: event.task_id,
        tasks: [
          ...prev.tasks,
          {
            id: event.task_id,
            description: event.description,
            type: event.type,
            status: 'running',
          },
        ],
      }));
      break;

    case 'agent_task_completed':
      setAgentPlan(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === event.task_id
            ? { ...t, status: event.status, confidence: event.confidence }
            : t
        ),
      }));
      break;

    case 'agent_budget_warning':
      setAgentPlan(prev => ({
        ...prev,
        budgetWarning: { level: event.level, percentage: event.percentage },
      }));
      break;

    case 'agent_plan_summary':
      setAgentPlan(prev => ({
        ...prev,
        stats: event.stats,
        isComplete: true,
      }));
      break;

    case 'agent_error':
      console.error('Agent error:', event.error);
      // Handle error UI
      break;
  }
});
```

#### Step 4: Render Components

```tsx
// In your chat UI:
return (
  <div>
    {/* Mode Toggle (in message input area) */}
    <ModeToggle
      mode={mode}
      modelPreset={modelPreset}
      onModeChange={setMode}
      onPresetChange={setModelPreset}
      disabled={isStreaming}
    />

    {/* Agent Plan Progress (show when in autonomous mode and plan exists) */}
    {mode === 'autonomous' && agentPlan.tasks.length > 0 && (
      <AgentPlanProgress
        planTitle={agentPlan.title}
        tasks={agentPlan.tasks}
        currentTaskId={agentPlan.currentTaskId}
        budgetWarning={agentPlan.budgetWarning}
        stats={agentPlan.stats}
        isComplete={agentPlan.isComplete}
      />
    )}

    {/* Rest of chat UI */}
  </div>
);
```

---

## Configuration

### Model Presets

Model presets are defined in [src/types/agent.ts](src/types/agent.ts):

```typescript
export const MODEL_PRESETS: Record<string, AgentModelConfig> = {
  default: {
    planner: { provider: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.3 },
    executor: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4 },
    checker: { provider: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.2 },
    summarizer: { provider: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.5 },
  },
  quality: {
    planner: { provider: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.3 },
    executor: { provider: 'openai', model: 'gpt-4o', temperature: 0.4 },
    checker: { provider: 'openai', model: 'gpt-4o', temperature: 0.2 },
    summarizer: { provider: 'openai', model: 'gpt-4o', temperature: 0.5 },
  },
  economy: {
    planner: { provider: 'mistral', model: 'mistral-large-latest', temperature: 0.3 },
    executor: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4 },
    checker: { provider: 'mistral', model: 'mistral-medium-latest', temperature: 0.2 },
    summarizer: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.5 },
  },
  compliance: {
    planner: { provider: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.2 },
    executor: { provider: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.3 },
    checker: { provider: 'openai', model: 'gpt-4o', temperature: 0.1 },
    summarizer: { provider: 'openai', model: 'gpt-4o', temperature: 0.4 },
  },
};
```

### Budget Configuration

Global budget settings can be modified in the database:

```sql
-- Update global budget limits:
UPDATE settings SET value = '1000' WHERE key = 'agent_budget_max_llm_calls';
UPDATE settings SET value = '5000000' WHERE key = 'agent_budget_max_tokens';

-- Update confidence threshold (default 80%):
UPDATE settings SET value = '75' WHERE key = 'agent_confidence_threshold';
```

---

## Testing

### Manual Testing Steps

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Test normal mode (baseline):**
   - Send a regular message
   - Verify normal chat functionality works

3. **Test autonomous mode:**
   - Toggle to "Autonomous" mode
   - Select a model preset (e.g., "Default")
   - Send a request like: "Analyze our onboarding policy and create a compliance checklist"
   - Observe:
     - Plan creation event
     - Task execution progress
     - Budget warnings (if applicable)
     - Final summary

4. **Test budget warnings:**
   - Lower budget limits temporarily:
     ```sql
     UPDATE settings SET value = '10' WHERE key = 'agent_budget_max_llm_calls';
     ```
   - Execute an autonomous plan
   - Verify warnings appear at 50% and 75%

5. **Test error handling:**
   - Test with invalid API keys (temporarily)
   - Verify graceful error messages

### Integration Test Checklist

- [ ] Database migrations applied successfully
- [ ] Autonomous mode toggle renders correctly
- [ ] Model preset selector appears in autonomous mode
- [ ] Plan progress component displays tasks
- [ ] Budget warnings appear at 50%, 75%, 100%
- [ ] Task statuses update in real-time
- [ ] Confidence scores display correctly
- [ ] Final summary renders with statistics
- [ ] Error handling works gracefully
- [ ] Mode switching is disabled during execution
- [ ] Normal mode still works as expected

---

## Architecture Overview

### Execution Flow

```
User Request (Autonomous Mode)
    ↓
Streaming API (/api/chat/stream)
    ↓
Orchestrator.createAndExecuteAutonomousPlan()
    ↓
┌─────────────────────────────────────┐
│ Phase 1: Planning                   │
│ - Planner Agent creates task list   │
│ - Validates dependencies (no cycles)│
│ - JSON schema validation             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Phase 2: Execution Loop             │
│ For each task:                       │
│   1. Executor Agent runs task        │
│   2. Checker Agent validates (80%)   │
│   3. Update task state (idempotent)  │
│   4. Check budget (50%, 75%, 100%)   │
│   5. Stream progress to UI           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Phase 3: Summarization              │
│ - Summarizer Agent generates summary │
│ - Calculate final statistics         │
│ - Stream summary to UI               │
└─────────────────────────────────────┘
    ↓
Final Response to User
```

### Key Design Principles

1. **Fail-Fast**: No retries on task failure, skip and continue
2. **Idempotency**: Tasks can recover from crashes using state history
3. **Budget Enforcement**: Hard stop at 100%, progressive warnings at 50%/75%
4. **Quality Assurance**: 80% confidence threshold, manual review for lower scores
5. **Dependency Validation**: No circular dependencies, DAG structure enforced
6. **Never Auto-Approve**: Checker always flags low confidence or errors for review

---

## Troubleshooting

### Common Issues

#### 1. "Budget exceeded" errors
**Solution:** Increase budget limits in settings table

#### 2. "Circular dependency detected"
**Solution:** Planner should fix this automatically, but review task dependencies if persists

#### 3. Tasks stuck in "running" state
**Solution:** Crash recovery will transition these to "skipped" after 5 minutes on restart

#### 4. Low confidence scores
**Solution:**
- Review task results manually
- Consider using "quality" preset for better results
- Adjust confidence threshold in settings if needed

#### 5. LLM provider errors
**Solution:** Verify API keys for OpenAI, Gemini, Mistral in environment variables

---

## Future Enhancements (Not in v1)

- [ ] Pause/Resume functionality
- [ ] Retry logic with exponential backoff
- [ ] Per-category budget overrides
- [ ] Real-time budget usage visualization
- [ ] Task dependency graph visualization
- [ ] Export plan results to PDF/CSV
- [ ] Multi-user budget pooling
- [ ] Advanced task types (code generation, API calls, etc.)

---

## Support & Feedback

For issues or questions about autonomous mode integration:
1. Check this documentation first
2. Review the plan file: `/home/ab/.claude/plans/jaunty-scribbling-mochi.md`
3. Check implementation files in `src/lib/agent/`

---

## Implementation Completion Status

**✅ COMPLETE - Ready for Testing**

All core functionality has been implemented:
- ✅ Database schema extended
- ✅ All agent components implemented
- ✅ Streaming API integrated
- ✅ Frontend components created
- ✅ Budget tracking with warnings
- ✅ Confidence scoring (80% threshold)
- ✅ Crash recovery (idempotent state transitions)
- ✅ Dependency validation (circular detection)
- ✅ Multi-provider LLM support

**Next Steps:**
1. Integrate ModeToggle into existing MessageInput component
2. Integrate AgentPlanProgress into ChatWindow component
3. Update SSE event handlers to process autonomous mode events
4. Test end-to-end with sample autonomous requests
5. Adjust budget limits and confidence thresholds based on testing

---

**Last Updated:** 2026-01-09
**Implementation Time:** ~18-20 hours
**Version:** 1.0 (Autonomous Mode MVP)
