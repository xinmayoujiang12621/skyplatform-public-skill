# SkyPlatform Wiki Assistant Skill

A [Claude Code](https://claude.ai/code) skill that allows AI agents to search, read, and upload technical documents to the SkyPlatform Wiki.

## Installation

### Option 1: Per-project installation

1. Copy the `skills/wiki-assistant/` directory into your project:

```bash
cp -r skills/wiki-assistant/ /path/to/your/project/.claude/skills/wiki-assistant/
```

2. Set the wiki API URL:

```bash
export WIKI_API_URL=http://your-wiki-host:8000
```

### Option 2: Global installation

1. Copy the skill to your global Claude skills directory:

```bash
cp -r skills/wiki-assistant/ ~/.claude/skills/wiki-assistant/
```

### Option 3: Add to CLAUDE.md

Add a reference in your project's `CLAUDE.md`:

```markdown
## Wiki Access
- Use the `wiki-assistant` skill to search, read, or upload internal documentation
- Wiki API is available at: http://your-wiki-host:8000
```

## Usage

The skill automatically triggers when:
- You ask Claude to "check the wiki" or "search wiki for X"
- You ask to "upload to wiki" or "create a wiki article"
- The task involves integrations, deployment, or procedures that might be documented
- Keywords like "SSO", "integration guide", "deployment guide" appear in the conversation

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/articles/search?q=<keyword>` | Public | Search articles by keyword |
| `GET /api/articles/<slug>` | Public | Get full article content |
| `GET /api/categories/tree` | Public | Browse category structure |
| `GET /api/articles` | Public | List all articles |
| `POST /api/articles` | Admin | Create article |
| `PUT /api/articles/<id>` | Admin | Update article |
| `POST /api/categories` | Admin | Create category |
