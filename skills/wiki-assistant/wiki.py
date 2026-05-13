"""SkyPlatform Wiki CLI — used by the wiki-assistant skill."""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Force UTF-8 on stdout/stderr — Windows terminals default to system encoding (e.g. GBK)
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config.json"

HELP = """\
Usage: python wiki.py <command> [args]

Commands:
  search <keyword>           Search articles
  read <slug>                Read article by slug
  brief <slug>               Read agent summary only
  categories                 List category tree
  list                       List all articles
  upload <file.md>           Upload/overwrite article from markdown file
  patch <slug> <file.json>   Partial update article fields from JSON file
  set-summary <slug> <text>  Update agent_summary only (text or @file)
  inline <file.md>           Print frontmatter + body for upsert (debugging)

Config (config.json):
  {
    "api_url": "http://localhost:8000",
    "token": "<permanent API token>"
  }

  If "token" is not set, falls back to "username"/"password" login.
  Generate a permanent token: POST /api/auth/api-token (requires admin login).

Upload markdown format:
  ---
  title: Article Title
  slug: url-slug
  category: Category Name
  tags: tag1, tag2
  agent_summary: |
    Structured summary for AI agents:
    ## Overview
    ...
    ## Integration Steps
    ...
  ---

  Article content...

Patch JSON format (file.json):
  {"title": "New Title", "agent_summary": "New summary", "tags": "t1,t2"}
  Only include fields you want to change.

set-summary:
  python wiki.py set-summary my-slug "Summary text here"
  python wiki.py set-summary my-slug @summary.txt
  Prefix with @ to read from a file.
"""


def load_config():
    if not CONFIG_PATH.exists():
        sys.exit(f"Config not found: {CONFIG_PATH}")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def api_request(path, method="GET", body=None, token=None, content_type="application/json"):
    config = load_config()
    base = config["api_url"].rstrip("/")
    url = f"{base}{path}"

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = body.encode("utf-8") if isinstance(body, str) else json.dumps(body).encode("utf-8")
        headers["Content-Type"] = content_type
    else:
        data = None

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        sys.exit(f"HTTP {e.code}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"Connection error: {e.reason}")


def get_token():
    """Return token from config, or obtain one via login."""
    config = load_config()
    if config.get("token"):
        return config["token"]
    if not config.get("username") or not config.get("password"):
        sys.exit('Config must contain "token" or "username"+"password".')
    return api_request(
        "/api/auth/login",
        method="POST",
        body={"username": config["username"], "password": config["password"]},
    )["access_token"]


def cmd_search(args):
    if not args:
        sys.exit("Usage: wiki.py search <keyword>")
    result = api_request(f"/api/articles/search?q={urllib.parse.quote(args[0])}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_read(args):
    if not args:
        sys.exit("Usage: wiki.py read <slug>")
    result = api_request(f"/api/articles/{args[0]}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_brief(args):
    if not args:
        sys.exit("Usage: wiki.py brief <slug>")
    result = api_request(f"/api/articles/{args[0]}/brief")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_categories(_args):
    result = api_request("/api/categories/tree")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_list(_args):
    result = api_request("/api/articles")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def _get_article_by_slug(slug, token=None):
    """Fetch article detail by slug; exit on failure."""
    try:
        return api_request(f"/api/articles/{slug}", token=token)
    except SystemExit:
        # Re-raise with clearer context
        raise SystemExit(f"Article not found: {slug}")


def cmd_upload(args):
    if not args:
        sys.exit("Usage: wiki.py upload <file.md>")
    filepath = Path(args[0])
    if not filepath.exists():
        sys.exit(f"File not found: {filepath}")
    content = filepath.read_text(encoding="utf-8")
    token = get_token()
    result = api_request("/api/articles/upsert", method="PUT", body=content, token=token, content_type="text/markdown")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_patch(args):
    """Partial update: patch <slug> <file.json>"""
    if len(args) < 2:
        sys.exit("Usage: wiki.py patch <slug> <file.json>")
    slug, json_path = args[0], Path(args[1])
    if not json_path.exists():
        sys.exit(f"File not found: {json_path}")
    token = get_token()
    article = _get_article_by_slug(slug, token=token)
    article_id = article["id"]
    patch_body = json.loads(json_path.read_text(encoding="utf-8"))
    result = api_request(f"/api/articles/{article_id}", method="PUT", body=patch_body, token=token)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_set_summary(args):
    """Update agent_summary only: set-summary <slug> <text_or_@file>"""
    if len(args) < 2:
        sys.exit("Usage: wiki.py set-summary <slug> <text | @file>")
    slug = args[0]
    raw = args[1]
    if raw.startswith("@"):
        filepath = Path(raw[1:])
        if not filepath.exists():
            sys.exit(f"File not found: {filepath}")
        summary = filepath.read_text(encoding="utf-8")
    else:
        summary = raw
    token = get_token()
    article = _get_article_by_slug(slug, token=token)
    article_id = article["id"]
    result = api_request(f"/api/articles/{article_id}", method="PUT", body={"agent_summary": summary}, token=token)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_inline(args):
    if not args:
        sys.exit("Usage: wiki.py inline <file.md>")
    filepath = Path(args[0])
    if not filepath.exists():
        sys.exit(f"File not found: {filepath}")
    print(filepath.read_text(encoding="utf-8"))


COMMANDS = {
    "search": cmd_search,
    "read": cmd_read,
    "brief": cmd_brief,
    "categories": cmd_categories,
    "list": cmd_list,
    "upload": cmd_upload,
    "patch": cmd_patch,
    "set-summary": cmd_set_summary,
    "inline": cmd_inline,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print(HELP)
        sys.exit(0)
    cmd = sys.argv[1]
    if cmd not in COMMANDS:
        sys.exit(f"Unknown command: {cmd}\n{HELP}")
    COMMANDS[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
