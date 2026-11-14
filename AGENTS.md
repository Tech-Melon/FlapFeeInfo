# Agent 入口

本仓库的开发约定、架构与部署说明见 **[CLAUDE.md](./CLAUDE.md)**。

后续改代码前请先阅读该文档，尤其是：

- 系统架构（第 2 节：extension / cloudflare / server 三层、插件内部数据流、请求退避）
- 目录结构与脚本放置约定（第 3 节：长期工具放 `tools/`，一次性 `_run_*.py` 用完归档到 `_archive/`）
- Token 尾号与税收分配字段
- 公开 Git 只放行 `extension/` + 文档
- 部署顺序与验收样本
- **计划收费**：见根目录 [`ENABLE_FLAP_MONETIZATION.md`](./ENABLE_FLAP_MONETIZATION.md)
