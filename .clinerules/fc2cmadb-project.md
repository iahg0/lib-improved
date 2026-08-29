---
paths:
  - "FC2CMADB-improved.js"
  - ".claude/skills/fc2cmadb-improved/**"
---

# FC2CMADB-improved 项目规则（Cline 常驻规则）

本规则适用于单文件 Tampermonkey 用户脚本 `FC2CMADB-improved.js`（增强 fc2cmadb.com）。

## 硬性规则（必须遵守）

1. **修改完必须递增版本号**：任何对 `FC2CMADB-improved.js` 的改动（含仅改注释/描述），提交前必须递增文件头部 `// @version` 字段（当前 `1.4.6`，采用 `主.次.修订`）。
   - 不 bump 版本号，Tampermonkey 不会触发更新检测，改动无法推送到已安装用户（历史 commit `563c914` 就是用 "Bump version" 触发更新的）。
   - commit message 应体现，如 `Bump version` / `Fix: ...`。
2. 保持脚本为**单文件、IIFE 包裹**（`(function() { 'use strict'; ... })()`），不要拆分。
3. 不引入未授权的新 `// @grant`；外部跨域请求（如 sukebei）必须走 `GM_xmlhttpRequest`。
4. 改完用 `node --check FC2CMADB-improved.js` 校验语法，并跑 `python tools/fc2_lint.py` 做回归检查（版本号/IIFE/授权/磁力判断/防重复去重/整卡包装/外部请求）。
5. **改动前先读 SKILL.md 的“易卡住的点”**，避免重复踩布局错位/重复卡片等坑；踩到新坑要回填到 SKILL。

## 项目关键信息（摘要）

- 站点：fc2cmadb.com（Laravel + Inertia + Livewire SPA，每页 30 条，分页 `?page=N`）。
- 卡片识别：`a[href*="/articles/"]` + `link.querySelector('img')`，包装元素为 `figure`（`.rounded-lg`）。
- 磁力判断统一用：`const s = seedCache.get(code); !!(s && s.magnet)`。
- 隐藏无磁力时：移除无磁力整卡、不请求其书签数；**不补页**（fillTo30 已移除，避免跨页重复/后续页被清空），各页独立稳定。
- 防重复：卡片锚点打 `data-fc2P` 标记。

## 完整架构文档

详细架构、站点反向工程结论、代码结构与辅助函数说明，见 skill 文件：
`.claude/skills/fc2cmadb-improved/SKILL.md`（改代码前先阅读它）。
