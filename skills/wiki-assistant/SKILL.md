---
name: wiki-assistant
description: "搜索、阅读和上传技术文档到 SkyPlatform Wiki。支持关键词搜索、全文阅读、Frontmatter 格式上传。"
trigger: /wiki-assistant
---

# SkyPlatform Wiki Assistant

搜索、阅读和上传技术文档到 SkyPlatform Wiki。

## Quick Reference

所有操作通过 `wiki.py` 脚本完成，无需手动 curl。

```bash
# 定位脚本（每会话执行一次）
WIKI_PY=$(find ~/.claude/skills -path "*/wiki-assistant/wiki.py" 2>/dev/null | head -1)
```

## 搜索文档

```bash
python "$WIKI_PY" search "<关键词>"
```

## 阅读文档

```bash
python "$WIKI_PY" read <slug>
```

## 上传文档

```bash
python "$WIKI_PY" upload <file.md>
```

上传文件需使用 YAML Frontmatter 格式：

```
---
title: 文档标题
slug: document-slug
category: 分类名称
tags: tag1,tag2
agent_summary: |
  供 AI 快速理解的结构化摘要
---

Markdown 正文...
```
