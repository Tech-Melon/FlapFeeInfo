# FlapFeeInfo — 开发文档（给 Agent / 后续开发者）

> 项目名：技术瓜FlapFeeInfo  
> 公开仓库：https://github.com/Tech-Melon/FlapFeeInfo（默认 **只发布插件** `extension/`）  
> 本地工作区：含后端、CF Worker、插件三层全栈代码  

本文档面向 **Agent 与开发者**，说明架构、约定与改动入口。用户安装说明见根目录 `README.md`。

---

## 1. 项目目标

在 **GMGN / Debot / Gungnir** 等 meme 列表页上，给 BSC 上 Flap 税收代币（地址尾号 **`8888` 或 `7777`**）展示 **税收分配徽章**。

| 展示 | 含义 | 链上字段 |
|------|------|----------|
| 💎`N%` | 持有人分红 | `dividendBps` |
| 👨‍🍳`N%` | 创作者/营销（非 vault） | `marketBps` 且 `!isVault` |
| 🎁`N%` | vault gift（含币股等金库） | `marketBps` 且 `isVault` |
| 🔥`N%` | 销毁 | `deflationBps` |
| 💧`N%` | 回流 LP | `lpBps` |
| ❓️未 | 无有效分配 | 全 0 |

- **有值才出**；多项非零 → `mode=hybrid`，label 如 `💎90%👨‍🍳10%`  
- **买卖税率**只进 tooltip（`title`），不进主文案  
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
| 插件 | `extension/` | 扫卡、抽地址、批量请求、画徽章、chrome.storage | 不直连 VPS、不查链 |
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
```

插件侧可用 bps **本地再拼紧凑 label**（去空格），后端 `label`/`title` 仍以 API 为准。

### 4.3 API 响应（`POST /modes`）

```json
{
  "ok": true,
  "results": {
    "0x...7777": {
      "mode": "hybrid",
      "label": "💎90% 👨‍🍳10%",
      "title": "税收分配: ...\n买税 1% | 卖税 1%",
      "dividend_bps": 9000,
      "market_bps": 1000,
      "deflation_bps": 0,
      "lp_bps": 0,
      "is_vault": false,
      "buy_tax_bps": 100,
      "sell_tax_bps": 100,
      "fetched_at": 1730000000,
      "source": "chain|memory|sqlite|cf-memory|cf-kv"
    }
  },
  "missing": [],
  "invalid": []
}
```

缓存：

- 后端：内存 + SQLite `payload` JSON；**无完整 payload 的旧行当 miss**  
- Worker：内存 + KV；**缺 label/bps 的旧条目当 miss**  
- 插件：`chrome.storage` key `flapFeeInfo.modeCache.v2`

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

### 4.5 验收样本

| CA | 期望 |
|----|------|
| `0x556f0944357fb9a789c4a374095d3ce9ffba7777` | `💎90%👨‍🍳10%` hybrid |
| `0x789476401ce0df8805f6e8a9a1e7439aac117777` | `🎁100%` gift（币股 vault） |

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
| `FLAP_FEE_BSC_RPC` | BSC RPC |
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
| 后台久置再切回徽章消失 | 定时器/fetch 被冻结、`batchActive` 卡住、DOM 回收 | `0.2.5+` 监听 visibility/focus 强制 resume；仍异常再刷新 |
| 徽章被裁半截 | 挂在 Tax 芯片内 / overflow | 外侧挂载 + CSS `min-width:max-content`（已做） |
| 只有 mode 无比例 | 命中旧缓存 | 清 storage 或等 miss；schema 已强制完整 payload |
| Worker 403 | 无 UA / 边缘防护 | 浏览器正常；脚本请求带浏览器 UA |
| 7777 无图标 | 未重载 0.2.x 插件 | 确认 manifest version |

---

## 10. 版本与变更提示

- 插件版本：`extension/manifest.json` → `version`（发布前递增）  
- 近期能力：`0.2.x` = 结构化分配 + 7777 + hybrid 展示 + Gungnir  
- 缓存 key 升级：改持久化字段时 bump `flapFeeInfo.modeCache.vN`

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
