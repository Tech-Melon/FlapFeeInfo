# FlapFeeInfo — 开发文档（给 Agent / 后续开发者）

> 项目名：技术瓜FlapFeeInfo  
> 公开仓库：https://github.com/Tech-Melon/FlapFeeInfo（默认 **只发布插件** `extension/`）  
> 本地工作区：含后端、CF Worker、插件三层全栈代码  

本文档面向 **Agent 与开发者**，说明架构、约定与改动入口。用户安装说明见根目录 `README.md`。

---

## 1. 项目目标

在 **GMGN / Debot / Gungnir** 等 meme 列表页上，给 BSC 上 Flap 税收代币（地址尾号 **`8888` 或 `7777`**）展示 **税收分配徽章**，并尽量附带 **底池/报价** 文字。

| 展示 | 含义 | 数据来源 |
|------|------|----------|
| 💎`N%` | 持有人分红 | 链上 `dividendBps` |
| 👨‍🍳`N%` | 创作者/营销（非 vault） | `marketBps` 且 `!isVault` |
| 🎁`N%` | vault gift（含币股等金库） | `marketBps` 且 `isVault` |
| 🔥`N%` | 销毁 | `deflationBps` |
| 💧`N%` | 回流 LP | `lpBps` |
| ❓️未 | 无有效分配 | 全 0 |
| 🪙`QUOTE` | 底池报价符号（BNB / USD1 / NVDAB…） | **页面 DOM**（不查链） |

- **有值才出**；多项非零 → `mode=hybrid`，fee 段**按 bps 从高到低**（最高在左），如 `💎90%→SPCXB👨‍🍳10%`  
- **合成徽章**（有报价时）：`🪙QUOTE | fee`，如 `🪙BNB | 💎90%`、`🪙USD1 | 💎100%`（`|` 两侧有空格）  
- **买卖税率**只进 tooltip（`title`），不进主文案  
- **不隐藏**站点原有底池小图标  
- Flap 官网：`8888` → `/feeinfo`，`7777` → `/taxinfo`；查询合约 **同一 Helper**

---

## 2. 三层架构

```text
浏览器插件 extension
    POST /modes  { tokens: string[] }
        ↓
Cloudflare Worker  (https://flap-fee-info.tech-melon.workers.dev)
    内存 L1 → KV L2 → 未命中回源
        ↓  Bearer + POST /modes
VPS Nginx  (https://flap.jishugua.top)
        ↓
Python API  (127.0.0.1:8765)
    内存 LRU → SQLite 30 天 → 并发链上查询
        ↓
BSC RPC / QuickNode
    Helper.getTaxTokenInfoV2(taxToken)
```

| 层 | 目录 | 职责 | 禁止 |
|----|------|------|------|
| 插件 | `extension/` | 扫卡、抽地址、底池 quote 文案、批量请求、画徽章、chrome.storage | 不直连 VPS、不查链 |
| Worker | `cloudflare/` | 公网入口、CORS、缓存、鉴权回源 | 不算 mode |
| 后端 | `server/` | 校验 token、限流 RPC、分类、持久化 | 不碰 DOM |

运维脚本：`tools/ctl.py`（ssh 默认 `hk0`，远端 `/root/workspace/FlapFeeInfo/server`）。

---

## 3. 目录结构

```text
FlapFeeInfo/
├── CLAUDE.md                 # 本文件（开发约定）
├── README.md                 # 用户向：插件安装
├── .gitignore                # 公开仓默认只放行 extension + README + CLAUDE.md
├── extension/                # ★ 浏览器插件（公开）
│   ├── manifest.json         # MV3，当前版本见 name 旁 version
│   ├── content.js            # 站点策略 + 扫卡 + 渲染
│   ├── style.css
│   └── icons/
├── cloudflare/               # CF Worker（本地全栈，默认不进公开 git）
│   ├── worker.js
│   ├── wrangler.jsonc
│   └── README.md
├── server/                   # Python API（本地全栈）
│   ├── fee_mode.py           # 链上分配 + label
│   ├── fee_mode_server.py    # HTTP + 缓存
│   ├── env_loader.py
│   ├── pyproject.toml        # uv；入口 flap-fee-server
│   ├── fee_mode_cache.sqlite3
│   ├── flap-fee-info.service
│   ├── deploy-hk0.md
│   └── nginx-*.conf
├── tools/
│   └── ctl.py                # status/deploy/test/logs...
├── dist/                     # 打包 zip（忽略）
└── _run_*.py                 # 临时命令封装（忽略）
```

---

## 4. 关键实现约定

### 4.1 Token 过滤

三层统一正则（概念上）：

```text
^0x[a-fA-F0-9]{36}(8888|7777)$
```

改尾号规则时：**extension + worker + fee_mode_server** 必须同步。

### 4.2 链上 Helper

- 地址：`0x53841c73217735F37BC1775538b03b23feFD8346`
- 方法：`getTaxTokenInfoV2(address)`
- 实现：`server/fee_mode.py` → `get_tax_allocation()` / 兼容 `get_fee_mode()`

分类规则（`build_allocation`）：

```text
segments = []
if dividendBps > 0:  💎
if marketBps > 0:    🎁 if is_vault else 👨‍🍳
if deflationBps > 0: 🔥
if lpBps > 0:        💧

0 段 → unknown
1 段 → 单标签 mode（holder/creator/gift/burn/lp）
多段 → mode=hybrid

最大份额段始终标注 →SYMBOL（与池子 quote 相同也不省略）
  holder → dividendToken（空则 quote/WBNB）
  gift（vault）→ dividendToken（税info「分红 Token」；空则 quote/WBNB）
  creator/lp → quoteToken（空则 WBNB）
  burn → taxToken 自身
  并列 bps 时优先级: holder > gift > creator > burn > lp
  注：币股篮子成分（NVDA/SPCX）属 vault 内部，不进 →SYMBOL
```

插件侧可用 bps **本地再拼紧凑 label**（去空格）+ `top_payout_symbol` 补 `→`；后端 `label`/`title` 仍以 API 为准。

### 4.3 API 响应（`POST /modes`）

```json
{
  "ok": true,
  "results": {
    "0x...7777": {
      "mode": "hybrid",
      "label": "💎90%→SPCXB 👨‍🍳10%",
      "title": "税收分配: ...\n买税 1% | 卖税 1%\n最大份额(持有人分红): →SPCXB (...)",
      "dividend_bps": 9000,
      "market_bps": 1000,
      "deflation_bps": 0,
      "lp_bps": 0,
      "is_vault": false,
      "buy_tax_bps": 100,
      "sell_tax_bps": 100,
      "dividend_token": "0x...",
      "quote_token": "0x...",
      "dividend_symbol": "SPCXB",
      "quote_symbol": "SPCXB",
      "tax_symbol": "...",
      "top_segment": "holder",
      "top_payout_token": "0x...",
      "top_payout_symbol": "SPCXB",
      "fetched_at": 1730000000,
      "source": "chain|memory|sqlite|cf-memory|cf-kv"
    }
  },
  "missing": [],
  "invalid": []
}
```

缓存：

- 后端：内存 + SQLite `payload` JSON；**无完整 payload 的旧行当 miss**；连接按事务显式关闭，过期行默认每 6 小时清理，短批次响应缓存上限 128；HTTP 槽位满时默认短等 250ms 再决定是否返回 503
- Worker：isolate 内存 + KV；**缺 label/bps/top_payout_* 的旧条目当 miss**；vault gift 仍 `top_payout≠dividend_token` 的旧 →BNB 行当 miss；回源结果用 `ctx.waitUntil()` 异步落 KV；25s 总预算内对瞬时 429/5xx/网络失败及部分 `missing` 做 250/750ms 温和重试，且只重试缺失 token
- 后端 SQLite：同上 stale gift 规则强制回源

- 插件：`chrome.storage` key `flapFeeInfo.modeCache.v3`

### 4.4 插件站点策略

| 域名 | 策略名 | 说明 |
|------|--------|------|
| `*.gmgn.ai` | gmgn | 找 Tax 芯片，徽章挂外侧（防裁切） |
| `*.debot.ai` | debot | 指标行挂载 |
| `*.gungnir.bot` | debot | **与 Debot 同前端**（同 Vite asset hash / 同 API 路径） |

新增站点：

1. `manifest.json` → `content_scripts.matches`  
2. `content.js` → `createSiteStrategy()`  
3. 用 js-mcp 对比 DOM/资源哈希，能复用则复用  

注意：`Extension context invalidated` 出现在「重载扩展但未刷新页面」；`content.js` 已做 context 校验，仍应提示用户刷新页。

#### 底池 / 报价文案（`extractQuoteSymbol`，纯 DOM）

| 站点 | 识别方式 |
|------|----------|
| Debot / Gungnir | `[aria-label*="流动池"]` / `img[alt]`（如 `BNB 流动池`） |
| GMGN RWA/美股 | `img[alt$=" quote icon"]` 或 `/static/quotes/{sym}.png` |
| GMGN 特殊报价 | `data-icon` / `/static/icons/icon_usd1_*` 等 → `USD1` / `USDT` / `USDC` / `WETH` |
| GMGN 默认 BNB 池 | **常无图标**；BSC 上无特殊报价时默认 `BNB` |

- 扫卡间隔：`SCAN_INTERVAL_MS = 500`  
- Tab 恢复：仅 in-flight ≥12s 才 force recover，避免 Abort 风暴（`0.2.7+`）  
- 强制 recover 时用 `activeBatchTokens` 回填队列，防止丢 token  

### 4.5 验收样本

| CA / 场景 | 期望 |
|-----------|------|
| `0x556f0944357fb9a789c4a374095d3ce9ffba7777` | fee `💎90%👨‍🍳10%` hybrid；有报价时 `🪙… \| 💎90%👨‍🍳10%` |
| `0x789476401ce0df8805f6e8a9a1e7439aac117777` | `🎁100%` gift（币股 vault） |
| GMGN BSC 默认 BNB 池 7777/8888 | `🪙BNB \| …` |
| GMGN USD1 池（`IconUsd116pxS`） | `🪙USD1 \| …` |

---

## 5. 环境与运行

### 5.1 后端（server）

依赖：**Python ≥3.11 + uv + web3**，勿用裸 pip/venv。

```powershell
cd server
# 配置 .env（见 .env.example / deploy-hk0.md）
uv run flap-fee-server
# 或: uv run python fee_mode_server.py
```

关键环境变量：

| 变量 | 含义 |
|------|------|
| `FLAP_FEE_HOST` / `PORT` | 默认 `127.0.0.1:8765` |
| `FLAP_FEE_BSC_RPC_QN` | QuickNode 主 RPC（优先） |
| `FLAP_FEE_BSC_RPC` | 备用 / 公共 seed（QN 未设时用） |
| `FLAP_FEE_RPC_RPS_LIMIT` | RPC 限速 |
| `FLAP_FEE_MAX_FETCH_WORKERS` | 并发 |
| `FLAP_FEE_API_TOKEN` | Bearer；生产必开 |

单 token 调试：

```powershell
cd server
uv run python fee_mode.py 0x556f0944357fb9a789c4a374095d3ce9ffba7777
```

### 5.2 Worker

```powershell
cd cloudflare
# 密钥（勿写进仓库）
wrangler secret put UPSTREAM_API_TOKEN
wrangler deploy
```

`wrangler.jsonc`：`UPSTREAM_BASE_URL=https://flap.jishugua.top`，KV binding `FLAP_FEE_CACHE`。

### 5.3 插件

1. Chrome → `chrome://extensions` → 开发者模式  
2. 加载已解压：`extension/`  
3. 改代码后点 **重新加载**，并 **刷新** 目标页  

打包：

```powershell
python _run_pack_extension.py
# → dist/FlapFeeInfo-extension-vX.Y.Z.zip
```

### 5.4 运维 ctl

```powershell
python tools/ctl.py status|health|test|deploy|logs|restart ...
# 交互菜单：python tools/ctl.py
```

`deploy`：scp 核心 py 文件 + watchdog 单元 + `uv sync` + systemd restart/enable。

**抗挂死：**

| 单元 | 作用 |
|------|------|
| `flap-fee-info.service` | `Restart=always`、`StartLimitIntervalSec=0`、开机自启 |
| `flap-fee-info-watchdog.timer` | 每 30s curl 本机 `/health`，失败则 restart 主服务 |

```powershell
python tools/ctl.py watchdog-status
python tools/ctl.py watchdog-run
```

---

## 6. 部署清单（改完对应层再部署）

| 改动范围 | 动作 |
|----------|------|
| `server/*` | `python tools/ctl.py deploy` |
| `cloudflare/*` | `cd cloudflare; wrangler deploy` |
| `extension/*` | 本地重载插件；需要时 commit 公开仓 + 打 zip |
| 仅文档 | commit 即可 |

**顺序建议**：先后端 → 再 Worker → 最后插件（插件依赖 API 字段）。

---

## 7. 公开 Git 策略

根目录 `.gitignore`：**默认忽略全部**，仅放行：

- `README.md`
- `CLAUDE.md`
- `extension/**`

因此 **server / cloudflare / tools 默认不会 push 到公开 GitHub**。全栈代码在开发者本机完整目录中维护。

提交插件时只 stage 上述放行路径；勿提交 `.env`、sqlite、`_run_*.py`、`dist/`。

---

## 8. Agent 开发约束（本仓库）

1. **语言**：与用户交互用中文；代码注释可中英，标识符英文。  
2. **KISS**：只改需求相关文件，禁止无关重构。  
3. **Windows 命令**：敏感参数走 `_run_*.py` + `subprocess`（UAC 启发式），终端只跑 `python _run_xxx.py`。  
4. **依赖**：Python 侧用 **uv**；格式化优先 **ruff**。  
5. **异常**：禁止裸 `except:`。  
6. **时间**：监控/限流用绝对时间，勿用 sleep 累加当授时。  
7. **密钥**：永不 commit `FLAP_FEE_API_TOKEN` / RPC key / wrangler secret。  
8. **改分类语义**：同步后端、Worker 缓存完整性判断、插件 `confirmedModes` 与样式。  
9. **改域名白名单**：`manifest.json` matches + `createSiteStrategy`。  
10. **用户可见部署**：扩展需用户「重新加载」；服务端/Worker 你方可 `deploy`。

---

## 9. 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| `Extension context invalidated` | 重载扩展未刷页面 | 刷新 Debot/GMGN/Gungnir |
| 后台久置再切回徽章消失 | 定时器/fetch 被冻结、`batchActive` 卡住、DOM 回收 | `0.2.7+` resume 不乱杀年轻请求 + reapply 缓存；仍异常再刷新 |
| 控制台 AbortError / recover-stuck 刷屏 | 旧版 focus 强制 abort in-flight | 升到 `0.2.7+` |
| 徽章被裁半截 | 挂在 Tax 芯片内 / overflow | 外侧挂载 + CSS `min-width:max-content`（已做） |
| 只有 mode 无比例 | 命中旧缓存 | 清 storage 或等 miss；schema 已强制完整 payload |
| GMGN 无 🪙BNB / 🪙USD1 | 未识别特殊 icon / 默认 BNB | 升到 `0.2.9+`；确认 `chain=bsc` |
| Worker 403 | 无 UA / 边缘防护 | 浏览器正常；脚本请求带浏览器 UA |
| 7777 无图标 | 未重载 0.2.x 插件 | 确认 manifest version |

---

## 10. 版本与变更提示

- 插件版本：`extension/manifest.json` → `version`（发布前递增）  
- 近期能力：  
  - `0.2.x`：结构化分配 + 7777 + hybrid + Gungnir  
  - `0.2.6+`：底池报价合成 `🪙QUOTE | fee`  
  - `0.2.9`：`|` 两侧空格；GMGN USD1 icon + BSC 默认 BNB  
  - `0.3.0`：最大份额段始终 `→SYMBOL`（与池子 quote 相同也不省略）  
  - `0.3.1`：点击扩展图标可勾选显示项（底池/💎/👨‍🍳/🎁/🔥/💧/→/未知，默认全开）  
  - `0.3.2`：Debot「即将打满」等卡片徽章漏挂修复（更高卡片、放宽 metric 挂载、完整 CA 深扫）  
  - `0.3.3`：Debot 徽章挂到「买」按钮 flex 行 + 幂等更新，消除 500ms 扫描跳闪  
  - `0.3.4`：多分类 label 按 bps 从高到低排序（最高份额在最左）  
  - `0.3.5`：GMGN 后台久置切回徽章丢失 — resume 强制重挂 + 软 cleanup + 错峰扫描  
  - `0.3.6`：徽章字体跨平台统一（拉丁优先 + emoji 回退，修 macOS 字距/裁切）  
  - `0.3.7`：徽章深色/浅色主题切换（默认 dark；storage `flapFeeInfo.badgeTheme.v1`）  
  - `0.3.8`：Debot 挂载改为底部指标行优先（抗自定义买按钮尺寸跳变）；忽略侧栏；token 页挂 stats  
  - `0.3.9`：GMGN 代币详情页 `/…/token/0x…` 在「总税率」旁展示徽章（URL 抽 CA）  
  - `0.4.0`：后台久置后整管线假死修复（hardReset + batchActive 僵尸 + 12s 看门狗）  
  - `0.4.1`：降 0.4.0 卡顿（看门狗仅异常时扫；resume 少扫；idle hard-reset 不 warn）  
  - `0.4.2`：宿主性能：扫描 1s/48 卡、弱化 XPath、CA/挂载缓存、mutation 400ms、storage LRU  
  - `0.4.3`：GMGN SPA token↔home 轻量路由（安静窗吞 mutation、分片扫、禁 force remount 风暴）  
  - `0.4.4`：js-mcp 根因优化 — 扫描/Observer 限定列表列/Card；href 优先；稳态 1.2s/28 卡  
  - `0.4.5`：稳态流畅（去 scroll 扫、稳定徽章不重算、短 blur 不 remount）  
  - `0.4.6`：稳定卡不占 budget（Debot 右列饿死修复）；未画优先；即时性参数回调  
  - `0.4.7`：SPA 渐进补扫 + 禁 height>200 误清列表卡  
  - `0.4.8`：js-mcp 复现 token→home 0 徽章 — 独立路由轮询、Observer 永挂 documentElement、禁 body mark、token 链优先  
  - `0.4.43`：GMGN-only 流畅 — 滚动冷却 + mutation 相关性过滤 + 稳定卡/Tax 挂载缓存（Debot 逻辑不变）  
  - `0.4.44`：GMGN K→战壕即时徽章 — 轻量 soft + cache-first fastPaint + 紧 progressive（无 keep-alive；Debot 不变）  
  - `0.4.45`：GMGN 仅首屏可视 ~10–12 卡（禁屏外/Tax 叶扫/dedupe）；回战壕 <1s 铺满；Debot 不变  
  - `0.4.46`：GMGN 回战壕对标 Debot — 首扫禁 force（避 host 500ms+ longtask）+ rAF/DOM-watch 密快绘  
  - `0.4.47`：Debot K 线顶栏徽章修复 — 登录侧栏导致 short CA 漏扫，改 title/ca-text 顶栏定位  
  - `0.4.48`：Debot 坐标模式嵌套双徽章去重；100% 份额只显示类型图标（💎 而非 💎100%）  
  - `0.4.49`：GMGN K 线徽章挂 short CA 旁；回战壕防 early-stop 卡 10~12 枚 + 600/1200/2000 补洞  
  - `0.4.50`：GMGN K 线强制 short CA afterend（禁总税率兜底；税率旁已挂则迁移到地址旁）  
  - `0.4.51`：GMGN/Debot 三列同 CA 各显徽章（list-return 禁 token 级 dedupe）；单卡仍防双徽章  
  - `0.5.0`：里程碑 — GMGN 战壕流畅与 K 线地址旁挂载、三列同 CA 各显；Debot K 线顶栏/坐标双徽章；100% 仅类型图标；回战壕 ~0.5s 铺满  
  - `0.5.1`：GMGN 多栏布局 short CA 中位 — 放宽地址 left 带  
  - `0.5.2`：GMGN token 多栏同时扫顶栏+左侧战壕（对齐 0.4.24，修 settled 死锁）  
  - `0.5.3`–`0.5.4`：K 线顶栏防闪没（`data-fee-header` 锁 + 列表扫勿 clear）  
  - `0.5.5`：token 页 guardian 续画 + insert 成功即算挂载成功  
  - `0.5.6`–`0.5.7`：内联战壕开时勿误选左侧 short CA；全宽恢复顶栏地址  
  - `0.5.8`：顶栏成功仅认真锁，左侧同 CA 列表徽章不冒充顶栏  
  - `0.5.9`：优先 `#token-base-address`/`data-addr`；地址行 DOM 重绘后 observer 补挂  
  - `0.5.10`：GMGN/Debot/Gungnir K 线地址行徽章加 header lock 与锚点校验；React 整行替换后定向即时补挂
  - `0.5.11`：Debot/Gungnir 三列虚拟列表滚动冷却；过滤插件自身 Mutation 反馈环；续扫与去重改为低成本局部路径
  - `0.5.12`：Debot/GMGN 进入 K 线时冻结离场战壕 DOM；真实地址行挂载后再绘制 header 徽章；token 路由取消 full scan
  - `0.5.13`：K 线返回战壕增加真实列表 DOM 门禁；健康 guardian/后台恢复取消周期性列表扫描与全量 remount
  - `0.5.14`：修复 Debot/GMGN 虚拟列表将卡片复用为非 7777/8888 地址后旧徽章残留；返回快绘复用前强校验当前卡片地址
  - `0.5.15`：Debot/GMGN token→token 改为原站路由提交后再绘制；请求失败静默退避且无数据不扫 DOM；新地址就绪后清理旧 header 徽章
  - `0.5.16`：GMGN 启用 main-world 路由提交通知；战壕门禁不再依赖 7777/8888 分布且从真实就绪时启动补绘；目标 token 切到非目标 token 时同步清理旧 header
  - `0.5.17`：GMGN 回战壕门禁识别无 token `<a>` 的虚拟卡片；三列短 CA/Tax row 就绪即按列 cache-first 快绘
  - `0.5.18`：GMGN K 线内嵌战壕改为 `TokenItem` dirty-card 定向更新（最多 16 张可见卡），并过滤常驻隐藏 dialog / 顶部搜索框造成的弹层误判；搜索弹层取消 fastPaint + full scan 重复遍历，徽章固定挂在短 CA 旁
  - `0.5.19`：GMGN 搜索徽章改挂 `V/Fees` 列后；Debot/Gungnir 搜索徽章改挂代币名称行末尾；严格定位失败时不回退到其他挂载点
  - `0.5.20`：GMGN 常规战壕候选按三列与视觉卡片 round-robin 去重；用跨轮次行游标覆盖「已开盘」下方卡片，同时维持每轮 12 卡预算
  - `0.5.21`：GMGN-only 新卡徽章时效 — mutation 防抖 380ms、列表扫间隔 560ms、batch 180ms、miss 前两次 2s/5s + 到期自动重入队、/modes 回包后有界 cache-first 视口补画；Debot/Gungnir 不变
  - `0.5.22`：GMGN-only 请求队列 — 顶区未画 token 50ms 优先 flush、batch 按视口/左列排序、截断扫描也触发 flush；Debot 不变
- 缓存 key 升级：改持久化字段时 bump `flapFeeInfo.modeCache.vN`（当前 `v3`）  
- 显示偏好：`flapFeeInfo.displayPrefs.v1`（popup + content 共享 storage）  
- 徽章主题：`flapFeeInfo.badgeTheme.v1` = `dark`（默认）| `light`

---

## 11. 相关文档索引

| 文件 | 内容 |
|------|------|
| `README.md` | 用户安装与图标说明 |
| `server/README.md` | 本地 API / 响应示例 |
| `server/deploy-hk0.md` | VPS 部署 |
| `cloudflare/README.md` | Worker secret / deploy |
| `tools/ctl.py` | 远端运维入口 |

---

*维护原则：架构变更（层、字段、域名、Helper）必须先改本文档对应章节，再改代码。*
