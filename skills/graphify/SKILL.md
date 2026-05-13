---
name: graphify
description: "将代码、文档、论文转为可导航的知识图谱。支持社区检测、HTML 可视化、GraphRAG JSON 输出。"
trigger: /graphify
---

# /graphify

将任意文件夹转换为可导航的知识图谱，支持社区检测、审计追踪和三种输出格式：交互式 HTML、GraphRAG JSON 和 GRAPH_REPORT.md。

## Usage

```bash
/graphify                                             # 当前目录完整流程
/graphify <path>                                      # 指定路径
/graphify <path> --mode deep                          # 深度提取
/graphify <path> --update                             # 增量更新
/graphify <path> --wiki                               # 构建 agent 可爬取的 wiki
```

## What graphify is for

三件 AI 助手单独做不到的事：

1. **持久化图谱** — 关系存储在 `graphify-out/graph.json`，跨会话保留
2. **诚实审计** — 每条边标记 EXTRACTED / INFERRED / AMBIGUOUS
3. **跨文档发现** — 社区检测发现不同文件间的隐藏关联
