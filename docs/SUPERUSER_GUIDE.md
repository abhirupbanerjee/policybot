# Superuser Guide

This guide explains how to use the Superuser Dashboard to manage your assigned categories in Policy Bot.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Dashboard Tab](#2-dashboard-tab)
3. [Users Tab](#3-users-tab)
4. [Documents Tab](#4-documents-tab)
5. [Prompts Tab](#5-prompts-tab)
6. [Skills Tab](#6-skills-tab)
7. [Tools Tab](#7-tools-tab)
8. [Data Sources](#8-data-sources)
9. [Permissions Summary](#9-permissions-summary)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Introduction

### What is a Superuser?

A **Superuser** is a category-focused manager role in Policy Bot. Superusers can manage documents, users, and configurations for their **assigned categories** only. This role is ideal for department heads or team leads who need to manage their team's access to specific policy documents.

### Role Comparison

| Capability | User | Superuser | Admin |
|------------|------|-----------|-------|
| Chat with assistant | ✅ | ✅ | ✅ |
| Upload documents to threads | ✅ | ✅ | ✅ |
| Upload documents to categories | ❌ | ✅ (assigned only) | ✅ (all + global) |
| Manage user subscriptions | ❌ | ✅ (assigned only) | ✅ (all) |
| Configure data sources | ❌ | ✅ (assigned only) | ✅ (all) |
| Configure tools per category | ❌ | ✅ (assigned only) | ✅ (global + all) |
| Edit category prompts | ❌ | ✅ (assigned only) | ✅ (global + all) |
| Create/delete users | ❌ | ❌ | ✅ |
| Manage all categories | ❌ | ❌ | ✅ |
| System settings & backups | ❌ | ❌ | ✅ |

### How to Get Superuser Access

Superuser access is granted by an **Admin**:

1. Admin navigates to **Admin Dashboard → Users**
2. Admin creates or edits your user account
3. Admin sets your role to **Superuser**
4. Admin assigns specific categories to your account

Once assigned, you'll see the **Superuser** option in the navigation menu.

### Accessing the Superuser Dashboard

1. Log in to Policy Bot
2. Click your profile or the menu icon
3. Select **Superuser** from the navigation
4. Or navigate directly to `/superuser`

---

## 2. Dashboard Tab

The Dashboard tab provides an overview of your assigned categories and recent activity.

### Assigned Categories

At the top of the dashboard, you'll see orange badges displaying the categories assigned to you. These are the only categories you can manage.

```
Your Assigned Categories: [HR Policies] [Finance] [Operations]
```

### Statistics Cards

Three metric cards show key statistics:

| Card | Description |
|------|-------------|
| **Assigned Categories** | Number of categories you manage |
| **Total Documents** | Total documents across all your categories |
| **Total Subscribers** | Total active users subscribed to your categories |

### Category Breakdown Table

A detailed table shows per-category information:

| Column | Description |
|--------|-------------|
| **Category** | Category name |
| **Documents** | Number of documents in the category |
| **Ready** | Documents successfully processed |
| **Processing** | Documents currently being indexed |
| **Error** | Documents with processing errors |
| **Subscribers** | Number of active subscribers |
| **Custom Prompt** | Whether a category-specific prompt is configured |

### Recent Activity Widgets

Two widgets show recent activity:

- **Recent Documents** - Last 10 documents uploaded across your categories
- **Recent Subscriptions** - Last 10 subscription changes

### Refreshing Statistics

Click the **Refresh** button to update all statistics with the latest data.

---

## 3. Users Tab

The Users tab lets you manage which users have access to your assigned categories.

### Viewing Users

The Users tab displays all users subscribed to your assigned categories:

- **Email** - User's email address
- **Name** - User's display name
- **Subscriptions** - List of category subscriptions with status

### Adding Users to Categories

To give a user access to one of your categories:

1. Click **Add Subscription**
2. Enter the user's email address (must be an existing user)
3. Select the category from the dropdown
4. Click **Add**

> **Note:** You cannot create new user accounts. Ask an Admin to create the user first.

### Removing User Subscriptions

To remove a user's access to a category:

1. Find the user in the list
2. Locate the subscription you want to remove
3. Click the **Remove** (✕) button next to the subscription

### Understanding Subscription Status

| Status | Description |
|--------|-------------|
| **Active** | User can access documents in this category |
| **Inactive** | Subscription exists but access is disabled |

---

## 4. Documents Tab

The Documents tab is where you upload and manage documents for your assigned categories.

### Uploading Documents

Click the **Upload** button to open the upload modal. Four upload methods are available:

#### File Upload

Upload document files directly:

1. Select the **File** tab
2. Choose the target category from the dropdown
3. Drag and drop files or click to browse
4. Click **Upload**

**Supported file types:**
- PDF (`.pdf`)
- Microsoft Word (`.docx`)
- Microsoft Excel (`.xlsx`)
- Microsoft PowerPoint (`.pptx`)
- Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)

**Size limit:** 50MB per file

#### Text Content Upload

Paste text content directly (bypasses OCR processing):

1. Select the **Text** tab
2. Choose the target category
3. Enter a filename (e.g., `meeting-notes.txt`)
4. Paste or type your text content
5. Click **Upload**

**Size limit:** 10MB of text content

> **Tip:** Use text upload for content you've already extracted or written. It's faster because it skips OCR processing.

#### Web URL Ingestion

Ingest content from web pages:

1. Select the **Web** tab
2. Choose the target category
3. Enter up to 5 URLs (one per line)
4. Click **Ingest**

**Requirements:**
- Tavily API must be configured by Admin
- URLs must be publicly accessible

#### YouTube Transcript Extraction

Extract transcripts from YouTube videos:

1. Select the **YouTube** tab
2. Choose the target category
3. Enter the YouTube URL
4. Click **Extract**

**Requirements:**
- YouTube Transcript API must be configured
- Video must have available transcripts/captions

### Managing Documents

#### Document Status

Documents go through processing after upload:

| Status | Description |
|--------|-------------|
| **Processing** | Document is being chunked and indexed |
| **Ready** | Document is searchable in chat |
| **Error** | Processing failed (hover for details) |

#### Searching Documents

Use the search box to filter documents:
- Matches filename
- Matches category name
- Matches status

#### Sorting Documents

Click column headers to sort:
- Filename
- Size
- Status
- Upload date

#### Deleting Documents

You can only delete documents that you uploaded:

1. Find the document in the list
2. Click the **Delete** (🗑️) button
3. Confirm the deletion

> **Note:** You cannot delete documents uploaded by Admins or other Superusers.

### Upload Limits Summary

| Upload Type | Limit |
|-------------|-------|
| File size | 50MB per file |
| Text content | 10MB |
| Web URLs | 5 URLs per batch |
| YouTube | 1 video per request |

---

## 5. Prompts Tab

The Prompts tab lets you customize AI behavior for your assigned categories.

### Understanding Prompt Hierarchy

Prompts follow a hierarchy:

```
Global System Prompt (Admin-managed, read-only)
         ↓
Category-Specific Addendum (Superuser-editable)
         ↓
Final prompt sent to AI
```

The global prompt applies to all categories. Your category addendum is appended to customize behavior for your specific category.

### Viewing the Global Prompt

The global system prompt is displayed in read-only mode. This provides context for what the AI already knows before your category customizations.

### Editing Category-Specific Prompts

To customize the AI for your category:

1. Select a category from the dropdown
2. Edit the **Category Prompt Addendum** text area
3. Click **Save**

**Example addendum:**
```
When answering questions about HR policies:
- Always reference the employee handbook section numbers
- Include effective dates for policy changes
- Remind users to consult HR for specific situations
```

### Configuring Starter Prompts

Starter prompts are suggested questions shown to users when they start a new conversation:

1. Select a category
2. Edit the **Starter Prompts** section
3. Enter one prompt per line
4. Click **Save**

**Example starter prompts:**
```
What is the annual leave policy?
How do I submit an expense report?
What are the working hours?
```

### Using AI Prompt Optimization

Let AI help improve your prompts:

1. Write your initial prompt
2. Click **Optimize with AI**
3. Review the suggested improvements
4. Accept or modify the suggestions
5. Save the final version

### Resetting to Global Prompt

To remove category customizations and use only the global prompt:

1. Select the category
2. Click **Reset to Global**
3. Confirm the action

---

## 6. Skills Tab

The Skills tab shows AI skills configured for Policy Bot.

### What are Skills?

Skills are specialized behaviors that extend the AI assistant's capabilities. They inject custom instructions based on context or keywords.

### Skill Types

| Type | Description | Example |
|------|-------------|---------|
| **Always-on** | Active in every conversation | Memory recall, citation formatting |
| **Category-triggered** | Active when user is in specific categories | Department-specific procedures |
| **Keyword-triggered** | Active when user mentions specific words | "compliance" → regulatory guidelines |

### Viewing Skills

The Skills tab displays all available skills:
- Skill name and description
- Trigger type
- Associated categories (if category-triggered)
- Keywords (if keyword-triggered)

### Skills Management

> **Note:** Skills are managed by Admins only. Superusers have read-only access to view available skills.

If you need a new skill or changes to existing skills, contact your Admin.

---

## 7. Tools Tab

The Tools tab lets you configure AI tools for your assigned categories.

### Understanding Tool Inheritance

Tools follow a configuration hierarchy:

```
Global Tool Config (Admin-managed)
         ↓
Category Override (Superuser-editable)
         ↓
Effective config for users in category
```

If no category override is set, the global configuration applies.

### Available Tools

| Tool | Description |
|------|-------------|
| **Web Search** | Search the web for current information |
| **Document Generator** | Create PDF, DOCX, or Markdown documents |
| **Data Source Query** | Query configured APIs and CSV data |
| **Chart Generator** | Create visualizations from data |
| **Function APIs** | Call external APIs with structured schemas |

### Enabling/Disabling Tools per Category

To control tool availability for your category:

1. Select a category from the dropdown
2. Find the tool you want to configure
3. Toggle the **Enabled** switch:
   - **On** - Tool is available for this category
   - **Off** - Tool is disabled for this category
   - **Inherit** - Use global setting

### Configuring Tool Branding

Some tools support category-specific branding (e.g., Document Generator):

1. Select a category
2. Click **Configure Branding** for the tool
3. Set category-specific options:
   - Logo URL
   - Organization name
   - Primary color
   - Font family
4. Click **Save**

### Resetting to Global Defaults

To remove category overrides and use global settings:

1. Select the category
2. Click **Reset to Global** for the tool
3. Confirm the action

---

## 8. Data Sources

Data Sources allow the AI to query external APIs and CSV files to answer questions with real data.

### Accessing Data Sources

Data Sources may be accessed through the Tools tab or a dedicated Data Sources section, depending on your configuration.

### Creating an API Data Source

To connect an external API:

1. Click **Add Data Source** → **API**
2. Fill in the configuration:
   - **Name** - Display name (e.g., "Employee Directory API")
   - **Description** - What data this provides
   - **Endpoint URL** - Full API URL
   - **Method** - GET or POST
   - **Response Format** - JSON or CSV
3. Configure authentication (if required):
   - None
   - API Key (header or query parameter)
   - Bearer Token
   - Basic Auth
4. Define parameters the AI can use
5. Map the response structure
6. Select categories that can access this source
7. Click **Save**

### Uploading a CSV Data Source

To make CSV data queryable:

1. Click **Add Data Source** → **CSV**
2. Upload your CSV file
3. Review auto-detected columns and types
4. Add descriptions for each column
5. Select categories that can access this source
6. Click **Save**

### Testing Data Source Connections

Before saving, test your data source:

1. Click **Test Connection**
2. Review the test results:
   - Connection status
   - Sample data returned
   - Response time
3. Fix any errors before saving

### Configuring Authentication

| Auth Type | Configuration |
|-----------|---------------|
| **None** | No authentication required |
| **API Key** | Key value, header name, location (header/query) |
| **Bearer** | Token value |
| **Basic** | Username and password |

> **Security Note:** Credentials are encrypted in storage and never displayed after saving.

### Parsing OpenAPI Specifications

To auto-configure from an OpenAPI/Swagger spec:

1. Click **Import OpenAPI**
2. Paste the OpenAPI JSON/YAML
3. Review the parsed configuration
4. Adjust as needed
5. Save the data source

### Editing and Deleting Data Sources

- **Edit** - Click the data source name to modify configuration
- **Delete** - Click the delete button (only for sources you created)

---

## 9. Permissions Summary

### What Superusers CAN Do

✅ **Documents**
- Upload files, text, web URLs, and YouTube videos to assigned categories
- View all documents in assigned categories
- Delete documents you uploaded
- Monitor document processing status

✅ **Users**
- View users subscribed to assigned categories
- Add existing users to your categories
- Remove user subscriptions from your categories

✅ **Data Sources**
- Create API and CSV data sources for assigned categories
- Edit data source configurations
- Delete data sources you created
- Test data source connections

✅ **Tools**
- Enable/disable tools per category
- Configure tool branding per category
- Reset tool config to global defaults

✅ **Prompts**
- Edit category-specific prompt addendums
- Configure starter prompts
- Use AI prompt optimization
- Reset to global prompt

✅ **Skills**
- View all available skills (read-only)

### What Superusers CANNOT Do

❌ **Global Operations**
- Upload documents to global scope
- Create global data sources
- Modify global tool configuration
- Modify global system prompt

❌ **Cross-Category Access**
- Access categories not assigned to you
- Manage documents in other categories
- Configure tools for unassigned categories

❌ **User Management**
- Create new user accounts
- Delete user accounts
- Change user roles
- Manage other Superusers or Admins

❌ **System Administration**
- Perform backups/restores
- Access system settings
- View all users across all categories
- Configure reranker or LLM settings
- Create or manage skills

---

## 10. Troubleshooting

### Common Errors

#### "You don't have access to this category"

**Cause:** You're trying to access a category not assigned to you.

**Solution:** Contact an Admin to assign the category to your account.

#### "User not found"

**Cause:** Trying to add a subscription for a user that doesn't exist.

**Solution:** Ask an Admin to create the user account first.

#### "Already subscribed"

**Cause:** User already has a subscription to this category.

**Solution:** No action needed. The subscription already exists.

#### "Cannot delete this document"

**Cause:** You're trying to delete a document uploaded by someone else.

**Solution:** Only the original uploader or an Admin can delete the document.

### Document Processing Issues

#### Document stuck in "Processing"

**Possible causes:**
- Large file taking time to process
- System queue backlog
- Processing error

**Solutions:**
1. Wait a few minutes and refresh
2. Check if other recent uploads are processing
3. If stuck for over 30 minutes, contact Admin

#### Document shows "Error" status

**Possible causes:**
- Unsupported file format
- Corrupted file
- OCR failure for scanned documents

**Solutions:**
1. Hover over the error status for details
2. Try re-uploading the file
3. For scanned PDFs, try text upload instead
4. Contact Admin if issue persists

#### Web URL ingestion failed

**Possible causes:**
- URL not accessible
- Tavily API not configured
- Website blocks scraping

**Solutions:**
1. Verify URL is publicly accessible
2. Check if Tavily is enabled (Admin setting)
3. Try a different URL format
4. Use text upload as alternative

#### YouTube transcript extraction failed

**Possible causes:**
- Video has no captions/transcripts
- YouTube API not configured
- Video is private or restricted

**Solutions:**
1. Verify video has captions (CC icon on YouTube)
2. Check if YouTube tool is enabled
3. Try a different video
4. Contact Admin about API configuration

### Access Denied Errors

#### "Forbidden" or 403 Error

**Possible causes:**
- Session expired
- Role changed
- Category assignment removed

**Solutions:**
1. Log out and log back in
2. Verify you still have Superuser role
3. Check if category is still assigned
4. Contact Admin if issues persist

### Getting Help

If you encounter issues not covered here:

1. Note the exact error message
2. Note what action you were performing
3. Contact your Admin with these details

---

## Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search box |
| `Esc` | Close modal |

### Upload Limits

| Type | Limit |
|------|-------|
| File upload | 50MB |
| Text content | 10MB |
| Web URLs | 5 per batch |
| YouTube | 1 per request |

### Supported File Types

- PDF (`.pdf`)
- Word (`.docx`)
- Excel (`.xlsx`)
- PowerPoint (`.pptx`)
- Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)

### Status Icons

| Icon | Meaning |
|------|---------|
| 🟢 | Ready/Active |
| 🟡 | Processing |
| 🔴 | Error/Inactive |
| ⚙️ | Configurable |
| 🔒 | Read-only |

---

*Last updated: December 2024*
