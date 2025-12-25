# User Guide

This guide explains how to use Policy Bot as a regular user to chat with the AI assistant and access policy documents.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Chat Interface](#3-chat-interface)
4. [Threads & Conversations](#4-threads--conversations)
5. [Working with Documents](#5-working-with-documents)
6. [Voice Input](#6-voice-input)
7. [Using Tools](#7-using-tools)
8. [Categories & Subscriptions](#8-categories--subscriptions)
9. [Mobile & PWA](#9-mobile--pwa)
10. [Personalization](#10-personalization)
11. [Tips & Best Practices](#11-tips--best-practices)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference](#13-quick-reference)

---

## 1. Introduction

### What is Policy Bot?

Policy Bot is an AI-powered assistant that helps you find information in your organization's policy documents. You can ask questions in plain English and get answers with source citations.

### What You Can Do

As a user, you can:
- Chat with the AI assistant about policies and procedures
- Upload documents to your conversation threads for analysis
- Use voice input for hands-free questioning
- Access documents from your subscribed categories
- Personalize the interface with custom colors
- Install Policy Bot as an app on mobile or desktop

### Role Overview

| Role | What They Can Do |
|------|------------------|
| **User (You)** | Chat, upload to threads, access subscribed categories |
| **Superuser** | Manage specific categories assigned to them |
| **Admin** | Full system management |

---

## 2. Getting Started

### Logging In

1. Navigate to Policy Bot in your browser
2. Click **Sign In**
3. Choose your authentication method:
   - **Microsoft** - Use your organization's Microsoft account
   - **Google** - Use your Google account
4. Complete the authentication flow
5. You'll be redirected to the chat interface

### First Time Setup

When you first log in:
1. Policy Bot creates your user profile
2. You're automatically subscribed to default categories (if configured)
3. You can start chatting immediately

### Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] Policy Bot                    [Settings] [Profile]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────────────────────────┐ │
│ │   Threads   │ │                                         │ │
│ │  Sidebar    │ │           Chat Messages                 │ │
│ │             │ │                                         │ │
│ │ • Thread 1  │ │   ┌─────────────────────────────────┐   │ │
│ │ • Thread 2  │ │   │ User: What is the leave policy? │   │ │
│ │ • Thread 3  │ │   └─────────────────────────────────┘   │ │
│ │             │ │                                         │ │
│ │ [+ New]     │ │   ┌─────────────────────────────────┐   │ │
│ │             │ │   │ Bot: According to the Employee  │   │ │
│ │             │ │   │ Handbook (page 23)...           │   │ │
│ │             │ │   │ [Source: HR_Handbook.pdf]       │   │ │
│ │             │ │   └─────────────────────────────────┘   │ │
│ │             │ │                                         │ │
│ └─────────────┘ │ ┌─────────────────────────────────────┐ │ │
│                 │ │ Type your message...    [📎] [🎤] [➤]│ │ │
│                 │ └─────────────────────────────────────┘ │ │
│                 └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Chat Interface

### Sending Messages

1. Type your question in the message box at the bottom
2. Press **Enter** or click the **Send** button
3. Wait for the AI to respond

### Streaming Responses

Policy Bot uses streaming responses, which means:
- You see the answer as it's being generated
- A typing indicator shows the AI is working
- Responses appear word by word for faster feedback

### Understanding Responses

AI responses include:
- **Answer** - The main response to your question
- **Sources** - Document citations with page numbers
- **Relevance Scores** - How confident the AI is in each source

### Example Conversation

**You:** What are the working hours?

**Bot:** According to the Employee Handbook (page 15), standard working hours are 9:00 AM to 5:00 PM, Monday through Friday. Flexible working arrangements may be available upon manager approval.

**Sources:**
- [Employee_Handbook.pdf] Page 15 (Score: 0.89)
- [HR_Policies_2024.pdf] Page 8 (Score: 0.72)

### Message History

- Scroll up to see previous messages
- The AI remembers context from earlier in the conversation
- Very long conversations are automatically summarized to maintain context

---

## 4. Threads & Conversations

### What is a Thread?

A thread is a separate conversation with the AI. Each thread:
- Has its own message history
- Is linked to specific categories
- Can have uploaded documents

### Creating a New Thread

1. Click **+ New Thread** in the sidebar
2. Select the categories you want to query
3. Optionally name your thread
4. Click **Create**

### Selecting Categories

When creating a thread, you can select one or more categories:
- **Single category** - Query documents from one department
- **Multiple categories** - Query across multiple departments

The chat header shows which categories are active.

### Managing Threads

| Action | How |
|--------|-----|
| **Switch thread** | Click on a thread in the sidebar |
| **Rename** | Click the pencil icon or right-click |
| **Delete** | Click the trash icon or right-click |
| **Pin** | Right-click and select Pin |

### Thread Privacy

Your threads are private to you. Other users cannot see your conversations or uploaded documents.

---

## 5. Working with Documents

### Uploading Documents to Threads

You can upload documents to your conversation for analysis:

1. Click the **Attachment** (📎) button
2. Select your file
3. Wait for upload and processing
4. Ask questions about the document

### Upload Limits

| Limit | Value |
|-------|-------|
| Files per thread | 3 |
| Max file size | 5MB each |
| Supported types | PDF only |

### Document Compliance Checking

A common use case is checking your documents against policies:

**You:** [Uploads: expense_report.pdf]

**You:** Does this expense report comply with our travel policy?

**Bot:** I've reviewed your expense report against the Travel & Expense Policy. Here are my findings:

✅ Hotel rate is within daily limit
⚠️ Meal receipt from May 3rd is missing
❌ Transportation expense exceeds $50 limit without approval

### Tips for Document Uploads

- Upload PDFs for best results
- Keep file names descriptive
- Upload before asking questions about the content
- Documents are only available in the current thread

---

## 6. Voice Input

### Using Voice Input

1. Click the **Microphone** (🎤) button
2. Allow microphone access if prompted
3. Speak your question clearly
4. Click the button again to stop recording
5. Your speech is transcribed and sent

### Voice Input Tips

- Speak clearly and at a moderate pace
- Reduce background noise for better accuracy
- Short questions work best
- Review the transcription before sending

### Supported Languages

Voice input primarily supports English. Other languages may work but with reduced accuracy.

---

## 7. Using Tools

The AI has access to various tools that enhance its capabilities.

### Web Search

When the AI needs current information not in the documents:

**You:** What are the latest tax rate changes?

**Bot:** Based on a web search, here are the current tax changes effective 2024...
[WEB] Source: irs.gov - Tax Rate Updates

### Chart Generation

Request data visualizations:

**You:** Create a chart showing our quarterly budget allocation

**Bot:** Here's a pie chart showing the Q4 budget allocation across departments:
[Displays interactive chart]

### Document Generation

Request formatted documents:

**You:** Generate a PDF summary of leave policies

**Bot:** I've created a PDF document summarizing the leave policies:
[Download: Leave_Policy_Summary.pdf]

### Task Planning

For complex multi-step requests:

**You:** Help me plan a new employee onboarding process

**Bot:** I'll create a task plan for onboarding. Let me work through this step by step...
[Shows progress through each step]

---

## 8. Categories & Subscriptions

### Understanding Categories

Categories organize documents by department or topic:
- **HR Policies** - Leave, benefits, employee handbook
- **Finance** - Budgets, expenses, procurement
- **IT** - Security policies, software guidelines
- **Operations** - Procedures, workflows

### Your Subscriptions

You can only access documents from categories you're subscribed to. Your subscriptions are managed by your Superuser or Admin.

### Viewing Your Categories

To see which categories you have access to:
1. Click your profile icon
2. Select **Settings**
3. View **My Categories**

Or check the category selector when creating a new thread.

### Requesting Access

If you need access to additional categories:
1. Contact your Superuser or Admin
2. Specify which category you need
3. Explain why you need access
4. Wait for approval and subscription

---

## 9. Mobile & PWA

### Progressive Web App

Policy Bot is a Progressive Web App (PWA), which means you can install it like a native app.

### Installing on Mobile

**iOS (Safari):**
1. Open Policy Bot in Safari
2. Tap the Share button
3. Select **Add to Home Screen**
4. Tap **Add**

**Android (Chrome):**
1. Open Policy Bot in Chrome
2. Tap the three-dot menu
3. Select **Install app** or **Add to Home Screen**
4. Tap **Install**

### Installing on Desktop

**Chrome/Edge:**
1. Look for the install icon in the address bar
2. Click **Install**
3. Policy Bot opens as a standalone app

### Mobile Features

- **Swipe gestures** - Swipe to navigate between threads
- **Offline banner** - Shows when you're offline
- **Automatic reconnection** - Reconnects when network is available
- **Touch-friendly UI** - Optimized for touch interactions

### Offline Support

When offline:
- You can view cached messages and documents
- New messages are queued and sent when online
- An offline banner indicates connection status

---

## 10. Personalization

### Custom Accent Color

Personalize the interface with your preferred color:

1. Click your profile icon
2. Select **Settings**
3. Find **Accent Color**
4. Choose from preset colors or enter a custom hex code
5. The color is applied immediately
6. Your preference is saved across sessions

### Available Preset Colors

| Color | Hex |
|-------|-----|
| Blue | #3B82F6 |
| Green | #10B981 |
| Purple | #8B5CF6 |
| Orange | #F97316 |
| Pink | #EC4899 |
| Teal | #14B8A6 |

### Theme Settings

Depending on your organization's configuration:
- **Light Mode** - Default light theme
- **Dark Mode** - Eye-friendly dark theme
- **System** - Follows your device preference

---

## 11. Tips & Best Practices

### Asking Better Questions

**Do:**
- Be specific: "What is the maximum number of sick days per year?"
- Provide context: "For the procurement process, what approval is needed for purchases over $5000?"
- Reference documents: "According to the Employee Handbook, what are the dress code requirements?"

**Don't:**
- Ask vague questions: "Tell me about policies"
- Ask multiple unrelated questions at once
- Assume the AI knows about recent changes not in documents

### Getting Better Answers

1. **Start with broad questions** - Then drill down into specifics
2. **Use follow-up questions** - "Can you elaborate on that?"
3. **Ask for sources** - "Which document covers this?"
4. **Request formatting** - "List the steps" or "Create a table"

### When Web Search is Used

The AI automatically searches the web when:
- Information isn't in the documents
- You ask about current events
- You specifically request web information

You'll see `[WEB]` tags on web-sourced information.

### Understanding Limitations

The AI:
- Only knows what's in the documents
- Cannot access documents you're not subscribed to
- May not have the very latest policy updates
- Provides guidance, not legal or financial advice

---

## 12. Troubleshooting

### Common Issues

#### "No relevant documents found"

**Causes:**
- Question doesn't match document content
- You're not subscribed to the right category
- Documents haven't been uploaded yet

**Solutions:**
1. Try rephrasing your question
2. Check which categories you're subscribed to
3. Contact your Superuser about missing documents

#### "Connection lost"

**Causes:**
- Network connectivity issue
- Server maintenance

**Solutions:**
1. Check your internet connection
2. Wait a moment and refresh
3. Check for the offline banner

#### Voice input not working

**Causes:**
- Microphone permission denied
- Browser doesn't support Web Speech API
- Background noise

**Solutions:**
1. Check browser permissions for microphone
2. Try a different browser (Chrome recommended)
3. Move to a quieter location

#### Slow responses

**Causes:**
- Complex question requiring extensive search
- High server load
- Poor network connection

**Solutions:**
1. Wait for streaming to complete
2. Try simpler questions
3. Refresh and try again

### Getting Help

If you encounter issues:
1. Try the solutions above
2. Note any error messages
3. Contact your Superuser or Admin
4. Provide details about what you were trying to do

---

## 13. Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `/` | Focus search |
| `Esc` | Close modal |

### Message Input

| Button | Action |
|--------|--------|
| 📎 | Attach document |
| 🎤 | Voice input |
| ➤ | Send message |

### Thread Upload Limits

| Type | Limit |
|------|-------|
| Files per thread | 3 |
| Max file size | 5MB |
| Supported types | PDF |

### Response Indicators

| Indicator | Meaning |
|-----------|---------|
| Typing... | AI is generating response |
| [Source] | Document citation |
| [WEB] | Web search result |
| Score: X.XX | Source relevance (0-1) |

### Offline Status

| Indicator | Meaning |
|-----------|---------|
| 🟢 Online | Connected and ready |
| 🔴 Offline | No connection, using cache |
| 🟡 Reconnecting | Attempting to reconnect |

### Category Access

| Status | Meaning |
|--------|---------|
| Active | You can access documents |
| Inactive | Subscription paused |
| Not subscribed | No access (contact Admin) |

---

*Last updated: December 2024 (v1.0 - Initial user guide with streaming, PWA, accent colors)*
