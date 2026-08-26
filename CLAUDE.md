# FlapFeeInfo — 开发文档（给 Agent / 后续开发者）

> 项目名：技术瓜FlapFeeInfo  
> 公开仓库：https://github.com/Tech-Melon/FlapFeeInfo（默认 **只发布插件** `extension/`）  
> 本地工作区：含后端、CF Worker、插件三层全栈代码  

本文档面向 **Agent 与开发者**，说明架构、约定与改动入口。用户安装说明见根目录 `README.md`。

---

## 1. 项目目标

在 **GMGN / Debot / Gungnir** 等 meme 列表页上，给 BSC 上税收代币展示 **税收分配徽章**，并尽量附带 **底池/报价** 文字：

- **Flap**：尾号 **`8888` / `7777`** → Helper `getTaxTokenInfoV2`
- **Four.meme**：尾号 **`ffff`** → token 链上 Multicall（`feeRateBuy/Sell` + `rate*` + `quote`）

| 展示 | 含义 | 数据来源 |
|------|------|----------|
| 💎`N%` | 持有人分红 | 链上 `dividendBps` |
| 👨‍🍳`N%` | 创作者/营销（非 vault） | `marketBps` 且 `!isVault` |
| 🎁`N%` | vault gift（含币股等金库） | `marketBps` 且 `isVault` |
| 🎓`N%` | Giggle 慈善 | Four `rateGiggleCharity` |
| 💛`N%` | Binance 慈善 | Four `rateBinanceCharity` |
| 🔥`N%` | 销毁 | `deflationBps` |
| 💧`N%` | 回流 LP | `lpBps` |
| ❓️未 | 无有效分配 | 全 0 |
| 🦋/🖐️/🪙`QUOTE` | 底池报价（Flap=🦋、Four.meme ffff=🖐️、其它=🪙） | 普通税币 / **税收金库**：DOM 或 Helper quote；**币股篮子金库：BNB**（股票芯片不是 LP） |

- **有值才出**；多项非零 → `mode=hybrid`，fee 段**按 bps 从高到低**（最高在左），如 `💎90%→SPCXB👨‍🍳10%`  
- **合成徽章**（有报价时）：`{🦋|🖐️|🪙}QUOTE | fee`，如 `🦋BNB | 💎90%`、`🖐️USD1 | 💎100%`（`|` 两侧有空格）  
- **买卖税率**只进 tooltip（`title`），不进主文案  
- **不隐藏**站点原有底池小图标  
- Flap 官网：`8888` → `/feeinfo`，`7777` → `/taxinfo`；查询合约 **同一 Helper**

---

## 2. 三层架构

```text
浏览器插件 extension
    POST /modes  { tokens: string[] }
        ↓  （只等缓存层，不等链）
Cloudflare Worker  (https://flap-fee-info.tech-melon.workers.dev)
    ① 立即返回 mem + KV 命中
    ② miss → pending 标记 + waitUntil 后台回源
        ↓  Bearer + POST /modes { wait_chain: true }  （仅后台）
VPS Nginx  (https://api.tech-melon.top/flap-fee)
        ↓
Python API  (127.0.0.1:8765)
    默认 wait_chain=false：mem+SQLite 秒回，miss 后台 inflight 上链
    wait_chain=true（CF 后台）：阻塞到预算内链上完成，供 KV 落盘
        ↓
BSC RPC / QuickNode
    Helper.getTaxTokenInfoV2(taxToken)

pending 清理：年龄 >5min 或 map 规模 >500（最旧优先淘汰）
插件对 missing/pending 快轮询（~300/700/1500ms）直到缓存命中
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
│   ├── page-hook.js
│   ├── tax-recv-bootstrap.js
│   ├── popup.html / popup.js / popup.css
│   ├── style.css
│   └── icons/
├── private/clip-jump/        # 本机 overlay（默认不进公开 git）
│   ├── clip-content.js / clip-popup.js / background.js
│   ├── clipboard-util.js / clip-spa.js / clip-search.js / offscreen.*
│   └── overlay.json          # 打包时叠到完整包
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
^0x[a-fA-F0-9]{36}(8888|7777|ffff)$
```

改尾号规则时：**extension + worker + fee_mode_server + fee_mode** 必须同步。

### 4.2 链上 Helper

- 地址：`0x53841c73217735F37BC1775538b03b23feFD8346`
- 方法：`getTaxTokenInfoV2(address)`
- 实现：`server/fee_mode.py` → `get_tax_allocation()` / 兼容 `get_fee_mode()`

分类规则（`build_allocation`）：

```text
segments = []
if dividendBps > 0:        💎
if marketBps > 0:          🎁 if is_vault else 👨‍🍳
if giggle_charity_bps > 0: 🎓
if binance_charity_bps > 0:💛
if deflationBps > 0:       🔥
if lpBps > 0:              💧

0 段 → unknown
1 段 → 单标签 mode（holder/creator/gift/giggle/binance/burn/lp）
多段 → mode=hybrid

最大份额段始终标注 →SYMBOL（与池子 quote 相同也不省略）
  holder → dividendToken（空则 quote/WBNB）
  gift（vault）→ dividendToken（税info「分红 Token」；空则 quote/WBNB）
  creator/lp/giggle/binance → quoteToken（空则 WBNB）
  burn → taxToken 自身
  并列 bps 时优先级: holder > gift > giggle > binance > creator > burn > lp
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
      "giggle_charity_bps": 0,
      "binance_charity_bps": 0,
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
- Worker：isolate 内存 + KV；**缺 label/bps/top_payout_* 的旧条目当 miss**；vault gift 仍 `top_payout≠dividend_token` 的旧 →BNB 行当 miss；回源结果用 `ctx.waitUntil()` 异步落 KV（**仅 miss 的 key**，已命中不重写）；25s 总预算内对瞬时 429/5xx/网络失败及部分 `missing` 做 250/750ms 温和重试，且只重试缺失 token
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
| GMGN 默认 BNB 池 | **常无图标**（`quote_address=0x0`）；BSC 上无特殊报价时默认 `BNB` |
| GMGN 税收分红图 | `TaxDividendTokenIcon`（`TaxDividendTokenIcons.tsx`）：`/static/quotes/{title}.png` 或 `external-res` logo；fiber `tokenInfo.{address,symbol}` |
| GMGN 底池图 | Tax **外** `LaunchpadImageIcon` 的 `/static/quotes/`；**不是** `/static/lpp/` 发射台 logo |
| GMGN 报价目录 | 同源 `/static/config/quotes.json`（`v`+`configs.{chain}[]`：`ca/title/iconSrcDark`）；新池子随 GMGN 更新，插件启动拉取 |
| GMGN 非 vault 底池 | Tax 外 quotes 芯片 + `quote_address` 目录映射（`SPCXB`→`SPCX`、`QQQB`、`XAUT0`）；禁止当股票芯片回退 BNB |
| **币股篮子金库** | 忽略 Tax 内篮子芯片；底池固定 `BNB`（Helper quote 空则 WBNB） |
| **税收金库（无篮子）** | 跟 Pancake/Helper quote（如已迁池 `QQQB`），不要因为 `is_vault` 就画 BNB |

- 扫卡间隔：`SCAN_INTERVAL_MS = 500`  
- Tab 恢复：仅 in-flight ≥12s 才 force recover，避免 Abort 风暴（`0.2.7+`）  
- 强制 recover 时用 `activeBatchTokens` 回填队列，防止丢 token  

### 4.5 验收样本

| CA / 场景 | 期望 |
|-----------|------|
| `0x556f0944357fb9a789c4a374095d3ce9ffba7777` | fee `💎90%👨‍🍳10%` hybrid；有报价时 `🪙… \| 💎90%👨‍🍳10%` |
| `0x789476401ce0df8805f6e8a9a1e7439aac117777` | `🎁100%` gift（币股 vault） |
| `0x7f048908f1fcc57d836c258143004c4597937777` | 币股 `🦋BNB \| 📈NVDA&FXIO`（底池是 BNB，不是 NVDAB） |
| `0x78471d87a30d2b073d1a775eccee299393157777` | 非 vault SPCX 底池 `🦋SPCX \| 💎→SPCX`（`Glorb/SPCXB`，禁止回退 BNB） |
| `0x28e9053bd9c4057da73e99282818cc5c4bc07777` | 币股 `🦋BNB \| 📈FXIO`（底池是 BNB，不是 FXION） |
| `0x83f2a3e66396a5489ecc9c1cbc67aee524af7777` | 税收金库已迁 Pancake `🦋QQQB \| 🎁→QQQB`（不要画成 `🦋BNB`） |
| `0xbd6bfe956474f156ad4545bbe83b33cf767c7777` | SPCXB 底池税收金库 `🦋SPCX \| 🎁70%→SPCX💎30%`（不要 `🦋BNB` / `📈SPCX`） |
| `0x28b8aa38bbcb083a481383151c03074463ceffff` | Four v2 慈善 `🎓50%💛50%` hybrid；有报价时 `🖐️GMEB \| 🎓50%→GMEB💛50%` |
| GMGN BSC 默认 BNB 池 7777/8888 | `🪙BNB \| …` |
| GMGN USD1 池（`IconUsd116pxS`） | `🪙USD1 \| …` |

### 4.6 剪切板跳转 K 线（本机 overlay，不进公开仓）

**公开 `extension/` 不含此功能**（无 `clipboardRead` / background / offscreen）。完整能力在 `private/clip-jump/`，打包叠到 `dist/unpacked-full`。

弹窗独立区块，**默认折叠且默认关闭**。开启流程：安全提醒 → 二次确认 → `optional_permissions: clipboardRead`（iOS 跳过后台权限，只做手势读取）。

| 平台 | 行为 |
|------|------|
| Windows / 桌面 Chrome | 授权后 offscreen 读文本，**只抽出地址**后立刻丢原文 |
| iOS / iPadOS | 系统禁止后台静默读剪切板；只提供「立即检测」和输入框粘贴 |
| 关闭功能 | 停止 offscreen，并 `permissions.remove(clipboardRead)` |

识别（本地、不上传、不改写剪切板；扫描上限 8KB）：

- 文中**第一个** EVM / Solana 地址才作为跳转候选（句子/推文中间可以）
- EVM：`0x` + 40 hex；Solana：32 字节 base58（含 `…pump`）
- 已知代币 URL 带链名时尊重链（`gmgn.ai/base/token/...` → base）；`fromUrl` 直接当代币
- 裸地址必须经 GMGN `GET /vas/api/v1/search_v3?q={ca}` 确认：`data.coins` **精确匹配该地址**才是代币并定链；只出现在 `wallets`、或 coins 是「拿钱包地址当名字的山寨币」→ **不开 K 线**
- 搜索失败 / 超时同样不开 K 线（避免钱包被默认成 BSC 代币）
- 定链缓存 `chainCache.v2` 只存已确认代币（`kind=token`）；非代币仅内存记 10 分钟
- 只把 `{kind,address,chain}` 传给后台，**原文不进 SW / storage / 日志**
- 复制即搜仍要求整段短文本且字数在范围内；文中已有 CA 时走跳转分流（再由 search_v3 过滤钱包）

跳转：

- **主路径（推荐）**：GMGN/Debot 标签里的 content script 常驻。页可见且聚焦时轮询剪切板；切回该标签立刻读一次。定链可走同源 `search_v3`，再 `clip-spa.js` 站内跳。
- **不要**把监听押在 MV3 Service Worker / offscreen 上：SW 会睡，隐藏页会被收，读剪切板还经常没焦点。
- **offscreen 仅兜底**：人不在 GMGN/Debot 时，才尝试后台读并新开标签。
- **禁止** `chrome.tabs.update` 换地址栏（整页重载很慢）
- 同一地址 2.5s 内不连跳

可选「复制即搜」（默认关，完整包独立区块，**仅 GMGN**）：与跳转 K 线**共用一条剪切板通道**（页内 copy/cut + `clipboardchange` + 前台轮询；**offscreen 同样分流**）。读到内容后三分流：文中第一个 EVM/Sol 地址且 search_v3 确认为代币 → 跳 K 线（若已开）；整段短文本且字数在设定范围内 → 切到已开的 GMGN 标签并打开搜索、填入 `input[name=new-search-input]`；钱包地址 / 超范围 / 含空格 / 网址 → **不跳不搜**。不必先点 GMGN。两个开关独立，但只挂一套监听。同一段只处理一次，再复制才再动。默认 2–8 字，上下限可单独改（1–32）。字数按 Unicode 字形计：**中文一字 = 英文一字母 = 1**（`生米`=2，`PEPE`=4）。剥前缀 `$`/`@`/包裹引号。开启同样要确认 + `clipboardRead`；与跳转共用权限、offscreen 与 `clipJump.seen.v1` 去重，两个都关才撤回权限 / 关掉 offscreen。

可选「文章重点样式」（默认关，完整包独立区块）：源自微博监控 `formatAiText` 的阅读强调（引号 / `$ticker` / 大写缩写 / 百分比 / 中英实体）。圆角胶囊；引号后固定跟「复制」。中文实体三通道（`0.7.54`）：词典整词（≥3 字）、Segmenter 单字碎片合并（重建未登录词：美联储/鲍威尔/比特币/降息）、音译字连串（卡尔达舍夫/泽连斯基）；内置词表 + 自定义词为最高优先兜底。英文：驼峰/全大写/句中首字母大写专名；**句首大写不算信号**（短推文或紧跟第二个大写词的全名除外），全名跨空格合并（Bill Gates）。`@handle` 与金额不标；孤词抑制只作用于大写/百分比/$ 等形态类命中。只对已填站点注入：主机名覆盖全站，带路径（如 `debot.ai/popout/xTracker`）只作用于该路径前缀。

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

`wrangler.jsonc`：`UPSTREAM_BASE_URL=https://api.tech-melon.top/flap-fee`，KV binding `FLAP_FEE_CACHE`。

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
| KV Write 日账单 ≈$5 尖峰 | 0.7.57 并行回源对已 KV 命中的 key 仍 `put`（冷 isolate 反复重写热门 CA） | 升 Worker **0.7.65+**（只写真正 miss）；`wrangler deploy` |
| Worker 仪表盘「错误」~数万/天 | 跨请求 await 共享 inflight Promise，插件 Abort 后 hang detector | 升 Worker **0.7.66+**；点 Errors→Invocation Statuses 应见 hung/exception 下降 |
| 7777 无图标 | 未重载 0.2.x 插件 | 确认 manifest version |
| K 线侧栏下滑徽章几十秒不更新 | settled 后 light 续扫不扫战壕；短地址未爬卡；滚动热路径过重 | 升到 **0.7.9+**；扩展重载 + 硬刷页 |
| 钱包追踪 / 收藏栏误挂徽章 | 禁区识别不全 | **0.7.7+** 禁钱包追踪+收藏；主战壕/搜索/K 线侧栏应仍有徽章 |
| 拖 K 线分隔条时卡顿 | 拖动中仍扫 DOM | **0.7.6+** 拖动 pause，松手 settle 再扫 |
| 开资金接收后新创建只剩很少卡 | 宿主 ~2 分钟轮出 + 屏蔽砍 👨‍🍳 + 无 SW 累积 | **0.7.4+** 保留池 10 分钟/40 卡；网页筛选+阈值配合 |
| 抽样 feeMatch:false（行 CA≠徽章） | 虚拟列表复用短窗 | **0.7.4+** 无身份不 stable + scrub 后 cache 重画 |
| 剪切板跳转不生效 | 未授权 / iOS 禁后台读 / 文本过长或不像地址 | 弹窗里确认开启；Windows 允许读取剪切板；iOS 用「立即检测」或粘贴框 |
| 复制短名没有弹出 GMGN 搜索 | 未开「复制即搜」/ 未授权 / 不在 GMGN 前台 / 字数超出或含空格 / 已搜过这段 | 完整包弹窗开启并刷新 GMGN；再复制一次才再搜 |
| 文章重点样式没出现 | 未开开关 / 站点未加入 / 未授权 / 只加了路径但当前不在该路径 | 完整包弹窗添加主机名或 `debot.ai/popout/xTracker` 并允许访问；刷新目标页 |
| 新创建一直 ⏳待加载 | GMGN 战壕走 SharedWorker，页面无 WSS；旧 fiber 读取用 Object.keys 拿不到 `__reactFiber` | **0.8.39+** 从卡片祖先 fiber `data.tax_allocation` 提取；重载插件并硬刷页 |

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
  - `0.6.0`：税收接收方隐藏 + 新币 ⏳待加载（无 /modes 不画真徽章）
  - `0.6.3`：新币徽章时序 — href 优先于 short CA，禁虚拟列表复用旧徽章；feeSig 必须对应当前 entry 才跳过重绘
  - `0.6.4`：js-mcp 实锤 GMGN TokenItem 为 `div[href=/bsc/token/…]`（非 `<a>`）— 身份提取读任意 `[href]`，修新创建错徽章残留
  - `0.6.5`：行身份=自身 CA（禁多 href 优先 7777）；ffff 等非目标永不挂徽章；`findCardsByCa`；新创建 miss 重试 400ms/1.2s
  - `0.6.6`：CF/后端 async-cache-first（缓存秒回 + 后台填 + pending 去重/5min·500 清理）；插件 poll pending
  - `0.6.7`：后端 QN 走 httpx keep-alive；扫卡 `enforceIdentity` 严禁错徽章（fee≠行 CA 立刻拆）
  - `0.6.9`：仅 BSC 生效（`?chain=bsc` / `/bsc/token` / Debot `/token/bsc`）；robinhood 等立即清徽章；K 线+内嵌战壕保留
  - `0.6.10`：Debot 双站 `debot.ai` + `gungnir.bot` 对齐 `/meme?chain=bsc` 与 `/token/bsc` 门控
  - `0.6.11`：流畅优化 — mutation/扫卡/miss 重试对齐 0.6.2；`gateCardIdentity` 快路径 + href 短缓存 + scrub 节流；保留防错徽章
  - `0.6.12`：`pending`/`missing` 分轨重试（pending 0.6/1.4/2.8s，missing 1/2.2/4s）；requeue 定时器上限 24
  - `0.6.13`：Hot/Steady 双轨（热：批 1/120ms、防抖 220、扫 gap 360、pending 0.4s 起）；仅 BSC（他链含 robinhood 全关）
  - `0.6.14`：Four.meme `ffff` 税币 — 后端 Multicall 链上读 + 与 Flap 同 payload；插件/CF 尾号放行
  - `0.6.15`：ffff 徽章点击 → four.meme/zh-TW/token/{ca}；Flap 仍 flap.sh taxinfo
  - `0.6.16`：自定义多规则 CA 尾号屏蔽（仅 BSC，战壕「新创建」列；storage `flapFeeInfo.suffixHide.v1`）；底池前缀 Flap=🦋 Four=🖐️
  - `0.6.16b`：Debot 列表 API `meme/v3/ranks`→`meme/v4/ranks`（column 改 POST JSON body）；page-hook 补匹配，否则资金接收屏蔽整段不滤
  - `0.7.0`：里程碑 — Debot v4 资金接收屏蔽修复 + 自定义尾号屏蔽 + 底池 🦋/🖐️；page-hook HOOK_VER 49
  - `0.7.1`：GMGN/Debot 错徽章与身份加固（并入 0.7.2）
  - `0.7.2`：ffff 视口未画快补 ⏳/入队（与 7777 同权）；4444 等非目标行残留 7777 必拆；GMGN 扫卡/热批/回列表降负载；底池 DOM 优先
  - `0.7.3`：禁挂徽章场景 — 钱包追踪侧栏/弹层（GMGN+Debot）、GMGN 顶 ticker、搜索弹层「钱包」区；主战壕/币种结果不变
  - `0.7.4`：feeMatch 加固（无身份信号不 stable；scrub 拆错后 cache 重画）；新创建保留池 10 分钟 / 满 40 卡（page-hook HOOK_VER 50，仅过滤开启时）
  - `0.7.5`：GMGN K 线侧栏下滑徽章饥饿 — truncated 禁止 settled→light 死循环；token 页视口快补侧栏；scroll-settle 必扫战壕；embedded dirty href 兜底 + 松视口
  - `0.7.6`：K 线分隔条（col-resize）拖动期间暂停扫/画；松手 settle 后单次恢复扫 + 顶栏 tryPaint
  - `0.7.7`：GMGN 钱包追踪 + **收藏面板** 禁徽章（标题+表头双条件）；搜索/主战壕/K 线侧栏仍显示
  - `0.7.8`：滚动热路径降载 — 单 deadline 停滚定时器；禁区滚动不 resume 扫；viewport-quick / scrub 节流（900ms / 1.4s / 1.8s）；`isBadgeMountForbidden` 短缓存
  - `0.7.9`：K 线战壕短地址行先爬真实卡片再几何门禁；停滚分片补绘（quick×2 + light:false scan）；候选限 scan roots 内
  - `0.7.10`–`0.7.15`：GMGN 固定 trench/search 根 + scoped observer、TokenItem href swap 监听、新卡独立组批窗（详见 `content.js` 头部注释）
  - `0.7.16`：ffff 候选选择器补齐（主扫/lite/list-return/mutation 相关性/click-arm/搜索 anchor 共 7 处）；新卡组批只挡新卡不阻塞整队 flush；Debot K 线停滚 settle 修顶栏后恢复侧栏扫；清理漂移注释（watchdog/热轨参数/仅7777 字样）
  - `0.7.17`：资金接收阈值下限 1→0（只要分给了 dev/marketing 就屏蔽；0% 本身不挡）；page-hook HOOK_VER 51
  - `0.7.18`：阈值 0 = 严格 >0%（有 dev 分配才挡，不是 ≥0%）；page-hook HOOK_VER 52
  - `0.7.19`：可选剪切板跳转 K 线（默认关，需确认+授权；Windows 后台读 / iOS 仅手势粘贴）；弹窗已有功能默认折叠
  - `0.7.20`：剪切板区块默认折叠；只抽 EVM/Solana CA（可在一行文字中间）；GMGN/Debot 走站内 SPA，其它页才按设置新开标签
  - `0.7.21`：站内跳转不再读 `tab.url`（无 host 权限时为空会误开新标签）；向当前标签 content 探活并注入 `clip-spa.js`
  - `0.7.22`：裸 EVM CA 先走 GMGN `/vas/api/v1/search_v3` 定链（bsc/base/eth…），再站内跳对应链 K 线
  - `0.7.23`：剪切板漏检 — 读失败不覆盖、同 CA 2.5s 冷却而非永久去重、offscreen 30s 保活、页内 copy 快路径
  - `0.7.24`：剪切板主路径改 GMGN/Debot 页内常驻（聚焦轮询 + 切回前台立刻读），不再把监听押在会睡的 SW/offscreen
  - `0.7.25`：剪切板与徽章隔离 — 默认关不挂监听；页内禁止 execCommand paste（避免抢交易/搜索焦点）
  - `0.7.26`：剪切板内容未变则切页/回前台不再二次跳转（按文本签名去重，session 持久）
  - `0.7.27`：浏览器无剪切板修改时间；再次复制同一 CA（copy / writeText）视为新操作可跳，纯切页仍不跳
  - `0.7.28`：用 `clipboardchange` 识别任意应用里再次复制同一段文字；page-hook 早钩 writeText；切页仍不跳
  - `0.7.29`：同一 CA 定链本地缓存（内存 + storage，7 天 / 最多 300 条），命中不再打 search_v3
  - `0.7.30`：剪切板跳转拆到 `private/clip-jump` overlay；公开 `extension/` 只含徽章
  - `0.7.31`：完整包剪切板仅当前活动标签跳转（多开网页不再一起跳）
  - `0.7.32`：Four.meme `rateGiggleCharity` / `rateBinanceCharity` → 🎓/💛；旧 ffff 模板无此 view（multicall allowFailure）；modeCache.v4
  - `0.7.33`：完整包剪切板「使用站点」仅 GMGN / 仅 Debot / 二者都用（Gungnir 算 Debot）
  - `0.7.34`：币股 vault 底池固定 BNB（忽略 GMGN NVDAB/FXION 股票芯片；Helper 空 quote 回填 WBNB）
  - `0.7.35`：完整包剪切板切页不复跳；可选「复用已开站点标签」（默认关，GMGN/Debot 都支持）
  - `0.7.36`：完整包可选高亮页面 EVM/Sol CA（默认关；CSS Highlight 不改宿主 DOM；点击复制并跳转）
  - `0.7.37`：高亮 CA 开启时申请全站 host 权限并动态注入，X/其它站点可点跳（公开包不加）
  - `0.7.38`：完整包可选覆盖站点自带 CA 样式（默认关；去掉 GMGN 粉色 CA/搜索条，改用插件底纹+跳转）
  - `0.7.39`：高亮 CA 点击只复制，不再直跳；由剪切板监听负责打开 K 线
  - `0.7.40`：完整包剪切板轮询 350ms（前台 + offscreen）
  - `0.7.41`：完整包可选文章重点样式（默认关；域名白名单注入；引号/$ticker/ALLCAPS/百分比可复制）
  - `0.7.42`：文章样式改圆角胶囊，引号后固定跟「复制」
  - `0.7.43`：文章样式只处理变化节点，滚动不再整页重扫
  - `0.7.44`：文章样式中文专名（词表最长匹配 + 复合 + 自定义词）
  - `0.7.45`：文章样式跳过孤词与金额（GMGN 列表 36.6K 不再胶囊化）
  - `0.7.46`：句中名词用 Intl.Segmenter + 虚词过滤，不再只靠地名表
  - `0.7.47`：英文专名同样分词（首字母大写 / 驼峰；until further notice 不标）
  - `0.7.48`：文章样式收成重点专名；英文按句子上下文避免拆 span 漏标
  - `0.7.49`：GMGN 跟单/战壕列表不改文章样式，只标推特监控卡片
  - `0.7.50`：跟单列表禁止包胶囊；推文英文走 CSS Highlight（不拆 data-word）
  - `0.7.51`：推特卡整卡插入后补扫正文；文章样式需弹窗开开关并添加 gmgn.ai
  - `0.7.52`：英文 CSS Highlight 按全部推文正文刷新，不再被中文重扫清空
  - `0.7.53`：英文专名改为深青绿底 + 浅字，深色主题可读
  - `0.7.54`：js-mcp 实测重构文章样式识别层 — 中文实体三通道（词典整词≥3字 + 单字碎片合并重建未登录词「美联储/鲍威尔/比特币」+ 音译字连串「卡尔达舍夫」），词表降为加分兜底；英文句首大写不再误标（Advancement 类噪音），全名跨空格合并（Bill Gates）；修整数百分比不高亮、英文高亮全页 64 上限改按卡片、@handle 不标、去 extendNoun 盲吞
  - `0.7.64`：句子取第一个 EVM/Sol CA 跳 K 线；GMGN search_v3 的 `coins` 精确匹配才当代币，钱包地址不开 K 线；chainCache.v2
  - `0.7.63`：剪切板三分流收紧 — 整段是 CA 才跳 K 线，字数在设定范围内才搜，句子/超范围不再误跳
  - `0.7.62`：offscreen 在 `chrome.storage` 未注入时不再崩（改守卫 + 向 SW 拉配置）
  - `0.7.61`：复制即搜走与跳转相同的 offscreen 通道 — 在 Telegram 等处复制短文本后直接打开 GMGN 搜索，不必先点页面
  - `0.7.60`：修合并监听后跳转开关未写入的回归；offscreen 不再把非 CA 写入共享 seen（避免 Telegram 复制短名被当成已处理）；复制即搜只在刚开启时忽略当前剪切板，切回 GMGN 仍搜
  - `0.7.59`：复制即搜与跳转 K 线合并为一条剪切板监听，按内容分流（CA→K 线，短文本→GMGN 搜索）
  - `0.7.58`：完整包可选「复制即搜」— 仅 GMGN；默认关；复制短文本自动打开搜索并填入；默认 2–8 字（上下限可调）；字形计中英都算 1；同文只搜一次直到下次复制
  - `0.7.69`：许可证骨架（默认免费）— 弹窗可存密钥；请求可选带 `Authorization: Bearer`；Worker `REQUIRE_LICENSE=0` 不强制
  - `0.7.70`：单设备绑定 — `deviceId` + `X-Flap-Device-Id`（收费开启时 Worker 校验）
  - `0.7.71`：恢复免费模式文案；保留许可证/设备 ID 预埋（`REQUIRE_LICENSE=0`）
  - `0.7.68`：Worker 限流（每 IP 每 colo **100 次 / 10s** POST `/modes`）+ KV 命中后不再并行 wait_chain + 空 unknown 负缓存 6h + body 64KB 封顶；插件遇 429 拉长退避
  - `0.7.67`：Worker/后端拒收探测 CA（全 0 尾、`abcdef`/`deadbeef` 等占位、低熵重复块）→ `invalid`，不读不写 KV；空 `unknown` 也不落 KV
  - `0.7.66`：Worker 错误修复 — 去掉跨请求共享 upstream Promise（插件 Abort 后 joiner 挂死 → hang detector → 仪表盘「错误」暴涨）；KV 仍只写 miss
  - `0.7.65`：Worker KV 账单修复 — 并行回源后**只对真正 KV miss 的 key `put`**；KV 全命中不再重写（此前冷 isolate 每次 mem miss 都会把已缓存 CA 再写一遍，单日可达 ~100 万次 Write ≈ $5）
  - `0.7.57`：热通道并行请求 — 主批 /modes 在途时，GMGN 列表页热 token（视口/新创建未画，上限 12）走第二条并行 /modes，不再被单飞 `batchActive` 锁排队；共享 `processModesResponse`；watchdog/resume/hardReset 同步回收热通道。Worker 同步：mem miss 后 **KV 读与回源并行**（js-mcp 实测 KV 冷读 ~250ms 且新币必 miss；新卡 ⏳→徽章 p50 1107→943ms）
 - `0.7.56`：新币徽章提速 — 插件新卡组批窗 500→200ms（满 2 张即发）、热路径单 token 组批 200→120ms；Worker `DIRECT_FILL_CAP` 12→24（首屏冷批一轮 wait_chain 回齐）；后端 `FLAP_FEE_RPC_RPS_LIMIT` 30→40（QN 24h 零 429，有余量）
 - `0.7.55`：文章样式降载与可调 — GMGN 上 observer 不订阅 characterData（战壕价格跳动不再进回调）；禁区全页清扫仅路由变化时执行；长文（>400 字）词典整词只出现一次的不标（词频降噪，复用已收集命中不加遍历）；屏蔽词（弹窗管理 + 双击胶囊即屏蔽，`skips` 存入 articleStyle.v1，覆盖词表/大写/英文高亮全通道）；胶囊配色跟随 badgeTheme 深浅主题；清 CSS.highlights 死代码；句首全名 lookahead 容忍 1–2 个空格
 - `0.8.10`：GMGN 战壕徽章挂 `.trenches-tax` 右侧同行；K 线返回后 name-after / Tax 内芯错位强制重挂
 - `0.8.11`：新创建 host-fee 分红仍是 BNB 时先 ⏳；host-fee 不再取消 /modes；Tax 股票芯片不当底池
 - `0.8.12`：K 线顶栏底池与战壕同一过滤；👨‍🍳 箭头忽略 NVDAB/NVDA 股票芯片
 - `0.8.13`：K 线内嵌战壕新卡走首页同一快路径；host-fee/modes/guardian 视口快补侧栏
 - `0.8.14`：K 线刷新后按 TokenItem 列轮询补画新创建（不再被顶栏 href / 8ms 预算饿死）
 - `0.8.15`：顶栏 settled 后侧栏仍有未画卡则禁止 light-scan，继续扫 PumpSub 新创建
 - `0.8.16`：非 vault 底池认 Tax 外芯片 / API quote（SPCX/QQQ 等），不再误判股票后回退 BNB；vault 仍 BNB
 - `0.8.17`：GMGN 底池/税收图按 `TaxDividendTokenIcon` vs Tax 外 `/static/quotes` 角色解析；启动拉 `quotes.json` 预留新 quote；分红可读 `tokenInfo`（含 external-res 新代币）
 - `0.8.18`：tooltip 篮子 name/底池/买卖税改 textContent；`basket_assets.name` 剥 `<>`（issue #1）
 - `0.8.19`：Debot 战壕按 666×129 行卡局部扫 + Tax 旁挂载；pending 快重试/热通道/新卡 mutation（对齐 GMGN）
 - `0.8.20`：Debot 徽章改挂 overflow:hidden 名称列外侧，长标题/待加仓不再裁掉
 - `0.8.21`：host-fee 分红仍是 BNB 时 `__needsChain` 保持并继续 `/modes`，新创建不再卡 ⏳
 - `0.8.22`：金库 preview 空篮子先 ⏳；后续 WS/Tax 图标篮子可覆盖链上空 🎁
 - `0.8.23`：Debot 停滚对当前列 cache-first 补画 + href scrub（对齐 GMGN PumpSub settle）；K→战壕 soft 窗不再进入滚动冷却
 - `0.8.24`：文章样式域名可带路径（`debot.ai/popout/xTracker`）；注入/权限/运行时按路径前缀匹配，不再剥成整站
 - `0.8.25`：GMGN `mutil_window_token_info` 的 `pool.quote_symbol`（NVDAB）补丁升级默认 BNB；单枚 dividend_tokens 不再当币股 vault（避免把 NVDA 池打成 BNB）；Tax 外池芯片与徽章不一致则重挂
 - `0.8.26`：许可证新设备换绑 — 验证 `device_mismatch` 时先保存密钥并显示「换绑到此设备」（不再要求 storage 里已有 key）
 - `0.8.27`：底池符号稳妥回退 — Tax 外 quotes 文件名 → quote_address 目录 → 非 BNB 的 WSS/HTTP 符号 → 确认空地址才默认 BNB；Tax 内多枚图不当单一分红
 - `0.8.28`：资金接收方白名单 — GMGN `market_address`/`creator`、Debot `fee_receiver`/`founder_address` 命中则不屏蔽
 - `0.8.29`：0.8.27 底池回退热路径降载 — 稳定卡跳过 quotes DOM；站点分离 + WeakMap 短缓存
 - `0.8.30`：Worker 强制鉴权（`REQUIRE_LICENSE=1`）；弹窗提示「即将收费，请先填密钥」
 - `0.8.31`：GMGN hybrid 长徽章 — 绝对坐标/Tax 几何不再每轮当错位拆挂
 - `0.8.32`：文章样式禁止改 `<title>`；Debot 交易页（dex-swap/K线/战壕）整站域名不扫；顶栏徽章不进名称行
 - `0.8.33`：徽章悬停详情浮窗（`displayPrefs.hoverTip`，默认关）；浮窗不接收指针，滚动/SPA/锚点丢失必关
 - `0.8.34`：文章重点样式独立暗色/浅色两套主题（暗色页实心荧光笔，浅色页淡底深字）
 - `0.8.35`：GMGN `/follow?popout=true&target=xTracker` 不在本窗跳 K 线/搜索，改去其它 GMGN 标签
 - `0.8.36`：Debot/Gungnir `/popout/xTracker` 同样不在本窗跳 K 线/搜索
 - `0.8.37`：新卡 Tax 内 quotes 不当底池；中文 name 不当分红 ticker；host-fee 分红未齐短窗后仍画，避免永远 ⏳；WeakMap 绑 href
 - `0.8.38`：host-fee 已有分配 bps 时不再因 `__needsChain` 把 ⏳ 拖到 `/modes`（约 30s）
 - `0.8.39`：GMGN 新卡从 TokenItem 祖先 fiber `props.data.tax_allocation` 提取分配（修 Object.keys 读不到 __reactFiber）；不依赖页面 WSS/SharedWorker
 - `0.8.40`：虚拟列表复用时 Tax 内图滞后会导致 💎→SPCX 锁在新卡上；href 切换先拆徽章，分红以 fiber 地址/底池外图为准
 - `0.8.41`：解析 SharedWorker `pumpRank-bsc` 推送外壳（WSS PATCH / HTTP SNAP_SHOT）；页面无裸 WSS
 - `0.8.42`：双通道 — SharedWorker Port + 页面 WSS（无 SW / disableShareWorker）+ HTTP 快照 + 卡片 fiber
 - `0.8.43`：宿主 tooltip 分红是中文名时徽章出 →牛来；Tax 内拉丁图仍覆盖中文发射名
 - `0.8.44`：纯税收金库（tooltip「税收钱包-金库」）禁止用虚拟列表残留 Tax 内股票图升成 📈；空篮子直接 🎁
 - `0.8.45`：虚拟列表换卡后 Tax 内图未刷新视为残留（💎/📈 都不信）；禁止 DOM 发明篮子；flap_stocks 空篮子等 fiber；Debot 底池不用 bstocks
 - `0.8.46`：Flap Stocks 单成分金库（宿主「税收钱包-金库 FXION 100%」）识别为 📈FXIO，不再画成 💎→XAUT / 📈→BNB
 - `0.8.47`：快路径只信 fiber 分配；空篮子不再永远 ⏳；纯金库覆盖 leftover 📈；BNB 池不把残留 QQQB/FXIO 当底池/分红
 - `0.8.48`：15min 新创建采样 — 去掉 marketing+market_address⇒🎁；fiber 金库覆盖 leftover 💎QQQB
 - `0.8.49`：新卡 ⏳ 满 1s 仍无真徽章则立刻 flush `/modes`（host-fee 短窗同步收到 1s）
 - `0.8.50`：二次 15min 采样 — fiber 创作者覆盖 leftover 💎QQQB
 - `0.8.51`：刷新卡顿降载 — host-fee Mutation 合并扫描、JSON.parse 禁止 stringify 再解析、同对象只收集一次、GMGN 首扫不 force
 - `0.8.52`：三次 15min 采样 — 金库 WBNB 分红篮子不当 📈；BNB-only 不升币股（雪球太空猫 🎁→📈）
 - `0.8.53`：fiber 空篮子金库仍打 `/modes`；Helper 单成分 📈FXIO；宿主金库可覆盖旧 KV 🔥（张停/FXION）
 - `0.8.54`：普通税收金库底池跟 Helper/Pancake quote（狗屎蛙 `🦋QQQB | 🎁→QQQB`）；仅币股篮子仍固定 BNB
 - `0.8.55`：篮子若只是底池报价（SPCXB）仍画税收金库 `🦋SPCX | 🎁70%→SPCX`，不要 📈 也不要强制 BNB
 - `0.8.56`：金库 / 股票名报价 / 单成分篮子 fiber 不定案，⏳ 等 `/modes`；链上结果不被 host-fee 覆盖
 - `0.8.57`：15min 新创建 — 稳的 💎/👨‍🍳/已出成分 📈 快路径；空金库与无成分币股走 `/modes`；降扫卡 debounce
 - `0.8.58`：刷新卡顿 — `JSON.parse` 先判 s_tal 再解析；hydration 1.6s 内不整列扫 fiber；K 线 boot 少两次视口扫
 - `0.8.59`：GMGN 列表过滤（资金接收/金库/尾号）改条件后整页 reload，首包走已挂钩 HTTP；Debot 仍局部刷新
 - `0.8.60`：可选「搜索框结果也屏蔽」（默认关）；仅弹层打开时扫；search_v3 无 s_tal，按徽章/fee 缓存 DOM 隐藏
 - `0.8.62`：Debot 列表/搜索过滤对齐 GMGN — 改条件整页 reload；搜索弹层可屏蔽 👨‍🍳/🎁/📈；金库 DOM 兜底
 - `0.8.63`：Debot 对齐 GMGN 扫描架构 — 砍 keep-alive force 扫、列根 scoped observer、K 线 settled 不 light 扫；新创建 👨‍🍳 HTTP 字段补齐 + 徽章兜底；隐藏行卡而非整列
 - `0.8.64`：Debot 10min 实采 — `founder_pct_vault:0` 挡住 `founder_pct_dev`；稳的 💎/👨‍🍳 走快路径不打 /modes；HTTP/WS 过滤同一套 pct
 - `0.8.65`：Debot 新卡走 SharedWorker `portal-ws-shared`（页面看不见 WSS）；过滤 Port `{type:socket-event,event:meme:new,args}`；`disableShareWorker` 仅 GMGN
 - `0.8.66`：Debot /modes 降频 — 新卡 200ms/2 张组批（对齐 GMGN）；host-fee 就绪即出队；扫卡只取三列视口
 - `0.8.67`：Debot Port 抽到 extra 后立刻 postMessage host-fee，避免 MO 入队后再打 /modes
 - `0.8.68`：Debot `/modes` 每秒单打 — 空金库改 1.6s/2 张组批，禁热通道与 1s kick 立刻 flush；扫/更新限定三列 MuiPaper（对齐 GMGN 局部扫 + 按 CA 定向画）
 - `0.8.69`：Debot 只扫 BSC 卡（href `/token/bsc` + ranks `chain:bsc`）；K→战壕改列根门禁 + cache-first burst/fill（修 first80 ticker 挡住 2.5s）
 - `0.8.70`：Debot 回战壕首波快绘 16→28，避免三列 22 张目标漏 5；burst 更密
 - `0.8.71`：Debot 徽章贴 Tax 列外侧绝对定位，不再进 space-between 挤掉 MC/买；列表扫间隔/mutation debounce 对齐 GMGN
- 插件当前版本：见 `extension/manifest.json`（**0.8.71**，公开无剪切板）
- page-hook：`HOOK_VER` **112**（公开无 writeText 钩；完整包另注 `page-hook-clip.js`）
- 定链缓存：`flapFeeInfo.clipJump.chainCache.v2` = `{ [ca]: { chain, kind:"token", at } }`（仅完整包；只存已确认代币）
- 缓存 key 升级：改持久化字段时 bump `flapFeeInfo.modeCache.vN`（当前 `v5`）  
- 显示偏好：`flapFeeInfo.displayPrefs.v1`（popup + content 共享；`hoverTip` 默认 `false`）  
- 徽章主题：`flapFeeInfo.badgeTheme.v1` = `dark`（默认）| `light`  
- 尾号屏蔽：`flapFeeInfo.suffixHide.v1` = `{ enabled, rules:[{id,suffix,enabled}] }`（最多 24 条 hex 1–12 位）
- 资金接收：`flapFeeInfo.taxRecvHide.v1` = `{ enabled, thresholdPct, allow:[{id,address,enabled}] }`（白名单最多 24 个 0x 地址）
- 搜索框也屏蔽：`flapFeeInfo.searchHide.v1` = `{ enabled:false }`（默认关；开启后把已启用的资金接收/金库规则套到 GMGN 搜索弹层）
- 剪切板跳转：`flapFeeInfo.clipJump.v1` = `{ enabled:false, target:"gmgn"|"debot", sites:"both"|"gmgn"|"debot", activeTabOnly:true, reuseSiteTab:false, pageMarkCa:false, overrideHostCa:false }`（默认关；开启需确认 + `clipboardRead` 可选权限）
- 许可证（可选，默认免费）：`flapFeeInfo.license.v1` = `{ key:"" }`；有 key 时 content 带 `Authorization: Bearer`；Worker `REQUIRE_LICENSE` 默认 `0`（不强制）；开启付费时设 `1` 并写入 KV `license:<key>` → `{ exp, plan:"flap", flap_perm?:1 }`；**发卡**：TG Bot `flap_fee` **0.01 BNB/月**（动态尾数 0.009501~0.010100）；详见 `ENABLE_FLAP_MONETIZATION.md`
- 复制即搜（仅完整包 / 仅 GMGN）：`flapFeeInfo.clipSearch.v1` = `{ enabled:false, minChars:2, maxChars:8 }`（默认关；开启需确认 + `clipboardRead`；与跳转共用 `clipJump.seen.v1` 去重）
- 文章重点样式（仅完整包）：`flapFeeInfo.articleStyle.v1` = `{ enabled:false, theme:"dark"|"light", domains:[{id,host,path?,enabled}], nouns:[{id,word,enabled}], skips:[{id,word,enabled}] }`（默认关；`theme` 默认 `dark` 实心荧光笔，独立于徽章主题；`host` 可带路径如 `/popout/xTracker`；`skips` 屏蔽词最多 48 条）

---

## 11. 相关文档索引

| 文件 | 内容 |
|------|------|
| `README.md` | 用户安装与图标说明 |
| `ENABLE_FLAP_MONETIZATION.md` | **收费启用运行手册**（Agent 按步骤开 REQUIRE_LICENSE + KV 发卡） |
| `server/README.md` | 本地 API / 响应示例 |
| `server/deploy-hk0.md` | VPS 部署 |
| `cloudflare/README.md` | Worker secret / deploy |
| `tools/ctl.py` | 远端运维入口 |

---

*维护原则：架构变更（层、字段、域名、Helper）必须先改本文档对应章节，再改代码。*
