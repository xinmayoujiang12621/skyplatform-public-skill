---
name: wiki-assistant
description: "搜索、阅读和上传技术文档到 SkyPlatform Wiki。支持关键词搜索、全文阅读、Frontmatter 格式上传。"
trigger: /wiki-assistant
  - "create wiki article"
  - "update wiki article"
  - "add to wiki"
  - "write to wiki"
  - "sync wiki"
  - "publish to wiki"
  - "SSO"
  - "integration guide"
  - "deployment guide"
  - "component spec"
---

# SkyPlatform Wiki

Search, read, and manage technical documents on the SkyPlatform Wiki.

## Quick Reference

All operations go through `wiki.py` (located alongside this skill file). One command per action, no curl needed.

```bash
# Locate the script (do this once per session)
WIKI_PY=$(find ~/.claude/skills -path "*/wiki-assistant/wiki.py" 2>/dev/null | head -1)
```

---

## Reading

### Search articles

```bash
python "$WIKI_PY" search "<KEYWORD>"
```

Try multiple keywords if the first returns nothing. Broad first, then narrow.

### Read full article

```bash
python "$WIKI_PY" read "<SLUG>"
```

The `content` field is full Markdown.

### Read agent summary (recommended for AI agents)

```bash
python "$WIKI_PY" brief "<SLUG>"
```

Returns only the structured `agent_summary` — a concise, machine-oriented digest of what the article covers, how to integrate, and what to change. **Always try `brief` first** before reading the full article. If the article has no summary, fall back to `read`.

### Browse category tree

```bash
python "$WIKI_PY" categories
```

### List all articles

```bash
python "$WIKI_PY" list
```

---

## Writing

### Upload / Upsert an article (Recommended)

This is the preferred way to create or update articles. Write a Markdown file with YAML frontmatter — the server creates the article if the slug doesn't exist, or updates it if it does. Authentication is handled automatically via the permanent token in config.

**Step 1:** Write the markdown file locally.

**Frontmatter format:**

```markdown
---
title: Article Title
slug: url-slug
category: Category Name
tags: tag1, tag2
---

# Article content starts here

Markdown body...
```

**Frontmatter fields:**
- `title` (required) — article title
- `slug` (required) — unique URL slug
- `category` (optional) — category name; auto-created if not found
- `tags` (optional) — comma-separated string or YAML list
- `agent_summary` (optional) — structured summary for AI agents (multi-line YAML string)

**agent_summary recommended template:**

```yaml
agent_summary: |
  ## Overview
  One-line description of what this service/component does.

  ## Integration Steps
  1. Step one
  2. Step two

  ## Required Configuration
  - ENV_VAR: description

  ## Key Interfaces
  - METHOD /path — description
```

This summary is optimized for AI agents to quickly understand the integration approach without reading the full human-oriented article.

**Step 2:** Upload it.

```bash
python "$WIKI_PY" upload path/to/document.md
```

One command. No token management, no JSON escaping.

---

## Configuration

`config.json` sits alongside `wiki.py`. Use a permanent API token — no login needed on each call.

```json
{
  "api_url": "http://localhost:8000",
  "token": "<your-permanent-api-token>"
}
```

**How to get a permanent token:**

1. Login to the wiki admin panel
2. Call `POST /api/auth/api-token` with your admin JWT to get a 10-year token
3. Paste it into `config.json` as `"token"`

Or from command line:
```bash
# Login first
JWT=$(curl -s -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get permanent token
curl -s -X POST "http://localhost:8000/api/auth/api-token" \
  -H "Authorization: Bearer $JWT" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
```

If you get auth errors, ask the user to check `config.json`.

---

## When to use this skill

**Reading:**
- **Always try `brief` first** when you need to understand how to integrate with a service — it returns a concise, structured summary
- If `brief` returns "未设置 Agent 摘要", fall back to `read` for the full article
- Before implementing an integration — check if a guide exists
- When the user mentions a technology with possible internal docs
- When looking for deployment procedures or environment configs

**Writing:**
- When the user asks to save/publish documentation to the wiki
- When completing a task that should be documented for future reference
- When the user says "add this to the wiki" or "create a wiki article"

## Encoding Rules

**All operations MUST use UTF-8 encoding.** This is non-negotiable:

- **Writing files**: When generating the markdown file to upload, always write with UTF-8 encoding. In Python: `open(path, 'w', encoding='utf-8')`. Never use the system default encoding.
- **Reading files**: Always read with UTF-8. In Python: `open(path, 'r', encoding='utf-8')`.
- **Running the script**: `wiki.py` handles UTF-8 internally. Do not pipe through tools that may re-encode output.
- **Bash heredocs / printf**: Avoid using bash to write file content directly — the shell encoding is unreliable on Windows. Write content via Python instead:
  ```python
  from pathlib import Path
  Path("doc.md").write_text(content, encoding="utf-8")
  ```

If uploaded content shows garbled Chinese characters, the file was not written in UTF-8.

---

## Guidelines

- Always search before assuming no documentation exists
- When creating articles, use descriptive slugs (e.g. `sso-integration-guide`)
- Pick an existing category when possible; browse the tree first
- Present wiki content as reference material, not absolute instructions
- If wiki content conflicts with user requirements, ask the user which to follow

## Core Principle: Agent Summary First

Wiki articles are written for humans — they contain context, explanations, and examples. When an AI agent needs to understand a service's integration approach, reading the full article is inefficient. The `agent_summary` field solves this:

**Reading: `brief` before `read`.**

1. Search to find the relevant article slug
2. **Always call `brief <slug>` first** — it returns only the structured summary
3. If the article has an `agent_summary`, you get the integration steps, config, and key interfaces immediately — no need to read the full article
4. Only call `read <slug>` when the summary is missing or you need implementation details

**Writing: always include `agent_summary`.**

When uploading an article, **always include an `agent_summary` in the frontmatter**, even if the article content is long. This ensures future agents can quickly consume the document. Use the recommended template:

```yaml
agent_summary: |
  ## Overview
  One-line description of what this service/component does.
  ## Integration Steps
  1. Step one
  2. Step two
  ## Required Configuration
  - ENV_VAR: description
  ## Key Interfaces
  - METHOD /path — description
```

The summary should be **concise and actionable** — focus on what another agent needs to do, not why. Skip background, context, and explanations. Just the steps, config, and interfaces.
