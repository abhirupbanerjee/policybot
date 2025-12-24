# Tool Routing - Manual Test Plan

## Overview

This test plan covers the Tool Routing feature, which allows admins to configure keyword/regex patterns that force specific tool calls via OpenAI's `tool_choice` parameter.

**Feature Location:** Admin Dashboard → Tools Tab → Tool Routing sub-tab

---

## Prerequisites

- [ ] Admin account credentials
- [ ] At least 2 categories configured
- [ ] Multiple tools available (chart_gen, task_planner, doc_gen, web_search)
- [ ] Access to browser dev tools for API verification

---

## Test Scenarios

### 1. Initial Access & Default Rules

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 1.1 | First Access Seeds Defaults | 1. Clear `tool_routing_rules` table<br>2. Log in as admin<br>3. Navigate to Tools → Tool Routing | Default rules for chart_gen, task_planner, doc_gen, web_search are created |
| 1.2 | Subsequent Access | 1. Navigate away from Tool Routing<br>2. Return to Tool Routing | Existing rules displayed, no duplicates created |
| 1.3 | Rules Grouped by Tool | 1. View Tool Routing tab | Rules are grouped by tool name with count displayed |
| 1.4 | Non-Admin Access Denied | 1. Log in as Superuser<br>2. Attempt to access `/api/admin/tool-routing` | 403 Forbidden response |

### 2. Create Routing Rule

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 2.1 | Create Keyword Rule | 1. Click "Add Rule"<br>2. Tool Name: `test_tool`<br>3. Rule Name: `Test Keywords`<br>4. Rule Type: keyword<br>5. Patterns: `test\nverify\ncheck`<br>6. Force Mode: required<br>7. Priority: 50<br>8. Click Save | Rule created, success message shown, rule appears in list |
| 2.2 | Create Regex Rule | 1. Click "Add Rule"<br>2. Tool Name: `regex_tool`<br>3. Rule Name: `Regex Test`<br>4. Rule Type: regex<br>5. Patterns: `\btest\w+\b\n^verify.*$`<br>6. Force Mode: preferred<br>7. Click Save | Rule created with regex type |
| 2.3 | Create with Category Filter | 1. Click "Add Rule"<br>2. Fill required fields<br>3. Select 1-2 categories<br>4. Save | Rule saved with category filter applied |
| 2.4 | Empty Patterns Rejected | 1. Click "Add Rule"<br>2. Leave Patterns empty<br>3. Click Save | Error: "At least one pattern is required" |
| 2.5 | Missing Tool Name | 1. Click "Add Rule"<br>2. Leave Tool Name empty<br>3. Click Save | Save button disabled or error shown |
| 2.6 | Missing Rule Name | 1. Click "Add Rule"<br>2. Leave Rule Name empty<br>3. Click Save | Save button disabled or error shown |
| 2.7 | Invalid Regex Pattern | 1. Click "Add Rule"<br>2. Rule Type: regex<br>3. Patterns: `[invalid(`<br>4. Click Save | Error: "Invalid regex pattern: [invalid(" |
| 2.8 | Create Inactive Rule | 1. Click "Add Rule"<br>2. Uncheck "Rule is active"<br>3. Fill required fields<br>4. Save | Rule created but shows "Disabled" badge |

### 3. Edit Routing Rule

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 3.1 | Edit Rule | 1. Click Edit icon on existing rule<br>2. Change Rule Name<br>3. Add new pattern<br>4. Save | Rule updated, updated_at timestamp changes |
| 3.2 | Change Force Mode | 1. Edit existing rule<br>2. Change Force Mode from required to suggested<br>3. Save | Force mode label changes in rule list |
| 3.3 | Change Priority | 1. Edit existing rule<br>2. Change priority from 100 to 5<br>3. Save | Rule reordered in list (lower priority first) |
| 3.4 | Change Rule Type | 1. Edit keyword rule<br>2. Change to regex type<br>3. Update patterns to valid regex<br>4. Save | Rule type badge changes to "regex" |
| 3.5 | Update Categories | 1. Edit rule with no categories<br>2. Add category filter<br>3. Save<br>4. Expand rule | Category filter shown in expanded view |
| 3.6 | Remove Category Filter | 1. Edit rule with categories<br>2. Deselect all categories<br>3. Save | Rule shows "All categories" |

### 4. Delete Routing Rule

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 4.1 | Delete Rule | 1. Click Delete icon on rule<br>2. Confirm deletion | Rule removed, success message shown |
| 4.2 | Cancel Delete | 1. Click Delete icon<br>2. Click Cancel in confirmation | Rule not deleted |

### 5. Toggle Rule Active State

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 5.1 | Disable Rule | 1. Click Power icon on active rule | Rule shows "Disabled" badge, row grayed out |
| 5.2 | Enable Rule | 1. Click Power icon on disabled rule | Rule becomes active, badge removed |
| 5.3 | Disabled Rule Not Matched | 1. Disable a rule<br>2. Test routing with message matching that rule | Disabled rule not in matches |

### 6. Test Routing Panel

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 6.1 | Open Test Panel | 1. Click "Test" button in header | Test panel expands with message input and category filter |
| 6.2 | Test Keyword Match | 1. Open test panel<br>2. Enter "create a chart for sales"<br>3. Click Run Test | Matches: chart_gen rule, Result: `function:chart_gen` |
| 6.3 | Test Regex Match | 1. Create regex rule with pattern `\bvisuali[sz]e\b`<br>2. Test with "please visualize this data" | Rule matches |
| 6.4 | Test No Match | 1. Enter "hello world"<br>2. Run Test | No rules matched, Result: `auto` |
| 6.5 | Test Multiple Matches | 1. Enter message matching 2+ rules<br>2. Run Test | Both matches shown, Result depends on force modes |
| 6.6 | Test Category Filter | 1. Create rule scoped to Category A<br>2. Test message without category filter → matches<br>3. Test with Category B selected → no match | Category scoping works correctly |
| 6.7 | Test Empty Message | 1. Leave message empty<br>2. Run Test | Button disabled or error shown |
| 6.8 | Close Test Panel | 1. Click "Test" button again | Panel collapses |

### 7. Force Mode Behavior

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 7.1 | Single Required Match | 1. Create rule with force_mode=required<br>2. Test matching message | Result: `function:{toolName}` |
| 7.2 | Multiple Required Matches | 1. Create 2 rules (different tools) both with required mode<br>2. Create message matching both<br>3. Test | Result: `required` (LLM picks) |
| 7.3 | Preferred Mode | 1. Create rule with force_mode=preferred<br>2. Test matching message | Result: `required` |
| 7.4 | Suggested Mode Only | 1. Create rule with force_mode=suggested<br>2. Ensure no required/preferred rules match<br>3. Test | Result: `auto` |
| 7.5 | Required Overrides Preferred | 1. Create required rule for tool A<br>2. Create preferred rule for tool B<br>3. Test message matching both | Result: `function:toolA` |

### 8. Priority Ordering

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 8.1 | Lower Priority First | 1. Create rule A: priority 100<br>2. Create rule B: priority 10<br>3. View rules list | Rule B appears before Rule A |
| 8.2 | Same Priority Uses Creation Order | 1. Create rule A: priority 50<br>2. Create rule B: priority 50 | Rules sorted by created_at |

### 9. Pattern Matching

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 9.1 | Keyword Word Boundary | 1. Create keyword rule: `chart`<br>2. Test "chart" → match<br>3. Test "charting" → no match<br>4. Test "barchart" → no match | Only exact word matches |
| 9.2 | Keyword Case Insensitive | 1. Create keyword rule: `chart`<br>2. Test "CHART"<br>3. Test "Chart"<br>4. Test "ChArT" | All match |
| 9.3 | Multi-word Keyword | 1. Create keyword rule: `bar chart`<br>2. Test "create a bar chart" | Matches |
| 9.4 | Regex Pattern | 1. Create regex rule: `\bchart\w*\b`<br>2. Test "chart"<br>3. Test "charting"<br>4. Test "charts" | All match |
| 9.5 | Regex Case Insensitive | 1. Create regex: `^Create.*`<br>2. Test "create a report" | Matches (regex is case-insensitive) |
| 9.6 | Special Characters in Keyword | 1. Create keyword: `c++`<br>2. Test "learn c++ programming" | Matches (special chars escaped) |

### 10. Category Scoping

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 10.1 | Global Rule (No Categories) | 1. Create rule without category filter<br>2. Test with different category contexts | Rule matches regardless of category |
| 10.2 | Single Category Rule | 1. Create rule scoped to Category A<br>2. Test with Category A context → matches<br>3. Test with Category B context → no match | Rule only matches in Category A |
| 10.3 | Multiple Categories Rule | 1. Create rule scoped to Categories A and B<br>2. Test with Category A → matches<br>3. Test with Category B → matches<br>4. Test with Category C → no match | Rule matches in A and B only |

### 11. UI/UX

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 11.1 | Expand Rule Details | 1. Click chevron on collapsed rule | Patterns and categories shown in expanded view |
| 11.2 | Collapse Rule Details | 1. Click chevron on expanded rule | Details hidden |
| 11.3 | Loading State | 1. Refresh rules | Spinner shown while loading |
| 11.4 | Success Message Auto-dismiss | 1. Save a rule<br>2. Wait 3 seconds | Success message disappears |
| 11.5 | Error Message Dismissible | 1. Trigger an error<br>2. Click X on error | Error dismissed |
| 11.6 | Refresh Button | 1. Click Refresh | Rules reloaded from server |
| 11.7 | Modal Cancel | 1. Click Add Rule<br>2. Fill some fields<br>3. Click Cancel | Modal closes, no rule created |

### 12. Integration with Chat

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| 12.1 | Routing Applied in Chat | 1. Create rule: chart_gen for "chart"<br>2. In chat, say "show me a chart"<br>3. Verify tool is called | chart_gen tool is invoked |
| 12.2 | Auto Mode When No Match | 1. Ensure no rules match "hello"<br>2. Send "hello" in chat | LLM responds without forced tool |
| 12.3 | Disabled Rule Not Applied | 1. Disable chart rule<br>2. Say "show me a chart" in chat | LLM decides whether to use chart tool |

---

## API Endpoint Tests

### GET /api/admin/tool-routing

| ID | Test Case | Expected |
|----|-----------|----------|
| A1 | Valid admin request | 200, `{ rules: [...], count: N }` |
| A2 | Unauthenticated | 401 |
| A3 | Non-admin user | 403 |

### POST /api/admin/tool-routing

| ID | Test Case | Body | Expected |
|----|-----------|------|----------|
| A4 | Create valid rule | `{ toolName, ruleName, ruleType, patterns }` | 200, `{ success: true, rule: {...} }` |
| A5 | Missing toolName | `{ ruleName, ruleType, patterns }` | 400 |
| A6 | Invalid ruleType | `{ ruleType: 'invalid' }` | 400 |
| A7 | Invalid forceMode | `{ forceMode: 'unknown' }` | 400 |
| A8 | Invalid regex | `{ ruleType: 'regex', patterns: ['[invalid('] }` | 400 |

### GET /api/admin/tool-routing/{id}

| ID | Test Case | Expected |
|----|-----------|----------|
| A9 | Valid ID | 200, rule object |
| A10 | Invalid ID | 404 |

### PATCH /api/admin/tool-routing/{id}

| ID | Test Case | Body | Expected |
|----|-----------|------|----------|
| A11 | Update single field | `{ priority: 5 }` | 200, updated rule |
| A12 | Update multiple fields | `{ ruleName, patterns }` | 200, all fields updated |
| A13 | Toggle isActive | `{ isActive: false }` | 200, rule disabled |
| A14 | Invalid ID | - | 404 |

### DELETE /api/admin/tool-routing/{id}

| ID | Test Case | Expected |
|----|-----------|----------|
| A15 | Delete existing | 200, `{ success: true }` |
| A16 | Delete non-existent | 404 |

### POST /api/admin/tool-routing/test

| ID | Test Case | Body | Expected |
|----|-----------|------|----------|
| A17 | Test with match | `{ message: "create a chart" }` | 200, matches with chart_gen |
| A18 | Test no match | `{ message: "hello" }` | 200, empty matches, `auto` |
| A19 | Test with categories | `{ message: "...", categoryIds: [1] }` | 200, scoped results |

---

## Edge Cases

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| E1 | Very Long Pattern | Create rule with 1000+ char pattern | Accepts and stores correctly |
| E2 | Many Patterns | Create rule with 50+ patterns | Accepts and stores correctly |
| E3 | Unicode Patterns | Create keyword rule: `报告` | Matches Chinese characters |
| E4 | Empty Categories Array | Save rule with `categoryIds: []` | Treated as null (all categories) |
| E5 | Duplicate Rule Names | Create two rules with same name | Both created (name not unique) |
| E6 | Same Tool Multiple Rules | Create 5 rules for same tool | All rules applied, grouped in UI |
| E7 | Whitespace-only Pattern | Add pattern with only spaces | Filtered out on save |
| E8 | Pattern with Newlines | Add pattern containing `\n` literal | Handled correctly |

---

## Regression Tests

- [ ] Default rules match documented patterns (chart, graph, plot, etc.)
- [ ] Force mode labels display correctly (Force Tool, Force Any, Suggest)
- [ ] Rule type badges show correct colors (purple=keyword, indigo=regex)
- [ ] Timestamps display in user's locale
- [ ] Category names resolve correctly in expanded view
- [ ] Test results show pattern that matched

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Tester | | | |
| Developer | | | |
| Product Owner | | | |

---

*Last Updated: December 2024*
