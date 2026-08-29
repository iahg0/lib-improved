---
name: fc2cmadb-improved
description: 当需要修改、维护或审查 FC2CMADB-improved.js（一个针对 fc2cmadb.com 的 Tampermonkey 用户脚本）时使用。它包含该项目的架构知识、站点反向工程结论、代码约定与必须遵守的修改规则。
---

# FC2CMADB-improved 项目 Skill

本 skill 服务于单个文件项目 `FC2CMADB-improved.js`（仓库根目录）。这是一个 Tampermonkey 用户脚本，增强 fc2cmadb.com 浏览体验。

## 硬性规则（必须遵守）

1. **修改完必须递增版本号**：任何对 `FC2CMADB-improved.js` 的改动（包括仅改注释/描述），提交前必须递增文件头部 `// @version` 字段（以文件头部 `// @version` 为准，当前 `1.4.1`，采用 `主.次.修订` 语义）。
   - 没有版本号变更，Tampermonkey 不会触发更新检测，改动不会推送到已安装用户。
   - 历史上就是用 "Bump version" 来触发 Tampermonkey 更新（见 git log `563c914`）。
2. 保持脚本为**单文件、IIFE 包裹**（`(function() { 'use strict'; ... })()`），不要拆分。
3. 不要在脚本中引入未授权的新 `// @grant`；外部跨域请求（如 sukebei）必须走 `GM_xmlhttpRequest`。
4. 保持代码注释与原有中英文混排风格，关键逻辑保留注释。

## 项目概要

- 名称：FC2CMADB-improved（@name）
- 作者：Awei；描述：参考 Duckee KememChan 的 fc2 脚本用 AI 重构（精简版）
- 匹配：`*://fc2cmadb.com/*`
- 授权：`GM_addStyle`、`GM_xmlhttpRequest`
- 更新源：GitHub raw `https://raw.githubusercontent.com/iahg0/lib-improved/master/FC2CMADB-improved.js`（@downloadURL / @updateURL 保持一致）
- 发布：sleazyfork 脚本 583333

## 站点反向工程结论（关键）

fc2cmadb.com 是 **Laravel + Inertia + Livewire** 的 SPA：

- **数据挂载**：页面里 `<script data-page="app" type="application/json">{...}</script>` 存有 Inertia 初始数据，含 `component`、`version`、`url` 字段。列表数据（`articles`）是 **deferred prop**，不在初始 HTML 里，需要单独按需拉取。
- **分页**：每页 30 条；分页参数是查询串 `?page=N`。列表路由如 `articles/latest`、`articles/ranking`、`articles/bookmark-ranking`、`articles/sale/{percentage}`。
- **拉取某页数据（fetchPageData 已封装）**：对当前列表 URL 带 `?page=N` 发起请求，并带请求头：
  - `X-Inertia: true`
  - `X-Inertia-Version: <页面 data-page JSON 里的 version>`
  - `X-Inertia-Partial-Component: <component>`
  - `X-Inertia-Partial-Data: articles`
  返回 JSON：`{ props: { articles: { data: [...], last_page, current_page, per_page, total } } }`。每条 `data` 项含 `video_id`、`title`、`image_url`、`writer`、`actresses` 等。**缺少版本头会返回 409**。
  - **列表 `articles.data` 项不含 `bookmark_count`**（实测确认）！要拿书签数必须逐张打详情页。列表项字段：`title, video_id, image_url, censored, uncensored_image, not_found, status, sale_percentage, sale_limite_date, writer_id, writer, actresses`。
  - 详情页 data-page JSON 里 `bookmark_count` 是**普通引号** `"bookmark_count":N`，脚本正则 `/"bookmark_count"\s*:\s*(\d+)/` 可命中。
- **卡片 DOM 结构**（站点渲染）：
  - 列表容器：`div.flex.flex-wrap.bg-base-100.p-2`
  - 卡片：`div.card bg-base-100 ... p-2 card-sm ...`，内含 `figure.relative.h-48.bg-base-200.rounded-lg`
  - figure 内有 `a.block.rounded.overflow-hidden`（href=`/articles/{video_id}`）包着 `<img>`；以及显示 video_id 的 `<span>`。
  - 脚本通过 `a[href*="/articles/"]` + `link.querySelector('img')` 识别卡片，`figure`（`.rounded-lg`）就是被包装的卡片元素。

## 代码结构与约定

### 持久化缓存
- `store`（localStorage 包装，含 TTL）+ `makeCache(key, ttl)` 生成 `{has,get,set}` 缓存。
- `seedCache`（sukebei 磁力，TTL 12h）、`bookmarkCache`（书签数，TTL 6h）、`baihuseCache`（内存 Map）。
- **刷新不会重复请求已缓存编号**：`bookmarkCache` 存 localStorage + 6h TTL，脚本加载即读回；`bookmarkBatch` 里 `if (bookmarkCache.has(c)) continue` 跳过已缓存编号。只有首次访问 / 缓存过期(>6h) / 上次请求失败(如 429 未写缓存) 才会重新请求。

### 节流与 429 退避
- 站点限流实测约 **5.5 req/s** 连续请求不 429（原"3次/短窗口"认知偏保守）。`throttle(self, task)` 自带间隔（本站 900ms+随机、外部 600ms+随机）与 429 退避（`backoff()` 暂停 60s，弹出 toast），供 sukebei/baihuse 等单路请求用。
- **书签数改用独立的令牌桶并发限流**（不经过 `throttle`）：
  - `BM_RATE=4`（令牌/秒）、`BM_BURST=4`（突发容量）、`BM_CONCURRENCY=4`（最大在途）。
  - `bmAcquire()`（限流 + 并发门控 + 429 退避）/ `bmRelease()`（释放在途计数）包裹每次详情页 fetch。
  - 实测并发 4 时速率约 4.5 req/s，30 张书签从原 ~30s（串行 900ms 节流）降到 ~8-12s。

### API 模块（`API` 对象）
- `API.sukebei(input)`：批量查询磁力（外部 sukebei.nyaa.si，走 GM_xmlhttpRequest），写入 seedCache；无磁力的写 `null`。**磁力判断统一为：`const s = seedCache.get(code); !!(s && s.magnet)`**。
- `API.baihuse(code)`：拉取预览图/视频（仅详情页用）。
- `API.bookmark(code)` / `API.bookmarkBatch(codes)`：打本站详情页取 `bookmark_count`。**并发拉取**：`bookmarkBatch` 先过滤未缓存编号，再 `Promise.all` 并发调用 `bookmark`，每个经 `bmAcquire/bmRelease` 令牌桶限流；命中 429 由 `backoff()` 统一暂停 60s。

### 开关（localStorage）
- `hideNoMagnet`：`fc2-hide-no-magnet`（隐藏无磁力项目，默认 false）
- `bookmarkEnabled`：`fc2-bookmark-enabled`（默认 true）
- `sortByBookmark`：`fc2-sort-by-bookmark`（按书签数排序，默认 false）
- 三者经 `makeToggle()` 生成悬浮开关按钮，持久化到 localStorage。

### 渲染（`App` 对象）
- `renderList()`：列表页增强。流程 = 扫描卡片 → `API.sukebei` 预查磁力 →（若 `hideNoMagnet` 则移除无磁力整卡并调用 `fillTo30` 分页填充）→ 为保留卡片包装 `fc2-custom-card-wrapper` + 按钮行 → 填磁力/书签信息 → 仅对有磁力项目 `bookmarkBatch`。
- `renderDetail()`：详情页增强（MissAV/Njav/Sukebei 磁力按钮 + 预览图/视频 lightbox）。
- `init()`：初始化开关 + 调用 renderList / renderDetail。
- SPA 监听：`MutationObserver` 在 URL 变化时 800ms 后 `App.init()`，否则 200ms 防抖 `App.renderList()`。

### 关键辅助函数（新增功能不要破坏这些）
- `inertiaMeta()`：读取 data-page JSON 的 component/version/url。
- `fetchPageData(meta, page)`：Inertia 拉取指定页 articles。
- `fillTo30(keep, container)`：有磁力项目不足 30 时自动逐页拉取并注入有磁力卡片（隐藏模式才生效）。
- `injectCard(container, item)`：按站点卡片结构注入新卡片，并给 img 父元素打 `data-fc2P` 标记避免重复包装。
- `findListContainer(firstFigure)`：定位列表 flex-wrap 容器。
- `wrapCardRow(card, code)`：创建/复用增强按钮行。
- `applyMagnetFilter()`：对 `.fc2-custom-card-wrapper` 按 `data-fc2HasMagnet` 显示/隐藏。
- `sortCards()` / `findGridContainer()`：按书签数排序（依赖 grid 容器，flex 布局下为 fallback）。
- 防重复标记：卡片锚点 `data-fc2P`（被包装后再次 renderList 会跳过）。

## 站点请求探查工具

仓库内置 `tools/fc2_probe.py`（Python + requests），用于反向确认站点结构 / 验证数据，**避免每次临时写 ps1 或手工 curl**。一次性初始化：

```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

常用子命令（默认列表页为 `articles/latest`，未带 `https://` 会自动补齐）：

```
.venv\Scripts\python tools\fc2_probe.py meta                    # component/version/url
.venv\Scripts\python tools\fc2_probe.py articles [url] [page]   # Inertia partial 拉某页
.venv\Scripts\python tools\fc2_probe.py fields  [url] [page]    # 某页首条字段名
.venv\Scripts\python tools\fc2_probe.py detail  <code> ...      # 详情页 bookmark_count
.venv\Scripts\python tools\fc2_probe.py rate    <code> ...      # 限流探测(连续请求状态码)
```

也支持 `import fc2_probe` 复用 `get_page_meta` / `fetch_articles` / `fetch_detail`。

## 修改流程建议

1. 明确要改的功能，先读 `FC2CMADB-improved.js` 全文理解现状。
2. 若涉及站点 DOM / 分页，先反向确认站点结构（可抓取 `<script data-page="app">` 与 Inertia partial 请求验证）。
   - **直接跑 `tools/fc2_probe.py` 探查**（见"站点请求探查工具"），不要临时写 ps1。
   - 排查坑提醒：PowerShell `ConvertFrom-Json` 会被 Inertia JSON 里 language 字典的重复 key（`Delete Account` / `Delete account`）抛 `DuplicateKeysInJsonString` 卡死；`Invoke-WebRequest` 发 `X-Inertia-*` 自定义头不可靠（partial 会退化成返回全量 props）。用 Python 工具或 `curl.exe`。
3. 改动遵循上述约定，保持单文件。
4. 用 `node --check FC2CMADB-improved.js` 校验语法。
5. **递增 `// @version` 版本号**，并在 commit message 中体现（如 "Bump version" / "Fix: ..."）。
