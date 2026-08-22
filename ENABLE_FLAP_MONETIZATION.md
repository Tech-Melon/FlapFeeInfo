# FlapFeeInfo 收费启用运行手册（给 Agent / 运维）

> **用途**：开启付费时把本文档交给 AI，按检查表逐步执行。  
> **当前状态（2026-08-22）**：**免费模式**（`REQUIRE_LICENSE=0`）；发卡/KV/单设备绑定代码已就绪，上线时改 `1` 并 `wrangler deploy`。  
> **定价**：`flap_fee` = **0.01 BNB/月**；动态尾数 **0.009501 ~ 0.010100**（6 位小数防撞单，与打包 0.095 同策略）。

---

## 0. 端到端架构

```text
用户 TG Bot 下单
  → 展示精确金额（如 0.009873 BNB，含随机尾数）
  → 用户 BSC 转账 + 提交 TXID
  → weibo 后端 handle_subscription → access_key + expire_date
  → 【自动】CF KV put license:<access_key>  { exp, flap_perm:1 }
        ↓
用户 Chrome 插件
  → 弹窗粘贴 access_key → storage flapFeeInfo.license.v1
  → POST /modes  Header: Authorization: Bearer <access_key>
        ↓
Cloudflare Worker
  REQUIRE_LICENSE=0  → 不校验（当前）
  REQUIRE_LICENSE=1  → 读 KV；无/过期/无 flap_perm → 401
        ↓
VPS Python API（算链上税收分配，与许可无关）
```

| 层 | 路径 | 收费状态 |
|----|------|----------|
| 插件 | `extension/` ≥0.7.69 | 许可证 UI + Bearer |
| Worker | `cloudflare/` | 门闩已实现；`REQUIRE_LICENSE=0` |
| 发卡 Bot | `57.google_sheets` → hk0 | `flap_fee` 0.01 BNB；`ENABLE_FLAP_PLAN=0` 隐藏按钮 |
| 表格监控 | hk0 `payment_monitor` | **已永久停用**（`.main_stopped`） |

---

## 1. 已完成（代码侧）

- [x] 插件 `flapFeeInfo.license.v1` + `Authorization: Bearer`
- [x] Worker `checkClientLicense()` + KV 结构 `license:<key>`
- [x] `PRICE_CONFIG["flap_fee"]`：**0.01 BNB**，`min/max` 覆盖动态尾数区间
- [x] `database.alloc_dynamic_price()`：0.01 与 0.095 同为 `0.0095/0.0945 + 6 位尾数`
- [x] 订单双槽：`dynamic_price` + `alt_price`（币安扣 0.00001）
- [x] `payment_core.sync_flap_license_to_kv()`：发卡成功写 CF KV
- [x] `tg_bot.py`：Flap 订单专用发卡文案 + KV 同步失败管理员告警
- [x] Google 表单通道停用，仅 TG Bot

---

## 2. 上线前人工配置（必做）

### 2.1 hk0 `.env` 配置 KV 同步（二选一）

**推荐：经 Worker 写入**（与 FlapFeeInfo 已有的 KV binding 同源，**不需要** `CF_ACCOUNT_ID` / `CF_API_TOKEN`）

```env
FLAP_WORKER_BASE_URL=https://flap-fee-info.tech-melon.workers.dev
FLAP_LICENSE_SYNC_TOKEN=<与 Worker secret UPSTREAM_API_TOKEN 相同>
ENABLE_FLAP_PLAN=1   # 上线月再开
```

发卡成功后 Bot 调 `POST /admin/sync-license`，Worker 内部 `FLAP_FEE_CACHE.put("license:…")`。

> **说明**：Worker 平时写的 `fee-mode:0x…` 是税收缓存；`license:<access_key>` 是许可证，需发卡侧触发写入（Worker 不会自动从 `/modes` 推导许可证）。

**备选**：直连 Cloudflare REST API（仅当不走 Worker 时）— 需 `CF_ACCOUNT_ID` + `CF_API_TOKEN`。

### 2.2 weibo 后端 `58.weibo_monitor`（已改造要点）

- `users.flap_perm` 字段 + `handle_subscription` 接收 `flap_perm`
- **权限合并**：续费时 `max(已有, 本次购买)`，避免只买 Flap 时把微博权限清零
- **同一 `access_key`**：微博站登录与 Flap 插件 Bearer 共用；Flap 能否用还取决于 KV 是否有 `license:<key>`

部署 weibo 服务后重启 app。

### 2.3 插件发布

1. `extension/manifest.json` 递增版本（建议 0.8.0）
2. popup 补充：购买渠道 = TG Bot、0.01 BNB/月
3. `python _run_pack_extension.py` 打包
4. 公开仓 commit + 用户重载扩展

---

## 3. 定价与防撞单（运维须知）

| 套餐 | 标价 target | 动态应付范围 | 核验 min ~ max |
|------|-------------|--------------|----------------|
| 打包95折 | 0.095 | 0.094501 ~ 0.095100 | 0.0939 ~ 0.0960 |
| **Flap 徽章** | **0.01** | **0.009501 ~ 0.010100** | **0.00950 ~ 0.01015** |
| 微博/公众号 | 0.05 | 0.05001 ~ 0.05099 | 0.0485 ~ 0.0515 |

- 用户必须按 Bot 给出的**含尾数**金额支付；多付/少付无法匹配订单
- 币安提现路径：到账 `alt_price = 应付 - 0.00001` 也可核销
- Flap **不参与**老用户折扣（`plan_key == flap_fee` 跳过折扣 API）

配置入口：`57.google_sheets/payment_core.py` → `PRICE_CONFIG`  
尾数算法：`57.google_sheets/database.py` → `alloc_dynamic_price()`

---

## 4. 正式上线步骤

### Phase A — 灰度（Worker 仍免费）

1. hk0 配好 `CF_*` + `ENABLE_FLAP_PLAN=1`，部署最新 `payment_core.py` / `database.py` / `tg_bot.py`
2. 自测一笔 **0.01 BNB 档**（实际付 Bot 给出的尾数金额）：
   - [ ] TG 收到 Flap 专用发卡文案（含插件填 key 说明）
   - [ ] `tg_bot.log` 出现 `Flap KV 已同步 license:…`
   - [ ] `wrangler kv key get --namespace-id=… "license:<access_key>"` 有 JSON
   - [ ] 插件填 key，徽章正常（此阶段 `REQUIRE_LICENSE` 仍为 0）

### Phase B — 强制鉴权

3. `cloudflare/wrangler.jsonc` → `"REQUIRE_LICENSE": "1"`
4. `cd cloudflare && wrangler deploy`
5. 验收：
   - 无 Bearer → `401 license_required`
   - 坏 key → `license_invalid`
   - 有效 key → `200` + 正常 `results`
   - 过期 → `license_expired`

### Phase C — 公告

6. README / TG / GitHub Release：Bot 链接、0.01 BNB/月、密钥填入位置、续费方式
7. 观察 24h：401 比例、KV 同步失败告警、发卡 API 延迟

---

## 5. 回滚

| 情况 | 操作 |
|------|------|
| 大面积无法加载徽章 | `REQUIRE_LICENSE=0` → `wrangler deploy`（秒级恢复免费） |
| KV 漏写 | `wrangler kv key put … license:<key> '{"exp":…,"plan":"flap","flap_perm":1}'` |
| 误开表格监控 | 保持 `.main_stopped`，勿恢复 `payment_monitor` |
| 临时关 Flap 购买 | `ENABLE_FLAP_PLAN=0` + restart `tg_bot_monitor` |

---

## 6. Agent 检查表

```markdown
- [ ] 读本文档 §0–§3
- [ ] hk0 .env：CF_ACCOUNT_ID、CF_API_TOKEN、ENABLE_FLAP_PLAN=1
- [ ] scp 最新 payment_core / database / tg_bot → hk0；restart tg_bot_monitor
- [ ] 确认 weibo handle_subscription 支持 flap_perm=1
- [ ] 自测 0.01 档全流程 + KV 可读
- [ ] extension 版本 + 用户说明 + 打包
- [ ] wrangler REQUIRE_LICENSE=1 + deploy
- [ ] 无 key / 坏 key / 好 key 验收
- [ ] 公告 + 24h 监控
```

---

## 7. 关键文件

| 用途 | 路径 |
|------|------|
| 套餐与 KV 同步 | `57.google_sheets/payment_core.py` |
| 动态尾数 | `57.google_sheets/database.py` → `alloc_dynamic_price` |
| TG Bot | `57.google_sheets/tg_bot.py` |
| Worker 鉴权 | `cloudflare/worker.js` |
| Worker 开关 | `cloudflare/wrangler.jsonc` |
| 插件密钥 | `extension/popup.js`, `content.js` |
| hk0 生产 | `/home/dev/workspace/weiboSubscriptionReminder/` |
| 停用表单 | hk0 `.main_stopped` |

---

## 8. 一句话指令（交给 AI）

```text
请阅读 ENABLE_FLAP_MONETIZATION.md，完成 §2 人工配置与 §4 Phase A–C；
确认 flap_fee=0.01 BNB 动态尾数与 KV 同步正常后再开 REQUIRE_LICENSE=1；
不要恢复 payment_monitor。
```

---

*文档版本：2026-08-22 · 插件 0.7.69 · flap_fee 0.01 BNB · KV 同步已实现*
