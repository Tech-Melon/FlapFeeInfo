(() => {
  const DEFAULT_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";
  const TOKEN_RE = /0x[a-fA-F0-9]{40}/;
  // Flap tax 8888/7777 + Four.meme tax ffff
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777|ffff)$/i;
  // Ellipsis may be "..." or Unicode "…" (logged-in Debot header).
  const SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}(?:\.{2,}|\u2026|\u22ef)[a-fA-F0-9]{2,6}/i;
  const TARGET_SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}(?:\.{2,}|\u2026|\u22ef)(8888|7777|ffff)/i;
  const GMGN_TRENCH_ROOT_SELECTOR =
    "div.flex.flex-col.flex-1.overflow-hidden, div.flex.flex-col.flex-1.border-line-100";
  // Stable GMGN surfaces from the live DOM. Prefer these over page-wide wrappers;
  // class-only fallbacks remain below for builds that omit Sentry metadata.
  const GMGN_FIXED_TRENCH_ROOT_SELECTOR =
    '[data-sentry-source-file="PumpSubX.tsx"], [data-sentry-source-file="PumpSubAX.tsx"]';
  const GMGN_FIXED_SEARCH_ROOT_SELECTOR =
    '[data-sentry-source-file="SearchModalDetail.tsx"]';
  // GMGN TokenItem 现用 .trenches-tax 包 Tax 芯片；徽章必须 afterend 该节点，
  // 不能挂进 16px 内芯，也不能 name-after 掉到标题下一行（K 线返回必现）。
  const GMGN_TRENCH_TAX_SELECTOR = ".trenches-tax";
  // 0.8.71: Debot 战壕徽章绝对贴 Tax 列外侧（不再进 space-between 挤掉 MC/买）；列表扫间隔对齐 GMGN。
  // 0.8.70: Debot 回战壕快绘 16→28 / 12ms→22ms，首波铺满三列视口（js-mcp: 22 目标被 16 上限漏 5）。
  // 0.8.69: Debot 只认 /token/bsc 与 row.chain=bsc；K→战壕列根门禁 + cache-first burst（对齐 GMGN）。
  // 0.8.68: Debot 对齐 GMGN — 三列局部扫 + 按 CA 定向更新；空金库组批，禁 1s 单打 /modes 与热通道。
  // 0.8.67: Debot Port host-fee 立即 postMessage；新卡组批 200ms；就绪即出 /modes 队。
  // 0.8.66: Debot /modes 降频 — 新卡组批对齐 GMGN（200ms/2张）；host-fee 就绪即出队，
  //          禁止每张新卡 80ms 单打 + 热通道。
  // 0.8.65: Debot 新卡对齐 GMGN — 过滤 SharedWorker portal-ws `socket-event`/`meme:new`；
  //          disableShareWorker 仅 GMGN；host-fee 从 Port args 提取。
  // 0.8.64: Debot 快路径 — founder_pct_dev 才是 👨‍🍳；vault 字段为 0 时不要 ?? 挡住。
  //          稳的 💎/👨‍🍳 不打 /modes；新卡不再 ⏳ 等链。过滤走 WS+HTTP 同一套 pct。
  // 0.8.63: Debot 对齐 GMGN — 砍 keep-alive force 扫、列根 scoped observer、
  //          新创建 👨‍🍳 HTTP+徽章兜底；隐藏行卡而非整列 viewport。
  // 0.8.62: Debot 列表过滤改条件后整页 reload；搜索弹层同样可屏蔽；金库走 DOM 兜底。
  // 0.8.60: 搜索弹层可选套用资金接收/金库屏蔽（默认关；仅弹层打开时扫，search_v3 无 s_tal）。
  // 0.8.59: GMGN 列表过滤（资金接收/金库/尾号）改条件后整页 reload，首包走已挂钩 HTTP。
  // 0.8.58: 刷新降载 — JSON.parse 先过滤再解析；hydration 1.6s 内不整列扫 fiber；少 boot 扫。
  // 0.8.57: 稳的 💎/👨‍🍳/已出成分的📈 走快路径；空金库/无成分币股走 /modes。降 mutation 负载。
  // 0.8.56: 金库/股票名报价/单成分篮子本地不定案，交给 /modes；链上结果不被 host-fee 覆盖。
  // 0.8.55: 篮子若只是底池报价币（SPCXB）则仍是税收金库，不要 📈 也不要强制 BNB。
  // 0.8.54: 普通税收金库底池跟 Helper/Pancake quote（QQQB），仅币股篮子仍固定 BNB。
  // 0.8.53: 空篮子金库仍打 /modes；单成分 Helper 篮子画 📈FXIO；宿主金库可覆盖旧 KV 🔥。
  // 0.8.52: 三次 15min — 金库 WBNB 分红不当 📈 篮子；BNB-only 篮子不升币股。
  // 0.8.51: 刷新降载 — host-fee DOM 合并扫描、JSON.parse 不再二次序列化、首扫不 force。
  // 0.8.50: 二次 15min 采样 — fiber 创作者覆盖 leftover 💎QQQB。
  // 0.8.49: ⏳ 满 1s 仍无真徽章则立刻 flush /modes；host-fee 短窗也收到 1s。
  // 0.8.48: 15min 采样 — 勿把 marketing+market_address 当成 🎁；fiber 金库覆盖 leftover 💎QQQB。
  // 0.8.47: 空篮子币股不再永远 ⏳；fiber 空金库覆盖 leftover 📈；BNB 池不信残留股票图。
  // 0.8.46: Flap Stocks 单成分金库（FXION 100%）画 📈FXIO，不再当成 💎 或 📈→BNB。
  // 0.8.45: href 复用后 Tax 内图未换则视为残留（💎/📈 都不信）；禁止 DOM 发明篮子；Debot 底池不用 bstocks。
  // 0.8.44: 纯税收金库勿用虚拟列表残留 Tax 内股票图升成 📈；空篮子 🎁 立即画，不再等 leftover。
  // 0.8.43: 宿主分红是中文名（牛来）时徽章显示 →牛来；Tax 拉丁图（AAPLB）仍优先于中文发射名。
  // 0.8.42: 双通道兼容 — SharedWorker Port + 页面 WSS + HTTP 快照 + 卡片 fiber，按浏览器自动走通。
  // 0.8.41: 监听 SharedWorker pumpRank-bsc 外壳（res.data.newCreations）；WSS 推送进徽章，漏推走 HTTP/fiber。
  // 0.8.40: 虚拟列表复用勿把上一张卡 Tax 内图当分红；href 切换先拆徽章；host-fee 纠正错误 ticker。
  // 0.8.39: 新卡徽章改走 React fiber tax_allocation（不依赖页面 WSS；SharedWorker 通道对插件不可见）。
  // 0.8.38: 新卡 host-fee 有分配后不再因 __needsChain 卡 ⏳ 到 /modes（约 30s）；短窗后仍画。
  // 0.8.37: 新卡 Tax 内图不当底池；中文 name 不当分红 ticker；⏳ 分红未齐短窗后仍画；WeakMap 绑 href。
  // 0.8.36: Debot/Gungnir `/popout/xTracker` 与 GMGN 文章弹窗一样，不在本窗跳 K 线/搜索。
  // 0.8.35: GMGN xTracker popout 不在本窗跳 K 线/搜索，改去其它 GMGN 标签（完整包）。
  // 0.8.34: 文章重点样式独立暗色/浅色主题（完整包）。
  // 0.8.33: 徽章悬停详情浮窗默认关；修浮窗粘住（pointer-events + 锚点丢失必关）。
  // 0.8.32: Debot/GMGN 禁止改 <title>；Debot 交易页不跑文章样式；顶栏徽章不进名称行。
  // 0.8.31: hybrid 长徽章不再因 Tax 几何/绝对坐标被每轮拆挂（消失闪烁）。
  // 0.8.30: Worker 强制鉴权（REQUIRE_LICENSE=1）；弹窗提示先填 TG Bot 密钥。
  // 0.8.29: 0.8.27 底池回退热路径降载 — 稳定卡不每轮扫 quotes；站点分离 + WeakMap 短缓存。
  // 0.8.28: 资金接收方白名单 — GMGN market_address/creator、Debot fee_receiver 命中则不屏蔽。
  // 0.8.27: 底池/分红符号：Tax 外/内 quotes 文件名最稳；BNB 视为未齐，回退地址目录/HTTP。
  // 0.8.26: 许可证换绑 — 新设备验证冲突时保留密钥并显示「换绑到此设备」。
  // 0.8.25: GMGN HTTP/WSS 后补 pool.quote（NVDAB）升级 🦋BNB，不再停在默认底池。
  // 0.8.24: 文章样式可填路径（debot.ai/popout/xTracker），不再把完整 URL 剥成整站。
  // 0.8.23: Debot 停滚对当前列 cache-first 补画 + href scrub（对齐 GMGN PumpSub settle）。
  // 0.8.22: 金库 preview 缺篮子先 ⏳；后续 WS/Tax 图标补全能覆盖空篮子 🎁。
  // 0.8.21: host-fee 分红仍是 BNB 时继续打 /modes，避免新创建永远 ⏳。
  // 0.8.20: Debot 徽章挂 overflow 隐藏列外侧，避免长标题/待加仓把 Tax 旁徽章裁掉。
  // 0.8.19: Debot 战壕按行卡局部扫（对齐 GMGN）；pending 快重试；徽章挂 Tax 旁。
  // 0.8.18: tooltip 篮子 name/sym 与底池/买卖税一律 textContent，禁止远端字段进 innerHTML。
  // 0.8.17: GMGN 底池/税收图按 DOM 角色 + quotes.json 目录；新 quote/分红 token 不靠硬编码名单。
  // 0.8.16: 非 vault 底池认 Tax 外芯片 / API quote（SPCX 等）；禁止误判成股票后回退 BNB。
  // 0.8.15: 顶栏 settled 后若侧栏仍有未画卡，禁止改 light-scan，继续扫 PumpSub。
  // 0.8.14: K 线刷新后侧栏按 TokenItem 列轮询补画（禁 8ms/顶栏 href 把新创建饿死）。
  // 0.8.13: K 线内嵌战壕新卡走 collectGmgnNewCardMutations + 视口快补（顶栏 settled 后不再饿死）。
  // 0.8.12: K 线顶栏用 resolveQuoteSymbol；👨‍🍳 箭头把 NVDA/NVDAB 当股票芯片。
  // 0.8.11: 新创建 host-fee 分红未齐先 ⏳；不取消 /modes；Tax 股票芯片不当底池。
  // 0.8.10: 战壕→K线返回 — 徽章贴 .trenches-tax 右侧同行；name-after 当 Tax 已在则重挂。
  // 0.7.57: 热通道 — 主批 /modes 在途时，视口/新创建热 token 走第二条并行请求
  //          （GMGN 列表页 only，上限 12），消除新币撞上冷大批要排队的竞态；
  //          watchdog/resume/hardReset 同步回收热通道。
  // 0.7.56: 新币徽章提速 — 新卡组批窗 500→200ms / 满 2 张即发；热路径单token
  //          组批 200→120ms。后端很闲（cache hit 1ms、QN 无 429），延迟都在前端窗口。
  // 0.7.53: 英文专名改在 data-word 上加深绿底浅字，不再用看不清的 CSS Highlight。
  // 0.7.52: 英文 Highlight 改为每次扫全部推文正文，避免中文重扫清掉英文。
  // 0.7.51: 推特卡整卡插入时补扫 CollapsibleTextContent，避免正文永远扫不到。
  // 0.7.50: 跟单列表不改 DOM；推文英文用 CSS Highlight，避开 span[data-word] 包胶囊。
  // 0.7.49: 文章样式不碰 GMGN 跟单/战壕列表（TrackerListItem），只标推特卡，避免增量错位。
  // 0.7.48: 文章样式只标重点专名；英文按句子上下文，不再因拆 span 被当成孤词。
  // 0.7.47: 文章样式英文专名走同一套分词（Chinamaxxing / Federal Reserve）。
  // 0.7.46: 文章样式用 Intl.Segmenter + 虚词过滤识别句中名词。
  // 0.7.45: 文章样式跳过孤词/金额（36.6K）；专名仍走词表而非泛 NER。
  // 0.7.44: 文章样式识别中文专名（词表最长匹配 + 中国神灵类复合 + 自定义词）。
  // 0.7.43: 文章样式只扫变化节点，不再每次整页重扫。
  // 0.7.42: 完整包文章样式改圆角胶囊，引号后固定跟「复制」。
  // 0.7.41: 完整包可选文章重点样式（默认关；按填写域名注入）。
  // 0.7.40: 完整包剪切板轮询 350ms（前台+offscreen）。
  // 0.7.38: 完整包可选覆盖 GMGN 推特监控等站点自带 CA 样式。
  // 0.7.37: 完整包高亮 CA 可申请全站权限，X/其它 https 页也能点跳。
  // 0.7.36: 完整包可选高亮页面 CA（默认关，CSS Highlight，点击复制并跳转）。
  // 0.7.35: 完整包剪切板 — 切页不复跳；可选复用已开 GMGN/Debot 标签。
  // 0.7.34: 币股 vault 底池用 BNB，不再把 GMGN NVDAB/FXION 芯片当 LP quote。
  // 0.7.33: 完整包剪切板可选用站点（仅 GMGN / 仅 Debot / 二者都用）。
  // 0.7.32: Four.meme Giggle/Binance 慈善分段（🎓/💛）；modeCache.v4。
  // 0.7.31: 版本对齐；徽章逻辑不变。剪切板仅完整包且默认只跳当前标签。
  // 0.7.30: 剪切板跳转已拆到 private/clip-jump overlay，本文件只负责徽章。
  // 0.7.18: 资金接收 0 = 严格 >0%（有 dev 分配才挡，不是 ≥0%）。
  // 0.7.17: 资金接收阈值下限 0（只要分给了 dev 钱包就屏蔽）；0% 本身不挡。
  // 0.7.16: ffff 选择器补齐（候选/mutation/click-arm）；新卡组批不阻塞整队；Debot 停滚 settle 恢复侧栏扫.
  // 0.7.12: watch scoped TokenItem href swaps so virtual rows repaint after reuse.
  // 0.7.11: fixed GMGN surfaces, scoped observers, and current-column scroll repair.
  // 0.7.15: GMGN token->trench return waits for replacement PumpSub roots; accept full-width home roots.
  // 0.7.9: K 线战壕短地址先爬真实卡片；停滚分片补绘并复用相邻徽章
  // 0.7.8: GMGN 战壕/钱包追踪滚动热路径降载；禁区停滚不再恢复扫描
  // 0.7.5: K 线侧栏下滑徽章饥饿 — truncated 禁 light 死循环；token 页视口快补；dirty 兜底
  // 0.7.6: GMGN K 线分隔条拖动期间暂停扫描，停止后单次恢复；header 引用快路径
  // 0.7.7: GMGN 钱包追踪/收藏面板禁徽章；搜索、战壕、K 线保持显示
  // 0.7.4: feeMatch 最小加固 — 无身份信号不 stable；scrub 拆错后 cache 重画
  // 0.7.3: 禁挂徽章 — 钱包追踪弹层/侧栏、GMGN 顶 ticker、搜索「钱包」区
  // 0.7.2: ffff 视口快补 ⏳；4444 残留 7777 必拆；降负载 timings；底池 DOM 优先；href 身份
  // 0.7.0: Debot ranks v4 资金接收屏蔽修复；自定义多尾号屏蔽（BSC）；底池 Flap=🦋 Four=🖐️
  // 0.6.16: 自定义多规则尾号屏蔽（仅 BSC，新创建列）；底池前缀 Flap=🦋 Four=🖐️
  // 0.6.16b: Debot ranks v3→v4 导致 dev 钱包接收屏蔽失效 — page-hook 认 v4 + POST body.column
  // 0.6.15: ffff 徽章点击 → four.meme/zh-TW/token/{ca}；Flap 仍 flap.sh taxinfo.
  // 0.6.14: Four.meme ffff 税币 — 与 Flap 同徽章 schema；后端 Multicall 链上读.
  // 0.6.13: Hot/Steady 双轨 — 视口/新创建未画加速；稳态保持流畅；仅 BSC 链工作.
  // 0.6.12: pending 快重试 / missing 略缓；区分 soft-miss 原因，限制 requeue 定时器数量.
  // 0.6.11: 流畅回退 — 扫卡/mutation 节奏对齐 0.6.2；身份校验快路径+节流，保留防错徽章.
  // 0.6.10: Debot 双站 debot.ai + gungnir.bot 列表 /meme?chain=bsc 与 K 线 /token/bsc 门控对齐.
  // 0.6.9: 仅 BSC 生效 — ?chain=bsc 或路径 /bsc/token、/token/bsc；robinhood 等立即清徽章.
  // 0.6.8: /modes 批：新CA 满3或350ms；0 CA 不请求；CF soft-wait 回填；禁狂刷 503.
  // 0.6.7: 严禁错徽章 — 扫卡前 enforceIdentity；无身份/fee≠CA 立刻拆；仅 loading 或正确 entry.
  // 0.6.6: CF/后端 async-cache-first — 插件对 pending/missing 快轮询；回画 findCardsByCa.
  // 0.6.5: 身份=卡片自身 CA（div[href] 唯一）；禁「多 href 优先 7777」导致 ffff 卡挂错徽章；新创建加速.
  // 0.6.4: js-mcp 实锤 GMGN TokenItem 用 div[href=/bsc/token/…] 非 a — extractCardHrefToken 必须读任意 [href].
  // 0.6.3: 新币徽章 — href 优先于 short CA，禁虚拟列表复用旧徽章；无 /modes 仅 ⏳，有正确值才出真徽章.
  // 0.5.22: GMGN-only batch priority for top viewport + flush when scan truncated; Debot untouched.
  // 0.5.21: GMGN-only new-card latency (soft debounce / early miss retry / cache paint); Debot untouched.
  // 0.5.18: GMGN embedded TokenItem dirty queue + single-pass search overlay/address mount.
  // 0.5.17: GMGN list readiness + fast paint also recognize virtual rows without token <a>.
  // 0.5.16: GMGN post-commit SPA signal + structural list gate; clear badge on non-target routes.
  // 0.5.15: fail-open network handling; route-committed header paint; no pre-click work.
  // 0.5.14: reject stale badges when virtual rows recycle to non-7777/8888 tokens.
  // 0.5.13: gate K-line -> trench paint on real list DOM; trim steady/resume maintenance.
  // 0.5.12: freeze outgoing trench DOM until the real token header mounts.
  // 0.5.11: Debot virtual-list scroll cooldown + mutation feedback-loop suppression.
  // 0.5.10: GMGN/Debot/Gungnir header lock + current-address validation + targeted React repair.
  // 0.5.9: GMGN 顶栏优先 #token-base-address / [data-addr]；DOM 被 React 重绘后 observer 补挂.
  // 0.5.8: 顶栏成功判定仅 fee-header 真锁；勿把左侧同 CA 列表徽章当顶栏已挂好；cache ready 强制补画.
  // 0.5.7: short CA 定位 — 仅在内联战壕打开时排除左侧列；全宽 K 线恢复左顶栏地址.
  // 0.5.6: 内联战壕开启时 short CA 勿选左侧列 — 优先总税率左侧最近的顶栏地址.
  // 0.5.5: GMGN 顶栏强制可挂（insert 成功即 OK）+ token 页 guardian 续画；修双端都不显示.
  // 0.5.4: GMGN 顶栏徽章 data-fee-header 锁定 — 防 isStable 误判/列表 remount 闪没.
  // 0.5.3: GMGN K 线徽章闪一下消失 — 禁止 tryPaint 狂清顶栏；列表扫勿 clear 顶栏 URL 徽章.
  // 0.5.2: GMGN token 多栏 — 顶栏+左侧战壕同时扫（取消 settled 才开侧栏的死锁，对齐 0.4.24）.
  // 0.5.1: GMGN 多栏布局(战壕+K线) short CA 不在视口左侧 — 放宽 left 带限制.
  // 0.5.0: 里程碑发布 — GMGN 流畅/地址旁挂载/三列同 CA；Debot 顶栏+坐标双徽章；100% 仅图标.
  // 0.4.51: GMGN 三列同 CA 各显徽章（list-return 禁 token 级 seen）；单卡仍防双徽章.
  // 0.4.50: GMGN K 线强制 short CA afterend（禁总税率兜底抢挂）；已挂税率旁则迁移.
  // 0.4.49: GMGN K 线徽章改挂 short CA 旁；回战壕补洞防 early-stop 卡 10~12 枚 2–3s.
  // 0.4.48: Debot 坐标模式禁嵌套双徽章；100% 份额只显示类型图标（不写 100%）.
  // 0.4.47: Debot K 线顶栏徽章 — 顶栏 short CA 用 title/ca-text 定位（登录侧栏导致 220 节点漏扫）.
  // 0.4.46: GMGN 回战壕对标 Debot — 禁首扫 force 叠 host longtask；DOM-watch 前 400ms 密快绘.
  // 0.4.45: GMGN 仅首屏可视(~10–12 卡) + K→战壕 <1s 铺满；禁止屏外 DOM 操作；Debot 不动.
  // 0.4.44: GMGN K→战壕即时徽章 — 轻量 soft+fastPaint（无 keep-alive）；Debot 路径不动.
  // 0.4.43: GMGN-only jank — scroll cooldown + mutation relevance filter + stable/Tax cache (Debot untouched).
  // 0.4.42: GMGN 列表 mutation 禁止 force 扫（对齐 0.4.22 900ms 限流）+ href-only 候选 + roots≤3.
  // 0.4.41: GMGN 彻底对齐 0.4.22 — 关 soft/DOM-watch/click-arm 风暴；K 线 settled 不扫三列.
  // 0.4.40: GMGN 回 0.4.22 轻量 progressive（砍 keep-alive/Tax 狂扫）；Debot 仍用加速路径.
  // 0.4.39: js-mcp — GMGN K→战壕 Tax@1.1s 但徽章@~6s：list-return 锚点+续扫+禁止 22px 假卡.
  // 0.4.38: 搜索/历史弹层 ~1s 出徽章 — dialog-first + cache 直绘 + 矮行 climb + API 回补扫.
  // 0.4.37: GMGN 进出 K 线减负 + 回战壕加速（header-only token scan + list-return DOM watch）.
  // 0.4.36: list-return 三栏轮询（已迁移/右列不再饿死）+ GMGN 同策略.
  // 0.4.35: Debot SPA meme→K 线激活链加固 + 回战壕加速 + token 页减负.
  // 0.4.34: Debot「使用卡片坐标」时 K 线顶栏仍强制贴合（不走 absolute，修登录无徽章）.
  // 0.4.33: Debot login K-line badge + list-return mount pos; GMGN return first-frame fast-only.
  // 0.4.32: GMGN token→home — cache-first 6–8 card burst + 6ms slices (kill ~0.8s longtask).
  // 0.4.31: js-mcp report — Debot token dwell jank + 0 badge; GMGN return still ~0.6–0.8s.
  // 0.4.30: token↔list return — viewport-first soft rescan (jank↓, first-paint still snappy).
  // 0.4.29: cut SPA force-scan storm (meme→K-line jank) — coalesce + fewer progressive.
  // 0.4.28: Debot SPA — normalize route key (id_0x), click-arm, no thrash reset, paint in quiet.
  // 0.4.27: Debot SPA cross-browser — page-world history hook + always-on header guardian.
  // 0.4.26: Debot SPA meme→token — header watch + div short-CA + Release zip.
  // 0.4.25: Debot SPA meme->token header badge (debot.ai + gungnir.bot).
  // 0.4.24: dedupe per card only — 三栏同 CA 各显徽章 (fix按 token 全页只留 1 个).
  // 0.4.23: popup EN/ZH + display prefs collapsed by default.
  // 0.4.22: K-line side 战壕 rows share home trench absolute coords (header stays Tax).
  // 0.4.21: K-line side board — prioritize unpainted, higher light caps, light continue.
  // 0.4.20: light→高对比; token settled still light-scan dialog/side boards; drag auto-off.
  // 0.4.19: light theme always solid dark chip (no bg toggle); dark keeps optional solid.
  // 0.4.18: default classic translucent; optional solid dark card bg; no hybrid gradient.
  // 0.4.17: dark theme optional transparent bg toggle.
  // 0.4.16: dark theme solid #000 chip bg for contrast on colorful cards.
  // 0.4.15: hard double-badge dedupe (Debot drag); outermost card only; remount on abs.
  // 0.4.14: trench-only abs/drag; bsc scan gate; fix Debot 新创建 + double badge.
  // 0.4.13: badge pos — default beside Tax; optional card top-left absolute + page drag.
  // 0.4.12: K-line — stop mutation scans after badge; cache 总税率 lookup; per-site badge offset.
  // 0.4.11: SPA progressive scans cut to ~1.3–2s (was 6× up to 3s) — fix home→K-line jank.
  // Debot/GMGN list boards still get 4 light passes; token pages 3 + early-stop when badge exists.
  // 0.4.10: pool quote prefer API quote_symbol.
  // 0.7.1b: 降负载 — 热路径/回列表/滚动/扫卡间隔放宽（见下方常量）
  const SCAN_INTERVAL_MS = 650;
  // 0.4.29: even force full-scans must coalesce (guardian/watch/progressive stacked = jank).
  const FORCE_FULL_SCAN_MIN_GAP_MS = 480;
  const REQUEST_TIMEOUT_MS = 28000;
  // Background tabs freeze timers; if a batch never finishes, unblock after this wall time.
  const BATCH_STUCK_MS = 30000;
  // On tab resume, force-kill in-flight fetch if older than this (avoid Abort cascade on short blurs).
  const RESUME_FORCE_MIN_AGE_MS = 8000;
  // After long background ONLY: brief force remount window (short blur must NOT remount).
  // Hidden longer than this → soft/hard pipeline revive (not every queue backlog).
  const RESUME_LONG_HIDDEN_MS = 25000;
  /** Long-hidden hard-reset debounce — avoid Chrome Errors spam on repeated tab switches. */
  const HARD_RESET_RESUME_GAP_MS = 45000;
  // While tab is visible, periodic self-heal ONLY when unhealthy (never full remount).
  const PIPELINE_WATCHDOG_MS = 45000;
  // Cap *real work* per scan (stable badges do not count). Debot 3 cols ≈ 40+ cards.
  const MAX_CANDIDATES_PER_SCAN = 120;
  const MAX_CARDS_PER_SCAN = 56;
  const MAX_BATCH_TOKENS = 48;
  // 稳态批：满 BATCH_MIN_TOKENS 或 BATCH_FLUSH_MS；禁止 0ms 全局狂刷。
  const BATCH_FLUSH_MS = 350;
  const BATCH_MIN_TOKENS = 3;
  // 热路径（视口/新创建未画）：0.7.56 单 token 也只等 120ms（后端空闲，缩窗提时效）。
  const HOT_BATCH_FLUSH_MS = 120;
  /** page-hook host-fee 到达前给 WS/trenches 一帧窗口，减少新币抢先 /modes */
  const HOST_FEE_GRACE_MS = 1000;
  /** js-mcp：GMGN tax-dom / Debot ranks+launchpad_extra 首包前有竞态；此前不 flush /modes */
  const HOST_TAX_FEED_MAX_WAIT_MS = 2500;
  const HOST_FEE_QUEUE_POLL_MS = 120;
  const HOST_FEE_QUEUE_MAX_MS = 1000;
  /** host-fee 分红仍是 BNB/中文名：最多 ⏳ 这么久，超时仍画（避免永远待加载） */
  const HOST_FEE_SYMBOL_GRACE_MS = 1000;
  /** 无法本地定案时 ⏳ 等 /modes 的上限；超时才用 host-fee 兜底 */
  const HOST_FEE_DEFER_MODES_MS = 8000;
  /** ⏳ 满此时长仍无真徽章：入队并走组批（Debot 不立刻单打 /modes） */
  const LOADING_MODES_KICK_MS = 1000;
  const HOST_TAX_FEED_RETRY_MS = 280;
  const hostListBootAt = Date.now();
  let gmgnHostFeeSeenAt = 0;
  let debotHostFeeSeenAt = 0;
  let debotRanksDoneAt = 0;
  let hostTaxFeedRetryTimer = 0;
  let hostFeeGraceTimer = 0;
  /** 等 page-hook host-fee：共享单 poll，避免每 token 各挂 80ms timer */
  const hostFeeDeferWaiters = new Map();
  let hostFeeDeferPollTimer = 0;
  let hostFeeDeferPollStartedAt = 0;
  /** token → timeout：host-fee 短窗 ⏳ 到期后立刻换真徽章，不等下一轮扫卡 */
  const hostFeePendingPaintTimers = new Map();
  /** token → timeout：1s 仍 ⏳ 则强制 flush /modes */
  const loadingModesKickTimers = new Map();
  let gmgnTaxDomSeen = false;
  let debotPoolDomSeen = false;
  const HOT_BATCH_MIN_TOKENS = 2;
  // 0.7.57 热通道：主批在途时热 token 并行发送的单次上限（对齐 Worker 直填能力）。
  const HOT_LANE_MAX_TOKENS = 12;
  const RETRY_BASE_MS = 900;
  const RETRY_MAX_MS = 12000;
  const MISSING_RETRY_BASE_MS = 15000;
  const MISSING_RETRY_MAX_MS = 5 * 60 * 1000;
  /**
   * GMGN /modes soft-miss 早期重试（前 N 次，之后指数退避）。
   * 热路径（顶区未画）用 HOT_* 表；稳态用下列表。
   */
  const GMGN_PENDING_RETRY_EARLY_MS = [600, 1400, 2800];
  const GMGN_MISSING_RETRY_EARLY_MS = [1000, 2200, 4000];
  const HOT_PENDING_RETRY_EARLY_MS = [400, 900, 1800];
  const HOT_MISSING_RETRY_EARLY_MS = [700, 1500, 2800];
  /** 同时挂起的 miss 重入队定时器上限（防几十个 CA 各挂一个 timer） */
  const GMGN_MISSING_REQUEUE_MAX = 24;
  /** 热档最长：连续无热工作超过此时间退回稳态扫/防抖 */
  const HOT_PATH_HOLD_MS = 2500;
  const PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  // Debot mount result cache (avoids getComputedStyle thrash every scan).
  const DEBOT_MOUNT_CACHE_MS = 4000;
  // GMGN list Tax chip mount cache (findTaxTag is expensive under virtual-list thrash).
  const GMGN_TAX_MOUNT_CACHE_MS = 2500;
  // 0.8.29: pool/Tax quotes DOM 短缓存。有符号跟扫间隔；空结果更短以免挡住后到的芯片。
  const POOL_QUOTE_DOM_CACHE_MS = 900;
  const POOL_QUOTE_DOM_EMPTY_CACHE_MS = 800;
  // GMGN: while user scrolls columns, suppress mutation-driven full scans (resume after settle).
  const GMGN_SCROLL_COOLDOWN_MS = 400;
  const GMGN_SCROLL_RESUME_SCAN_MS = 480;
  // Viewport quick-fill is a fallback, not a second scanner. Keep it out of the
  // scroll hot path and never run it more than once per settled scan window.
  const GMGN_VIEWPORT_QUICK_MIN_GAP_MS = 900;
  // Debot/Gungnir virtual lists recycle many rows per wheel tick. Let the host finish
  // scrolling, then cache-first paint the moved column (GMGN settle parity).
  const DEBOT_SCROLL_COOLDOWN_MS = 380;
  const DEBOT_SCROLL_RESUME_SCAN_MS = 440;
  const DEBOT_SCROLL_CARDS_BUDGET = 8;
  const DEBOT_STEADY_CARDS_BUDGET = 24;
  const DEBOT_NEW_CARD_LIMIT = 8;
  const DEBOT_TRENCH_ROW_MIN_W = 220;
  const DEBOT_TRENCH_ROW_MIN_H = 80;
  const DEBOT_TRENCH_ROW_MAX_H = 220;
  // GMGN 稳态 mutation / 扫间隔（流畅）；热路径见 HOT_*。
  const MUTATION_SCAN_DEBOUNCE_GMGN_MS = 450;
  const HOT_MUTATION_SCAN_DEBOUNCE_GMGN_MS = 400;
  // GMGN list non-force scan min gap (home/meme only). Token pages keep SCAN_INTERVAL_MS.
  const GMGN_LIST_SCAN_MIN_GAP_MS = 640;
  const HOT_GMGN_LIST_SCAN_MIN_GAP_MS = 560;
  // GMGN cold first scan delay (host hydration first).
  const GMGN_FIRST_SCAN_DELAY_MS = 800;
  const DEBOT_FIRST_SCAN_DELAY_MS = 700;
  // GMGN per-scan card budget while scroll-cooling (smaller slices).
  const GMGN_SCROLL_CARDS_BUDGET = 12;
  // After /modes hits on GMGN list: cache-first viewport paint (cards, ms) — no network.
  const GMGN_POST_API_PAINT_CARDS = 10;
  const GMGN_POST_API_PAINT_MS = 10;
  const HOT_GMGN_POST_API_PAINT_CARDS = 14;
  const HOT_GMGN_POST_API_PAINT_MS = 14;
  // 行 href 身份短缓存（虚拟列表复用后 TTL 内仍可能错，保持 ≤600ms）.
  const HREF_TOKEN_CACHE_MS = 500;
  // 全页 scrub（节流版）：兜底；每扫另有 cheap scrubBadgesToHostHref（不节流）。
  const SCRUB_IDENTITY_MIN_GAP_MS = 1800;
  const SCRUB_IDENTITY_MAX_ICONS = 40;
  // 每扫轻量校验上限（仅 closest+比 fee，极便宜）
  const SCRUB_HREF_MAX_ICONS = 48;
  const SCRUB_HREF_MIN_GAP_MS = 1400;
  // One card is gated from several paint paths in the same scan. The short
  // cache avoids repeating ancestor walks and forced geometry reads.
  const BADGE_FORBIDDEN_CACHE_MS = 500;
  // chrome.storage rewrite throttle + max entries (LRU by fetchedAt).
  const PERSIST_MIN_INTERVAL_MS = 10000;
  const PERSISTENT_CACHE_MAX_ENTRIES = 800;
  // Mutation → scan debounce (ms). Snappy enough for list refresh, still coalesces thrash.
  const MUTATION_SCAN_DEBOUNCE_MS = 400;
  // Token/K-line while badge still loading: longer coalesce against chart Mutation flood.
  const MUTATION_SCAN_DEBOUNCE_TOKEN_LOADING_MS = 900;
  // After header badge settled: light scan for dialogs / side boards only (ms).
  // 0.4.21: 700ms — new 战壕 rows must appear faster without chart full-scans.
  const MUTATION_SCAN_DEBOUNCE_TOKEN_LIGHT_MS = 700;
  // Overlay open: light scan debounce（降负载，搜索弹层不必 90ms 级）
  const MUTATION_SCAN_DEBOUNCE_OVERLAY_MS = 160;
  // Light scan candidate caps (side board + dialog only).
  const LIGHT_MAX_CANDIDATES = 96;
  const LIGHT_MAX_OFFSCREEN = 24;
  // Overlay-fast window: dialog-only candidates + dense kicks (0.4.38).
  const OVERLAY_FAST_MS = 4500;
  const OVERLAY_MAX_CANDIDATES = 36;
  const OVERLAY_MAX_CARDS = 28;
  // Home page mutation while overlay open.
  const MUTATION_SCAN_DEBOUNCE_HOME_OVERLAY_MS = 160;
  // SPA: swallow mutation flood while host rebuilds (chart/list); progressive scans fill holes.
  // 0.4.29: slightly longer quiet so chart paints first (was competing with force-scan storm).
  const SPA_NAV_QUIET_MS = 800;
  // Cache header "总税率" node — avoid document-wide span/div walks every root refresh.
  const TAX_LABEL_CACHE_MS = 20000;
  // Coalesce multi pushState/replaceState during one navigation.
  const SPA_NAV_COALESCE_MS = 40;
  // Progressive hole-fill offsets from quiet end (ms).
  // List/meme boards (cold / generic): 3 passes — 0.4.30 cut 4th to save main thread.
  const SPA_NAV_SCAN_OFFSETS_LIST_MS = [0, 400, 1100];
  // token→list return (Debot): a few dense kicks — not a 10-pass storm.
  const SPA_NAV_SCAN_OFFSETS_LIST_RETURN_MS = [0, 160, 480];
  // GMGN list-return progressive：间隔拉大，减回战壕 force 扫风暴
  const SPA_NAV_SCAN_OFFSETS_LIST_RETURN_GMGN_MS = [0, 150, 400];
  // Token / K-line page (GMGN): header paint only — fewer full scans (0.4.37 jank fix).
  const SPA_NAV_SCAN_OFFSETS_TOKEN_MS = [0, 500, 1300];
  // Debot SPA token: prefer tryPaint; at most 2 progressive full scans.
  const SPA_NAV_SCAN_OFFSETS_DEBOT_TOKEN_MS = [0, 900, 2500];
  // Quiet shorter when returning to list — user expects badges ASAP (immediacy).
  const SPA_NAV_QUIET_LIST_RETURN_MS = 0;
  // After token→list: viewport-first soft window (ms).
  // Debot denser; GMGN short (only first-screen fill, then mutation+scroll resume).
  const SPA_LIST_RETURN_SOFT_MS = 1100;
  const SPA_LIST_RETURN_SOFT_GMGN_MS = 700;
  // First wave: only paint cards with fee already in modeCache (no network, no deep extract).
  const SPA_LIST_RETURN_CACHE_ONLY_MS = 220;
  // Cards per slice during list-return (Debot 3-col progressive).
  const SPA_LIST_RETURN_CARDS = 24;
  // GMGN: only top visible rows (~3 cols × ~3–4 = ~10–12) — never whole virtual list.
  const SPA_LIST_RETURN_CARDS_GMGN = 12;
  // Candidates cap — Debot must cover 3 columns × ~8–10 tax rows.
  const SPA_LIST_RETURN_CANDIDATES = 48;
  // GMGN candidates: viewport-only first screen (3×4 + spare).
  const SPA_LIST_RETURN_CANDIDATES_GMGN = 18;
  // Soft cancel: need badges across columns, not just left-col total (0.4.36).
  const SPA_LIST_RETURN_ENOUGH_BADGES = 12;
  // GMGN early-stop: need first-screen density (js-mcp: stop@8 left rows empty for 2s).
  const SPA_LIST_RETURN_ENOUGH_BADGES_GMGN = 14;
  // Extra fill ticks after return if first wave incomplete (ms from settle).
  const SPA_LIST_RETURN_FILL_GMGN_MS = [600, 1200, 2000];
  const SPA_LIST_RETURN_FILL_DEBOT_MS = [400, 900, 1600];
  // Per-column min visible badges before early-stop (Debot 已迁移 / GMGN 右列).
  const SPA_LIST_RETURN_MIN_PER_COL = 2;
  // Soft scan time budget per frame (ms) — hard stop mid-loop.
  const SPA_LIST_RETURN_SLICE_MS = 8;
  // Fast-paint burst: column-round-robin.
  const SPA_LIST_RETURN_FAST_MS = 22;
  const SPA_LIST_RETURN_FAST_CARDS = 28;
  // GMGN: fill first screen only (not 28 offscreen).
  const SPA_LIST_RETURN_FAST_MS_GMGN = 18;
  const SPA_LIST_RETURN_FAST_CARDS_GMGN = 12;
  // Keep-alive ONLY for Debot (GMGN keep-alive was main 0.4.39 jank — 20 force scans / 7s).
  const SPA_LIST_RETURN_KEEPALIVE_MS = 4500;
  const SPA_LIST_RETURN_KEEPALIVE_TICK_MS = 900;
  // GMGN list-return: fastPaint-only ticks（减次数+拉长间隔，降回战壕主线程尖峰）
  const SPA_LIST_RETURN_FAST_BURST_GMGN_MS = [0, 80, 200, 400, 700];
  // GMGN steady-state: max cards touched per scan (viewport-first).
  const GMGN_STEADY_CARDS_BUDGET = 12;
  // GMGN steady-state candidate cap (in-view only; no offscreen take).
  const GMGN_STEADY_CANDIDATES = 18;
  // GMGN token pages keep a live embedded trench. Only process TokenItem rows that
  // actually changed; chart/ticker mutations must never reopen a full-page scan.
  const GMGN_EMBEDDED_DIRTY_DEBOUNCE_MS = 180;
  const GMGN_EMBEDDED_DIRTY_CARD_LIMIT = 16;
  // Newly inserted visible cards use a small, independent batch window so they
  // do not wait behind the regular list scan/idle pipeline.
  // 0.7.56: 新卡多为单张出现，500ms 窗口=纯延迟；缩到 200ms / 满 2 张即发。
  const GMGN_NEW_CARD_BATCH_FLUSH_MS = 200;
  const GMGN_NEW_CARD_BATCH_MIN_TOKENS = 2;
  const GMGN_NEW_CARD_LIMIT = 16;
  // Debot 新创建大量空金库必须打 /modes；200ms 单卡 + 1s kick = 每秒一发。
  // 拉长组批窗，满 2 张立刻发，否则最多等这一窗把相邻新币收进同一批。
  const DEBOT_NEW_CARD_BATCH_FLUSH_MS = 1600;
  // Resizing the token-page trench rebuilds React rows on every pointer move.
  // Keep extension DOM/layout work out of that hot path and repair once after settle.
  const GMGN_TRENCH_RESIZE_SETTLE_MS = 280;
  // K 线侧栏：视口判定略松（padY），避免刚滑入的已开盘行被 40px 门禁饿死。
  const GMGN_TOKEN_TRENCH_VIEWPORT_PAD_Y = 220;
  const GMGN_TOKEN_TRENCH_VIEWPORT_PAD_TOP = 80;
  // Dedicated header paint watch after meme→token SPA (ms). Logged-in DOM is slower.
  const DEBOT_TOKEN_HEADER_WATCH_MS = 20000;
  const DEBOT_TOKEN_HEADER_TICK_MS = 400;
  // Debot token SPA quiet (shorter than generic — paint sooner without waiting 800ms).
  const SPA_NAV_QUIET_DEBOT_TOKEN_MS = 280;
  // GMGN token SPA quiet — closer to 0.4.22 (650) but slightly snappier.
  const SPA_NAV_QUIET_GMGN_TOKEN_MS = 400;
  // List-return DOM watch (ms). GMGN short + early dense; Debot longer denser.
  const LIST_RETURN_DOM_WATCH_MS = 1200;
  const LIST_RETURN_DOM_WATCH_GMGN_MS = 900;
  // GMGN DOM-watch: first N ms use tighter throttle (catch column mount).
  const LIST_RETURN_DOM_WATCH_GMGN_EARLY_MS = 450;
  const LIST_RETURN_DOM_WATCH_GMGN_EARLY_THROTTLE_MS = 120;
  const LIST_RETURN_DOM_WATCH_GMGN_THROTTLE_MS = 220;
  // Always-on guardian base interval; backs off while header missing (0.4.31).
  const DEBOT_TOKEN_GUARDIAN_MS = 1200;
  // After user clicks a /token/ link, keep header tryPaint this long (ms).
  const DEBOT_TOKEN_CLICK_ARM_MS = 10000;
  // Token URLs can commit before the outgoing trench DOM unmounts. Freeze list writes
  // during that gap so removing badges cannot reflow the page being left.
  const TOKEN_ENTER_TRANSITION_MS = 4000;
  // Give the host the first navigation/render slice. Targeted DOM mutations may paint sooner.
  const TOKEN_ENTER_PAINT_GRACE_MS = 350;
  // URL returns before the K-line React subtree leaves. Wait for a real multi-row trench
  // surface before any list paint so the old embedded sidebar cannot be mistaken for home.
  const LIST_RETURN_TRANSITION_MS = 2500;
  // GMGN desktop can render both trench columns inside one PumpSub root. Cache the
  // structural probe briefly so cache-first return does not wait for the timeout path.
  const GMGN_TRENCH_ROOT_CACHE_MS = 180;
  // Wallet/favorites classification is layout-sensitive and runs on the scroll hot path.
  // Cache negative probes for one frame and positive probes longer (blocking is safer).
  const GMGN_PANEL_PROBE_FALSE_CACHE_MS = 32;
  const GMGN_PANEL_PROBE_TRUE_CACHE_MS = 500;
  // Healthy guardians only validate route/header state. Mutation observers own repairs.
  const TOKEN_GUARDIAN_HEALTHY_MS = 5000;
  const TOKEN_GUARDIAN_HIDDEN_MS = 10000;
  // Independent route poll — sites often capture native history before our wrap.
  // 0.4.41: back to 0.4.22 500ms (300ms was busy-checking SPA every tick).
  const ROUTE_POLL_MS = 500;
  // Guardian/watch full scan gap while header missing (backs off further).
  const DEBOT_HEADER_FULL_SCAN_GAP_MS = 3500;
  // Cache findDebotTokenHeaderCard / positive header-badge (ms).
  // null find: short TTL so late DOM is not missed (0.4.31).
  const DEBOT_HEADER_FIND_CACHE_MS = 400;
  const DEBOT_HEADER_FIND_NULL_CACHE_MS = 90;
  const DEBOT_HEADER_BADGE_OK_CACHE_MS = 400;
  // Expensive mark cleanup only every N scans (0.3.4 never re-extracted every tick).
  const CLEANUP_EVERY_N_SCANS = 10;
  // Console spam costs main-thread time on Debot/GMGN — off by default.
  const DEBUG_LOG = false;
  // Steady-state: painted badges free; unpainted prioritized.
  // v3: top_payout_symbol always annotated on largest tax segment (→SYM never omitted).
  const PERSISTENT_CACHE_KEY = "flapFeeInfo.modeCache.v5";
  // Popup toggles: which badge parts to show (default all true).
  const DISPLAY_PREFS_KEY = "flapFeeInfo.displayPrefs.v1";
  const DEFAULT_DISPLAY_PREFS = {
    pool: true,
    holder: true,
    creator: true,
    gift: true,
    giggle: true,
    binance: true,
    burn: true,
    lp: true,
    payoutArrow: true,
    unknown: true,
    // 币股篮子：vault 底层 SPCX/TSLA…（独立开关）
    basket: true,
    // 点击徽章打开详情：Flap→flap.sh taxinfo；Four ffff→four.meme/token
    openTaxinfo: true,
    // 鼠标悬停徽章显示详细浮窗（默认关）
    hoverTip: false
  };
  const FLAP_TAXINFO_BASE = "https://flap.sh/bnb";
  /** Four.meme tax token page (suffix ffff) */
  const FOUR_TOKEN_PAGE_BASE = "https://four.meme/zh-TW/token";
  // Popup language (zh|en) — tooltip copy follows this.
  const UI_LANG_KEY = "flapFeeInfo.uiLang.v1";
  // Stock / index vault segment emoji (replaces 🎁 when basket present).
  const STOCK_EMOJI = "📈";
  const GIFT_EMOJI = "🎁";
  // Hide list cards when non-vault fund-recipient share is high (listen-only host API).
  // Default OFF — configured in a dedicated popup section.
  const TAX_RECV_HIDE_KEY = "flapFeeInfo.taxRecvHide.v1";
  const DEFAULT_TAX_RECV_HIDE = {
    enabled: false,
    thresholdPct: 100,
    allow: []
  };
  const TAX_RECV_ALLOW_MAX = 24;
  /** 自定义尾号屏蔽（仅 BSC）：rules[].suffix 为 1–12 位 hex */
  const SUFFIX_HIDE_KEY = "flapFeeInfo.suffixHide.v1";
  /** 金库屏蔽：税收金库 🎁 vs 币股金库 📈 */
  const VAULT_HIDE_KEY = "flapFeeInfo.vaultHide.v1";
  const SEARCH_HIDE_KEY = "flapFeeInfo.searchHide.v1";
  const LICENSE_KEY = "flapFeeInfo.license.v1";
  const DEVICE_ID_KEY = "flapFeeInfo.deviceId.v1";
  /** Optional paid key; empty = free mode. Sent as Authorization when set. */
  let licenseAccessKey = "";
  /** Per-install UUID; one license key binds to first device_id (Worker KV). */
  let licenseDeviceId = "";
  /** Worker REQUIRE_LICENSE=1 (from POST /license/verify). */
  let licenseEnforcedByServer = false;
  /** False when enforced and key missing/invalid/device mismatch. */
  let licenseAccessGranted = true;
  let licenseGateProbePromise = null;
  const DEFAULT_SUFFIX_HIDE = { enabled: false, rules: [] };
  const DEFAULT_VAULT_HIDE = {
    enabled: false,
    hideTaxVault: false,
    hideStockVault: false
  };
  const DEFAULT_SEARCH_HIDE = { enabled: false };
  const SEARCH_HIDE_ATTR = "data-flap-search-hidden";
  const SUFFIX_HIDE_MAX_RULES = 24;
  const TAX_RECV_HIDE_CLASS = "flap-fee-tax-recv-hidden";
  const TAX_RECV_HIDE_ATTR = "data-flap-tax-recv-hidden";
  // Badge color theme: dark (default, for dark sites) | light (solid soft chips for contrast).
  const BADGE_THEME_KEY = "flapFeeInfo.badgeTheme.v1";
  const DEFAULT_BADGE_THEME = "dark";
  // Dark theme: solid card-like fill when true. Default false = classic translucent accents.
  // v2 key (v1 transparent toggle inverted / renamed).
  const BADGE_SOLID_DARK_KEY = "flapFeeInfo.badgeSolidDark.v1";
  const DEFAULT_BADGE_SOLID_DARK = false;
  // Legacy key — migrate once if present.
  const BADGE_DARK_TRANSPARENT_KEY_LEGACY = "flapFeeInfo.badgeDarkTransparent.v1";
  // Per-site badge placement:
  // - enabled=false (default): natural mount beside Tax / 总税率
  // - enabled=true: position absolute vs card top-left (x,y) — same for all badges on site
  // gmgn vs debot(+gungnir) separate. v2 schema (v1 relative-nudge ignored).
  const BADGE_OFFSET_KEY = "flapFeeInfo.badgeOffset.v2";
  const BADGE_DRAG_EDIT_KEY = "flapFeeInfo.badgeDragEdit.v1";
  const DEFAULT_BADGE_OFFSETS = {
    gmgn: { enabled: false, x: 12, y: 8 },
    debot: { enabled: false, x: 12, y: 8 }
  };
  // Card-relative coords (px from card border-box top-left).
  const BADGE_OFFSET_MIN = -40;
  const BADGE_OFFSET_MAX = 640;
  const DEBUG_PREFIX = "[FlapFeeInfo]";
  const CARD_MARK = "gmgnFeeModeCard";
  const ICON_MARK = "gmgnFeeModeIcon";
  const GMGN_OVERLAY_INPUT_SELECTOR =
    'input[placeholder*="搜名称"], input[placeholder*="KOL"], input[placeholder*="推特号"]';
  const CARD_DATA = `data-${toKebab(CARD_MARK)}`;
  const ICON_DATA = `data-${toKebab(ICON_MARK)}`;
  // Pool/quote prefix by platform (not site pool icons).
  const POOL_PREFIX_DEFAULT = "🪙";
  const POOL_PREFIX_FLAP = "🦋"; // 7777 / 8888
  const POOL_PREFIX_FOUR = "🖐️"; // ffff Four.meme
  const MAX_QUOTE_SYMBOL_LEN = 8;
  // GMGN special quote icons (not in /static/quotes/*.png RWA list).
  const GMGN_ICON_QUOTE_RULES = [
    [/usd1/i, "USD1"],
    [/usdt/i, "USDT"],
    [/usdc/i, "USDC"],
    [/weth/i, "WETH"],
    [/wbnb|bnbball|\bbnb\b/i, "BNB"]
  ];
  // js-mcp: Tax 分红图 = TaxDividendTokenIcon；底池图 = Tax 外 /static/quotes（LaunchpadImageIcon）。
  // wrap 必须是整卡 Tax 容器。单个 TaxDividendTokenIcon 不能当 wrap（querySelector 只包第一张图）。
  // /static/lpp/ 是 Flap/Four 发射台 logo，不是 LP。目录：/static/config/quotes.json
  const GMGN_TAX_DIVIDEND_WRAP =
    '.trenches-tax, [data-sentry-component="TaxDividendTokenIcons"], [data-sentry-component="ListTaxInfo"], [data-sentry-component="TaxAllocationIcon"]';
  const GMGN_TAX_DIVIDEND_INNER =
    '.trenches-tax, [data-sentry-component="TaxDividendTokenIcon"], [data-sentry-component="TaxDividendTokenIcons"], [data-sentry-component="ListTaxInfo"]';
  const GMGN_QUOTES_JSON_PATH = "/static/config/quotes.json";
  const GMGN_QUOTES_TTL_MS = 6 * 60 * 60 * 1000;
  const gmgnQuoteByStem = new Map();
  const gmgnQuoteByAddr = new Map();
  let gmgnQuotesLoadedAt = 0;
  let gmgnQuotesInflight = false;
  // Native default quote when GMGN shows no quote chip (standard BNB pair has no icon).
  const REAL_POOL_QUOTE_SYMS = new Set([
    "BNB",
    "WBNB",
    "USD1",
    "USDT",
    "USDC",
    "BUSD",
    "BTCB",
    "WETH",
    "ETH"
  ]);
  const GMGN_CHAIN_NATIVE_QUOTE = {
    bsc: "BNB",
    eth: "WETH",
    base: "WETH",
    blast: "WETH",
    arbitrum: "WETH",
    sol: "SOL",
    tron: "TRX"
  };
  // GMGN TokenItem is often div[href="/bsc/token/0x…7777"] (not always <a>) — include bare [href*].
  const SUFFIX_SELECTORS =
    "[href*='8888'], [href*='7777'], [href*='ffff'], [href*='FFFF'], " +
    "[title*='8888'], [title*='7777'], [title*='ffff'], [title*='FFFF'], " +
    "[aria-label*='8888'], [aria-label*='7777'], [aria-label*='ffff'], " +
    "[data-token*='8888'], [data-token*='7777'], [data-token*='ffff'], " +
    "[data-address*='8888'], [data-address*='7777'], [data-address*='ffff']";

  const modeMeta = {
    holder: { fallback: "💎", title: "Fee mode: holder dividend", className: "holder" },
    gift: { fallback: "🎁", title: "Fee mode: vault gift", className: "gift" },
    giggle: { fallback: "🎓", title: "Fee mode: Giggle charity", className: "giggle" },
    binance: { fallback: "💛", title: "Fee mode: Binance charity", className: "binance" },
    creator: { fallback: "👨‍🍳", title: "Fee mode: creator marketing", className: "creator" },
    burn: { fallback: "🔥", title: "Fee mode: burn / deflation", className: "burn" },
    lp: { fallback: "💧", title: "Fee mode: liquidity", className: "lp" },
    hybrid: { fallback: "💎", title: "Fee mode: hybrid allocation", className: "hybrid" },
    unknown: { fallback: "❓️未", title: "Fee mode: unknown", className: "unknown" }
  };
  /** API 确认过的 mode；loading 不进此集合（永不被 normalizeResult 当成正式结果） */
  const confirmedModes = new Set(Object.keys(modeMeta));
  /**
   * 新币 /modes 未返回前的固定占位（避免先闪 🪙/未知/半截 label 再突变）。
   * 不入 modeCache；仅 DOM 展示。
   */
  const FEE_LOADING_ENTRY = Object.freeze({ __loading: true, mode: "loading" });
  function isFeeLoadingEntry(entry) {
    return Boolean(entry && entry.__loading === true);
  }
  function loadingBadgeLabel() {
    return uiLang === "en" ? "⏳…" : "⏳待加载";
  }
  function loadingBadgeTitle() {
    return uiLang === "en"
      ? "Fee allocation loading…"
      : "税收分配加载中…";
  }

  /**
   * 扫卡门控：稳定正确徽章走快路径；仅 unstable / 错挂嫌疑才全量 enforce.
   * @returns {{ idCa: string|null, allowed: boolean, wiped: boolean }}
   */
  function gateCardIdentity(card) {
    if (!(card instanceof HTMLElement)) {
      return { idCa: null, allowed: false, wiped: false };
    }
    try {
      const marked = (card.dataset[CARD_MARK] || "").toLowerCase();
      if (marked && TARGET_TOKEN_RE.test(marked)) {
        const existing =
          card.querySelector?.(`[${ICON_DATA}="1"][data-fee-token="${marked}"]`) ||
          card.querySelector?.(`[${ICON_DATA}="1"]`);
        if (
          existing instanceof HTMLElement &&
          existing.dataset.feeLoading !== "1" &&
          (existing.dataset.feeToken || "").toLowerCase() === marked &&
          document.contains(existing)
        ) {
          // Debot 列表常无 /token/ href：禁止「无 href 即信任 mark」——
          // 虚拟列表复用后 short CA 已变，旧 SPCXB 徽章会挂在新 NVDAB 行上（CLADY 案例）。
          if (!cardStillMatchesToken(card, marked)) {
            return enforceIdentityOnCard(card);
          }
          const idCa = extractCardHrefToken(card);
          if (idCa && idCa !== marked) {
            return enforceIdentityOnCard(card);
          }
          return { idCa: marked, allowed: true, wiped: false };
        }
      }
    } catch (_fast) {
      // fall through
    }
    return enforceIdentityOnCard(card);
  }

  /**
   * 扫卡/回画前强制：徽章 feeToken 必须等于行身份 CA。
   * 仅拆「错徽章」；正确徽章保留（避免每轮全拆闪烁）。
   * @returns {{ idCa: string|null, allowed: boolean, wiped: boolean }}
   */
  function enforceIdentityOnCard(card) {
    if (!(card instanceof HTMLElement)) {
      return { idCa: null, allowed: false, wiped: false };
    }
    if (!cardHrefAllowedForScan(card)) {
      wipeNonTargetCardBadges(card, extractCardHrefToken(card));
      try {
        delete card.dataset[CARD_MARK];
        card.removeAttribute(CARD_DATA);
      } catch (_clr) {
        // ignore
      }
      return { idCa: null, allowed: false, wiped: true };
    }
    const idCa = extractCardHrefToken(card);
    let wiped = false;

    const shouldDrop = (icon) => {
      if (!(icon instanceof HTMLElement)) return false;
      const fee = (icon.dataset.feeToken || "").toLowerCase();
      if (!idCa) {
        // 无完整 CA：任何实心徽章都不可信（⏳ 也拆，避免挂在错误行上）
        return true;
      }
      if (!TARGET_TOKEN_RE.test(idCa)) return true;
      // fee 空或与行 CA 不一致 → 错徽章
      return !fee || fee !== idCa;
    };

    const removeIcon = (icon) => {
      if (!(icon instanceof HTMLElement)) return;
      try {
        icon.remove();
        wiped = true;
      } catch (_e) {
        // ignore
      }
    };

    try {
      // 常见单徽章：先查一个；仅多徽章时再全量 querySelectorAll
      const first = card.querySelector?.(`[${ICON_DATA}="1"]`);
      if (first) {
        if (shouldDrop(first)) removeIcon(first);
        const all = card.querySelectorAll(`[${ICON_DATA}="1"]`);
        if (all.length > 1) {
          all.forEach((icon) => {
            if (shouldDrop(icon)) removeIcon(icon);
          });
        }
      }
      for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
        if (sib instanceof HTMLElement && sib.matches?.(`[${ICON_DATA}="1"]`)) {
          if (shouldDrop(sib)) removeIcon(sib);
        }
      }
    } catch (_err) {
      // ignore
    }

    if (!idCa) {
      try {
        if (card.dataset[CARD_MARK]) {
          delete card.dataset[CARD_MARK];
          card.removeAttribute(CARD_DATA);
          wiped = true;
        }
      } catch (_e2) {
        // ignore
      }
      cardTokenCache.delete(card);
      try {
        hrefTokenCache.delete(card);
      } catch (_hc) {
        // ignore
      }
      return { idCa: null, allowed: false, wiped };
    }

    if (!TARGET_TOKEN_RE.test(idCa)) {
      wipeNonTargetCardBadges(card, idCa);
      return { idCa, allowed: false, wiped: true };
    }

    try {
      const marked = (card.dataset[CARD_MARK] || "").toLowerCase();
      if (marked && marked !== idCa) {
        delete card.dataset[CARD_MARK];
        card.removeAttribute(CARD_DATA);
        wiped = true;
      }
    } catch (_e3) {
      // ignore
    }

    return { idCa, allowed: true, wiped };
  }

  const WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

  function symbolFromKnownPayoutAddress(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    if (
      a === WBNB_ADDRESS ||
      a === "0x0000000000000000000000000000000000000000"
    ) {
      return "BNB";
    }
    return "";
  }

  function isSingleAssetStockVault(entry) {
    if (!entry || !entry.is_vault) return false;
    if (entry.is_stocks_vault !== true) return false;
    const assets = normalizeBasketAssets(entry.basket_assets);
    if (assets.length !== 1) return false;
    return (Number(entry.market_bps) || 0) >= 10000 && (Number(entry.dividend_bps) || 0) === 0;
  }

  /** 币股金库：fiber/API 的 is_stocks_vault，或篮子至少 2 成分。单枚 leftover Tax 图不算。 */
  function basketLooksLikeNativeOnly(assets) {
    const rows = normalizeBasketAssets(assets);
    if (!rows.length) return false;
    return rows.every((a) => {
      const s = compactBasketSymbol(a.symbol);
      return s === "BNB" || s === "WBNB" || quoteTokenLooksNative(a.address);
    });
  }

  function isTrustedStockVault(entry) {
    if (!entry || !entry.is_vault) return false;
    if (basketLooksLikeNativeOnly(entry.basket_assets)) return false;
    // 篮子只有 SPCXB/QQQB 且等于 LP quote → 税收金库，不是币股指数。
    if (basketLooksLikePoolQuote(entry)) return false;
    if (entry.is_stocks_vault === true) return true;
    const n = normalizeBasketAssets(entry.basket_assets).length;
    if (n >= 2) return true;
    // /modes 单成分篮子（FXIO 100% 金库）可信；host-fee 单枚 Tax 图仍当 leftover。
    return n === 1 && !entry.source_host;
  }

  /** 单成分篮子地址/符号与底池报价相同（SPCX病毒/SPCXB）。 */
  function basketLooksLikePoolQuote(entry) {
    if (!entry) return false;
    const assets = normalizeBasketAssets(entry.basket_assets);
    if (assets.length !== 1) return false;
    const row = assets[0];
    const qTok = String(entry.quote_token || entry.quote_address || "").toLowerCase();
    const addr = String(row.address || "").toLowerCase();
    if (addr && qTok && addr === qTok && !quoteTokenLooksNative(qTok)) return true;
    const aSym = compactBasketSymbol(row.symbol);
    const qSym = compactBasketSymbol(entry.quote_symbol || "");
    if (aSym && qSym && aSym === qSym && !quoteSymbolLooksNative(qSym)) return true;
    return false;
  }

  function basketSymbolMatchesDom(domSym, rowSym) {
    const d = compactBasketSymbol(domSym);
    const r = compactBasketSymbol(rowSym);
    if (!d || !r) return false;
    if (d === r) return true;
    const dr = String(domSym || "")
      .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "")
      .toUpperCase();
    const rr = String(rowSym || "")
      .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "")
      .toUpperCase();
    if (dr.length >= 5 && dr.endsWith("B") && dr.slice(0, -1) === r) return true;
    if (rr.length >= 5 && rr.endsWith("B") && rr.slice(0, -1) === d) return true;
    return false;
  }

  function dedupeBasketAssets(rows) {
    const out = [];
    const seenAddr = new Set();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const address = String(row.address || "").toLowerCase();
      const symbol = compactBasketSymbol(row.symbol || row.name || "");
      const name = String(row.name || symbol || "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, 48);
      if (!symbol && !name) continue;
      if (address) {
        if (seenAddr.has(address)) continue;
        seenAddr.add(address);
      }
      // 无 address 时不去 symbol 重：同 symbol 双成分（如两个 SPCX）只能靠 address 区分
      out.push({ address, symbol: symbol || compactBasketSymbol(name), name: name || symbol });
    }
    return out;
  }

  function mergeBasketWithTaxDomSymbols(assets, domSyms, entry) {
    const rows = normalizeBasketAssets(assets);
    if (!domSyms.length) return rows;
    if (basketLikelyTruncated(rows, entry)) return rows;
    if (rows.length >= 5 && domSyms.length < rows.length) return rows;
    const usedAddr = new Set();
    const usedSym = new Set();
    const next = [];
    for (const sym of domSyms) {
      if (usedSym.has(sym)) continue;
      const matched =
        rows.find(
          (a) =>
            a &&
            basketSymbolMatchesDom(sym, a.symbol) &&
            (!a.address || !usedAddr.has(a.address))
        ) ||
        rows.find((a) => a && a.address && !usedAddr.has(a.address) && !a.symbol) ||
        null;
      if (!matched?.address && rows.length >= 5) continue;
      usedSym.add(sym);
      if (matched?.address) usedAddr.add(matched.address);
      if (matched) {
        const msym = compactBasketSymbol(matched.symbol) || sym;
        usedSym.add(msym);
        next.push({
          address: matched.address || "",
          symbol: msym,
          name: matched.name || msym
        });
        continue;
      }
      // 禁止用 Tax 残留图发明新成分（地推币纯金库 leftover FXIO → 📈）
      if (entry && entry.is_stocks_vault === true && rows.length === 0) {
        next.push({ address: "", symbol: sym, name: sym });
      }
    }
    for (const row of rows) {
      if (isSingleAssetStockVault(entry) && domSyms.length === 1) break;
      const sym = compactBasketSymbol(row.symbol);
      const addr = String(row.address || "").toLowerCase();
      if (addr && usedAddr.has(addr)) continue;
      if (!addr && sym && usedSym.has(sym)) continue;
      if (addr) usedAddr.add(addr);
      else if (sym) usedSym.add(sym);
      next.push(row);
    }
    return dedupeBasketAssets(next);
  }

  function enrichBasketFromTaxDom(card, entry) {
    if (!entry || !(card instanceof HTMLElement)) return { entry, changed: false };
    if (!entry.is_vault) return { entry, changed: false };
    const assets = normalizeBasketAssets(entry.basket_assets);
    if (isSingleAssetStockVault(entry) && assets.length === 1) {
      return { entry, changed: false };
    }
    // 空篮子一律不从 Tax DOM 发明成分
    if (assets.length === 0) {
      return { entry, changed: false };
    }
    const domSyms = extractBasketSymbolsFromTaxDom(card)
      .map((s) => compactBasketSymbol(s))
      .filter(Boolean);
    if (!domSyms.length) return { entry, changed: false };
    const next = mergeBasketWithTaxDomSymbols(assets, domSyms, entry);
    if (!next.length) return { entry, changed: false };
    const beforeSig = assets.map((a) => `${a.address}:${a.symbol}`).join("|");
    const afterSig = next.map((a) => `${a.address}:${a.symbol}`).join("|");
    if (beforeSig === afterSig) return { entry, changed: false };
    const out = {
      ...entry,
      basket_assets: next,
      is_stocks_vault: entry.is_stocks_vault === true || next.length >= 2
    };
    if (out.__needsChain && basketSymbolsReady(next) && !basketLikelyTruncated(next, out)) {
      out.__needsChain = false;
    }
    return { entry: out, changed: true };
  }

  function maybeRepaintAfterEntryEnrich(tok, card, before, after) {
    if (!card || !after || after === before) return;
    const wasPending = before && isHostFeeEntryPending(before);
    const nowPending = isHostFeeEntryPending(after);
    if (wasPending && !nowPending) {
      applyModeToKnownCards(tok, after, [card]);
      return;
    }
    if (nowPending) return;
    try {
      const q = resolveQuoteSymbol(card, after);
      const beforeP = computeBadgePresentation(before, q, tok);
      const afterP = computeBadgePresentation(after, q, tok);
      const labelChanged = beforeP.label && afterP.label && beforeP.label !== afterP.label;
      const countChanged = (beforeP.basketCount || 0) !== (afterP.basketCount || 0);
      if (labelChanged || countChanged) {
        applyModeToKnownCards(tok, after, [card]);
      }
    } catch (_repaint) {
      // ignore
    }
  }

  function quoteSymbolLooksNative(sym) {
    const s = String(sym || "")
      .trim()
      .toUpperCase();
    return !s || s === "BNB" || s === "WBNB";
  }

  function quoteTokenLooksNative(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    return !a || a === WBNB_ADDRESS || a === "0x0000000000000000000000000000000000000000";
  }

  /** /static/quotes/{stem}.png → 展示符号；社交/发射台 logo 返回空 */
  function gmgnQuotesStemFromImg(img) {
    if (!(img instanceof Element)) return "";
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src || isGmgnLaunchpadLogoSrc(src)) return "";
    if (/\/static\/icons\//i.test(src) && !/icon_usd|icon_usdt|icon_usdc|icon_weth/i.test(src)) {
      return "";
    }
    const m = src.match(/\/(?:static\/)?quotes\/([^./?#]+)/i);
    if (!m) return "";
    return symbolFromGmgnQuotesStem(m[1]);
  }

  function dividendSymbolLooksUnresolved(sym) {
    const s = compactDisplaySymbol(sym || "");
    if (!s || s === "BNB" || s === "WBNB") return true;
    return false;
  }

  function tickerSymbolForArrow(symbol) {
    return compactDisplaySymbol(symbol);
  }

  function dividendPayoutLooksNative(entry) {
    const raw = entry?.dividend_symbol || "";
    const sym = compactDisplaySymbol(raw);
    if (sym && /[\u4e00-\u9fff]/.test(sym)) return false;
    if (sym && sym !== "BNB" && sym !== "WBNB") return false;
    const addr = String(entry?.dividend_token || entry?.top_payout_token || "")
      .trim()
      .toLowerCase();
    return (
      !addr ||
      addr === WBNB_ADDRESS ||
      addr === "0x0000000000000000000000000000000000000000"
    );
  }

  function isGmgnTaxInnerQuoteImg(img) {
    if (!(img instanceof Element)) return false;
    try {
      return Boolean(img.closest(GMGN_TAX_DIVIDEND_INNER));
    } catch (_inner) {
      return false;
    }
  }

  function cardDomCacheTok(card) {
    const mark = String(card?.dataset?.[CARD_MARK] || "").toLowerCase();
    let href = "";
    try {
      href = String(card?.getAttribute?.("href") || "");
    } catch (_href) {
      href = "";
    }
    return `${mark}|${href}`;
  }

  const gmgnTaxInnerReuseState = new WeakMap();

  function gmgnTaxInnerStemSig(card) {
    if (!(card instanceof HTMLElement) || !card.querySelector) return "";
    const tax =
      card.querySelector('[data-sentry-component="TaxDividendTokenIcons"]') ||
      card.querySelector(".trenches-tax");
    if (!tax) return "";
    const stems = [];
    const imgs = tax.querySelectorAll('img[src*="/quotes/"], img[src*="/static/quotes/"]');
    for (let i = 0; i < imgs.length; i += 1) {
      const src = imgs[i].currentSrc || imgs[i].getAttribute("src") || "";
      const m = src.match(/\/quotes\/([^./?#]+)/i);
      if (m) stems.push(String(m[1] || "").toLowerCase());
    }
    return stems.join(",");
  }

  /** 虚拟列表换 CA 后 Tax 内图签名没变 → 残留，分红/篮子都不能信。 */
  function gmgnTaxInnerStaleAfterReuse(card) {
    if (!(card instanceof HTMLElement) || !isGmgnHost()) return false;
    const href =
      extractCardHrefToken(card) ||
      String(card.getAttribute("href") || card.dataset[CARD_MARK] || "").toLowerCase();
    const sig = gmgnTaxInnerStemSig(card);
    const prev = gmgnTaxInnerReuseState.get(card);
    if (prev && prev.href && href && prev.href !== href) {
      const stale = Boolean(sig) && sig === prev.sig;
      gmgnTaxInnerReuseState.set(card, { href, sig: stale ? prev.sig : sig, frozen: stale });
      return stale;
    }
    if (prev && prev.frozen && prev.href === href) {
      if (sig === prev.sig) return true;
      gmgnTaxInnerReuseState.set(card, { href, sig, frozen: false });
      return false;
    }
    gmgnTaxInnerReuseState.set(card, { href, sig, frozen: false });
    return false;
  }

  function taxInnerUntrustedAsDividend(inner, outer, entry) {
    if (!inner) return true;
    if (isTrustedStockVault(entry)) return false;
    const cur = compactBasketSymbol(entry?.dividend_symbol || "");
    if (cur && cur !== "BNB" && inner !== cur && !basketSymbolMatchesDom(inner, cur)) {
      return true;
    }
    if (outer && outer !== "BNB" && inner !== outer && inner !== "BNB") return true;
    if (
      looksLikeStockQuoteChip(inner, entry) &&
      dividendPayoutLooksNative(entry)
    ) {
      return true;
    }
    return false;
  }

  /** GMGN Tax 芯片内图标 → 分红代币（TaxDividendTokenIcon；非底池）。多枚=篮子，不当单一分红。 */
  function extractDividendSymbolFromTaxDom(card) {
    if (!card?.querySelector || !isGmgnHost()) return "";
    if (gmgnTaxInnerStaleAfterReuse(card)) return "";
    const now = Date.now();
    const tok = cardDomCacheTok(card);
    const hit = taxDivDomCache.get(card);
    if (
      hit &&
      hit.tok === tok &&
      now - hit.at < (hit.quote ? POOL_QUOTE_DOM_CACHE_MS : POOL_QUOTE_DOM_EMPTY_CACHE_MS)
    ) {
      return hit.quote;
    }
    const scope =
      card.querySelector('[data-sentry-component="TaxDividendTokenIcons"]') ||
      card.querySelector(".trenches-tax");
    let quote = "";
    if (scope) {
      const stems = [];
      const seen = new Set();
      const imgs = scope.querySelectorAll(
        '[data-sentry-component="TaxDividendTokenIcon"] img, img[src*="/quotes/"], img[src*="/static/quotes/"]'
      );
      for (let i = 0; i < imgs.length; i += 1) {
        const stem = compactBasketSymbol(gmgnQuotesStemFromImg(imgs[i]));
        if (!stem || stem === "BNB" || seen.has(stem)) continue;
        seen.add(stem);
        stems.push(stem);
      }
      if (stems.length === 1) quote = stems[0];
    }
    taxDivDomCache.set(card, { tok, at: now, quote });
    return quote;
  }

  function paintedPoolDisagrees(icon, want) {
    if (!(icon instanceof HTMLElement) || !want) return false;
    const text = icon.textContent || "";
    const pipe = text.indexOf(" | ");
    const poolPart =
      pipe >= 0
        ? text.slice(0, pipe)
        : /^(🪙|🦋|🖐️)/.test(text)
          ? text
          : "";
    if (!poolPart) return true;
    return !poolPart.includes(want);
  }

  /** 徽章已画出非 BNB 底池（🦋SPCX 等）— 稳定卡不必再扫 quotes 图 */
  function paintedPoolLooksNonNative(icon) {
    if (!(icon instanceof HTMLElement)) return false;
    const text = icon.textContent || "";
    const pipe = text.indexOf(" | ");
    const poolPart =
      pipe >= 0
        ? text.slice(0, pipe)
        : /^(🪙|🦋|🖐️)/.test(text)
          ? text
          : "";
    if (!poolPart) return false;
    const body = poolPart.replace(/^[🪙🦋🖐️]\s*/u, "").trim();
    return Boolean(body) && !quoteSymbolLooksNative(body);
  }

  /** 普通税币：Tax 外文件名 / quote_address 已指向 NVDAB，徽章还停在默认 BNB → 必须重挂 */
  function isGmgnPoolDomMismatch(card, icon, entry) {
    if (!isGmgnHost() || !entry || forceVaultNativePoolQuote(entry)) return false;
    const want = pickStablePoolQuote(entry, card);
    if (paintedPoolLooksNonNative(icon)) {
      // 错把 Tax 内 AAPLB 当底池后不能锁死：应对回 BNB / 正确外图
      if (want && quoteSymbolLooksNative(want)) return paintedPoolDisagrees(icon, want);
      if (want && !paintedPoolDisagrees(icon, want)) return false;
      return Boolean(want && paintedPoolDisagrees(icon, want));
    }
    if (want && !quoteSymbolLooksNative(want)) {
      return paintedPoolDisagrees(icon, want);
    }
    if (!quoteTokenLooksNative(entry.quote_token || entry.quote_address)) {
      return paintedPoolDisagrees(icon, "BNB") === false;
    }
    return false;
  }

  /** Tax 已画出分红图标，但 host-fee 仍是 BNB / 缺符号 → 必须重挂 */
  function isGmgnHostFeeDomMismatch(card, entry) {
    if (!isGmgnHost() || !entry || !entry.source_host) return false;
    if ((Number(entry.dividend_bps) || 0) <= 0) return false;
    const taxDiv = extractDividendSymbolFromTaxDom(card);
    if (!taxDiv || taxDiv === "BNB") return false;
    const cur = compactBasketSymbol(entry.dividend_symbol || "");
    const outer = compactBasketSymbol(extractQuoteSymbolFromDom(card) || "");
    if (taxInnerUntrustedAsDividend(taxDiv, outer, entry)) return false;
    const taxLatin = Boolean(taxDiv && !/[\u4e00-\u9fff]/.test(taxDiv));
    const curCjk = Boolean(cur && /[\u4e00-\u9fff]/.test(cur));
    // Tax 已画出拉丁分红图时，中文发射名必须让路（宿主 tooltip 是 AAPLB 却显示 牛来）
    if (taxLatin && (curCjk || !cur || cur === "BNB" || dividendPayoutLooksNative(entry))) {
      return true;
    }
    if (!cur || cur === "BNB" || dividendPayoutLooksNative(entry)) return true;
    return cur !== taxDiv;
  }

  function enrichEntrySymbolsFromDom(card, entry, expectedTok) {
    if (!entry || !(card instanceof HTMLElement)) return entry;
    const want = String(expectedTok || card.dataset[CARD_MARK] || "").toLowerCase();
    const hrefTok = extractCardHrefToken(card);
    if (hrefTok && want && hrefTok !== want) return entry;
    const domQuote = extractQuoteSymbolFromDom(card);
    let changed = false;
    const out = { ...entry };
    const basketEnriched = enrichBasketFromTaxDom(card, out);
    if (basketEnriched.changed) {
      Object.assign(out, basketEnriched.entry);
      changed = true;
    }
    if (!out.dividend_symbol && out.dividend_bps > 0) {
      const fromTok = symbolFromKnownPayoutAddress(
        out.dividend_token || out.top_payout_token
      );
      if (fromTok) {
        out.dividend_symbol = fromTok;
        changed = true;
      }
    }
    const divFromTax = extractDividendSymbolFromTaxDom(card);
    if (divFromTax && out.dividend_bps > 0) {
      const cur = compactBasketSymbol(out.dividend_symbol || "");
      const outer = compactBasketSymbol(domQuote || "");
      const leftoverInner = taxInnerUntrustedAsDividend(divFromTax, outer, out);
      const curCjk = /[\u4e00-\u9fff]/.test(cur);
      const taxLatin = Boolean(divFromTax && !/[\u4e00-\u9fff]/.test(divFromTax));
      // Tax 芯片图标后到：host-fee 常先写成 BNB，必须升级成 QQQB/GMEB；中文名让路给拉丁图
      if (
        !leftoverInner &&
        (!cur ||
          (dividendPayoutLooksNative(out) && divFromTax !== "BNB" && divFromTax !== cur) ||
          (curCjk && taxLatin && divFromTax !== "BNB") ||
          (cur && cur !== "BNB" && divFromTax !== cur && (!outer || divFromTax === outer)))
      ) {
        out.dividend_symbol = divFromTax;
        if (out.top_payout_symbol) {
          const topCur = compactBasketSymbol(out.top_payout_symbol);
          if (!topCur || topCur === "BNB" || topCur === cur) {
            out.top_payout_symbol = divFromTax;
          }
        } else {
          out.top_payout_symbol = divFromTax;
        }
        changed = true;
      }
    }
    if (
      !out.dividend_symbol &&
      out.dividend_bps > 0 &&
      domQuote &&
      isRealPoolQuoteSymbol(domQuote) &&
      !looksLikeStockQuoteChip(domQuote, out) &&
      dividendPayoutLooksNative(out)
    ) {
      out.dividend_symbol = domQuote;
      changed = true;
    }
    const pickedPool = pickStablePoolQuote(out, card);
    if (
      pickedPool &&
      !quoteSymbolLooksNative(pickedPool) &&
      (quoteSymbolLooksNative(out.quote_symbol) || !out.quote_symbol)
    ) {
      out.quote_symbol = pickedPool;
      changed = true;
    }
    if (!out.top_payout_symbol) {
      out.top_payout_symbol =
        out.dividend_symbol ||
        out.quote_symbol ||
        (dividendPayoutLooksNative(out) ? domQuote : "");
      if (out.top_payout_symbol) changed = true;
    }
    if (out.__needsChain) {
      const assets = normalizeBasketAssets(out.basket_assets);
      const stockVault = out.is_vault && (out.is_stocks_vault || assets.length >= 2);
      if ((!stockVault || basketSymbolsReady(assets)) && !basketLikelyTruncated(assets, out)) {
        out.__needsChain = false;
        changed = true;
      }
    }
    return changed ? out : entry;
  }

  function trySeedHostFeeForCard(card, token) {
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok) || !pageHookHostFeeReady()) return;
    try {
      window.dispatchEvent(
        new CustomEvent("flap-fee-scan-card", { detail: { token: tok } })
      );
    } catch (_seed) {
      // ignore
    }
  }

  function getEntryForCard(card, token) {
    const tok = String(token || "").toLowerCase();
    let entry = resolveEntry(tok);
    if (!entry && card instanceof HTMLElement) {
      trySeedHostFeeForCard(card, tok);
      entry = resolveEntry(tok);
    }
    if (entry && card instanceof HTMLElement) {
      const before = entry;
      const enriched = enrichEntrySymbolsFromDom(card, entry, tok);
      if (enriched !== entry) {
        modeCache.set(tok, enriched);
        maybeRepaintAfterEntryEnrich(tok, card, before, enriched);
        entry = enriched;
      }
    }
    return entry;
  }

  function isEntryReadyForDisplay(card, token) {
    const entry = getEntryForCard(card, token);
    return entry && !isHostFeeEntryPending(entry);
  }

  function paintHostFeeDeferHit(card, tok) {
    const hit = getEntryForCard(card, tok);
    if (hit && card instanceof HTMLElement && !isHostFeeEntryPending(hit)) {
      paintListCardFromCacheFast(card, tok, hit) || renderMode(card, tok, hit);
    } else if (hit && isHostFeeEntryPending(hit)) {
      renderMode(card, tok, FEE_LOADING_ENTRY);
    }
  }

  function finishHostFeeDeferWaiter(tok, waiter) {
    hostFeeDeferWaiters.delete(tok);
    if (!waiter) return;
    const { card, options } = waiter;
    if (isEntryReadyForDisplay(card, tok)) {
      paintHostFeeDeferHit(card, tok);
      return;
    }
    queueToken(tok, {
      ...options,
      deferFlush: options.deferFlush === true || pageHookHostFeeReady()
    });
  }

  function ensureHostFeeDeferPoll() {
    if (hostFeeDeferPollTimer || hostFeeDeferWaiters.size === 0) return;
    if (!hostFeeDeferPollStartedAt) hostFeeDeferPollStartedAt = Date.now();
    const poll = () => {
      hostFeeDeferPollTimer = 0;
      if (hostFeeDeferWaiters.size === 0) {
        hostFeeDeferPollStartedAt = 0;
        return;
      }
      const feedReady = hostTaxFeedReady();
      const expired =
        Date.now() - hostFeeDeferPollStartedAt >= HOST_FEE_QUEUE_MAX_MS;
      const toFinish = [];
      for (const [tok, waiter] of hostFeeDeferWaiters) {
        if (isEntryReadyForDisplay(waiter.card, tok)) {
          paintHostFeeDeferHit(waiter.card, tok);
          hostFeeDeferWaiters.delete(tok);
          continue;
        }
        const minWait = needsHostTaxFeedPoll() ? 0 : pageHookHostFeeReady() ? 200 : 0;
        const readyByTime = Date.now() - (waiter.addedAt || 0) >= minWait;
        if ((feedReady && readyByTime) || expired) {
          toFinish.push(tok);
        }
      }
      for (let i = 0; i < toFinish.length; i += 1) {
        finishHostFeeDeferWaiter(toFinish[i], hostFeeDeferWaiters.get(toFinish[i]));
      }
      if (hostFeeDeferWaiters.size > 0 && !feedReady && !expired) {
        hostFeeDeferPollTimer = window.setTimeout(poll, HOST_FEE_QUEUE_POLL_MS);
      } else {
        hostFeeDeferPollStartedAt = 0;
      }
    };
    hostFeeDeferPollTimer = window.setTimeout(poll, HOST_FEE_QUEUE_POLL_MS);
  }

  function isBadgeAccessAllowed() {
    return !licenseEnforcedByServer || licenseAccessGranted;
  }

  function clearBadgeAccessForLicense(reason) {
    requestQueue.clear();
    missingRetryState.clear();
    gmgnNewCardPendingTokens.clear();
    modeCache.clear();
    abortActiveRequest(reason || "license");
    if (batchTimer) {
      window.clearTimeout(batchTimer);
      batchTimer = null;
    }
    batchActive = false;
    batchStartedAt = 0;
    try {
      document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
        const card = icon.closest(`[${CARD_DATA}]`) || icon.parentElement;
        if (card) removeAllBadgesForCard(card, icon.dataset.feeToken || "");
      });
    } catch (_clr) {
      // ignore
    }
    debugInfo("license:cleared", { reason });
  }

  function noteLicenseDeniedFromApi(errorCode) {
    const wasAllowed = isBadgeAccessAllowed();
    licenseEnforcedByServer = true;
    licenseAccessGranted = false;
    if (wasAllowed) clearBadgeAccessForLicense(`api:${errorCode || "license"}`);
  }

  async function refreshLicenseAccessState(reason) {
    if (!isExtensionContextValid()) return;
    if (licenseGateProbePromise) return licenseGateProbePromise;
    licenseGateProbePromise = (async () => {
      try {
        const wasAllowed = isBadgeAccessAllowed();
        const headers = { "Content-Type": "application/json" };
        if (licenseAccessKey) {
          headers.Authorization = `Bearer ${licenseAccessKey}`;
          if (licenseDeviceId) headers["X-Flap-Device-Id"] = licenseDeviceId;
        }
        const res = await fetch(`${DEFAULT_API_BASE}/license/verify`, {
          method: "POST",
          headers,
          body: "{}",
          cache: "no-store"
        });
        const data = await res.json().catch(() => null);
        if (!licenseAccessKey) {
          licenseEnforcedByServer = data?.enforced === true;
          licenseAccessGranted = !licenseEnforcedByServer;
        } else if (res.ok && data?.ok && data?.valid && data.device_match !== false) {
          licenseEnforcedByServer = data?.enforced === true;
          licenseAccessGranted = true;
        } else {
          if (data?.enforced === true) licenseEnforcedByServer = true;
          licenseAccessGranted = false;
        }
        const nowAllowed = isBadgeAccessAllowed();
        if (wasAllowed && !nowAllowed) {
          clearBadgeAccessForLicense(reason || "gate");
        } else if (!wasAllowed && nowAllowed) {
          if (requestQueue.size > 0) scheduleBatchFlush({ immediate: true });
          scheduleScan(200, { force: false, immediate: false });
        }
        debugInfo("license:gate", {
          reason,
          enforced: licenseEnforcedByServer,
          granted: licenseAccessGranted,
          hasKey: Boolean(licenseAccessKey)
        });
      } catch (_probe) {
        debugInfo("license:gate-probe-failed", { reason });
      } finally {
        licenseGateProbePromise = null;
      }
    })();
    return licenseGateProbePromise;
  }

  function cardStillWaitingBadge(tok) {
    const token = String(tok || "").toLowerCase();
    const entry = modeCache.get(token) || resolveEntry(token);
    if (!entry || isFeeLoadingEntry(entry)) return true;
    return isHostFeeEntryPending(entry);
  }

  function hostFeeCanSkipModes(entry) {
    if (!entry || isFeeLoadingEntry(entry)) return false;
    if (isHostFeeEntryPending(entry)) return false;
    if (entry.__needsChain === true) return false;
    if (hostFeeShouldDeferToModes(entry)) return false;
    return hostFeeAllocationBps(entry) > 0;
  }

  function cancelLoadingModesKick(token) {
    const tok = String(token || "").toLowerCase();
    const timerId = loadingModesKickTimers.get(tok);
    if (!timerId) return;
    try {
      window.clearTimeout(timerId);
    } catch (_clr) {
      // ignore
    }
    loadingModesKickTimers.delete(tok);
  }

  function releaseQueuedTokenIfHostFeeReady(token) {
    const tok = String(token || "").toLowerCase();
    const entry =
      modeCache.get(tok) ||
      (isPersistentCacheHit(tok) ? persistentCache.get(tok) : null);
    if (!hostFeeCanSkipModes(entry)) return false;
    requestQueue.delete(tok);
    gmgnNewCardPendingTokens.delete(tok);
    cancelLoadingModesKick(tok);
    return true;
  }

  function tokenNeedsModesFetch(token) {
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok)) return false;
    if (shouldHideByCustomSuffix(tok)) return false;
    const entry =
      modeCache.get(tok) ||
      (isPersistentCacheHit(tok) ? persistentCache.get(tok) : null);
    if (!entry || isFeeLoadingEntry(entry)) return true;
    return !hostFeeCanSkipModes(entry);
  }

  function forceModesForWaitingToken(tok) {
    const token = String(tok || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(token) || !isExtensionContextValid()) return;
    if (!isBadgeAccessAllowed() || !isAllowedScanChain()) return;
    if (releaseQueuedTokenIfHostFeeReady(token)) return;
    if (!tokenNeedsModesFetch(token)) return;
    if (!cardStillWaitingBadge(token)) return;
    if (!requestQueue.has(token)) {
      queueToken(token, { deferFlush: true });
    }
    if (isGmgnHost() || isDebotHost()) gmgnNewCardPendingTokens.add(token);
    // Debot 战壕：1s kick 只入组批，禁止 delay 0 单打 / 热通道。
    if (isDebotHost() && isTrenchListPage()) {
      scheduleGmgnNewCardBatchFlush();
      return;
    }
    if (isGmgnHost() && batchActive && !hotLaneActive) {
      try {
        void flushHotLane();
      } catch (_hot) {
        // ignore
      }
    }
    maybeFlushRequestQueue("loading-kick");
  }

  function scheduleLoadingModesKick(tok) {
    const token = String(tok || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(token) || loadingModesKickTimers.has(token)) return;
    if (loadingModesKickTimers.size >= 48) {
      const oldest = loadingModesKickTimers.keys().next().value;
      if (oldest) {
        try {
          window.clearTimeout(loadingModesKickTimers.get(oldest));
        } catch (_old) {
          // ignore
        }
        loadingModesKickTimers.delete(oldest);
      }
    }
    const timerId = window.setTimeout(() => {
      loadingModesKickTimers.delete(token);
      forceModesForWaitingToken(token);
    }, LOADING_MODES_KICK_MS);
    loadingModesKickTimers.set(token, timerId);
  }

  function scheduleHostFeeAwareQueue(card, token, options = {}) {
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok)) return;
    if (!isBadgeAccessAllowed()) return;
    const existingEntry = resolveEntry(tok);
    if (existingEntry && !isHostFeeEntryPending(existingEntry)) return;
    if (hostFeeDeferWaiters.has(tok)) {
      const prev = hostFeeDeferWaiters.get(tok);
      if (card instanceof HTMLElement) prev.card = card;
      scheduleLoadingModesKick(tok);
      return;
    }
    hostFeeDeferWaiters.set(tok, { card, options, addedAt: Date.now() });
    scheduleLoadingModesKick(tok);
    ensureHostFeeDeferPoll();
  }

  function paintLoadingBadgeAndQueue(card, token, options = {}) {
    const tok = String(token || "").toLowerCase();
    if (!(card instanceof HTMLElement) || !TARGET_TOKEN_RE.test(tok)) return false;
    if (!isBadgeAccessAllowed()) return false;
    if (shouldDeferGmgnTrenchResizeWork()) return false;
    // 钱包追踪 / 顶 ticker / 搜索「钱包」区：禁止任何徽章
    if (isBadgeMountForbidden(card)) {
      wipeForbiddenMountBadges(card, true);
      return false;
    }
    // 行身份必须就是 tok，否则禁止画任何东西（包括 ⏳）
    const idCa = extractCardHrefToken(card);
    if (idCa && idCa !== tok) {
      enforceIdentityOnCard(card);
      return false;
    }
    // GMGN 新行：href 偶发晚一帧 — short 已是 7777/ffff 时仍允许 ⏳（与 7777 同权，避免 ffff 空白数秒）
    if (!idCa) {
      const short = findCardShortAddress(card);
      if (!short || !tokenMatchesShort(tok, short)) {
        if (isGmgnHost()) {
          scheduleHostFeeAwareQueue(card, tok, options);
        } else {
          scheduleHostFeeAwareQueue(card, tok, options);
        }
        return false;
      }
    }
    // 有正式缓存时绝不画 ⏳（调用方应走真徽章路径；未稳定仍算待加载）
    if (isEntryReadyForDisplay(card, tok)) return false;
    // 先拆光错徽章，再挂 ⏳
    enforceIdentityOnCard(card);
    try {
      card.dataset[CARD_MARK] = tok;
      card.setAttribute(CARD_DATA, tok);
    } catch (_err) {
      // ignore
    }
    scheduleHostFeeAwareQueue(card, tok, options);
    scheduleLoadingModesKick(tok);
    try {
      const existing = card.querySelector(`[${ICON_DATA}="1"]`);
      if (
        existing &&
        existing.dataset.feeToken === tok &&
        existing.dataset.feeLoading === "1"
      ) {
        return true;
      }
      if (existing) {
        removeAllBadgesForCard(card, tok);
      }
    } catch (_e2) {
      // ignore
    }
    return renderMode(card, tok, FEE_LOADING_ENTRY) === true;
  }

  /**
   * K 线多栏：左侧战壕列（新创建/已开盘）几何门禁。
   * 排除右侧 K 线主区与顶栏，避免把图表区 href 当列表卡快补。
   */
  function isGmgnTokenTrenchSidebarEl(el) {
    if (!(el instanceof HTMLElement) || !isGmgnTokenPage()) return false;
    if (!el.closest?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)) return false;
    try {
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 28) return false;
      if (r.top < 52) return false;
      // 排除顶栏地址/总税率锁
      if (isGmgnHeaderMarkedCard(el) || isGmgnTokenHeaderCard(el)) return false;
      if (el.closest?.(`[${ICON_DATA}="1"][data-fee-header="1"]`)) return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  /** K 线侧栏还有未画的 7777/8888/ffff TokenItem（刷新后顶栏先就绪时不能改 light-scan）。 */
  function hasUnpaintedGmgnSidebarTargets() {
    if (!isGmgnHost() || !isGmgnTokenPage()) return false;
    try {
      const roots = document.querySelectorAll(GMGN_FIXED_TRENCH_ROOT_SELECTOR);
      const hrefSel =
        "[href*='/bsc/token/'][href*='7777'], [href*='/bsc/token/'][href*='8888'], " +
        "[href*='/bsc/token/'][href*='ffff'], [href*='/token/'][href*='7777'], " +
        "[href*='/token/'][href*='8888'], [href*='/token/'][href*='ffff']";
      for (let ri = 0; ri < roots.length; ri += 1) {
        const root = roots[ri];
        if (!(root instanceof HTMLElement)) continue;
        const cards = root.querySelectorAll(
          '[data-sentry-source-file="TokenItem.tsx"]'
        );
        const lim = Math.min(cards.length, 18);
        for (let i = 0; i < lim; i += 1) {
          const card = cards[i];
          if (!(card instanceof HTMLElement)) continue;
          const r = card.getBoundingClientRect();
          if (r.width < 180 || r.height < 56 || r.bottom < 80 || r.top > window.innerHeight) {
            continue;
          }
          const href = card.getAttribute("href") || "";
          if (!TARGET_TOKEN_RE.test(extractAnyToken(href) || "")) {
            const inner = card.querySelector(hrefSel);
            const h2 = inner ? inner.getAttribute("href") || "" : "";
            if (!TARGET_TOKEN_RE.test(extractAnyToken(h2) || "")) continue;
          }
          if (!card.querySelector(`[${ICON_DATA}="1"]`)) return true;
        }
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  function isNearGmgnTokenTrenchViewport(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    return (
      rect.bottom >= -GMGN_TOKEN_TRENCH_VIEWPORT_PAD_TOP &&
      rect.top <= window.innerHeight + GMGN_TOKEN_TRENCH_VIEWPORT_PAD_Y
    );
  }

  /**
   * GMGN 视口未画 TARGET（7777/8888/ffff）快补：不占主扫 budget。
   * 根因：稳态每轮只 touch 12 卡，瞬间 7777 占满预算时 ffff 要等数轮（数秒）才进 needWork。
   * ffff 与 7777 必须同权 — 本函数按 TokenItem href 扫，不偏后缀。
   * 0.7.5：K 线 token 页也跑侧栏（禁图表主区），修下滑已开盘几十秒无徽章。
   */
  function paintUnpaintedTargetViewportQuick(reason, rootHint = null, bypassGap = false) {
    if (!isGmgnHost()) return 0;
    if (!isExtensionContextValid() || !isTabVisible()) return 0;
    const tokenPage = isGmgnTokenPage() || isTokenDetailRoute();
    // K 线侧栏与首页战壕一样要补画；进 K 线过渡只挡首页整列扫描，不挡侧栏。
    if (isTokenEnterTransitionActive() && !tokenPage) return 0;
    if (shouldDeferGmgnTrenchResizeWork()) return 0;
    if (isGmgnScrollCooling()) return 0;
    const now = Date.now();
    if (!bypassGap && now - lastViewportQuickAt < GMGN_VIEWPORT_QUICK_MIN_GAP_MS) return 0;
    lastViewportQuickAt = now;
    let painted = 0;
    let queued = 0;
    const cap = tokenPage ? 16 : 10;
    const t0 = performance.now();
    const msCap = tokenPage ? 24 : 12;
    try {
      const hrefSelector =
        '[href*="/bsc/token/"][href*="0x"], [href*="/token/"][href*="0x"]';
      const itemSelector = '[data-sentry-source-file="TokenItem.tsx"]';
      const items = [];
      const seen = new Set();
      const seenCards = new Set();
      const roots =
        rootHint instanceof HTMLElement && rootHint.isConnected
          ? [rootHint]
          : tokenPage
            ? Array.from(document.querySelectorAll(GMGN_FIXED_TRENCH_ROOT_SELECTOR)).filter(
                (root) => {
                  if (!(root instanceof HTMLElement) || !root.isConnected) return false;
                  const r = root.getBoundingClientRect();
                  return (
                    r.width >= 180 &&
                    r.height >= 120 &&
                    r.bottom > 0 &&
                    r.top < window.innerHeight
                  );
                }
              )
            : getScanRoots();
      const fixedTrenchRoot = rootHint instanceof HTMLElement
        ? rootHint.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
          ? rootHint
          : rootHint.closest?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
        : null;
      if (tokenPage && !fixedTrenchRoot) {
        const buckets = roots.map((root) =>
          Array.from(root.querySelectorAll?.(itemSelector) || []).filter((el) => {
            if (!(el instanceof HTMLElement)) return false;
            const r = el.getBoundingClientRect();
            return r.width >= 180 && r.height >= 56 && r.bottom > 0 && r.top < window.innerHeight + 80;
          })
        );
        const unpainted = [];
        const paintedCards = [];
        const maxRows = Math.max(0, ...buckets.map((b) => b.length));
        for (let row = 0; row < maxRows; row += 1) {
          for (let b = 0; b < buckets.length; b += 1) {
            const el = buckets[b][row];
            if (!el || seen.has(el)) continue;
            seen.add(el);
            if (el.querySelector?.(`[${ICON_DATA}="1"]`)) paintedCards.push(el);
            else unpainted.push(el);
          }
        }
        items.push(...unpainted, ...paintedCards);
      } else {
        const itemCap = tokenPage ? 100 : 80;
        for (const root of roots) {
          if (!(root instanceof HTMLElement) || !root.isConnected) continue;
          if (root.matches?.(hrefSelector) && !seen.has(root)) {
            seen.add(root);
            items.push(root);
          }
          const nested = root.querySelectorAll(hrefSelector);
          for (let i = 0; i < nested.length && items.length < itemCap; i += 1) {
            const item = nested[i];
            if (seen.has(item)) continue;
            seen.add(item);
            items.push(item);
          }
          if (items.length >= itemCap) break;
        }
      }
      for (let i = 0; i < items.length; i += 1) {
        if (painted + queued >= cap) break;
        if (performance.now() - t0 > msCap) break;
        const el = items[i];
        if (!(el instanceof HTMLElement)) continue;
        let card = el;
        if (fixedTrenchRoot instanceof HTMLElement) {
          card = quickClimbCardFromTokenLink(el) || climbGmgnListCard(el);
          if (!(card instanceof HTMLElement) || !fixedTrenchRoot.contains(card)) continue;
          if (!isNearViewport(card, false)) continue;
        } else if (tokenPage) {
          // K 线战壕常把 href 放在卡片内的短地址行（高度约 16px）。
          // 先爬到真实卡片，再做侧栏和视口门禁，否则下滑后的卡会被永久跳过。
          if (!isGmgnTokenTrenchSidebarEl(card)) {
            card = quickClimbCardFromTokenLink(el) || climbGmgnListCard(el);
          }
          if (!isGmgnTokenTrenchSidebarEl(card)) continue;
          if (!isNearGmgnTokenTrenchViewport(card)) continue;
        } else if (!isNearViewport(el, false)) {
          continue;
        }
        if (!(card instanceof HTMLElement) || seenCards.has(card)) continue;
        seenCards.add(card);
        if (!(fixedTrenchRoot instanceof HTMLElement) && isBadgeMountForbidden(card)) {
          wipeForbiddenMountBadges(card, true);
          continue;
        }
        const raw =
          el.getAttribute("href") ||
          card.getAttribute("href") ||
          card.querySelector?.("[href]")?.getAttribute("href") ||
          "";
        const ca = extractAnyToken(raw);
        if (!ca || !TARGET_TOKEN_RE.test(ca)) continue;
        // 已有正确徽章（含 ⏳）
        try {
          const good = findLocalBadgeForCard(card, ca);
          if (
            good instanceof HTMLElement &&
            document.contains(good) &&
            good.dataset.feeToken === ca &&
            !isGmgnTrenchMisplacedBadge(card, good)
          ) {
            continue;
          }
          if (good instanceof HTMLElement && isGmgnTrenchMisplacedBadge(card, good)) {
            removeAllBadgesForCard(card, ca);
          }
        } catch (_q) {
          // ignore
        }
        // 错徽章（邻行 7777 残留）先拆
        try {
          const bad = findLocalBadgeForCard(card);
          if (
            bad instanceof HTMLElement &&
            bad.dataset.feeToken &&
            bad.dataset.feeToken !== ca
          ) {
            removeAllBadgesForCard(card, bad.dataset.feeToken);
          }
        } catch (_b) {
          // ignore
        }
        const entry = getEntryForCard(card, ca);
        if (entry && !isFeeLoadingEntry(entry)) {
          try {
            card.dataset[CARD_MARK] = ca;
            card.setAttribute(CARD_DATA, ca);
          } catch (_m) {
            // ignore
          }
          if (
            paintListCardFromCacheFast(card, ca, entry) ||
            renderMode(card, ca, entry)
          ) {
            painted += 1;
          }
        } else if (paintLoadingBadgeAndQueue(card, ca)) {
          painted += 1;
          queued += 1;
        } else {
          queueToken(ca);
          queued += 1;
        }
      }
    } catch (_err) {
      // ignore
    }
    if (queued > 0) maybeFlushRequestQueue(reason || "viewport-target-quick");
    if (painted > 0 || queued > 0) {
      debugInfo("viewport-target-quick", {
        reason: reason || "",
        tokenPage,
        painted,
        queued,
        ms: Math.round(performance.now() - t0)
      });
    }
    return painted;
  }

  const TIP_I18N = {
    zh: {
      taxAlloc: "税收分配",
      buySell: "买卖税",
      basket: "币股分红资产",
      pool: "底池",
      token: "合约",
      emptyBasket: "暂无篮子成分",
      moreAssets: "全部成分"
    },
    en: {
      taxAlloc: "Tax allocation",
      buySell: "Buy / sell tax",
      basket: "Equity basket",
      pool: "Pool",
      token: "Token",
      emptyBasket: "No basket assets",
      moreAssets: "All assets"
    }
  };

  const siteStrategy = createSiteStrategy();
  if (!siteStrategy) return;

  // token -> full allocation result
  const modeCache = new Map();
  const persistentCache = new Map();
  /** @type {WeakMap<HTMLElement, { tipModel: object }>} */
  const badgeTipData = new WeakMap();
  let uiLang = "zh";
  /** @type {HTMLElement | null} */
  let feeTooltipEl = null;
  /** @type {HTMLElement | null} */
  let feeTooltipAnchor = null;
  let feeTooltipHideTimer = 0;
  /** @type {{ enabled: boolean, thresholdPct: number }} */
  let taxRecvHidePrefs = { ...DEFAULT_TAX_RECV_HIDE };
  /** address(lower) -> { recvPct, isVault, source } from host list APIs (page-hook). */
  const taxRecvMap = new Map();
  let taxRecvHideApplyTimer = 0;
  let gmgnFilterReloadTimer = 0;
  /** @type {{ enabled: boolean, rules: { id: string, suffix: string, enabled: boolean }[] }} */
  let suffixHidePrefs = { enabled: false, rules: [] };
  /** @type {{ enabled: boolean, hideTaxVault: boolean, hideStockVault: boolean }} */
  let vaultHidePrefs = { ...DEFAULT_VAULT_HIDE };
  let searchHidePrefs = { ...DEFAULT_SEARCH_HIDE };
  let searchOverlayDidHide = false;
  let searchOverlayHideTimer = 0;
  const requestQueue = new Set();
  let batchTimer = null;
  /** Delay of the pending batchTimer (ms); prefer shorter reschedules (hot tokens). */
  let pendingBatchDelayMs = -1;
  let batchActive = false;
  let batchStartedAt = 0;
  let batchGeneration = 0;
  let activeAbortController = null;
  /** Tokens currently inside an in-flight /modes request (re-queue on force recover). */
  let activeBatchTokens = [];
  // 0.7.57 热通道：主批在途时，视口/新创建热 token 走独立并行 /modes，
  // 不再被单飞 batchActive 锁压在大批后面（竞态：新币撞上冷大批要等好几秒）。
  let hotLaneActive = false;
  let hotLaneStartedAt = 0;
  let hotLaneGeneration = 0;
  let hotLaneAbortController = null;
  /** Tokens inside the in-flight hot-lane request (re-queue on reset). */
  let hotLaneTokens = [];
  let consecutiveFails = 0;
  /** Per-token backoff for API soft misses; prevents a zero-delay /modes loop. */
  const missingRetryState = new Map();
  /** GMGN only: one deferred requeue timer per token after miss/fail. */
  const gmgnMissingRequeueTimers = new Map();
  /** GMGN visible cards discovered directly from fixed-root mutations. */
  const gmgnNewCardPendingTokens = new Set();
  let gmgnNewCardBatchTimer = null;
  /** 最近一次确认存在热工作（视口/新创建未画）的墙钟，用于退热 */
  let lastGmgnHotWorkAt = 0;
  let scanScheduled = false;
  let lastScanAt = 0;
  /** Wall clock of last completed scanVisibleCards (watchdog uses this). */
  let persistentCacheReady = false;
  let persistentCacheReadyWaiters = [];
  let lastResumeAt = 0;
  let lastHardResetAt = 0;
  /** performance.now() / Date when tab became hidden (0 if visible). */
  let hiddenSinceMs = 0;
  /** Until this timestamp, always remount badges (skip idempotent short-circuit). */
  /** Live display toggles from popup (chrome.storage). */
  let displayPrefs = { ...DEFAULT_DISPLAY_PREFS };
  /** dark | light — badge chrome colors */
  let badgeTheme = DEFAULT_BADGE_THEME;
  /** dark theme: solid card-like bg (#0d1110) when true */
  let badgeSolidDark = DEFAULT_BADGE_SOLID_DARK;
  /** { gmgn|debot: { enabled, x, y } } */
  let badgeOffsets = {
    gmgn: { ...DEFAULT_BADGE_OFFSETS.gmgn },
    debot: { ...DEFAULT_BADGE_OFFSETS.debot }
  };
  /** Popup toggle: allow dragging a badge on page to set absolute coords. */
  let badgeDragEdit = false;
  /** Active pointer drag state (one badge only). */
  let badgeDragState = null;
  let badgeDragHandlersInstalled = false;
  /** Cached GMGN "总税率" label node (invalidated on SPA). */
  let taxRateLabelCache = { el: null, at: 0 };
  let pipelineWatchdogId = null;
  /** Scan timers scheduled with force (must not leave scanScheduled stuck). */
  let scanTimerIds = [];
  /** WeakMap card -> { at, el } for Debot mount reuse. Replaced on SPA (fresh map). */
  let debotMountCache = new WeakMap();
  /** GMGN only: card -> { at, el } Tax chip mount (findTaxTag). Replaced on SPA. */
  let gmgnTaxMountCache = new WeakMap();
  /** card -> last extracted full CA (skip deep scan when stable). Replaced on SPA. */
  let cardTokenCache = new WeakMap();
  /** @type {WeakMap<Element, { token: string|null, at: number }>} */
  let hrefTokenCache = new WeakMap();
  /** card → { tok, at, quote } Tax-outer pool symbol. Replaced on SPA. */
  let poolQuoteDomCache = new WeakMap();
  /** card → { tok, at, quote } Tax-inner single dividend stem. */
  let taxDivDomCache = new WeakMap();
  /** card → { tok, at, syms } Tax-inner basket stems. */
  let taxBasketDomCache = new WeakMap();
  let lastScrubIdentityAt = 0;
  let lastScrubHrefAt = 0;
  let lastViewportQuickAt = 0;
  let badgeForbiddenCache = new WeakMap();
  /** GMGN panel classification cache; replaced on SPA route changes. */
  let gmgnPanelProbeCache = new WeakMap();
  /** GMGN only: suppress mutation scans until this wall time (scroll settle). */
  let gmgnScrollQuietUntil = 0;
  /** GMGN only: one-shot scan after scroll stops. */
  let gmgnScrollResumeTimer = null;
  /** Whether the current scroll window touched a badge-bearing surface. */
  let gmgnScrollResumeNeedsScan = false;
  /** Last allowed GMGN scroller; lets settle fill only the column the user moved. */
  let gmgnScrollResumeTarget = null;
  /** Forbidden scroller gets a targeted residue cleanup after settle, never a scan. */
  let gmgnForbiddenScrollTarget = null;
  let gmgnForbiddenScrollTargetCache = new WeakMap();
  /** Debot/Gungnir: suppress mutation scans while virtual rows are recycling. */
  let debotScrollQuietUntil = 0;
  let debotScrollResumeTimer = null;
  /** Last Debot column scroller; settle paints only the column the user moved. */
  let debotScrollResumeTarget = null;
  let lastPersistWallMs = 0;
  let mutationDebounceTimer = null;
  /** Route key for SPA detection (ignore volatile ref=). */
  let lastRouteKey = getRouteKey();
  /** Until this time, mutations only mark dirty (no scan storm mid-rebuild). */
  let spaQuietUntil = 0;
  /** DOM mutated during SPA quiet — flush one scan when quiet ends. */
  let spaDomDirty = false;
  let spaNavCoalesceTimer = null;
  let spaNavScanTimers = [];
  let routePollId = null;
  /** Cached list roots for scoped query (observer always on documentElement). */
  let scanRootsCache = { at: 0, roots: [] };
  const SCAN_ROOTS_TTL_MS = 6000;
  /** Count completed scans — run expensive cleanup sparsely. */
  let scanGeneration = 0;
  /** GMGN home: next visible row index for three-column round-robin hole filling. */
  let gmgnSteadyRoundRobinRow = 0;
  let debotSteadyRoundRobinRow = 0;
  /** Last bound observer roots (skip rebind when identity unchanged). */
  let lastObserverRoots = [];
  let gmgnObserverRefreshTimer = null;
  let debotObserverRefreshTimer = null;
  /** Next scan only walks dialog + side-board roots (skip K-line header thrash). */
  let pendingLightScan = false;
  /** Debot/Gungnir: force-paint token header until success or timeout after SPA. */
  let debotTokenHeaderWatchId = null;
  let debotTokenHeaderWatchUntil = 0;
  /** MutationObserver until Debot token header badge appears (SPA activation). */
  let debotHeaderDomObs = null;
  let debotHeaderDomObsLastPaintAt = 0;
  /** MutationObserver for list-return when columns mount late (GMGN/Debot). */
  let listReturnDomObs = null;
  let listReturnDomObsLastAt = 0;
  let listReturnDomObsUntil = 0;
  /** Always-on while Debot/Gungnir tab lives — does not depend on SPA detect. */
  let debotTokenGuardianId = null;
  /** Quiet-end flush timer (spaDomDirty → one full scan). */
  let spaQuietFlushTimer = null;
  /** After click on /token/ — keep header force-paint until this time. */
  let debotTokenClickArmUntil = 0;
  /** Freeze outgoing list writes until the real token header accepts a badge. */
  let tokenEnterTransitionUntil = 0;
  /** Never run speculative header scans in the host's first route-render slice. */
  let tokenEnterPaintAfter = 0;
  /** Freeze list writes after token -> list URL commit until real trench cards mount. */
  let listReturnTransitionUntil = 0;
  let listReturnTransitionTimer = null;
  /** Short-lived GMGN transition probe cache; prevents repeated layout reads during mount bursts. */
  let gmgnTrenchProbeCache = { at: 0, roots: [], ready: false };
  let gmgnTrenchRootsCache = { at: 0, roots: [] };
  /** PumpSub roots still owned by the token page when a list return begins. */
  let gmgnOutgoingTrenchRoots = new WeakSet();
  /** Throttle immediate mutation header paint. */
  let debotHeaderMutPaintAt = 0;
  /** Wall time of last force full-scan (not light). */
  let lastForceFullScanAt = 0;
  /** Coalesce timer for deferred force full-scan. */
  let forceFullScanCoalesceTimer = null;
  /** Last full-scan from guardian/watch while header missing. */
  let lastDebotHeaderFullScanAt = 0;
  /** findDebotTokenHeaderCard short cache. */
  let debotHeaderFindCache = { at: 0, key: "", el: null };
  /** Positive hasDebotTokenHeaderBadge short cache. */
  let debotHeaderBadgeOkUntil = 0;
  let debotHeaderBadgeOkEl = null;
  /**
   * token→list SPA soft window: viewport-first, smaller budget, no offscreen thrash.
   * Wall-clock until this time (0 = inactive).
   */
  let spaListReturnUntil = 0;
  /** First wave: only paint from modeCache / persistent cache (skip extract+queue). */
  let spaListReturnCacheOnlyUntil = 0;
  /** Prev route was token detail (for settle classification). */
  let spaSettleFromToken = false;
  /** List-return keep-alive timer id. */
  let listReturnKeepAliveId = null;
  /** Overlay (search/history) fast-paint window until this wall time. */
  let overlayFastUntil = 0;
  /** Last known overlay open edge (arm dense kicks on open). */
  let lastOverlayOpen = false;
  /** GMGN search panel root short cache. */
  let gmgnSearchPanelCache = { el: null, at: 0 };
  /** quickHasOpenOverlay short cache (mutation thrash). */
  let overlayDetectCache = { at: 0, open: false };
  /** Consecutive Debot header miss ticks (guardian backoff). */
  let debotHeaderMissStreak = 0;
  /** Wall time when Debot header miss streak started. */
  let debotHeaderMissSince = 0;
  /** GMGN token multi-panel: keep header + left trench painting (cross-browser). */
  let gmgnTokenGuardianId = null;
  let gmgnHeaderMissSince = 0;
  /** Coalesced header repairs after React replaces the address row. */
  let gmgnHeaderRepairTimer = null;
  let debotHeaderRepairTimer = null;
  /** GMGN token-page TokenItem rows changed since the last targeted pass. */
  const gmgnEmbeddedDirtyCards = new Set();
  let gmgnEmbeddedDirtyTimer = null;
  /** True while the tall GMGN token-page col-resize handle is being dragged. */
  let gmgnTrenchResizeActive = false;
  let gmgnTrenchResizeQuietUntil = 0;
  let gmgnTrenchResizeDirty = false;
  let gmgnTrenchResizeSettleTimer = null;
  /** Stable header badge reference; avoids document geometry reads per mutation batch. */
  let gmgnHeaderBadgeCache = { token: "", el: null };
  /** Coalesced GMGN search-overlay pass and its one allowed late-DOM retry. */
  let gmgnOverlayPaintTimer = null;
  let gmgnOverlayRetryTimer = null;
  let lastOverlayFastStats = { painted: 0, queued: 0, seen: 0 };

  hydratePersistentCache();
  ensureGmgnQuotesCatalog();
  hydrateDisplayPrefs();
  installFeeTooltipGuards();
  hydrateBadgeTheme();
  hydrateBadgeSolidDark();
  hydrateBadgeOffsets();
  hydrateBadgeDragEdit();
  hydrateTaxRecvHidePrefs();
  watchDisplayPrefs();
  installTaxRecvHideBridge();
  installHostFeeBridge();
  startPipelineWatchdog();
  installHistoryHooks();
  // Main-world history notification fires only after the host commits push/replaceState.
  // This avoids GMGN's random 0-500ms route-poller delay without touching click events.
  // Also injects listen-only fetch/XHR hooks for tax-recv map (page-hook.js).
  installPageWorldSpaHook();
  startPageHookGuardian();
  // Route hooks + the 500ms poller observe navigation after the host commits it. Do not
  // run extension work in the capture phase of the site's token-link click handlers.
  installOverlayOpenArm();
  startRoutePoller();
  if (location.hostname.endsWith("gmgn.ai")) {
    startGmgnTokenGuardian();
  } else {
    startDebotTokenGuardian();
  }

  function createSiteStrategy() {
    if (location.hostname.endsWith("gmgn.ai")) return createGmgnStrategy();
    // debot.ai / gungnir.bot share the same Vite+MUI frontend (same asset hashes & APIs).
    if (location.hostname.endsWith("debot.ai") || location.hostname.endsWith("gungnir.bot")) {
      return createDebotStrategy();
    }
    return null;
  }

  function createGmgnStrategy() {
    return {
      name: "gmgn",
      getCandidateNodes: getGmgnCandidateNodes,
      findCard(node) {
        // Token detail header only when the candidate sits inside the metrics strip.
        // Side board / 新创建 list on the same URL must still climb (0.4.9).
        if (isGmgnTokenPage()) {
          const root = findGmgnTokenPageRoot();
          if (root && (node === root || root.contains(node))) {
            // 顶栏 ticker 误爬到 header 壳时仍禁（K 线真 header 由 tryPaint 单独管）
            if (isGmgnTopTickerOrChrome(node)) {
              return null;
            }
            return root;
          }
        }
        const card = climbGmgnListCard(node);
        // Resolve the visual card before applying the unified gate. Raw anchors
        // and short-address leaves are not card geometry and can match the
        // legacy side-rail fallback by themselves.
        if (card && isBadgeMountForbidden(card)) return null;
        return card;
      },
      extractToken(card) {
        if (card?.dataset?.flapOverlayCard === "1") {
          return (
            normalizeToken(card.getAttribute?.("href") || "") ||
            extractCardTokenFromAttrs(card)
          );
        }
        // URL CA only for the token-page header root — never paint list rows with page CA.
        if (isGmgnTokenPage() && isGmgnTokenHeaderCard(card)) {
          return extractTokenFromUrl() || extractCardTokenFromAttrs(card);
        }
        return extractCardTokenFromAttrs(card);
      },
      findIconTarget(card) {
        if (card?.dataset?.flapOverlayCard === "1") {
          return findGmgnOverlayLiquidityHeadMount(card);
        }
        if (isGmgnTokenPage() && isGmgnTokenHeaderCard(card)) {
          // 0.4.50: address ONLY — never 总税率 (user: 徽章必须在地址旁).
          return findGmgnHeaderAddressMount();
        }
        if (isInsideOverlayDialog(card)) {
          return findGmgnOverlayLiquidityHeadMount(card);
        }
        // K-line trench default placement is strict: only the card's real Tax chip.
        // Falling back to the short-CA row can escape into avatar/trade-control columns.
        const taxMount = findTaxTag(card);
        if (taxMount) {
          // Header and overlays returned above. Every remaining token-page card
          // must stay inside its own Tax row, including the first row whose top
          // can sit above the generic trench geometry threshold.
          if (
            isGmgnTokenPage() ||
            card.closest?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
          ) {
            taxMount.dataset.flapMount = "gmgn-trench-tax";
          }
          return taxMount;
        }
        // GMGN 用户关闭「税收」展示时无 Tax 芯片 → 挂代币名行（与 Tax 同高度带）
        const nameMount = findGmgnTrenchNameMount(card);
        if (nameMount) return nameMount;
        if (isGmgnTokenPage() && isGmgnTokenTrenchSidebarEl(card)) {
          const row = card.querySelector?.(".trenches-tax");
          if (row instanceof HTMLElement) {
            row.dataset.flapMount = "gmgn-trench-tax";
            return row;
          }
        }
        // 主战壕列：无 Tax/名行时不挂短地址行（会掉到头像/合约下方）。
        if (isGmgnFixedTrenchCard(card)) return null;
        // Token-page side cards must never fall back to the short-address row:
        // overflow wrappers can make that path climb into avatar/trade columns.
        if (isGmgnTokenPage()) return null;
        // Search/history rows may legitimately have no Tax chip.
        return findCompactRowMount(card);
      },
      placeIcon(target, icon) {
        if (target?.dataset?.flapMount === "gmgn-overlay-liquidity-head") {
          icon.dataset.feeOverlayPos = "liquidity-head";
          target.insertAdjacentElement("afterbegin", icon);
          return;
        }
        if (target?.dataset?.flapMount) {
          placeGmgnTokenIcon(target, icon);
          return;
        }
        // Put badge outside the narrow Tax chip / overflow:hidden wrappers.
        placeBesideTaxChip(target, icon);
      }
    };
  }

  /** GMGN list / dialog row card (scoped climb — not full-page walk). */
  function climbGmgnListCard(node) {
    // isOverlayFast / panel contains: history rows ~44–56px need short thresholds (0.4.38).
    const inDialog = isInsideOverlayDialog(node) || isOverlayFast();
    const minHeight = inDialog ? 36 : 58;
    const maxHeight = inDialog ? 140 : 280;
    const minWidth = inDialog ? 160 : 200;
    return (
      climbToCard(node, {
        maxDepth: 10,
        maxHeight,
        minWidth,
        minHeight,
        requireFeeTag: true
      }) ||
      climbToCard(node, {
        maxDepth: 10,
        maxHeight,
        minWidth,
        minHeight,
        requireFeeTag: false
      })
    );
  }

  function isGmgnTokenHeaderCard(card) {
    if (!(card instanceof HTMLElement) || !isGmgnTokenPage()) return false;
    if (card.dataset.flapOverlayCard === "1") return false;
    const root = findGmgnTokenPageRoot();
    return !!(root && card === root);
  }

  function isInsideOverlayDialog(node) {
    if (!(node instanceof HTMLElement)) return false;
    try {
      if (node.closest?.('[role="dialog"], [role="alertdialog"]')) return true;
      // Debot/Gungnir: MUI modal paper without role sometimes.
      if (node.closest?.(".MuiModal-root, .MuiDialog-root, [class*='Modal']")) return true;
      // GMGN panel climb is expensive — only when overlay window is active (0.4.42).
      if (isOverlayFast() || (overlayDetectCache.open && Date.now() - overlayDetectCache.at < 2000)) {
        const panel = findGmgnSearchPanelRoot();
        if (panel && panel.contains(node)) return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /** True while overlay-fast window active (dialog-only scan priority). */
  function isOverlayFast() {
    return overlayFastUntil > 0 && Date.now() < overlayFastUntil && quickHasOpenOverlay();
  }

  /**
   * GMGN search / 历史代币 panel root (no role=dialog on many builds).
   * Cached briefly — mutation thrash must not re-climb every node.
   */
  function findGmgnSearchPanelRoot() {
    if (!location.hostname.endsWith("gmgn.ai")) return null;
    const now = Date.now();
    const cached = gmgnSearchPanelCache.el;
    if (cached instanceof HTMLElement && cached.isConnected && now - gmgnSearchPanelCache.at < 2500) {
      return cached;
    }
    let best = null;
    try {
      const inputs = document.querySelectorAll(GMGN_OVERLAY_INPUT_SELECTOR);
      for (let i = 0; i < Math.min(inputs.length, 8); i += 1) {
        const inp = inputs[i];
        if (!(inp instanceof HTMLElement)) continue;
        const ir = inp.getBoundingClientRect();
        if (ir.width < 100 || ir.top < 20 || ir.bottom > window.innerHeight) continue;
        let p = inp.parentElement;
        for (let d = 0; p && d < 12; d += 1) {
          if (!(p instanceof HTMLElement)) break;
          const r = p.getBoundingClientRect();
          if (
            r.width >= 320 &&
            r.width <= window.innerWidth * 0.92 &&
            r.height >= 200 &&
            r.height <= window.innerHeight * 0.92 &&
            r.top > 20
          ) {
            best = p;
          }
          p = p.parentElement;
        }
        if (best) break;
      }
    } catch (_err) {
      best = null;
    }
    gmgnSearchPanelCache = { el: best, at: now };
    return best;
  }

  /**
   * Arm dense dialog-first paints when search/history opens.
   * Goal: cache-hit badges ≤1s; cold still mark+queue immediately.
   */
  function armOverlayFastScan(reason) {
    overlayFastUntil = Date.now() + OVERLAY_FAST_MS;
    scanRootsCache = { at: 0, roots: [] };
    gmgnSearchPanelCache = { el: null, at: 0 };
    // Do not wait SPA quiet for overlay UX.
    if (Date.now() < spaQuietUntil) spaQuietUntil = 0;
    const kick = (ms) => {
      window.setTimeout(() => {
        if (!isExtensionContextValid() || !isTabVisible()) return;
        if (!quickHasOpenOverlay()) {
          overlayFastUntil = 0;
          return;
        }
        overlayFastUntil = Date.now() + Math.max(0, OVERLAY_FAST_MS - ms);
        try {
          fastPaintOverlayFromCache();
        } catch (_err) {
          // ignore
        }
        // light + immediate: dialog roots preferred under overlay-fast.
        scheduleScan(0, {
          force: true,
          immediate: true,
          light: true,
          bypassForceGap: true
        });
      }, ms);
    };
    debugInfo("overlay:arm", { reason });
    kick(0);
    kick(100);
    kick(280);
    kick(650);
  }

  function cancelGmgnOverlayPaint() {
    if (gmgnOverlayPaintTimer) window.clearTimeout(gmgnOverlayPaintTimer);
    if (gmgnOverlayRetryTimer) window.clearTimeout(gmgnOverlayRetryTimer);
    gmgnOverlayPaintTimer = null;
    gmgnOverlayRetryTimer = null;
  }

  /** One cache-first GMGN overlay pass; retry once only when result rows mounted late. */
  function scheduleGmgnOverlayPaint(reason, delayMs = 150, allowLateDomRetry = true) {
    if (!isGmgnHost() && !isDebotHost()) return;
    if (gmgnOverlayPaintTimer) window.clearTimeout(gmgnOverlayPaintTimer);
    if (allowLateDomRetry && gmgnOverlayRetryTimer) {
      window.clearTimeout(gmgnOverlayRetryTimer);
      gmgnOverlayRetryTimer = null;
    }
    gmgnOverlayPaintTimer = window.setTimeout(() => {
      gmgnOverlayPaintTimer = null;
      if (!isExtensionContextValid() || !isTabVisible() || !quickHasOpenOverlay()) {
        cancelGmgnOverlayPaint();
        return;
      }
      if (isDebotHost()) {
        scanRootsCache = { at: 0, roots: [] };
        try {
          ensureDocumentObserver();
        } catch (_obs) {
          // ignore
        }
      }
      overlayFastUntil = Date.now() + OVERLAY_FAST_MS;
      try {
        fastPaintOverlayFromCache();
      } catch (_err) {
        return;
      }
      debugInfo("overlay:gmgn-pass", { reason, ...lastOverlayFastStats });
      if (allowLateDomRetry && lastOverlayFastStats.seen === 0) {
        gmgnOverlayRetryTimer = window.setTimeout(() => {
          gmgnOverlayRetryTimer = null;
          scheduleGmgnOverlayPaint(`${reason}-late-dom`, 0, false);
        }, 240);
      }
    }, Math.max(0, delayMs));
  }

  /**
   * Cache-first paint for open search/history rows (no full trench walk).
   * @returns {number} painted count
   */
  function fastPaintOverlayFromCache() {
    lastOverlayFastStats = { painted: 0, queued: 0, seen: 0 };
    if (!isExtensionContextValid() || !quickHasOpenOverlay()) return 0;
    const t0 = performance.now();
    const roots = [];
    collectOpenDialogRoots(roots);
    if (!roots.length) {
      const panel = findGmgnSearchPanelRoot();
      if (panel) roots.push(panel);
    }
    if (!roots.length) return 0;

    let painted = 0;
    let queued = 0;
    const seen = new Set();
    const maxPaint = OVERLAY_MAX_CARDS;

    for (let ri = 0; ri < roots.length; ri += 1) {
      const root = roots[ri];
      if (!root?.querySelectorAll) continue;
      const anchors = root.querySelectorAll(
        "[href*='8888'], [href*='7777'], [href*='ffff'], [href*='/token/'][href*='0x']"
      );
      const lim = Math.min(anchors.length, OVERLAY_MAX_CANDIDATES);
      for (let i = 0; i < lim; i += 1) {
        if (painted >= maxPaint) break;
        const a = anchors[i];
        if (!(a instanceof HTMLElement)) continue;
        const token = normalizeToken(a.getAttribute("href") || a.href || "");
        if (!token) continue;
        // GMGN search rows have a stable outer token link. Never fall through to
        // the generic page scanner here: on token pages that fallback also probes
        // the K-line header and forces layout while the search results are mounting.
        const card = isGmgnHost()
          ? findGmgnOverlayCard(a)
          : (siteStrategy.findCard && siteStrategy.findCard(a)) ||
            quickClimbCardFromTokenLink(a);
        // 0.4.51: dedupe by card only — same CA may appear on multiple overlay rows.
        if (!(card instanceof HTMLElement) || seen.has(card)) continue;
        // 搜索「钱包」区 / 追踪弹层：禁止挂徽章
        // Gate the resolved row only; applying card geometry to the raw anchor
        // can classify ordinary short-address leaves as side-rail chips.
        if (isBadgeMountForbidden(card)) {
          wipeForbiddenMountBadges(card, true);
          continue;
        }
        if (
          !isGmgnHost() &&
          !isInsideOverlayDialog(card) &&
          !roots.some((r) => r.contains(card))
        ) {
          // Prefer rows clearly in overlay; skip trench ghosts under the panel.
          const cr = card.getBoundingClientRect();
          if (cr.top < 40 || cr.height > 200) continue;
        }
        card.dataset.flapOverlayCard = "1";
        seen.add(card);
        const entry = getEntryForCard(card, token);
        if (!entry) {
          if (paintLoadingBadgeAndQueue(card, token)) painted += 1;
          queued += 1;
          continue;
        }
        if (paintListCardFromCacheFast(card, token, entry)) painted += 1;
      }
      // Short CA leaves without full href (some history rows).
      if (painted < maxPaint) {
        const leaves = root.querySelectorAll("a, span, div, p");
        const lmax = Math.min(leaves.length, 120);
        for (let i = 0; i < lmax; i += 1) {
          if (painted >= maxPaint) break;
          const el = leaves[i];
          if (!(el instanceof HTMLElement)) continue;
          const t = (el.textContent || "").trim();
          if (t.length > 22 || !TARGET_SHORT_TOKEN_RE.test(t)) continue;
          const card = isGmgnHost()
            ? findGmgnOverlayCard(el)
            : (siteStrategy.findCard && siteStrategy.findCard(el)) ||
              quickClimbCardFromTokenLink(el);
          if (!(card instanceof HTMLElement) || seen.has(card)) continue;
          seen.add(card);
          card.dataset.flapOverlayCard = "1";
          const token = isGmgnHost()
            ? normalizeToken(card.getAttribute("href") || "")
            : siteStrategy.extractToken(card);
          if (!token) continue;
          const entry = getEntryForCard(card, token);
          if (!entry) {
            if (paintLoadingBadgeAndQueue(card, token)) painted += 1;
            queued += 1;
            try {
              card.dataset[CARD_MARK] = token;
              card.setAttribute(CARD_DATA, token);
            } catch (_err) {
              // ignore
            }
            continue;
          }
          if (paintListCardFromCacheFast(card, token, entry)) painted += 1;
        }
      }
    }

    if (queued > 0) {
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
    }
    debugInfo("overlay:fast-paint", {
      painted,
      queued,
      ms: Math.round(performance.now() - t0)
    });
    lastOverlayFastStats = { painted, queued, seen: seen.size };
    try {
      scheduleSearchOverlayHideApply(60);
    } catch (_hide) {
      // ignore
    }
    return painted;
  }

  function isDebotTickerChip(el) {
    if (!(el instanceof HTMLElement)) return false;
    try {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.height <= 40 && r.top >= 0 && r.top < 96 && r.width > 0 && r.width < 280;
    } catch (_err) {
      return false;
    }
  }

  function isDebotTrenchRowCard(el) {
    if (!(el instanceof HTMLElement)) return false;
    const href = el.getAttribute("href") || "";
    if (!/\/token\//i.test(href)) return false;
    const tok = extractAnyToken(href);
    if (!TARGET_TOKEN_RE.test(tok || "")) return false;
    if (isDebotTickerChip(el)) return false;
    if (!isBscTokenRouteHref(href)) return false;
    try {
      const r = el.getBoundingClientRect();
      return (
        r.width >= DEBOT_TRENCH_ROW_MIN_W &&
        r.height >= DEBOT_TRENCH_ROW_MIN_H &&
        r.height <= DEBOT_TRENCH_ROW_MAX_H
      );
    } catch (_err) {
      return false;
    }
  }

  function climbDebotListCard(node) {
    if (!(node instanceof HTMLElement)) return null;
    const row = node.closest?.('a[href*="/token/"]');
    if (row instanceof HTMLElement && isDebotTrenchRowCard(row)) {
      if (isDebotSideRailCard(row) || isBadgeMountForbidden(row)) return null;
      return row;
    }
    const card = climbToCard(node, {
      maxDepth: 8,
      maxHeight: DEBOT_TRENCH_ROW_MAX_H,
      minWidth: DEBOT_TRENCH_ROW_MIN_W,
      minHeight: DEBOT_TRENCH_ROW_MIN_H,
      requireFeeTag: false
    });
    if (!card) return null;
    if (isDebotSideRailCard(card) || isBadgeMountForbidden(card)) return null;
    try {
      const r = card.getBoundingClientRect();
      if (r.height > DEBOT_TRENCH_ROW_MAX_H) return null;
    } catch (_err) {
      // ignore
    }
    return card;
  }

  function createDebotStrategy() {
    return {
      name: "debot",
      getCandidateNodes: getDebotCandidateNodes,
      findCard(node) {
        // Token detail header: map nodes in top header strip to a stable header card.
        if (isDebotTokenPage()) {
          const header = findDebotTokenHeaderCard();
          if (header && (node === header || header.contains(node))) {
            return header;
          }
        }
        const card = climbDebotListCard(node);
        if (isDebotTokenPage() && card && !isDebotTokenHeaderCard(card)) {
          return card;
        }
        return card;
      },
      extractToken(card) {
        if (isDebotTokenPage()) {
          return extractDebotTokenPageToken(card);
        }
        return extractCardHrefToken(card) || extractCardTokenFromAttrs(card);
      },
      findIconTarget(card) {
        return findDebotIconTarget(card);
      },
      placeIcon(target, icon) {
        placeDebotIcon(target, icon);
      }
    };
  }

  /** e.g. /bsc/token/0x… or /token/bsc/0x… */
  function isGmgnTokenPage() {
    return /\/token\//i.test(location.pathname || "") && location.hostname.endsWith("gmgn.ai");
  }

  /** Debot / Gungnir token detail only（双站同形: /token/bsc/0x…）. */
  function isDebotTokenPage() {
    if (!isDebotLikeHost()) return false;
    return /\/token\//i.test(location.pathname || "");
  }

  /**
   * Debot token page: never force URL CA onto every climbed card (SPA meme leftovers).
   * URL CA only for header card / when short CA matches URL.
   */
  function extractDebotTokenPageToken(card) {
    const urlTok = extractTokenFromUrl();
    const fromHref = extractCardHrefToken(card);
    const fromAttrs = extractCardTokenFromAttrs(card);
    const fromDom = fromHref || fromAttrs;
    if (fromDom) {
      if (!urlTok || fromDom === urlTok) return fromDom;
      if (!isDebotTokenHeaderCard(card)) return fromDom;
    }
    if (urlTok && isDebotTokenHeaderCard(card)) return urlTok;
    if (urlTok && cardStillMatchesToken(card, urlTok)) return urlTok;
    return fromDom || null;
  }

  /** Inject header mount as candidate after SPA (DOM late). */
  function getDebotCandidateNodes() {
    const light = pendingLightScan;
    const nodes = getCandidateNodes();
    if (!isDebotTokenPage() || light) return nodes;
    const header = findDebotTokenHeaderCard();
    if (header) {
      // Prefer a short-CA / title leaf inside header as candidate seed.
      const seed =
        findDebotShortAddressNode(header) ||
        header.querySelector?.("a[href*='0x'], h1, h2, h3, [class*='title']") ||
        header;
      if (seed instanceof HTMLElement && !nodes.includes(seed)) {
        nodes.unshift(seed);
      }
      if (!nodes.includes(header)) nodes.unshift(header);
    }
    return nodes.slice(0, MAX_CANDIDATES_PER_SCAN);
  }

  /**
   * Stable top header strip on Debot/Gungnir token page (name + short CA + badge row).
   * js-mcp 0.4.26: pure short CA is often a leaf DIV (not span/a), row height ~14–20px.
   * 0.4.29: short TTL cache — called from guardian/watch/mutation many times/sec.
   */
  function findDebotTokenHeaderCard() {
    const cacheKey = getRouteKey();
    const ttl =
      debotHeaderFindCache.el == null
        ? DEBOT_HEADER_FIND_NULL_CACHE_MS
        : DEBOT_HEADER_FIND_CACHE_MS;
    if (
      debotHeaderFindCache.key === cacheKey &&
      Date.now() - debotHeaderFindCache.at < ttl
    ) {
      if (
        debotHeaderFindCache.el &&
        document.contains(debotHeaderFindCache.el)
      ) {
        return debotHeaderFindCache.el;
      }
      if (debotHeaderFindCache.el == null) return null;
    }

    const found = findDebotTokenHeaderCardUncached();
    debotHeaderFindCache = { at: Date.now(), key: cacheKey, el: found };
    return found;
  }

  /**
   * Debot/Gungnir K-line header short-CA leaf (logged-in).
   * js-mcp 0.4.47: left sidebar + ticker make document-order first-220 miss the header CA
   * (`0xe2...7777` lives under title row; full CA is on [title="0x…"]). Prefer title/ca-text.
   */
  function isLargeTokenLinkCardNode(el) {
    if (!(el instanceof HTMLElement)) return false;
    try {
      const link = el.closest?.('a[href*="/token/"]');
      if (link instanceof HTMLElement) {
        const r = link.getBoundingClientRect();
        // Debot war-room rows are large token links (about 500x129 in the 3-col board).
        if (r.width >= 180 && r.height >= 64) return true;
      }
      const card = el.closest?.(
        ".MuiCard-root, .MuiPaper-root, [class*='Card'], article, li"
      );
      if (card instanceof HTMLElement && card.querySelector?.('a[href*="/token/"]')) {
        const r = card.getBoundingClientRect();
        if (r.width >= 180 && r.height >= 64) return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  function findDebotHeaderShortCaLeaf(urlTok) {
    const inTopBand = (el) => {
      try {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.height <= 48 &&
          r.bottom > 0 &&
          r.top < Math.min(window.innerHeight, 360) &&
          r.left >= 0 &&
          r.left < window.innerWidth
        );
      } catch (_err) {
        return false;
      }
    };

    // 1) Full CA on title attribute (Debot MuiTypography ca-text wrapper).
    try {
      const titled = document.querySelectorAll(
        '[title^="0x"], [title^="0X"], [title*="0x"], [title*="0X"]'
      );
      const maxT = Math.min(titled.length, 40);
      for (let i = 0; i < maxT; i += 1) {
        const el = titled[i];
        if (
          !(el instanceof HTMLElement) ||
          !inTopBand(el) ||
          isLargeTokenLinkCardNode(el)
        ) {
          continue;
        }
        const titleTok = normalizeToken(el.getAttribute("title") || "");
        if (urlTok && titleTok && titleTok !== urlTok) continue;
        if (urlTok && !titleTok) {
          // title may be truncated; fall through to text match
          const t = (el.textContent || "").trim();
          if (t && !tokenMatchesShort(urlTok, t.match(SHORT_TOKEN_RE)?.[0] || t)) continue;
        }
        if (!urlTok && !titleTok) {
          const t = (el.textContent || "").trim();
          if (!TARGET_SHORT_TOKEN_RE.test(t)) continue;
        }
        // Prefer innermost leaf under titled node.
        const leaf =
          Array.from(el.querySelectorAll("div, span")).find((n) => {
            const t = (n.textContent || "").trim();
            return (
              TARGET_SHORT_TOKEN_RE.test(t) &&
              t.length <= 22 &&
              (!n.children || n.children.length <= 1)
            );
          }) || el;
        return leaf instanceof HTMLElement ? leaf : el;
      }
    } catch (_err) {
      // ignore
    }

    // 2) Debot class hook: `.ca-text` / `[class*="ca-text"]` near top.
    try {
      const caNodes = document.querySelectorAll(
        ".ca-text, [class*='ca-text'], [class*='CaText']"
      );
      const maxC = Math.min(caNodes.length, 30);
      for (let i = 0; i < maxC; i += 1) {
        const el = caNodes[i];
        if (
          !(el instanceof HTMLElement) ||
          !inTopBand(el) ||
          isLargeTokenLinkCardNode(el)
        ) {
          continue;
        }
        const t = (el.textContent || "").trim();
        const titleTok = normalizeToken(el.getAttribute("title") || "");
        if (urlTok) {
          if (titleTok && titleTok !== urlTok) continue;
          if (!titleTok && t && !tokenMatchesShort(urlTok, t.match(SHORT_TOKEN_RE)?.[0] || t)) {
            continue;
          }
        } else if (!TARGET_SHORT_TOKEN_RE.test(t) && !titleTok) {
          continue;
        }
        const leaf =
          Array.from(el.querySelectorAll("div, span")).find((n) => {
            const tt = (n.textContent || "").trim();
            return TARGET_SHORT_TOKEN_RE.test(tt) && tt.length <= 22;
          }) || el;
        return leaf instanceof HTMLElement ? leaf : el;
      }
    } catch (_err) {
      // ignore
    }

    // 3) Fallback: scan leaves but do NOT use document-order cap only —
    //    skip nodes outside top band without counting toward budget.
    try {
      const shorts = document.body
        ? document.body.querySelectorAll("span, a, div, p, button")
        : [];
      const topShorts = [];
      const max = Math.min(shorts.length, 900);
      let checked = 0;
      for (let i = 0; i < max && checked < 80; i += 1) {
        const el = shorts[i];
        if (!(el instanceof HTMLElement)) continue;
        // Cheap reject before rect when possible.
        const t = (el.textContent || "").trim();
        if (t.length > 28 || t.length < 8) continue;
        if (!TARGET_SHORT_TOKEN_RE.test(t) && !SHORT_TOKEN_RE.test(t)) continue;
        if (el.children && el.children.length > 2) continue;
        if (!inTopBand(el) || isLargeTokenLinkCardNode(el)) continue;
        checked += 1;
        if (t.length > 22) continue;
        if (!TARGET_SHORT_TOKEN_RE.test(t)) continue;
        if (urlTok && !tokenMatchesShort(urlTok, t)) continue;
        topShorts.push(el);
      }
      if (topShorts.length) {
        topShorts.sort(
          (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
        );
        return topShorts[0];
      }
    } catch (_err) {
      // ignore
    }
    return null;
  }

  function climbDebotHeaderRowFromShort(short) {
    if (!(short instanceof HTMLElement)) return null;
    if (isLargeTokenLinkCardNode(short)) return null;
    let p = short;
    for (let d = 0; p && d < 10; d += 1) {
      if (!(p instanceof HTMLElement)) break;
      if (p === document.body || p === document.documentElement) break;
      const r = p.getBoundingClientRect();
      // Header bar / short-CA row: wide enough, not full viewport shell.
      if (
        r.width >= 200 &&
        r.width < window.innerWidth * 0.98 &&
        r.height >= 14 &&
        r.height <= 120 &&
        r.bottom > 0 &&
        r.top < Math.min(window.innerHeight, 360)
      ) {
        // Prefer flex row holding short CA (not full 1460px strip when too early).
        if (r.height <= 56 || d >= 2) return p;
      }
      p = p.parentElement;
    }
    return short.parentElement instanceof HTMLElement ? short.parentElement : short;
  }

  function findDebotTokenHeaderCardUncached() {
    const urlTok = extractTokenFromUrl();
    // 1) Short CA leaf near top (title / ca-text / top-band scan) — 0.4.47
    try {
      const short = findDebotHeaderShortCaLeaf(urlTok);
      if (short) {
        return climbDebotHeaderRowFromShort(short);
      }
    } catch (_err) {
      // fall through
    }
    // 2) Stats panel with 价格+流动性 (right of header strip)
    const stats = findDebotTokenPageMount(document);
    if (stats && !isLargeTokenLinkCardNode(stats)) {
      let p = stats;
      for (let d = 0; p && d < 6; d += 1) {
        if (!(p instanceof HTMLElement)) break;
        const r = p.getBoundingClientRect();
        if (
          r.width >= 200 &&
          r.height <= 200 &&
          r.bottom > 0 &&
          r.top < Math.min(window.innerHeight, 360)
        ) {
          return p;
        }
        p = p.parentElement;
      }
      return stats;
    }
    return null;
  }

  function isDebotTokenHeaderCard(card) {
    if (!(card instanceof HTMLElement) || !isDebotTokenPage()) return false;
    const header = findDebotTokenHeaderCard();
    if (header && (card === header || header.contains(card) || card.contains(header))) {
      return true;
    }
    // Large shell near top with URL short match
    try {
      const r = card.getBoundingClientRect();
      if (
        r.bottom > 0 &&
        r.top < Math.min(window.innerHeight, 360) &&
        r.width > 300 &&
        r.height < 140
      ) {
        const urlTok = extractTokenFromUrl();
        if (urlTok && cardStillMatchesToken(card, urlTok)) return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /** URL ?chain= (gmgn / debot.ai / gungnir.bot). Empty → treat as unknown. */
  function getUrlChain() {
    try {
      return String(new URL(location.href).searchParams.get("chain") || "").toLowerCase();
    } catch (_err) {
      return "";
    }
  }

  /**
   * Debot 双站：debot.ai 与 gungnir.bot 同前端（同 Vite/MUI/API），门控与策略共用.
   */
  function isDebotLikeHost() {
    const host = location.hostname || "";
    return host.endsWith("debot.ai") || host.endsWith("gungnir.bot");
  }

  /**
   * Resolve active chain from query + path (SPA 常把 chain 写在 path 或 query 里).
   * - GMGN 列表: ?chain=bsc | robinhood | sol …
   * - GMGN K线: /bsc/token/0x… （query 可无 chain）
   * - Debot/Gungnir 列表: /meme?chain=bsc （双站同形）
   * - Debot/Gungnir K线: /token/bsc/0x… 或 /token/bsc/123_0x…
   */
  function resolvePageChain() {
    // 1) query 优先：Debot 战壕 /meme?chain=bsc 与 GMGN 首页都靠它
    const q = getUrlChain();
    if (q) return q;
    try {
      const path = String(location.pathname || "");
      // GMGN: /bsc/token/0x…
      let m = path.match(/^\/([a-z0-9_-]+)\/token\//i);
      if (m) return m[1].toLowerCase();
      // Debot/Gungnir K线: /token/bsc/… （不是 /bsc/token）
      m = path.match(/\/token\/([a-z0-9_-]+)(?:\/|$)/i);
      if (m) return m[1].toLowerCase();
    } catch (_err) {
      // ignore
    }
    return "";
  }

  /** 非 BSC 链名（query/path/href 命中即拒绝） */
  const NON_BSC_CHAIN_RE =
    /(?:^|[/?&=_])(robinhood|rh|sol|eth|base|tron|monad|blast|op|arb|polygon|matic|avax|sui|ape)(?:$|[/?&=_])/i;

  function looksLikeNonBscHref(href) {
    const h = String(href || "").toLowerCase();
    if (!h) return false;
    if (h.includes("chain=bsc") || h.includes("/bsc/token/") || h.includes("/token/bsc/")) {
      return false;
    }
    if (NON_BSC_CHAIN_RE.test(h)) return true;
    if (/\/(?:sol|eth|base|tron|monad|blast|robinhood)\/token\//i.test(h)) return true;
    if (/\/token\/(?:sol|eth|base|tron|monad|blast|robinhood)(?:\/|$)/i.test(h)) return true;
    return false;
  }

  /** Debot 行 href 链：`/token/bsc/0x…`；GMGN：`/bsc/token/0x…`。融合战壕只认显式 BSC。 */
  function isBscTokenRouteHref(href) {
    const h = String(href || "").toLowerCase();
    if (!h || h.indexOf("/token/") === -1) return false;
    if (h.includes("/token/bsc/") || h.includes("/bsc/token/")) return true;
    if (/[?&]chain=bsc(?:&|$)/i.test(h)) return true;
    return false;
  }

  function readCardTokenHref(card) {
    if (!(card instanceof HTMLElement)) return "";
    const self = card.getAttribute?.("href") || "";
    if (self.indexOf("/token/") !== -1) return self;
    try {
      const nested = card.querySelector?.('[href*="/token/"]');
      return nested ? nested.getAttribute("href") || "" : "";
    } catch (_err) {
      return "";
    }
  }

  function cardHrefAllowedForScan(card) {
    const href = readCardTokenHref(card);
    if (!href) return isAllowedScanChain();
    if (String(href).toLowerCase().indexOf("/token/") === -1) return isAllowedScanChain();
    return isBscTokenRouteHref(href);
  }

  /**
   * 仅 BSC：战壕/弹层/K 线/内嵌战壕。
   * - 允许: ?chain=bsc | /bsc/token | /token/bsc | DOM 明确 BSC
   * - 拒绝: 任何显式他链（robinhood/sol/eth/…），无「默认放行他链」
   */
  function isAllowedScanChain() {
    const chain = resolvePageChain();
    if (chain === "bsc") return true;
    // 显式非 BSC 一律拒绝（不只 robinhood）；all/multi = Debot 融合战壕，改走卡级 /token/bsc
    if (chain && chain !== "all" && chain !== "multi") return false;

    // 无 query chain：K 线必须路径含 bsc
    if (isGmgnTokenPage()) {
      return /\/bsc\/token\//i.test(location.pathname || "");
    }
    if (isDebotTokenPage()) {
      return /\/token\/bsc(?:\/|$)/i.test(location.pathname || "");
    }
    // Debot 融合列表：页级可无 chain=bsc，只扫带 /token/bsc 的行
    if (isDebotLikeHost()) {
      const path = location.pathname || "/";
      if ((/\/meme/i.test(path) || path === "/" || path === "") && !/\/token\//i.test(path)) {
        return true;
      }
    }

    // 列表页无 ?chain=：有他链线索 → 关；有 BSC 线索 → 开；全无 → 关（避免 sol 默认误开）
    try {
      const hrefNodes = document.querySelectorAll(
        "a[href*='token'], a[href*='chain='], [href*='/token/'], [href*='chain=']"
      );
      let sawBsc = false;
      let sawForeign = false;
      const lim = Math.min(hrefNodes.length, 48);
      for (let i = 0; i < lim; i += 1) {
        const href = hrefNodes[i].getAttribute?.("href") || "";
        if (
          /\/bsc\/token\//i.test(href) ||
          /\/token\/bsc(?:\/|$|\?)/i.test(href) ||
          /[?&]chain=bsc(?:&|$)/i.test(href)
        ) {
          sawBsc = true;
        } else if (looksLikeNonBscHref(href)) {
          sawForeign = true;
        }
      }
      if (sawForeign && !sawBsc) return false;
      if (sawBsc) return true;
    } catch (_err) {
      // ignore
    }
    // 冷启动尚无 token 链接：不允许猜链（用户切到 bsc 后 URL 会带 chain=bsc）
    return false;
  }

  /** Leave non-BSC pages immediately clean (not every 20th scan). */
  function purgeMarksIfChainDisallowed() {
    if (isAllowedScanChain()) return false;
    try {
      resetOurDomMarks();
    } catch (_err) {
      // ignore
    }
    return true;
  }

  /**
   * Pure home / meme 战壕 page (no token K-line in path).
   * Debot 双站列表主入口: /meme?chain=bsc （debot.ai 与 gungnir.bot 相同）.
   */
  function isTrenchListPage() {
    if (isTokenDetailRoute()) return false;
    if (!isAllowedScanChain()) return false;
    const host = location.hostname || "";
    const path = location.pathname || "/";
    if (host.endsWith("gmgn.ai")) {
      // Home / tab boards: / or /trend etc without /token/
      return !/\/token\//i.test(path);
    }
    if (isDebotLikeHost()) {
      // 战壕: /meme；偶发 / 或空 path
      return /\/meme/i.test(path) || path === "/" || path === "";
    }
    return false;
  }

  /**
   * Whether this card may use trench absolute coords / drag.
   * - Home 战壕 list: yes
   * - K-line page side 新创建/战壕 rows: yes (same gmgn offset as home)
   * - K-line header 总税率 strip: NO (always default Tax mount)
   */
  function canUseTrenchAbsoluteCoords(card) {
    if (!isAllowedScanChain()) return false;
    // Search results always use their natural short-address row. Besides keeping
    // placement stable, this avoids probing the K-line header during overlay paint.
    if (card?.dataset?.flapOverlayCard === "1") return false;
    if (card && isGmgnTokenHeaderCard(card)) return false;
    // Debot/Gungnir K-line top strip: ALWAYS natural mount (popup: 不走坐标).
    // User may enable「使用卡片坐标」for 战壕 list only — if header zone uses absolute
    // (x=91,y=35 on a short row), badge is clipped / invisible until hard refresh.
    if (isDebotTokenPage()) {
      if (!card) return false;
      if (isDebotTokenHeaderZoneCard(card) || isDebotTokenHeaderLike(card)) return false;
      // Side boards / residual list rows on token page may still use absolute.
      return true;
    }
    if (isTrenchListPage()) return true;
    // GMGN token page: side boards only (header already excluded above for gmgn)
    if (isTokenDetailRoute() && card) return true;
    if (!card && (isTrenchListPage() || isTokenDetailRoute())) return true;
    return false;
  }

  /** Oversized "card" on Debot token page = page shell, not a meme list row. */
  function isDebotTokenHeaderLike(card) {
    if (!(card instanceof HTMLElement) || !isDebotTokenPage()) return false;
    if (isDebotTokenHeaderCard(card)) return true;
    try {
      const r = card.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.55 && r.height > window.innerHeight * 0.35) {
        return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /**
   * Debot/Gungnir token page top strip (name + short CA + action icons).
   * Any mount in this zone must NOT use absolute card coords — even if user
   * enabled「使用卡片坐标」for 战壕 lists (0.4.34).
   */
  function isDebotTokenHeaderZoneCard(card) {
    if (!(card instanceof HTMLElement) || !isDebotTokenPage()) return false;
    if (isDebotTokenHeaderCard(card)) return true;
    try {
      const r = card.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      // Tall Mui list cards are not header even if top is high.
      if (
        (card.classList?.contains("MuiCard-root") ||
          card.classList?.contains("MuiPaper-root")) &&
        r.height >= 160
      ) {
        return false;
      }
      // Top strip: short CA row / title / stats (~y < 240, short height).
      if (r.top >= -20 && r.top < 240 && r.height < 180) return true;
    } catch (_err) {
      return false;
    }
    return false;
  }

  /**
   * Hard gate: whether this page should run fee scans at all.
   * - chain=robinhood / sol / eth … → off
   * - only BSC list + BSC K-line (+ 弹层/内嵌战壕)
   * - GMGN: ?chain=bsc | /bsc/token/…
   * - Debot 双站 (debot.ai / gungnir.bot): /meme?chain=bsc | /token/bsc/…
   */
  function isScanPageAllowed() {
    if (!isAllowedScanChain()) return false;
    const host = location.hostname || "";
    const path = location.pathname || "/";
    if (host.endsWith("gmgn.ai")) return true;
    if (isDebotLikeHost()) {
      // 列表 /meme、K 线 /token/…、偶发首页 /
      if (/\/meme/i.test(path) || /\/token\//i.test(path) || path === "/" || path === "") {
        return true;
      }
      return false;
    }
    return false;
  }

  /** CA from URL path (GMGN/Debot token detail). Only 8888/7777/ffff tax tokens. */
  function extractTokenFromUrl() {
    const m = String(location.pathname || "").match(/0x[a-fA-F0-9]{40}/i);
    if (!m) return null;
    const token = m[0].toLowerCase();
    return TARGET_TOKEN_RE.test(token) ? token : null;
  }

  /**
   * GMGN token detail: ensure scan sees the page even without list Tax chips.
   * js-mcp: header has short CA + 总税率 metrics strip, no `Tax N%` chip.
   */
  function getGmgnCandidateNodes() {
    // List/home: root-scoped candidates only (no extra full-page walks).
    if (!isGmgnTokenPage()) return getCandidateNodes();

    // Light scan (dialog/side boards): do NOT inject K-line header walks.
    const light = pendingLightScan;
    // 0.5.2: ALWAYS scan side 战壕 columns on token multi-panel (like 0.4.24).
    // 0.4.37 header-only-until-settled caused deadlock: header paint miss → left column 0 badges forever.
    // Header seeds are unshifted for priority; column candidates still collected.
    const nodes = getCandidateNodes();
    if (light) return nodes.slice(0, LIGHT_MAX_CANDIDATES);

    const root = findGmgnTokenPageRoot();
    if (root && root !== document.body && !nodes.includes(root)) {
      nodes.unshift(root);
    }
    // Prefer address leaf as first seed (mount path).
    try {
      const addr = findGmgnHeaderAddressMount();
      if (addr instanceof HTMLElement && !nodes.includes(addr)) nodes.unshift(addr);
    } catch (_err) {
      // ignore
    }
    if (root && root !== document.body) {
      root.querySelectorAll("a, span").forEach((el) => {
        if (nodes.length >= MAX_CANDIDATES_PER_SCAN) return;
        const t = (el.textContent || "").trim();
        if (TARGET_SHORT_TOKEN_RE.test(t) && t.length < 22 && !nodes.includes(el)) {
          nodes.push(el);
        }
      });
    }
    return nodes.slice(0, MAX_CANDIDATES_PER_SCAN);
  }

  /** Header bar ~h-[70px] containing token metrics (价格/池子/总税率). Never body. */
  function findGmgnTokenPageRoot() {
    // Official K-line address mount (user-confirmed DOM). This avoids the legacy
    // document-wide span/a/div fallback on every header/card classification.
    const directAddress = document.querySelector("#token-base-address");
    if (directAddress instanceof HTMLElement && !isLargeTokenLinkCardNode(directAddress)) {
      const r = directAddress.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 240) {
        return directAddress.parentElement instanceof HTMLElement
          ? directAddress.parentElement
          : directAddress;
      }
    }
    const taxLab = findGmgnTaxRateLabel();
    if (taxLab) {
      let p = taxLab;
      for (let i = 0; i < 10 && p; i += 1) {
        if (!(p instanceof HTMLElement)) break;
        if (p === document.body || p === document.documentElement) break;
        const r = p.getBoundingClientRect();
        // Header strip (js-mcp: ~2240×70) — reject full-viewport shells (SPA leftover bug).
        if (
          r.width > 500 &&
          r.width < window.innerWidth * 0.98 &&
          r.height >= 48 &&
          r.height <= 120 &&
          r.top < 200
        ) {
          return p;
        }
        p = p.parentElement;
      }
    }
    const short = Array.from(document.querySelectorAll("span, a, div")).find((el) => {
      const t = (el.textContent || "").trim();
      return TARGET_SHORT_TOKEN_RE.test(t) && t.length < 22;
    });
    if (short) {
      let p = short;
      for (let i = 0; i < 10 && p; i += 1) {
        if (!(p instanceof HTMLElement)) break;
        if (p === document.body || p === document.documentElement) break;
        const r = p.getBoundingClientRect();
        if (
          r.width > 500 &&
          r.width < window.innerWidth * 0.98 &&
          r.height >= 48 &&
          r.height <= 140 &&
          r.top < 220
        ) {
          return p;
        }
        p = p.parentElement;
      }
    }
    // Prefer main content over body (marking body poisons SPA home scans).
    const main =
      document.querySelector("main") ||
      document.querySelector("#__next") ||
      document.querySelector("[class*='chakra'] > div");
    if (main instanceof HTMLElement && main !== document.body) {
      const r = main.getBoundingClientRect();
      if (r.height > 80 && r.height < window.innerHeight * 0.5) return main;
    }
    return null;
  }

  function findGmgnTaxRateLabel() {
    const now = Date.now();
    const cached = taxRateLabelCache.el;
    if (
      cached instanceof HTMLElement &&
      cached.isConnected &&
      now - taxRateLabelCache.at < TAX_LABEL_CACHE_MS
    ) {
      const ct = (cached.textContent || "").replace(/\s+/g, " ").trim();
      if (ct === "总税率" || (ct.startsWith("总税率") && ct.length <= 16)) {
        return cached;
      }
    }

    // Prefer near-top header band — chart body churns DOM; avoid whole-document when possible.
    let found = null;
    const roots = [];
    try {
      const main =
        document.querySelector("main") ||
        document.querySelector("#__next") ||
        document.querySelector("[class*='chakra']");
      if (main) roots.push(main);
    } catch (_err) {
      // ignore
    }
    if (!roots.length && document.body) roots.push(document.body);

    for (const root of roots) {
      if (!root?.querySelectorAll) continue;
      const nodes = root.querySelectorAll("span, div");
      const max = Math.min(nodes.length, 800);
      for (let i = 0; i < max; i += 1) {
        const el = nodes[i];
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t === "总税率") {
          found = el;
          break;
        }
      }
      if (found) break;
      for (let i = 0; i < max; i += 1) {
        const el = nodes[i];
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t.startsWith("总税率") && t.length <= 16) {
          found = el;
          break;
        }
      }
      if (found) break;
    }

    taxRateLabelCache = { el: found, at: now };
    return found;
  }

  /** Token detail URL with a CA that is NOT 8888/7777/ffff — no fee badge work needed. */
  function isNonTargetTokenPage() {
    if (!isTokenDetailRoute()) return false;
    const m = String(location.pathname || "").match(/0x[a-fA-F0-9]{40}/i);
    if (!m) return false;
    return !TARGET_TOKEN_RE.test(m[0].toLowerCase());
  }

  /**
   * Token/K-line header already has badge (chart can thrash freely).
   * Do NOT use "any badge on page" — side-board / ghost list badges must not silence header scans.
   */
  function isTokenPageSettledWithBadge() {
    if (!isTokenDetailRoute()) return false;
    try {
      if (isGmgnTokenPage()) return hasGmgnTokenHeaderBadge();
      if (isDebotTokenPage()) {
        // STRICT: only a badge inside the header strip counts as settled.
        // Ghost meme-list cards of the same CA must NOT cancel SPA progressive.
        return hasDebotTokenHeaderBadge();
      }
      return false;
    } catch (_err) {
      return false;
    }
  }

  /**
   * True if badge sits on GMGN token header beside short CA (not war-room, not 总税率).
   * 0.5.3: use findGmgnHeaderBadgeEl (stable).
   */
  function getCachedGmgnHeaderBadge(token) {
    const tok = String(token || "").toLowerCase();
    const cached = gmgnHeaderBadgeCache;
    if (
      !tok ||
      cached.token !== tok ||
      !(cached.el instanceof HTMLElement) ||
      !cached.el.isConnected ||
      cached.el.dataset.feeHeader !== "1" ||
      cached.el.dataset.feeToken !== tok
    ) {
      if (cached.token === tok || !tok) {
        gmgnHeaderBadgeCache = { token: "", el: null };
      }
      return null;
    }
    return cached.el;
  }

  function hasGmgnTokenHeaderBadge() {
    try {
      const token = extractTokenFromUrl();
      if (!token) return false;
      const cached = getCachedGmgnHeaderBadge(token);
      if (cached) {
        finishTokenEnterTransition();
        return true;
      }
      // A resize mutation arrives after layout invalidation. Never turn its observer
      // callback into a synchronous layout by probing the whole header here.
      if (isGmgnTrenchResizeCooling()) return false;
      const found = !!findGmgnHeaderBadgeEl(token);
      if (found) finishTokenEnterTransition();
      return found;
    } catch (_err) {
      return false;
    }
  }

  /**
   * GMGN K-line: pure short CA leaf matching URL (top-left header band).
   * js-mcp 0.4.50: `0xa4...7777` is often <span> inside flex copy row at ~left 120.
   * Must NOT rely on document-order caps that skip past the leaf.
   */
  /**
   * Optional x of 「总税率」label in header — used to keep address left of metrics.
   * Multi-panel layout: tax may be at x>1500; address at x~700 (still middle of viewport).
   */
  function findGmgnTaxLabelLeft() {
    try {
      const lab = findGmgnTaxRateLabel();
      if (lab instanceof HTMLElement && lab.isConnected) {
        const r = lab.getBoundingClientRect();
        if (r.width > 0 && r.top >= 0 && r.top < 220) return r.left;
      }
    } catch (_err) {
      // ignore
    }
    return 0;
  }

  /**
   * True if node is inside left/side 战壕 column (inline multi-panel), not K-line header.
   * User repro: with left trench open, leftmost short-CA match steals header paint.
   */
  function isInsideGmgnSideTrench(el) {
    if (!(el instanceof HTMLElement)) return false;
    try {
      const col = el.closest?.(
        "div.flex.flex-col.flex-1.overflow-hidden, div.flex.flex-col.flex-1.border-line-100"
      );
      if (!(col instanceof HTMLElement)) return false;
      const cr = col.getBoundingClientRect();
      // Tall narrow side boards only (left 战壕 / mid 钱包).
      if (cr.height < 280) return false;
      if (cr.width >= window.innerWidth * 0.55) return false;
      // Side panel starts near left edge; chart header starts mid-page when multi-panel open.
      if (cr.left < window.innerWidth * 0.42) return true;
    } catch (_err) {
      return false;
    }
    return false;
  }

  /** True when GMGN token page shows a tall left 战壕/side board (inline multi-panel). */
  function isGmgnInlineTrenchOpen() {
    try {
      const cols = document.querySelectorAll(
        "div.flex.flex-col.flex-1.overflow-hidden, div.flex.flex-col.flex-1.border-line-100"
      );
      for (let i = 0; i < cols.length; i += 1) {
        const el = cols[i];
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (
          r.height >= 280 &&
          r.width >= 180 &&
          r.width < window.innerWidth * 0.5 &&
          r.left < window.innerWidth * 0.42 &&
          r.top < window.innerHeight
        ) {
          return true;
        }
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /**
   * 0.5.9 js-mcp: GMGN exposes stable header short-CA node:
   *   <span id="token-base-address" data-addr="0x…">0x..7777</span>
   * Prefer this over scanning whole document (avoids left-trench false matches).
   */
  function findGmgnOfficialTokenBaseAddress(urlTok) {
    if (!urlTok) return null;
    try {
      const byId = document.getElementById("token-base-address");
      if (byId instanceof HTMLElement) {
        if (isLargeTokenLinkCardNode(byId)) return null;
        const addr = normalizeToken(byId.getAttribute("data-addr") || byId.getAttribute("title") || "");
        const text = (byId.textContent || "").trim();
        if ((!addr || addr === urlTok) && (!text || tokenMatchesShort(urlTok, text.match(SHORT_TOKEN_RE)?.[0] || text) || TARGET_SHORT_TOKEN_RE.test(text))) {
          if (!isInsideGmgnSideTrench(byId)) {
            const r = byId.getBoundingClientRect();
            if (
              r.width > 0 &&
              r.height > 0 &&
              r.height <= 48 &&
              r.bottom > 0 &&
              r.top < Math.min(window.innerHeight, 360)
            ) {
              return byId;
            }
          }
        }
      }
      // data-addr exact full CA (header only)
      const nodes = document.querySelectorAll(`[data-addr="${urlTok}"], [data-addr="${urlTok.toLowerCase()}"], [data-addr="${urlTok.toUpperCase()}"]`);
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (!(el instanceof HTMLElement)) continue;
        if (isLargeTokenLinkCardNode(el)) continue;
        if (isInsideGmgnSideTrench(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.height > 48) continue;
        if (r.bottom <= 0 || r.top >= Math.min(window.innerHeight, 360)) continue;
        return el;
      }
    } catch (_err) {
      // ignore
    }
    return null;
  }

  function findGmgnHeaderShortCaLeaf(urlTok) {
    if (!urlTok) return null;
    // 0.5.9: official GMGN node first (js-mcp ground truth on multi-panel + full-width).
    const official = findGmgnOfficialTokenBaseAddress(urlTok);
    if (official) return official;

    try {
      const hits = [];
      const taxLeft = findGmgnTaxLabelLeft();
      const multiPanel = isGmgnInlineTrenchOpen();
      // 0.5.7/0.5.9: multi-panel skip left trench; full-width keep header band leaves.
      const pushIfOk = (el) => {
        if (!(el instanceof HTMLElement) || hits.includes(el)) return;
        if (isLargeTokenLinkCardNode(el)) return;
        if (multiPanel && isInsideGmgnSideTrench(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.height > 36) return;
        if (r.top < 55 || r.top > 175) return;
        if (r.left < 0 || r.right > window.innerWidth + 20) return;
        if (taxLeft > 200 && r.left >= taxLeft - 8) return;
        if (r.left > window.innerWidth * 0.92) return;
        hits.push(el);
      };

      // 1) Exact title=full CA
      try {
        document.querySelectorAll("[title]").forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const titleTok = normalizeToken(el.getAttribute("title") || "");
          if (titleTok !== urlTok) return;
          if (multiPanel && isInsideGmgnSideTrench(el)) return;
          const leaf =
            Array.from(el.querySelectorAll("span, div, a")).find((n) => {
              const tt = (n.textContent || "").trim();
              return (
                TARGET_SHORT_TOKEN_RE.test(tt) &&
                tt.length <= 22 &&
                (!n.children || n.children.length === 0)
              );
            }) || el;
          pushIfOk(leaf);
        });
      } catch (_err) {
        // ignore
      }

      // 2) Visible short-CA text leaves in header band
      const nodes = document.querySelectorAll("span, a, div, p, button");
      const max = Math.min(nodes.length, 1600);
      for (let i = 0; i < max; i += 1) {
        const el = nodes[i];
        if (!(el instanceof HTMLElement)) continue;
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent || "").trim())
          .join("");
        const t = (
          own ||
          (el.children && el.children.length === 0 ? (el.textContent || "").trim() : "")
        ).trim();
        if (!t || t.length > 22 || t.length < 8) continue;
        if (!TARGET_SHORT_TOKEN_RE.test(t) && !SHORT_TOKEN_RE.test(t)) continue;
        if (!tokenMatchesShort(urlTok, t.match(SHORT_TOKEN_RE)?.[0] || t)) continue;
        if (el.children && el.children.length > 1) continue;
        pushIfOk(el);
      }

      if (!hits.length) return null;
      hits.sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        if (multiPanel) {
          if (Math.abs(ar.left - br.left) > 12) return br.left - ar.left;
        } else {
          if (Math.abs(ar.left - br.left) > 12) return ar.left - br.left;
        }
        if (Math.abs(ar.top - br.top) > 4) return ar.top - br.top;
        return ar.width * ar.height - br.width * br.height;
      });
      return hits[0];
    } catch (_err) {
      return null;
    }
  }

  /**
   * True if badge is already sitting next to the short CA (not 总税率 metrics).
   * 0.5.8: fee-header alone is NOT enough — must not be in left trench; prefer short CA neighbor.
   */
  function isGmgnBadgeBesideAddress(icon, urlTok) {
    if (!(icon instanceof HTMLElement)) return false;
    try {
      if (isLargeTokenLinkCardNode(icon)) return false;
      const r = icon.getBoundingClientRect();
      if (
        r.width < 2 ||
        r.height < 2 ||
        r.bottom <= 0 ||
        r.top >= Math.min(window.innerHeight, 360)
      ) {
        return false;
      }
      if (isInsideGmgnSideTrench(icon)) return false;
      // Header lock identifies intent, but the badge must still be beside the current address.
      // React can leave an old connected row while replacing #token-base-address.
      if (icon.dataset.feeHeader === "1") {
        if (urlTok && icon.dataset.feeToken && icon.dataset.feeToken !== urlTok) return false;
      }
      const mount = icon.closest?.("[data-flap-mount]");
      const mk = mount?.dataset?.flapMount || "";
      if (mk === "gmgn-header-metrics" || mk === "gmgn-tax-cell") return false;
      if (mk === "gmgn-header-address" || mk === "gmgn-header-address-leaf") return true;

      // prev sibling is short CA (strongest signal, no absolute-x gate).
      const prev = icon.previousElementSibling;
      if (prev) {
        const pt = (prev.textContent || "").trim();
        if (
          (TARGET_SHORT_TOKEN_RE.test(pt) || SHORT_TOKEN_RE.test(pt)) &&
          pt.length <= 22 &&
          (!urlTok || tokenMatchesShort(urlTok, pt.match(SHORT_TOKEN_RE)?.[0] || pt))
        ) {
          return true;
        }
      }

      // Near short CA leaf (geometry relative to leaf, works at any viewport x).
      const short = findGmgnHeaderShortCaLeaf(urlTok);
      if (short && short.isConnected) {
        const sr = short.getBoundingClientRect();
        if (
          Math.abs(r.top - sr.top) <= 32 &&
          r.left >= sr.left - 12 &&
          r.left <= sr.right + 280
        ) {
          return true;
        }
        if (
          icon.previousElementSibling === short ||
          short.nextElementSibling === icon ||
          (icon.parentElement && icon.parentElement === short.parentElement)
        ) {
          return true;
        }
      }

      // Explicit reject: next to 总税率 text.
      if (prev) {
        const pt = (prev.textContent || "").replace(/\s+/g, " ").trim();
        if (/总税率/.test(pt)) return false;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /** Mount host: always the short CA leaf (afterend). Never the metrics strip. */
  function findGmgnHeaderAddressMount() {
    const urlTok = extractTokenFromUrl();
    if (!urlTok) return null;
    const short = findGmgnHeaderShortCaLeaf(urlTok);
    if (!(short instanceof HTMLElement)) return null;
    short.dataset.flapMount = "gmgn-header-address-leaf";
    // Mark parent for CSS/debug only — placement still uses leaf afterend.
    if (short.parentElement instanceof HTMLElement) {
      short.parentElement.dataset.flapMount = "gmgn-header-address";
    }
    return short;
  }

  /**
   * Direct paint for GMGN K-line header.
   * 0.5.3: if already beside short CA, only refresh label — never wipe-and-repaint
   * (mutation/scan-pre thrash caused badge flash-then-gone).
   */
  function tryPaintGmgnTokenHeader(reason) {
    if (!isGmgnTokenPage() || !isExtensionContextValid()) return false;
    const urlTok = extractTokenFromUrl();
    if (!urlTok) return false;
    if (shouldDeferGmgnTrenchResizeWork()) {
      return !!getCachedGmgnHeaderBadge(urlTok);
    }

    queueToken(urlTok);

    const existingGood = findGmgnHeaderBadgeEl(urlTok);
    if (existingGood) {
      const headerCard =
        existingGood.closest(`[${CARD_DATA}]`) ||
        climbGmgnHeaderCardFromLeaf(existingGood) ||
        existingGood.parentElement;
      const entryHit = getEntryForCard(
        headerCard instanceof HTMLElement ? headerCard : existingGood,
        urlTok
      );
      if (entryHit) {
        try {
          const q =
            resolveQuoteSymbol(
              headerCard instanceof HTMLElement ? headerCard : existingGood,
              entryHit
            ) || "BNB";
          const presentation = computeBadgePresentation(entryHit, q, urlTok);
          if (presentation.label) {
            const textEl = existingGood.querySelector(".gmgn-fee-mode-icon__text");
            const shown = textEl ? textEl.textContent : existingGood.textContent;
            if (shown !== presentation.label || existingGood.className !== presentation.className) {
              applyBadgeUi(existingGood, presentation, urlTok);
            }
          }
        } catch (_err) {
          // ignore
        }
      }
      finishTokenEnterTransition();
      return true;
    }

    const addrLeaf = findGmgnHeaderAddressMount();
    // A committed token URL is not sufficient: wait for the official address row.
    // Falling back to the page root can mount into the outgoing trench subtree.
    if (!(addrLeaf instanceof HTMLElement) || isLargeTokenLinkCardNode(addrLeaf)) {
      recoverStuckBatch(false);
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
      return false;
    }
    removeStaleTokenHeaderBadges(urlTok);
    const host = climbGmgnHeaderCardFromLeaf(addrLeaf) || addrLeaf;
    const markHost = host instanceof HTMLElement ? host : addrLeaf;
    const entry = getEntryForCard(markHost, urlTok) || resolveEntry(urlTok);
    markHost.dataset[CARD_MARK] = urlTok;
    try {
      markHost.setAttribute(CARD_DATA, urlTok);
    } catch (_err) {
      // ignore
    }

    // 无缓存：顶栏也先 ⏳待加载，避免空白或乱闪
    if (!entry) {
      recoverStuckBatch(false);
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
      let okLoad = forceAppendGmgnHeaderBadge(
        markHost,
        urlTok,
        FEE_LOADING_ENTRY,
        addrLeaf
      );
      if (okLoad || findGmgnHeaderBadgeEl(urlTok)) {
        finishTokenEnterTransition();
        armGmgnHeaderDomWatch();
        return true;
      }
      armGmgnHeaderDomWatch();
      return false;
    }

    // Address-only paint (no renderMode → findIconTarget → 总税率 path).
    let ok = forceAppendGmgnHeaderBadge(markHost, urlTok, entry, addrLeaf);
    // Retry once after short delay if leaf was late (SPA multi-panel).
    if (!ok && !findGmgnHeaderBadgeEl(urlTok)) {
      window.setTimeout(() => {
        if (!isExtensionContextValid() || !isGmgnTokenPage()) return;
        if (hasGmgnTokenHeaderBadge()) return;
        try {
          forceAppendGmgnHeaderBadge(
            markHost && markHost.isConnected ? markHost : findGmgnTokenPageRoot(),
            urlTok,
            entry,
            findGmgnHeaderAddressMount()
          );
          armGmgnHeaderDomWatch();
        } catch (_err) {
          // ignore
        }
      }, 120);
    }
    if (ok || findGmgnHeaderBadgeEl(urlTok)) {
      finishTokenEnterTransition();
      armGmgnHeaderDomWatch();
      debugInfo("gmgn:header-paint", {
        reason,
        token: urlTok.slice(0, 12),
        mount: "address"
      });
      return true;
    }
    // Keep watching so React rewrite of token-base-address can re-trigger paint.
    armGmgnHeaderDomWatch();
    return false;
  }

  /**
   * Visible K-line HEADER badge for URL token only.
   * 0.5.8: NEVER treat left-trench same-CA list badge as header success
   * (that made tryPaint/guardian skip forever after first flash).
   */
  function findGmgnHeaderBadgeEl(urlTok) {
    if (!urlTok) return null;
    const cached = getCachedGmgnHeaderBadge(urlTok);
    if (cached) return cached;
    try {
      const nodes = document.querySelectorAll(
        `[${ICON_DATA}="1"][data-fee-token="${urlTok}"]`
      );
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (!(el instanceof HTMLElement) || !document.contains(el)) continue;
        // Must be explicit header lock and still belong to the current address row.
        if (el.dataset.feeHeader !== "1") continue;
        if (isInsideGmgnSideTrench(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.bottom <= 0 || r.top >= Math.min(window.innerHeight, 360)) continue;
        if (!isGmgnBadgeBesideAddress(el, urlTok)) continue;
        gmgnHeaderBadgeCache = { token: urlTok, el };
        return el;
      }
    } catch (_err) {
      // ignore
    }
    return null;
  }

  /** Never delete a locked K-line header badge (except explicit page leave). */
  function isGmgnLockedHeaderBadge(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.dataset.feeHeader !== "1") return false;
    if (!isGmgnTokenPage()) return false;
    if (isInsideGmgnSideTrench(el)) return false;
    const urlTok = extractTokenFromUrl();
    if (!urlTok) return false;
    if (el.dataset.feeToken && el.dataset.feeToken !== urlTok) return false;
    return isGmgnBadgeBesideAddress(el, urlTok);
  }

  /** Climb from short CA leaf to a reasonable header card host (for CARD_MARK only). */
  function climbGmgnHeaderCardFromLeaf(leaf) {
    if (!(leaf instanceof HTMLElement)) return null;
    let p = leaf;
    for (let d = 0; p && d < 10; d += 1) {
      if (!(p instanceof HTMLElement)) break;
      if (p === document.body || p === document.documentElement) break;
      const r = p.getBoundingClientRect();
      if (
        r.width >= 200 &&
        r.width < window.innerWidth * 0.98 &&
        r.height >= 36 &&
        r.height <= 160 &&
        r.top >= 0 &&
        r.top < 220
      ) {
        return p;
      }
      p = p.parentElement;
    }
    return leaf.parentElement instanceof HTMLElement ? leaf.parentElement : leaf;
  }

  /**
   * Insert badge immediately after GMGN header short CA leaf.
   * 0.4.50: never fall back to 总税率 mount.
   */
  function forceAppendGmgnHeaderBadge(host, token, entry, shortHint) {
    if (!entry || !token) return false;
    try {
      let q = "";
      if (!isFeeLoadingEntry(entry)) {
        q =
          (host instanceof HTMLElement ? resolveQuoteSymbol(host, entry) : "") ||
          "BNB";
      }
      const presentation = computeBadgePresentation(entry, q, token);
      const { label } = presentation;
      if (!label) return false;

      // Already correct → in-place update only (0.5.3/0.5.4 flash fix).
      const already = findGmgnHeaderBadgeEl(token);
      if (already) {
        applyBadgeUi(already, presentation, token);
        already.dataset.feeHeader = "1";
        already.dataset.feePosMode = "default";
        if (gmgnEmbeddedDirtyCards.size > 0) scheduleGmgnEmbeddedDirtyPass();
        return true;
      }

      // Resolve pure text leaf (SPAN) — not the flex wrapper.
      let leaf =
        shortHint instanceof HTMLElement && shortHint.isConnected ? shortHint : null;
      if (!leaf) leaf = findGmgnHeaderShortCaLeaf(token);
      if (leaf && leaf.children && leaf.children.length > 0) {
        const inner = Array.from(leaf.querySelectorAll("span, div")).find((n) => {
          const t = (n.textContent || "").trim();
          return (
            TARGET_SHORT_TOKEN_RE.test(t) &&
            t.length <= 22 &&
            (!n.children || n.children.length === 0)
          );
        });
        if (inner instanceof HTMLElement) leaf = inner;
      }
      if (!(leaf instanceof HTMLElement) || !leaf.isConnected) return false;
      // Never mount on left 战壕 leaf when multi-panel open — K-line address only.
      if (isGmgnInlineTrenchOpen() && isInsideGmgnSideTrench(leaf)) return false;

      // Only remove WRONG top-strip mounts for this token (总税率 / orphan).
      // Do NOT wipe locked/good address badges.
      try {
        document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.dataset.feeToken && n.dataset.feeToken !== token) return;
          if (isGmgnLockedHeaderBadge(n)) return;
          if (isGmgnBadgeBesideAddress(n, token)) return;
          const r = n.getBoundingClientRect();
          if (r.top < 0 || r.top >= 220) return;
          try {
            n.remove();
          } catch (_err) {
            // ignore
          }
        });
      } catch (_err) {
        // ignore
      }

      const icon = document.createElement("span");
      icon.dataset[ICON_MARK] = "1";
      icon.dataset.feePosMode = "default";
      // 0.5.4: lock header badge so list remount / isStable thrash cannot delete it.
      icon.dataset.feeHeader = "1";
      applyBadgeUi(icon, presentation, token);

      leaf.dataset.flapMount = "gmgn-header-address-leaf";
      leaf.insertAdjacentElement("afterend", icon);

      const markHost =
        host instanceof HTMLElement
          ? host
          : climbGmgnHeaderCardFromLeaf(leaf) || leaf.parentElement || leaf;
      if (markHost instanceof HTMLElement) {
        markHost.dataset[CARD_MARK] = token;
        try {
          markHost.setAttribute(CARD_DATA, token);
        } catch (_err) {
          // ignore
        }
      }
      if (leaf.parentElement instanceof HTMLElement) {
        leaf.parentElement.dataset.flapMount = "gmgn-header-address";
      }

      // 0.5.5/0.5.7: insert success + visible; reject if multi-panel and landed in left trench.
      if (!icon.isConnected) return false;
      if (
        isGmgnInlineTrenchOpen() &&
        (isInsideGmgnSideTrench(icon) || isInsideGmgnSideTrench(leaf))
      ) {
        try {
          icon.remove();
        } catch (_errRm) {
          // ignore
        }
        return false;
      }
      const r = icon.getBoundingClientRect();
      const visible = r.width >= 2 && r.height >= 2;
      if (visible) gmgnHeaderBadgeCache = { token, el: icon };
      if (visible && gmgnEmbeddedDirtyCards.size > 0) scheduleGmgnEmbeddedDirtyPass();
      return visible;
    } catch (_err) {
      return false;
    }
  }

  /** True if this card is the GMGN K-line header host (must not be wiped by list extract miss). */
  function isGmgnHeaderMarkedCard(card) {
    if (!(card instanceof HTMLElement) || !isGmgnTokenPage()) return false;
    try {
      if (isGmgnTokenHeaderCard(card)) return true;
      const urlTok = extractTokenFromUrl();
      if (!urlTok) return false;
      const marked = card.dataset[CARD_MARK] || card.getAttribute(CARD_DATA) || "";
      if (marked && marked === urlTok) {
        const r = card.getBoundingClientRect();
        if (r.top >= 0 && r.top < 240 && r.height <= 200) return true;
      }
      // Badge already beside address lives under/near this card.
      const icon = card.querySelector?.(`[${ICON_DATA}="1"]`);
      if (icon && isGmgnBadgeBesideAddress(icon, urlTok)) return true;
    } catch (_err) {
      return false;
    }
    return false;
  }

  /** Cheap: open modal / search history panel needs light scan. Cached 250ms (mutation thrash). */
  function quickHasOpenOverlay() {
    const now = Date.now();
    if (now - overlayDetectCache.at < 250) return overlayDetectCache.open;
    let open = false;
    try {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      for (let i = 0; i < dialogs.length; i += 1) {
        const el = dialogs[i];
        if (!(el instanceof HTMLElement)) continue;
        if (isExplicitlyHiddenOverlay(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 280 && r.height >= 120 && r.top < window.innerHeight && r.bottom > 0) {
          open = true;
          break;
        }
      }
      if (!open && isGmgnHost()) {
        const exact = document.querySelector(GMGN_FIXED_SEARCH_ROOT_SELECTOR);
        if (exact instanceof HTMLElement && !isExplicitlyHiddenOverlay(exact)) {
          const r = exact.getBoundingClientRect();
          open = r.width >= 260 && r.height >= 100 && r.top < window.innerHeight && r.bottom > 0;
        }
      }
      if (!open && isGmgnHost()) {
        // The permanent header input also contains 搜索/合约. Only the modal's
        // richer placeholder is authoritative, otherwise the trench queue pauses forever.
        const inputs = document.querySelectorAll(GMGN_OVERLAY_INPUT_SELECTOR);
        for (let i = 0; i < Math.min(inputs.length, 6); i += 1) {
          const inp = inputs[i];
          if (!(inp instanceof HTMLElement)) continue;
          const r = inp.getBoundingClientRect();
          if (r.width >= 120 && r.height >= 20 && r.top > 30 && r.bottom < window.innerHeight - 10) {
            open = true;
            break;
          }
        }
      }
    } catch (_err) {
      open = false;
    }
    overlayDetectCache = { at: now, open };
    return open;
  }

  /**
   * Mount next to 总税率 metric (user arrow on header right).
   * js-mcp: parent strip `flex items-center gap-[16px]` with 8 metric cells.
   */
  function findGmgnTokenPageMount() {
    const taxLab = findGmgnTaxRateLabel();
    if (!taxLab) return null;

    // Climb to the metric column cell (text-left 52×37) then to the gap-[16px] row.
    let cell = taxLab;
    for (let i = 0; i < 5 && cell; i += 1) {
      const r = cell.getBoundingClientRect();
      if (r.width >= 40 && r.width <= 120 && r.height >= 28 && r.height <= 48) {
        // column cell
        break;
      }
      cell = cell.parentElement;
    }
    if (!(cell instanceof HTMLElement)) cell = taxLab.parentElement;

    let strip = cell;
    for (let i = 0; i < 5 && strip; i += 1) {
      const st = window.getComputedStyle(strip);
      const r = strip.getBoundingClientRect();
      const cls = (strip.className || "").toString();
      if (
        st.display === "flex" &&
        (st.flexDirection === "row" || cls.includes("gap-[16px]")) &&
        r.width > 280 &&
        r.height >= 24 &&
        r.height <= 56 &&
        strip.children.length >= 3
      ) {
        strip.dataset.flapMount = "gmgn-header-metrics";
        if (cell instanceof HTMLElement) cell.dataset.flapTaxCell = "1";
        return strip;
      }
      strip = strip.parentElement;
    }

    if (cell instanceof HTMLElement) {
      cell.dataset.flapMount = "gmgn-tax-cell";
      return cell;
    }
    return null;
  }

  function placeGmgnTokenIcon(target, icon) {
    const kind = target?.dataset?.flapMount || "";
    if (kind === "gmgn-trench-tax") {
      placeGmgnListTaxBadge(target, icon);
      return;
    }
    if (kind === "gmgn-trench-name") {
      placeGmgnListNameBadge(target, icon);
      return;
    }
    // 0.4.50: address leaf/row only. Metrics/tax mounts should not be used for header.
    if (kind === "gmgn-header-address-leaf") {
      target.insertAdjacentElement("afterend", icon);
      return;
    }
    if (kind === "gmgn-header-address") {
      const leaf =
        Array.from(target.querySelectorAll("span, div")).find((n) => {
          const t = (n.textContent || "").trim();
          return (
            TARGET_SHORT_TOKEN_RE.test(t) &&
            t.length <= 22 &&
            (!n.children || n.children.length === 0)
          );
        }) || target;
      if (leaf instanceof HTMLElement) {
        leaf.insertAdjacentElement("afterend", icon);
        return;
      }
      target.append(icon);
      return;
    }
    // Legacy metrics kinds: if somehow called, still try address first.
    if (kind === "gmgn-header-metrics" || kind === "gmgn-tax-cell") {
      const addr = findGmgnHeaderAddressMount();
      if (addr) {
        addr.insertAdjacentElement("afterend", icon);
        return;
      }
    }
    // List Tax chips still use beside-tax.
    placeBesideTaxChip(target, icon);
  }

  /**
   * Narrow side panels (钱包追踪 / 持仓) — not meme board cards.
   * js-mcp 0.5.29: left 钱包追踪 column ~287–291px; row cards ~192px @ left≈0.
   * 0.7.3: 放宽宽度到 ~520（弹层/宽栏「钱包 1 追踪…」）并认「追踪/喊单/监控」。
   */
  function isDebotSideRailCard(card) {
    if (!(card instanceof HTMLElement)) return false;
    try {
      // Column root that hosts 钱包追踪 / 自选 / 持仓 headers
      let p = card;
      for (let i = 0; i < 12 && p && p !== document.body; i++) {
        const pr = p.getBoundingClientRect();
        if (
          pr.left < 80 &&
          pr.width >= 160 &&
          pr.width <= 560 &&
          pr.height >= 160
        ) {
          const head = (p.textContent || "").slice(0, 64).replace(/\s+/g, "");
          if (
            /钱包追踪|自选热门|持仓|追踪数|实时通知|喊单|监控|备注/.test(head) &&
            !/新创建|即将打满|已开盘|已迁移/.test(head.slice(0, 24))
          ) {
            // 侧栏/追踪面板：有追踪语义且非主战壕三列头
            if (/钱包|追踪|持仓|喊单|监控/.test(head)) return true;
          }
          if (/钱包追踪|自选热门|持仓/.test(head)) return true;
        }
        p = p.parentElement;
      }
    } catch (_errCol) {
      // ignore
    }
    const r = card.getBoundingClientRect();
    // Left wallet-track column / short rows
    if (r.left < 40 && r.width > 0 && r.width <= 300) return true;
    // Far-right 持仓 strip only when narrow.
    if (r.right > window.innerWidth - 40 && r.width > 0 && r.width < 280) return true;
    // Very short rail chips
    if (r.width > 0 && r.width <= 200 && r.height > 0 && r.height < 56) return true;
    const t = (card.textContent || "").replace(/\s+/g, " ");
    if (/AI报告/.test(t) && !/MC|市值|Tax\s*\d/i.test(t)) return true;
    return false;
  }

  /**
   * GMGN 左侧「钱包 / 追踪 / 喊单 / 监控」面板（含弹层宽栏）。
   * 主战壕列在 mid 区；此栏 left≈0 且含追踪语义。
   */
  function isGmgnWalletTrackPanelUncached(node) {
    if (!(node instanceof HTMLElement) || !isGmgnHost()) return false;
    try {
      let p = node;
      for (let i = 0; i < 18 && p && p !== document.body; i++) {
        if (
          p.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR) ||
          p.matches?.(GMGN_FIXED_SEARCH_ROOT_SELECTOR)
        ) {
          return false;
        }
        const rawText = p.textContent || "";
        // Stop before the full-page shell. It contains footer labels such as
        // 钱包追踪/监控/喊单 and used to force a synchronous full-page layout.
        if (rawText.length > 5000) break;
        const compact = rawText.slice(0, 900).replace(/\s+/g, "");
        const walletAt = compact.indexOf("钱包");
        const trackAt = compact.indexOf("追踪", Math.max(0, walletAt + 2));
        const callAt = compact.indexOf("喊单", Math.max(0, trackAt + 2));
        const monitorAt = compact.indexOf("监控", Math.max(0, callAt + 2));
        const noteAt = compact.indexOf("备注", Math.max(0, monitorAt + 2));
        const trenchTitle = /新创建|即将打满|已开盘|已迁移/.test(compact.slice(0, 260));
        if (trenchTitle) return false;
        const semanticHits = [walletAt, trackAt, callAt, monitorAt, noteAt].filter(
          (at) => at >= 0
        ).length;
        const dollars = (compact.match(/\$\s*\d/g) || []).length;
        const percents = (compact.match(/[+-]?\d+(?:\.\d+)?%/g) || []).length;
        const hasNarrowWalletSignal =
          !trenchTitle &&
          !/(?:Tax|MC|总税率)/i.test(compact) &&
          dollars >= 2 &&
          percents >= 2;
        const structuralHint = /wallet|track|follow|monitor|watch/i.test(
          `${p.getAttribute("data-sentry-source-file") || ""} ${String(p.className || "")}`
        );
        // A real wallet panel exposes several stable tab semantics. Main trench
        // roots are rejected first, while narrow feeds can also use their source
        // metadata or repeated wallet-value shape. No layout read is needed.
        if (!trenchTitle && semanticHits >= 3) return true;
        if (
          !trenchTitle &&
          walletAt >= 0 &&
          (semanticHits >= 2 || structuralHint || hasNarrowWalletSignal)
        ) {
          return true;
        }
        p = p.parentElement;
      }
    } catch (_e) {
      // ignore
    }
    return false;
  }

  function isGmgnWalletTrackPanel(node) {
    if (!(node instanceof HTMLElement) || !isGmgnHost()) return false;
    const now = performance.now();
    const cached = gmgnPanelProbeCache.get(node);
    if (cached && cached.width === window.innerWidth) {
      const ttl = cached.value
        ? GMGN_PANEL_PROBE_TRUE_CACHE_MS
        : GMGN_PANEL_PROBE_FALSE_CACHE_MS;
      if (now - cached.at < ttl) return cached.value;
    }
    const value = isGmgnWalletTrackPanelUncached(node);
    gmgnPanelProbeCache.set(node, { at: now, width: window.innerWidth, value });
    return value;
  }

  /**
   * GMGN favorites drawer/table. Require both the panel title and its table
   * columns so a generic star button or the bottom navigation cannot match.
   */
  function isGmgnFavoritesPanel(node) {
    if (!(node instanceof HTMLElement) || !isGmgnHost()) return false;
    try {
      let p = node;
      for (let i = 0; i < 18 && p && p !== document.body; i++) {
        if (
          p.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR) ||
          p.matches?.(GMGN_FIXED_SEARCH_ROOT_SELECTOR)
        ) {
          return false;
        }
        const rawText = p.textContent || "";
        if (rawText.length > 5000) break;
        const compact = rawText.slice(0, 260).replace(/\s+/g, "");
        if (
          compact.slice(0, 80).includes("收藏") &&
          /币种.*交易数.*价格.*24h%/i.test(compact)
        ) {
          return true;
        }
        p = p.parentElement;
      }
    } catch (_e) {
      // ignore
    }
    return false;
  }

  /**
   * GMGN 顶栏 ticker / 快捷买入条：top 很小的 chip，非三列战壕卡。
   * 用户反馈：AI Facto 旁错误挂徽章 → 直接禁止（不挪位）。
   */
  function isGmgnTopTickerOrChrome(node) {
    if (!(node instanceof HTMLElement) || !isGmgnHost()) return false;
    try {
      const r = node.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) return false;
      // 顶栏横向 ticker / 快捷 token
      if (r.top >= 0 && r.top < 96 && r.height > 0 && r.height <= 56) {
        // 主列表卡高度通常 >70；顶栏 chip 偏矮
        if (r.width < 520) return true;
      }
      // 祖先是横向滚动顶条
      let p = node;
      for (let i = 0; i < 8 && p && p !== document.body; i++) {
        const pr = p.getBoundingClientRect();
        const st = window.getComputedStyle(p);
        if (
          pr.top >= 0 &&
          pr.top < 100 &&
          pr.height > 0 &&
          pr.height <= 72 &&
          pr.width > window.innerWidth * 0.35 &&
          (st.overflowX === "auto" ||
            st.overflowX === "scroll" ||
            /overflow-x|scroll-x|ticker|marquee/i.test(String(p.className || "")))
        ) {
          return true;
        }
        p = p.parentElement;
      }
    } catch (_e) {
      // ignore
    }
    return false;
  }

  /**
   * 统一门禁：禁止挂徽章的场景（钱包追踪 / 收藏 / 顶 ticker）。
   * 所有 render/paint/overlay/viewport-quick 入口必须调用。
   */
  function computeBadgeMountForbidden(node) {
    if (!(node instanceof HTMLElement)) return false;
    try {
      // The Debot detector contains legacy card-size fallbacks and must never
      // classify GMGN anchors, Tax chips, or badge elements.
      if (isDebotHost() && isDebotSideRailCard(node)) return true;
      if (isGmgnWalletTrackPanel(node)) return true;
      if (isGmgnFavoritesPanel(node)) return true;
      if (isGmgnTopTickerOrChrome(node)) return true;
      // 顶栏全局：极矮且靠顶的 chip（双保险）
      const r = node.getBoundingClientRect();
      if (
        isGmgnHost() &&
        r.top >= 0 &&
        r.top < 88 &&
        r.height > 0 &&
        r.height < 44 &&
        r.width > 0 &&
        r.width < 280
      ) {
        return true;
      }
    } catch (_e) {
      // ignore
    }
    return false;
  }

  /** 禁区宿主上的徽章一律拆掉 */
  function isBadgeMountForbidden(node) {
    if (!(node instanceof HTMLElement)) return false;
    const now = performance.now();
    const href = node.getAttribute?.("href") || "";
    const parent = node.parentElement;
    const cached = badgeForbiddenCache.get(node);
    const cacheTtl = cached?.forbidden === true ? BADGE_FORBIDDEN_CACHE_MS : 180;
    if (
      cached &&
      now - cached.at < cacheTtl &&
      cached.href === href &&
      cached.parent === parent
    ) {
      return cached.forbidden;
    }
    const forbidden = computeBadgeMountForbidden(node);
    badgeForbiddenCache.set(node, { at: now, href, parent, forbidden });
    return forbidden;
  }

  function wipeForbiddenMountBadges(card, knownForbidden = false) {
    if (!(card instanceof HTMLElement)) return;
    if (!knownForbidden && !isBadgeMountForbidden(card)) return;
    try {
      removeAllBadgesForCard(card, card.dataset[CARD_MARK] || "");
      delete card.dataset[CARD_MARK];
      card.removeAttribute(CARD_DATA);
      cardTokenCache.delete(card);
      hrefTokenCache.delete(card);
    } catch (_e) {
      // ignore
    }
  }

  function isTabVisible() {
    return document.visibilityState === "visible";
  }

  function isTokenEnterTransitionActive() {
    if (!tokenEnterTransitionUntil) return false;
    if (Date.now() < tokenEnterTransitionUntil) return true;
    tokenEnterTransitionUntil = 0;
    return false;
  }

  function isTokenEnterPaintGraceActive() {
    return tokenEnterPaintAfter > 0 && Date.now() < tokenEnterPaintAfter;
  }

  function armTokenEnterTransition() {
    listReturnTransitionUntil = 0;
    gmgnOutgoingTrenchRoots = new WeakSet();
    if (listReturnTransitionTimer) {
      window.clearTimeout(listReturnTransitionTimer);
      listReturnTransitionTimer = null;
    }
    tokenEnterTransitionUntil = Date.now() + TOKEN_ENTER_TRANSITION_MS;
    tokenEnterPaintAfter = Date.now() + TOKEN_ENTER_PAINT_GRACE_MS;
    // Cancel work already queued for the outgoing trench. Direct header painters do not
    // use scheduleScan, so they can still mount once the real token header exists.
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    pendingLightScan = false;
    if (forceFullScanCoalesceTimer) {
      window.clearTimeout(forceFullScanCoalesceTimer);
      forceFullScanCoalesceTimer = null;
    }
    if (mutationDebounceTimer) {
      window.clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = null;
    }
  }

  function finishTokenEnterTransition() {
    tokenEnterTransitionUntil = 0;
    tokenEnterPaintAfter = 0;
  }

  function isListReturnTransitionActive() {
    if (!listReturnTransitionUntil) return false;
    if (Date.now() < listReturnTransitionUntil) return true;
    listReturnTransitionUntil = 0;
    return false;
  }

  /**
   * A token URL can disappear while its K-line and embedded sidebar are still mounted.
   * A desktop trench is considered ready only when card-sized token rows span at least
   * two viewport columns. This rejects the single left sidebar shown on GMGN K-line.
   */
  function hasMountedTrenchSurface() {
    if (isTokenDetailRoute() || !document.body) return false;
    if (isGmgnHost()) {
      const now = Date.now();
      if (
        now - gmgnTrenchProbeCache.at < 48 &&
        gmgnTrenchProbeCache.roots.every((root) => root?.isConnected)
      ) {
        return gmgnTrenchProbeCache.ready;
      }
      const roots = getMountedGmgnTrenchRoots();
      const columns = new Set(roots.map((root) => listColumnBucket(root)));
      const freshFixedRootReady = roots.some(
        (root) =>
          root.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR) &&
          !gmgnOutgoingTrenchRoots.has(root)
      );
      // GMGN's current desktop layout nests both trench columns in one PumpSub
      // root. Treat two real scroll panes inside that root as mounted; requiring
      // two outer roots makes cache-first return wait for LIST_RETURN_TRANSITION_MS.
      let nestedColumns = 0;
      if (roots.length === 1) {
        try {
          nestedColumns = [...roots[0].querySelectorAll(".gmgn-scrollbar")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width >= 240 && r.height >= 200 && r.bottom > 0 && r.top < window.innerHeight;
          }).length;
        } catch (_err) {
          nestedColumns = 0;
        }
      }
      const embeddedHomeReady = roots.length === 1 && nestedColumns >= 2;
      const ready =
        freshFixedRootReady ||
        (roots.length >= 2 && columns.size >= 2) ||
        embeddedHomeReady;
      gmgnTrenchProbeCache = { at: now, roots, ready };
      return ready;
    }
    // Debot: 文档序前 80 条全是顶栏 ticker/小图标（js-mcp: first80.row=0），
    // 必须在三列 MuiPaper 里数行卡，否则 cache-first 被 LIST_RETURN_TRANSITION 挡 2.5s。
    const columns = new Set();
    const cards = new Set();
    try {
      const roots = isDebotHost() ? getDebotFixedSurfaceRoots() : [];
      const scanRoots = roots.length ? roots : [document];
      const hrefSelector = 'a[href*="/token/"][href*="0x"]';
      for (let ri = 0; ri < scanRoots.length; ri += 1) {
        const root = scanRoots[ri];
        if (!root?.querySelectorAll) continue;
        const links = root.querySelectorAll(hrefSelector);
        for (let i = 0; i < links.length; i += 1) {
          const link = links[i];
          if (!(link instanceof HTMLElement) || isDebotTickerChip(link)) continue;
          if (!isNearViewport(link, false)) continue;
          const href = link.getAttribute("href") || "";
          if (href && !isBscTokenRouteHref(href)) continue;
          const row =
            link.matches?.('a[href*="/token/"]') && isDebotTrenchRowCard(link)
              ? link
              : climbDebotListCard(link) || quickClimbCardFromTokenLink(link);
          if (!(row instanceof HTMLElement) || cards.has(row)) continue;
          const r = row.getBoundingClientRect();
          if (r.width < 180 || r.height < 56 || r.height > 420) continue;
          cards.add(row);
          columns.add(listColumnBucket(row));
          if (window.innerWidth < 900 && cards.size >= 2) return true;
          if (cards.size >= 3 && columns.size >= 2) return true;
        }
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /** Remove only token-header artifacts; never tear down list-card badges. */
  function clearTokenHeaderArtifacts() {
    const owners = new Set();
    gmgnHeaderBadgeCache = { token: "", el: null };
    try {
      document.querySelectorAll(`[${ICON_DATA}="1"][data-fee-header="1"]`).forEach((icon) => {
        let owner = icon.parentElement;
        for (let depth = 0; owner instanceof HTMLElement && depth < 5; depth += 1) {
          if (owner.dataset.flapMount === "token-header" || owner.hasAttribute(CARD_DATA)) {
            owners.add(owner);
          }
          owner = owner.parentElement;
        }
        icon.remove();
      });
      document.querySelectorAll('[data-flap-mount="token-header"]').forEach((owner) => {
        if (owner instanceof HTMLElement) owners.add(owner);
      });
      owners.forEach((owner) => {
        delete owner.dataset.flapMount;
        delete owner.dataset[CARD_MARK];
        owner.removeAttribute(CARD_DATA);
      });
    } catch (_err) {
      // The old React subtree may already be detached.
    }
    debotHeaderBadgeOkUntil = 0;
    debotHeaderBadgeOkEl = null;
    debotHeaderFindCache = { at: 0, key: "", el: null };
  }

  function finishListReturnTransition(reason, force = false) {
    if (!listReturnTransitionUntil) return true;
    if (isTokenDetailRoute()) return false;
    if (!force && !hasMountedTrenchSurface()) return false;
    listReturnTransitionUntil = 0;
    gmgnOutgoingTrenchRoots = new WeakSet();
    if (listReturnTransitionTimer) {
      window.clearTimeout(listReturnTransitionTimer);
      listReturnTransitionTimer = null;
    }
    clearTokenHeaderArtifacts();
    armListReturnDomWatch();
    if (isGmgnHost()) {
      // Start recovery clocks from actual trench readiness. Starting them at URL
      // commit wasted every early tick when GMGN mounted columns late.
      armGmgnListReturnFastBurst();
      armGmgnListReturnFillTicks();
    } else if (isDebotHost()) {
      armDebotListReturnFastBurst();
      armDebotListReturnFillTicks();
    } else {
      armListReturnKeepAlive();
    }
    const readyKick = window.setTimeout(() => {
      spaNavScanTimers = spaNavScanTimers.filter((id) => id !== readyKick);
      if (!isExtensionContextValid() || isTokenDetailRoute()) return;
      fastPaintListReturnViewport();
      scheduleScan(0, { force: false, immediate: false, light: false });
    }, 0);
    spaNavScanTimers.push(readyKick);
    debugInfo("list-return:ready", { reason, force });
    return true;
  }

  function tryFinishListReturnTransition(reason) {
    if (!isListReturnTransitionActive()) return true;
    return finishListReturnTransition(reason, false);
  }

  function armListReturnTransition(reason) {
    finishTokenEnterTransition();
    if (!listReturnTransitionUntil && isGmgnHost()) {
      const outgoing = new WeakSet();
      try {
        document.querySelectorAll(GMGN_FIXED_TRENCH_ROOT_SELECTOR).forEach((root) => {
          if (!(root instanceof HTMLElement)) return;
          const r = root.getBoundingClientRect();
          // Token-page trench columns are compact. The current home layout replaces
          // them with viewport-width PumpSub roots after the URL has already changed.
          if (
            r.width >= 240 &&
            r.width <= window.innerWidth * 0.55 &&
            r.height >= 200 &&
            r.right > 0 &&
            r.left < window.innerWidth
          ) {
            outgoing.add(root);
          }
        });
      } catch (_err) {
        // If the outgoing subtree already detached, the next fixed root is safe.
      }
      gmgnOutgoingTrenchRoots = outgoing;
    }
    listReturnTransitionUntil = Date.now() + LIST_RETURN_TRANSITION_MS;
    gmgnTrenchProbeCache = { at: 0, roots: [], ready: false };
    gmgnTrenchRootsCache = { at: 0, roots: [] };
    gmgnPanelProbeCache = new WeakMap();
    stopListReturnDomWatch();
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    pendingLightScan = false;
    if (forceFullScanCoalesceTimer) {
      window.clearTimeout(forceFullScanCoalesceTimer);
      forceFullScanCoalesceTimer = null;
    }
    if (mutationDebounceTimer) {
      window.clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = null;
    }
    if (listReturnTransitionTimer) window.clearTimeout(listReturnTransitionTimer);
    listReturnTransitionTimer = window.setTimeout(() => {
      listReturnTransitionTimer = null;
      if (!isExtensionContextValid() || !isTabVisible()) return;
      if (isTokenDetailRoute()) {
        listReturnTransitionUntil = 0;
        return;
      }
      finishListReturnTransition(`${reason}:timeout`, true);
    }, LIST_RETURN_TRANSITION_MS);
  }

  function scheduleScan(delay = 250, options = {}) {
    const force = options.force === true;
    const immediate = options.immediate === true;
    const light = options.light === true;
    const bypassForceGap = options.bypassForceGap === true;
    // Avoid burning CPU/network while the tab is fully hidden (timers are frozen anyway).
    if (!isTabVisible() && !force) return;
    // chain=robinhood / 非 BSC：不扫，并清残留徽章
    if (!isScanPageAllowed()) {
      purgeMarksIfChainDisallowed();
      return;
    }
    if (shouldDeferGmgnTrenchResizeWork()) return;
    // The outgoing trench can remain visible after the token URL commits. Any scan in
    // this window can repaint/reposition its badges and compete with K-line mounting.
    if (isTokenEnterTransitionActive()) return;
    if (!tryFinishListReturnTransition("schedule-scan")) return;

    // 0.4.29: coalesce stacked force full-scans (SPA progressive + guardian + click-arm).
    if (force && !light && !bypassForceGap) {
      const gapLeft = FORCE_FULL_SCAN_MIN_GAP_MS - (Date.now() - lastForceFullScanAt);
      if (gapLeft > 0) {
        if (!forceFullScanCoalesceTimer) {
          forceFullScanCoalesceTimer = window.setTimeout(() => {
            forceFullScanCoalesceTimer = null;
            scheduleScan(0, {
              force: true,
              immediate: false,
              light: false,
              bypassForceGap: true
            });
          }, gapLeft);
        }
        return;
      }
    }

    // Non-force coalesces; force always schedules (but clear stuck flag first).
    if (scanScheduled && !force) return;
    if (force) {
      // Drop stale "scanScheduled" lock from timers that never ran while frozen.
      scanScheduled = false;
    }
    // Light scan: dialogs + side boards only (token page chart settled).
    if (light) pendingLightScan = true;
    else if (force && options.light === false) pendingLightScan = false;
    scanScheduled = true;

    const timerId = window.setTimeout(() => {
      scanTimerIds = scanTimerIds.filter((id) => id !== timerId);
      scanScheduled = false;
      if (!isTabVisible() && !force) return;
      if (!isExtensionContextValid()) return;
      if (shouldDeferGmgnTrenchResizeWork()) return;
      if (isGmgnScrollCooling() && !isOverlayFast()) return;
      if (isDebotScrollCooling() && !isOverlayFast()) return;
      const now = performance.now();
      // Light scans use shorter min interval (overlay UX).
      // GMGN list: 热路径用更短 gap，稳态 560ms 保流畅。
      const minGap = pendingLightScan
        ? 450
        : (isGmgnHost() || (isDebotHost() && isTrenchListPage())) &&
            !isTokenDetailRoute()
          ? gmgnListScanMinGapMs()
          : SCAN_INTERVAL_MS;
      if (!force && now - lastScanAt < minGap) {
        scheduleScan(minGap - (now - lastScanAt), { light: pendingLightScan });
        return;
      }
      lastScanAt = now;
      if (force && !pendingLightScan) lastForceFullScanAt = Date.now();
      // 0.4.29: force no longer implies immediate — chart needs idle slots.
      // Only explicit immediate (first SPA pass / user-visible overlay) skips idle.
      runWhenIdle(scanVisibleCards, { immediate: immediate === true });
    }, delay);
    scanTimerIds.push(timerId);
    // Bound list
    if (scanTimerIds.length > 24) {
      const old = scanTimerIds.shift();
      if (old) window.clearTimeout(old);
    }
  }

  /** Header-only retry. A missing optional badge must never trigger a K-line page scan. */
  function maybeScheduleDebotHeaderFullScan(reason) {
    if (Date.now() - lastDebotHeaderFullScanAt < DEBOT_HEADER_FULL_SCAN_GAP_MS) return;
    const token = extractTokenFromUrl();
    if (!token || !resolveEntry(token)) return;
    lastDebotHeaderFullScanAt = Date.now();
    scheduleDebotHeaderRepair(`header-retry:${reason}`, 120);
  }

  function runWhenIdle(fn, options = {}) {
    // After long background, requestIdleCallback can stay delayed; resume path wants setTimeout.
    if (options.immediate || !("requestIdleCallback" in window)) {
      window.setTimeout(fn, 0);
      return;
    }
    window.requestIdleCallback(fn, { timeout: 800 });
  }

  function resolveEntry(token) {
    if (!isBadgeAccessAllowed()) return null;
    if (modeCache.has(token)) return modeCache.get(token);
    if (isPersistentCacheHit(token)) {
      const entry = persistentCache.get(token);
      modeCache.set(token, entry);
      try {
        ingestFeeEntryForTaxRecv(token, entry);
      } catch (_err) {
        // ignore
      }
      return entry;
    }
    return null;
  }

  function isSpaQuiet() {
    return Date.now() < spaQuietUntil;
  }

  function cardsPerScanBudget() {
    // Overlay-fast: spend budget on dialog rows only (0.4.38).
    if (isOverlayFast()) return OVERLAY_MAX_CARDS;
    // token→list soft window: smaller slices so list repaint does not freeze UI (0.4.30).
    if (isSpaListReturnSoft()) {
      return isGmgnHost() ? SPA_LIST_RETURN_CARDS_GMGN : SPA_LIST_RETURN_CARDS;
    }
    // GMGN scroll settle: tiny budget if a force/overlay scan still runs.
    if (isGmgnHost() && isGmgnScrollCooling()) return GMGN_SCROLL_CARDS_BUDGET;
    if (isDebotHost() && isDebotScrollCooling()) return DEBOT_SCROLL_CARDS_BUDGET;
    // 0.4.45 GMGN: only first-screen ~10–12 cards (was 28 → thrash + late paint).
    if (isGmgnHost()) return GMGN_STEADY_CARDS_BUDGET;
    if (isDebotHost()) return DEBOT_STEADY_CARDS_BUDGET;
    // Full budget otherwise — stable cards free; 3-col lists still finish via progressive.
    return MAX_CARDS_PER_SCAN;
  }

  /** Cap list-return candidate seeds (GMGN viewport-only; Debot denser). */
  function listReturnCandidateCap() {
    return isGmgnHost() ? SPA_LIST_RETURN_CANDIDATES_GMGN : SPA_LIST_RETURN_CANDIDATES;
  }

  /** Enough first-screen badges to stop progressive (GMGN lower threshold). */
  function listReturnEnoughBadges() {
    return isGmgnHost()
      ? SPA_LIST_RETURN_ENOUGH_BADGES_GMGN
      : SPA_LIST_RETURN_ENOUGH_BADGES;
  }

  /** GMGN only — true while columns are being scrolled (mutation scans should wait). */
  function isGmgnScrollCooling() {
    return isGmgnHost() && gmgnScrollQuietUntil > 0 && Date.now() < gmgnScrollQuietUntil;
  }

  function isGmgnTrenchResizeCooling() {
    return (
      isGmgnHost() &&
      isGmgnTokenPage() &&
      (gmgnTrenchResizeActive ||
        (gmgnTrenchResizeQuietUntil > 0 && Date.now() < gmgnTrenchResizeQuietUntil))
    );
  }

  function shouldDeferGmgnTrenchResizeWork() {
    if (!isGmgnTrenchResizeCooling()) return false;
    gmgnTrenchResizeDirty = true;
    return true;
  }

  function isGmgnForbiddenScrollTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    const now = performance.now();
    const cached = gmgnForbiddenScrollTargetCache.get(target);
    const cacheTtl = cached?.forbidden === true ? 1500 : 200;
    if (cached && now - cached.at < cacheTtl) return cached.forbidden;
    const forbidden =
      isGmgnWalletTrackPanel(target) || isGmgnFavoritesPanel(target);
    gmgnForbiddenScrollTargetCache.set(target, { forbidden, at: now });
    return forbidden;
  }

  function wipeGmgnForbiddenPanelSubtree(node) {
    if (!(node instanceof HTMLElement)) return 0;
    let root = null;
    let p = node;
    for (let depth = 0; depth < 10 && p && p !== document.body; depth += 1) {
      if (isGmgnWalletTrackPanel(p) || isGmgnFavoritesPanel(p)) {
        root = p;
      } else if (root) {
        break;
      }
      p = p.parentElement;
    }
    if (!(root instanceof HTMLElement)) return 0;
    let removed = 0;
    root.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
      try {
        icon.remove();
        removed += 1;
      } catch (_err) {
        // ignore
      }
    });
    root.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      delete card.dataset[CARD_MARK];
      card.removeAttribute(CARD_DATA);
      cardTokenCache.delete(card);
      hrefTokenCache.delete(card);
    });
    return removed;
  }

  function cancelGmgnTrenchResizeHotWork() {
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    pendingLightScan = false;
    if (mutationDebounceTimer) {
      window.clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = null;
    }
    if (gmgnEmbeddedDirtyTimer) {
      window.clearTimeout(gmgnEmbeddedDirtyTimer);
      gmgnEmbeddedDirtyTimer = null;
    }
    if (gmgnHeaderRepairTimer) {
      window.clearTimeout(gmgnHeaderRepairTimer);
      gmgnHeaderRepairTimer = null;
    }
    if (forceFullScanCoalesceTimer) {
      window.clearTimeout(forceFullScanCoalesceTimer);
      forceFullScanCoalesceTimer = null;
    }
  }

  function findGmgnTrenchResizeHandle(target) {
    if (!isGmgnHost() || !isGmgnTokenPage()) return null;
    let el = target instanceof Element ? target : null;
    for (let depth = 0; el && depth < 4; depth += 1) {
      if (el instanceof HTMLElement) {
        try {
          const style = window.getComputedStyle(el);
          if (style.cursor === "col-resize") {
            const r = el.getBoundingClientRect();
            if (
              r.width > 0 &&
              r.width <= 24 &&
              r.height >= Math.max(280, window.innerHeight * 0.4) &&
              r.left > 80 &&
              r.left < window.innerWidth - 80
            ) {
              return el;
            }
          }
        } catch (_err) {
          return null;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function beginGmgnTrenchResize(event) {
    if (event?.button != null && event.button !== 0) return;
    if (!findGmgnTrenchResizeHandle(event?.target)) return;
    if (gmgnTrenchResizeSettleTimer) {
      window.clearTimeout(gmgnTrenchResizeSettleTimer);
      gmgnTrenchResizeSettleTimer = null;
    }
    gmgnTrenchResizeActive = true;
    gmgnTrenchResizeQuietUntil = 0;
    gmgnTrenchResizeDirty = true;
    cancelGmgnTrenchResizeHotWork();
  }

  function finishGmgnTrenchResize() {
    if (!gmgnTrenchResizeActive) return;
    gmgnTrenchResizeActive = false;
    gmgnTrenchResizeQuietUntil = Date.now() + GMGN_TRENCH_RESIZE_SETTLE_MS;
    if (gmgnTrenchResizeSettleTimer) {
      window.clearTimeout(gmgnTrenchResizeSettleTimer);
    }
    const flush = () => {
      const waitMs = gmgnTrenchResizeQuietUntil - Date.now();
      if (gmgnTrenchResizeActive) {
        gmgnTrenchResizeSettleTimer = null;
        return;
      }
      if (waitMs > 0) {
        gmgnTrenchResizeSettleTimer = window.setTimeout(flush, Math.max(40, waitMs));
        return;
      }
      gmgnTrenchResizeSettleTimer = null;
      gmgnTrenchResizeQuietUntil = 0;
      if (!gmgnTrenchResizeDirty) return;
      gmgnTrenchResizeDirty = false;
      gmgnEmbeddedDirtyCards.clear();
      scanRootsCache = { at: 0, roots: [] };
      if (!isExtensionContextValid() || !isTabVisible() || !isGmgnTokenPage()) return;
      try {
        tryPaintGmgnTokenHeader("trench-resize-settle");
      } catch (_err) {
        // The single settle scan below can recover a late header.
      }
      lastScanAt = 0;
      pendingLightScan = false;
      scheduleScan(0, { force: false, immediate: false, light: false });
    };
    gmgnTrenchResizeSettleTimer = window.setTimeout(
      flush,
      GMGN_TRENCH_RESIZE_SETTLE_MS
    );
  }

  /**
   * GMGN only: mark scroll activity. Does NOT scan on every scroll (0.4.5 lesson).
   * After settle, schedule one non-force scan to fill new virtual-list rows.
   */
  function noteGmgnScrollActivity(scrollTarget = null) {
    if (!isGmgnHost()) return;
    if (!isTabVisible() || !isExtensionContextValid()) return;
    // During K→战壕 soft window, do not enter long cooling (would delay first badges).
    if (isSpaListReturnSoft()) {
      gmgnScrollQuietUntil = 0;
      return;
    }
    // 资金接收方屏蔽开着时主线程还要扛 WSS 过滤；滚动冷却略加长，少和虚拟列表抢帧
    const taxRecvOn = taxRecvHidePrefs && taxRecvHidePrefs.enabled === true;
    const coolMs = taxRecvOn ? GMGN_SCROLL_COOLDOWN_MS + 160 : GMGN_SCROLL_COOLDOWN_MS;
    const settleMs = Math.max(
      coolMs,
      taxRecvOn ? GMGN_SCROLL_RESUME_SCAN_MS + 120 : GMGN_SCROLL_RESUME_SCAN_MS
    );
    const startingWindow = !gmgnScrollResumeTimer;
    if (startingWindow) {
      gmgnScrollResumeNeedsScan = false;
      gmgnScrollResumeTarget = null;
      gmgnForbiddenScrollTarget = null;
      gmgnEmbeddedDirtyCards.clear();
      if (gmgnEmbeddedDirtyTimer) {
        window.clearTimeout(gmgnEmbeddedDirtyTimer);
        gmgnEmbeddedDirtyTimer = null;
      }
      if (mutationDebounceTimer) {
        window.clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = null;
      }
    }
    if (!isGmgnForbiddenScrollTarget(scrollTarget)) {
      gmgnScrollResumeNeedsScan = true;
      if (scrollTarget instanceof HTMLElement) gmgnScrollResumeTarget = scrollTarget;
    } else if (scrollTarget instanceof HTMLElement) {
      gmgnForbiddenScrollTarget = scrollTarget;
    }
    gmgnScrollQuietUntil = Date.now() + settleMs;
    // Follow one moving deadline instead of allocating and cancelling a timer
    // for every wheel/scroll event.
    if (gmgnScrollResumeTimer) return;
    const finishScroll = () => {
      const waitMs = gmgnScrollQuietUntil - Date.now();
      if (waitMs > 0) {
        gmgnScrollResumeTimer = window.setTimeout(finishScroll, Math.max(40, waitMs));
        return;
      }
      gmgnScrollResumeTimer = null;
      const needsScan = gmgnScrollResumeNeedsScan;
      const scrollTarget = gmgnScrollResumeTarget;
      const forbiddenTarget = gmgnForbiddenScrollTarget;
      gmgnScrollResumeNeedsScan = false;
      gmgnScrollResumeTarget = null;
      gmgnForbiddenScrollTarget = null;
      if (!needsScan) {
        wipeGmgnForbiddenPanelSubtree(forbiddenTarget);
        return;
      }
      if (!isGmgnHost()) return;
      if (!isTabVisible() || !isExtensionContextValid()) return;
      if (isSpaQuiet() || isNonTargetTokenPage()) return;
      // Overlay UX must stay snappy.
      if (isOverlayFast() || quickHasOpenOverlay()) {
        scheduleScan(0, { force: true, light: true, immediate: false, bypassForceGap: true });
        return;
      }
      // 0.7.5：顶栏缺失时仍扫侧栏 — 旧逻辑只 tryPaint header 后 return，
      // 导致 K 线左列（已开盘）停滚后仍长时间无徽章。
      if (isGmgnTokenPage() && !hasGmgnTokenHeaderBadge()) {
        try {
          tryPaintGmgnTokenHeader("scroll-settle");
        } catch (_h) {
          // ignore
        }
      }
      pendingLightScan = false;
      const fixedScrollRoot = scrollTarget instanceof HTMLElement
        ? scrollTarget.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
          ? scrollTarget
          : scrollTarget.closest?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
        : null;
      if (fixedScrollRoot instanceof HTMLElement) {
        // Exact PumpSubX: repair only the column that moved. A three-column scan
        // here creates a visible main-thread spike immediately after every scroll.
        try {
          paintUnpaintedTargetViewportQuick("scroll-settle-fixed", fixedScrollRoot, true);
          scrubBadgesToHostHref(fixedScrollRoot, true);
        } catch (_vp) {
          // The follow-up remains the fallback.
        }
        window.setTimeout(() => {
          if (!fixedScrollRoot.isConnected) return;
          try {
            paintUnpaintedTargetViewportQuick("scroll-settle-fixed-followup", fixedScrollRoot, true);
            scrubBadgesToHostHref(fixedScrollRoot, true);
          } catch (_vp) {
            // ignore
          }
        }, 48);
        return;
      }
      if (isGmgnTokenPage()) {
        try {
          paintUnpaintedTargetViewportQuick("scroll-settle", scrollTarget, true);
        } catch (_vp) {
          // The regular scan below remains the fallback.
        }
      }
      scheduleScan(isGmgnTokenPage() ? 96 : 0, {
        force: false,
        immediate: false,
        light: false
      });
    };
    gmgnScrollResumeTimer = window.setTimeout(finishScroll, settleMs);
  }

  function isDebotScrollCooling() {
    return isDebotHost() && debotScrollQuietUntil > 0 && Date.now() < debotScrollQuietUntil;
  }

  /**
   * Debot/Gungnir column that actually moved. Prefer the MuiCard board that owns
   * trench rows so settle can paint one virtual list, not the whole page.
   */
  function resolveDebotScrollRoot(scrollTarget) {
    if (!(scrollTarget instanceof HTMLElement)) return null;
    if (scrollTarget === document.documentElement || scrollTarget === document.body) {
      return null;
    }
    if (scrollTarget.nodeType === 9) return null;
    const col = scrollTarget.closest?.(".MuiCard-root, .MuiPaper-root");
    if (col instanceof HTMLElement && col.querySelector?.('a[href*="/token/"]')) return col;
    if (
      scrollTarget.matches?.(".MuiCard-root, .MuiPaper-root") &&
      scrollTarget.querySelector?.('a[href*="/token/"]')
    ) {
      return scrollTarget;
    }
    if (scrollTarget.querySelector?.('a[href*="/token/"]')) return scrollTarget;
    const row = scrollTarget.closest?.('a[href*="/token/"]');
    if (row instanceof HTMLElement) {
      const parentCol = row.closest?.(".MuiCard-root, .MuiPaper-root");
      if (parentCol instanceof HTMLElement) return parentCol;
      return row.parentElement instanceof HTMLElement ? row.parentElement : row;
    }
    return null;
  }

  /**
   * Debot cache-first viewport fill for TARGET rows (7777/8888/ffff).
   * Used on scroll settle so newly recycled virtual rows do not wait SCAN_INTERVAL_MS.
   */
  function paintDebotUnpaintedViewportQuick(reason, rootHint = null, bypassGap = false) {
    if (!isDebotHost()) return 0;
    if (!isExtensionContextValid() || !isTabVisible()) return 0;
    if (isDebotScrollCooling() && !bypassGap) return 0;
    const now = Date.now();
    if (!bypassGap && now - lastViewportQuickAt < 280) return 0;
    lastViewportQuickAt = now;
    const tokenPage = isDebotTokenPage();
    const t0 = performance.now();
    let painted = 0;
    let queued = 0;
    const cap = tokenPage ? 14 : 12;
    const msCap = tokenPage ? 18 : 14;
    const hrefSelector = 'a[href*="/token/"][href*="0x"]';
    const seenCards = new Set();
    try {
      const roots =
        rootHint instanceof HTMLElement && rootHint.isConnected
          ? [rootHint]
          : getScanRoots();
      const items = [];
      const seen = new Set();
      const itemCap = 80;
      for (const root of roots) {
        if (!(root instanceof HTMLElement) || !root.isConnected) continue;
        if (root.matches?.(hrefSelector) && !seen.has(root)) {
          seen.add(root);
          items.push(root);
        }
        const nested = root.querySelectorAll?.(hrefSelector);
        if (nested) {
          for (let i = 0; i < nested.length && items.length < itemCap; i += 1) {
            const item = nested[i];
            if (seen.has(item)) continue;
            seen.add(item);
            items.push(item);
          }
        }
        if (items.length >= itemCap) break;
      }
      for (let i = 0; i < items.length; i += 1) {
        if (painted + queued >= cap) break;
        if (performance.now() - t0 > msCap) break;
        const el = items[i];
        if (!(el instanceof HTMLElement)) continue;
        const card =
          climbDebotListCard(el) || (isDebotTrenchRowCard(el) ? el : null);
        if (!(card instanceof HTMLElement) || seenCards.has(card)) continue;
        seenCards.add(card);
        if (tokenPage && isDebotTokenHeaderCard(card)) continue;
        if (!isNearViewport(card, false)) continue;
        if (isBadgeMountForbidden(card)) {
          wipeForbiddenMountBadges(card, true);
          continue;
        }
        const raw =
          card.getAttribute("href") ||
          el.getAttribute("href") ||
          "";
        const ca = extractAnyToken(raw);
        if (!ca || !TARGET_TOKEN_RE.test(ca)) continue;
        try {
          const good = findLocalBadgeForCard(card, ca);
          if (
            good instanceof HTMLElement &&
            document.contains(good) &&
            good.dataset.feeToken === ca &&
            good.dataset.feeLoading !== "1"
          ) {
            continue;
          }
        } catch (_q) {
          // ignore
        }
        try {
          const bad = findLocalBadgeForCard(card);
          if (
            bad instanceof HTMLElement &&
            bad.dataset.feeToken &&
            bad.dataset.feeToken !== ca
          ) {
            removeAllBadgesForCard(card, bad.dataset.feeToken);
          }
        } catch (_b) {
          // ignore
        }
        const entry = getEntryForCard(card, ca);
        if (entry && !isFeeLoadingEntry(entry) && !isHostFeeEntryPending(entry)) {
          try {
            card.dataset[CARD_MARK] = ca;
            card.setAttribute(CARD_DATA, ca);
          } catch (_m) {
            // ignore
          }
          if (
            paintListCardFromCacheFast(card, ca, entry) ||
            renderMode(card, ca, entry)
          ) {
            painted += 1;
          }
        } else if (paintLoadingBadgeAndQueue(card, ca, { deferFlush: true })) {
          painted += 1;
          queued += 1;
        } else {
          queueToken(ca);
          queued += 1;
        }
      }
    } catch (_err) {
      // ignore
    }
    if (queued > 0) maybeFlushRequestQueue(reason || "debot-viewport-quick");
    if (painted > 0 || queued > 0) {
      debugInfo("debot:viewport-quick", {
        reason: reason || "",
        tokenPage,
        painted,
        queued,
        ms: Math.round(performance.now() - t0)
      });
    }
    return painted;
  }

  function noteDebotScrollActivity(scrollTarget = null) {
    if (!isDebotHost()) return;
    if (!isTabVisible() || !isExtensionContextValid()) return;
    // K→战壕 soft window: do not enter long cooling (would delay first badges).
    if (isSpaListReturnSoft()) {
      debotScrollQuietUntil = 0;
      return;
    }
    const overlayKnownOpen =
      overlayDetectCache.open && Date.now() - overlayDetectCache.at < 500;
    if (isOverlayFast() || overlayKnownOpen) return;
    const settleMs = Math.max(DEBOT_SCROLL_COOLDOWN_MS, DEBOT_SCROLL_RESUME_SCAN_MS);
    const startingWindow = !debotScrollResumeTimer;
    if (startingWindow) {
      debotScrollResumeTarget = null;
      if (mutationDebounceTimer) {
        window.clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = null;
      }
    }
    if (scrollTarget instanceof HTMLElement) {
      const root = resolveDebotScrollRoot(scrollTarget);
      debotScrollResumeTarget = root instanceof HTMLElement ? root : scrollTarget;
    }
    debotScrollQuietUntil = Date.now() + settleMs;
    if (debotScrollResumeTimer) return;
    const finishScroll = () => {
      const waitMs = debotScrollQuietUntil - Date.now();
      if (waitMs > 0) {
        debotScrollResumeTimer = window.setTimeout(finishScroll, Math.max(40, waitMs));
        return;
      }
      debotScrollResumeTimer = null;
      const scrollRoot = debotScrollResumeTarget;
      debotScrollResumeTarget = null;
      if (!isDebotHost() || !isTabVisible() || !isExtensionContextValid()) return;
      if (isSpaQuiet() || isNonTargetTokenPage()) return;
      if (isDebotTokenPage() && !hasDebotTokenHeaderBadge()) {
        // 0.7.16: 修顶栏后继续下面的列表/侧栏扫（原先 return 会饿死侧栏，
        // 与 GMGN 0.7.5 scroll-settle 必扫战壕对齐）。
        tryPaintDebotTokenHeader("scroll-settle");
      }
      pendingLightScan = false;
      const columnRoot =
        scrollRoot instanceof HTMLElement && scrollRoot.isConnected
          ? resolveDebotScrollRoot(scrollRoot) || scrollRoot
          : null;
      try {
        paintDebotUnpaintedViewportQuick("scroll-settle", columnRoot, true);
        scrubBadgesToHostHref(columnRoot || document, true);
      } catch (_vp) {
        // The follow-up remains the fallback.
      }
      if (columnRoot instanceof HTMLElement) {
        window.setTimeout(() => {
          if (!columnRoot.isConnected) return;
          try {
            paintDebotUnpaintedViewportQuick("scroll-settle-followup", columnRoot, true);
            scrubBadgesToHostHref(columnRoot, true);
          } catch (_vp2) {
            // ignore
          }
        }, 48);
      }
      scheduleScan(columnRoot ? 96 : 0, {
        force: false,
        immediate: false,
        light: false
      });
    };
    debotScrollResumeTimer = window.setTimeout(finishScroll, settleMs);
  }

  /**
   * Cheap badge lookup for one card (card subtree + immediate siblings).
   * Avoids parent-children getBoundingClientRect thrash used by full countBadgesNearCard.
   */
  function findLocalBadgeForCard(card, tokenHint) {
    if (!(card instanceof HTMLElement)) return null;
    const token = tokenHint || card.dataset[CARD_MARK] || "";
    const direct = card.querySelector(`[${ICON_DATA}="1"]`);
    if (
      direct instanceof HTMLElement &&
      (!token || !direct.dataset.feeToken || direct.dataset.feeToken === token)
    ) {
      return direct;
    }
    for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
      if (!(sib instanceof HTMLElement)) continue;
      if (sib.dataset?.[ICON_MARK] !== "1" && !sib.matches?.(`[${ICON_DATA}="1"]`)) continue;
      if (token && sib.dataset.feeToken && sib.dataset.feeToken !== token) continue;
      return sib;
    }
    return null;
  }

  function countLocalBadgesForCard(card, tokenHint) {
    if (!(card instanceof HTMLElement)) return 0;
    const token = tokenHint || card.dataset[CARD_MARK] || "";
    let n = 0;
    try {
      card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((el) => {
        if (token && el.dataset.feeToken && el.dataset.feeToken !== token) return;
        n += 1;
      });
    } catch (_err) {
      // ignore
    }
    for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
      if (!(sib instanceof HTMLElement)) continue;
      if (sib.dataset?.[ICON_MARK] !== "1" && !sib.matches?.(`[${ICON_DATA}="1"]`)) continue;
      if (token && sib.dataset.feeToken && sib.dataset.feeToken !== token) continue;
      n += 1;
    }
    return n;
  }

  /**
   * GMGN mutation relevance — skip pure ticker/attr thrash.
   * Returns true when added/removed nodes likely need a badge scan.
   */
  function isExtensionOnlyMutation(record) {
    const target = record?.target;
    if (target instanceof Element && target.closest?.(`[${ICON_DATA}="1"]`)) return true;
    const changed = [...(record?.addedNodes || []), ...(record?.removedNodes || [])];
    return (
      changed.length > 0 &&
      changed.every((node) => {
        if (node instanceof Element) {
          return node.matches?.(`[${ICON_DATA}="1"]`) || !!node.closest?.(`[${ICON_DATA}="1"]`);
        }
        return node.parentElement?.closest?.(`[${ICON_DATA}="1"]`) != null;
      })
    );
  }

  /** GMGN search rows already expose an outer /bsc/token/<CA> link. */
  function findGmgnOverlayCard(node) {
    if (!(node instanceof HTMLElement)) return null;
    const link = node.closest?.(
      "[href*='/bsc/token/0x'], [href*='/token/0x']"
    );
    if (!(link instanceof HTMLElement)) return null;
    const href = link.getAttribute("href") || "";
    return /\/(?:bsc\/)?token\/0x[a-fA-F0-9]{40}/.test(href) && normalizeToken(href)
      ? link
      : null;
  }

  function scheduleGmgnEmbeddedDirtyPass() {
    if (shouldDeferGmgnTrenchResizeWork()) return;
    if (gmgnEmbeddedDirtyTimer) return;
    gmgnEmbeddedDirtyTimer = window.setTimeout(() => {
      gmgnEmbeddedDirtyTimer = null;
      if (
        !isExtensionContextValid() ||
        !isTabVisible() ||
        !isGmgnTokenPage() ||
        !extractTokenFromUrl()
      ) {
        gmgnEmbeddedDirtyCards.clear();
        return;
      }
      if (shouldDeferGmgnTrenchResizeWork()) return;
      // Boot/progressive scans own the unsettled phase. Once the header is stable,
      // this queue updates only changed trench rows and never wakes the chart scanner.
      if (isSpaQuiet() || quickHasOpenOverlay()) return;
      // 顶栏未稳时仍处理侧栏新卡，避免进 K 线后新创建空窗。
      if (!isTokenPageSettledWithBadge() && gmgnEmbeddedDirtyCards.size === 0) return;
      // 滚动冷却中：不丢队列，等停滚后再补（避免 180ms 空转）
      if (isGmgnScrollCooling()) {
        const wait = Math.max(
          100,
          Math.min(600, (gmgnScrollQuietUntil || 0) - Date.now() + 60)
        );
        gmgnEmbeddedDirtyTimer = window.setTimeout(() => {
          gmgnEmbeddedDirtyTimer = null;
          scheduleGmgnEmbeddedDirtyPass();
        }, wait);
        return;
      }

      const cards = Array.from(gmgnEmbeddedDirtyCards);
      gmgnEmbeddedDirtyCards.clear();
      cards.sort((a, b) => {
        const ab = a.querySelector?.(`[${ICON_DATA}="1"]`) ? 1 : 0;
        const bb = b.querySelector?.(`[${ICON_DATA}="1"]`) ? 1 : 0;
        return ab - bb;
      });
      let processed = 0;
      let painted = 0;
      let queued = 0;
      for (const card of cards) {
        if (processed >= GMGN_EMBEDDED_DIRTY_CARD_LIMIT) break;
        if (!(card instanceof HTMLElement) || !card.isConnected) continue;
        // 0.7.5：侧栏用更松视口；非侧栏仍紧门禁
        const near = isGmgnTokenTrenchSidebarEl(card)
          ? isNearGmgnTokenTrenchViewport(card)
          : isNearViewport(card, true);
        if (!near || !isVisible(card)) continue;
        processed += 1;
        let token =
          extractCardTokenFromAttrs(card) ||
          extractCardHrefToken(card) ||
          siteStrategy?.extractToken?.(card) ||
          null;
        if (token) token = String(token).toLowerCase();
        if (!token || !TARGET_TOKEN_RE.test(token)) {
          if (card.dataset[CARD_MARK] || card.querySelector?.(`[${ICON_DATA}="1"]`)) {
            clearCardIcon(card);
          }
          continue;
        }
        card.dataset[CARD_MARK] = token;
        const entry = getEntryForCard(card, token);
        if (entry) {
          if (paintListCardFromCacheFast(card, token, entry)) painted += 1;
        } else {
          if (paintLoadingBadgeAndQueue(card, token)) painted += 1;
          queued += 1;
        }
      }
      // 本批 dirty 漏掉的视口未画：再快补一轮
      debugInfo("gmgn:embedded-dirty", { cards: cards.length, processed, painted, queued });
    }, GMGN_EMBEDDED_DIRTY_DEBOUNCE_MS);
  }

  /**
   * Discover newly inserted visible GMGN cards directly from fixed trench roots.
   * This is intentionally bounded and only handles additions/href swaps; the
   * regular scanner remains responsible for initial hydration and reconciliation.
   */
  function collectGmgnNewCardMutations(records) {
    if (
      !isGmgnHost() ||
      !records?.length ||
      shouldDeferGmgnTrenchResizeWork() ||
      isGmgnScrollCooling()
    ) return 0;
    const hrefSelector = '[href*="/bsc/token/"][href*="0x"], [href*="/token/"][href*="0x"]';
    const itemSelector = '[data-sentry-source-file="TokenItem.tsx"]';
    const seen = new Set();
    let discovered = 0;
    const handleNode = (node) => {
      if (!(node instanceof HTMLElement) || discovered >= GMGN_NEW_CARD_LIMIT) return;
      const candidates = [];
      if (node.matches(hrefSelector) || node.matches(itemSelector)) candidates.push(node);
      if (node.childElementCount <= GMGN_NEW_CARD_LIMIT * 2) {
        node.querySelectorAll?.(`${hrefSelector}, ${itemSelector}`).forEach((el) => {
          if (candidates.length < GMGN_NEW_CARD_LIMIT) candidates.push(el);
        });
      } else {
        const firstHref = node.querySelector?.(hrefSelector);
        const firstItem = node.querySelector?.(itemSelector);
        if (firstHref) candidates.push(firstHref);
        if (firstItem && firstItem !== firstHref) candidates.push(firstItem);
      }
      for (const candidate of candidates) {
        if (discovered >= GMGN_NEW_CARD_LIMIT) break;
        let card = candidate.matches(itemSelector)
          ? candidate
          : candidate.closest?.(itemSelector);
        if (!(card instanceof HTMLElement)) card = quickClimbCardFromTokenLink(candidate);
        if (!(card instanceof HTMLElement) || seen.has(card) || !card.isConnected) continue;
        const trench = card.matches(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
          ? card
          : card.closest?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR);
        if (!(trench instanceof HTMLElement)) continue;
        if (isGmgnWalletTrackPanel(card) || isGmgnFavoritesPanel(card)) {
          wipeForbiddenMountBadges(card, true);
          continue;
        }
        if (!isNearViewport(card, true)) continue;
        const token =
          extractCardTokenFromAttrs(card) ||
          extractCardHrefToken(card) ||
          normalizeToken(candidate.getAttribute("href") || "");
        if (!TARGET_TOKEN_RE.test(token || "")) continue;
        seen.add(card);
        discovered += 1;
        const prevMark = (card.dataset[CARD_MARK] || "").toLowerCase();
        if (prevMark && prevMark !== token) {
          try {
            removeAllBadgesForCard(card, prevMark);
          } catch (_swap) {
            // ignore
          }
        }
        card.dataset[CARD_MARK] = token;
        trySeedHostFeeForCard(card, token);
        const entry =
          prevMark && prevMark !== token
            ? resolveEntry(token)
            : getEntryForCard(card, token);
        if (entry && !isHostFeeEntryPending(entry)) {
          paintListCardFromCacheFast(card, token, entry);
        } else {
          paintLoadingBadgeAndQueue(card, token, { deferFlush: true });
          if (requestQueue.has(token)) gmgnNewCardPendingTokens.add(token);
        }
      }
    };
    for (const record of records) {
      if (!record || (record.type !== "childList" && record.type !== "attributes")) continue;
      if (record.type === "attributes" && record.attributeName !== "href") continue;
      if (record.type === "childList") {
        for (const node of record.addedNodes || []) {
          handleNode(node);
          if (discovered >= GMGN_NEW_CARD_LIMIT) break;
        }
      } else {
        handleNode(record.target);
      }
      if (discovered >= GMGN_NEW_CARD_LIMIT) break;
    }
    if (discovered > 0) {
      scheduleGmgnNewCardBatchFlush();
      debugInfo("gmgn:new-card", {
        discovered,
        pending: gmgnNewCardPendingTokens.size
      });
    }
    return discovered;
  }

  function collectDebotNewCardMutations(records) {
    if (
      !isDebotHost() ||
      (!isTrenchListPage() && !isDebotTokenPage()) ||
      !records?.length ||
      isDebotScrollCooling()
    ) {
      return 0;
    }
    const seen = new Set();
    let discovered = 0;
    const handleNode = (node) => {
      if (!(node instanceof HTMLElement) || discovered >= DEBOT_NEW_CARD_LIMIT) return;
      const candidates = [];
      if (node.matches?.('a[href*="/token/"]')) candidates.push(node);
      if (node.querySelectorAll && node.childElementCount <= 24) {
        node.querySelectorAll('a[href*="/token/"]').forEach((el) => {
          if (candidates.length < DEBOT_NEW_CARD_LIMIT) candidates.push(el);
        });
      } else if (node.querySelector) {
        const first = node.querySelector('a[href*="/token/"]');
        if (first) candidates.push(first);
      }
      for (const candidate of candidates) {
        if (discovered >= DEBOT_NEW_CARD_LIMIT) break;
        const card = climbDebotListCard(candidate);
        if (!(card instanceof HTMLElement) || seen.has(card) || !card.isConnected) continue;
        if (!isNearViewport(card, true) || !isVisible(card)) continue;
        const token =
          extractCardHrefToken(card) ||
          normalizeToken(candidate.getAttribute("href") || "");
        if (!TARGET_TOKEN_RE.test(token || "")) continue;
        if (!cardHrefAllowedForScan(card) && !isBscTokenRouteHref(candidate.getAttribute("href") || "")) {
          continue;
        }
        seen.add(card);
        discovered += 1;
        trySeedHostFeeForCard(card, token);
        try {
          card.dataset[CARD_MARK] = token;
        } catch (_mark) {
          // ignore
        }
        const entry = getEntryForCard(card, token);
        if (entry && hostFeeCanSkipModes(entry)) {
          paintListCardFromCacheFast(card, token, entry);
          releaseQueuedTokenIfHostFeeReady(token);
        } else if (entry && !isHostFeeEntryPending(entry) && !isFeeLoadingEntry(entry)) {
          paintListCardFromCacheFast(card, token, entry);
        } else {
          paintLoadingBadgeAndQueue(card, token, { deferFlush: true });
          gmgnNewCardPendingTokens.add(token);
        }
      }
    };
    for (const record of records) {
      if (!record || (record.type !== "childList" && record.type !== "attributes")) continue;
      if (record.type === "attributes" && record.attributeName !== "href") continue;
      if (record.type === "childList") {
        for (const node of record.addedNodes || []) {
          handleNode(node);
          if (discovered >= DEBOT_NEW_CARD_LIMIT) break;
        }
      } else {
        handleNode(record.target);
      }
      if (discovered >= DEBOT_NEW_CARD_LIMIT) break;
    }
    if (discovered > 0) {
      scheduleGmgnNewCardBatchFlush();
      try {
        scheduleTaxRecvHideApply(40);
      } catch (_hideNc) {
        // ignore
      }
    }
    return discovered;
  }

  /** Collect GMGN TokenItem / token-href roots touched by host mutations. */
  function collectGmgnEmbeddedDirtyCards(records) {
    if (!isGmgnTokenPage() || !records?.length) return 0;
    if (shouldDeferGmgnTrenchResizeWork()) return 0;
    const selector = '[data-sentry-source-file="TokenItem.tsx"]';
    const hrefSel =
      '[href*="/bsc/token/"][href*="0x"], [href*="/token/"][href*="0x"]';
    let added = 0;
    let matched = false;
    const skipForbiddenPanelCard = (card) => {
      if (
        !(card instanceof HTMLElement) ||
        (!isGmgnWalletTrackPanel(card) && !isGmgnFavoritesPanel(card))
      ) {
        return false;
      }
      wipeForbiddenMountBadges(card, true);
      return true;
    };
    const addCard = (node) => {
      if (!(node instanceof HTMLElement)) return;
      let card = node.matches(selector) ? node : node.closest?.(selector);
      // 0.7.5：无 TokenItem 标记时，回退到侧栏 token href 宿主
      if (!(card instanceof HTMLElement)) {
        const hrefHost = node.matches?.(hrefSel)
          ? node
          : node.closest?.(hrefSel);
        if (
          hrefHost instanceof HTMLElement &&
          isGmgnTokenTrenchSidebarEl(hrefHost)
        ) {
          card = hrefHost;
        }
      }
      if (card instanceof HTMLElement && card.isConnected) {
        if (skipForbiddenPanelCard(card)) return;
        if (!isGmgnTokenTrenchSidebarEl(card) && !card.matches?.(selector)) {
          // 图表区 / 顶栏 href：不入 dirty
        } else {
          matched = true;
          if (!gmgnEmbeddedDirtyCards.has(card)) {
            gmgnEmbeddedDirtyCards.add(card);
            added += 1;
          }
        }
      }
      if (added >= GMGN_EMBEDDED_DIRTY_CARD_LIMIT) return;
      const nested = node.querySelectorAll?.(selector) || [];
      for (let i = 0; i < nested.length && added < GMGN_EMBEDDED_DIRTY_CARD_LIMIT; i += 1) {
        const item = nested[i];
        if (!(item instanceof HTMLElement) || !item.isConnected || gmgnEmbeddedDirtyCards.has(item)) {
          if (item instanceof HTMLElement && item.isConnected) matched = true;
          continue;
        }
        if (skipForbiddenPanelCard(item)) continue;
        matched = true;
        gmgnEmbeddedDirtyCards.add(item);
        added += 1;
      }
      // href 兜底：子树里新挂的侧栏 token 行
      if (added < GMGN_EMBEDDED_DIRTY_CARD_LIMIT) {
        const hrefNested = node.querySelectorAll?.(hrefSel) || [];
        for (
          let i = 0;
          i < hrefNested.length && added < GMGN_EMBEDDED_DIRTY_CARD_LIMIT;
          i += 1
        ) {
          const item = hrefNested[i];
          if (!(item instanceof HTMLElement) || !item.isConnected) continue;
          if (skipForbiddenPanelCard(item)) continue;
          if (!isGmgnTokenTrenchSidebarEl(item)) continue;
          if (gmgnEmbeddedDirtyCards.has(item)) continue;
          matched = true;
          gmgnEmbeddedDirtyCards.add(item);
          added += 1;
        }
      }
    };
    for (const record of records) {
      if (!record) continue;
      if (record.type === "attributes") {
        if (record.attributeName === "href" && record.target instanceof HTMLElement) {
          addCard(record.target);
        }
        if (added >= GMGN_EMBEDDED_DIRTY_CARD_LIMIT) break;
        continue;
      }
      if (record.type !== "childList" || isExtensionOnlyMutation(record)) continue;
      addCard(record.target instanceof HTMLElement ? record.target : record.target?.parentElement);
      for (const node of record.addedNodes || []) {
        if (node instanceof HTMLElement) addCard(node);
        if (added >= GMGN_EMBEDDED_DIRTY_CARD_LIMIT) break;
      }
      if (added >= GMGN_EMBEDDED_DIRTY_CARD_LIMIT) break;
    }
    if (matched) scheduleGmgnEmbeddedDirtyPass();
    return added;
  }

  function gmgnMutationLooksRelevant(records) {
    if (!records || !records.length) return true;
    const interestingHref = (href) =>
      typeof href === "string" &&
      href.length > 8 &&
      (href.includes("7777") ||
        href.includes("8888") ||
        href.includes("ffff") ||
        href.includes("FFFF") ||
        href.includes("/token/"));
    const probeEl = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      // A direct extension badge insert/remove is our own feedback, not host work.
      if (el.dataset?.[ICON_MARK] === "1" || el.matches?.(`[${ICON_DATA}="1"]`)) {
        return false;
      }
      if (el.dataset?.[CARD_MARK] || el.matches?.(`[${CARD_DATA}]`)) return true;
      const tag = el.tagName;
      if (tag === "A") {
        const href = el.getAttribute("href") || "";
        if (interestingHref(href)) return true;
      }
      // Shallow: direct child links / our marks (avoid full subtree walk on huge chunks).
      if (el.querySelector?.(`[${ICON_DATA}="1"], a[href*="7777"], a[href*="8888"], a[href*="ffff"], a[href*="/token/"]`)) {
        return true;
      }
      // Short Tax chip text on leaf-ish nodes.
      if ((tag === "SPAN" || tag === "DIV") && el.childElementCount <= 2) {
        const t = (el.textContent || "").trim();
        if (t.length > 0 && t.length <= 48 && hasFeeTag(t)) return true;
      }
      return false;
    };
    for (let i = 0; i < records.length; i += 1) {
      const r = records[i];
      if (!r) continue;
      if (r.type === "attributes") {
        if (
          r.attributeName === "href" &&
          r.target instanceof HTMLElement &&
          interestingHref(r.target.getAttribute("href") || "")
        ) return true;
        continue;
      }
      if (r.type !== "childList") continue;
      const added = r.addedNodes;
      for (let j = 0; j < added.length; j += 1) {
        const n = added[j];
        if (n.nodeType !== 1) continue;
        if (probeEl(n)) return true;
      }
      const removed = r.removedNodes;
      for (let j = 0; j < removed.length; j += 1) {
        const n = removed[j];
        if (n.nodeType !== 1) continue;
        // Our badge removed / virtual row recycled — need rescan.
        if (probeEl(n)) return true;
      }
    }
    return false;
  }

  /**
   * Debot/Gungnir mutation relevance. Extension-only badge insert/remove records must
   * not schedule another scan; that feedback loop made virtual-list scrolling unbounded.
   */
  function debotMutationLooksRelevant(records) {
    if (!records || !records.length) return true;
    const probeEl = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.dataset?.[ICON_MARK] === "1" || el.matches?.(`[${ICON_DATA}="1"]`)) {
        return false;
      }
      const tag = el.tagName;
      if (tag === "A") {
        const href = el.getAttribute("href") || "";
        if (/\/token\/|\/bsc\/token\//i.test(href) && /(?:7777|8888|ffff)/i.test(href)) {
          return true;
        }
      }
      if (
        el.querySelector?.(
          'a[href*="/token/"][href*="7777"], a[href*="/token/"][href*="8888"], ' +
            'a[href*="/token/"][href*="ffff"], ' +
            'a[href*="/bsc/token/"][href*="7777"], a[href*="/bsc/token/"][href*="8888"], ' +
            'a[href*="/bsc/token/"][href*="ffff"]'
        )
      ) {
        return true;
      }
      if ((tag === "SPAN" || tag === "DIV") && el.childElementCount <= 3) {
        const text = (el.textContent || "").trim();
        if (text.length <= 64 && (TARGET_SHORT_TOKEN_RE.test(text) || hasFeeTag(text))) {
          return true;
        }
      }
      return false;
    };
    for (const record of records) {
      if (!record) continue;
      if (record.type === "attributes") {
        if (
          record.attributeName === "href" &&
          record.target instanceof HTMLElement &&
          /\/token\//i.test(record.target.getAttribute("href") || "") &&
          /(?:7777|8888|ffff)/i.test(record.target.getAttribute("href") || "")
        ) {
          return true;
        }
        continue;
      }
      if (record.type !== "childList") continue;
      for (const node of record.addedNodes || []) {
        if (node.nodeType === 1 && probeEl(node)) return true;
      }
      for (const node of record.removedNodes || []) {
        if (node.nodeType === 1 && probeEl(node)) return true;
      }
    }
    return false;
  }

  function isSpaListReturnSoft() {
    return spaListReturnUntil > 0 && Date.now() < spaListReturnUntil && !isTokenDetailRoute();
  }

  /** GMGN needs 0.4.22-light SPA; Debot keeps denser recovery. */
  function isGmgnHost() {
    return (location.hostname || "").endsWith("gmgn.ai");
  }

  function isDebotHost() {
    const host = location.hostname || "";
    return host.endsWith("debot.ai") || host.endsWith("gungnir.bot");
  }

  function listReturnSoftDurationMs() {
    return isGmgnHost() ? SPA_LIST_RETURN_SOFT_GMGN_MS : SPA_LIST_RETURN_SOFT_MS;
  }

  function listReturnDomWatchMs() {
    return isGmgnHost() ? LIST_RETURN_DOM_WATCH_GMGN_MS : LIST_RETURN_DOM_WATCH_MS;
  }

  function isSpaListReturnCacheOnly() {
    return (
      spaListReturnCacheOnlyUntil > 0 &&
      Date.now() < spaListReturnCacheOnlyUntil &&
      !isTokenDetailRoute()
    );
  }

  /** Prev SPA key was a token detail path (GMGN/Debot/Gungnir). */
  function routeKeyWasTokenDetail(routeKey) {
    const s = String(routeKey || "");
    return /\/token\//i.test(s) || /\/bsc\/token\//i.test(s);
  }

  function routeKeyHasNonTargetToken(routeKey) {
    if (!routeKeyWasTokenDetail(routeKey)) return false;
    const token = extractAnyToken(routeKey);
    return !!token && !TARGET_TOKEN_RE.test(token);
  }

  /**
   * Cheap climb from token <a href> / Tax leaf to a card-sized host.
   * 0.4.39: NEVER return 22px vlist junk (was main GMGN return paint miss).
   */
  function quickClimbCardFromTokenLink(anchor) {
    if (!(anchor instanceof HTMLElement)) return null;
    let el = anchor;
    let best = null;
    for (let d = 0; d < 10 && el; d += 1) {
      if (!(el instanceof HTMLElement)) break;
      if (el === document.body || el === document.documentElement) break;
      try {
        const r = el.getBoundingClientRect();
        // Real trench rows ~97–140px; reject thin virtuoso shells.
        if (
          r.width >= 180 &&
          r.height >= 56 &&
          r.height <= 420 &&
          r.width < window.innerWidth * 0.95
        ) {
          best = el;
          // Prefer compact card row over taller wrappers.
          if (r.height <= 200 && r.width >= 220) return el;
        }
      } catch (_err) {
        break;
      }
      el = el.parentElement;
    }
    return best;
  }

  /** Bucket element into left / mid / right third of viewport (Debot 3-col + GMGN). */
  function listColumnBucket(el) {
    try {
      const r = el.getBoundingClientRect();
      const mid = r.left + r.width * 0.5;
      const w = window.innerWidth || 1;
      if (mid < w / 3) return 0;
      if (mid < (2 * w) / 3) return 1;
      return 2;
    } catch (_err) {
      return 1;
    }
  }

  /**
   * Bounded GMGN row signals inside one known column. Current GMGN virtual rows may
   * navigate through React handlers and expose only a short CA, so an <a> is optional.
   */
  function collectGmgnTrenchRowSignals(root, targetOnly = false, cap = 18) {
    if (!(root instanceof HTMLElement) || !root.querySelectorAll || cap <= 0) return [];
    const out = [];
    const seen = new Set();
    const push = (el) => {
      if (!(el instanceof HTMLElement) || seen.has(el) || out.length >= cap) return;
      seen.add(el);
      out.push(el);
    };
    try {
      const attrNodes = root.querySelectorAll(
        "a[href*='0x'], [title*='0x'], [aria-label*='0x'], " +
          "[data-token*='0x'], [data-address*='0x'], [data-ca*='0x'], [data-contract*='0x']"
      );
      const attrMax = Math.min(attrNodes.length, 80);
      for (let i = 0; i < attrMax && out.length < cap; i += 1) {
        const el = attrNodes[i];
        const href = el.getAttribute("href") || "";
        if (/flap\.sh|bscscan|etherscan/i.test(href)) continue;
        const values = [
          href,
          el.getAttribute("title"),
          el.getAttribute("aria-label"),
          el.getAttribute("data-token"),
          el.getAttribute("data-address"),
          el.getAttribute("data-ca"),
          el.getAttribute("data-contract")
        ];
        const token = values.map((value) => extractAnyToken(value)).find(Boolean);
        if (!token || (targetOnly && !TARGET_TOKEN_RE.test(token))) continue;
        push(el);
      }

      // Root-scoped and capped: covers div/span rows driven by a React onClick.
      const leaves = root.querySelectorAll("span, a, div, p");
      const leafMax = Math.min(leaves.length, 260);
      const taxFallback = [];
      for (let i = 0; i < leafMax && out.length < cap; i += 1) {
        const el = leaves[i];
        if (!(el instanceof HTMLElement) || el.childElementCount > 2) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 32) continue;
        const short = text.match(SHORT_TOKEN_RE)?.[0] || "";
        if (short && (!targetOnly || TARGET_SHORT_TOKEN_RE.test(short))) {
          push(el);
          continue;
        }
        if (targetOnly && taxFallback.length < 8 && /^Tax(?:\s|$)/i.test(text)) {
          taxFallback.push(el);
        }
      }
      if (targetOnly && out.length < cap) {
        for (const el of taxFallback) push(el);
      }
    } catch (_err) {
      return out;
    }
    return out;
  }

  /**
   * Collect one bounded seed per visible GMGN card. The cap applies after card
   * resolution, so multiple href/data attributes from one row cannot starve
   * later rows in the same column.
   */
  function collectGmgnVisibleCardSeeds(root, cap = 18) {
    if (!(root instanceof HTMLElement) || !root.querySelectorAll || cap <= 0) return [];
    const out = [];
    const seenCards = new Set();
    const add = (seed) => {
      if (!(seed instanceof HTMLElement) || out.length >= cap) return;
      if (!isNearViewport(seed, false)) return;
      const card = resolveGmgnTrenchRow(seed);
      if (!(card instanceof HTMLElement) || seenCards.has(card)) return;
      seenCards.add(card);
      out.push({ seed, card });
    };

    try {
      const attrs = root.querySelectorAll(SUFFIX_SELECTORS);
      const attrMax = Math.min(attrs.length, 120);
      for (let i = 0; i < attrMax && out.length < cap; i += 1) add(attrs[i]);

      if (out.length < cap) {
        const leaves = root.querySelectorAll("span, a, p");
        const leafMax = Math.min(leaves.length, 320);
        for (let i = 0; i < leafMax && out.length < cap; i += 1) {
          const leaf = leaves[i];
          if (!(leaf instanceof HTMLElement) || leaf.childElementCount > 1) continue;
          const text = (leaf.textContent || "").trim();
          if (text.length < 8 || text.length > 24 || !TARGET_SHORT_TOKEN_RE.test(text)) {
            continue;
          }
          add(leaf);
        }
      }
    } catch (_err) {
      return out;
    }
    return out;
  }

  /** Locate the compact row containing a CA/Tax signal, never a full column wrapper. */
  function resolveGmgnTrenchRow(signal) {
    if (!(signal instanceof HTMLElement)) return null;
    const card = climbGmgnListCard(signal) || quickClimbCardFromTokenLink(signal);
    if (!(card instanceof HTMLElement) || !hasShortAddress(card)) return null;
    try {
      const r = card.getBoundingClientRect();
      if (r.width < 180 || r.height < 56 || r.height > 420) return null;
    } catch (_err) {
      return null;
    }
    return card;
  }

  /**
   * Require real card rows in multiple horizontal columns. This rejects the single
   * embedded trench sidebar that can remain mounted while GMGN leaves the K-line.
   */
  function getMountedGmgnTrenchRoots() {
    const now = Date.now();
    if (
      now - gmgnTrenchRootsCache.at < GMGN_TRENCH_ROOT_CACHE_MS &&
      gmgnTrenchRootsCache.roots.length > 0 &&
      gmgnTrenchRootsCache.roots.every((root) => root?.isConnected)
    ) {
      return gmgnTrenchRootsCache.roots;
    }
    const candidates = [];
    try {
      const exact = Array.from(
        document.querySelectorAll(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
      );
      const rootNodes = exact.length
        ? exact
        : Array.from(document.querySelectorAll(GMGN_TRENCH_ROOT_SELECTOR));
      rootNodes.forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        if (isListReturnTransitionActive() && gmgnOutgoingTrenchRoots.has(root)) return;
        if (isGmgnWalletTrackPanel(root) || isGmgnFavoritesPanel(root)) return;
        const r = root.getBoundingClientRect();
        const fixedRoot = root.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR);
        const maxWidth = fixedRoot ? window.innerWidth * 1.05 : window.innerWidth * 0.48;
        if (
          r.width < 240 ||
          r.width > maxWidth ||
          r.height < 200 ||
          r.bottom <= 0 ||
          r.top >= window.innerHeight ||
          r.right <= 0 ||
          r.left >= window.innerWidth
        ) {
          return;
        }
        const head = (root.textContent || "").slice(0, 120);
        const titleRank = /新创建|即将打满|已开盘/.test(head) ? 1 : 0;
        candidates.push({
          root,
          titleRank,
          area: r.width * r.height,
          bucket: listColumnBucket(root)
        });
      });
    } catch (_err) {
      return [];
    }
    candidates.sort((a, b) => b.titleRank - a.titleRank || b.area - a.area);
    const byBucket = [[], [], []];
    for (const candidate of candidates) {
      const bucket = byBucket[candidate.bucket] || byBucket[1];
      if (bucket.length < 4) bucket.push(candidate);
    }
    const roots = [];
    for (let depth = 0; depth < 4 && roots.length < 3; depth += 1) {
      for (let bucket = 0; bucket < 3 && roots.length < 3; bucket += 1) {
        const candidate = byBucket[bucket][depth];
        if (!candidate) continue;
        if (roots.some((root) => root.contains(candidate.root) || candidate.root.contains(root))) {
          continue;
        }
        const signals = collectGmgnTrenchRowSignals(candidate.root, false, 8);
        if (!signals.some((signal) => resolveGmgnTrenchRow(signal))) continue;
        roots.push(candidate.root);
      }
    }
    gmgnTrenchRootsCache = { at: now, roots };
    return roots;
  }

  /**
   * Collect list-return seeds in viewport, round-robin by column.
   * 0.4.39: href tokens + Tax chips + short-CA leaves (js-mcp: href-only climb miss).
   */
  function collectListReturnAnchorsRoundRobin(options = {}) {
    const requestedCap = Number(options.cap);
    const cap =
      Number.isFinite(requestedCap) && requestedCap > 0
        ? Math.floor(requestedCap)
        : listReturnCandidateCap();
    const requestedOffset = Number(options.rowOffset);
    const rowOffset =
      Number.isFinite(requestedOffset) && requestedOffset > 0
        ? Math.floor(requestedOffset)
        : 0;
    const forceFreshRoots = options.forceFreshRoots !== false;
    // Include div[href] (GMGN TokenItem) — a-only misses 新创建 seeds (js-mcp 0.6.4).
    const linkSel =
      "[href*='/token/'][href*='8888'], [href*='/token/'][href*='7777'], " +
      "[href*='/token/'][href*='ffff'], " +
      "[href*='/bsc/token/'][href*='8888'], [href*='/bsc/token/'][href*='7777'], " +
      "[href*='/bsc/token/'][href*='ffff']";
    const buckets = [[], [], []];
    const seenKey = new Set();
    const pushSeed = (el, key) => {
      if (!(el instanceof HTMLElement)) return;
      if (!isNearViewport(el, false)) return;
      const k = key || el;
      if (seenKey.has(k)) return;
      // Skip external explorer icons (flap.sh) — climb to wrong thin hosts.
      const href = (el.getAttribute && el.getAttribute("href")) || "";
      if (/flap\.sh|bscscan|etherscan/i.test(href) && !(key instanceof HTMLElement)) return;
      if (href && href.indexOf("/token/") !== -1 && !isBscTokenRouteHref(href)) return;
      seenKey.add(k);
      buckets[listColumnBucket(el)].push(el);
    };
    try {
      // Force fresh roots so all 3 Debot MuiCards / GMGN columns are present.
      const gmgnRoots = isGmgnHost() && forceFreshRoots ? getMountedGmgnTrenchRoots() : [];
      const roots = gmgnRoots.length ? gmgnRoots : getScanRoots(forceFreshRoots);
      for (let ri = 0; ri < roots.length; ri += 1) {
        const root = roots[ri];
        if (!root || !root.querySelectorAll) continue;
        if (isGmgnHost()) {
          const cards = collectGmgnVisibleCardSeeds(root, 18);
          for (const item of cards) pushSeed(item.seed, item.card);
          continue;
        }
        const found = root.querySelectorAll(linkSel);
        for (let i = 0; i < found.length; i += 1) {
          const a = found[i];
          if (isDebotTickerChip(a)) continue;
          const row = a.closest?.('a[href*="/token/"]');
          const seed =
            row instanceof HTMLElement && isDebotTrenchRowCard(row) ? row : a;
          if (isDebotTickerChip(seed)) continue;
          pushSeed(seed, seed);
        }
        if (!isGmgnHost()) {
          // Debot fallback when href seeds are thin.
          const hrefCount = buckets[0].length + buckets[1].length + buckets[2].length;
          if (hrefCount < 10) {
            const leaves = root.querySelectorAll("span, a");
            const max = Math.min(leaves.length, 160);
            let taxAdded = 0;
            for (let i = 0; i < max && taxAdded < 16; i += 1) {
              const el = leaves[i];
              if (!(el instanceof HTMLElement)) continue;
              const t = (el.textContent || "").replace(/\s+/g, " ").trim();
              if (t.length > 16) continue;
              if (/^Tax\s*\d/i.test(t) || t === "Tax") {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.width < 120 && r.height > 0 && r.height < 28) {
                  pushSeed(el, `tax:${Math.round(r.top)}:${Math.round(r.left)}`);
                  taxAdded += 1;
                }
              }
            }
          }
        }
      }
    } catch (_err) {
      // ignore
    }
    // Round-robin: col0, col1, col2, col0, ...
    const out = [];
    const maxRows = Math.max(buckets[0].length, buckets[1].length, buckets[2].length);
    const startRow = maxRows > 0 ? rowOffset % maxRows : 0;
    let visitedRows = 0;
    while (out.length < cap && visitedRows < maxRows) {
      const idx = (startRow + visitedRows) % maxRows;
      let added = false;
      for (let b = 0; b < 3; b += 1) {
        if (idx < buckets[b].length) {
          out.push(buckets[b][idx]);
          added = true;
          if (out.length >= cap) break;
        }
      }
      if (!added) break;
      visitedRows += 1;
    }
    return out;
  }

  /** Resolve card + token from a list-return seed (href / Tax / short). */
  function resolveListReturnSeed(node) {
    if (!(node instanceof HTMLElement)) return null;
    let hrefTok = normalizeToken(
      (node.getAttribute && node.getAttribute("href")) || node.href || ""
    );
    if (!hrefTok && node.querySelector) {
      // div[href] / a[href] token routes (GMGN + Debot)
      const a = node.querySelector(
        "[href*='/token/'][href*='0x'], [href*='/bsc/token/'][href*='0x'], [href*='0x']"
      );
      if (a) {
        const h = a.getAttribute("href") || "";
        if (!/flap\.sh|bscscan|etherscan|lens\.google/i.test(h)) {
          hrefTok = normalizeToken(h);
        }
      }
    }
    // Prefer strategy findCard (Tax climb) — works when href climb fails.
    let card =
      (siteStrategy.findCard && siteStrategy.findCard(node)) ||
      (hrefTok
        ? quickClimbCardFromTokenLink(
            node.getAttribute?.("href")
              ? node
              : node.querySelector?.("[href*='0x']") || node
          )
        : null);
    if (!(card instanceof HTMLElement)) return null;
    const cr = card.getBoundingClientRect();
    if (cr.height < 56 || cr.height > window.innerHeight * 0.85) return null;
    let token = hrefTok;
    if (!token) token = siteStrategy.extractToken(card);
    if (!token) return null;
    if (!cardHrefAllowedForScan(card)) return null;
    return { card, token };
  }

  /** Visible badges per left/mid/right column. */
  function countVisibleBadgesByColumn() {
    const counts = [0, 0, 0];
    try {
      const icons = document.querySelectorAll(`[${ICON_DATA}="1"]`);
      const lim = Math.min(icons.length, 80);
      for (let i = 0; i < lim; i += 1) {
        const el = icons[i];
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) {
          continue;
        }
        counts[listColumnBucket(el)] += 1;
      }
    } catch (_err) {
      // ignore
    }
    return counts;
  }

  /**
   * 0.4.36/0.4.39 list-return burst: cache-first, Tax+href seeds, column round-robin.
   */
  function fastPaintListReturnViewport() {
    if (isTokenDetailRoute() || !isExtensionContextValid()) return 0;
    if (!tryFinishListReturnTransition("fast-paint")) return 0;
    const t0 = performance.now();
    let painted = 0;
    let queued = 0;
    const seen = new Set();
    // GMGN first-screen denser; Debot keeps conservative 12ms/16 cards.
    const fastCards = isGmgnHost()
      ? SPA_LIST_RETURN_FAST_CARDS_GMGN
      : SPA_LIST_RETURN_FAST_CARDS;
    const fastMs = isGmgnHost() ? SPA_LIST_RETURN_FAST_MS_GMGN : SPA_LIST_RETURN_FAST_MS;
    try {
      const seeds = collectListReturnAnchorsRoundRobin();
      for (let i = 0; i < seeds.length; i += 1) {
        if (painted >= fastCards) break;
        if (performance.now() - t0 > fastMs) break;
        const resolved = resolveListReturnSeed(seeds[i]);
        if (!resolved) continue;
        const { card, token } = resolved;
        // 0.4.51: NEVER dedupe by token — GMGN/Debot 三栏可同 CA，必须各画一枚。
        // Only skip the same card element (double seed → one paint).
        if (!token || !(card instanceof HTMLElement) || seen.has(card)) continue;
        seen.add(card);
        if (!isVisible(card)) continue;
        if (!cardHrefAllowedForScan(card)) continue;
        const entry = getEntryForCard(card, token);
        if (!entry) {
          if (paintLoadingBadgeAndQueue(card, token)) painted += 1;
          queued += 1;
          continue;
        }
        // Already painted?
        const existing = findLocalBadgeForCard(card, token);
        if (existing && existing.dataset.feeToken === token) {
          const er = existing.getBoundingClientRect();
          if (er.width >= 2 && er.height >= 2) {
            // 占位 / 掉到标题下一行 / 塞进 Tax 内芯 → 必须重挂
            if (
              existing.dataset.feeLoading === "1" ||
              isGmgnTrenchMisplacedBadge(card, existing)
            ) {
              if (paintListCardFromCacheFast(card, token, entry)) painted += 1;
            } else {
              painted += 1;
            }
            continue;
          }
        }
        if (paintListCardFromCacheFast(card, token, entry)) painted += 1;
      }
    } catch (_err) {
      // ignore
    }
    if (queued > 0) maybeFlushRequestQueue("list-return-fast");
    debugInfo("list-return:fast-paint", {
      painted,
      queued,
      ms: Math.round(performance.now() - t0)
    });
    return painted;
  }

  /**
   * Debot-only keep-alive. GMGN must NOT run this (0.4.39: 7s×350ms force-scan = 卡顿).
   * 0.8.63: Debot 同样跳过，改走 cache-first burst。
   */
  function armListReturnKeepAlive() {
    if (listReturnKeepAliveId) {
      window.clearTimeout(listReturnKeepAliveId);
      listReturnKeepAliveId = null;
    }
    if (isGmgnHost() || isDebotHost()) return;

    const until = Date.now() + SPA_LIST_RETURN_KEEPALIVE_MS;
    const tick = () => {
      listReturnKeepAliveId = null;
      if (!isExtensionContextValid() || !isTabVisible()) return;
      if (isTokenDetailRoute()) return;
      if (Date.now() > until) return;
      const vis = countVisibleBadges(80);
      if (vis >= listReturnEnoughBadges() && shouldCancelSpaListProgressive()) {
        return;
      }
      spaListReturnUntil = Math.max(spaListReturnUntil, Date.now() + 700);
      spaQuietUntil = 0;
      try {
        fastPaintListReturnViewport();
      } catch (_err) {
        // ignore
      }
      // Idle force — never stack immediate longtasks every tick.
      scheduleScan(0, {
        force: true,
        immediate: false,
        light: false,
        bypassForceGap: true
      });
      listReturnKeepAliveId = window.setTimeout(tick, SPA_LIST_RETURN_KEEPALIVE_TICK_MS);
    };
    listReturnKeepAliveId = window.setTimeout(tick, 400);
  }

  /**
   * Paint list badge from in-memory fee entry.
   * MUST use site natural mount (Debot metrics / GMGN Tax) — blind card.append 会位置乱飞.
   */
  function paintListCardFromCacheFast(card, token, entry) {
    if (!(card instanceof HTMLElement) || !token || !entry) return false;
    if (shouldDeferGmgnTrenchResizeWork()) return false;
    if (isBadgeMountForbidden(card)) {
      wipeForbiddenMountBadges(card, true);
      return false;
    }
    // 加载占位 / host-fee 未稳定：画 ⏳，禁止用 preview 当真徽章
    if (isFeeLoadingEntry(entry) || isHostFeeEntryPending(entry)) {
      return renderMode(card, token, FEE_LOADING_ENTRY);
    }
    // K→战壕 / 刷新后虚拟列表复用：强制重挂，避免 Tax 旁徽章漂到卡片中部
    if (
      (isSpaListReturnSoft() || isListReturnTransitionActive()) &&
      ((isGmgnHost() && isGmgnFixedTrenchCard(card)) || isDebotHost())
    ) {
      return renderMode(card, token, entry, { forceRemount: true });
    }
    // 行 CA 必须匹配 token，禁止用缓存画错行
    const idCa = extractCardHrefToken(card);
    if (idCa && idCa !== token) return false;
    if (idCa && !TARGET_TOKEN_RE.test(idCa)) return false;
    try {
      // 与 renderMode 一致：API → DOM → 链默认，禁止硬编码 BNB 造成先错后对
      const q = resolveQuoteSymbol(card, entry);
      const presentation = computeBadgePresentation(entry, q, token);
      const { label } = presentation;
      if (!label) return false;

      if (card.dataset[CARD_MARK] !== token) card.dataset[CARD_MARK] = token;
      try {
        card.setAttribute(CARD_DATA, token);
      } catch (_err) {
        // ignore
      }

      let icon = card.querySelector(`[${ICON_DATA}="1"]`);
      // 虚拟复用：DOM 上仍是别的 CA 的徽章 → 必须重挂，不能 in-place 改文案冒充
      if (icon && icon.dataset.feeToken && icon.dataset.feeToken !== token) {
        removeAllBadgesForCard(card, icon.dataset.feeToken);
        icon = null;
      }
      if (icon && icon.dataset.feeToken === token) {
        if (isGmgnTrenchMisplacedBadge(card, icon)) {
          removeAllBadgesForCard(card, token);
          icon = null;
        } else {
          // 仍是 ⏳ 且已有正式 entry → 允许换成真徽章
          const er = icon.getBoundingClientRect();
          if (er.width >= 2 && er.height >= 2) {
            applyBadgeUi(icon, presentation, token);
            return true;
          }
        }
      }

      // Prefer full renderMode so Debot metrics / GMGN Tax placement is correct.
      // (0.4.32 blind append caused 战壕徽章位置乱飞)
      const ok = renderMode(card, token, entry, { forceRemount: true });
      if (ok) return true;

      // GMGN: Tax 芯片就绪时快绘；无 Tax 时试代币名行（用户关闭 GMGN 税收展示）
      if (isGmgnHost()) {
        const taxMount = findTaxTag(card);
        if (taxMount instanceof HTMLElement) {
          removeAllBadgesForCard(card, token);
          icon = document.createElement("span");
          icon.dataset[ICON_MARK] = "1";
          icon.dataset.feePosMode = "default";
          applyBadgeUi(icon, presentation, token);
          try {
            placeGmgnListTaxBadge(taxMount, icon);
          } catch (_err2) {
            try {
              taxMount.appendChild(icon);
            } catch (_err3) {
              return false;
            }
          }
          const er = icon.getBoundingClientRect();
          return er.width >= 2 && er.height >= 2;
        }
        const nameMount = findGmgnTrenchNameMount(card);
        if (nameMount instanceof HTMLElement) {
          removeAllBadgesForCard(card, token);
          icon = document.createElement("span");
          icon.dataset[ICON_MARK] = "1";
          icon.dataset.feePosMode = "default";
          applyBadgeUi(icon, presentation, token);
          try {
            placeGmgnListNameBadge(nameMount, icon);
          } catch (_err2b) {
            try {
              nameMount.appendChild(icon);
            } catch (_err3b) {
              return false;
            }
          }
          const er = icon.getBoundingClientRect();
          return er.width >= 2 && er.height >= 2;
        }
        if (!isGmgnFixedTrenchCard(card)) {
          const fallback =
            findCompactRowMount(card) ||
            card.querySelector?.("a[href*='0x']")?.parentElement ||
            card.querySelector?.("a[href*='0x']");
          if (fallback instanceof HTMLElement) {
            removeAllBadgesForCard(card, token);
            icon = document.createElement("span");
            icon.dataset[ICON_MARK] = "1";
            icon.dataset.feePosMode = "default";
            applyBadgeUi(icon, presentation, token);
            try {
              placeBesideTaxChip(fallback, icon);
            } catch (_err4) {
              try {
                fallback.appendChild(icon);
              } catch (_err5) {
                return false;
              }
            }
            const er = icon.getBoundingClientRect();
            return er.width >= 2 && er.height >= 2;
          }
        }
      }

      // Absolute trench coords only when user enabled — never invent random top-left.
      const pos = getActiveBadgePosition(card);
      if (!pos.enabled) return false;

      removeAllBadgesForCard(card, token);
      icon = document.createElement("span");
      icon.dataset[ICON_MARK] = "1";
      applyBadgeUi(icon, presentation, token);
      ensureCardPositioning(card);
      card.appendChild(icon);
      applyAbsoluteBadgeStyles(icon, pos.x, pos.y);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Debot K→战壕：对齐 GMGN cache-first burst，禁止 keep-alive force 扫风暴。
   */
  function armDebotListReturnFastBurst() {
    if (!isDebotHost()) return;
    const ticks = [0, 40, 100, 200, 400, 700];
    ticks.forEach((ms) => {
      const timerId = window.setTimeout(() => {
        spaNavScanTimers = spaNavScanTimers.filter((id) => id !== timerId);
        if (!isDebotHost() || isTokenDetailRoute()) return;
        if (!isExtensionContextValid() || !isTabVisible()) return;
        try {
          fastPaintListReturnViewport();
        } catch (_err) {
          // ignore
        }
        if (ms >= 450 && !shouldCancelSpaListProgressive()) {
          scheduleScan(0, {
            force: true,
            immediate: false,
            light: false,
            bypassForceGap: true
          });
        }
      }, ms);
      spaNavScanTimers.push(timerId);
    });
  }

  /** Debot K→战壕列根就绪后再补洞（对齐 GMGN fill ticks）。 */
  function armDebotListReturnFillTicks() {
    if (!isDebotHost()) return;
    SPA_LIST_RETURN_FILL_DEBOT_MS.forEach((ms) => {
      const timerId = window.setTimeout(() => {
        spaNavScanTimers = spaNavScanTimers.filter((id) => id !== timerId);
        if (!isDebotHost() || isTokenDetailRoute()) return;
        if (!isExtensionContextValid() || !isTabVisible()) return;
        if (shouldCancelSpaListProgressive()) return;
        spaListReturnUntil = Math.max(spaListReturnUntil, Date.now() + 400);
        spaQuietUntil = 0;
        try {
          fastPaintListReturnViewport();
        } catch (_err) {
          // ignore
        }
        scheduleScan(0, {
          force: true,
          immediate: false,
          light: false,
          bypassForceGap: true
        });
      }, ms);
      spaNavScanTimers.push(timerId);
    });
  }

  /**
   * GMGN-only: cache-first paint ticks after K→战壕 (NO force scan / NO keep-alive).
   */
  function armGmgnListReturnFastBurst() {
    if (!isGmgnHost()) return;
    SPA_LIST_RETURN_FAST_BURST_GMGN_MS.forEach((ms) => {
      const timerId = window.setTimeout(() => {
        spaNavScanTimers = spaNavScanTimers.filter((id) => id !== timerId);
        if (!isGmgnHost() || isTokenDetailRoute()) return;
        if (!isExtensionContextValid() || !isTabVisible()) return;
        try {
          fastPaintListReturnViewport();
        } catch (_err) {
          // ignore
        }
        // If first screen incomplete after early bursts, idle force one hole-fill.
        if (ms >= 450 && !shouldCancelSpaListProgressive()) {
          scheduleScan(0, {
            force: true,
            immediate: false,
            light: false,
            bypassForceGap: true
          });
        }
      }, ms);
      spaNavScanTimers.push(timerId);
    });
  }

  /**
   * 0.4.49: late fill after host virtual-list settles (js-mcp: sometimes stuck ~10–12 for 2s).
   * Only runs while still on list; stops once multi-col density OK.
   */
  function armGmgnListReturnFillTicks() {
    if (!isGmgnHost()) return;
    SPA_LIST_RETURN_FILL_GMGN_MS.forEach((ms) => {
      const timerId = window.setTimeout(() => {
        spaNavScanTimers = spaNavScanTimers.filter((id) => id !== timerId);
        if (!isGmgnHost() || isTokenDetailRoute()) return;
        if (!isExtensionContextValid() || !isTabVisible()) return;
        if (shouldCancelSpaListProgressive()) return;
        spaListReturnUntil = Math.max(spaListReturnUntil, Date.now() + 400);
        spaQuietUntil = 0;
        try {
          fastPaintListReturnViewport();
        } catch (_err) {
          // ignore
        }
        scheduleScan(0, {
          force: true,
          immediate: false,
          light: false,
          bypassForceGap: true
        });
      }, ms);
      spaNavScanTimers.push(timerId);
    });
  }

  /** Count visible painted badges (for list progressive early-stop). */
  function countVisibleBadges(maxCheck = 40) {
    let n = 0;
    try {
      const icons = document.querySelectorAll(`[${ICON_DATA}="1"]`);
      const lim = Math.min(icons.length, maxCheck);
      for (let i = 0; i < lim; i += 1) {
        const el = icons[i];
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < window.innerHeight) {
          n += 1;
        }
      }
    } catch (_err) {
      return 0;
    }
    return n;
  }

  /** List progressive: enough first-screen badges → stop further force passes. */
  function shouldCancelSpaListProgressive() {
    if (isTokenDetailRoute()) return false;
    if (!isSpaListReturnSoft() && !spaSettleFromToken) return false;
    const enough = listReturnEnoughBadges();
    const total = countVisibleBadges(isGmgnHost() ? 40 : 80);
    if (total >= enough * 2) return true;
    // 0.4.36: do NOT stop when only left/mid columns are painted (Debot 已迁移 starve).
    const cols = countVisibleBadgesByColumn();
    const covered = cols.filter((n) => n >= SPA_LIST_RETURN_MIN_PER_COL).length;
    // Need at least 2 columns covered with min badges, or all 3 if total is modest.
    if (covered >= 3 && total >= enough) return true;
    if (covered >= 2 && total >= enough) return true;
    // 0.4.49 GMGN: require enough AND multi-column — total alone left mid/right empty for 2s.
    if (isGmgnHost() && total >= enough && covered >= 2) return true;
    return false;
  }

  /**
   * Stable SPA route key. Ignore volatile `ref=` so only real path/tab/chain changes fire.
   * js-mcp: GMGN logo → `/?chain=bsc&ref=…&tab=home` from `/bsc/token/0x…`.
   * Debot: `/token/bsc/249218_0x…` and `/token/bsc/0x…` are the same page — normalize
   * or each rewrite re-fires settle and wipe badges (resetOurDomMarks thrash).
   */
  function normalizeRoutePathname(pathname) {
    let path = String(pathname || "/");
    // Debot/Gungnir token: /token/{chain}/{optionalDigits_}{0xCA}
    path = path.replace(
      /(\/token\/[a-z0-9]+\/)\d+_(0x[a-fA-F0-9]{40})/i,
      "$1$2"
    );
    return path;
  }

  function getRouteKey() {
    try {
      const u = new URL(location.href);
      const chain = u.searchParams.get("chain") || "";
      const tab = u.searchParams.get("tab") || "";
      const path = normalizeRoutePathname(u.pathname);
      // pathname drives token↔list; chain/tab distinguish boards.
      return `${path}|c=${chain}|t=${tab}`;
    } catch (_err) {
      return `${normalizeRoutePathname(location.pathname)}${location.search}`;
    }
  }

  /** CA from a route key or path string (8888/7777/ffff only). */
  function extractTokenFromRouteKey(keyOrPath) {
    const m = String(keyOrPath || "").match(/0x[a-fA-F0-9]{40}/i);
    if (!m) return null;
    const token = m[0].toLowerCase();
    return TARGET_TOKEN_RE.test(token) ? token : null;
  }

  /**
   * SPA: token detail ↔ list (GMGN / Debot / Gungnir) keeps the content script alive but rebuilds DOM.
   * Soft route change — NOT tab resume (no force-remount storm).
   * Work is deferred out of history.pushState stack to avoid nav jank.
   *
   * js-mcp finding: GMGN may capture native history before our wrap → pushState hook silent.
   * 0.4.27: page-world hook (postMessage) + route poller + path-poll inside scan.
   */
  function installHistoryHooks() {
    const fire = (reason) => {
      try {
        onSpaRouteChange(reason);
      } catch (_err) {
        // ignore
      }
    };
    const wrap = (type) => {
      const orig = history[type];
      if (typeof orig !== "function") return;
      history[type] = function wrappedHistory() {
        const ret = orig.apply(this, arguments);
        fire(type);
        return ret;
      };
    };
    wrap("pushState");
    wrap("replaceState");

    // Cross-world SPA signal from page-hook.js (main world).
    window.addEventListener("message", (event) => {
      try {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== "flap-fee-info" || data.type !== "spa") return;
        fire(`page-hook:${data.reason || "spa"}`);
      } catch (_err) {
        // ignore
      }
    });
  }

  const PAGE_HOOK_VER = "104";
  const PAGE_HOOK_INJECT_LOCK_ATTR = "data-flap-page-hook-inject-at";
  let pageHookBgInjectSent = false;

  function pageHookHostFeeReady() {
    try {
      return (
        document.documentElement?.getAttribute?.("data-flap-host-fee-ver") ===
        PAGE_HOOK_VER
      );
    } catch (_ph) {
      return false;
    }
  }

  function pageHookScriptPresent() {
    try {
      return (
        document.documentElement?.getAttribute?.("data-flap-page-hook-ver") ===
        PAGE_HOOK_VER
      );
    } catch (_ps) {
      return false;
    }
  }

  function pageHookMainReady() {
    return pageHookHostFeeReady();
  }

  function noteGmgnHostFeeSeen() {
    if (!gmgnHostFeeSeenAt) gmgnHostFeeSeenAt = Date.now();
  }

  function noteDebotHostFeeSeen() {
    if (!debotHostFeeSeenAt) debotHostFeeSeenAt = Date.now();
  }

  /** GMGN 战壕 / Debot /meme：host-fee 就绪前不 flush /modes */
  function needsHostTaxFeedPoll() {
    if (!isAllowedScanChain()) return false;
    if (isGmgnHost() && !isTokenDetailRoute()) return true;
    if (isDebotHost() && isTrenchListPage()) return true;
    return false;
  }

  function gmgnHostTaxFeedReady() {
    if (!isGmgnHost() || isTokenDetailRoute()) return true;
    if (!isAllowedScanChain()) return true;
    if (gmgnHostFeeSeenAt > 0) return true;
    if (gmgnTaxDomSeen) return true;
    try {
      if (document.querySelector(".trenches-tax")) {
        gmgnTaxDomSeen = true;
        return true;
      }
    } catch (_tax) {
      // ignore
    }
    if (Date.now() - hostListBootAt >= HOST_TAX_FEED_MAX_WAIT_MS) return true;
    return false;
  }

  function debotHostTaxFeedReady() {
    if (!isDebotHost() || !isTrenchListPage()) return true;
    if (!isAllowedScanChain()) return true;
    if (debotHostFeeSeenAt > 0) return true;
    if (debotRanksDoneAt > 0) return true;
    if (debotPoolDomSeen) return true;
    try {
      if (document.querySelector('[aria-label*="流动池"]')) {
        debotPoolDomSeen = true;
        return true;
      }
    } catch (_pool) {
      // ignore
    }
    if (Date.now() - hostListBootAt >= HOST_TAX_FEED_MAX_WAIT_MS) return true;
    return false;
  }

  function hostTaxFeedReady() {
    if (isGmgnHost() && !isTokenDetailRoute()) return gmgnHostTaxFeedReady();
    if (isDebotHost() && isTrenchListPage()) return debotHostTaxFeedReady();
    return true;
  }

  function scheduleHostTaxFeedRetry(reason) {
    if (!needsHostTaxFeedPoll()) return;
    if (hostTaxFeedReady()) {
      if (requestQueue.size > 0) maybeFlushRequestQueue(reason || "host-tax-feed");
      return;
    }
    if (hostTaxFeedRetryTimer) return;
    hostTaxFeedRetryTimer = window.setTimeout(() => {
      hostTaxFeedRetryTimer = 0;
      if (requestQueue.size === 0) return;
      if (!hostTaxFeedReady()) {
        scheduleHostTaxFeedRetry(reason);
        return;
      }
      maybeFlushRequestQueue(reason || "host-tax-feed");
    }, HOST_TAX_FEED_RETRY_MS);
  }

  function cancelHostFeeGraceFlush() {
    if (hostFeeGraceTimer) {
      window.clearTimeout(hostFeeGraceTimer);
      hostFeeGraceTimer = 0;
    }
  }

  function scheduleHostFeeGraceFlush(reason) {
    if (!pageHookHostFeeReady()) {
      maybeFlushRequestQueue(reason || "queue");
      return;
    }
    if (needsHostTaxFeedPoll() && !hostTaxFeedReady()) {
      scheduleHostTaxFeedRetry(reason || "grace");
      return;
    }
    if (hostFeeGraceTimer) return;
    hostFeeGraceTimer = window.setTimeout(() => {
      hostFeeGraceTimer = 0;
      maybeFlushRequestQueue(reason || "host-fee-grace");
    }, HOST_FEE_GRACE_MS);
  }

  function requestBackgroundPageHookInject() {
    if (pageHookBgInjectSent) return;
    if (!isExtensionContextValid() || !chrome.runtime?.sendMessage) return;
    pageHookBgInjectSent = true;
    try {
      chrome.runtime.sendMessage({ type: "flap-inject-page-hook" }, () => {
        void chrome.runtime?.lastError;
      });
    } catch (_msg) {
      // ignore
    }
  }

  /** 仅当 manifest/bootstrap 都失败时由 content 单次兜底；禁止与 bootstrap 并发插 script */
  function installPageWorldSpaHook() {
    if (pageHookHostFeeReady()) return;
    if (pageHookScriptPresent()) return;
    try {
      const lockAt = Number(
        document.documentElement?.getAttribute?.(PAGE_HOOK_INJECT_LOCK_ATTR) || 0
      );
      if (lockAt && Date.now() - lockAt < 3000) return;
    } catch (_lk) {
      // ignore
    }
    if (!isExtensionContextValid() || !chrome.runtime?.getURL) return;
    try {
      document.documentElement?.setAttribute(
        PAGE_HOOK_INJECT_LOCK_ATTR,
        String(Date.now())
      );
    } catch (_m) {
      // ignore
    }
    const src = chrome.runtime.getURL("page-hook.js");
    try {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => {
        try {
          s.remove();
        } catch (_e) {
          // ignore
        }
      };
      s.onerror = () => {
        try {
          s.remove();
        } catch (_e2) {
          // ignore
        }
        try {
          document.documentElement?.removeAttribute(PAGE_HOOK_INJECT_LOCK_ATTR);
        } catch (_c) {
          // ignore
        }
      };
      (document.documentElement || document.head || document.body).appendChild(s);
    } catch (_err) {
      // ignore
    }
  }

  function startPageHookGuardian() {
    window.setTimeout(() => {
      if (!isExtensionContextValid()) return;
      if (pageHookHostFeeReady()) return;
      if (!pageHookScriptPresent()) installPageWorldSpaHook();
    }, 1500);
    window.setTimeout(() => {
      if (!isExtensionContextValid()) return;
      if (pageHookHostFeeReady()) return;
      requestBackgroundPageHookInject();
    }, 4500);
  }

  /** Independent of history hooks / mutation observer (survives detached roots). */
  function startRoutePoller() {
    if (routePollId) return;
    const tick = () => {
      routePollId = null;
      if (!isExtensionContextValid()) return;
      if (isTabVisible()) {
        try {
          onSpaRouteChange("route-poll");
        } catch (_err) {
          // ignore
        }
      }
      routePollId = window.setTimeout(
        tick,
        isTabVisible() ? ROUTE_POLL_MS : TOKEN_GUARDIAN_HIDDEN_MS
      );
    };
    routePollId = window.setTimeout(tick, ROUTE_POLL_MS);
  }

  /**
   * Always-on Debot/Gungnir token header painter.
   * Does NOT depend on SPA route detection — fixes browsers where history wrap is silent
   * and progressive settle never arms (user: one browser OK, another needs hard refresh).
   * 0.4.28: also paints during spa quiet; click-arm window forces work after /token/ click.
   */
  /**
   * GMGN multi-panel (战壕|K线): keep trying header address badge + side list scan.
   * Fixes browsers where first tryPaint fails and never retries (user: one OK, one empty).
   */
  /**
   * 0.5.9: Watch the official token-base-address row. GMGN React often replaces
   * children and drops our afterend badge — re-paint without full list thrash.
   */
  function nodeMatchesOrContains(node, selector) {
    if (!(node instanceof Element)) return false;
    try {
      return node.matches?.(selector) || !!node.querySelector?.(selector);
    } catch (_err) {
      return false;
    }
  }

  function gmgnHeaderMutationLooksRelevant(records, token) {
    if (!records || !records.length || !token) return false;
    const badgeSelector =
      `[${ICON_DATA}="1"][data-fee-header="1"][data-fee-token="${token}"]`;
    const addressSelector =
      `#token-base-address, [data-addr="${token}"], [data-addr="${token.toLowerCase()}"]`;
    for (const record of records) {
      const target = record?.target;
      if (nodeMatchesOrContains(target, addressSelector)) return true;
      for (const node of record?.removedNodes || []) {
        if (
          nodeMatchesOrContains(node, badgeSelector) ||
          nodeMatchesOrContains(node, addressSelector)
        ) {
          return true;
        }
      }
      for (const node of record?.addedNodes || []) {
        if (nodeMatchesOrContains(node, addressSelector)) return true;
      }
    }
    return false;
  }

  function scheduleGmgnHeaderRepair(reason, delay = 0) {
    if (shouldDeferGmgnTrenchResizeWork()) return;
    if (gmgnHeaderRepairTimer) return;
    gmgnHeaderRepairTimer = window.setTimeout(() => {
      gmgnHeaderRepairTimer = null;
      if (!isExtensionContextValid() || !isTabVisible() || !isGmgnTokenPage()) return;
      if (shouldDeferGmgnTrenchResizeWork()) return;
      if (hasGmgnTokenHeaderBadge()) return;
      tryPaintGmgnTokenHeader(reason);
    }, delay);
  }

  function armGmgnHeaderDomWatch() {
    if (!isGmgnHost() || !isGmgnTokenPage()) return;
    const urlTok = extractTokenFromUrl();
    if (!urlTok) return;
    // The always-on document observer owns targeted header repair. Keeping a second
    // document-wide observer here doubled mutation delivery on chart-heavy token pages.
    if (!hasGmgnTokenHeaderBadge()) scheduleGmgnHeaderRepair("header-watch-arm", 80);
  }

  function stopGmgnHeaderDomWatch() {
    if (gmgnHeaderRepairTimer) {
      window.clearTimeout(gmgnHeaderRepairTimer);
      gmgnHeaderRepairTimer = null;
    }
  }

  function startGmgnTokenGuardian() {
    if (gmgnTokenGuardianId) return;
    const BASE_MS = 700;
    const scheduleNext = (ms) => {
      gmgnTokenGuardianId = window.setTimeout(tick, ms);
    };
    const tick = () => {
      gmgnTokenGuardianId = null;
      let nextMs = BASE_MS;
      try {
        if (!isExtensionContextValid()) return;
        if (!isTabVisible()) {
          scheduleNext(TOKEN_GUARDIAN_HIDDEN_MS);
          return;
        }
        const rk = getRouteKey();
        if (rk !== lastRouteKey) {
          try {
            onSpaRouteChange("gmgn-guardian-route");
          } catch (_err) {
            // ignore
          }
        }
        if (!isGmgnTokenPage()) {
          gmgnHeaderMissSince = 0;
          stopGmgnHeaderDomWatch();
          nextMs = TOKEN_GUARDIAN_HEALTHY_MS;
        } else {
          const urlTok = extractTokenFromUrl();
          if (!urlTok) {
            gmgnHeaderMissSince = 0;
          } else if (hasGmgnTokenHeaderBadge()) {
            gmgnHeaderMissSince = 0;
            armGmgnHeaderDomWatch();
            // 顶栏已稳：补画侧栏新创建/新进 CA（light-scan 不含战壕列）。
            try {
              paintUnpaintedTargetViewportQuick("token-guardian", null, true);
            } catch (_trenchKick) {
              // ignore
            }
            nextMs = 900;
          } else {
            if (!gmgnHeaderMissSince) gmgnHeaderMissSince = Date.now();
            const missAge = Date.now() - gmgnHeaderMissSince;
            queueToken(urlTok);
            const entry = resolveEntry(urlTok);
            if (!entry) {
              recoverStuckBatch(false);
              scheduleBatchFlush({ immediate: true, delayMs: 0 });
              nextMs = missAge > 6000 ? 4000 : 1800;
            } else if (isTokenEnterPaintGraceActive()) {
              nextMs = Math.max(100, tokenEnterPaintAfter - Date.now() + 20);
            } else {
              tryPaintGmgnTokenHeader("gmgn-guardian");
              armGmgnHeaderDomWatch();
              if (missAge > 15000) nextMs = 2800;
              else if (missAge > 6000) nextMs = 1200;
              else nextMs = BASE_MS;
            }
          }
        }
      } catch (_err) {
        // ignore
      }
      if (isExtensionContextValid()) scheduleNext(nextMs);
    };
    scheduleNext(250);
  }

  function startDebotTokenGuardian() {
    if (debotTokenGuardianId) return;
    const scheduleNext = (ms) => {
      debotTokenGuardianId = window.setTimeout(runGuardianTick, ms);
    };
    const runGuardianTick = () => {
      debotTokenGuardianId = null;
      let nextMs = DEBOT_TOKEN_GUARDIAN_MS;
      try {
        if (!isExtensionContextValid()) return;
        if (!isTabVisible()) {
          scheduleNext(TOKEN_GUARDIAN_HIDDEN_MS);
          return;
        }
        const rk = getRouteKey();
        if (rk !== lastRouteKey) {
          onSpaRouteChange("guardian-route");
        }
        if (!isDebotTokenPage()) {
          debotHeaderMissStreak = 0;
          debotHeaderMissSince = 0;
          nextMs = TOKEN_GUARDIAN_HEALTHY_MS;
        } else {
          const urlTok = extractTokenFromUrl();
          if (!urlTok) {
            debotHeaderMissStreak = 0;
            debotHeaderMissSince = 0;
          } else if (hasDebotTokenHeaderBadge()) {
            debotHeaderMissStreak = 0;
            debotHeaderMissSince = 0;
            nextMs = TOKEN_GUARDIAN_HEALTHY_MS;
          } else {
            if (!debotHeaderMissSince) debotHeaderMissSince = Date.now();
            debotHeaderMissStreak += 1;
            const missAge = Date.now() - debotHeaderMissSince;
            // Ensure API in flight (js-mcp: 0 badge often = never queued / stuck batch).
            queueToken(urlTok);
            if (debotHeaderMissStreak === 1 || debotHeaderMissStreak % 3 === 0) {
              recoverStuckBatch(false);
              scheduleBatchFlush({ immediate: true, delayMs: 0 });
            }
            const entry = resolveEntry(urlTok);
            if (!entry) {
              nextMs = missAge > 5000 ? 4000 : 1800;
            } else if (isTokenEnterPaintGraceActive()) {
              nextMs = Math.max(100, tokenEnterPaintAfter - Date.now() + 20);
            } else {
              tryPaintDebotTokenHeader("guardian");
              // Backoff while the real address row is still missing.
              if (missAge > 12000) nextMs = 4000;
              else if (missAge > 5000) nextMs = 2500;
              else nextMs = DEBOT_TOKEN_GUARDIAN_MS;
            }
          }
        }
      } catch (_err) {
        // ignore
      }
      if (isExtensionContextValid()) scheduleNext(nextMs);
    };
    scheduleNext(DEBOT_TOKEN_GUARDIAN_MS);
  }

  /**
   * Debot often navigates without history.pushState (js-mcp: eventCount=0 on click).
   * Capture token-link clicks AND card clicks that contain token hrefs (SPA activation).
   * Also accelerate list-return when clicking 战壕/meme.
   */
  function installDebotTokenClickArm() {
    const host = location.hostname || "";
    if (!host.endsWith("debot.ai") && !host.endsWith("gungnir.bot")) return;

    const armTokenPaint = (reasonPrefix) => {
      armTokenEnterTransition();
      debotTokenClickArmUntil = Date.now() + DEBOT_TOKEN_CLICK_ARM_MS;
      armDebotHeaderDomWatch();
      const kick = (ms, reason) => {
        window.setTimeout(() => {
          if (!isExtensionContextValid() || !isTabVisible()) return;
          try {
            onSpaRouteChange(`${reasonPrefix}:${reason}`);
          } catch (_err) {
            // ignore
          }
          if (!isDebotTokenPage()) return;
          const urlTok = extractTokenFromUrl();
          if (!urlTok) return;
          if (hasDebotTokenHeaderBadge()) {
            stopDebotHeaderDomWatch();
            return;
          }
          armDebotTokenHeaderWatch();
          tryPaintDebotTokenHeader(`${reasonPrefix}:${reason}`);
        }, ms);
      };
      // Header-only retries; the outgoing trench is left untouched.
      kick(280, "280");
      kick(700, "700");
      kick(1200, "1200");
      kick(2200, "2200");
      kick(4000, "4000");
    };

    const armListReturnPaint = () => {
      armListReturnSoftWindow("debot-list-return-click");
    };

    document.addEventListener(
      "click",
      (event) => {
        try {
          if (!isExtensionContextValid()) return;
          if (
            event instanceof MouseEvent &&
            (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          ) {
            return;
          }
          const t = event.target;
          if (!(t instanceof Element)) return;

          // --- Return to 战壕 / meme ---
          const memeA = t.closest?.('a[href*="/meme"]');
          const memeText =
            t.closest?.("a,button,[role='tab']") &&
            /战壕|meme|trench/i.test(
              (t.closest("a,button,[role='tab']")?.textContent || "").trim()
            );
          if (memeA || memeText) {
            if (isDebotTokenPage() || routeKeyWasTokenDetail(lastRouteKey)) {
              armListReturnPaint();
            }
            return;
          }

          // --- Enter token K-line ---
          let href = "";
          const a = t.closest?.('a[href*="/token/"], a[href*="0x"]');
          if (a instanceof HTMLAnchorElement) {
            href = a.getAttribute("href") || a.href || "";
          } else {
            // Card click: find nested token link (Debot often wraps whole card).
            const card = t.closest?.(
              ".MuiCard-root, .MuiPaper-root, [class*='Card'], li, article"
            );
            if (card) {
              const inner = card.querySelector?.(
                'a[href*="/token/"][href*="7777"], a[href*="/token/"][href*="8888"], a[href*="/token/"][href*="ffff"], ' +
                  'a[href*="0x"][href*="7777"], a[href*="0x"][href*="8888"], a[href*="0x"][href*="ffff"]'
              );
              if (inner) href = inner.getAttribute("href") || inner.href || "";
            }
          }
          if (!href) return;
          if (!/\/token\//i.test(href) && !/0x[a-fA-F0-9]{40}/i.test(href)) return;
          const m = href.match(/0x[a-fA-F0-9]{40}/i);
          if (m && !TARGET_TOKEN_RE.test(m[0].toLowerCase())) return;
          armTokenPaint("click-arm");
        } catch (_err) {
          // ignore
        }
      },
      true
    );
  }

  /**
   * Shared list-return kick: soft window + dense fastPaint + DOM watch.
   * Used by Debot + GMGN click-arm (0.4.37 GMGN 回战壕加速).
   */
  function armListReturnSoftWindow(reason) {
    // 0.4.41: GMGN never uses soft-window kicks — pure 0.4.22 progressive via route settle.
    if (isGmgnHost()) return;
    armListReturnTransition(reason);

    const softMs = listReturnSoftDurationMs();
    spaListReturnUntil = Date.now() + softMs;
    spaListReturnCacheOnlyUntil = Date.now() + SPA_LIST_RETURN_CACHE_ONLY_MS;
    spaQuietUntil = 0;
    spaSettleFromToken = true;
    const kick = (ms, immediate) => {
      window.setTimeout(() => {
        if (!isExtensionContextValid() || !isTabVisible()) return;
        if (isTokenDetailRoute()) return;
        try {
          onSpaRouteChange(reason);
        } catch (_err) {
          // ignore
        }
        spaQuietUntil = 0;
        spaListReturnUntil = Date.now() + softMs;
        try {
          fastPaintListReturnViewport();
        } catch (_err) {
          // ignore
        }
        scheduleScan(0, {
          force: true,
          immediate: immediate === true,
          light: false,
          bypassForceGap: true
        });
      }, ms);
    };
    kick(0, true);
    kick(120, false);
    kick(400, false);
    kick(1000, false);
    kick(2000, false);
  }

  /** When war-room columns mount late after token→list, re-fastPaint (throttled). */
  function armListReturnDomWatch() {
    stopListReturnDomWatch();
    const watchMs = listReturnDomWatchMs();
    const watchStart = Date.now();
    listReturnDomObsUntil = watchStart + watchMs;
    listReturnDomObsLastAt = 0;
    // Debot: steady 200ms. GMGN: early dense (60ms) then back off (0.4.46).
    const throttleForNow = () => {
      if (!isGmgnHost()) return 200;
      const age = Date.now() - watchStart;
      return age < LIST_RETURN_DOM_WATCH_GMGN_EARLY_MS
        ? LIST_RETURN_DOM_WATCH_GMGN_EARLY_THROTTLE_MS
        : LIST_RETURN_DOM_WATCH_GMGN_THROTTLE_MS;
    };
    try {
      listReturnDomObs = new MutationObserver(() => {
        if (!isExtensionContextValid()) {
          stopListReturnDomWatch();
          return;
        }
        if (Date.now() > listReturnDomObsUntil || isTokenDetailRoute()) {
          stopListReturnDomWatch();
          return;
        }
        const now = Date.now();
        if (now - listReturnDomObsLastAt < throttleForNow()) return;
        listReturnDomObsLastAt = now;
        spaListReturnUntil = Math.max(spaListReturnUntil, now + 500);
        spaQuietUntil = 0;
        try {
          fastPaintListReturnViewport();
        } catch (_err) {
          // ignore
        }
        if (shouldCancelSpaListProgressive()) stopListReturnDomWatch();
      });
      listReturnDomObs.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      window.setTimeout(() => stopListReturnDomWatch(), watchMs + 80);
    } catch (_err) {
      listReturnDomObs = null;
    }
  }

  function stopListReturnDomWatch() {
    if (listReturnDomObs) {
      try {
        listReturnDomObs.disconnect();
      } catch (_err) {
        // ignore
      }
      listReturnDomObs = null;
    }
    listReturnDomObsLastAt = 0;
    listReturnDomObsUntil = 0;
  }

  /**
   * GMGN SPA: 0.4.41 — NO multi-kick / list-return soft storm (was remaining jank vs 0.4.22).
   * Route poll + history/page-hook already drive settle. Optional single delayed header tryPaint.
   */
  function installGmgnSpaClickArm() {
    const host = location.hostname || "";
    if (!host.endsWith("gmgn.ai")) return;

    /** K→战壕: pre-arm soft + cache paint WITHOUT Debot-style keep-alive force storm. */
    const armGmgnListReturnFromClick = () => {
      // Only when leaving a token/K-line page.
      if (!isGmgnTokenPage() && !routeKeyWasTokenDetail(lastRouteKey)) return;
      armListReturnTransition("gmgn-list-return-click");
      const softMs = listReturnSoftDurationMs();
      spaListReturnUntil = Date.now() + softMs;
      spaListReturnCacheOnlyUntil = Date.now() + SPA_LIST_RETURN_CACHE_ONLY_MS;
      spaQuietUntil = 0;
      spaSettleFromToken = true;
      // Immediate + delayed fastPaint only (0.4.46: no force scan on click — host longtask peak).
      const paintKick = (ms) => {
        window.setTimeout(() => {
          if (!isExtensionContextValid() || !isTabVisible()) return;
          if (isTokenDetailRoute()) return;
          try {
            onSpaRouteChange("gmgn-list-return-click");
          } catch (_err) {
            // ignore
          }
          spaQuietUntil = 0;
          spaListReturnUntil = Math.max(spaListReturnUntil, Date.now() + softMs);
          try {
            fastPaintListReturnViewport();
          } catch (_err2) {
            // ignore
          }
          // Delayed idle scan once columns exist (not immediate force).
          if (ms === 280) {
            scheduleScan(0, {
              force: true,
              immediate: false,
              light: false,
              bypassForceGap: true
            });
          }
        }, ms);
      };
      paintKick(0);
      paintKick(40);
      paintKick(120);
      paintKick(280);
    };

    document.addEventListener(
      "click",
      (event) => {
        try {
          if (!isExtensionContextValid()) return;
          if (
            event instanceof MouseEvent &&
            (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          ) {
            return;
          }
          const t = event.target;
          if (!(t instanceof Element)) return;

          // --- Return to 战壕 / home (browser back / nav tab / logo) ---
          const homeA = t.closest?.(
            'a[href="/"], a[href="/?"], a[href*="tab=home"], a[href*="chain=bsc"], a[href*="/bsc"]'
          );
          const homeText =
            t.closest?.("a,button,[role='tab'],[role='button']") &&
            /战壕|trench|home|新创建|已开盘/i.test(
              (t.closest("a,button,[role='tab'],[role='button']")?.textContent || "")
                .toString()
                .trim()
                .slice(0, 24)
            );
          // Avoid treating token-card clicks as home.
          const isTokenLink = !!t.closest?.('a[href*="/token/"]');
          if ((homeA || homeText) && !isTokenLink) {
            if (isGmgnTokenPage() || routeKeyWasTokenDetail(lastRouteKey)) {
              armGmgnListReturnFromClick();
            }
            return;
          }

          // Token enter: one delayed tryPaint only (do NOT force-scan columns).
          let href = "";
          const a = t.closest?.('a[href*="/token/"]');
          if (a instanceof HTMLAnchorElement) {
            href = a.getAttribute("href") || a.href || "";
          }
          if (!href || !/\/token\//i.test(href)) return;
          const m = href.match(/0x[a-fA-F0-9]{40}/i);
          if (m && !TARGET_TOKEN_RE.test(m[0].toLowerCase())) return;
          armTokenEnterTransition();
          window.setTimeout(() => {
            if (!isExtensionContextValid() || !isTabVisible()) return;
            if (!isGmgnTokenPage()) return;
            if (hasGmgnTokenHeaderBadge()) return;
            tryPaintGmgnTokenHeader("gmgn-click-once");
          }, 280);
        } catch (_err) {
          // ignore
        }
      },
      true
    );

    // Browser Back from K-line often has no click target — popstate already handled;
    // also arm soft when history pops token→list (history hooks may lag 1 frame).
    window.addEventListener(
      "popstate",
      () => {
        try {
          if (!isExtensionContextValid()) return;
          // Defer one microtask so location is updated.
          window.setTimeout(() => {
            if (!isExtensionContextValid() || !isTabVisible()) return;
            if (isTokenDetailRoute()) return;
            if (!spaSettleFromToken && !routeKeyWasTokenDetail(lastRouteKey)) {
              // If lastRouteKey already flipped by poll, still paint if soft not armed.
              if (!isSpaListReturnSoft()) return;
            }
            if (isGmgnHost() && !isTokenDetailRoute()) {
              spaListReturnUntil = Math.max(
                spaListReturnUntil,
                Date.now() + listReturnSoftDurationMs()
              );
              spaListReturnCacheOnlyUntil = Math.max(
                spaListReturnCacheOnlyUntil,
                Date.now() + SPA_LIST_RETURN_CACHE_ONLY_MS
              );
              try {
                fastPaintListReturnViewport();
              } catch (_err) {
                // ignore
              }
            }
          }, 0);
        } catch (_err) {
          // ignore
        }
      },
      true
    );
  }

  /**
   * Pre-arm overlay-fast on search UI click (before panel fully mounts).
   * 0.4.41: GMGN only marks overlay window (no multi-kick arm); Debot keeps denser arm.
   */
  function installOverlayOpenArm() {
    document.addEventListener(
      "click",
      (event) => {
        try {
          if (!isExtensionContextValid()) return;
          const t = event.target;
          if (!(t instanceof Element)) return;
          const inp = t.closest?.(
            'input[placeholder*="搜索"], input[placeholder*="合约"], input[placeholder*="KOL"], input[type="search"]'
          );
          const searchBtn =
            t.closest?.("button, [role='button'], a") &&
            /搜索|search|历史/i.test(
              (
                t.closest("button, [role='button'], a")?.getAttribute?.("aria-label") ||
                t.closest("button, [role='button'], a")?.textContent ||
                ""
              )
                .toString()
                .slice(0, 24)
            );
          // Do NOT match bare header SVG (false positives → overlay storm on GMGN).
          if (!inp && !searchBtn) return;
          overlayFastUntil = Date.now() + OVERLAY_FAST_MS;
          overlayDetectCache = { at: 0, open: false };
          if (isGmgnHost() || isDebotHost()) {
            scheduleGmgnOverlayPaint("click-search", 150, true);
            return;
          }
          window.setTimeout(() => {
            if (!isExtensionContextValid() || !isTabVisible()) return;
            if (quickHasOpenOverlay()) armOverlayFastScan("click-search");
          }, 60);
          window.setTimeout(() => {
            if (!isExtensionContextValid() || !isTabVisible()) return;
            if (quickHasOpenOverlay()) armOverlayFastScan("click-search-late");
          }, 220);
        } catch (_err) {
          // ignore
        }
      },
      true
    );
    // Focus on search input also opens history list.
    document.addEventListener(
      "focusin",
      (event) => {
        try {
          if (!isExtensionContextValid()) return;
          const t = event.target;
          if (!(t instanceof Element)) return;
          if (
            !t.matches?.(
              'input[placeholder*="搜索"], input[placeholder*="合约"], input[placeholder*="KOL"], input[type="search"]'
            )
          ) {
            return;
          }
          overlayFastUntil = Date.now() + OVERLAY_FAST_MS;
          if (isGmgnHost() || isDebotHost()) {
            scheduleGmgnOverlayPaint("focus-search", 150, true);
            return;
          }
          window.setTimeout(() => {
            if (quickHasOpenOverlay()) armOverlayFastScan("focus-search");
          }, 80);
        } catch (_err) {
          // ignore
        }
      },
      true
    );
  }

  /** Observe DOM until Debot token header badge is painted (SPA activation chain). */
  function debotNodeHasTokenSignal(node, token) {
    if (!(node instanceof Element) || !token) return false;
    const accepts = (el) => {
      if (!(el instanceof Element)) return false;
      const values = [
        el.getAttribute("href"),
        el.getAttribute("title"),
        el.getAttribute("data-addr"),
        el.getAttribute("data-token"),
        el.getAttribute("data-address")
      ];
      if (values.some((value) => normalizeToken(value) === token)) return true;
      if (el.childElementCount <= 2) {
        const text = (el.textContent || "").trim();
        const short = text.match(SHORT_TOKEN_RE)?.[0];
        if (short && text.length <= 28 && tokenMatchesShort(token, short)) return true;
      }
      return false;
    };
    if (accepts(node)) return true;
    try {
      const candidates = node.querySelectorAll(
        'a[href*="0x"], [title*="0x"], [data-addr*="0x"], [data-token*="0x"], [data-address*="0x"]'
      );
      for (let i = 0; i < Math.min(candidates.length, 24); i += 1) {
        if (accepts(candidates[i])) return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  function debotHeaderMutationLooksRelevant(records, token) {
    if (!records || !records.length || !token) return false;
    const badgeSelector =
      `[${ICON_DATA}="1"][data-fee-header="1"][data-fee-token="${token}"]`;
    for (const record of records) {
      if (debotNodeHasTokenSignal(record?.target, token)) return true;
      for (const node of record?.removedNodes || []) {
        if (nodeMatchesOrContains(node, badgeSelector) || debotNodeHasTokenSignal(node, token)) {
          return true;
        }
      }
      for (const node of record?.addedNodes || []) {
        if (debotNodeHasTokenSignal(node, token)) return true;
      }
    }
    return false;
  }

  function scheduleDebotHeaderRepair(reason, delay = 0) {
    if (debotHeaderRepairTimer) return;
    debotHeaderRepairTimer = window.setTimeout(() => {
      debotHeaderRepairTimer = null;
      if (!isExtensionContextValid() || !isTabVisible() || !isDebotTokenPage()) return;
      if (hasDebotTokenHeaderBadge()) return;
      tryPaintDebotTokenHeader(reason);
    }, delay);
  }

  function armDebotHeaderDomWatch() {
    stopDebotHeaderDomWatch();
    if (!isDebotTokenPage() && !debotTokenClickArmUntil) return;
    const token = extractTokenFromUrl();
    if (!token || !resolveEntry(token)) return;
    // The always-on document observer already filters mutations to the current address.
    // A second document-wide observer multiplied chart mutation delivery, and never
    // stopped when the optional API request failed.
    scheduleDebotHeaderRepair("header-watch-arm", TOKEN_ENTER_PAINT_GRACE_MS);
  }

  function stopDebotHeaderDomWatch() {
    if (debotHeaderDomObs) {
      try {
        debotHeaderDomObs.disconnect();
      } catch (_err) {
        // ignore
      }
      debotHeaderDomObs = null;
    }
    debotHeaderDomObsLastPaintAt = 0;
    if (debotHeaderRepairTimer) {
      window.clearTimeout(debotHeaderRepairTimer);
      debotHeaderRepairTimer = null;
    }
  }

  function clearSpaNavScanTimers() {
    spaNavScanTimers.forEach((id) => window.clearTimeout(id));
    spaNavScanTimers = [];
    if (spaNavCoalesceTimer) {
      window.clearTimeout(spaNavCoalesceTimer);
      spaNavCoalesceTimer = null;
    }
  }

  function onSpaRouteChange(reason) {
    if (!isExtensionContextValid()) return;
    const nextKey = getRouteKey();
    if (nextKey === lastRouteKey) return;
    const prevKey = lastRouteKey;
    lastRouteKey = nextKey;
    // 切到 robinhood / 非 BSC：立刻卸徽章，后续 settle 也不再扫
    if (!isScanPageAllowed()) {
      try {
        stopDebotTokenHeaderWatch();
        stopDebotHeaderDomWatch();
        stopGmgnHeaderDomWatch();
        clearTokenHeaderArtifacts();
        resetOurDomMarks();
      } catch (_err) {
        // ignore
      }
      scanTimerIds.forEach((id) => window.clearTimeout(id));
      scanTimerIds = [];
      scanScheduled = false;
      clearSpaNavScanTimers();
      if (spaNavCoalesceTimer) {
        window.clearTimeout(spaNavCoalesceTimer);
        spaNavCoalesceTimer = null;
      }
      if (spaQuietFlushTimer) {
        window.clearTimeout(spaQuietFlushTimer);
        spaQuietFlushTimer = null;
      }
      debugInfo("spa:chain-off", {
        reason,
        from: prevKey.slice(0, 80),
        to: nextKey.slice(0, 80)
      });
      return;
    }
    // Cover keyboard/programmatic navigation that bypasses the card click listener.
    // Freeze immediately at route detection, before the 40ms settle coalescer runs.
    if (routeKeyWasTokenDetail(nextKey)) armTokenEnterTransition();
    if (routeKeyWasTokenDetail(prevKey) && !routeKeyWasTokenDetail(nextKey)) {
      armListReturnTransition(`${reason}:route-return`);
    }
    if (routeKeyHasNonTargetToken(nextKey)) {
      // React may reuse the old address row on token -> token navigation. Remove only
      // extension-owned header artifacts after URL commit; never wait for a new painter.
      stopDebotTokenHeaderWatch();
      stopDebotHeaderDomWatch();
      stopGmgnHeaderDomWatch();
      clearTokenHeaderArtifacts();
    }

    // SPA navigation is independent from tab lifecycle recovery.
    // Site-specific quiet: Debot/GMGN token short; list return applied in settle.
    const quietMs = spaNavQuietMs();
    spaQuietUntil = Date.now() + quietMs;
    spaDomDirty = false;

    // Drop pending scans from previous route (avoid stacking work during nav).
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    lastScanAt = 0;
    if (gmgnEmbeddedDirtyTimer) window.clearTimeout(gmgnEmbeddedDirtyTimer);
    gmgnEmbeddedDirtyTimer = null;
    gmgnEmbeddedDirtyCards.clear();
    gmgnTrenchResizeActive = false;
    gmgnTrenchResizeQuietUntil = 0;
    gmgnTrenchResizeDirty = false;
    if (gmgnTrenchResizeSettleTimer) {
      window.clearTimeout(gmgnTrenchResizeSettleTimer);
      gmgnTrenchResizeSettleTimer = null;
    }
    cancelGmgnOverlayPaint();
    clearSpaNavScanTimers();
    if (spaQuietFlushTimer) {
      window.clearTimeout(spaQuietFlushTimer);
      spaQuietFlushTimer = null;
    }

    debugInfo("spa:route", {
      reason,
      from: prevKey.slice(0, 80),
      to: nextKey.slice(0, 80)
    });

    // Coalesce multi pushState/replaceState / poll hits in one navigation frame.
    if (spaNavCoalesceTimer) {
      window.clearTimeout(spaNavCoalesceTimer);
      spaNavCoalesceTimer = null;
    }
    spaNavCoalesceTimer = window.setTimeout(() => {
      spaNavCoalesceTimer = null;
      beginSpaRouteSettle(prevKey, nextKey);
    }, SPA_NAV_COALESCE_MS);

    // After quiet window: flush mutations that only set spaDomDirty (was never consumed).
    spaQuietFlushTimer = window.setTimeout(() => {
      spaQuietFlushTimer = null;
      if (!isExtensionContextValid() || !isTabVisible()) return;
      if (getRouteKey() !== lastRouteKey) return;
      spaQuietUntil = 0;
      const debotMiss =
        isDebotTokenPage() && extractTokenFromUrl() && !hasDebotTokenHeaderBadge();
      const gmgnMiss =
        isGmgnTokenPage() && extractTokenFromUrl() && !hasGmgnTokenHeaderBadge();
      if (spaDomDirty || debotMiss || gmgnMiss) {
        spaDomDirty = false;
        pendingLightScan = false;
        if (isDebotTokenPage()) tryPaintDebotTokenHeader("quiet-flush");
        if (isGmgnTokenPage()) tryPaintGmgnTokenHeader("quiet-flush");
        // Token pages use direct header painters. A page-wide scan can still hit the
        // outgoing trench while the SPA is swapping route subtrees.
        if (!isTokenDetailRoute()) {
          scheduleScan(0, {
            force: true,
            immediate: false,
            light: false,
            bypassForceGap: true
          });
        }
      }
    }, quietMs + 80);
  }

  /** Quiet window length for current route (ms). */
  function spaNavQuietMs() {
    if (isDebotTokenPage()) return SPA_NAV_QUIET_DEBOT_TOKEN_MS;
    if (isGmgnTokenPage()) return SPA_NAV_QUIET_GMGN_TOKEN_MS;
    return SPA_NAV_QUIET_MS;
  }

  /** Token detail / K-line routes need fewer progressive scans than meme boards. */
  function isTokenDetailRoute() {
    return isGmgnTokenPage() || isDebotTokenPage();
  }

  function getSpaScanOffsets(fromTokenReturn = false) {
    // Route key already updated before settle — use current location.
    if (isDebotTokenPage()) return SPA_NAV_SCAN_OFFSETS_DEBOT_TOKEN_MS;
    if (isTokenDetailRoute()) return SPA_NAV_SCAN_OFFSETS_TOKEN_MS;
    // token→list: GMGN = 0.4.22 light curve; Debot denser.
    if (fromTokenReturn) {
      return isGmgnHost()
        ? SPA_NAV_SCAN_OFFSETS_LIST_RETURN_GMGN_MS
        : SPA_NAV_SCAN_OFFSETS_LIST_RETURN_MS;
    }
    return SPA_NAV_SCAN_OFFSETS_LIST_MS;
  }

  /** Token page: stop further SPA force-scans once header badge exists. */
  function shouldCancelSpaProgressive() {
    if (!isTokenDetailRoute()) {
      // List: early-stop when first screen is good enough (0.4.30).
      return shouldCancelSpaListProgressive();
    }
    // Non-8888/7777 token pages never need progressive hole-fill.
    if (isNonTargetTokenPage()) return true;
    // Only cancel when header settled — keep progressive for side boards/dialogs.
    try {
      return isTokenPageSettledWithBadge() && !quickHasOpenOverlay();
    } catch (_err) {
      return false;
    }
  }

  /**
   * After route key stabilizes: clear old marks cheaply, rebind roots, progressive scans.
   * Must NOT run heavy DOM walks synchronously inside history hooks (was main SPA jank).
   * 0.4.11: fewer passes + only first immediate; token early-stop — fixes ~3s K-line jank.
   */
  function beginSpaRouteSettle(prevKey, nextKey) {
    if (!isExtensionContextValid() || !isTabVisible()) return;
    if (!isScanPageAllowed()) {
      purgeMarksIfChainDisallowed();
      return;
    }

    const prevTok = extractTokenFromRouteKey(prevKey);
    const nextTok = extractTokenFromRouteKey(nextKey);
    // Same 7777/8888 CA, only Debot id_ prefix or query noise — do NOT wipe badges.
    const softSameToken =
      !!prevTok &&
      !!nextTok &&
      prevTok === nextTok &&
      isDebotTokenPage();

    const fromToken = routeKeyWasTokenDetail(prevKey);
    const toList = !isTokenDetailRoute();
    const listReturn = fromToken && toList;
    const enteringToken = isTokenDetailRoute() && !softSameToken;
    if (toList) finishTokenEnterTransition();
    spaSettleFromToken = listReturn;

    // Fresh caches — virtual list reuses nodes with stale token/mount mapping.
    debotMountCache = new WeakMap();
    gmgnTaxMountCache = new WeakMap();
    cardTokenCache = new WeakMap();
    hrefTokenCache = new WeakMap();
    poolQuoteDomCache = new WeakMap();
    taxDivDomCache = new WeakMap();
    taxBasketDomCache = new WeakMap();
    scanRootsCache = { at: 0, roots: [] };
    gmgnSteadyRoundRobinRow = 0;
    gmgnTrenchProbeCache = { at: 0, roots: [], ready: false };
    gmgnTrenchRootsCache = { at: 0, roots: [] };
    gmgnPanelProbeCache = new WeakMap();
    taxRateLabelCache = { el: null, at: 0 };
    gmgnHeaderBadgeCache = { token: "", el: null };
    // GMGN scroll quiet should not block SPA progressive settle.
    if (isGmgnHost()) {
      gmgnScrollQuietUntil = 0;
      gmgnScrollResumeNeedsScan = false;
      gmgnScrollResumeTarget = null;
      gmgnForbiddenScrollTarget = null;
      gmgnForbiddenScrollTargetCache = new WeakMap();
      gmgnNewCardPendingTokens.clear();
      if (gmgnNewCardBatchTimer) {
        window.clearTimeout(gmgnNewCardBatchTimer);
        gmgnNewCardBatchTimer = null;
      }
      if (gmgnScrollResumeTimer) {
        window.clearTimeout(gmgnScrollResumeTimer);
        gmgnScrollResumeTimer = null;
      }
    }
    if (isDebotHost()) {
      debotScrollQuietUntil = 0;
      debotScrollResumeTarget = null;
      if (debotScrollResumeTimer) {
        window.clearTimeout(debotScrollResumeTimer);
        debotScrollResumeTimer = null;
      }
    }

    if (!softSameToken) {
      stopDebotTokenHeaderWatch();
      if (enteringToken) {
        armTokenEnterTransition();
        // Keep outgoing trench badges untouched. React will remove them with its old
        // subtree; synchronous removal here caused a visible reflow before K-line mount.
        debotHeaderBadgeOkUntil = 0;
        debotHeaderBadgeOkEl = null;
        debotHeaderFindCache = { at: 0, key: "", el: null };
      } else if (listReturn) {
        // Keep the old token header untouched until the real trench DOM is ready.
        // Removing it while the K-line subtree is still visible causes a flash/residual.
        debotHeaderBadgeOkUntil = 0;
        debotHeaderBadgeOkEl = null;
        debotHeaderFindCache = { at: 0, key: "", el: null };
      } else {
        // List return / non-token navigation still resets our route-owned marks.
        resetOurDomMarks();
      }
    }

    // token→list soft window:
    // - Debot 0.8.63 / GMGN 0.4.44: short soft + cache-first fastPaint；禁止 keep-alive force 扫
    if (listReturn && !isGmgnHost()) {
      spaListReturnUntil = Date.now() + listReturnSoftDurationMs();
      spaListReturnCacheOnlyUntil = Date.now() + SPA_LIST_RETURN_CACHE_ONLY_MS;
      spaQuietUntil = Date.now() + SPA_NAV_QUIET_LIST_RETURN_MS;
    } else if (listReturn && isGmgnHost()) {
      spaListReturnUntil = Date.now() + listReturnSoftDurationMs();
      spaListReturnCacheOnlyUntil = Date.now() + SPA_LIST_RETURN_CACHE_ONLY_MS;
      spaQuietUntil = Date.now() + SPA_NAV_QUIET_LIST_RETURN_MS;
      spaSettleFromToken = true;
      // Kill any leftover Debot keep-alive if host somehow shared state.
      if (listReturnKeepAliveId) {
        window.clearTimeout(listReturnKeepAliveId);
        listReturnKeepAliveId = null;
      }
    } else if (!softSameToken) {
      spaListReturnUntil = 0;
      spaListReturnCacheOnlyUntil = 0;
      stopListReturnDomWatch();
      if (listReturnKeepAliveId) {
        window.clearTimeout(listReturnKeepAliveId);
        listReturnKeepAliveId = null;
      }
    }
    if (listReturn && !isListReturnTransitionActive()) {
      armListReturnDomWatch();
      if (isDebotHost()) armDebotListReturnFastBurst();
      else if (!isGmgnHost()) armListReturnKeepAlive();
      if (isGmgnHost()) {
        const scheduleRepair = (ms) => {
          window.setTimeout(() => {
            if (!isExtensionContextValid() || !isTabVisible()) return;
            try {
              repairGmgnTrenchBadgesAfterListReturn("list-return");
            } catch (_rep) {
              // ignore
            }
          }, ms);
        };
        scheduleRepair(120);
        scheduleRepair(480);
        scheduleRepair(1200);
      }
    } else if (listReturn) {
      tryFinishListReturnTransition("route-settle");
    }

    // ALWAYS observe documentElement — list roots detach on SPA and go silent (js-mcp).
    ensureDocumentObserver();

    // Entering Debot token: prime fee fetch + DOM watch (SPA activation chain).
    if (isDebotTokenPage()) {
      const enterTok = extractTokenFromUrl();
      if (enterTok) {
        debotHeaderMissStreak = 0;
        debotHeaderMissSince = Date.now();
        recoverStuckBatch(false);
        queueToken(enterTok);
        scheduleBatchFlush({ immediate: true, delayMs: 0 });
        // Data/DOM readiness owns painting. Do not search the outgoing header while the
        // host is switching between token routes.
        armDebotTokenHeaderWatch();
      }
    } else {
      stopDebotHeaderDomWatch();
    }

    // Entering GMGN token: header-only prime (0.4.37 — no war-room column storm).
    if (isGmgnTokenPage()) {
      const enterTok = extractTokenFromUrl();
      if (enterTok) {
        recoverStuckBatch(false);
        queueToken(enterTok);
        scheduleBatchFlush({ immediate: true, delayMs: 0 });
        if (resolveEntry(enterTok)) {
          scheduleGmgnHeaderRepair("settle-enter", TOKEN_ENTER_PAINT_GRACE_MS);
        }
      }
    }

    // Soft same-token: header already painted → skip progressive storm.
    if (softSameToken && hasDebotTokenHeaderBadge()) {
      spaQuietUntil = 0;
      return;
    }

    // Progressive: list-return snappy; token header light; cold list moderate.
    const base = softSameToken
      ? 0
      : listReturn
        ? SPA_NAV_QUIET_LIST_RETURN_MS
        : isDebotTokenPage()
          ? SPA_NAV_QUIET_DEBOT_TOKEN_MS
          : isGmgnTokenPage()
            ? SPA_NAV_QUIET_GMGN_TOKEN_MS
            : SPA_NAV_QUIET_MS;
    const offsets = getSpaScanOffsets(listReturn);

    // List-return: cache-first burst for BOTH sites.
    // Debot: dense soft path. GMGN: lightweight fastPaint (+ timed burst below).
    if (listReturn) {
      try {
        fastPaintListReturnViewport();
      } catch (_err) {
        // ignore
      }
      // GMGN recovery timers start in finishListReturnTransition, after the real
      // trench surface passes the structural gate.
    }
    offsets.forEach((offset, index) => {
      const timerId = window.setTimeout(() => {
        spaNavScanTimers = spaNavScanTimers.filter((id) => id !== timerId);
        if (!isTabVisible() || !isExtensionContextValid()) return;

        // Navigation is already committed, but the host still owns its first render slice.
        // The targeted MutationObserver may paint sooner when the real address row appears.
        if (isTokenDetailRoute() && isTokenEnterPaintGraceActive()) return;

        // Early-stop: token header settled OR list first-screen enough badges.
        if (index > 0 && shouldCancelSpaProgressive()) {
          clearSpaNavScanTimers();
          spaQuietUntil = 0;
          return;
        }

        // Drop quiet so this scan and mutations can run.
        if (Date.now() < spaQuietUntil) spaQuietUntil = 0;
        spaDomDirty = false;
        // Refresh roots each pass (home columns vs token header / Debot cards).
        // 0.4.46 GMGN list-return: NEVER force getScanRoots on pass 0 (stacks with host 500ms+ longtask).
        if (!isTokenDetailRoute() && !(isGmgnHost() && listReturn && index === 0)) {
          if (!isGmgnHost() || index === 0) {
            scanRootsCache = { at: 0, roots: [] };
            try {
              getScanRoots(true);
            } catch (_err) {
              // ignore
            }
          }
        }
        ensureDocumentObserver();

        // Debot: cheap header paint first; may cancel remaining progressive without full scan.
        if (isDebotTokenPage()) {
          tryPaintDebotTokenHeader("spa-progressive");
          if (hasDebotTokenHeaderBadge() && index > 0) {
            clearSpaNavScanTimers();
            return;
          }
          pendingLightScan = false;
        }

        // GMGN token: header tryPaint; later passes paint-only (no full column scan).
        if (isGmgnTokenPage()) {
          tryPaintGmgnTokenHeader("spa-progressive");
          if (hasGmgnTokenHeaderBadge()) {
            if (index > 0) clearSpaNavScanTimers();
            // First pass may still need one light header-scoped scan below.
          }
          pendingLightScan = false;
        }

        // List-return soft burst: Debot denser; GMGN also fastPaint (0.4.44).
        if (listReturn || isSpaListReturnSoft()) {
          try {
            fastPaintListReturnViewport();
          } catch (_err) {
            // ignore
          }
          if (shouldCancelSpaListProgressive()) {
            clearSpaNavScanTimers();
            // GMGN: drop soft early once first screen filled (avoid extra force scans).
            if (isGmgnHost()) {
              spaListReturnUntil = 0;
              spaListReturnCacheOnlyUntil = 0;
            }
            return;
          }
        }

        // Token pages are header-only on every progressive pass. The direct painters
        // validate the real address mount and do not traverse/repaint list cards.
        if (isDebotTokenPage()) {
          if (!hasDebotTokenHeaderBadge()) tryPaintDebotTokenHeader("spa-progressive-later");
        } else if (isGmgnTokenPage()) {
          if (!hasGmgnTokenHeaderBadge()) tryPaintGmgnTokenHeader("spa-progressive-later");
        } else if ((listReturn || isSpaListReturnSoft()) && isGmgnHost()) {
          // 0.4.46: pass 0 = fastPaint only (no force scan during host rebuild longtask).
          // Later passes: idle force only if first screen still incomplete.
          if (index === 0) {
            // skip scheduleScan
          } else {
            scheduleScan(0, {
              force: true,
              immediate: false,
              light: false,
              bypassForceGap: true
            });
          }
        } else if (listReturn || isSpaListReturnSoft()) {
          // Debot soft list-return progressive.
          scheduleScan(0, {
            force: true,
            immediate: index === 0,
            light: false,
            bypassForceGap: index === 0
          });
        } else {
          // Cold list / non-return: classic progressive force (first immediate only).
          scheduleScan(0, {
            force: true,
            immediate: index === 0,
            light: false,
            bypassForceGap: index === 0
          });
        }

        // After first paint: cancel pending progressive if already good enough.
        if (index === 0) {
          const checkMs =
            isDebotTokenPage() || isGmgnTokenPage() ? 200 : listReturn ? 120 : 120;
          const checkId = window.setTimeout(() => {
            spaNavScanTimers = spaNavScanTimers.filter((id) => id !== checkId);
            if (shouldCancelSpaProgressive()) clearSpaNavScanTimers();
          }, checkMs);
          spaNavScanTimers.push(checkId);
        }
      }, base + offset);
      spaNavScanTimers.push(timerId);
    });

    // Debot/Gungnir meme→token: arm continuous header watch (DOM often late after SPA).
    if (isDebotTokenPage() && extractTokenFromUrl()) {
      armDebotTokenHeaderWatch();
      armDebotHeaderDomWatch();
    }
  }

  function stopDebotTokenHeaderWatch() {
    if (debotTokenHeaderWatchId) {
      window.clearInterval(debotTokenHeaderWatchId);
      debotTokenHeaderWatchId = null;
    }
    debotTokenHeaderWatchUntil = 0;
  }

  function armDebotTokenHeaderWatch() {
    stopDebotTokenHeaderWatch();
    if (!isDebotTokenPage()) return;
    const urlTok = extractTokenFromUrl();
    if (!urlTok) return; // non-8888/7777 — nothing to paint
    if (!resolveEntry(urlTok)) {
      queueToken(urlTok);
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
      return;
    }
    debotTokenHeaderWatchUntil = Date.now() + DEBOT_TOKEN_HEADER_WATCH_MS;
    scheduleDebotHeaderRepair("watch-arm", TOKEN_ENTER_PAINT_GRACE_MS);
    debotTokenHeaderWatchId = window.setInterval(() => {
      if (!isExtensionContextValid()) {
        stopDebotTokenHeaderWatch();
        return;
      }
      // Pause while hidden — do NOT stop (resume must continue painting).
      if (!isTabVisible()) return;
      if (!isDebotTokenPage() || Date.now() > debotTokenHeaderWatchUntil) {
        stopDebotTokenHeaderWatch();
        return;
      }
      if (hasDebotTokenHeaderBadge()) {
        stopDebotTokenHeaderWatch();
        return;
      }
      if (!resolveEntry(urlTok)) {
        stopDebotTokenHeaderWatch();
        return;
      }
      tryPaintDebotTokenHeader("watch-tick");
    }, DEBOT_TOKEN_HEADER_TICK_MS);
  }

  function isDebotBadgeBesideCurrentAddress(icon, token) {
    if (!(icon instanceof HTMLElement) || !token) return false;
    try {
      if (isLargeTokenLinkCardNode(icon)) return false;
      const r = icon.getBoundingClientRect();
      if (
        r.width < 2 ||
        r.height < 2 ||
        r.bottom <= 0 ||
        r.top >= Math.min(window.innerHeight, 360)
      ) {
        return false;
      }

      const listCard = icon.closest?.(".MuiCard-root, .MuiPaper-root.MuiCard-root");
      if (listCard) {
        const lr = listCard.getBoundingClientRect();
        if (lr.height >= 120) return false;
      }

      const short = findDebotHeaderShortCaLeaf(token);
      if (short instanceof HTMLElement && short.isConnected) {
        if (
          icon.previousElementSibling === short ||
          short.nextElementSibling === icon ||
          icon.parentElement === short.parentElement
        ) {
          return true;
        }
        const sr = short.getBoundingClientRect();
        if (
          Math.abs(r.top - sr.top) <= 36 &&
          r.left >= sr.left - 12 &&
          r.left <= sr.right + 320
        ) {
          return true;
        }
        return false;
      }

      // Header DOM can appear one frame before the short-CA leaf. Accept only an explicit
      // token-header mount inside the current header, never a generic top-strip badge.
      const mount = icon.closest?.("[data-flap-mount]");
      const kind = mount?.dataset?.flapMount || "";
      if (!/token-header/.test(kind)) return false;
      const header = findDebotTokenHeaderCard();
      return !!(
        header &&
        (header.contains(icon) || header.parentElement?.contains(icon))
      );
    } catch (_err) {
      return false;
    }
  }

  function findDebotHeaderBadgeEl(token) {
    if (!token) return null;
    try {
      const icons = document.querySelectorAll(
        `[${ICON_DATA}="1"][data-fee-token="${token}"]`
      );
      for (let i = 0; i < icons.length; i += 1) {
        const icon = icons[i];
        if (!(icon instanceof HTMLElement) || !icon.isConnected) continue;
        if (!isDebotBadgeBesideCurrentAddress(icon, token)) continue;
        // Upgrade legacy in-page badges so later mutation recovery has an exact signal.
        icon.dataset.feeHeader = "1";
        icon.dataset.feePosMode = "default";
        return icon;
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  /** Remove only our previous token header after the new address row is confirmed. */
  function removeStaleTokenHeaderBadges(currentToken) {
    if (!currentToken) return;
    if (gmgnHeaderBadgeCache.token && gmgnHeaderBadgeCache.token !== currentToken) {
      gmgnHeaderBadgeCache = { token: "", el: null };
    }
    try {
      document
        .querySelectorAll(`[${ICON_DATA}="1"][data-fee-header="1"]`)
        .forEach((icon) => {
          if (!(icon instanceof HTMLElement)) return;
          if (icon.dataset.feeToken === currentToken) return;
          icon.remove();
        });
    } catch (_err) {
      // Optional UI cleanup must never affect the host route.
    }
  }

  /** True only if badge remains beside the current Debot/Gungnir header address. */
  function hasDebotTokenHeaderBadge() {
    try {
      const urlTok = extractTokenFromUrl();
      if (!urlTok) return false;
      if (
        Date.now() < debotHeaderBadgeOkUntil &&
        debotHeaderBadgeOkEl instanceof HTMLElement &&
        debotHeaderBadgeOkEl.isConnected &&
        debotHeaderBadgeOkEl.dataset.feeToken === urlTok &&
        isDebotBadgeBesideCurrentAddress(debotHeaderBadgeOkEl, urlTok)
      ) {
        return true;
      }
      debotHeaderBadgeOkUntil = 0;
      debotHeaderBadgeOkEl = null;
      const icon = findDebotHeaderBadgeEl(urlTok);
      if (!icon) return false;
      debotHeaderBadgeOkEl = icon;
      debotHeaderBadgeOkUntil = Date.now() + DEBOT_HEADER_BADGE_OK_CACHE_MS;
      finishTokenEnterTransition();
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Direct paint path for Debot/Gungnir token header (bypasses candidate starvation).
   * @returns {boolean} true if badge painted or queued with mount ready
   */
  function tryPaintDebotTokenHeader(reason) {
    if (!isDebotTokenPage() || !isExtensionContextValid()) return false;
    const urlTok = extractTokenFromUrl();
    if (!urlTok) return false;
    if (hasDebotTokenHeaderBadge()) {
      finishTokenEnterTransition();
      return true;
    }

    // Always ensure fee data is requested (js-mcp: SPA token often never hit /modes).
    queueToken(urlTok);
    const entry = resolveEntry(urlTok);

    let header = findDebotTokenHeaderCard();
    if (!header) {
      // Logged-in Debot: header chrome denser — use top short leaf as mount host.
      const topShort = findDebotTopShortLeaf(urlTok, document.body);
      if (topShort && !isLargeTokenLinkCardNode(topShort)) {
        header =
          (topShort.parentElement instanceof HTMLElement &&
          topShort.parentElement.parentElement instanceof HTMLElement
            ? topShort.parentElement
            : topShort.parentElement) || topShort;
      }
    }
    if (!(header instanceof HTMLElement)) {
      // No DOM yet — still flush API so entry is ready when header appears.
      recoverStuckBatch(false);
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
      return false;
    }
    // URL can already be /token/ while the clicked war-room row is still mounted.
    // Never reinterpret that outgoing row as the K-line header.
    if (isLargeTokenLinkCardNode(header)) return false;
    removeStaleTokenHeaderBadges(urlTok);

    // 无缓存：先 ⏳待加载，避免顶栏空白/乱闪
    if (!entry) {
      recoverStuckBatch(false);
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
      try {
        header.dataset[CARD_MARK] = urlTok;
        header.setAttribute(CARD_DATA, urlTok);
      } catch (_errMark) {
        // ignore
      }
      if (renderMode(header, urlTok, FEE_LOADING_ENTRY)) {
        finishTokenEnterTransition();
        return true;
      }
      return false;
    }

    // Prefer the compact short-CA row as card (stable mount for token-header).
    try {
      const short =
        findDebotShortAddressNode(header) ||
        (TARGET_SHORT_TOKEN_RE.test((header.textContent || "").trim()) &&
        (header.textContent || "").trim().length <= 22
          ? header
          : null);
      if (short) {
        const row = findDebotShortAddressRow(header) || short.parentElement || short;
        if (row instanceof HTMLElement) {
          const rr = row.getBoundingClientRect();
          // js-mcp: short leaf ~68px wide; parent row is the mount.
          if (rr.width >= 60 && rr.height >= 12 && rr.height <= 100) header = row;
        }
      }
    } catch (_err) {
      // keep header as-is
    }

    // Mark and paint
    header.dataset[CARD_MARK] = urlTok;
    try {
      header.setAttribute(CARD_DATA, urlTok);
    } catch (_err) {
      // ignore
    }

    // Header always natural mount — strip any absolute styles from prior list-return.
    // Prefer force-append beside short CA (absolute 91,35 on short row = invisible).
    let ok = forceAppendDebotHeaderBadge(header, urlTok, entry);
    if (!ok || !hasDebotTokenHeaderBadge()) {
      ok = renderMode(header, urlTok, entry, { forceRemount: true }) || ok;
      // If renderMode still applied absolute (old card zone miss), rewrite to after short CA.
      if (!hasDebotTokenHeaderBadge() || headerHasAbsoluteHeaderBadge(urlTok)) {
        ok = forceAppendDebotHeaderBadge(header, urlTok, entry) || ok;
      }
    }
    if (ok || hasDebotTokenHeaderBadge()) {
      finishTokenEnterTransition();
      debotHeaderMissStreak = 0;
      debotHeaderMissSince = 0;
      debugInfo("debot:header-paint", {
        reason,
        token: urlTok.slice(0, 12),
        settled: hasDebotTokenHeaderBadge()
      });
    }
    return hasDebotTokenHeaderBadge() || !!ok;
  }

  /** True if a same-token badge near top still has absolute positioning (should not on K-line). */
  function headerHasAbsoluteHeaderBadge(token) {
    if (!token) return false;
    try {
      const icons = document.querySelectorAll(
        `[${ICON_DATA}="1"][data-fee-token="${token}"]`
      );
      for (let i = 0; i < icons.length; i += 1) {
        const icon = icons[i];
        if (icon.dataset.feePosMode === "absolute") {
          const r = icon.getBoundingClientRect();
          if (r.top >= 0 && r.top < 220) return true;
        }
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  /**
   * Find pure short-CA leaf matching token near top of viewport (logged-in Debot header).
   * 0.4.47: delegate to title/ca-text first; optional scope still used for subtree refine.
   */
  function findDebotTopShortLeaf(token, scope) {
    // Global top-band fast path (works even when sidebar precedes header in DOM).
    const globalLeaf = findDebotHeaderShortCaLeaf(token);
    if (globalLeaf) {
      if (!(scope instanceof HTMLElement) || scope.contains(globalLeaf)) return globalLeaf;
    }
    if (!(scope instanceof HTMLElement) || !scope.querySelectorAll) {
      return globalLeaf;
    }
    // Scoped refine inside known header host.
    try {
      const titled = scope.querySelectorAll('[title^="0x"], [title^="0X"], [title*="0x"]');
      for (let i = 0; i < Math.min(titled.length, 20); i += 1) {
        const el = titled[i];
        if (!(el instanceof HTMLElement)) continue;
        const titleTok = normalizeToken(el.getAttribute("title") || "");
        if (token && titleTok && titleTok !== token) continue;
        const leaf =
          Array.from(el.querySelectorAll("div, span")).find((n) => {
            const t = (n.textContent || "").trim();
            return TARGET_SHORT_TOKEN_RE.test(t) && t.length <= 22;
          }) || el;
        const r = leaf.getBoundingClientRect();
        if (
          r.width > 0 &&
          r.height > 0 &&
          r.bottom > 0 &&
          r.top < Math.min(window.innerHeight, 360)
        ) {
          return leaf instanceof HTMLElement ? leaf : el;
        }
      }
      const leaves = scope.querySelectorAll("span, a, div, p, button");
      const max = Math.min(leaves.length, 200);
      for (let i = 0; i < max; i += 1) {
        const el = leaves[i];
        if (!(el instanceof HTMLElement)) continue;
        let t = (el.textContent || "").trim();
        if (t.length > 28 || t.length < 8) continue;
        if (!TARGET_SHORT_TOKEN_RE.test(t)) continue;
        if (el.children && el.children.length > 3) continue;
        if (token && !tokenMatchesShort(token, t.match(SHORT_TOKEN_RE)?.[0] || t)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.height > 48) continue;
        if (r.bottom <= 0 || r.top >= Math.min(window.innerHeight, 360)) continue;
        return el;
      }
    } catch (_err) {
      // ignore
    }
    return globalLeaf;
  }

  /**
   * Last-resort paint: insert badge after pure short CA leaf in token header.
   * Bypasses metrics/buy mount discovery failures after SPA / login chrome.
   */
  function forceAppendDebotHeaderBadge(header, token, entry) {
    if (!(header instanceof HTMLElement) || !entry || !token) return false;
    try {
      // Prefer API quote — avoid expensive DOM quote walk on header SPA.
      const q = resolveQuoteSymbol(header, entry) || "BNB";
      const presentation = computeBadgePresentation(entry, q, token);
      const { label } = presentation;
      if (!label) return false;

      const existing = findDebotHeaderBadgeEl(token);
      if (existing) {
        applyBadgeUi(existing, presentation, token);
        existing.dataset.feeHeader = "1";
        existing.dataset.feePosMode = "default";
        debotHeaderBadgeOkEl = existing;
        debotHeaderBadgeOkUntil = Date.now() + DEBOT_HEADER_BADGE_OK_CACHE_MS;
        return true;
      }

      let short =
        findDebotShortAddressNode(header) ||
        findDebotTopShortLeaf(token, header) ||
        findDebotTopShortLeaf(token, document.body);

      const mountRow =
        (short &&
          (findDebotShortAddressRow(short.parentElement || short) ||
            short.parentElement)) ||
        header;
      const anchor = mountRow instanceof HTMLElement ? mountRow : header;

      // Header repair must stay local. removeAllBadgesForCard performs a document-wide
      // orphan pass and becomes quadratic when many cards arrive together.
      const clearLocal = (root) => {
        if (!(root instanceof HTMLElement)) return;
        root.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.dataset.feeToken && n.dataset.feeToken !== token) return;
          try {
            n.remove();
          } catch (_err) {
            // ignore
          }
        });
      };
      clearLocal(header);
      if (anchor !== header) clearLocal(anchor);
      // Drop only explicit stale header badges for this token. List-card badges remain.
      try {
        document
          .querySelectorAll(
            `[${ICON_DATA}="1"][data-fee-header="1"][data-fee-token="${token}"]`
          )
          .forEach((n) => {
            try {
              n.remove();
            } catch (_err) {
              // ignore
            }
          });
      } catch (_err) {
        // ignore
      }

      const icon = document.createElement("span");
      icon.dataset[ICON_MARK] = "1";
      icon.dataset.feePosMode = "default";
      icon.dataset.feeHeader = "1";
      applyBadgeUi(icon, presentation, token);

      if (short && short.isConnected) {
        // Place immediately after short CA leaf (user expects badge by address).
        short.insertAdjacentElement("afterend", icon);
      } else {
        anchor.append(icon);
      }
      if (short?.parentElement instanceof HTMLElement) {
        short.parentElement.dataset.flapMount = "token-header";
        short.parentElement.dataset[CARD_MARK] = token;
        try {
          short.parentElement.setAttribute(CARD_DATA, token);
        } catch (_err) {
          // ignore
        }
      }
      anchor.dataset.flapMount = "token-header";
      anchor.dataset[CARD_MARK] = token;
      try {
        anchor.setAttribute(CARD_DATA, token);
      } catch (_err) {
        // ignore
      }
      header.dataset[CARD_MARK] = token;
      try {
        header.setAttribute(CARD_DATA, token);
      } catch (_err) {
        // ignore
      }
      const painted = findDebotHeaderBadgeEl(token);
      if (painted !== icon) return false;
      debotHeaderBadgeOkEl = icon;
      debotHeaderBadgeOkUntil = Date.now() + DEBOT_HEADER_BADGE_OK_CACHE_MS;
      return true;
    } catch (_err) {
      return false;
    }
  }

  function sameObserverRoots(a, b) {
    return (
      a.length === b.length &&
      a.every((root, index) => root === b[index])
    );
  }

  function scheduleGmgnObserverRefresh(delay = 80) {
    if (!isGmgnHost() || gmgnObserverRefreshTimer) return;
    gmgnObserverRefreshTimer = window.setTimeout(() => {
      gmgnObserverRefreshTimer = null;
      if (!isExtensionContextValid() || !isTabVisible() || !isGmgnHost()) return;
      const wasDiscoveryOnly =
        lastObserverRoots.length === 1 &&
        lastObserverRoots[0] === document.documentElement;
      scanRootsCache = { at: 0, roots: [] };
      try {
        const roots = getScanRoots(true);
        const hasSearch = roots.some(
          (root) =>
            root.matches?.(GMGN_FIXED_SEARCH_ROOT_SELECTOR) ||
            root.querySelector?.(GMGN_FIXED_SEARCH_ROOT_SELECTOR)
        );
        if (hasSearch) {
          overlayDetectCache = { at: 0, open: false };
          scheduleGmgnOverlayPaint("fixed-surface-refresh", 0, true);
        } else if (wasDiscoveryOnly && roots.length) {
          scheduleScan(0, { force: false, immediate: false, light: false });
        }
      } catch (_err) {
        ensureDocumentObserver();
      }
    }, Math.max(0, delay));
  }

  function gmgnDiscoveryMutationLooksRelevant(records) {
    const selector =
      `${GMGN_FIXED_TRENCH_ROOT_SELECTOR}, ${GMGN_FIXED_SEARCH_ROOT_SELECTOR}, #token-base-address`;
    for (const record of records || []) {
      for (const node of [...(record.addedNodes || []), ...(record.removedNodes || [])]) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(selector) || node.querySelector?.(selector)) return true;
      }
    }
    return false;
  }

  function scheduleDebotObserverRefresh(delay = 80) {
    if (!isDebotHost() || debotObserverRefreshTimer) return;
    debotObserverRefreshTimer = window.setTimeout(() => {
      debotObserverRefreshTimer = null;
      if (!isExtensionContextValid() || !isTabVisible() || !isDebotHost()) return;
      const wasDiscoveryOnly =
        lastObserverRoots.length === 1 &&
        lastObserverRoots[0] === document.documentElement;
      scanRootsCache = { at: 0, roots: [] };
      try {
        const roots = getScanRoots(true);
        const hasDialog = roots.some(
          (root) =>
            isDialogRoot(root) ||
            root.closest?.(".MuiDialog-root, .MuiModal-root, [role='dialog']")
        );
        if (hasDialog) {
          overlayDetectCache = { at: 0, open: false };
          scheduleGmgnOverlayPaint("debot-surface-refresh", 0, true);
        } else if (wasDiscoveryOnly && roots.length) {
          scheduleScan(0, { force: false, immediate: false, light: false });
        }
      } catch (_err) {
        ensureDocumentObserver();
      }
    }, Math.max(0, delay));
  }

  function debotDiscoveryMutationLooksRelevant(records) {
    const selector =
      ".MuiCard-root, .MuiPaper-root, .MuiDialog-root, .MuiModal-root, a[href*='/token/']";
    for (const record of records || []) {
      for (const node of [...(record.addedNodes || []), ...(record.removedNodes || [])]) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(selector) || node.querySelector?.(selector)) return true;
      }
    }
    return false;
  }

  /**
   * GMGN observes only fixed badge surfaces. During the short boot gap where no
   * surface exists yet, documentElement is discovery-only and the callback exits
   * before card/text/layout work. Debot keeps its existing document observer.
   */
  function ensureDocumentObserver() {
    try {
      const docEl = document.documentElement;
      if (!docEl) return;
      const scoped = isGmgnHost()
        ? getGmgnFixedSurfaceRoots()
        : isDebotHost()
          ? getDebotFixedSurfaceRoots()
          : [];
      const nextRoots = scoped.length ? scoped : [docEl];
      if (sameObserverRoots(lastObserverRoots, nextRoots)) return;
      mutationObserver.disconnect();
      const observeOptions = scoped.length
        ? {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["href"]
          }
        : { childList: true, subtree: true };
      nextRoots.forEach((root) => {
        mutationObserver.observe(root, observeOptions);
      });
      lastObserverRoots = nextRoots;
    } catch (_err) {
      // ignore
    }
  }

  /** Remove all our badge marks/icons from the document (SPA leave/enter). */
  function resetOurDomMarks() {
    hideFeeTooltip();
    debotHeaderBadgeOkUntil = 0;
    debotHeaderBadgeOkEl = null;
    debotHeaderFindCache = { at: 0, key: "", el: null };
    gmgnHeaderBadgeCache = { token: "", el: null };
    // Drop GMGN Tax mount cache with marks (nodes are gone / recycled).
    gmgnTaxMountCache = new WeakMap();
    badgeForbiddenCache = new WeakMap();
    poolQuoteDomCache = new WeakMap();
    taxDivDomCache = new WeakMap();
    taxBasketDomCache = new WeakMap();
    try {
      document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
        try {
          icon.remove();
        } catch (_err) {
          // ignore
        }
      });
      document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
        if (card instanceof HTMLElement) delete card.dataset[CARD_MARK];
      });
    } catch (_err) {
      // ignore
    }
  }

  /** Soft prune: only disconnected / orphan icons (steady state). */
  function pruneDetachedAndForeignMarks() {
    document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      if (!document.contains(icon)) {
        try {
          icon.remove();
        } catch (_err) {
          // ignore
        }
        return;
      }
      const host = icon.closest(`[${CARD_DATA}]`);
      if (!host || !document.contains(host)) {
        try {
          icon.remove();
        } catch (_err2) {
          // ignore
        }
      }
    });
  }

  /**
   * Count our badges tied to this card (descendants + adjacent siblings).
   * >1 means double-badge bug — must remount, never treat as stable.
   */
  function countBadgesNearCard(card, tokenHint) {
    if (!(card instanceof HTMLElement)) return 0;
    const token = tokenHint || card.dataset[CARD_MARK] || "";
    const found = new Set();
    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => found.add(n));
    for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
      if (
        sib instanceof HTMLElement &&
        (sib.dataset?.[ICON_MARK] === "1" || sib.matches?.(`[${ICON_DATA}="1"]`))
      ) {
        found.add(sib);
      }
    }
    // Parent children with same token near this card (Tax climb mounts).
    const parent = card.parentElement;
    if (parent) {
      Array.from(parent.children).forEach((ch) => {
        if (!(ch instanceof HTMLElement) || ch === card) return;
        if (!ch.matches?.(`[${ICON_DATA}="1"]`) && ch.dataset?.[ICON_MARK] !== "1") return;
        if (token && ch.dataset.feeToken && ch.dataset.feeToken !== token) return;
        try {
          const cr = card.getBoundingClientRect();
          const ir = ch.getBoundingClientRect();
          if (Math.abs(ir.top - cr.top) > cr.height + 12) return;
          if (ir.right < cr.left - 12 || ir.left > cr.right + 12) return;
          found.add(ch);
        } catch (_err) {
          found.add(ch);
        }
      });
    }
    return found.size;
  }

  /** True when card already has exactly one correct badge (no extract needed). */
  function isStablePaintedCard(card, forceRemount) {
    if (forceRemount || !(card instanceof HTMLElement)) return false;
    const marked = card.dataset[CARD_MARK];
    if (!marked) return false;

    // 0.4.43 GMGN: local badge only + dataset signatures — skip parent-rect thrash & textContent.
    if (isGmgnHost()) {
      // 0.5.4: K-line header locked badge is always stable (ignore stray hrefs in header host).
      if (isGmgnHeaderMarkedCard(card) || isGmgnTokenHeaderCard(card)) {
        const locked =
          findLocalBadgeForCard(card, marked) ||
          findGmgnHeaderBadgeEl(marked) ||
          card.querySelector?.(`[${ICON_DATA}="1"][data-fee-header="1"]`);
        if (
          locked instanceof HTMLElement &&
          document.contains(locked) &&
          (!locked.dataset.feeToken || locked.dataset.feeToken === marked)
        ) {
          // ⏳ 占位不算 stable：API 回包后必须能被 post-api paint 换掉
          if (locked.dataset.feeLoading === "1") return false;
          const headerEntry = resolveEntry(marked);
          if (headerEntry && isGmgnHostFeeDomMismatch(card, headerEntry)) return false;
          if (headerEntry && isGmgnPoolDomMismatch(card, locked, headerEntry)) return false;
          return true;
        }
      }
      if (countLocalBadgesForCard(card, marked) !== 1) return false;
      const existing = findLocalBadgeForCard(card, marked);
      if (
        !existing ||
        existing.dataset.feeToken !== marked ||
        !document.contains(existing) ||
        !existing.dataset.feeSig
      ) {
        return false;
      }
      if (existing.dataset.feeLoading === "1") return false;
      if (isGmgnTrenchMisplacedBadge(card, existing)) return false;
      const stableEntry = resolveEntry(marked);
      if (stableEntry && isHostFeeEntryPending(stableEntry)) return false;
      if (stableEntry && isGmgnHostFeeDomMismatch(card, stableEntry)) return false;
      if (stableEntry && isGmgnPoolDomMismatch(card, existing, stableEntry)) return false;
      if (stableEntry && isTrustedStockVault(stableEntry)) {
        const domN = extractBasketSymbolsFromTaxDom(card).length;
        const bagN = normalizeBasketAssets(stableEntry.basket_assets).length;
        if (domN > bagN) return false;
      }
      if (stableEntry) {
        const wantBasket = getBasketAssetsForDisplay(stableEntry).length;
        const haveBasket = Number(existing.dataset.feeBasketCount || 0);
        if (wantBasket !== haveBasket) return false;
      }
      // Text may lag dataset for a frame; prefer sig, fall back to text once.
      if (existing.textContent && existing.textContent !== existing.dataset.feeSig) {
        return false;
      }
      const want = getActiveBadgePosition(card).enabled ? "absolute" : "default";
      const have = existing.dataset.feePosMode || "default";
      if (have !== want) return false;
      if (want === "absolute") {
        const pos = getActiveBadgePosition(card);
        if (
          existing.dataset.feeOx !== String(pos.x) ||
          existing.dataset.feeOy !== String(pos.y)
        ) {
          return false;
        }
      }
      // Virtual list recycle: 行身份 CA 必须与 mark/badge 一致（CA 唯一）.
      // Skip for header (multiple 0x links in ticker/share row).
      if (!(existing.dataset.feeHeader === "1" || isGmgnHeaderMarkedCard(card))) {
        if (!cardStillMatchesToken(card, marked)) return false;
        const hrefTok =
          readHostRowToken(card) || extractCardHrefToken(card);
        // 有实心徽章时：必须能读到行身份，且 fee === marked === live
        if (!hrefTok) return false;
        if (hrefTok !== marked) return false;
        if (existing.dataset.feeToken !== hrefTok) return false;
        if (!TARGET_TOKEN_RE.test(hrefTok)) return false;
      }
      return true;
    }

    // Debot / Gungnir: 对齐 GMGN 本地徽章（卡内 + 相邻兄弟），禁止每轮 parent 几何清点。
    if (countLocalBadgesForCard(card, marked) !== 1) return false;
    const existing = findLocalBadgeForCard(card, marked);
    if (
      !existing ||
      existing.dataset.feeToken !== marked ||
      !document.contains(existing) ||
      !existing.dataset.feeSig
    ) {
      return false;
    }
    if (existing.dataset.feeLoading === "1") return false;
    if (
      isDebotHost() &&
      existing.dataset.feeMountSide === "tax-col" &&
      existing.style.position !== "absolute"
    ) {
      return false;
    }
    const want = getActiveBadgePosition(card).enabled ? "absolute" : "default";
    const have = existing.dataset.feePosMode || "default";
    if (have !== want) return false;
    if (want === "absolute") {
      const pos = getActiveBadgePosition(card);
      if (
        existing.dataset.feeOx !== String(pos.x) ||
        existing.dataset.feeOy !== String(pos.y)
      ) {
        return false;
      }
    }
    if (!cardStillMatchesToken(card, marked)) return false;
    const hrefTok = readHostRowToken(card) || extractCardHrefToken(card);
    if (hrefTok) {
      if (hrefTok !== marked) return false;
      if (existing.dataset.feeToken !== hrefTok) return false;
      if (!TARGET_TOKEN_RE.test(hrefTok)) return false;
    } else if (existing.dataset.feeToken !== marked) {
      return false;
    }
    return true;
  }

  function scanVisibleCards() {
    if (shouldDeferGmgnTrenchResizeWork()) return;
    // Also guard idle callbacks that were queued before the click transition was armed.
    if (isTokenEnterTransitionActive()) return;
    if (!tryFinishListReturnTransition("idle-scan")) return;
    if (!persistentCacheReady) {
      scheduleScan(100);
      return;
    }
    if (!isTabVisible()) return;
    // A scan that was queued before a wheel tick may reach its idle callback
    // after scrolling has started. Abort it before any root/card geometry walk.
    if ((isGmgnScrollCooling() || isDebotScrollCooling()) && !isOverlayFast()) return;
    if (!isScanPageAllowed()) {
      // Leave robinhood / 非 BSC clean — 立即卸徽章（勿隔 N 代才清）
      purgeMarksIfChainDisallowed();
      return;
    }

    // Detect SPA path changes missed by history hooks (site may capture native history).
    const routeNow = getRouteKey();
    if (routeNow !== lastRouteKey) {
      onSpaRouteChange("path-poll");
      // Let quiet window absorb the rebuild; settle owns progressive scans.
      if (isSpaQuiet()) return;
    }

    recoverStuckBatch();
    scanGeneration += 1;

    // Capture before getCandidateNodes consumes pendingLightScan.
    // Token SPA: header 就绪后才允许 light-scan；侧栏还有未画卡时必须继续扫战壕。
    let lightScan = pendingLightScan;
    if (
      !lightScan &&
      isTokenPageSettledWithBadge() &&
      isTokenDetailRoute() &&
      !(isGmgnTokenPage() && hasUnpaintedGmgnSidebarTargets())
    ) {
      lightScan = true;
    }
    if (isDebotTokenPage() && extractTokenFromUrl() && !hasDebotTokenHeaderBadge()) {
      lightScan = false;
      pendingLightScan = false;
      tryPaintDebotTokenHeader("scan-pre");
    }
    if (isGmgnTokenPage() && extractTokenFromUrl() && !hasGmgnTokenHeaderBadge()) {
      lightScan = false;
      pendingLightScan = false;
      tryPaintGmgnTokenHeader("scan-pre");
    }
    const listReturnSoft = isSpaListReturnSoft();
    const listReturnCacheOnly = isSpaListReturnCacheOnly();
    const overlayFast = isOverlayFast();
    // Overlay open: cache-first burst before full card loop (0.4.38).
    if (!isGmgnHost() && (overlayFast || quickHasOpenOverlay())) {
      try {
        fastPaintOverlayFromCache();
      } catch (_err) {
        // ignore
      }
    }
    const seenCards = new Set();
    const nodes = siteStrategy.getCandidateNodes();
    let touched = 0;
    let rendered = 0;
    let queued = 0;
    let skippedCached = 0;
    const budget = cardsPerScanBudget();
    // list-return / overlay / GMGN 战壕首页: tight viewport.
    // 0.7.5: GMGN K 线侧栏用 loose，避免下滑已开盘行被 40px pad 饿死。
    // Debot token side boards may use loose.
    const looseView =
      listReturnSoft || overlayFast
        ? false
        : isGmgnHost()
          ? isGmgnTokenPage() || isTokenDetailRoute()
          : lightScan || isTokenDetailRoute();

    // Expensive re-extract cleanup is rare — skip deep cleanup during list-return soft.
    // GMGN: never deep cleanup on return soft / scroll cool (DOM thrash).
    if (
      !listReturnSoft &&
      !(isGmgnHost() && isGmgnScrollCooling()) &&
      scanGeneration % CLEANUP_EVERY_N_SCANS === 0
    ) {
      cleanupMarkedCards({ deep: false });
    }

    // Collect unique visible cards first, then prioritize unpainted (Debot 右列饿死修复).
    // list-return: pair node(href) → quick climb (no Tax climbToCard).
    const allCards = [];
    /** @type {Map<Element, string>} */
    const listReturnTokenHint = new Map();
    for (const node of nodes) {
      if (!isNearViewport(node, looseView)) continue;
      let card;
      let hrefTok = null;
      if (listReturnSoft) {
        // 0.4.39: Tax/short seeds + strategy findCard first (href-only climb was dead).
        const resolved = resolveListReturnSeed(node);
        if (resolved) {
          card = resolved.card;
          hrefTok = resolved.token;
        } else {
          hrefTok = normalizeToken(
            (node.getAttribute && node.getAttribute("href")) || node.href || ""
          );
          card =
            (siteStrategy.findCard && siteStrategy.findCard(node)) ||
            (hrefTok ? quickClimbCardFromTokenLink(node) : null);
        }
      } else {
        card = siteStrategy.findCard(node);
      }
      if (!card || seenCards.has(card) || !isVisible(card)) continue;
      // Reject full-page shells (token SPA leftover / body mark).
      if (card === document.body || card === document.documentElement) continue;
      if (isBadgeMountForbidden(card)) {
        wipeForbiddenMountBadges(card, true);
        continue;
      }
      {
        const cr = card.getBoundingClientRect();
        if (cr.height > window.innerHeight * 0.85 && cr.width > window.innerWidth * 0.85) {
          continue;
        }
      }
      seenCards.add(card);
      allCards.push(card);
      if (hrefTok) listReturnTokenHint.set(card, hrefTok);
    }

    // 0.4.15: keep outermost cards only — nested climbToCard caused 2 badges on 1 visual row.
    // list-return / GMGN viewport-only: skip O(n²) contains (small n; host not nesting).
    const outerCards =
      listReturnSoft || isGmgnHost()
        ? allCards
        : allCards.filter((card) => {
            return !allCards.some((other) => other !== card && other.contains(card));
          });

    const needWork = [];
    for (const card of outerCards) {
      // Nested mark cleanup: drop CARD_MARK on discarded inner nodes.
      // (handled by only painting outerCards)
      if (isBadgeMountForbidden(card)) {
        wipeForbiddenMountBadges(card, true);
        continue;
      }

      // ★ 0.6.11：稳定正确卡走 gate 快路径；仅嫌疑卡全量 enforce（防卡顿）
      const idGate = gateCardIdentity(card);
      if (!idGate.allowed) {
        // 非目标 / 无身份：已拆徽章，不入队不绘制
        continue;
      }

      // 0.4.48 Debot absolute: skip nested marked hosts — only outermost paints.
      if (
        !listReturnSoft &&
        getActiveBadgePosition(card).enabled &&
        isNestedFeeCard(card)
      ) {
        removeAllBadgesForCard(card, card.dataset[CARD_MARK] || "");
        try {
          delete card.dataset[CARD_MARK];
          card.removeAttribute(CARD_DATA);
        } catch (_errNest) {
          // ignore
        }
        continue;
      }

      if (!listReturnSoft && isStablePaintedCard(card, false)) {
        // 0.4.10: stale feeSig may keep wrong 🪙BNB after API has 币安人生 — cheap recheck.
        const marked = card.dataset[CARD_MARK];
        const existing = marked ? findLocalBadgeForCard(card, marked) : null;
        const entry = marked ? getEntryForCard(card, marked) : null;
        // 占位 + 已有正式 entry → 必须进 needWork 换真徽章
        if (existing && existing.dataset.feeLoading === "1" && entry) {
          needWork.push(card);
        } else if (
          existing &&
          entry &&
          !isGmgnHost() &&
          poolBadgeNeedsQuoteRefresh(existing, entry, card)
        ) {
          needWork.push(card);
        } else {
          skippedCached += 1;
          // Stable cards do NOT consume budget — left/mid columns must not starve 已开盘.
        }
      } else if (listReturnSoft) {
        // Virtual rows may retain our DOM while React swaps the underlying token.
        // Reuse only when the badge still belongs to the card's live address.
        const existing = card.querySelector(`[${ICON_DATA}="1"]`);
        if (existing) {
          const er = existing.getBoundingClientRect();
          const existingToken = existing.dataset.feeToken || "";
          const liveHref = extractCardHrefToken(card);
          // href 已是新 CA / 非目标：立刻清旧徽章，禁止「先错后对」
          if (
            liveHref &&
            (!TARGET_TOKEN_RE.test(liveHref) ||
              (existingToken && liveHref !== existingToken))
          ) {
            clearCardIcon(card);
            needWork.push(card);
            continue;
          }
          const identityOk =
            Boolean(existingToken) && cardStillMatchesToken(card, existingToken);
          // 合法 ⏳：身份仍对且尚无 entry → 保留占位，勿 clear 造成闪烁
          if (
            existing.dataset.feeLoading === "1" &&
            identityOk &&
            !resolveEntry(existingToken)
          ) {
            skippedCached += 1;
            continue;
          }
          // ⏳ 且已有正式 entry → 进 needWork 换成真徽章
          if (existing.dataset.feeLoading === "1" && identityOk && resolveEntry(existingToken)) {
            needWork.push(card);
            continue;
          }
          if (
            er.width >= 2 &&
            er.height >= 2 &&
            existingToken &&
            existing.dataset.feeLoading !== "1" &&
            identityOk
          ) {
            skippedCached += 1;
            continue;
          }
          // 身份对不上或残缺节点 → 拆掉重算
          clearCardIcon(card);
        }
        needWork.push(card);
      } else {
        needWork.push(card);
      }
    }

    // 0.4.21: unpainted first — new 战壕 rows must not starve behind remounts.
    // 0.4.36 list-return: prefer unpainted columns + cache hits (已迁移/右列优先补洞).
    if (listReturnSoft) {
      const colCounts = countVisibleBadgesByColumn();
      needWork.sort((a, b) => {
        const ca = listColumnBucket(a);
        const cb = listColumnBucket(b);
        // Columns with fewer badges first
        const colPri = colCounts[ca] - colCounts[cb];
        if (colPri !== 0) return colPri;
        const ta = listReturnTokenHint.get(a) || a.dataset[CARD_MARK] || "";
        const tb = listReturnTokenHint.get(b) || b.dataset[CARD_MARK] || "";
        const ea = ta && resolveEntry(ta) ? 0 : 1;
        const eb = tb && resolveEntry(tb) ? 0 : 1;
        return ea - eb;
      });
    } else {
      needWork.sort((a, b) => {
        const ab = a.querySelector?.(`[${ICON_DATA}="1"]`) ? 1 : 0;
        const bb = b.querySelector?.(`[${ICON_DATA}="1"]`) ? 1 : 0;
        return ab - bb;
      });
    }

    let truncated = false;
    const sliceBudgetMs = listReturnSoft ? SPA_LIST_RETURN_SLICE_MS : 0;
    const sliceStarted = sliceBudgetMs > 0 ? performance.now() : 0;
    for (const card of needWork) {
      if (touched >= budget) {
        truncated = true;
        break;
      }
      // Hard time slice — prevent single longtask ~600ms on GMGN return (js-mcp 0.4.31).
      if (sliceBudgetMs > 0 && performance.now() - sliceStarted > sliceBudgetMs) {
        truncated = true;
        break;
      }

      // 身份 CA 唯一：优先行自身 href，禁止 hint/short 覆盖成别的 CA
      // GMGN：TokenItem href 优先；瞬时无 href 时允许 extractToken（ffff/7777 同权，勿直接 continue 饿死）
      let token = extractCardHrefToken(card);
      if (!token || !TARGET_TOKEN_RE.test(token)) {
        if (isGmgnHost()) {
          const rawHref = card.getAttribute?.("href") || "";
          if (rawHref && rawHref.indexOf("/token/") !== -1) {
            const any = extractAnyToken(rawHref);
            if (any && !TARGET_TOKEN_RE.test(any)) {
              // 4444 等非目标：拆残留 7777 徽章
              wipeNonTargetCardBadges(card, any);
              continue;
            }
            if (any && TARGET_TOKEN_RE.test(any)) {
              token = any;
            }
          }
          if (!token || !TARGET_TOKEN_RE.test(token)) {
            // 回退 extract（仍受 identityTokenFromValue 禁社交链接约束）
            const fb = siteStrategy.extractToken(card);
            if (fb && TARGET_TOKEN_RE.test(fb)) {
              token = fb;
            } else {
              if (!listReturnSoft && !token) clearCardIcon(card);
              if (!token || !TARGET_TOKEN_RE.test(token)) continue;
            }
          }
        } else {
          token = siteStrategy.extractToken(card);
        }
      }
      // hint 仅当与身份一致时可用
      const hint = listReturnTokenHint.get(card);
      if (hint && token && hint !== token) {
        // ignore stale hint
      } else if (!token && hint && TARGET_TOKEN_RE.test(hint) && !isGmgnHost()) {
        token = hint;
      }
      if (!token) {
        // 非目标 CA（4444 等，ffff 是目标）：始终拆徽章，即使 soft 路径
        const idCa = extractCardHrefToken(card);
        if (idCa && !TARGET_TOKEN_RE.test(idCa)) {
          wipeNonTargetCardBadges(card, idCa);
          continue;
        }
        // 0.5.3: never wipe GMGN K-line header mark on transient extract miss
        // (was flash-then-gone: tryPaint mounts → scan extractToken fails → clear).
        if (!listReturnSoft && !(isGmgnHost() && isGmgnHeaderMarkedCard(card))) {
          clearCardIcon(card);
        }
        continue;
      }
      // 再强制一次：token 必须等于行 CA；并拆 feeToken≠token 的旧徽章
      const liveId = extractCardHrefToken(card);
      if (liveId && liveId !== token) {
        enforceIdentityOnCard(card);
        continue;
      }
      try {
        const stale = card.querySelector?.(`[${ICON_DATA}="1"]`);
        if (
          stale instanceof HTMLElement &&
          stale.dataset.feeToken &&
          stale.dataset.feeToken !== token
        ) {
          removeAllBadgesForCard(card, stale.dataset.feeToken);
        }
      } catch (_stale) {
        // ignore
      }

      // Cache-only wave: skip cards without in-memory fee (paint later idle slices).
      const entryEarly = resolveEntry(token);
      if (listReturnCacheOnly && !entryEarly) {
        continue;
      }

      card.dataset[CARD_MARK] = token;
      touched += 1;

      const entry = entryEarly || resolveEntry(token);
      if (entry) {
        // list-return fast paint (no Tax search / no multi-badge geometry).
        if (listReturnSoft) {
          if (paintListCardFromCacheFast(card, token, entry)) {
            rendered += 1;
            continue;
          }
        }
        // Doubles always remount (isStable may have been false but fast path still ran).
        // GMGN: local count only — full parent-rect walk is Debot double-badge path.
        if (
          !listReturnSoft &&
          (isGmgnHost()
            ? countLocalBadgesForCard(card, token) > 1
            : countBadgesNearCard(card, token) > 1)
        ) {
          renderMode(card, token, entry, { forceRemount: true });
          rendered += 1;
          continue;
        }
        // Fast path: badge already correct — zero layout remount.
        const existing = card.querySelector(`[${ICON_DATA}="1"]`);
        if (
          existing &&
          document.contains(existing) &&
          existing.dataset.feeToken === token
        ) {
          if (isGmgnTrenchMisplacedBadge(card, existing)) {
            renderMode(card, token, entry, { forceRemount: true });
            rendered += 1;
            continue;
          }
          // 正式数据已到：立刻把 ⏳待加载 换成真徽章
          if (existing.dataset.feeLoading === "1") {
            renderMode(card, token, entry, { forceRemount: false });
            rendered += 1;
            continue;
          }
          // 必须用当前 entry 重算 label；禁止仅凭 feeSig 自洽就跳过（会卡在旧/错徽章）
          const quoteSymbol = resolveQuoteSymbol(card, entry);
          const presentation = computeBadgePresentation(entry, quoteSymbol, token);
          const { label, className, basketCount } = presentation;
          if (
            label &&
            existing.dataset.feeSig === label &&
            existing.textContent === existing.dataset.feeSig &&
            String(existing.dataset.feeBasketCount || "0") === String(basketCount || 0)
          ) {
            // Keep absolute coords in sync; mode mismatch → fall through to remount.
            const pos = getActiveBadgePosition(card);
            const want = pos.enabled ? "absolute" : "default";
            const have = existing.dataset.feePosMode || "default";
            if (have === want) {
              if (
                pos.enabled &&
                (existing.dataset.feeOx !== String(pos.x) ||
                  existing.dataset.feeOy !== String(pos.y))
              ) {
                applyAbsoluteBadgeStyles(existing, pos.x, pos.y);
              }
              skippedCached += 1;
              rendered += 1;
              continue;
            }
          }
          const textEl = existing.querySelector(".gmgn-fee-mode-icon__text");
          const shown = textEl ? textEl.textContent : existing.textContent;
          const countEl = existing.querySelector(".gmgn-fee-mode-icon__count");
          const haveCount = countEl ? countEl.textContent || "" : "";
          const wantCount = (basketCount || 0) >= 3 ? String(basketCount) : "";
          const wantClick = isOpenTaxinfoEnabled();
          const wantClass = wantClick
            ? `${className} gmgn-fee-mode-icon--clickable`.trim()
            : className;
          if (
            label &&
            shown === label &&
            existing.className === wantClass &&
            (existing.dataset.feeOpenTaxinfo === "1") === wantClick &&
            haveCount === wantCount
          ) {
            existing.dataset.feeSig = label;
            const pos = getActiveBadgePosition(card);
            if (pos.enabled) applyAbsoluteBadgeStyles(existing, pos.x, pos.y);
            else syncBadgeDragCursor(existing);
            skippedCached += 1;
            rendered += 1;
            continue;
          }
          if (label) {
            applyBadgeUi(existing, presentation, token);
            const pos = getActiveBadgePosition(card);
            if (pos.enabled) applyAbsoluteBadgeStyles(existing, pos.x, pos.y);
            else syncBadgeDragCursor(existing);
            skippedCached += 1;
            rendered += 1;
            continue;
          }
        }
        if (badgeNeedsUpdate(card, token, entry)) {
          renderMode(card, token, entry);
        }
        rendered += 1;
      } else {
        // 无缓存：先画固定「⏳待加载」，再入队 /modes（GMGN + Debot 一致）
        queued += 1;
        if (!listReturnCacheOnly) {
          if (paintLoadingBadgeAndQueue(card, token)) {
            rendered += 1;
          }
        } else {
          queueToken(token, { deferFlush: pageHookHostFeeReady() });
          scheduleHostFeeGraceFlush("list-return-cache");
        }
      }
    }

    // Always continue when work remains (not only SPA) — covers Debot 3-col first paint.
    // 0.4.21: keep light mode on token settled pages so chart full-scan stays off.
    // 0.7.5: GMGN K 线 settled 时禁止因 truncated 强制 light——light root 不扫三列战壕，
    // 会形成「有洞 → light 续扫 → 仍不扫侧栏 → 几十秒无徽章」。
    if (truncated) {
      const tokenTrenchNeedsFull =
        isGmgnHost() && (isGmgnTokenPage() || isTokenDetailRoute());
      const keepLight =
        !tokenTrenchNeedsFull &&
        (lightScan ||
          overlayFast ||
          isTokenPageSettledWithBadge() ||
          quickHasOpenOverlay());
      // list-return: yield to site paint (immediate:false) — 0.4.32 kill stacked longtasks.
      // 0.4.45 GMGN: short delay + stop if first screen already enough (avoid 2s@6 badges).
      if (listReturnSoft && !overlayFast) {
        if (isGmgnHost() && shouldCancelSpaListProgressive()) {
          // First screen good — drop soft window so we do not keep force-scanning.
          spaListReturnUntil = 0;
          spaListReturnCacheOnlyUntil = 0;
        } else {
          scheduleScan(listReturnCacheOnly ? 12 : isGmgnHost() ? 20 : 32, {
            force: true,
            immediate: isGmgnHost(),
            light: false,
            bypassForceGap: true
          });
        }
      } else if (overlayFast) {
        scheduleScan(40, {
          force: true,
          immediate: true,
          light: true,
          bypassForceGap: true
        });
      } else if (isGmgnHost()) {
        if (queued > 0 && requestQueue.size > 0 && !batchActive) {
          maybeFlushRequestQueue("scan-truncated");
        }
        // Steady GMGN: never immediate force storm — idle slice only.
        // token 侧栏截断：light:false + 稍后视口快补
        scheduleScan(120, {
          force: false,
          immediate: false,
          light: keepLight
        });
      } else {
        // Debot/Gungnir used to force an immediate full scan every 60ms while truncated.
        // The scan's own badge mutations retriggered the document observer and starved UI.
        scheduleScan(120, { force: false, immediate: false, light: keepLight });
      }
    } else if (queued > 0 && requestQueue.size > 0 && !batchActive && !batchTimer) {
      maybeFlushRequestQueue("scan-done");
    }

    // 0.4.51: always per-card double-badge cleanup (GMGN+Debot).
    // Never collapse same feeToken across different cards (三栏同 CA).
    if (!listReturnSoft) {
      dedupeBadgesPerCardOnly(outerCards);
    } else if (isGmgnHost() || isDebotHost()) {
      // Soft return still risks double mount on one card after forceAppend/Tax.
      dedupeBadgesPerCardOnly(outerCards);
    }

    // 视口未画 7777/8888/ffff 快补（ffff 与 7777 同权，不被 12 卡 budget 饿死数秒）
    try {
      paintUnpaintedTargetViewportQuick(truncated ? "scan-trunc" : "scan-end");
    } catch (_vp) {
      // ignore
    }

    // 0.6.5 / 0.7.1: 每扫必跑轻量 href 校验 — 拆 4444/非目标行残留、fee≠href（不依赖候选集）
    scrubBadgesToHostHref();
    scrubIdentityMismatchedBadges();

    // Tax-recv hide: re-apply after list paint (map from page-hook; no extra HTTP).
    if (taxRecvHidePrefs.enabled || taxRecvMap.size > 0) {
      scheduleTaxRecvHideApply(listReturnSoft ? 50 : 120);
    }

    debugInfo("scan", {
      site: siteStrategy.name,
      candidates: nodes.length,
      cards: outerCards.length,
      nestedDropped: allCards.length - outerCards.length,
      needWork: needWork.length,
      touched,
      rendered,
      queued,
      skippedCached,
      budget,
      truncated,
      spaQuiet: isSpaQuiet(),
      queueSize: requestQueue.size,
      batchActive
    });
  }

  function badgeDedupeScore(el) {
    let s = 0;
    if (el?.dataset?.feeHeader === "1") s += 100;
    if (el.dataset.feePosMode === "absolute") s += 4;
    if (el.closest?.(`[${CARD_DATA}]`)) s += 2;
    if (el.isConnected) s += 1;
    return s;
  }

  function keepBestBadgeOnly(icons) {
    if (!icons || icons.length <= 1) return;
    // Prefer locked header badge over anything else.
    icons.sort((a, b) => {
      const ha = a?.dataset?.feeHeader === "1" ? 100 : 0;
      const hb = b?.dataset?.feeHeader === "1" ? 100 : 0;
      if (hb !== ha) return hb - ha;
      return badgeDedupeScore(b) - badgeDedupeScore(a);
    });
    for (let i = 1; i < icons.length; i += 1) {
      if (isGmgnLockedHeaderBadge(icons[i])) continue;
      try {
        icons[i].remove();
      } catch (_err) {
        // ignore
      }
    }
  }

  /**
   * 0.4.51: at most one badge per card element.
   * Same CA on other cards is untouched (GMGN 三列 / Debot 三栏).
   * Also collapses true double-mount: card-local icons + adjacent siblings of that card.
   */
  function dedupeBadgesPerCardOnly(cards) {
    const list =
      cards && cards.length
        ? cards
        : Array.from(document.querySelectorAll(`[${CARD_DATA}]`));
    list.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const token = card.dataset[CARD_MARK] || card.getAttribute(CARD_DATA) || "";
      /** @type {HTMLElement[]} */
      const icons = [];
      try {
        card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (token && n.dataset.feeToken && n.dataset.feeToken !== token) return;
          icons.push(n);
        });
      } catch (_err) {
        // ignore
      }
      for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
        if (!(sib instanceof HTMLElement)) continue;
        if (sib.dataset?.[ICON_MARK] !== "1" && !sib.matches?.(`[${ICON_DATA}="1"]`)) {
          continue;
        }
        if (token && sib.dataset.feeToken && sib.dataset.feeToken !== token) continue;
        if (!icons.includes(sib)) icons.push(sib);
      }
      // Parent children stacked on this card only (geometry) — not other columns.
      const parent = card.parentElement;
      if (parent && icons.length <= 1) {
        Array.from(parent.children).forEach((ch) => {
          if (!(ch instanceof HTMLElement) || ch === card) return;
          if (ch.dataset?.[ICON_MARK] !== "1" && ch.getAttribute?.(ICON_DATA) !== "1") {
            return;
          }
          if (token && ch.dataset.feeToken && ch.dataset.feeToken !== token) return;
          if (icons.includes(ch)) return;
          try {
            const cr = card.getBoundingClientRect();
            const ir = ch.getBoundingClientRect();
            if (Math.abs(ir.top - cr.top) > cr.height + 8) return;
            if (ir.right < cr.left - 8 || ir.left > cr.right + 8) return;
            icons.push(ch);
          } catch (_err) {
            // ignore
          }
        });
      }
      keepBestBadgeOnly(icons);
    });
  }

  /**
   * Keep at most one badge per marked card (or per visual host).
   * Same feeToken on DIFFERENT cards (新创建/即将打满/已开盘) must all remain.
   * Only collapses true double-mount on the same card / same pixel stack.
   */
  function dedupeBadgesByToken() {
    /** @type {Map<Element, HTMLElement[]>} */
    const byCard = new Map();
    /** @type {HTMLElement[]} */
    const orphans = [];

    document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      if (!icon.dataset.feeToken) {
        try {
          icon.remove();
        } catch (_err) {
          // ignore
        }
        return;
      }
      let host = icon.closest?.(`[${CARD_DATA}]`);
      if (!(host instanceof HTMLElement)) {
        const next = icon.nextElementSibling;
        const prev = icon.previousElementSibling;
        if (next instanceof HTMLElement && next.dataset?.[CARD_MARK]) host = next;
        else if (prev instanceof HTMLElement && prev.dataset?.[CARD_MARK]) host = prev;
      }
      if (host instanceof HTMLElement) {
        if (!byCard.has(host)) byCard.set(host, []);
        byCard.get(host).push(icon);
      } else {
        orphans.push(icon);
      }
    });

    byCard.forEach((icons) => keepBestBadgeOnly(icons));

    // Orphans (no card host): only merge true overlaps (same token + same screen cell).
    // Geometry in key prevents wiping another column's same-CA orphan.
    /** @type {Map<string, HTMLElement[]>} */
    const orphanCells = new Map();
    orphans.forEach((icon) => {
      let key = icon.dataset.feeToken || "";
      try {
        const r = icon.getBoundingClientRect();
        key = `${key}|${Math.round(r.top / 10)}|${Math.round(r.left / 10)}`;
      } catch (_err) {
        // If no geometry, isolate by object identity-ish left unknown — skip merge.
        key = `${key}|id:${iconsIdentity(icon)}`;
      }
      if (!orphanCells.has(key)) orphanCells.set(key, []);
      orphanCells.get(key).push(icon);
    });
    orphanCells.forEach((icons) => keepBestBadgeOnly(icons));
  }

  function iconsIdentity(el) {
    try {
      return String(el.dataset.feeSig || el.textContent || "").slice(0, 24);
    } catch (_err) {
      return "x";
    }
  }

  function isPipelineStuck(now, ageMs) {
    if (
      batchActive &&
      (ageMs >= RESUME_FORCE_MIN_AGE_MS || ageMs >= BATCH_STUCK_MS || !batchStartedAt)
    ) {
      return true;
    }
    if (
      hotLaneActive &&
      hotLaneStartedAt &&
      now - hotLaneStartedAt >= RESUME_FORCE_MIN_AGE_MS
    ) {
      return true;
    }
    if (scanScheduled && scanTimerIds.length === 0) return true;
    if (consecutiveFails > 0 && (batchActive || activeBatchTokens.length > 0)) {
      return true;
    }
    return false;
  }

  function softResumeLongHidden(now, ageMs) {
    if (
      batchActive &&
      (ageMs >= RESUME_FORCE_MIN_AGE_MS || ageMs >= BATCH_STUCK_MS || !batchStartedAt)
    ) {
      recoverStuckBatch(true, "resume-long-hidden-soft");
    }
    if (
      hotLaneActive &&
      hotLaneStartedAt &&
      now - hotLaneStartedAt >= RESUME_FORCE_MIN_AGE_MS
    ) {
      resetHotLane("resume-long-hidden-soft", true);
    }
    if (scanScheduled && scanTimerIds.length === 0) scanScheduled = false;
    debugInfo("tab:resume-soft", {
      queueSize: requestQueue.size,
      batchActive,
      batchAgeMs: ageMs || null
    });
  }

  /**
   * Full pipeline revive after long tab freeze.
   * batchActive zombies prevent scheduleBatchFlush → new tokens never show (user: must refresh).
   * Idle / queue-only resumes log as info (not warn) to avoid Chrome "Errors" spam.
   */
  function hardResetPipeline(reason, options = {}) {
    const noisy = options.noisy === true;
    const requeue = activeBatchTokens.slice();
    const payload = {
      reason,
      batchActive,
      batchAgeMs: batchStartedAt ? Date.now() - batchStartedAt : 0,
      queueSize: requestQueue.size,
      requeue: requeue.length,
      consecutiveFails
    };
    const stuck = batchActive || requeue.length > 0 || consecutiveFails > 0;
    if (noisy && stuck) {
      debugWarn("pipeline:hard-reset", payload);
    } else {
      debugInfo("pipeline:hard-reset", payload);
    }

    batchGeneration += 1;
    abortActiveRequest(reason);
    resetHotLane(reason, true);
    activeBatchTokens.forEach((token) => requestQueue.add(token));
    activeBatchTokens = [];
    batchActive = false;
    batchStartedAt = 0;
    consecutiveFails = 0;

    if (batchTimer) {
      window.clearTimeout(batchTimer);
      batchTimer = null;
    }
    hostFeePendingPaintTimers.forEach((id) => {
      try {
        window.clearTimeout(id);
      } catch (_tm) {
        // ignore
      }
    });
    hostFeePendingPaintTimers.clear();
    loadingModesKickTimers.forEach((id) => {
      try {
        window.clearTimeout(id);
      } catch (_kick) {
        // ignore
      }
    });
    loadingModesKickTimers.clear();
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    lastScanAt = 0;
    clearSpaNavScanTimers();
    spaDomDirty = false;

    // MutationObserver can go silent after SPA document swaps / freeze.
    try {
      scanRootsCache = { at: 0, roots: [] };
      gmgnSteadyRoundRobinRow = 0;
      if (typeof mutationObserver !== "undefined" && mutationObserver) {
        rebindMutationObserver();
      }
    } catch (_err) {
      // ignore
    }
  }

  function startPipelineWatchdog() {
    if (pipelineWatchdogId) return;
    pipelineWatchdogId = window.setInterval(() => {
      if (!isExtensionContextValid()) return;
      if (!isTabVisible()) return;

      let unhealthy = false;

      // Heal stuck batch without waiting for user resume.
      if (batchActive) {
        const ageMs = batchStartedAt ? Date.now() - batchStartedAt : BATCH_STUCK_MS + 1;
        if (ageMs >= BATCH_STUCK_MS || !batchStartedAt) {
          recoverStuckBatch(true, "watchdog-batch");
          unhealthy = true;
        }
      }
      // 0.7.57: heal stuck hot lane the same way (requeue its tokens).
      if (hotLaneActive) {
        const hotAgeMs = hotLaneStartedAt
          ? Date.now() - hotLaneStartedAt
          : BATCH_STUCK_MS + 1;
        if (hotAgeMs >= BATCH_STUCK_MS) {
          resetHotLane("watchdog-hot-lane", true);
          unhealthy = true;
        }
      }

      // Queue has work but nothing is pumping.
      if (!batchActive && requestQueue.size > 0 && !batchTimer) {
        scheduleBatchFlush({ immediate: true });
        unhealthy = true;
      }

      // scanScheduled lock with no timer = dead
      if (scanScheduled && scanTimerIds.length === 0) {
        scanScheduled = false;
        unhealthy = true;
      }

      // 0.4.0 bug: force full XPath scan every 12s → 用户反馈「超级卡」. Only scan when unhealthy.
      if (unhealthy) {
        scheduleScan(0, { force: true, immediate: true });
      }
    }, PIPELINE_WATCHDOG_MS);
  }

  /**
   * Tab left in background freezes timers/fetch; coming back must unstick pipeline
   * and repaint without requiring a full page reload.
   *
   * 0.4.5: short blur / focus / popup open must NOT force-remount every badge
   * (that was the main jank vs 0.3.4). Heavy path only after long hidden.
   */
  function onTabResume(reason) {
    if (!isExtensionContextValid() || !isTabVisible()) return;
    const now = Date.now();
    // Debounce focus+visibility double fire (short).
    if (now - lastResumeAt < 600) return;
    lastResumeAt = now;

    const hiddenMs = hiddenSinceMs > 0 ? now - hiddenSinceMs : 0;
    const inferredHidden = hiddenMs > 0 ? hiddenMs : 0;
    hiddenSinceMs = 0;
    const ageMs = batchStartedAt ? now - batchStartedAt : 0;
    const longHidden = inferredHidden >= RESUME_LONG_HIDDEN_MS;
    const pipelineStuck = isPipelineStuck(now, ageMs);

    debugInfo("tab:resume", {
      reason,
      queued: requestQueue.size,
      batchActive,
      batchAgeMs: ageMs || null,
      hiddenMs: inferredHidden || null,
      longHidden,
      pipelineStuck
    });

    startPipelineWatchdog();

    // Short blur / mere focus: heal stuck batch only; soft one scan. No remount storm.
    if (!longHidden) {
      if (
        batchActive &&
        (ageMs >= RESUME_FORCE_MIN_AGE_MS || ageMs >= BATCH_STUCK_MS || !batchStartedAt)
      ) {
        recoverStuckBatch(true, "resume-old-batch");
      }
      // 0.7.57: 冻结期间挂起的热通道请求同样按龄回收。
      if (
        hotLaneActive &&
        hotLaneStartedAt &&
        now - hotLaneStartedAt >= RESUME_FORCE_MIN_AGE_MS
      ) {
        resetHotLane("resume-old-hot-lane", true);
      }
      if (scanScheduled && scanTimerIds.length === 0) scanScheduled = false;
      if (requestQueue.size > 0) scheduleBatchFlush({ immediate: true });
      // focus alone (extension popup / DevTools) → skip; visibility short return → soft scan
      if (reason !== "focus") {
        scheduleScan(80, { force: false, immediate: false });
      }
      return;
    }

    // Long freeze: hard-reset only when batch/scan truly stuck; queue backlog → soft path.
    if (pipelineStuck && now - lastHardResetAt >= HARD_RESET_RESUME_GAP_MS) {
      hardResetPipeline("resume-long-hidden", { noisy: true });
      lastHardResetAt = now;
    } else {
      softResumeLongHidden(now, ageMs);
    }
    if (requestQueue.size > 0) scheduleBatchFlush({ immediate: true });
    if (reason !== "focus") {
      scheduleScan(120, { force: false, immediate: false });
    }
  }

  function abortActiveRequest(reason) {
    if (!activeAbortController) return;
    try {
      activeAbortController.abort(reason || "aborted");
    } catch (_err) {
      // ignore
    }
    activeAbortController = null;
  }

  function recoverStuckBatch(force = false, reason = "timeout") {
    if (!batchActive) return;
    const ageMs = batchStartedAt ? Date.now() - batchStartedAt : 0;
    // Treat missing startedAt as already stuck.
    if (!force && batchStartedAt && ageMs < BATCH_STUCK_MS) return;
    if (!force && !batchStartedAt) {
      // fall through
    }
    // Prefer quiet log for forced recover; warn only for true long stuck.
    const payload = {
      force,
      reason,
      ageMs: ageMs || null,
      requeue: activeBatchTokens.length
    };
    if (force && ageMs < BATCH_STUCK_MS) {
      debugInfo("batch:recover-stuck", payload);
    } else {
      debugWarn("batch:recover-stuck", payload);
    }
    // Bump generation first so in-flight catch/finally ignore stale completion.
    batchGeneration += 1;
    abortActiveRequest(reason);
    // Tokens already removed from queue for this batch — put them back.
    activeBatchTokens.forEach((token) => requestQueue.add(token));
    activeBatchTokens = [];
    batchActive = false;
    batchStartedAt = 0;
  }

  function isAbortError(error) {
    if (!error) return false;
    if (error.name === "AbortError") return true;
    const message = String(error.message || error || "");
    return /aborted|AbortError/i.test(message);
  }

  function isTransientNetworkError(error) {
    if (isAbortError(error)) return true;
    const message = String(error?.message || error || "");
    return /Failed to fetch|NetworkError|network error|Load failed|fetch/i.test(message);
  }

  function nextRetryDelayMs() {
    const exp = Math.min(consecutiveFails, 4);
    return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** exp);
  }

  /**
   * js-mcp research (GMGN home / Debot meme):
   * - GMGN: ~3 columns `flex flex-col flex-1 … overflow-hidden`, ~13 short CAs each;
   *   full CA mostly in `a[href*='0x…7777|8888']` (~40–50 hrefs). Prefer href, skip body XPath.
   * - Debot: 3× `MuiCard-root` (新创建/即将打满/已迁移) ~9 shorts each; observe cards not whole app.
   */
  function getGmgnFixedSurfaceRoots() {
    if (!isGmgnHost() || !document.querySelectorAll) return [];
    const roots = [];
    const push = (el) => {
      if (!(el instanceof HTMLElement) || !el.isConnected || roots.includes(el)) return;
      if (roots.some((root) => root.contains(el))) return;
      for (let i = roots.length - 1; i >= 0; i -= 1) {
        if (el.contains(roots[i])) roots.splice(i, 1);
      }
      roots.push(el);
    };
    const addTrenchRoot = (el) => {
      if (!(el instanceof HTMLElement)) return;
      if (isGmgnWalletTrackPanel(el) || isGmgnFavoritesPanel(el)) return;
      const r = el.getBoundingClientRect();
      if (
        r.width < 180 ||
        r.height < 120 ||
        r.bottom <= -GMGN_TOKEN_TRENCH_VIEWPORT_PAD_TOP ||
        r.top >= window.innerHeight + GMGN_TOKEN_TRENCH_VIEWPORT_PAD_Y
      ) {
        return;
      }
      push(el);
    };

    const exactTrenches = Array.from(
      document.querySelectorAll(GMGN_FIXED_TRENCH_ROOT_SELECTOR)
    );
    exactTrenches.forEach(addTrenchRoot);

    // Compatibility fallback only when neither stable PumpSubX variant is present.
    if (!exactTrenches.length) {
      const fallback = [];
      document.querySelectorAll(GMGN_TRENCH_ROOT_SELECTOR).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const r = el.getBoundingClientRect();
        if (r.width >= 180 && r.height >= 160) {
          fallback.push({ el, area: r.width * r.height });
        }
      });
      fallback.sort((a, b) => b.area - a.area);
      fallback.slice(0, isGmgnTokenPage() ? 4 : 3).forEach(({ el }) => addTrenchRoot(el));
    }

    const exactSearch = Array.from(
      document.querySelectorAll(GMGN_FIXED_SEARCH_ROOT_SELECTOR)
    ).find((el) => {
      if (
        !(el instanceof HTMLElement) ||
        isExplicitlyHiddenOverlay(el) ||
        isGmgnWalletTrackPanel(el) ||
        isGmgnFavoritesPanel(el)
      ) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 260 && r.height >= 100 && r.bottom > 0 && r.top < window.innerHeight;
    });
    if (exactSearch instanceof HTMLElement) {
      push(exactSearch);
    } else {
      const searchPanel = findGmgnSearchPanelRoot();
      if (
        searchPanel instanceof HTMLElement &&
        !isExplicitlyHiddenOverlay(searchPanel) &&
        !isGmgnWalletTrackPanel(searchPanel) &&
        !isGmgnFavoritesPanel(searchPanel)
      ) {
        push(searchPanel);
      }
    }

    if (isGmgnTokenPage()) {
      const address = document.querySelector("#token-base-address");
      if (address instanceof HTMLElement) {
        push(address.parentElement instanceof HTMLElement ? address.parentElement : address);
      }
    }
    return roots.slice(0, 8);
  }

  /**
   * Debot 固定表面：三列 MuiPaper + 开着的搜索 Dialog。
   * 用来 scoped observer / 扫根，避免 documentElement 吃到行情/侧栏/图表。
   */
  function getDebotFixedSurfaceRoots() {
    if (!isDebotHost() || !document.querySelectorAll) return [];
    const roots = [];
    const push = (el) => {
      if (!(el instanceof HTMLElement) || !el.isConnected || roots.includes(el)) return;
      if (roots.some((root) => root.contains(el))) return;
      for (let i = roots.length - 1; i >= 0; i -= 1) {
        if (el.contains(roots[i])) roots.splice(i, 1);
      }
      roots.push(el);
    };
    if (isDebotTokenPage()) {
      const header = findDebotTokenHeaderCard();
      if (header instanceof HTMLElement) push(header);
    }
    if (!isDebotTokenPage() || hasDebotTokenHeaderBadge()) {
      document.querySelectorAll(".MuiCard-root, div.MuiPaper-root.MuiCard-root").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (isDebotSideRailCard(el)) return;
        const r = el.getBoundingClientRect();
        if (
          r.width >= 240 &&
          r.width <= 820 &&
          r.height >= 240 &&
          r.left >= 240 &&
          r.top < window.innerHeight
        ) {
          push(el);
        }
      });
    }
    collectOpenDialogRoots(roots);
    return roots.slice(0, 6);
  }

  function getScanRoots(forceRefresh = false) {
    const now = Date.now();
    // Dialog just opened: don't wait for roots TTL (search modal must appear in same second).
    if (
      !forceRefresh &&
      document.querySelector?.('[role="dialog"], [role="alertdialog"]') &&
      scanRootsCache.roots.length > 0 &&
      !scanRootsCache.roots.some((r) => r.isConnected && isDialogRoot(r))
    ) {
      forceRefresh = true;
    }
    if (isGmgnTokenPage() && scanRootsCache.roots.length > 0) {
      const trenchN = document.querySelectorAll(GMGN_FIXED_TRENCH_ROOT_SELECTOR).length;
      let cachedTrenchN = 0;
      for (let i = 0; i < scanRootsCache.roots.length; i += 1) {
        if (scanRootsCache.roots[i]?.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)) {
          cachedTrenchN += 1;
        }
      }
      if (trenchN > cachedTrenchN) forceRefresh = true;
    }
    if (
      !forceRefresh &&
      scanRootsCache.roots.length > 0 &&
      now - scanRootsCache.at < SCAN_ROOTS_TTL_MS
    ) {
      // Drop detached roots
      const alive = scanRootsCache.roots.filter(
        (r) =>
          r.isConnected &&
          (!isGmgnHost() ||
            (!isGmgnWalletTrackPanel(r) && !isGmgnFavoritesPanel(r)))
      );
      if (alive.length) {
        scanRootsCache.roots = alive;
        return alive;
      }
    }

    const roots = [];
    const host = location.hostname || "";

    if (host.endsWith("gmgn.ai")) {
      roots.push(...getGmgnFixedSurfaceRoots());
    } else if (host.endsWith("debot.ai") || host.endsWith("gungnir.bot")) {
      roots.push(...getDebotFixedSurfaceRoots());
      if (isDebotTokenPage()) {
        const header = findDebotTokenHeaderCard();
        if (header instanceof HTMLElement && !roots.includes(header)) roots.unshift(header);
        const topShort = findDebotTopShortLeaf(extractTokenFromUrl(), document.body);
        if (topShort?.parentElement instanceof HTMLElement) {
          roots.unshift(topShort.parentElement);
        }
      }
    }

    // Open overlays only (search / history). Zero cost when closed — not full-page walk.
    collectOpenDialogRoots(roots);

    // Dedup nested roots (keep outermost-ish by area sort then filter contained)
    const uniq = [];
    roots.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    });
    for (const r of roots) {
      if (uniq.some((u) => u.contains(r) || r.contains(u))) {
        // Prefer medium columns over full-viewport wrappers; always keep dialogs.
        const rr = r.getBoundingClientRect();
        const isDlg = isDialogRoot(r);
        if (!isDlg && rr.width > window.innerWidth * 0.85) continue;
      }
      if (!uniq.includes(r)) uniq.push(r);
      if (uniq.length >= 8) break;
    }

    // GMGN / Debot 战壕不回退 body：没有列根就下一轮再认。
    const fallbackRoots =
      isGmgnHost() || (isDebotHost() && isTrenchListPage())
        ? []
        : [document.body].filter(Boolean);
    scanRootsCache = { at: now, roots: uniq.length ? uniq : fallbackRoots };
    // Observer stays on documentElement (rebindMutationObserver is a no-op keep-alive).
    ensureDocumentObserver();
    return scanRootsCache.roots;
  }

  function isDialogRoot(el) {
    if (!(el instanceof HTMLElement)) return false;
    const role = (el.getAttribute("role") || "").toLowerCase();
    return role === "dialog" || role === "alertdialog";
  }

  function isExplicitlyHiddenOverlay(el) {
    if (!(el instanceof HTMLElement)) return true;
    return (
      el.hidden ||
      el.getAttribute("aria-hidden") === "true" ||
      el.style.display === "none" ||
      el.style.visibility === "hidden" ||
      el.style.opacity === "0"
    );
  }

  /**
   * Visible open dialogs (role=dialog) + GMGN search/history panels (no role).
   * Cap total overlay roots — never whole document.
   */
  function collectOpenDialogRoots(roots) {
    if (!document.querySelectorAll) return;
    let added = 0;
    const pushIfOk = (el) => {
      if (added >= 3) return;
      if (!(el instanceof HTMLElement) || !el.isConnected) return;
      if (isExplicitlyHiddenOverlay(el)) return;
      // Wallet tracking and favorites are hard scan boundaries, even when the
      // host renders them as dialog-like panels.
      if (isGmgnWalletTrackPanel(el) || isGmgnFavoritesPanel(el)) return;
      if (roots.includes(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 260 || r.height < 100) return;
      if (r.width > window.innerWidth * 0.98 && r.height > window.innerHeight * 0.92) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (r.right < 0 || r.left > window.innerWidth) return;
      roots.push(el);
      added += 1;
    };

    if (isGmgnHost()) {
      document.querySelectorAll(GMGN_FIXED_SEARCH_ROOT_SELECTOR).forEach((el) => pushIfOk(el));
    }
    document.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach((el) => pushIfOk(el));

    // MUI modals (Debot/Gungnir search)
    if (added < 3) {
      document.querySelectorAll(".MuiModal-root, .MuiDialog-root").forEach((el) => {
        if (added >= 3) return;
        const paper = el.querySelector?.(".MuiPaper-root, .MuiDialog-paper") || el;
        pushIfOk(paper instanceof HTMLElement ? paper : el);
      });
    }

    // GMGN: search / 历史代币 panel — cached climb (0.4.38).
    if (added < 3 && location.hostname.endsWith("gmgn.ai")) {
      const panel = findGmgnSearchPanelRoot();
      if (panel) pushIfOk(panel);
    }
  }

  /**
   * Lightweight roots: open overlays + list side boards. Skips K-line header root.
   * Used when token header badge already settled (chart thrashing).
   */
  function getLightScanRoots() {
    const roots = [];
    collectOpenDialogRoots(roots);
    // 0.4.38 overlay-fast: dialog ONLY — do not compete with 三列战壕 (main 5s cause).
    if (isOverlayFast() && roots.length) {
      const uniqFast = [];
      for (const r of roots) {
        if (!uniqFast.includes(r) && r.isConnected) uniqFast.push(r);
        if (uniqFast.length >= 3) break;
      }
      return uniqFast;
    }
    const host = location.hostname || "";
    // 0.4.41: 图表 mutation 不要扫整页。侧栏仍有未画卡时把 PumpSub 列加进 light roots。
    if (host.endsWith("gmgn.ai") && isGmgnTokenPage()) {
      if (hasUnpaintedGmgnSidebarTargets()) {
        getGmgnFixedSurfaceRoots().forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          if (el.matches?.(GMGN_FIXED_SEARCH_ROOT_SELECTOR)) return;
          if (!el.matches?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)) return;
          const r = el.getBoundingClientRect();
          if (r.width >= 180 && r.height >= 120 && r.top < window.innerHeight) {
            roots.push(el);
          }
        });
      }
      const uniqTok = [];
      for (const r of roots) {
        if (!uniqTok.includes(r) && r.isConnected) uniqTok.push(r);
        if (uniqTok.length >= 4) break;
      }
      return uniqTok;
    }
    if (host.endsWith("gmgn.ai")) {
      getGmgnFixedSurfaceRoots().forEach((el) => {
        if (el.matches?.(GMGN_FIXED_SEARCH_ROOT_SELECTOR)) return;
        const r = el.getBoundingClientRect();
        if (r.width >= 180 && r.height >= 120 && r.top < window.innerHeight) roots.push(el);
      });
    } else if (host.endsWith("debot.ai") || host.endsWith("gungnir.bot")) {
      getDebotFixedSurfaceRoots().forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (isDialogRoot(el) || el.closest?.(".MuiDialog-root, .MuiModal-root, [role='dialog']")) {
          roots.push(el);
          return;
        }
        if (!isDebotTokenPage()) roots.push(el);
      });
    }
    // Dedup
    const uniq = [];
    for (const r of roots) {
      if (!uniq.includes(r) && r.isConnected) uniq.push(r);
      if (uniq.length >= 8) break;
    }
    return uniq;
  }

  function getCandidateNodes() {
    const inView = [];
    const offscreen = [];
    const seen = new Set();
    const lightOnly = pendingLightScan;
    pendingLightScan = false;
    // 0.4.30: token→list soft — viewport only, smaller caps (jank↓, first screen still filled).
    const listReturnSoft = isSpaListReturnSoft();
    const overlayOnly = isOverlayFast();

    // 0.4.36: list-return uses column round-robin anchors only (covers 已迁移 / GMGN 右列).
    if (listReturnSoft && !overlayOnly) {
      const anchors = collectListReturnAnchorsRoundRobin();
      return anchors.slice(0, listReturnCandidateCap());
    }

    // Collect one seed per visual card across all three columns before applying
    // the cap. Advance by the real card budget so the next scan fills later rows.
    if (
      isGmgnHost() &&
      !isGmgnTokenPage() &&
      !lightOnly &&
      !overlayOnly &&
      !quickHasOpenOverlay()
    ) {
      const anchors = collectListReturnAnchorsRoundRobin({
        cap: GMGN_STEADY_CANDIDATES,
        rowOffset: gmgnSteadyRoundRobinRow,
        forceFreshRoots: false
      });
      gmgnSteadyRoundRobinRow =
        (gmgnSteadyRoundRobinRow + Math.max(1, Math.floor(GMGN_STEADY_CARDS_BUDGET / 3))) %
        1000000;
      if (anchors.length) return anchors;
    }
    if (
      isDebotHost() &&
      isTrenchListPage() &&
      !lightOnly &&
      !overlayOnly &&
      !quickHasOpenOverlay()
    ) {
      const anchors = collectListReturnAnchorsRoundRobin({
        cap: DEBOT_STEADY_CARDS_BUDGET + 6,
        rowOffset: debotSteadyRoundRobinRow,
        forceFreshRoots: false
      });
      debotSteadyRoundRobinRow =
        (debotSteadyRoundRobinRow + Math.max(1, Math.floor(DEBOT_STEADY_CARDS_BUDGET / 3))) %
        1000000;
      if (anchors.length) return anchors;
    }

    const addNode = (node, priority = 0) => {
      if (!(node instanceof HTMLElement) || seen.has(node)) return;
      seen.add(node);
      // Boost unpainted: nodes whose nearest card has no badge yet (new 战壕 rows).
      let pri = priority;
      try {
        const host = node.closest?.("a, div, li, article") || node.parentElement;
        if (host && !host.querySelector?.(`[${ICON_DATA}="1"]`)) pri += 3;
        // Overlay rows always win over trench during overlay-fast.
        if (overlayOnly || isInsideOverlayDialog(node)) pri += 8;
      } catch (_err) {
        // ignore
      }
      const item = { node, priority: pri };
      // list-return / overlay-fast: never queue far offscreen.
      // 0.4.45 GMGN steady: also viewport-only (no offscreen climb/paint).
      if (
        listReturnSoft ||
        overlayOnly ||
        (isGmgnHost() && !lightOnly) ||
        (isDebotHost() && isTrenchListPage() && !lightOnly)
      ) {
        if (isNearViewport(node, false)) inView.push(item);
        return;
      }
      if (isNearViewport(node, lightOnly)) inView.push(item);
      else offscreen.push(item);
    };

    const gmgnLite = isGmgnHost() && !overlayOnly;
    const collectFromRoot = (root) => {
      if (!root || !root.querySelectorAll) return;
      const candCap = overlayOnly
        ? OVERLAY_MAX_CANDIDATES * 2
        : listReturnSoft
          ? listReturnCandidateCap()
          : lightOnly
            ? LIGHT_MAX_CANDIDATES * 2
            : gmgnLite
              ? GMGN_STEADY_CANDIDATES * 2
              : MAX_CANDIDATES_PER_SCAN * 2;
      // Prefer site token routes over external flap.sh icons (js-mcp: flap.sh 18×18 noise).
      // 0.6.4: GMGN TokenItem is div[href] — do not require <a>.
      root
        .querySelectorAll(
          "[href*='/token/'][href*='8888'], [href*='/token/'][href*='7777'], " +
            "[href*='/token/'][href*='ffff'], " +
            "[href*='/bsc/token/'][href*='8888'], [href*='/bsc/token/'][href*='7777'], " +
            "[href*='/bsc/token/'][href*='ffff']"
        )
        .forEach((n) => addNode(n, 2));
      // 0.4.42 GMGN: also CA hrefs (flap/site) but NEVER leaf textContent walks.
      if (gmgnLite && !listReturnSoft) {
        root.querySelectorAll("[href*='8888'], [href*='7777'], [href*='ffff']").forEach((n) => {
          const href = (n.getAttribute && n.getAttribute("href")) || "";
          if (/flap\.sh|bscscan|etherscan|lens\.google/i.test(href)) addNode(n, 1);
          else addNode(n, 2);
        });
        return;
      }
      // list-return: href-only — skip SUFFIX + leaf walks.
      if (listReturnSoft && !overlayOnly) return;
      root.querySelectorAll(SUFFIX_SELECTORS).forEach((n) => {
        const href = (n.getAttribute && n.getAttribute("href")) || "";
        // Deprioritize external explorer / flap icons
        if (/flap\.sh|bscscan|etherscan/i.test(href)) addNode(n, 0);
        else addNode(n, 1);
      });
      // Short CA text in compact leaves — Debot/overlay only (GMGN href-only).
      const leafBudget = overlayOnly
        ? OVERLAY_MAX_CANDIDATES
        : lightOnly
          ? LIGHT_MAX_CANDIDATES
          : MAX_CANDIDATES_PER_SCAN;
      if (inView.length < leafBudget) {
        const hn = location.hostname || "";
        const debotHost = hn.endsWith("debot.ai") || hn.endsWith("gungnir.bot");
        if (!debotHost && !overlayOnly) return;
        const leafSel = debotHost || overlayOnly ? "a, span, div" : "a, span";
        const leaves = root.querySelectorAll(leafSel);
        const maxCheck = Math.min(
          leaves.length,
          overlayOnly ? 200 : lightOnly ? 500 : debotHost ? 350 : 200
        );
        for (let i = 0; i < maxCheck; i += 1) {
          if (inView.length + offscreen.length >= candCap) break;
          const el = leaves[i];
          const t = (el.textContent || "").trim();
          if (t.length > 24 || t.length < 8) continue;
          if (!TARGET_SHORT_TOKEN_RE.test(t)) continue;
          if (el.tagName === "DIV" && el.children && el.children.length > 2) continue;
          addNode(el, overlayOnly ? 3 : 1);
        }
      }
    };

    // Light / overlay-fast: dialog (+ side boards only when not overlay-fast).
    const roots =
      lightOnly || overlayOnly
        ? getLightScanRoots()
        : getScanRoots();
    const maxCand = overlayOnly
      ? OVERLAY_MAX_CANDIDATES * 2
      : listReturnSoft
        ? listReturnCandidateCap()
        : lightOnly
          ? LIGHT_MAX_CANDIDATES * 2
          : gmgnLite
            ? GMGN_STEADY_CANDIDATES
            : MAX_CANDIDATES_PER_SCAN * 2;
    for (const root of roots) {
      if (inView.length + offscreen.length >= maxCand) break;
      collectFromRoot(root);
    }

    // SPA hole-fill: body once. NEVER on GMGN / Debot 战壕（body walk = jank）.
    if (
      !gmgnLite &&
      !(isDebotHost() && isTrenchListPage()) &&
      !lightOnly &&
      !overlayOnly &&
      !listReturnSoft &&
      inView.length + offscreen.length < 8 &&
      document.body
    ) {
      if (
        !(
          isTokenDetailRoute() &&
          (isTokenPageSettledWithBadge() || isNonTargetTokenPage())
        )
      ) {
        collectFromRoot(document.body);
      }
    }

    const sortPri = (a, b) => b.priority - a.priority;
    inView.sort(sortPri);
    offscreen.sort(sortPri);
    // 0.4.45: GMGN never paints offscreen candidates (virtual list will mutate on scroll).
    const offTake =
      listReturnSoft || overlayOnly || isGmgnHost()
        ? 0
        : lightOnly
          ? LIGHT_MAX_OFFSCREEN
          : 12;
    const sliceMax = overlayOnly
      ? OVERLAY_MAX_CANDIDATES
      : listReturnSoft
        ? listReturnCandidateCap()
        : lightOnly
          ? LIGHT_MAX_CANDIDATES
          : gmgnLite
            ? GMGN_STEADY_CANDIDATES
            : MAX_CANDIDATES_PER_SCAN;
    const merged = inView.concat(offscreen.slice(0, offTake)).map((x) => x.node);
    return merged.slice(0, sliceMax);
  }

  function climbToCard(node, options) {
    const minWidth = typeof options.minWidth === "number" ? options.minWidth : 260;
    const minHeight = typeof options.minHeight === "number" ? options.minHeight : 58;
    let current = node;
    for (let depth = 0; current && depth < options.maxDepth; depth += 1) {
      if (!(current instanceof HTMLElement)) break;
      // Do not climb out of a dialog into the blurred page behind it.
      if (depth > 0 && isInsideOverlayDialog(node) && !isInsideOverlayDialog(current)) break;
      const rect = current.getBoundingClientRect();
      const text = current.textContent || "";

      if (
        rect.width >= minWidth &&
        rect.height >= minHeight &&
        rect.height <= options.maxHeight &&
        hasShortAddress(current) &&
        (!options.requireFeeTag || hasFeeTag(text))
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Mount when there is no Tax chip (GMGN search/history rows show Fees, not Tax).
   * Prefer short-CA leaf or a compact metrics row — never whole card.
   */
  function findCompactRowMount(card) {
    if (!(card instanceof HTMLElement) || !card.querySelectorAll) return null;
    const leaves = card.querySelectorAll("span, a, div, p");
    const max = Math.min(leaves.length, 40);
    let shortLeaf = null;
    for (let i = 0; i < max; i += 1) {
      const el = leaves[i];
      const t = (el.textContent || "").trim();
      if (!TARGET_SHORT_TOKEN_RE.test(t) || t.length > 22) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width <= 160 && r.height > 0 && r.height <= 36) {
        shortLeaf = el;
        break;
      }
    }
    if (shortLeaf) {
      const parent = shortLeaf.parentElement;
      if (parent instanceof HTMLElement) {
        const pr = parent.getBoundingClientRect();
        if (pr.width > 0 && pr.width < 420 && pr.height > 0 && pr.height <= 48) return parent;
      }
      return shortLeaf;
    }
    return null;
  }

  /** GMGN search overlay: mount above the L/H columns without changing row width. */
  function findGmgnOverlayLiquidityHeadMount(card) {
    if (
      !(card instanceof HTMLElement) ||
      (card.dataset.flapOverlayCard !== "1" && !isInsideOverlayDialog(card))
    ) {
      return null;
    }

    const hasLeafLabel = (scope, label) =>
      Array.from(scope.querySelectorAll("span, div, p")).some(
        (el) => el.childElementCount === 0 && (el.textContent || "").trim() === label
      );
    const directChildren = Array.from(card.children).filter(
      (el) => el instanceof HTMLElement && el.dataset?.[ICON_MARK] !== "1"
    );

    for (const column of directChildren) {
      if (!hasLeafLabel(column, "V") || !hasLeafLabel(column, "Fees")) continue;

      // Confirm the expected V/Fees -> L/H relationship without depending on class hashes.
      let sibling = column.nextElementSibling;
      let checked = 0;
      let liquidityColumn = null;
      while (sibling && checked < 2) {
        if (sibling instanceof HTMLElement && sibling.dataset?.[ICON_MARK] !== "1") {
          checked += 1;
          if (hasLeafLabel(sibling, "L")) {
            liquidityColumn = sibling;
            break;
          }
        }
        sibling = sibling.nextElementSibling;
      }
      if (!(liquidityColumn instanceof HTMLElement)) continue;

      // Search rows have a stable 72px card. Mount above L/H inside the L cell
      // so the badge does not become a new flex column between V/Fees and L.
      liquidityColumn.dataset.flapMount = "gmgn-overlay-liquidity-head";
      return liquidityColumn;
    }
    return null;
  }

  /** Match full CA against truncated UI form like 0x65...7777 */
  function tokenMatchesShort(fullToken, shortAddress) {
    if (!shortAddress) return true;
    const short = String(shortAddress).toLowerCase();
    const full = String(fullToken).toLowerCase();
    // Support "..." and Unicode ellipsis "…" (Debot logged-in header).
    const parts = short.split(/(?:\.{2,}|\u2026|\u22ef)/);
    if (parts.length < 2) {
      return full.includes(short.replace(/\.|\u2026|\u22ef/g, ""));
    }
    const head = parts[0].replace(/^0x/, "");
    const tail = parts[parts.length - 1];
    return full.startsWith(`0x${head}`) && full.endsWith(tail);
  }

  /**
   * **卡片唯一身份 = 该行自身的 token-route CA**（GMGN: TokenItem `div[href="/bsc/token/0x…"]`）。
   *
   * 规则（0.6.5 / js-mcp）：
   * 1. 自 card 向上找最近带 `/token/0x` 的 `href` —— 这就是行身份，**绝不**用别的 7777 覆盖 ffff
   * 2. 仅当上下都没有时，才在子树找第一个 token-route href
   * 3. 禁止「候选里优先 7777/8888」—— 那会把 ffff 行误认成邻近 7777 并挂徽章
   *
   * 返回任意完整 CA（含非 7777/8888）；调用方用 TARGET_TOKEN_RE 决定是否挂徽章。
   */
  function extractCardHrefToken(card) {
    if (!(card instanceof HTMLElement)) return null;
    const fromRaw = (raw) => {
      if (!raw) return null;
      const s = String(raw);
      // External icon links (flap.sh / explorers) are never row identity.
      if (/flap\.sh|bscscan|etherscan|lens\.google/i.test(s)) return null;
      // Row identity must be a token-route path (GMGN /bsc/token/0x… or /token/0x…).
      if (s.indexOf("/token/") === -1) return null;
      return extractAnyToken(s);
    };
    try {
      // 热路径：自身 href（GMGN TokenItem）。缓存必须绑定 href 签名，防虚拟列表复用串 CA。
      const selfRaw = card.getAttribute?.("href") || "";
      if (selfRaw && selfRaw.indexOf("/token/") !== -1) {
        try {
          const hit = hrefTokenCache.get(card);
          if (
            hit &&
            hit.href === selfRaw &&
            Date.now() - hit.at < HREF_TOKEN_CACHE_MS
          ) {
            return hit.token;
          }
        } catch (_c) {
          // ignore
        }
        const selfTok = fromRaw(selfRaw);
        try {
          hrefTokenCache.set(card, {
            token: selfTok,
            at: Date.now(),
            href: selfRaw
          });
        } catch (_set) {
          // ignore
        }
        return selfTok;
      }
    } catch (_self) {
      // ignore
    }
    // 祖先 / 子树：不做缓存（路径少见，且难做可靠签名）
    try {
      let el = card.parentElement;
      for (let i = 0; i < 6 && el; i += 1) {
        const raw = el.getAttribute?.("href") || "";
        if (raw && raw.indexOf("/token/") !== -1) {
          const tok = fromRaw(raw);
          if (tok) return tok;
        }
        el = el.parentElement;
      }
    } catch (_errSelf) {
      // ignore
    }
    try {
      if (card.querySelector) {
        const preferred = card.querySelector(
          "[href*='/bsc/token/'][href*='0x'], [href*='/token/'][href*='0x']"
        );
        return fromRaw(preferred?.getAttribute?.("href") || "");
      }
    } catch (_errQ) {
      // ignore
    }
    return null;
  }

  /**
   * 按完整 CA 找战壕行（身份源：href 含该 CA）。CA 唯一且固定。
   * @returns {HTMLElement[]}
   */
  function findCardsByCa(token) {
    const tok = String(token || "").toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(tok)) return [];
    const out = [];
    const seen = new Set();
    try {
      const roots =
        isGmgnHost() || isDebotHost() ? getScanRoots(false) : [document];
      const scanRoots = roots.length ? roots : [document];
      const forEachScoped = (selector, fn) => {
        for (const root of scanRoots) {
          if (!root?.querySelectorAll) continue;
          root.querySelectorAll(selector).forEach(fn);
        }
      };
      // 1) Our mark
      forEachScoped(`[${CARD_DATA}="${tok}"]`, (el) => {
        if (el instanceof HTMLElement && !seen.has(el)) {
          seen.add(el);
          out.push(el);
        }
      });
      // 2) Host TokenItem / link by href (GMGN div[href] or a[href])
      forEachScoped(`[href*="${tok}"]`, (el) => {
        if (!(el instanceof HTMLElement) || seen.has(el)) return;
        const href = (el.getAttribute("href") || "").toLowerCase();
        if (href.indexOf(tok) === -1) return;
        if (/flap\.sh|bscscan|etherscan/i.test(href)) return;
        // Prefer row-sized hosts
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 36) return;
        seen.add(el);
        out.push(el);
      });
    } catch (_err) {
      // ignore
    }
    return out;
  }

  /** 非目标 CA 行：拆掉任何残留徽章（含别的 7777 复用挂上来的 4444/随机尾号）. */
  function wipeNonTargetCardBadges(card, identityCa) {
    if (!(card instanceof HTMLElement)) return;
    const id = identityCa || readHostRowToken(card) || extractCardHrefToken(card);
    if (id && TARGET_TOKEN_RE.test(id)) return;
    try {
      card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
        try {
          n.remove();
        } catch (_e) {
          // ignore
        }
      });
      for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
        if (sib instanceof HTMLElement && sib.matches?.(`[${ICON_DATA}="1"]`)) {
          try {
            sib.remove();
          } catch (_e2) {
            // ignore
          }
        }
      }
      delete card.dataset[CARD_MARK];
      card.removeAttribute(CARD_DATA);
      cardTokenCache.delete(card);
      try {
        hrefTokenCache.delete(card);
      } catch (_hc) {
        // ignore
      }
    } catch (_err) {
      // ignore
    }
  }

  /**
   * 徽章宿主行：GMGN 必须先认最近 TokenItem href（虚拟列表 mark 常滞后）。
   */
  function findBadgeHostRow(icon) {
    if (!(icon instanceof HTMLElement)) return null;
    try {
      if (isGmgnHost()) {
        const item = icon.closest?.(
          "[href*='/bsc/token/'][href*='0x'], [href*='/token/'][href*='0x']"
        );
        if (item instanceof HTMLElement) return item;
      }
    } catch (_g) {
      // ignore
    }
    const marked = findCardForBadgeIcon(icon);
    if (marked) return marked;
    try {
      const el = icon.closest?.("[href*='/token/'][href*='0x'], [href*='/bsc/token/'][href*='0x']");
      if (el instanceof HTMLElement) return el;
    } catch (_c) {
      // ignore
    }
    return null;
  }

  /**
   * 从宿主读行 CA（优先 token-route href，避免缓存）。
   */
  function readHostRowToken(host) {
    if (!(host instanceof HTMLElement)) return null;
    try {
      const raw = host.getAttribute?.("href") || "";
      if (raw && raw.indexOf("/token/") !== -1 && raw.indexOf("0x") !== -1) {
        const t = extractAnyToken(raw);
        if (t) return t;
      }
    } catch (_e) {
      // ignore
    }
    return extractCardHrefToken(host);
  }

  /**
   * ★ 每扫必跑（不节流）：徽章 feeToken 必须等于宿主 TokenItem 当前 href。
   *
   * 根因（4444 / 非 7777·8888·ffff）：
   * - 候选只扫 SUFFIX 7777/8888/ffff，瞬间刷列表时虚拟行 7777→4444 后
   *   **该行不再进 needWork**，旧徽章会留在 4444 行上。
   * - ffff 同理：若 fee 仍是邻行 7777，此处拆掉。
   * 成本：O(徽章数≤48) × closest + 字符串比，远低于全量 enforce。
   */
  function scrubBadgesToHostHref(scope = document, bypassGap = false) {
    if (shouldDeferGmgnTrenchResizeWork()) return;
    if (isGmgnScrollCooling() || isDebotScrollCooling()) return;
    const now = Date.now();
    if (!bypassGap && now - lastScrubHrefAt < SCRUB_HREF_MIN_GAP_MS) return;
    lastScrubHrefAt = now;
    try {
      const queryRoot = scope?.querySelectorAll ? scope : document;
      const icons = queryRoot.querySelectorAll(`[${ICON_DATA}="1"]`);
      const lim = Math.min(icons.length, SCRUB_HREF_MAX_ICONS);
      for (let i = 0; i < lim; i += 1) {
        const icon = icons[i];
        if (!(icon instanceof HTMLElement)) continue;
        if (icon.dataset.feeHeader === "1") continue;
        const fee = (icon.dataset.feeToken || "").toLowerCase();
        if (!fee) {
          try {
            icon.remove();
          } catch (_e0) {
            // ignore
          }
          continue;
        }
        const host = findBadgeHostRow(icon);
        if (!(host instanceof HTMLElement)) {
          try {
            icon.remove();
          } catch (_e1) {
            // ignore
          }
          continue;
        }
        // 钱包追踪 / 顶 ticker / 搜索钱包区残留。只判断徽章宿主；
        // icon 自身通常是短 chip，不能拿卡片几何规则判断。
        if (isBadgeMountForbidden(host)) {
          try {
            icon.remove();
          } catch (_ef) {
            // ignore
          }
          wipeForbiddenMountBadges(host, true);
          continue;
        }
        const idCa = readHostRowToken(host);
        // 宿主已是非目标尾号（4444 等）→ 必须拆（不论 fee 是什么）
        if (idCa && !TARGET_TOKEN_RE.test(idCa)) {
          wipeNonTargetCardBadges(host, idCa);
          try {
            if (icon.isConnected) icon.remove();
          } catch (_e2) {
            // ignore
          }
          continue;
        }
        // 无完整 CA：Debot 等靠 mark；GMGN 无 href 的徽章不可信
        if (!idCa) {
          if (isGmgnHost()) {
            try {
              icon.remove();
            } catch (_e3) {
              // ignore
            }
          }
          continue;
        }
        // fee ≠ 行身份（7777 徽章挂在 ffff / 另一 7777 行）
        if (fee !== idCa) {
          try {
            icon.remove();
          } catch (_e4) {
            // ignore
          }
          try {
            if (host.dataset[CARD_MARK] && host.dataset[CARD_MARK] !== idCa) {
              delete host.dataset[CARD_MARK];
              host.removeAttribute(CARD_DATA);
            }
            cardTokenCache.delete(host);
            hrefTokenCache.delete(host);
          } catch (_e5) {
            // ignore
          }
          // ★ 0.7.4: 拆错后立刻 cache-first 重画正确 CA，缩短 feeMatch 空窗
          tryRepaintCardAfterIdentityWipe(host, idCa);
        }
      }
    } catch (_err) {
      // ignore
    }
  }

  /**
   * scrub 拆掉错徽章后：若行身份仍是目标 CA，用内存 entry 立刻重画（无则 ⏳ 入队）。
   * 不占主扫 budget，避免「错 → 空一轮 → 才对」。
   */
  function tryRepaintCardAfterIdentityWipe(host, idCa) {
    if (!(host instanceof HTMLElement)) return;
    const tok = String(idCa || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok)) return;
    if (isBadgeMountForbidden(host)) {
      wipeForbiddenMountBadges(host, true);
      return;
    }
    // 再读一次宿主，防止 wipe 后 React 已换行
    const live = readHostRowToken(host) || extractCardHrefToken(host);
    if (live && live !== tok) return;
    if (live && !TARGET_TOKEN_RE.test(live)) return;
    try {
      host.dataset[CARD_MARK] = tok;
      host.setAttribute(CARD_DATA, tok);
    } catch (_m) {
      // ignore
    }
    const entry = resolveEntry(tok);
    if (entry && !isFeeLoadingEntry(entry)) {
      try {
        if (
          paintListCardFromCacheFast(host, tok, entry) ||
          renderMode(host, tok, entry)
        ) {
          return;
        }
      } catch (_p) {
        // fall through queue
      }
    }
    try {
      paintLoadingBadgeAndQueue(host, tok);
    } catch (_q) {
      try {
        queueToken(tok);
      } catch (_q2) {
        // ignore
      }
    }
  }

  /**
   * 节流版全量 scrub（Debot mark 路径等）；主纠错靠 scrubBadgesToHostHref。
   */
  function scrubIdentityMismatchedBadges() {
    if (shouldDeferGmgnTrenchResizeWork()) return;
    const now = Date.now();
    if (isGmgnScrollCooling() || isDebotScrollCooling()) return;
    if (now - lastScrubIdentityAt < SCRUB_IDENTITY_MIN_GAP_MS) return;
    lastScrubIdentityAt = now;
    // 先跑轻量
    try {
      const icons = document.querySelectorAll(`[${ICON_DATA}="1"]`);
      const lim = Math.min(icons.length, SCRUB_IDENTITY_MAX_ICONS);
      for (let i = 0; i < lim; i += 1) {
        const icon = icons[i];
        if (!(icon instanceof HTMLElement)) continue;
        if (icon.dataset.feeHeader === "1") continue;
        const fee = (icon.dataset.feeToken || "").toLowerCase();
        const host = findBadgeHostRow(icon);
        if (!(host instanceof HTMLElement)) {
          try {
            icon.remove();
          } catch (_e) {
            // ignore
          }
          continue;
        }
        let idCa = readHostRowToken(host);
        if (!idCa) {
          const mark = (host.dataset?.[CARD_MARK] || "").toLowerCase();
          if (mark && fee && fee !== mark) {
            try {
              icon.remove();
            } catch (_em) {
              // ignore
            }
          }
          continue;
        }
        if (!TARGET_TOKEN_RE.test(idCa)) {
          wipeNonTargetCardBadges(host, idCa);
          continue;
        }
        if (fee && fee !== idCa) {
          try {
            icon.remove();
          } catch (_e2) {
            // ignore
          }
          if (host.dataset[CARD_MARK] && host.dataset[CARD_MARK] !== idCa) {
            try {
              delete host.dataset[CARD_MARK];
              host.removeAttribute(CARD_DATA);
            } catch (_e3) {
              // ignore
            }
          }
          try {
            cardTokenCache.delete(host);
            hrefTokenCache.delete(host);
          } catch (_e4) {
            // ignore
          }
        }
      }
    } catch (_err) {
      // ignore
    }
  }

  /**
   * Debot 卡上常见 x.com/search?q=0x…ffff 等社交链接，内含完整 CA，
   * 但不是「行身份」——虚拟列表复用后会残留邻行 CA，导致 ffff 挂错底池（SPCXB vs NVDAB）。
   * 仅 token 路由 / 数据属性 可作身份源。
   */
  function isNoiseCaSource(value) {
    const s = String(value || "");
    if (!s || s.indexOf("0x") === -1) return false;
    // 明确的代币路由：保留
    if (/\/token\//i.test(s) || /\/bsc\/token\//i.test(s)) return false;
    // data-* 纯地址（无 URL 壳）
    if (/^0x[a-fA-F0-9]{40}$/i.test(s.trim())) return false;
    // 社交 / 浏览器搜索串常夹带 0x…ffff，不作行身份（Debot CLADY→误挂邻行 SPCXB）
    return /(?:twitter\.com|x\.com|t\.me|telegram\.|discord\.|youtube\.|tiktok\.|github\.|lens\.google|bscscan|etherscan|flap\.sh)/i.test(
      s
    );
  }

  function identityTokenFromValue(value) {
    if (!value || isNoiseCaSource(value)) return null;
    return normalizeToken(value);
  }

  function extractCardTokenFromAttrs(card) {
    const shortAddress = findCardShortAddress(card);
    const hrefToken = extractCardHrefToken(card);

    // 行身份 CA 已明确：以 token-route href 为准（非 7777/8888/ffff → 绝不挂徽章）.
    // GMGN TokenItem 自身 div[href=/bsc/token/0x…] 是唯一身份（0.6.5）；
    // short 滞后时仍信 href，禁止再扫社交/邻行 CA 覆盖 ffff。
    if (hrefToken) {
      if (!TARGET_TOKEN_RE.test(hrefToken)) {
        // 非目标尾号：清缓存 + 清残留徽章
        cardTokenCache.delete(card);
        wipeNonTargetCardBadges(card, hrefToken);
        return null;
      }
      // Debot：若 short 已明确变成另一行且与 href 冲突 → 继续向下（href 可能仍旧）
      // GMGN：始终信 TokenItem href
      if (
        !isGmgnHost() &&
        shortAddress &&
        !tokenMatchesShort(hrefToken, shortAddress)
      ) {
        // fall through — Debot short wins when href stale
      } else {
        cardTokenCache.set(card, {
          token: hrefToken,
          short: shortAddress || "",
          href: hrefToken
        });
        return hrefToken;
      }
    }

    // A visible non-target short CA is authoritative when no href.
    // Virtual lists reuse the same HTMLElement — old cache must not paint on a new row.
    if (shortAddress && !TARGET_SHORT_TOKEN_RE.test(shortAddress)) {
      cardTokenCache.delete(card);
      wipeNonTargetCardBadges(card, null);
      return null;
    }
    // Prefer short 8888/7777 presence; still allow pure full-CA cards without short UI.

    const accept = (token) => {
      if (!token) return null;
      if (shortAddress && !tokenMatchesShort(token, shortAddress)) return null;
      return token;
    };

    // Fast path: card already resolved this short form (href miss path only).
    const cached = cardTokenCache.get(card);
    if (
      cached &&
      cached.token &&
      cached.short === (shortAddress || "") &&
      (!cached.href || cached.href === (hrefToken || "")) &&
      cardStillMatchesToken(card, cached.token)
    ) {
      return cached.token;
    }

    const remember = (token) => {
      if (!token) return null;
      cardTokenCache.set(card, { token, short: shortAddress || "", href: "" });
      return token;
    };

    const direct = [
      card.getAttribute("href"),
      card.getAttribute("title"),
      card.getAttribute("aria-label"),
      card.getAttribute("data-token"),
      card.getAttribute("data-address"),
      card.getAttribute("data-ca"),
      card.getAttribute("data-contract")
    ];

    for (const value of direct) {
      const token = accept(identityTokenFromValue(value));
      if (token) return remember(token);
    }

    // 优先 data-* / token 路由，社交 href 一律跳过
    const tokenNodes = card.querySelectorAll(
      "a[href*='0x'], [title*='0x'], [aria-label*='0x'], [data-token*='0x'], [data-address*='0x'], [data-ca*='0x'], [data-contract*='0x']"
    );
    const maxNodes = Math.min(tokenNodes.length, 40);
    const routeHits = [];
    const dataHits = [];
    for (let i = 0; i < maxNodes; i += 1) {
      const node = tokenNodes[i];
      const href = node.getAttribute("href") || "";
      if (href && /\/token\//i.test(href)) {
        const token = accept(identityTokenFromValue(href));
        if (token) routeHits.push(token);
        continue;
      }
      if (href && isNoiseCaSource(href)) continue;
      const attrs = [
        node.getAttribute("title"),
        node.getAttribute("aria-label"),
        node.getAttribute("data-token"),
        node.getAttribute("data-address"),
        node.getAttribute("data-ca"),
        node.getAttribute("data-contract"),
        href && !isNoiseCaSource(href) ? href : ""
      ];
      for (const value of attrs) {
        const token = accept(identityTokenFromValue(value));
        if (token) dataHits.push(token);
      }
    }
    const uniq = (arr) => {
      const out = [];
      const seen = new Set();
      for (const t of arr) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
      return out;
    };
    const routes = uniq(routeHits);
    if (routes.length === 1) return remember(routes[0]);
    if (routes.length > 1) {
      // 多 token-route：与 short 一致的应只有一个；全模糊则放弃
      cardTokenCache.delete(card);
      return null;
    }
    const datas = uniq(dataHits);
    if (datas.length === 1) return remember(datas[0]);
    if (datas.length > 1) {
      cardTokenCache.delete(card);
      return null;
    }

    // Deep attribute scan only on small cards / miss (avoid querySelectorAll("*") on every scan).
    const all = card.querySelectorAll(
      "a, button, [data-token], [data-address], [data-ca], [href*='/token/']"
    );
    const maxDeep = Math.min(all.length, 60);
    const deepHits = [];
    for (let i = 0; i < maxDeep; i += 1) {
      const el = all[i];
      if (!el.attributes || el.attributes.length === 0) continue;
      for (let j = 0; j < el.attributes.length; j += 1) {
        const value = el.attributes[j].value;
        if (!value || value.length < 42 || value.indexOf("0x") === -1) continue;
        if (isNoiseCaSource(value)) continue;
        const token = accept(identityTokenFromValue(value));
        if (token) deepHits.push(token);
      }
    }
    const deeps = uniq(deepHits);
    if (deeps.length === 1) return remember(deeps[0]);
    if (deeps.length > 1) {
      cardTokenCache.delete(card);
      return null;
    }

    // Last resort: textContent only（多命中则放弃，避免 short 碰撞猜错）
    const blob = card.textContent || "";
    if (blob.length < 8000) {
      const re = /0x[a-fA-F0-9]{36}(8888|7777|ffff)/gi;
      const textHits = [];
      let match = re.exec(blob);
      while (match) {
        const token = accept(match[0].toLowerCase());
        if (token) textHits.push(token);
        match = re.exec(blob);
      }
      const texts = uniq(textHits);
      if (texts.length === 1) return remember(texts[0]);
    }

    return null;
  }

  function extractAnyToken(value) {
    if (!value) return null;
    const full = String(value).match(TOKEN_RE)?.[0];
    if (!full) return null;
    return full.toLowerCase();
  }

  function normalizeToken(value) {
    const token = extractAnyToken(value);
    if (!token) return null;
    return TARGET_TOKEN_RE.test(token) ? token : null;
  }

  function hasFeeTag(text) {
    return /Tax\s*\d/i.test(text) || /fee/i.test(text);
  }

  function hasShortAddress(card) {
    // textContent once beats querySelectorAll("span,div,a") on every climb step.
    const text = card.textContent || "";
    if (!text) return false;
    if (text.length <= 6000) return SHORT_TOKEN_RE.test(text);
    return SHORT_TOKEN_RE.test(text.slice(0, 4000));
  }

  function findCardShortAddress(card) {
    const text = card.textContent || "";
    if (!text) return null;
    const slice = text.length > 8000 ? text.slice(0, 5000) : text;
    const targetMatch = slice.match(TARGET_SHORT_TOKEN_RE);
    if (targetMatch) return targetMatch[0];
    const anyMatch = slice.match(SHORT_TOKEN_RE);
    return anyMatch ? anyMatch[0] : null;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
  }

  /**
   * Near viewport — skip climb/extract on far off-screen nodes.
   * loose=true: larger margin for scrollable side boards (K-line 战壕 column).
   */
  function isNearViewport(el, loose = false) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    // 0.4.45 GMGN: tight pad — only first-screen rows (≈ top ~10 cards across 3 cols).
    // Debot keeps slightly larger pad for 3-col boards.
    let padY;
    let padTop;
    if (loose) {
      padY = 480;
      padTop = 200;
    } else if (isGmgnHost()) {
      padY = 40;
      padTop = 24;
    } else {
      padY = 100;
      padTop = 60;
    }
    return rect.bottom >= -padTop && rect.top <= window.innerHeight + padY;
  }

  /**
   * Cheap recycle guard for virtual lists (no full extractToken).
   * True when card still looks like `token`.
   *
   * **href first**: SPA/virtual list often updates `a[href]` before short-CA text.
   * Trusting stale short text first was the main cause of「先旧徽章 → 几秒后才对」.
   */
  function cardStillMatchesToken(card, token) {
    if (!card || !token) return false;
    const want = String(token).toLowerCase();
    // 徽章 token 本身必须是 7777/8888/ffff
    if (!TARGET_TOKEN_RE.test(want)) return false;

    // 1) Token-route / any 0x href — authoritative identity during recycle.
    // Prefer raw host href (bypass short TTL cache) when available.
    let hrefToken = null;
    try {
      const raw = card.getAttribute?.("href") || "";
      if (raw && raw.indexOf("/token/") !== -1 && raw.indexOf("0x") !== -1) {
        hrefToken = extractAnyToken(raw);
      }
    } catch (_rh) {
      // ignore
    }
    if (!hrefToken) hrefToken = extractCardHrefToken(card);
    if (hrefToken) {
      if (!TARGET_TOKEN_RE.test(hrefToken)) return false;
      return hrefToken === want;
    }

    // 2) data-* full CA on the card root.
    for (const value of [
      card.getAttribute("data-token"),
      card.getAttribute("data-address"),
      card.getAttribute("data-ca"),
      card.getAttribute("data-contract")
    ]) {
      const dataToken = extractAnyToken(value);
      if (dataToken) {
        if (!TARGET_TOKEN_RE.test(dataToken)) return false;
        return dataToken === want;
      }
    }

    // 3) Short CA text (only when href/data missing — weaker, can lag one frame).
    const text = card.textContent || "";
    const shortSlice = text.length > 6000 ? text.slice(0, 4000) : text;
    const targetShortMatch = shortSlice.match(TARGET_SHORT_TOKEN_RE);
    if (targetShortMatch) return tokenMatchesShort(want, targetShortMatch[0]);
    // A visible short CA with a different suffix means the virtual row changed identity.
    if (SHORT_TOKEN_RE.test(shortSlice)) return false;

    // ★ 0.7.4: 无 href/short 信号时绝不认匹配。
    // 虚拟列表复用瞬间常「徽章还在、身份 DOM 暂空」——旧逻辑 return true 会 feeMatch:false。
    return false;
  }

  /**
   * @param {string} token
   * @param {"pending"|"missing"|"fail"} [reason]
   */
  function deferTokenRetry(token, reason) {
    const normalized = String(token || "").toLowerCase();
    if (!normalized || modeCache.has(normalized)) return;
    const previous = missingRetryState.get(normalized);
    const attempts = Math.min(8, (previous?.attempts || 0) + 1);
    const kind = reason === "pending" ? "pending" : reason === "fail" ? "fail" : "missing";
    const hot =
      (isGmgnHost() && isGmgnHotUnpaintedToken(normalized)) ||
      (isDebotHost() && isDebotHotUnpaintedToken(normalized));
    // GMGN / Debot 战壕：pending 用快表，避免 ⏳ 干等 15s。
    let delayMs;
    if (isGmgnHost() || isDebotHost()) {
      const early =
        kind === "pending"
          ? hot
            ? HOT_PENDING_RETRY_EARLY_MS
            : GMGN_PENDING_RETRY_EARLY_MS
          : hot
            ? HOT_MISSING_RETRY_EARLY_MS
            : GMGN_MISSING_RETRY_EARLY_MS;
      if (attempts <= early.length) {
        delayMs = early[attempts - 1];
      } else {
        const expBase = Math.max(0, attempts - 1 - early.length);
        const floor = kind === "pending" ? (hot ? 1200 : 1600) : hot ? 1800 : 2200;
        delayMs = Math.min(15000, Math.max(floor, floor * 2 ** Math.min(expBase, 3)));
      }
      if (hot && isGmgnHost()) noteGmgnHotWork();
    } else {
      const expBase = attempts - 1;
      delayMs = Math.min(MISSING_RETRY_MAX_MS, MISSING_RETRY_BASE_MS * 2 ** expBase);
    }
    missingRetryState.set(normalized, {
      attempts,
      retryAt: Date.now() + delayMs,
      kind
    });
    if (isGmgnHost() || isDebotHost()) scheduleGmgnMissingRequeue(normalized, delayMs);
  }

  /**
   * GMGN only: when miss/fail backoff ends, re-queue if the card is still marked.
   * Avoids waiting for the next list-scan tick after the lock expires.
   */
  function scheduleGmgnMissingRequeue(token, delayMs) {
    if (!token || !(isGmgnHost() || isDebotHost())) return;
    const prev = gmgnMissingRequeueTimers.get(token);
    if (prev) {
      try {
        window.clearTimeout(prev);
      } catch (_err) {
        // ignore
      }
      gmgnMissingRequeueTimers.delete(token);
    }
    // 定时器过多时丢掉最旧的（仍靠后续扫描入队）
    if (gmgnMissingRequeueTimers.size >= GMGN_MISSING_REQUEUE_MAX) {
      try {
        const oldest = gmgnMissingRequeueTimers.keys().next().value;
        if (oldest) {
          window.clearTimeout(gmgnMissingRequeueTimers.get(oldest));
          gmgnMissingRequeueTimers.delete(oldest);
        }
      } catch (_cap) {
        // ignore
      }
    }
    const wait = Math.max(40, Number(delayMs) || 0) + 30;
    const timerId = window.setTimeout(() => {
      gmgnMissingRequeueTimers.delete(token);
      if (!isExtensionContextValid() || !isTabVisible()) return;
      if (!(isGmgnHost() || isDebotHost())) return;
      const cached = modeCache.get(token);
      if (
        cached &&
        cached.__needsChain !== true &&
        !isHostFeeEntryPending(cached)
      ) {
        return;
      }
      if (!cached && isPersistentCacheHit(token)) {
        return;
      }
      const state = missingRetryState.get(token);
      if (state && Date.now() < state.retryAt) return;
      // Only requeue for cards we already discovered (no blind network storm).
      let hasMarked = false;
      try {
        hasMarked = !!document.querySelector(`[${CARD_DATA}="${token}"]`);
      } catch (_err) {
        hasMarked = false;
      }
      if (!hasMarked) return;
      queueToken(token);
    }, wait);
    gmgnMissingRequeueTimers.set(token, timerId);
  }

  /**
   * GMGN list: 视口上带 / 新创建列 未画正式徽章（可有 ⏳）→ 热路径。
   */
  function isDebotHotUnpaintedToken(token) {
    if (!isDebotHost() || isDebotTokenPage() || !token) return false;
    try {
      const icon = document.querySelector(
        `[${ICON_DATA}="1"][data-fee-token="${token}"]`
      );
      if (icon instanceof HTMLElement && icon.dataset.feeLoading !== "1") return false;
      const marked = document.querySelector(`[${CARD_DATA}="${token}"]`);
      if (!(marked instanceof HTMLElement)) return false;
      return isNearViewport(marked, false);
    } catch (_err) {
      return false;
    }
  }

  function isGmgnHotUnpaintedToken(token) {
    if (!isGmgnHost() || !token) return false;
    try {
      // 已有正式徽章（非 loading）→ 非热
      const icon = document.querySelector(
        `[${ICON_DATA}="1"][data-fee-token="${token}"]`
      );
      if (
        icon instanceof HTMLElement &&
        icon.dataset.feeLoading !== "1" &&
        document.contains(icon)
      ) {
        return false;
      }
      const cards = document.querySelectorAll(`[${CARD_DATA}="${token}"]`);
      const lim = Math.min(cards.length, 4);
      const leftBand = window.innerWidth / 3;
      for (let i = 0; i < lim; i += 1) {
        const card = cards[i];
        if (!(card instanceof HTMLElement)) continue;
        const r = card.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom <= 0) continue;
        // 顶区约 3～4 行
        if (r.top >= 80 && r.top < 620) return true;
        // 新创建左列可见带略放宽
        if (r.left < leftBand && r.top >= 80 && r.top < 720) return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  function noteGmgnHotWork() {
    lastGmgnHotWorkAt = Date.now();
  }

  /**
   * 当前是否应使用热档（扫间隔/防抖/组批）。
   * 有热 token 或 2.5s 内刚确认过热工作 → 热；否则稳态。
   */
  function isGmgnHotPathActive() {
    if (!isGmgnHost() || isTokenDetailRoute()) return false;
    if (!isAllowedScanChain()) return false;
    try {
      for (const t of requestQueue) {
        if (isGmgnHotUnpaintedToken(t)) {
          noteGmgnHotWork();
          return true;
        }
      }
    } catch (_q) {
      // ignore
    }
    if (Date.now() - lastGmgnHotWorkAt < HOT_PATH_HOLD_MS) return true;
    return false;
  }

  function gmgnListScanMinGapMs() {
    return isGmgnHotPathActive() ? HOT_GMGN_LIST_SCAN_MIN_GAP_MS : GMGN_LIST_SCAN_MIN_GAP_MS;
  }

  function gmgnMutationDebounceMs() {
    return isGmgnHotPathActive()
      ? HOT_MUTATION_SCAN_DEBOUNCE_GMGN_MS
      : MUTATION_SCAN_DEBOUNCE_GMGN_MS;
  }

  /**
   * GMGN: pull top-viewport / unpainted marked tokens first so 新创建 is not
   * starved behind a long FIFO of offscreen CA from earlier scans.
   * Debot keeps insertion order (no sort cost / behavior change).
   */
  function orderTokensForBatch(tokens) {
    if (!isGmgnHost() || isTokenDetailRoute() || !tokens || tokens.length <= 1) {
      return tokens;
    }
    const scored = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      let score = 0;
      try {
        const hasIcon = !!document.querySelector(
          `[${ICON_DATA}="1"][data-fee-token="${token}"]`
        );
        if (!hasIcon) score += 40;
        const cards = document.querySelectorAll(`[${CARD_DATA}="${token}"]`);
        const lim = Math.min(cards.length, 3);
        for (let j = 0; j < lim; j += 1) {
          const card = cards[j];
          if (!(card instanceof HTMLElement)) continue;
          const r = card.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (r.top >= 0 && r.top < window.innerHeight) {
            // Higher on screen → higher priority (cap 100).
            score += Math.max(0, 100 - Math.floor(r.top / 8));
            // Left column (新创建) boost.
            if (r.left < window.innerWidth / 3) score += 50;
          }
        }
      } catch (_err) {
        // ignore
      }
      scored.push({ token, score, i });
    }
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    return scored.map((x) => x.token);
  }

  /**
   * 批策略：
   * - 稳态：≥BATCH_MIN_TOKENS(3) 立即 / 否则 BATCH_FLUSH_MS(350ms)
   * - 热路径（队列含视口未画）：≥HOT_BATCH_MIN_TOKENS(2) 立即 / 否则 HOT_BATCH_FLUSH_MS(200ms)
   * 禁止全局 delayMs:0 连打。
   */
  function maybeFlushRequestQueue(_reason) {
    if (requestQueue.size === 0) return;
    if (needsHostTaxFeedPoll() && !hostTaxFeedReady()) {
      scheduleHostTaxFeedRetry(_reason);
      return;
    }
    let hot = false;
    if (isGmgnHost() && !isTokenDetailRoute()) {
      try {
        for (const t of requestQueue) {
          if (isGmgnHotUnpaintedToken(t)) {
            hot = true;
            noteGmgnHotWork();
            break;
          }
        }
      } catch (_e) {
        // ignore
      }
    }
    const minTok = hot ? HOT_BATCH_MIN_TOKENS : BATCH_MIN_TOKENS;
    const flushMs = hot ? HOT_BATCH_FLUSH_MS : BATCH_FLUSH_MS;
    // 0.7.57: 主批健康在途时，热 token 立刻走热通道并行发送（不等主批 finally）。
    // 僵尸主批（超时）仍交给下方 scheduleBatchFlush 的 recover 路径处理。
    if (hot && batchActive && !hotLaneActive) {
      const mainAgeMs = batchStartedAt ? Date.now() - batchStartedAt : BATCH_STUCK_MS + 1;
      if (mainAgeMs < BATCH_STUCK_MS) void flushHotLane();
    }
    if ((isGmgnHost() || isDebotHost()) && gmgnNewCardPendingTokens.size > 0) {
      let newCardPending = 0;
      for (const token of gmgnNewCardPendingTokens) {
        if (!tokenNeedsModesFetch(token)) {
          requestQueue.delete(token);
          gmgnNewCardPendingTokens.delete(token);
          cancelLoadingModesKick(token);
          continue;
        }
        if (requestQueue.has(token)) newCardPending += 1;
        else gmgnNewCardPendingTokens.delete(token);
      }
      if (newCardPending > 0 && newCardPending < GMGN_NEW_CARD_BATCH_MIN_TOKENS) {
        scheduleGmgnNewCardBatchFlush();
        // 0.7.16: 组批窗只延迟新卡自身；队列里还有其它 token 时继续正常 flush
        // （新卡随批搭车），否则 1–2 张新卡会把视口未画 token 拖住最多 500ms。
        if (newCardPending >= requestQueue.size) return;
      }
    }
    if (requestQueue.size >= minTok) {
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
    } else {
      scheduleBatchFlush({ delayMs: flushMs });
    }
  }

  function queueToken(token, options = {}) {
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok)) return;
    // 非 BSC 页禁止入队（双保险）
    if (!isAllowedScanChain()) return;
    if (!isBadgeAccessAllowed()) return;
    // 自定义尾号屏蔽：不入队、不打 /modes（省 RPC）
    if (shouldHideByCustomSuffix(tok)) return;
    const cachedHit = modeCache.get(tok);
    // host-fee preview 常 __needsChain=false，但分红仍是 BNB → 仍要打 /modes
    if (cachedHit && cachedHit.__needsChain !== true && !isHostFeeEntryPending(cachedHit)) {
      if (!hostFeeShouldDeferToModes(cachedHit)) {
        requestQueue.delete(tok);
        gmgnNewCardPendingTokens.delete(tok);
        cancelLoadingModesKick(tok);
        return;
      }
    }
    if (!cachedHit && isPersistentCacheHit(tok)) return;
    if (requestQueue.has(tok)) return;
    const missingState = missingRetryState.get(tok);
    if (missingState && Date.now() < missingState.retryAt) return;
    requestQueue.add(tok);
    if (isGmgnHotUnpaintedToken(tok)) noteGmgnHotWork();
    debugInfo("queue", { token: tok, queueSize: requestQueue.size });
    if (options.deferFlush === true) return;
    scheduleHostFeeGraceFlush("queue");
  }

  function scheduleGmgnNewCardBatchFlush() {
    if ((!isGmgnHost() && !isDebotHost()) || gmgnNewCardPendingTokens.size === 0) {
      return;
    }
    const waitMs = isDebotHost()
      ? DEBOT_NEW_CARD_BATCH_FLUSH_MS
      : GMGN_NEW_CARD_BATCH_FLUSH_MS;
    let pendingCount = 0;
    for (const token of gmgnNewCardPendingTokens) {
      if (!tokenNeedsModesFetch(token)) {
        requestQueue.delete(token);
        gmgnNewCardPendingTokens.delete(token);
        cancelLoadingModesKick(token);
        continue;
      }
      let stillMarked = false;
      try {
        stillMarked = !!document.querySelector(`[${CARD_DATA}="${token}"]`);
      } catch (_err) {
        stillMarked = false;
      }
      if (requestQueue.has(token) && stillMarked) pendingCount += 1;
      else {
        requestQueue.delete(token);
        gmgnNewCardPendingTokens.delete(token);
      }
    }
    if (pendingCount === 0) return;
    if (pendingCount >= GMGN_NEW_CARD_BATCH_MIN_TOKENS) {
      if (gmgnNewCardBatchTimer) {
        window.clearTimeout(gmgnNewCardBatchTimer);
        gmgnNewCardBatchTimer = null;
      }
      // 0.7.57: 主批在途时新卡走热通道，否则 scheduleBatchFlush 会静默 no-op。
      // Debot 空金库继续组批，不走热通道单打。
      if (isGmgnHost() && batchActive && !hotLaneActive) void flushHotLane();
      scheduleBatchFlush({ immediate: true, delayMs: 0 });
      return;
    }
    if (gmgnNewCardBatchTimer) return;
    gmgnNewCardBatchTimer = window.setTimeout(() => {
      gmgnNewCardBatchTimer = null;
      if (!isExtensionContextValid() || !isTabVisible()) return;
      let hasPending = false;
      for (const token of gmgnNewCardPendingTokens) {
        if (!tokenNeedsModesFetch(token)) {
          requestQueue.delete(token);
          gmgnNewCardPendingTokens.delete(token);
          cancelLoadingModesKick(token);
          continue;
        }
        let stillMarked = false;
        try {
          stillMarked = !!document.querySelector(`[${CARD_DATA}="${token}"]`);
        } catch (_err) {
          stillMarked = false;
        }
        if (requestQueue.has(token) && stillMarked) {
          hasPending = true;
          break;
        }
        requestQueue.delete(token);
        gmgnNewCardPendingTokens.delete(token);
      }
      if (hasPending) {
        // 0.7.57: 组批窗到期时主批可能仍在途 — GMGN 新卡改走热通道并行发送。
        if (isGmgnHost() && batchActive && !hotLaneActive) void flushHotLane();
        scheduleBatchFlush({ immediate: true, delayMs: 0 });
      }
    }, waitMs);
  }

  /**
   * Debot/Gungnir: host-fee 落盘后快补视口未画卡（与 GMGN paintGmgnCachedViewportCards 对齐）。
   */
  function paintDebotHostFeeViewport(reason) {
    if (!isDebotHost() || isDebotTokenPage()) return 0;
    if (!isExtensionContextValid() || !isTabVisible()) return 0;
    const t0 = performance.now();
    let painted = 0;
    const cap = 12;
    const seen = new Set();
    try {
      const seeds = [];
      const roots = getScanRoots(false);
      const seedRoots = roots.length ? roots : [];
      for (let ri = 0; ri < seedRoots.length; ri += 1) {
        const root = seedRoots[ri];
        if (!root?.querySelectorAll) continue;
        root.querySelectorAll(`[${CARD_DATA}]`).forEach((el) => {
          if (seeds.length >= cap + 6) return;
          if (el instanceof HTMLElement) seeds.push(el);
        });
        if (seeds.length >= cap + 6) break;
      }
      if (seeds.length < cap + 2) {
        const nodes = getDebotCandidateNodes().slice(0, 28);
        for (let i = 0; i < nodes.length; i += 1) {
          const card = siteStrategy?.findCard?.(nodes[i]);
          if (card instanceof HTMLElement) seeds.push(card);
        }
      }
      for (let i = 0; i < seeds.length; i += 1) {
        if (painted >= cap) break;
        if (performance.now() - t0 > 14) break;
        const card = seeds[i];
        if (!(card instanceof HTMLElement) || seen.has(card)) continue;
        seen.add(card);
        if (!isVisible(card) || isBadgeMountForbidden(card)) continue;
        const token =
          card.dataset[CARD_MARK] ||
          extractCardHrefToken(card) ||
          siteStrategy?.extractToken?.(card) ||
          "";
        const tok = String(token || "").toLowerCase();
        if (!TARGET_TOKEN_RE.test(tok)) continue;
        const existing = findLocalBadgeForCard(card, tok);
        if (
          existing instanceof HTMLElement &&
          existing.dataset.feeToken === tok &&
          existing.dataset.feeLoading !== "1" &&
          isStablePaintedCard(card, false)
        ) {
          continue;
        }
        const entry = resolveEntry(tok);
        if (!entry || isFeeLoadingEntry(entry) || isHostFeeEntryPending(entry)) continue;
        card.dataset[CARD_MARK] = tok;
        if (paintListCardFromCacheFast(card, tok, entry) || renderMode(card, tok, entry)) {
          painted += 1;
        }
      }
    } catch (_err) {
      // ignore
    }
    if (painted) {
      debugInfo("debot:host-fee-paint", { reason: reason || "", painted });
    }
    return painted;
  }

  /**
   * GMGN list only: after /modes returns, paint viewport cards that already have
   * modeCache (bounded time/cards). No network, no force scan — avoids waiting a
   * full scan interval for brand-new rows that just got fee data.
   */
  function paintGmgnCachedViewportCards(reason) {
    if (!isGmgnHost() || isTokenDetailRoute()) return 0;
    if (!isExtensionContextValid() || !isTabVisible()) return 0;
    if (isTokenEnterTransitionActive()) return 0;
    if (!tryFinishListReturnTransition(`post-api:${reason || "paint"}`)) return 0;
    if (isGmgnScrollCooling() && reason !== "host-fee") return 0;
    const t0 = performance.now();
    let painted = 0;
    let queued = 0;
    const seen = new Set();
    const paintCap = isGmgnHotPathActive()
      ? HOT_GMGN_POST_API_PAINT_CARDS
      : GMGN_POST_API_PAINT_CARDS;
    const paintMs = isGmgnHotPathActive()
      ? HOT_GMGN_POST_API_PAINT_MS
      : GMGN_POST_API_PAINT_MS;
    try {
      const seeds = collectListReturnAnchorsRoundRobin({
        cap: paintCap + 4,
        forceFreshRoots: false
      });
      for (let i = 0; i < seeds.length; i += 1) {
        if (painted >= paintCap) break;
        if (performance.now() - t0 > paintMs) break;
        const resolved = resolveListReturnSeed(seeds[i]);
        if (!resolved) continue;
        const { card, token } = resolved;
        if (!token || !(card instanceof HTMLElement) || seen.has(card)) continue;
        seen.add(card);
        if (!isVisible(card)) continue;
        if (isStablePaintedCard(card, false)) continue;
        const entry = getEntryForCard(card, token);
        if (!entry) {
          // host-fee 快路径：有 page-hook 时先等 grace，勿立刻 /modes
          if (card.dataset[CARD_MARK] === token) {
            queueToken(token, { deferFlush: pageHookHostFeeReady() });
            queued += 1;
          }
          continue;
        }
        card.dataset[CARD_MARK] = token;
        try {
          card.setAttribute(CARD_DATA, token);
        } catch (_errAttr) {
          // ignore
        }
        if (paintListCardFromCacheFast(card, token, entry) || renderMode(card, token, entry)) {
          painted += 1;
        }
      }
    } catch (_err) {
      // ignore
    }
    if (painted || queued) {
      debugInfo("gmgn:post-api-paint", { reason: reason || "", painted, queued });
    }
    return painted;
  }

  function scheduleBatchFlush(options = {}) {
    const immediate = options.immediate === true;
    const delayMs =
      typeof options.delayMs === "number" && options.delayMs >= 0
        ? options.delayMs
        : immediate
          ? 0
          : BATCH_FLUSH_MS;
    recoverStuckBatch(false);
    // If still active but timer-less and over budget, force recover (zombie batchActive).
    if (batchActive) {
      const ageMs = batchStartedAt ? Date.now() - batchStartedAt : BATCH_STUCK_MS + 1;
      if (ageMs >= BATCH_STUCK_MS || !batchStartedAt) {
        recoverStuckBatch(true, "flush-zombie-batch");
      } else {
        return;
      }
    }
    if (batchActive) return;
    if (batchTimer) {
      // Keep an already-sooner timer (hot 50ms must not be replaced by list 180ms).
      if (!immediate && pendingBatchDelayMs >= 0 && delayMs >= pendingBatchDelayMs) {
        return;
      }
      if (!immediate && delayMs >= BATCH_FLUSH_MS && pendingBatchDelayMs < 0) return;
      window.clearTimeout(batchTimer);
      batchTimer = null;
      pendingBatchDelayMs = -1;
    }
    pendingBatchDelayMs = delayMs;
    batchTimer = window.setTimeout(flushTokenBatch, delayMs);
  }

  function isContextInvalidError(error) {
    const message = String(error?.message || error || "");
    return (
      message.includes("Extension context invalidated") ||
      message.includes("Extension context") ||
      !isExtensionContextValid()
    );
  }

  /**
   * Shared /modes response handling for both the main batch and the hot lane:
   * cache + paint confirmed results, then schedule pending/missing retries.
   */
  function processModesResponse(tokens, data, lane) {
    if (!isBadgeAccessAllowed()) return;
    debugInfo("request:ok", {
      lane,
      requested: tokens.length,
      returned: Object.keys(data.results || {}).length,
      missing: (data.missing || []).length,
      upstreamError: data.upstream_error || null
    });
    const confirmed = [];
    Object.entries(data.results || {}).forEach(([rawToken, result]) => {
      const token = String(rawToken).toLowerCase();
      const entry = normalizeResult(result);
      if (!entry) return;
      const prev = modeCache.get(token);
      if (prev && prev.source_host && prev.is_vault && !entry.is_vault) {
        const nextBag = normalizeBasketAssets(entry.basket_assets).length;
        // 宿主金库 vs 旧 KV 🔥：不要用销毁盖掉金库。
        if (nextBag === 0) return;
      }
      if (
        entry.is_vault &&
        normalizeBasketAssets(entry.basket_assets).length >= 1 &&
        !basketLooksLikeNativeOnly(entry.basket_assets) &&
        !basketLooksLikePoolQuote(entry)
      ) {
        entry.is_stocks_vault = true;
      }
      modeCache.set(token, entry);
      missingRetryState.delete(String(token).toLowerCase());
      const missTimer = gmgnMissingRequeueTimers.get(String(token).toLowerCase());
      if (missTimer) {
        try {
          window.clearTimeout(missTimer);
        } catch (_errT) {
          // ignore
        }
        gmgnMissingRequeueTimers.delete(String(token).toLowerCase());
      }
      confirmed.push([token, entry]);
    });
    if (confirmed.length > 0) {
      const cardsByToken = new Map();
      document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
        if (!(card instanceof HTMLElement)) return;
        const marked = card.dataset[CARD_MARK] || card.getAttribute(CARD_DATA) || "";
        if (!marked) return;
        if (!cardsByToken.has(marked)) cardsByToken.set(marked, []);
        cardsByToken.get(marked).push(card);
      });
      confirmed.forEach(([token, entry]) => {
        applyModeToKnownCards(token, entry, cardsByToken.get(token) || []);
        try {
          const wantBasket = getBasketAssetsForDisplay(entry).length;
          (cardsByToken.get(token) || []).forEach((card) => {
            const icon = card.querySelector?.(`[${ICON_DATA}="1"]`);
            if (
              icon instanceof HTMLElement &&
              Number(icon.dataset.feeBasketCount || 0) !== wantBasket
            ) {
              delete icon.dataset.feeSig;
            }
          });
        } catch (_bcSig) {
          // ignore
        }
        // Tax-recv hide: use fee market_bps when list-hook missed first paint.
        try {
          ingestFeeEntryForTaxRecv(token, entry);
        } catch (_errIngest) {
          // ignore
        }
      });
      persistConfirmedModes(confirmed);
      broadcastBasketAddrCache(confirmed);
      if (taxRecvHidePrefs.enabled) {
        scheduleTaxRecvHideApply(40);
      }
      const currentToken = extractTokenFromUrl();
      if (currentToken && confirmed.some(([token]) => token === currentToken)) {
        if (isDebotTokenPage()) {
          scheduleDebotHeaderRepair("request-ok", 0);
        } else if (isGmgnTokenPage()) {
          scheduleGmgnHeaderRepair("request-ok", 0);
        }
      }
      // GMGN list: paint newly-cached viewport rows immediately (bounded).
      // Debot already applies via known marks; skip to avoid extra main-thread work.
      if (isGmgnHost()) {
        try {
          if (isTokenDetailRoute()) {
            paintUnpaintedTargetViewportQuick("request-ok", null, true);
          } else {
            paintGmgnCachedViewportCards("request-ok");
          }
        } catch (_errPaint) {
          // ignore
        }
      } else if (isDebotHost() && isTrenchListPage()) {
        try {
          paintDebotHostFeeViewport("request-ok");
        } catch (_errDebotPaint) {
          // ignore
        }
      }
    }
    // Soft-miss：CF 先回缓存，miss 后台填 → pending 需更快重试；true missing 略缓。
    const pendingSet = new Set(
      (data.pending || []).map((t) => String(t).toLowerCase())
    );
    const missingSet = new Set(
      (data.missing || []).map((t) => String(t).toLowerCase())
    );
    pendingSet.forEach((t) => {
      if (!modeCache.has(t)) deferTokenRetry(t, "pending");
    });
    missingSet.forEach((t) => {
      if (!modeCache.has(t) && !pendingSet.has(t)) deferTokenRetry(t, "missing");
    });
    // 请求了但结果里既无 results 也无 missing/pending
    tokens.forEach((t) => {
      const k = String(t).toLowerCase();
      if (!modeCache.has(k) && !pendingSet.has(k) && !missingSet.has(k)) {
        deferTokenRetry(k, "missing");
      }
    });
  }

  /**
   * 0.7.57: reset the hot lane (abort in-flight, optionally requeue its tokens).
   */
  function resetHotLane(reason, requeue = true) {
    hotLaneGeneration += 1;
    if (hotLaneAbortController) {
      try {
        hotLaneAbortController.abort(reason || "hot-lane-reset");
      } catch (_err) {
        // ignore
      }
      hotLaneAbortController = null;
    }
    if (requeue) hotLaneTokens.forEach((token) => requestQueue.add(token));
    hotLaneTokens = [];
    hotLaneActive = false;
    hotLaneStartedAt = 0;
  }

  /**
   * 0.7.57 热通道：主批（batchActive）在途时，把队列里的热 token（视口/新创建
   * 未画）用第二条并行 /modes 发出去，消除「新币撞上冷大批要排队」的竞态。
   * 仅 GMGN 列表页；Debot 空金库走组批，禁止热通道每秒单打。
   * 主批空闲时不启用（走正常单飞路径）。
   */
  async function flushHotLane() {
    if (isTokenDetailRoute()) return;
    if (!isGmgnHost()) return;
    if (!isExtensionContextValid() || !isTabVisible()) return;
    if (!hostTaxFeedReady()) {
      scheduleHostTaxFeedRetry("hot-lane");
      return;
    }
    if (hotLaneActive) {
      const ageMs = hotLaneStartedAt ? Date.now() - hotLaneStartedAt : BATCH_STUCK_MS + 1;
      if (ageMs < BATCH_STUCK_MS) return;
      resetHotLane("hot-lane-stuck", true);
    }
    // 主批空闲 → 正常 flush 路径即可，热通道只做在途兜底。
    if (!batchActive) return;
    const hotTokens = [];
    for (const token of requestQueue) {
      // 主批已带上的 token 不重复请求（CF/后端虽会合并，但省一份带宽）。
      if (activeBatchTokens.includes(token)) continue;
      if (isGmgnHotUnpaintedToken(token) || isDebotHotUnpaintedToken(token)) {
        hotTokens.push(token);
        if (hotTokens.length >= HOT_LANE_MAX_TOKENS) break;
      }
    }
    if (hotTokens.length === 0) return;
    hotTokens.forEach((token) => {
      requestQueue.delete(token);
      gmgnNewCardPendingTokens.delete(token);
    });
    const controller = new AbortController();
    hotLaneAbortController = controller;
    const generation = (hotLaneGeneration += 1);
    hotLaneTokens = hotTokens.slice();
    hotLaneActive = true;
    hotLaneStartedAt = Date.now();
    try {
      debugInfo("request:start", { tokens: hotTokens, lane: "hot" });
      const data = await queryModes(hotTokens, controller.signal);
      if (generation !== hotLaneGeneration) return;
      consecutiveFails = 0;
      processModesResponse(hotTokens, data, "hot");
    } catch (error) {
      if (generation !== hotLaneGeneration) return;
      if (isContextInvalidError(error)) return;
      hotTokens.forEach((token) => deferTokenRetry(token, "fail"));
      if (isAbortError(error)) {
        debugInfo("request:aborted", { tokens: hotTokens, lane: "hot" });
      } else {
        debugInfo("request:failed", {
          tokens: hotTokens,
          lane: "hot",
          error: normalizeError(error)
        });
      }
    } finally {
      if (generation === hotLaneGeneration) {
        if (hotLaneAbortController === controller) hotLaneAbortController = null;
        hotLaneTokens = [];
        hotLaneActive = false;
        hotLaneStartedAt = 0;
      }
    }
  }

  async function flushTokenBatch() {
    batchTimer = null;
    pendingBatchDelayMs = -1;
    if (!isTabVisible()) return;
    recoverStuckBatch(false);
    if (batchActive) {
      const ageMs = batchStartedAt ? Date.now() - batchStartedAt : BATCH_STUCK_MS + 1;
      if (ageMs >= BATCH_STUCK_MS || !batchStartedAt) {
        recoverStuckBatch(true, "flush-start-zombie");
      } else {
        return;
      }
    }
    // 队列空或无目标 CA：绝不发 /modes
    if (batchActive || requestQueue.size === 0) return;
    // 防御：只发合法 7777/8888/ffff；host-fee 已可画的不再打 /modes
    for (const t of Array.from(requestQueue)) {
      if (!TARGET_TOKEN_RE.test(String(t)) || !tokenNeedsModesFetch(t)) {
        requestQueue.delete(t);
        gmgnNewCardPendingTokens.delete(t);
      }
    }
    if (requestQueue.size === 0) return;

    if (needsHostTaxFeedPoll() && !hostTaxFeedReady()) {
      scheduleHostTaxFeedRetry("batch-wait");
      return;
    }

    // Old content script after extension reload: stop all network work silently.
    if (!isExtensionContextValid()) {
      requestQueue.clear();
      batchActive = false;
      batchStartedAt = 0;
      activeBatchTokens = [];
      return;
    }

    // GMGN: viewport/top-band unpainted first; Debot: stable insertion order.
    const ordered = orderTokensForBatch(Array.from(requestQueue));
    const tokens = ordered.slice(0, MAX_BATCH_TOKENS);
    tokens.forEach((token) => {
      requestQueue.delete(token);
      gmgnNewCardPendingTokens.delete(token);
    });

    // Supersede any zombie controller (should be rare after recoverStuckBatch).
    abortActiveRequest("superseded");
    const controller = new AbortController();
    activeAbortController = controller;
    const generation = (batchGeneration += 1);
    activeBatchTokens = tokens.slice();
    batchActive = true;
    batchStartedAt = Date.now();

    try {
      debugInfo("request:start", { tokens, generation });
      const data = await queryModes(tokens, controller.signal);
      if (generation !== batchGeneration) return;

      consecutiveFails = 0;
      activeBatchTokens = [];
      processModesResponse(tokens, data, "main");
    } catch (error) {
      if (generation !== batchGeneration) return;
      if (isContextInvalidError(error)) {
        activeBatchTokens = [];
        requestQueue.clear();
        batchActive = false;
        batchStartedAt = 0;
        return;
      }

      // Fail open: a badge request must never create a retry loop beside the host's
      // navigation/render work. Future scans may retry after per-token backoff.
      tokens.forEach((t) => deferTokenRetry(t, "fail"));
      activeBatchTokens = [];

      if (isAbortError(error)) {
        debugInfo("request:aborted", {
          tokens,
          error: normalizeError(error)
        });
      } else if (isTransientNetworkError(error)) {
        consecutiveFails += 1;
        debugInfo("request:failed-transient", {
          tokens,
          fails: consecutiveFails,
          error: normalizeError(error)
        });
      } else {
        consecutiveFails += 1;
        debugInfo("request:failed", {
          tokens,
          fails: consecutiveFails,
          error: normalizeError(error)
        });
      }
    } finally {
      if (generation === batchGeneration) {
        if (activeAbortController === controller) activeAbortController = null;
        activeBatchTokens = [];
        batchActive = false;
        batchStartedAt = 0;
        if (isExtensionContextValid() && isTabVisible() && requestQueue.size > 0) {
          if (consecutiveFails > 0) {
            scheduleBatchFlush({ delayMs: nextRetryDelayMs() });
          } else {
            maybeFlushRequestQueue("batch-finally");
          }
        }
      }
    }
  }

  async function queryModes(tokens, externalSignal) {
    if (!isExtensionContextValid()) {
      throw new Error("Extension context invalidated");
    }
    if (externalSignal?.aborted) {
      const err = new Error("signal is aborted");
      err.name = "AbortError";
      throw err;
    }

    const controller = new AbortController();
    const onParentAbort = () => {
      try {
        controller.abort(externalSignal?.reason || "parent-abort");
      } catch (_err) {
        // ignore
      }
    };
    if (externalSignal) {
      externalSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    const timeout = window.setTimeout(() => {
      try {
        controller.abort("timeout");
      } catch (_err) {
        // ignore
      }
    }, REQUEST_TIMEOUT_MS);

    try {
      const headers = { "Content-Type": "application/json" };
      if (licenseAccessKey) {
        headers.Authorization = `Bearer ${licenseAccessKey}`;
        if (licenseDeviceId) {
          headers["X-Flap-Device-Id"] = licenseDeviceId;
        }
      }
      const res = await fetch(`${DEFAULT_API_BASE}/modes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ tokens }),
        signal: controller.signal,
        cache: "no-store"
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        debugInfo("request:bad-response", {
          status: res.status,
          body: data
        });
        if (
          res.status === 401 &&
          data?.error &&
          String(data.error).startsWith("license_")
        ) {
          noteLicenseDeniedFromApi(data.error);
        }
        const err = new Error(`batch query failed status=${res.status}`);
        if (res.status === 429) {
          err.name = "RateLimitError";
          // Push fail backoff up so a single 429 doesn't hammer the edge.
          consecutiveFails = Math.max(consecutiveFails, 3);
        }
        throw err;
      }
      return data;
    } catch (error) {
      // Badge lookup is optional. The batch owner applies quiet backoff; never surface an
      // extension error that could be mistaken for a host-page navigation failure.
      throw error;
    } finally {
      window.clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onParentAbort);
      }
    }
  }

  /**
   * 紧凑展示符号：拉丁 4 字 + 大写；中文分红名（哈基米…）必须保留，否则 → 后为空。
   * 0.5.22 起部分路径依赖 API label；本地重算 fee 时若剥掉 CJK 会丢 →SYMBOL。
   */
  function compactDisplaySymbol(symbol) {
    const s = String(symbol || "").trim();
    if (!s) return "";
    // 保留 CJK + 字母数字（去空格/标点）
    const cleaned = s.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
    if (!cleaned) return "";
    // 纯中文（或含中文）：最多 6 字，不 upper
    if (/[\u4e00-\u9fff]/.test(cleaned)) {
      return cleaned.length > 6 ? cleaned.slice(0, 6) : cleaned;
    }
    const raw = cleaned.toUpperCase();
    if (raw === "WBNB") return "BNB";
    return raw.length > 4 ? raw.slice(0, 4) : raw;
  }

  /** 币股篮子专用：保留 FXION/NVDAON 等区分度，仅剥 Flap 常见尾缀 B（NVDAB→NVDA） */
  const STOCK_CHIP_ALIASES = {
    FXION: "FXIO",
    NVDAON: "NVDA"
  };

  function compactBasketSymbol(symbol) {
    const s = String(symbol || "").trim();
    if (!s) return "";
    const cleaned = s.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
    if (!cleaned) return "";
    if (/[\u4e00-\u9fff]/.test(cleaned)) {
      return cleaned.length > 6 ? cleaned.slice(0, 6) : cleaned;
    }
    const raw = cleaned.toUpperCase();
    if (raw === "WBNB") return "BNB";
    // NVDAB→NVDA（{5,}B 会先吃掉整串导致永远不剥尾缀 B）
    if (raw.length >= 5 && raw.endsWith("B") && raw !== "BNB") {
      return raw.slice(0, -1);
    }
    const aliased = STOCK_CHIP_ALIASES[raw];
    if (aliased) return aliased.length > 6 ? aliased.slice(0, 6) : aliased;
    return raw.length > 6 ? raw.slice(0, 6) : raw;
  }

  function basketDisplaySymbols(assets) {
    return (assets || []).map((a) => compactBasketSymbol(a.symbol)).filter(Boolean);
  }

  function basketSymbolsReady(assets) {
    const rows = normalizeBasketAssets(assets);
    if (!rows.length) return false;
    if (rows.length < 2) return Boolean(rows[0]?.symbol);
    const syms = basketDisplaySymbols(rows);
    if (syms.length < 2) return false;
    return syms[0] !== syms[1];
  }

  function basketLikelyTruncated(assets, entry) {
    if (!entry || !entry.is_vault) return false;
    const stockish =
      entry.is_stocks_vault === true ||
      (Array.isArray(assets) && assets.length >= 2);
    if (!stockish) return false;
    const n = normalizeBasketAssets(assets).length;
    if (n < 3 || n > 4) return false;
    const mkt = Number(entry.market_bps) || 0;
    const div = Number(entry.dividend_bps) || 0;
    return mkt >= 9000 || div >= 9000;
  }

  function basketSecurityPending(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (entry.__awaitSecurity === true) {
      const until = Number(entry.__basketPendingUntil) || 0;
      if (!until || Date.now() < until) return true;
    }
    return basketLikelyTruncated(entry.basket_assets, entry) && entry.__needsChain === true;
  }

  function isStockVaultEntry(entry) {
    return isTrustedStockVault(entry);
  }

  function hostFeeAllocationBps(entry) {
    if (!entry) return 0;
    return (
      (Number(entry.dividend_bps) || 0) +
      (Number(entry.market_bps) || 0) +
      (Number(entry.deflation_bps) || 0) +
      (Number(entry.lp_bps) || 0) +
      (Number(entry.giggle_charity_bps) || 0) +
      (Number(entry.binance_charity_bps) || 0)
    );
  }

  /** 空金库/无成分币股交给 /modes；普通 💎/👨‍🍳 与已出成分的 📈 走快路径。 */
  function hostFeeShouldDeferToModes(entry) {
    if (!entry || !entry.source_host) return false;
    if (entry.__needsChain === true) return true;
    const n = normalizeBasketAssets(entry.basket_assets).length;
    const nativeOnly = basketLooksLikeNativeOnly(entry.basket_assets) || n === 0;
    if (entry.is_stocks_vault || n >= 2) {
      return n < 1 || nativeOnly;
    }
    if (entry.is_vault) return !isTrustedStockVault(entry);
    return false;
  }

  /** host-fee / DOM 未齐：继续 ⏳，避免 NVDA&NVDA 或错分红先闪出来 */
  function isHostFeeEntryPending(entry) {
    if (!entry || isFeeLoadingEntry(entry)) return false;
    const age = Date.now() - (Number(entry.fetched_at) || 0);
    const bps = hostFeeAllocationBps(entry);
    if (
      entry.source_host === "debot" &&
      bps > 0 &&
      !entry.is_vault &&
      !entry.is_stocks_vault
    ) {
      return false;
    }
    const deferMs = hostFeeShouldDeferToModes(entry)
      ? HOST_FEE_DEFER_MODES_MS
      : HOST_FEE_SYMBOL_GRACE_MS;
    if (basketSecurityPending(entry)) {
      return age < deferMs;
    }
    if (isStockVaultEntry(entry) && !basketSymbolsReady(entry.basket_assets)) {
      return age < deferMs;
    }
    const symbolWait =
      (Number(entry.dividend_bps) || 0) > 0 && dividendPayoutLooksNative(entry);
    if (
      entry.__needsChain === true ||
      hostFeeShouldDeferToModes(entry) ||
      (entry.source_host && symbolWait)
    ) {
      if (bps <= 0) return age < deferMs;
      return age < deferMs;
    }
    return false;
  }

  function schedulePendingHostFeePaint(token) {
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok) || hostFeePendingPaintTimers.has(tok)) return;
    if (hostFeePendingPaintTimers.size >= 32) {
      const oldest = hostFeePendingPaintTimers.keys().next().value;
      if (oldest) {
        try {
          window.clearTimeout(hostFeePendingPaintTimers.get(oldest));
        } catch (_old) {
          // ignore
        }
        hostFeePendingPaintTimers.delete(oldest);
      }
    }
    const entryNow = modeCache.get(tok);
    const delayMs =
      (hostFeeShouldDeferToModes(entryNow) ? HOST_FEE_DEFER_MODES_MS : HOST_FEE_SYMBOL_GRACE_MS) +
      50;
    const timerId = window.setTimeout(() => {
      hostFeePendingPaintTimers.delete(tok);
      if (!isExtensionContextValid()) return;
      const entry = modeCache.get(tok);
      if (!entry || isHostFeeEntryPending(entry) || isFeeLoadingEntry(entry)) return;
      applyModeToKnownCards(tok, entry);
    }, delayMs);
    hostFeePendingPaintTimers.set(tok, timerId);
  }

  function normalizeBasketAssets(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const address = typeof row.address === "string" ? row.address.toLowerCase() : "";
      const symbol = compactBasketSymbol(row.symbol || row.name || "");
      const name = String(row.name || symbol || "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, 48);
      if (!symbol && !name) continue;
      out.push({ address, symbol: symbol || compactBasketSymbol(name), name: name || symbol });
    }
    return dedupeBasketAssets(out);
  }

  function normalizeResult(result) {
    if (!result || !confirmedModes.has(result.mode)) return null;
    const label =
      typeof result.label === "string" && result.label
        ? result.label
        : modeMeta[result.mode]?.fallback || modeMeta.unknown.fallback;
    const title =
      typeof result.title === "string" && result.title
        ? result.title
        : modeMeta[result.mode]?.title || modeMeta.unknown.title;
    const topSegment =
      typeof result.top_segment === "string" && result.top_segment
        ? result.top_segment
        : "unknown";
    const topPayoutSymbol =
      typeof result.top_payout_symbol === "string" ? result.top_payout_symbol.trim() : "";
    return {
      mode: result.mode,
      label,
      title,
      dividend_bps: Number(result.dividend_bps) || 0,
      market_bps: Number(result.market_bps) || 0,
      deflation_bps: Number(result.deflation_bps) || 0,
      lp_bps: Number(result.lp_bps) || 0,
      giggle_charity_bps: Number(result.giggle_charity_bps) || 0,
      binance_charity_bps: Number(result.binance_charity_bps) || 0,
      is_vault: Boolean(result.is_vault),
      is_stocks_vault: Boolean(result.is_stocks_vault),
      buy_tax_bps: Number(result.buy_tax_bps) || 0,
      sell_tax_bps: Number(result.sell_tax_bps) || 0,
      top_segment: topSegment,
      top_payout_symbol: topPayoutSymbol,
      dividend_symbol:
        typeof result.dividend_symbol === "string" ? result.dividend_symbol : "",
      quote_symbol: typeof result.quote_symbol === "string" ? result.quote_symbol : "",
      quote_token: typeof result.quote_token === "string" ? result.quote_token.toLowerCase() : "",
      vault_address:
        typeof result.vault_address === "string" ? result.vault_address.toLowerCase() : "",
      basket_assets: normalizeBasketAssets(result.basket_assets),
      source_host: typeof result.source_host === "string" ? result.source_host : "",
      __needsChain: result.__needsChain === true,
      __awaitSecurity: result.__awaitSecurity === true,
      __basketPendingUntil:
        typeof result.__basketPendingUntil === "number" ? result.__basketPendingUntil : 0,
      fetched_at: typeof result.fetched_at === "number" ? result.fetched_at : null
    };
  }

  function applyModeToKnownCards(token, entry, knownCards = null) {
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok)) return;
    // 0.6.5: CA 定位 — mark + href 含完整 CA 的行（不靠 climb 猜）
    const fromCa = findCardsByCa(tok);
    const fromMark = knownCards
      ? Array.from(knownCards)
      : isGmgnHost() || isDebotHost()
        ? getScanRoots(false).flatMap((root) =>
            root?.querySelectorAll
              ? Array.from(root.querySelectorAll(`[${CARD_DATA}="${tok}"]`))
              : []
          )
        : Array.from(document.querySelectorAll(`[${CARD_DATA}="${tok}"]`));
    const seen = new Set();
    const cards = [];
    for (const c of [...fromCa, ...fromMark]) {
      if (c instanceof HTMLElement && !seen.has(c)) {
        seen.add(c);
        cards.push(c);
      }
    }
    cards.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      // 行身份 CA 必须就是 tok；否则拆掉误挂
      const idCa = extractCardHrefToken(card);
      if (idCa && idCa !== tok) {
        if (!TARGET_TOKEN_RE.test(idCa)) wipeNonTargetCardBadges(card, idCa);
        else clearCardIcon(card);
        return;
      }
      // Soft match after SPA: trust mark if short CA still matches (avoid full extract thrash).
      const live = siteStrategy.extractToken(card);
      if (live == null && (idCa === tok || cardStillMatchesToken(card, tok))) {
        renderMode(card, tok, entry);
        return;
      }
      if (live === tok) {
        renderMode(card, tok, entry);
      } else if (live != null) {
        clearCardIcon(card);
      }
    });
    // Token SPA: marks may be missing after host re-render — force header path.
    try {
      if (isDebotTokenPage()) {
        const urlTok = extractTokenFromUrl();
        if (urlTok && urlTok === tok && !hasDebotTokenHeaderBadge()) {
          tryPaintDebotTokenHeader("api-apply");
        }
      }
      if (isGmgnTokenPage()) {
        const urlTok = extractTokenFromUrl();
        if (urlTok && urlTok === tok) {
          // Always re-assert header after fee data lands (0.5.5).
          tryPaintGmgnTokenHeader("api-apply");
        }
      }
      // Search/history overlay: paint as soon as fee returns (0.4.38).
      if (quickHasOpenOverlay()) {
        overlayFastUntil = Math.max(overlayFastUntil, Date.now() + 2000);
        if (isGmgnHost()) {
          scheduleGmgnOverlayPaint("api-apply", 0, false);
        } else {
          try {
            fastPaintOverlayFromCache();
          } catch (_err2) {
            // ignore
          }
          scheduleScan(0, {
            force: true,
            immediate: true,
            light: true,
            bypassForceGap: true
          });
        }
      }
    } catch (_err) {
      // ignore
    }
  }

  function bpsToPercentStr(bps) {
    const value = Number(bps) || 0;
    if (value % 100 === 0) return `${value / 100}%`;
    const text = (value / 100).toFixed(1).replace(/\.0$/, "");
    return `${text}%`;
  }

  /**
   * Segment text: 100% (10000 bps) → emoji only; else emoji+percent.
   * e.g. 💎100% → 💎 ; 💎90% stays 💎90% ; arrow still allowed: 💎→BNB
   */
  function formatSegmentBase(emoji, bps) {
    const value = Number(bps) || 0;
    if (value >= 10000) return String(emoji || "");
    return `${emoji}${bpsToPercentStr(value)}`;
  }

  /** True if card is nested inside another element already marked as a fee card. */
  function isNestedFeeCard(card) {
    if (!(card instanceof HTMLElement)) return false;
    let p = card.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      if (p.dataset?.[CARD_MARK] || p.getAttribute?.(CARD_DATA)) return true;
      p = p.parentElement;
    }
    return false;
  }

  /**
   * Debot absolute mode: one visual card often has nested CARD_MARK nodes
   * (MuiCard + metrics row). Painting both → two absolute badges stacked.
   * Clear nested marks/icons under `card` so only the outermost paints.
   */
  function clearNestedFeeMarksUnder(card, tokenHint) {
    if (!(card instanceof HTMLElement)) return;
    const token =
      tokenHint ||
      card.dataset[CARD_MARK] ||
      card.getAttribute(CARD_DATA) ||
      "";
    try {
      card.querySelectorAll(`[${CARD_DATA}]`).forEach((el) => {
        if (!(el instanceof HTMLElement) || el === card) return;
        // Only strip our nested marks (not unrelated marked hosts if any).
        if (token) {
          const t = el.dataset[CARD_MARK] || el.getAttribute(CARD_DATA) || "";
          if (t && t !== token) return;
        }
        try {
          el.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
            try {
              n.remove();
            } catch (_err) {
              // ignore
            }
          });
        } catch (_err2) {
          // ignore
        }
        try {
          delete el.dataset[CARD_MARK];
          el.removeAttribute(CARD_DATA);
        } catch (_err3) {
          // ignore
        }
      });
    } catch (_err) {
      // ignore
    }
  }

  /**
   * After absolute place: drop leftover same-token icons under this card tree
   * (Tax-mode sibling mounts, nested marks). Never touch other column cards.
   */
  function purgeAbsoluteDuplicatesOnCard(card, keepIcon, token) {
    if (!(card instanceof HTMLElement) || !token) return;
    clearNestedFeeMarksUnder(card, token);
    try {
      card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
        if (n === keepIcon) return;
        try {
          n.remove();
        } catch (_err) {
          // ignore
        }
      });
    } catch (_err) {
      // ignore
    }
    // Siblings of card (placeBesideTaxChip beforebegin climbed out of inner mount).
    for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
      if (!(sib instanceof HTMLElement) || sib === keepIcon) continue;
      if (sib.dataset?.[ICON_MARK] !== "1" && !sib.matches?.(`[${ICON_DATA}="1"]`)) continue;
      if (sib.dataset.feeToken && sib.dataset.feeToken !== token) continue;
      try {
        sib.remove();
      } catch (_err) {
        // ignore
      }
    }
    // Parent children near this card with same token (Debot metrics mount outside mark).
    const parent = card.parentElement;
    if (parent) {
      Array.from(parent.children).forEach((ch) => {
        if (!(ch instanceof HTMLElement) || ch === card || ch === keepIcon) return;
        if (ch.dataset?.[ICON_MARK] !== "1" && ch.getAttribute?.(ICON_DATA) !== "1") return;
        if (ch.dataset.feeToken && ch.dataset.feeToken !== token) return;
        try {
          const cr = card.getBoundingClientRect();
          const ir = ch.getBoundingClientRect();
          if (Math.abs(ir.top - cr.top) > cr.height + 12) return;
          if (ir.right < cr.left - 12 || ir.left > cr.right + 12) return;
          ch.remove();
        } catch (_err) {
          // ignore
        }
      });
    }
  }

  /**
   * Normalize pool/quote display symbol.
   * allowCjk: keep Chinese names (API 币安人生); latin path uppercases A-Z0-9 only.
   */
  function normalizeQuoteSymbol(raw, options = {}) {
    const allowCjk = options.allowCjk === true;
    let symbol = String(raw || "").trim();
    if (!symbol) return "";

    if (allowCjk) {
      // Letters, digits, CJK — drop spaces/punctuation (流动池 suffix stripped by caller).
      symbol = symbol.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
      if (!symbol) return "";
      if (symbol.length > MAX_QUOTE_SYMBOL_LEN) {
        symbol = symbol.slice(0, MAX_QUOTE_SYMBOL_LEN);
      }
      // Pure latin → uppercase for consistency (BNB, BTCB).
      if (/^[A-Za-z0-9]+$/.test(symbol)) symbol = symbol.toUpperCase();
      if (symbol === "BSC" || symbol === "LOGO") return "";
      return symbol;
    }

    symbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!symbol) return "";
    if (symbol.length > MAX_QUOTE_SYMBOL_LEN) {
      symbol = symbol.slice(0, MAX_QUOTE_SYMBOL_LEN);
    }
    if (symbol === "BSC" || symbol === "LOGO") return "";
    return symbol;
  }

  function getGmgnChainKey() {
    try {
      const chain = new URL(location.href).searchParams.get("chain");
      if (chain) return String(chain).toLowerCase();
    } catch (_err) {
      // ignore
    }
    // Host-only path may still be BSC home.
    if (location.hostname.endsWith("gmgn.ai")) return "bsc";
    return "";
  }

  function matchGmgnSpecialQuoteIcon(img) {
    if (!(img instanceof HTMLElement)) return "";
    const dataIcon = img.getAttribute("data-icon") || "";
    const src = img.currentSrc || img.getAttribute("src") || "";
    const hay = `${dataIcon} ${src}`;
    for (let i = 0; i < GMGN_ICON_QUOTE_RULES.length; i += 1) {
      const [re, symbol] = GMGN_ICON_QUOTE_RULES[i];
      if (re.test(hay)) return symbol;
    }
    return "";
  }

  function isRealPoolQuoteSymbol(sym) {
    const s = String(sym || "").toUpperCase();
    return REAL_POOL_QUOTE_SYMS.has(s);
  }

  function displayPoolQuoteSymbol(sym) {
    const s = String(sym || "").toUpperCase();
    if (s === "WBNB") return "BNB";
    return sym || "";
  }

  function isVaultPoolToken(entry) {
    return Boolean(entry && (entry.is_vault || entry.is_stocks_vault));
  }

  /** 币股篮子金库：GMGN 股票芯片不是 LP，底池固定 BNB。普通税收金库（QQQB 池）不要套这条。 */
  function forceVaultNativePoolQuote(entry) {
    return isTrustedStockVault(entry);
  }

  /** 徽章底池文案：原生报价保持 BNB/USD1/BTCB；Flap 尾缀 B（SPCXB）剥成 SPCX。 */
  function formatPoolQuoteSymbol(sym) {
    const shown = displayPoolQuoteSymbol(sym);
    if (!shown) return "";
    if (isRealPoolQuoteSymbol(shown)) return displayPoolQuoteSymbol(shown);
    const compact = compactBasketSymbol(shown) || shown;
    const ver = String(compact).match(/^([A-Z]{2,8})\d+$/);
    return ver ? ver[1] : compact;
  }

  /** GMGN `/quotes/xaut0.png` 一类带版本号的文件名 → XAUT */
  function quoteSymbolFromQuotesFilename(name) {
    const raw = normalizeQuoteSymbol(name, { allowCjk: true });
    if (!raw) return "";
    if (isRealPoolQuoteSymbol(raw)) return raw;
    const m = raw.match(/^([A-Z]{2,8})\d+$/);
    return m ? m[1] : raw;
  }

  function ingestGmgnQuotesCatalog(json) {
    const configs = json && json.configs && typeof json.configs === "object" ? json.configs : null;
    if (!configs) return 0;
    const chainKey = getGmgnChainKey() || "bsc";
    const rows = []
      .concat(Array.isArray(configs[chainKey]) ? configs[chainKey] : [])
      .concat(chainKey === "bsc" ? [] : Array.isArray(configs.bsc) ? configs.bsc : []);
    let n = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const item = rows[i];
      if (!item || typeof item !== "object") continue;
      const title = String(item.title || "").trim();
      const ca = String(item.ca || "")
        .trim()
        .toLowerCase();
      const file = String(
        (item.config && (item.config.iconSrcDark || item.config.iconSrcLight)) || ""
      );
      const stem = (file.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "").toLowerCase();
      if (stem && title) {
        gmgnQuoteByStem.set(stem, title);
        n += 1;
      }
      if (ca && /^0x[a-f0-9]{40}$/.test(ca) && title) gmgnQuoteByAddr.set(ca, title);
    }
    if (n) gmgnQuotesLoadedAt = Date.now();
    return n;
  }

  function ensureGmgnQuotesCatalog() {
    if (!isGmgnHost()) return;
    const now = Date.now();
    if (gmgnQuotesInflight) return;
    if (gmgnQuotesLoadedAt && now - gmgnQuotesLoadedAt < GMGN_QUOTES_TTL_MS) return;
    gmgnQuotesInflight = true;
    const url = `${location.origin}${GMGN_QUOTES_JSON_PATH}`;
    fetch(url, { credentials: "omit", cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`quotes.json ${r.status}`))))
      .then((json) => {
        ingestGmgnQuotesCatalog(json);
      })
      .catch((_err) => {
        // 目录失败时仍用文件名/DOM 角色；下次扫描再试
      })
      .finally(() => {
        gmgnQuotesInflight = false;
      });
  }

  function catalogTitleForQuoteStem(stem) {
    const key = String(stem || "")
      .trim()
      .toLowerCase();
    if (!key) return "";
    return gmgnQuoteByStem.get(key) || "";
  }

  function catalogTitleForQuoteAddr(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(a)) return "";
    return gmgnQuoteByAddr.get(a) || "";
  }

  function symbolFromGmgnQuotesStem(stem) {
    const titled = catalogTitleForQuoteStem(stem);
    if (titled) return titled;
    return quoteSymbolFromQuotesFilename(stem);
  }

  function isGmgnLaunchpadLogoSrc(src) {
    const s = String(src || "");
    return /\/static\/lpp\//i.test(s) || /\/static\/img\/dex\/logo\//i.test(s);
  }

  function stockChipMatchesBasket(sym, entry) {
    const s = String(sym || "").toUpperCase();
    if (!s) return false;
    const assets = entry && Array.isArray(entry.basket_assets) ? entry.basket_assets : [];
    for (let i = 0; i < assets.length; i += 1) {
      const raw = String((assets[i] && (assets[i].symbol || assets[i].name)) || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (!raw) continue;
      if (s === raw || s === `${raw}B` || s.startsWith(raw) || raw.startsWith(s)) return true;
    }
    return false;
  }

  function looksLikeStockQuoteChip(sym, entry) {
    const s = String(sym || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!s || isRealPoolQuoteSymbol(s)) return false;
    if (stockChipMatchesBasket(s, entry)) return true;
    if (s === "FXION" || s === "FXIO") return true;
    // GMGN 币股芯片常见 NVDAB / SPCXB / TSLAB，不是 LP quote。
    if (s.length >= 4 && s.endsWith("B") && s !== "WBTC") return true;
    // compactDisplaySymbol 会把 NVDAB→NVDA，创作者箭头仍不能用股票名
    if (
      /^(NVDA|FXIO|SPCX|GME|QQQ|MSFT|AAPL|TSLA|AMD|INTC|META|AMZN|GOOG|NFLX|COIN|MSTR|HOOD|PLTR|BABA|NIO|SOXL)(ON)?$/.test(
        s
      )
    ) {
      return true;
    }
    return false;
  }

  function vaultDefaultPoolQuote() {
    if (siteStrategy.name === "gmgn") {
      return GMGN_CHAIN_NATIVE_QUOTE[getGmgnChainKey()] || "BNB";
    }
    return "BNB";
  }

  /**
   * 底池符号：稳的路径优先，不稳才回退。
   * 1) Tax 外 /static/quotes/{stem}.png 文件名（js-mcp：与 GMGN 底池芯片同源）
   * 2) quote_address → quotes.json 目录（WSS 常有地址、无 quote_symbol）
   * 3) host-fee / HTTP / 链 quote_symbol（BNB/WBNB 视为未齐）
   * 4) 有非零 quote_token 但目录未命中 → 先空着，禁止闪 BNB
   * 5) 无外图且地址为空/WBNB → BSC 默认 BNB
   * 金库：Tax 内图是篮子，不当底池。
   */
  function pickStablePoolQuote(entry, card) {
    const apiRaw =
      entry && typeof entry.quote_symbol === "string" ? entry.quote_symbol.trim() : "";
    const fromApi = apiRaw ? normalizeQuoteSymbol(apiRaw, { allowCjk: true }) : "";
    const qTok = (entry && (entry.quote_token || entry.quote_address)) || "";
    const fromAddr = catalogTitleForQuoteAddr(qTok);

    if (forceVaultNativePoolQuote(entry)) {
      if (fromApi && isRealPoolQuoteSymbol(fromApi)) return formatPoolQuoteSymbol(fromApi);
      if (fromAddr && isRealPoolQuoteSymbol(fromAddr)) return formatPoolQuoteSymbol(fromAddr);
      return vaultDefaultPoolQuote();
    }

    const fromDom = card ? extractQuoteSymbolFromDom(card) : "";
    if (fromDom && !quoteSymbolLooksNative(fromDom)) {
      const leftoverStockPool =
        quoteTokenLooksNative(qTok) && looksLikeStockQuoteChip(fromDom, entry);
      if (!leftoverStockPool) return formatPoolQuoteSymbol(fromDom);
    }
    if (fromDom && isRealPoolQuoteSymbol(fromDom)) return formatPoolQuoteSymbol(fromDom);
    if (fromAddr && !quoteSymbolLooksNative(fromAddr)) return formatPoolQuoteSymbol(fromAddr);
    if (fromApi && !quoteSymbolLooksNative(fromApi)) return formatPoolQuoteSymbol(fromApi);

    if (!quoteTokenLooksNative(qTok)) {
      ensureGmgnQuotesCatalog();
      const retry = catalogTitleForQuoteAddr(qTok);
      if (retry && !quoteSymbolLooksNative(retry)) return formatPoolQuoteSymbol(retry);
      return "";
    }

    if (fromDom) return formatPoolQuoteSymbol(fromDom);
    if (siteStrategy.name === "gmgn") {
      return GMGN_CHAIN_NATIVE_QUOTE[getGmgnChainKey()] || "BNB";
    }
    if (fromApi) return formatPoolQuoteSymbol(fromApi);
    return "";
  }

  /**
   * True when painted pool segment disagrees with the quote we should show.
   */
  function poolBadgeNeedsQuoteRefresh(icon, entry, card) {
    if (!(icon instanceof HTMLElement) || !entry) return false;
    if (displayPrefs && displayPrefs.pool === false) return false;
    const want = pickStablePoolQuote(entry, card);
    if (paintedPoolLooksNonNative(icon)) {
      if (want && quoteSymbolLooksNative(want)) return paintedPoolDisagrees(icon, want);
      if (want) return paintedPoolDisagrees(icon, want);
      return false;
    }
    if (want) return paintedPoolDisagrees(icon, want);
    if (
      !forceVaultNativePoolQuote(entry) &&
      !quoteTokenLooksNative(entry.quote_token || entry.quote_address)
    ) {
      return paintedPoolDisagrees(icon, "BNB") === false;
    }
    return false;
  }

  function expectedPoolQuote(entry, card) {
    return pickStablePoolQuote(entry, card || null);
  }

  function resolveQuoteSymbol(card, entry) {
    return pickStablePoolQuote(entry, card);
  }

  /**
   * Read quote/pool symbol from site DOM only (no chain-native default).
   * Debot: aria-label "BNB 流动池" / "币安人生 流动池" / img alt.
   * GMGN: RWA "/static/quotes/xxx.png", special icons (USD1/USDT).
   */
  function extractQuoteSymbolFromDom(card) {
    if (!card || !card.querySelector) return "";
    const now = Date.now();
    const tok = cardDomCacheTok(card);
    const hit = poolQuoteDomCache.get(card);
    if (
      hit &&
      hit.tok === tok &&
      now - hit.at < (hit.quote ? POOL_QUOTE_DOM_CACHE_MS : POOL_QUOTE_DOM_EMPTY_CACHE_MS)
    ) {
      return hit.quote;
    }
    const quote = isGmgnHost()
      ? extractGmgnPoolQuoteFromDom(card)
      : extractDebotPoolQuoteFromDom(card);
    poolQuoteDomCache.set(card, { tok, at: now, quote });
    return quote;
  }

  function extractGmgnPoolQuoteFromDom(card) {
    const gmgnBar = card.closest
      ? card.closest('[data-sentry-component="BaseInfoBar"]')
      : null;
    const quoteRoot = gmgnBar || card;
    if (!quoteRoot.querySelectorAll) return "";
    const taxWrap = quoteRoot.querySelector(GMGN_TAX_DIVIDEND_WRAP) || null;
    const hasTaxSentry = Boolean(
      taxWrap || quoteRoot.querySelector('[data-sentry-component="TaxDividendTokenIcon"]')
    );

    const specialImgs = quoteRoot.querySelectorAll(
      'img[data-icon], img[src*="/static/icons/icon_usd"], img[src*="/static/icons/icon_usdt"], img[src*="/static/icons/icon_usdc"], img[src*="/static/icons/icon_weth"]'
    );
    for (let i = 0; i < specialImgs.length; i += 1) {
      const img = specialImgs[i];
      if (isGmgnTaxInnerQuoteImg(img)) continue;
      const src = img.currentSrc || img.getAttribute("src") || "";
      if (isGmgnLaunchpadLogoSrc(src)) continue;
      const special = matchGmgnSpecialQuoteIcon(img);
      if (special) return special;
    }

    const quoteImgs = quoteRoot.querySelectorAll(
      'img[alt$=" quote icon"], img[alt*=" quote icon"], img[src*="/static/quotes/"], img[src*="/quotes/"]'
    );
    for (let i = 0; i < quoteImgs.length; i += 1) {
      const quoteImg = quoteImgs[i];
      if (isGmgnTaxInnerQuoteImg(quoteImg)) continue;
      // Tax 哨兵未齐时第一张 quotes 几乎总是分红内图，宁可不写底池也不要 🦋AAPL
      if (!hasTaxSentry) continue;
      const src = quoteImg.currentSrc || quoteImg.getAttribute("src") || "";
      if (isGmgnLaunchpadLogoSrc(src)) continue;
      const fromFile = gmgnQuotesStemFromImg(quoteImg);
      const alt = quoteImg.getAttribute("alt") || "";
      const fromAlt = /quote icon/i.test(alt)
        ? normalizeQuoteSymbol(alt.replace(/\s*quote\s*icon\s*$/i, ""), { allowCjk: true })
        : "";
      const sym = fromFile || fromAlt;
      if (sym) return sym;
    }
    return "";
  }

  function extractDebotPoolQuoteFromDom(card) {
    const poolEl = card.querySelector(
      '[aria-label$="流动池"], [aria-label*=" 流动池"], [aria-label*="池子"]'
    );
    if (poolEl) {
      const img = poolEl.querySelector("img[alt]");
      if (img) {
        const fromAlt = normalizeQuoteSymbol(img.alt, { allowCjk: true });
        if (fromAlt) return fromAlt;
      }
      const aria = poolEl.getAttribute("aria-label") || "";
      // "BNB 流动池" / "币安人生 流动池" / "xxx 池子"
      const namePart = aria
        .replace(/\s*(流动池|池子)\s*$/u, "")
        .replace(/\s*池子\s*$/u, "")
        .trim();
      if (namePart) {
        const fromAria = normalizeQuoteSymbol(namePart, { allowCjk: true });
        if (fromAria) return fromAria;
      }
      const latin = aria.match(/[A-Za-z0-9]{1,12}/);
      if (latin) {
        const fromLatin = normalizeQuoteSymbol(latin[0]);
        if (fromLatin) return fromLatin;
      }
    }

    const coinImgs = card.querySelectorAll(
      'img[src*="/images/chain/designer-icons/coin/"], img[src*="/images/share/usdt"]'
    );
    for (let i = 0; i < coinImgs.length; i += 1) {
      const img = coinImgs[i];
      const fromAlt = normalizeQuoteSymbol(img.getAttribute("alt") || "", { allowCjk: true });
      if (fromAlt) return fromAlt;
      const src = img.currentSrc || img.getAttribute("src") || "";
      const fromPath = src.match(/\/(?:coin|bstocks)\/([^./?#]+)/i);
      if (fromPath) {
        const sym = normalizeQuoteSymbol(fromPath[1], { allowCjk: true });
        if (sym) return sym;
      }
    }

    return "";
  }

  /** 币股 vault：Tax 芯片内多枚 /quotes 图标 → 篮子 symbol（与 GMGN tooltip 同源 DOM） */
  function extractBasketSymbolsFromTaxDom(card) {
    if (!card || !card.querySelector) return [];
    if (isGmgnHost() && gmgnTaxInnerStaleAfterReuse(card)) return [];
    const now = Date.now();
    const tok = cardDomCacheTok(card);
    const hit = taxBasketDomCache.get(card);
    if (
      hit &&
      hit.tok === tok &&
      now - hit.at <
        (hit.syms && hit.syms.length ? POOL_QUOTE_DOM_CACHE_MS : POOL_QUOTE_DOM_EMPTY_CACHE_MS)
    ) {
      return hit.syms;
    }
    const syms = [];
    const seen = new Set();
    const pushSym = (raw) => {
      const sym = compactBasketSymbol(raw);
      if (!sym || sym === "BNB" || seen.has(sym)) return;
      seen.add(sym);
      syms.push(sym);
    };
    if (isDebotHost()) {
      card
        .querySelectorAll(
          'img[src*="/images/share/bstocks/"], img[src*="/images/chain/designer-icons/coin/"]'
        )
        .forEach((img) => {
          const src = img.currentSrc || img.getAttribute("src") || "";
          const fromPath = src.match(/\/(?:bstocks|coin)\/([^./?#]+)/i);
          if (fromPath) pushSym(fromPath[1]);
          else pushSym(img.getAttribute("alt") || "");
        });
      taxBasketDomCache.set(card, { tok, at: now, syms });
      return syms;
    }
    const tax =
      card.querySelector('[data-sentry-component="TaxDividendTokenIcons"]') ||
      card.querySelector(".trenches-tax");
    if (!tax) {
      taxBasketDomCache.set(card, { tok, at: now, syms });
      return syms;
    }
    tax
      .querySelectorAll(
        '[data-sentry-component="TaxDividendTokenIcon"] img, img[src*="/quotes/"], img[src*="/static/quotes/"]'
      )
      .forEach((img) => {
        const src = img.currentSrc || img.getAttribute("src") || "";
        if (isGmgnLaunchpadLogoSrc(src)) return;
        const m = src.match(/\/quotes\/([^./?#]+)/i);
        if (m) pushSym(symbolFromGmgnQuotesStem(m[1]));
      });
    taxBasketDomCache.set(card, { tok, at: now, syms });
    return syms;
  }

  /** @deprecated use resolveQuoteSymbol — kept name for any leftover refs */
  function extractQuoteSymbol(card, entry) {
    return resolveQuoteSymbol(card, entry || null);
  }

  function normalizeDisplayPrefs(raw) {
    const out = { ...DEFAULT_DISPLAY_PREFS };
    if (raw && typeof raw === "object") {
      for (const key of Object.keys(DEFAULT_DISPLAY_PREFS)) {
        if (typeof raw[key] === "boolean") out[key] = raw[key];
      }
    }
    return out;
  }

  function normalizeBadgeTheme(raw) {
    return raw === "light" ? "light" : DEFAULT_BADGE_THEME;
  }

  function hydrateDisplayPrefs() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get([DISPLAY_PREFS_KEY, UI_LANG_KEY], (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        displayPrefs = normalizeDisplayPrefs(items?.[DISPLAY_PREFS_KEY]);
        uiLang = items?.[UI_LANG_KEY] === "en" ? "en" : "zh";
        rerenderAllBadges();
      });
    } catch {
      // Extension reloaded mid-flight.
    }
  }

  function hydrateUiLang() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get([UI_LANG_KEY], (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        const next = items?.[UI_LANG_KEY] === "en" ? "en" : "zh";
        if (next === uiLang) return;
        uiLang = next;
        if (feeTooltipAnchor) showFeeTooltip(feeTooltipAnchor);
      });
    } catch {
      // ignore
    }
  }

  function normalizeEvmAllowAddress(raw) {
    const s = String(raw || "").trim().toLowerCase();
    const m = s.match(/0x[a-f0-9]{40}/);
    if (m) return m[0];
    const hex = s.replace(/^0x/, "").replace(/[^a-f0-9]/g, "");
    if (hex.length === 40) return `0x${hex}`;
    return "";
  }

  function taxRecvAllowSig(prefs) {
    const list = (prefs && prefs.allow) || [];
    return list
      .filter((r) => r && r.enabled !== false && r.address)
      .map((r) => r.address)
      .sort()
      .join(",");
  }

  function normalizeTaxRecvHidePrefs(raw) {
    const out = { enabled: false, thresholdPct: 100, allow: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const thr = Number(raw.thresholdPct);
    if (Number.isFinite(thr)) {
      out.thresholdPct = Math.max(0, Math.min(100, Math.round(thr)));
    }
    const list = Array.isArray(raw.allow) ? raw.allow : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.allow.length < TAX_RECV_ALLOW_MAX; i += 1) {
      const row = list[i];
      const address = normalizeEvmAllowAddress(row && (row.address || row.addr || row));
      if (!address || seen.has(address)) continue;
      seen.add(address);
      out.allow.push({
        id: row && row.id ? String(row.id) : `a${out.allow.length}`,
        address,
        enabled: !row || row.enabled !== false
      });
    }
    return out;
  }

  /** 列表过滤是否开启（资金接收 / 自定义尾号 / 金库），仅 BSC 写 disableShareWorker */
  function isListFilterActive() {
    const recvOn = taxRecvHidePrefs && taxRecvHidePrefs.enabled === true;
    const suffixOn =
      suffixHidePrefs &&
      suffixHidePrefs.enabled === true &&
      (suffixHidePrefs.rules || []).some((r) => r && r.enabled !== false && r.suffix);
    const vaultOn = vaultHidePrefs && vaultHidePrefs.enabled === true;
    return Boolean(recvOn || suffixOn || vaultOn);
  }

  function syncGmgnShareWorkerForFilters() {
    try {
      const ownKey = "flapFeeInfo.ownedDisableShareWorker";
      if (isListFilterActive() && isAllowedScanChain()) {
        localStorage.setItem("disableShareWorker", "true");
        localStorage.setItem(ownKey, "1");
      } else if (localStorage.getItem(ownKey) === "1") {
        localStorage.removeItem("disableShareWorker");
        localStorage.removeItem(ownKey);
      }
    } catch (_sw) {
      // ignore
    }
  }

  function pushTaxRecvPrefsToPage(extra) {
    const prefs = {
      enabled: taxRecvHidePrefs.enabled === true,
      thresholdPct: taxRecvHidePrefs.thresholdPct,
      allow: taxRecvHidePrefs.allow || []
    };
    const payload = JSON.stringify(prefs);
    try {
      document.documentElement?.setAttribute("data-flap-tax-recv", payload);
    } catch (_attr) {
      // ignore
    }
    // 同源 localStorage：MAIN page-hook document_start 可同步读取，避免 SharedWorker 抢跑
    try {
      localStorage.setItem(TAX_RECV_HIDE_KEY, payload);
    } catch (_ls) {
      // ignore
    }
    syncGmgnShareWorkerForFilters();
    try {
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "tax-recv-prefs",
          prefs,
          refresh: extra && extra.refresh === true
        },
        "*"
      );
    } catch (_err) {
      // ignore
    }
  }

  /**
   * List pages use virtual lists / rank tables.
   * GMGN：改过滤条件后整页 reload（SW 须在 document_start 看到 disableShareWorker）。
   * Debot：MAIN-world JSON filter + 局部重放 ranks。
   */
  function isTaxRecvListReflowPage() {
    try {
      const path = String(location.pathname || "");
      if (isGmgnHost()) {
        // home / meme trenches — not token K-line only
        if (/\/token\//i.test(path)) return false;
        return true;
      }
      if (isDebotHost()) {
        if (/\/token/i.test(path)) return false;
        return path.includes("/meme") || path === "/" || path.includes("meme");
      }
    } catch (_err) {
      // ignore
    }
    return false;
  }

  function clearAllTaxRecvDomHide() {
    try {
      document.querySelectorAll(`[${TAX_RECV_HIDE_ATTR}="1"]`).forEach((el) => {
        if (el instanceof HTMLElement) setCardTaxRecvHidden(el, false);
      });
      document.querySelectorAll(`.${TAX_RECV_HIDE_CLASS}`).forEach((el) => {
        if (el instanceof HTMLElement) setCardTaxRecvHidden(el, false);
      });
    } catch (_err) {
      // ignore
    }
  }

  function buildListFilterSig(reason) {
    const tr = taxRecvHidePrefs || {};
    const suf = suffixHidePrefs || {};
    const vault = vaultHidePrefs || {};
    const rules = (suf.rules || [])
      .map((r) => `${r.suffix || ""}:${r.enabled !== false ? 1 : 0}`)
      .join(",");
    return [
      tr.enabled ? 1 : 0,
      tr.thresholdPct ?? 0,
      suf.enabled ? 1 : 0,
      rules,
      vault.enabled ? 1 : 0,
      vault.hideTaxVault ? 1 : 0,
      vault.hideStockVault ? 1 : 0,
      reason || ""
    ].join("|");
  }

  /**
   * 推送 prefs 并请求 page-hook 重放 new_creation HTTP（GMGN trenches_rank / Debot ranks）。
   */
  function scheduleListFilterPartialRefresh(reason) {
    if (!isTaxRecvListReflowPage()) return;
    try {
      const sig = buildListFilterSig(reason);
      const key = "flapFeeInfo.listFilterRefresh.v1";
      const prev = sessionStorage.getItem(key) || "";
      if (prev === sig && reason !== "force") return;
      sessionStorage.setItem(key, sig);
    } catch (_ss) {
      // ignore storage — still refresh once
    }
    try {
      pushTaxRecvPrefsToPage({ refresh: true });
      pushSuffixHidePrefsToPage();
      pushVaultHidePrefsToPage();
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "list-filter-refresh",
          reason: reason || ""
        },
        "*"
      );
    } catch (_err) {
      // ignore
    }
    scheduleTaxRecvHideApply(80);
  }

  /**
   * GMGN / Debot 战壕：prefs 已写入 LS 后整页刷新。
   * 懒挂载钩子拦不到已有 SharedWorker；Debot 重放 fetch 进不了 React 状态。
   */
  function scheduleGmgnListFilterReload(reason) {
    if ((!isGmgnHost() && !isDebotHost()) || !isTaxRecvListReflowPage()) return false;
    try {
      const sig = buildListFilterSig("gmgn-reload");
      const key = "flapFeeInfo.listFilterReload.v1";
      const prev = sessionStorage.getItem(key) || "";
      if (prev === sig && reason !== "force") return true;
      sessionStorage.setItem(key, sig);
    } catch (_ss) {
      // ignore — still reload once
    }
    if (gmgnFilterReloadTimer) {
      window.clearTimeout(gmgnFilterReloadTimer);
      gmgnFilterReloadTimer = 0;
    }
    gmgnFilterReloadTimer = window.setTimeout(() => {
      gmgnFilterReloadTimer = 0;
      try {
        if (typeof isExtensionContextValid === "function" && !isExtensionContextValid()) {
          return;
        }
        location.reload();
      } catch (_e) {
        // ignore
      }
    }, 150);
    return true;
  }

  /**
   * After enable/threshold/suffix/vault change.
   * GMGN / Debot 战壕整页 reload，让首包 HTTP 带过滤。
   */
  function scheduleTaxRecvListReflow(reason) {
    if (!isTaxRecvListReflowPage()) return;
    const knownReason =
      reason === "force" ||
      reason === "prefs-off" ||
      reason === "prefs-change" ||
      reason === "suffix-hide-change" ||
      reason === "vault-hide-change";
    if (!knownReason) return;
    if (scheduleGmgnListFilterReload(reason)) return;
    scheduleListFilterPartialRefresh(reason);
  }

  function normalizeLicenseDeviceId(stored) {
    const id = String(stored?.id || stored || "").trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return id.toLowerCase();
    }
    return "";
  }

  function hydrateTaxRecvHidePrefs() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get(
        [TAX_RECV_HIDE_KEY, SUFFIX_HIDE_KEY, VAULT_HIDE_KEY, SEARCH_HIDE_KEY, LICENSE_KEY, DEVICE_ID_KEY],
        (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        taxRecvHidePrefs = normalizeTaxRecvHidePrefs(items?.[TAX_RECV_HIDE_KEY]);
        suffixHidePrefs = normalizeSuffixHidePrefs(items?.[SUFFIX_HIDE_KEY]);
        vaultHidePrefs = normalizeVaultHidePrefs(items?.[VAULT_HIDE_KEY]);
        searchHidePrefs = normalizeSearchHidePrefs(items?.[SEARCH_HIDE_KEY]);
        const lic = items?.[LICENSE_KEY];
        licenseAccessKey = String(lic?.key || "").trim();
        let devId = normalizeLicenseDeviceId(items?.[DEVICE_ID_KEY]);
        if (!devId && typeof crypto !== "undefined" && crypto.randomUUID) {
          devId = crypto.randomUUID().toLowerCase();
          chrome.storage.local.set({ [DEVICE_ID_KEY]: { id: devId } });
        }
        licenseDeviceId = devId;
        void refreshLicenseAccessState("hydrate");
        pushTaxRecvPrefsToPage();
        pushSuffixHidePrefsToPage();
        pushVaultHidePrefsToPage();
        // Re-push after page-hook may finish loading
        window.setTimeout(() => {
          pushTaxRecvPrefsToPage();
          pushSuffixHidePrefsToPage();
          pushVaultHidePrefsToPage();
        }, 200);
        window.setTimeout(() => {
          pushTaxRecvPrefsToPage();
          pushSuffixHidePrefsToPage();
          pushVaultHidePrefsToPage();
        }, 1000);
        scheduleTaxRecvHideApply(0);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Only trench / meme list cards — never token header, search overlay, top ticker,
   * Debot 钱包追踪 left rail, or absolute virtual-list rows (DOM hide → holes).
   * GMGN hide is JSON-only (see applyTaxRecvHideNow); this scope is for Debot fallback.
   */
  function isTaxRecvHideScopeCard(card) {
    if (!(card instanceof HTMLElement) || !document.contains(card)) return false;
    // Search / modal / dialog overlays
    try {
      if (
        card.closest?.(
          '[role="dialog"], [role="presentation"], .MuiModal-root, .MuiDialog-root, [data-state="open"][class*="dialog" i]'
        )
      ) {
        return false;
      }
    } catch (_err) {
      // ignore
    }
    // Our overlay badge mounts
    try {
      if (
        card.closest?.(
          '[data-flap-mount*="overlay"], [data-flap-mount="gmgn-overlay-volume"]'
        )
      ) {
        return false;
      }
    } catch (_err2) {
      // ignore
    }
    // Token detail header / K-line top tax area
    try {
      if (typeof isGmgnTokenPage === "function" && isGmgnTokenPage()) {
        if (typeof isGmgnTokenHeaderCard === "function" && isGmgnTokenHeaderCard(card)) {
          return false;
        }
        if (
          card.querySelector?.('[data-fee-header="1"]') &&
          !card.closest?.(GMGN_TRENCH_ROOT_SELECTOR)
        ) {
          return false;
        }
      }
      if (typeof isDebotTokenPage === "function" && isDebotTokenPage()) {
        if (
          typeof isDebotTokenHeaderZoneCard === "function" &&
          isDebotTokenHeaderZoneCard(card)
        ) {
          return false;
        }
      }
    } catch (_err3) {
      // ignore
    }
    // Top watchlist / ticker chips
    try {
      const r = card.getBoundingClientRect();
      if (r.top >= 0 && r.top < 88 && r.height > 0 && r.height < 44 && r.width < 220) {
        return false;
      }
    } catch (_err4) {
      // ignore
    }

    // Absolute / fixed rows: never DOM-hide (virtual list holes)
    try {
      const pos = window.getComputedStyle(card).position;
      if (pos === "absolute" || pos === "fixed") return false;
    } catch (_errPos) {
      // ignore
    }

    if (isGmgnHost()) {
      // GMGN uses JSON filter only — DOM scope unused for hide, but keep trench check
      try {
        if (card.closest?.(GMGN_TRENCH_ROOT_SELECTOR)) return true;
        if (card.closest?.("div.flex.flex-col.flex-1.overflow-hidden")) return true;
        if (card.closest?.("div.flex.flex-col.flex-1.border-line-100")) return true;
      } catch (_err5) {
        // ignore
      }
      return false;
    }

    if (isDebotHost()) {
      // Never touch 钱包追踪 / side rails
      if (isDebotSideRailCard(card)) return false;
      try {
        const r = card.getBoundingClientRect();
        // Left rail zone (js-mcp: 钱包追踪 col left=0 w≈291)
        if (r.left < 260) return false;
        // Main meme cards are ~320–360 wide
        if (r.width > 0 && r.width < 240) return false;
      } catch (_errGeom) {
        // ignore
      }
      try {
        const path = String(location.pathname || "");
        if (path.includes("/token")) {
          return false;
        }
        if (path.includes("/meme") || path === "/" || path.includes("meme")) {
          return true;
        }
      } catch (_err6) {
        // ignore
      }
      return false;
    }
    return false;
  }

  /**
   * Debot 三栏：仅「新创建」可 DOM 隐藏。
   * 优先读列头文案；几何兜底用主区最左列（排除侧栏 left&lt;260）。
   */
  function isDebotNewCreationColumnCard(card) {
    if (!(card instanceof HTMLElement) || !isDebotHost()) return false;
    try {
      const cr0 = card.getBoundingClientRect();
      if (
        cr0.left >= 250 &&
        cr0.left < 920 &&
        cr0.width >= 240 &&
        cr0.height >= 70 &&
        cr0.height <= 220
      ) {
        return true;
      }
    } catch (_band) {
      // fall through
    }
    try {
      let el = card;
      for (let d = 0; d < 14 && el; d += 1) {
        if (!(el instanceof HTMLElement)) break;
        let r = null;
        try {
          r = el.getBoundingClientRect();
        } catch (_e) {
          r = null;
        }
        // 列容器：高面板（js-mcp：Debot 列宽约 554–667）。
        // 虚拟列表 inner 可高达 12900px，innerText 开头是代币名不是列头。
        if (
          r &&
          r.height > 280 &&
          r.height < 1400 &&
          r.width > 260 &&
          r.width < 780
        ) {
          const head = String(el.innerText || "")
            .replace(/\s+/g, " ")
            .slice(0, 48);
          if (/新创建/.test(head)) return true;
          if (/即将打满|已迁移|已开盘/.test(head)) return false;
        }
        el = el.parentElement;
      }
      // 几何兜底：主区三列最左（侧栏已在 isTaxRecvHideScopeCard 排除 left&lt;260）
      const cr = card.getBoundingClientRect();
      if (cr.width < 2) return false;
      const mainLeft = 260;
      const mainW = Math.max(300, window.innerWidth - mainLeft - 80);
      const colW = mainW / 3;
      // 落在第一列中心带
      if (cr.left >= mainLeft - 20 && cr.left < mainLeft + colW - 40) return true;
    } catch (_err) {
      // ignore
    }
    return false;
  }

  function debotListHideRoot(card) {
    if (!(card instanceof HTMLElement)) return card;
    const row = card.closest?.('a[href*="/token/"]');
    if (row instanceof HTMLElement && isDebotTrenchRowCard(row)) return row;
    try {
      const r = card.getBoundingClientRect();
      if (
        r.height >= DEBOT_TRENCH_ROW_MIN_H &&
        r.height <= DEBOT_TRENCH_ROW_MAX_H &&
        r.width >= DEBOT_TRENCH_ROW_MIN_W
      ) {
        return card;
      }
    } catch (_row) {
      // ignore
    }
    // 禁止爬到列 viewport（absolute 常是 666×1073，藏了会整列消失）
    return card;
  }

  function shouldHideVaultCard(token, card) {
    if (!vaultHidePrefs || vaultHidePrefs.enabled !== true) return false;
    const vk = vaultKindFromFeeOrBadge(token, card);
    if (vk === "stock") return vaultHidePrefs.hideStockVault === true;
    if (vk === "tax") return vaultHidePrefs.hideTaxVault === true;
    return false;
  }

  function normalizeSearchHidePrefs(raw) {
    return { enabled: raw && raw.enabled === true };
  }

  function isSearchHideEnabled() {
    return Boolean(searchHidePrefs && searchHidePrefs.enabled === true && isAllowedScanChain());
  }

  function vaultKindFromFeeOrBadge(token, card) {
    let text = "";
    try {
      const badge =
        (card && card.querySelector?.(".gmgn-fee-mode-icon")) ||
        (card && card.matches?.(".gmgn-fee-mode-icon") ? card : null);
      text = badge ? String(badge.textContent || "") : "";
    } catch (_b) {
      text = "";
    }
    if (text.includes("📈")) return "stock";
    if (text.includes("🎁")) return "tax";
    const fee =
      modeCache.get(token) ||
      (typeof isPersistentCacheHit === "function" && isPersistentCacheHit(token)
        ? persistentCache.get(token)
        : null);
    if (fee && typeof fee === "object") {
      if (fee.is_stocks_vault === true) return "stock";
      if (fee.is_vault === true) return "tax";
    }
    return null;
  }

  function chefPctFromBadge(card) {
    let text = "";
    try {
      const badge = card && card.querySelector?.(".gmgn-fee-mode-icon");
      text = badge ? String(badge.textContent || "") : "";
    } catch (_b) {
      text = "";
    }
    if (!text.includes("👨‍🍳")) return null;
    const m = text.match(/👨‍🍳\s*(\d+)\s*%/);
    if (m) return Number(m[1]);
    return 100;
  }

  function shouldHideSearchOverlayToken(token, card) {
    if (!isSearchHideEnabled()) return false;
    const addr = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(addr)) return false;
    const vk = vaultKindFromFeeOrBadge(addr, card);
    if (vaultHidePrefs && vaultHidePrefs.enabled === true && vk) {
      if (vk === "stock" && vaultHidePrefs.hideStockVault === true) return true;
      if (vk === "tax" && vaultHidePrefs.hideTaxVault === true) return true;
    }
    if (taxRecvHidePrefs && taxRecvHidePrefs.enabled === true) {
      const info = resolveTaxRecvInfo(addr);
      if (info && shouldHideTaxRecv(info)) return true;
      if ((!info || !(Number(info.recvPct) > 0)) && vk == null) {
        const pct = chefPctFromBadge(card);
        if (pct != null) {
          return shouldHideTaxRecv({ recvPct: pct, isVault: false, source: "badge" });
        }
      }
    }
    return false;
  }

  function setCardSearchHidden(card, hide) {
    if (!(card instanceof HTMLElement)) return;
    const on = hide === true;
    const was = card.getAttribute(SEARCH_HIDE_ATTR) === "1";
    if (on === was) {
      if (on && card.style.display !== "none") card.style.display = "none";
      return;
    }
    if (on) {
      card.setAttribute(SEARCH_HIDE_ATTR, "1");
      card.style.display = "none";
      return;
    }
    card.removeAttribute(SEARCH_HIDE_ATTR);
    if (card.style.display === "none") card.style.display = "";
  }

  function collectSearchOverlayCards() {
    const out = [];
    const seen = new Set();
    const add = (card, token) => {
      if (!(card instanceof HTMLElement) || seen.has(card)) return;
      if (typeof isBadgeMountForbidden === "function" && isBadgeMountForbidden(card)) return;
      const addr = String(token || "").toLowerCase();
      seen.add(card);
      out.push({ card, token: addr });
    };
    try {
      document.querySelectorAll("[data-flap-overlay-card='1']").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const token =
          el.dataset[CARD_MARK] ||
          el.getAttribute(CARD_DATA) ||
          (typeof normalizeToken === "function"
            ? normalizeToken(el.getAttribute("href") || "")
            : "");
        add(el, token);
      });
    } catch (_ov) {
      // ignore
    }
    try {
      const list =
        document.querySelector('[data-sentry-source-file="SearchCoinList.tsx"]') ||
        document.querySelector('[data-sentry-source-file="SearchModalDetail.tsx"]');
      if (list) {
        list.querySelectorAll("[href*='/token/0x'], [href*='/bsc/token/0x']").forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const card =
            (typeof findGmgnOverlayCard === "function" && findGmgnOverlayCard(el)) || el;
          const token =
            typeof normalizeToken === "function"
              ? normalizeToken(el.getAttribute("href") || "")
              : "";
          add(card, token);
        });
      }
    } catch (_list) {
      // ignore
    }
    try {
      if (typeof isDebotHost === "function" && isDebotHost()) {
        document
          .querySelectorAll(
            '.MuiDialog-root [href*="/token/"], .MuiModal-root [href*="/token/"], [role="dialog"] [href*="/token/"]'
          )
          .forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            const token =
              typeof normalizeToken === "function"
                ? normalizeToken(el.getAttribute("href") || "")
                : "";
            const card =
              el.closest?.(`[${CARD_DATA}]`) ||
              el.closest?.('[href*="/token/"]') ||
              el;
            add(card, token);
          });
      }
    } catch (_debot) {
      // ignore
    }
    try {
      document.querySelectorAll(`[${SEARCH_HIDE_ATTR}="1"]`).forEach((el) => {
        if (!(el instanceof HTMLElement) || seen.has(el)) return;
        const token =
          el.dataset[CARD_MARK] ||
          (typeof normalizeToken === "function"
            ? normalizeToken(el.getAttribute("href") || "")
            : "");
        add(el, token);
      });
    } catch (_hid) {
      // ignore
    }
    return out;
  }

  function isSearchOverlayUiOpen() {
    if (lastOverlayOpen) return true;
    if (typeof isOverlayFast === "function" && isOverlayFast()) return true;
    return false;
  }

  function clearSearchOverlayHidesIfAny() {
    if (!searchOverlayDidHide) return;
    try {
      document.querySelectorAll(`[${SEARCH_HIDE_ATTR}="1"]`).forEach((el) => {
        if (el instanceof HTMLElement) setCardSearchHidden(el, false);
      });
    } catch (_clr) {
      // ignore
    }
    searchOverlayDidHide = false;
  }

  function applySearchOverlayHideNow() {
    if (!isSearchOverlayUiOpen()) {
      clearSearchOverlayHidesIfAny();
      return;
    }
    const want =
      isSearchHideEnabled() &&
      Boolean(
        (taxRecvHidePrefs && taxRecvHidePrefs.enabled === true) ||
          (vaultHidePrefs && vaultHidePrefs.enabled === true)
      );
    if (!want) {
      clearSearchOverlayHidesIfAny();
      return;
    }
    const keep = new Set();
    let hid = false;
    for (const row of collectSearchOverlayCards()) {
      keep.add(row.card);
      const hide = TARGET_TOKEN_RE.test(row.token)
        ? shouldHideSearchOverlayToken(row.token, row.card)
        : false;
      setCardSearchHidden(row.card, hide);
      if (hide) hid = true;
    }
    try {
      document.querySelectorAll(`[${SEARCH_HIDE_ATTR}="1"]`).forEach((el) => {
        if (el instanceof HTMLElement && !keep.has(el)) setCardSearchHidden(el, false);
      });
    } catch (_stale) {
      // ignore
    }
    if (hid) searchOverlayDidHide = true;
  }

  function scheduleSearchOverlayHideApply(delayMs) {
    if (!isSearchOverlayUiOpen()) {
      if (searchOverlayHideTimer) {
        window.clearTimeout(searchOverlayHideTimer);
        searchOverlayHideTimer = 0;
      }
      clearSearchOverlayHidesIfAny();
      return;
    }
    const d = Math.max(0, Number(delayMs) || 0);
    if (searchOverlayHideTimer) {
      window.clearTimeout(searchOverlayHideTimer);
      searchOverlayHideTimer = 0;
    }
    searchOverlayHideTimer = window.setTimeout(() => {
      searchOverlayHideTimer = 0;
      try {
        applySearchOverlayHideNow();
      } catch (_err) {
        // ignore
      }
    }, d);
  }

  function shouldHideTaxRecv(entry) {
    if (!taxRecvHidePrefs || taxRecvHidePrefs.enabled !== true) return false;
    if (!entry || typeof entry !== "object") return false;
    // 金库始终显示
    if (entry.isVault === true) return false;
    const pct = Number(entry.recvPct);
    if (!Number.isFinite(pct) || pct <= 0) return false;
    const thr = Number(taxRecvHidePrefs.thresholdPct);
    const threshold = Number.isFinite(thr) ? thr : DEFAULT_TAX_RECV_HIDE.thresholdPct;
    if (threshold <= 0) return true;
    return pct + 1e-9 >= threshold;
  }

  function mergeTaxRecvEntries(entries) {
    if (!Array.isArray(entries) || !entries.length) return false;
    let changed = false;
    for (const row of entries) {
      if (!row || typeof row !== "object") continue;
      const addr = String(row.address || "")
        .trim()
        .toLowerCase();
      if (!TARGET_TOKEN_RE.test(addr)) continue;
      const recvPct = Number(row.recvPct);
      if (!Number.isFinite(recvPct)) continue;
      const next = {
        recvPct,
        isVault: row.isVault === true,
        source: typeof row.source === "string" ? row.source : ""
      };
      const prev = taxRecvMap.get(addr);
      if (!prev) {
        taxRecvMap.set(addr, next);
        changed = true;
        continue;
      }
      // Host list (gmgn/debot) wins over fee; vault flag latches true; recvPct takes max.
      const hostNext = next.source === "gmgn" || next.source === "debot";
      const hostPrev = prev.source === "gmgn" || prev.source === "debot";
      const merged = {
        recvPct: Math.max(prev.recvPct, next.recvPct),
        isVault: Boolean(prev.isVault || next.isVault),
        source: hostNext ? next.source : hostPrev ? prev.source : next.source || prev.source
      };
      if (
        merged.recvPct !== prev.recvPct ||
        merged.isVault !== prev.isVault ||
        merged.source !== prev.source
      ) {
        taxRecvMap.set(addr, merged);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Second data path: our /modes fee result already knows market_bps + is_vault.
   * 👨‍🍳 badges mean non-vault marketing share — use this when list hook was late.
   */
  function ingestFeeEntryForTaxRecv(token, entry) {
    if (!token || !entry) return false;
    const addr = String(token).toLowerCase();
    if (!TARGET_TOKEN_RE.test(addr)) return false;
    if (entry.is_vault) return false;
    // Four ffff 宿主 marketing = 税收钱包，不是 👨‍🍳 资金接收方
    if (isFourTaxToken(addr) && entry.source_host) return false;
    const marketBps = Number(entry.market_bps) || 0;
    if (marketBps <= 0 && !entry.is_vault) {
      // no marketing share — do not invent hide signal
      return false;
    }
    const recvPct = marketBps / 100; // 10000 bps → 100%
    return mergeTaxRecvEntries([
      {
        address: addr,
        recvPct,
        isVault: Boolean(entry.is_vault),
        source: "fee"
      }
    ]);
  }

  /**
   * Climb from a token leaf toward a list card root (bounded).
   * Prefer existing fee card marks when present.
   */
  function climbTaxRecvCardRoot(el) {
    if (!(el instanceof HTMLElement)) return null;
    let cur = el;
    for (let i = 0; i < 14 && cur && cur !== document.body; i++) {
      if (cur.dataset?.[CARD_MARK] || cur.getAttribute?.(CARD_DATA)) return cur;
      cur = cur.parentElement;
    }
    cur = el;
    for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
      const tag = (cur.tagName || "").toLowerCase();
      if (tag === "tr" || tag === "li" || tag === "article") return cur;
      try {
        const r = cur.getBoundingClientRect();
        if (r.height >= 48 && r.height <= 420 && r.width >= 160) {
          const cls = String(cur.className || "");
          if (
            cur.getAttribute("data-index") != null ||
            /card|row|item|token|mui/i.test(cls)
          ) {
            return cur;
          }
        }
      } catch (_err) {
        // ignore
      }
      cur = cur.parentElement;
    }
    return el.closest?.("div") || el.parentElement;
  }

  function setCardTaxRecvHidden(card, hide) {
    if (!(card instanceof HTMLElement)) return;
    const on = hide === true;
    const was = card.getAttribute(TAX_RECV_HIDE_ATTR) === "1";
    // GMGN 虚拟列表：只用 attr + reflow，避免 display:none 黑洞
    if (isGmgnHost()) {
      if (on === was) return;
      if (on) {
        card.setAttribute(TAX_RECV_HIDE_ATTR, "1");
        card.classList.remove(TAX_RECV_HIDE_CLASS);
      } else {
        card.removeAttribute(TAX_RECV_HIDE_ATTR);
        card.classList.remove(TAX_RECV_HIDE_CLASS);
        try {
          card.style.transform = "";
          card.style.visibility = "";
          card.style.height = "";
          card.style.minHeight = "";
          card.style.overflow = "";
          card.style.pointerEvents = "";
        } catch (_e) {
          // ignore
        }
      }
      return;
    }
    if (
      on === was &&
      (on
        ? card.classList.contains(TAX_RECV_HIDE_CLASS)
        : !card.classList.contains(TAX_RECV_HIDE_CLASS))
    ) {
      return;
    }
    if (on) {
      card.classList.add(TAX_RECV_HIDE_CLASS);
      card.setAttribute(TAX_RECV_HIDE_ATTR, "1");
    } else {
      card.classList.remove(TAX_RECV_HIDE_CLASS);
      card.removeAttribute(TAX_RECV_HIDE_ATTR);
    }
  }

  function resolveTaxRecvInfo(token) {
    const addr = String(token || "").toLowerCase();
    if (!addr) return null;
    const fromMap = taxRecvMap.get(addr);
    if (fromMap) return fromMap;
    const fee =
      modeCache.get(addr) ||
      (isPersistentCacheHit(addr) ? persistentCache.get(addr) : null);
    if (!fee) return null;
    const marketBps = Number(fee.market_bps) || 0;
    if (marketBps <= 0 && !fee.is_vault) return null;
    return {
      recvPct: marketBps / 100,
      isVault: Boolean(fee.is_vault),
      source: "fee"
    };
  }

  /**
   * GMGN 虚拟列表：按 token 隐藏后重排 translateY，避免 display:none 黑洞。
   * page-hook 负责 HTTP/SharedWorker 数据层；此处兜底 UI（新创建 WS 漏网）。
   */
  function reflowGmgnTaxRecvColumns() {
    if (!isGmgnHost()) return;
    const containers = [];
    try {
      document.querySelectorAll("div").forEach((d) => {
        if (!(d instanceof HTMLElement)) return;
        const kids = d.children;
        if (!kids || kids.length < 2) return;
        let abs = 0;
        for (let i = 0; i < kids.length && i < 20; i++) {
          try {
            if (getComputedStyle(kids[i]).position === "absolute") abs += 1;
          } catch (_e) {
            // ignore
          }
        }
        if (abs < 2) return;
        const r = d.getBoundingClientRect();
        if (r.height < 150 || r.width < 200) return;
        containers.push(d);
      });
    } catch (_err) {
      return;
    }
    const seen = new Set();
    for (const container of containers) {
      if (seen.has(container)) continue;
      seen.add(container);
      const kids = [];
      for (let i = 0; i < container.children.length; i++) {
        const el = container.children[i];
        if (!(el instanceof HTMLElement)) continue;
        try {
          if (getComputedStyle(el).position !== "absolute") continue;
        } catch (_e2) {
          continue;
        }
        kids.push(el);
      }
      if (kids.length < 2) continue;
      // 测行高
      let rowH = 124;
      try {
        const vis = kids.find((k) => k.getAttribute(TAX_RECV_HIDE_ATTR) !== "1");
        if (vis) {
          const hr = vis.getBoundingClientRect().height;
          if (hr >= 80 && hr <= 200) rowH = Math.round(hr);
        }
      } catch (_e3) {
        // ignore
      }
      let write = 0;
      for (const el of kids) {
        const hidden = el.getAttribute(TAX_RECV_HIDE_ATTR) === "1";
        if (hidden) {
          el.style.visibility = "hidden";
          el.style.pointerEvents = "none";
          el.style.height = "0px";
          el.style.minHeight = "0px";
          el.style.overflow = "hidden";
          el.style.transform = "translateY(-9999px)";
          continue;
        }
        el.style.visibility = "";
        el.style.pointerEvents = "";
        el.style.height = "";
        el.style.minHeight = "";
        el.style.overflow = "";
        el.style.transform = `translateY(${write * rowH}px)`;
        write += 1;
      }
      try {
        container.style.height = `${Math.max(write * rowH, 0)}px`;
      } catch (_e4) {
        // ignore
      }
    }
  }

  /**
   * Apply hide/unhide.
   * Debot: DOM hide on non-absolute board cards only.
   * GMGN: **不做 DOM hide/reflow**（absolute 虚拟列表会跳动、徽章错位）。
   *        只靠 page-hook 在 HTTP + SharedWorker 数据层过滤（对齐 GMGN 原生「筛完再渲染」）。
   */
  function applyTaxRecvHideNow() {
    const recvOn = taxRecvHidePrefs && taxRecvHidePrefs.enabled === true;
    const suffixOn =
      suffixHidePrefs &&
      suffixHidePrefs.enabled === true &&
      isAllowedScanChain() &&
      (suffixHidePrefs.rules || []).some((r) => r && r.enabled !== false && r.suffix);
    const vaultOn = vaultHidePrefs && vaultHidePrefs.enabled === true;
    // Always clear when all disabled
    if (!recvOn && !suffixOn && !vaultOn) {
      clearAllTaxRecvDomHide();
      return;
    }

    // GMGN：禁止 UI 层动刀（会与 React 虚拟列表抢 transform → 跳动/徽章错位）
    // 资金接收 + 自定义尾号均由 page-hook 数据层过滤
    if (isGmgnHost()) {
      clearAllTaxRecvDomHide();
      return;
    }

    const seen = new WeakSet();

    const applyTokenCard = (card, token) => {
      if (!(card instanceof HTMLElement) || !token) return;
      if (seen.has(card)) return;
      seen.add(card);
      const hideEl = isDebotHost() ? debotListHideRoot(card) : card;
      if (!isTaxRecvHideScopeCard(card)) {
        setCardTaxRecvHidden(card, false);
        if (hideEl !== card) setCardTaxRecvHidden(hideEl, false);
        return;
      }
      // Debot：仅「新创建」栏 DOM 隐藏；即将打满/已迁移永不藏
      if (isDebotHost() && !isDebotNewCreationColumnCard(card)) {
        setCardTaxRecvHidden(card, false);
        if (hideEl !== card) setCardTaxRecvHidden(hideEl, false);
        return;
      }
      const info = resolveTaxRecvInfo(token);
      let hideRecv = info ? shouldHideTaxRecv(info) : false;
      if (!hideRecv && taxRecvHidePrefs && taxRecvHidePrefs.enabled === true) {
        const vk = vaultKindFromFeeOrBadge(token, card);
        if (vk == null) {
          const pct = chefPctFromBadge(card);
          if (pct != null) {
            hideRecv = shouldHideTaxRecv({
              recvPct: pct,
              isVault: false,
              source: "badge"
            });
          }
        }
      }
      const hideSuffix = shouldHideByCustomSuffix(token);
      const hideVault = shouldHideVaultCard(token, card);
      setCardTaxRecvHidden(hideEl, hideRecv || hideSuffix || hideVault);
    };

    let scopeRoots = [];
    try {
      if (isDebotHost()) {
        scopeRoots = [...document.querySelectorAll("main")].filter(Boolean);
      }
    } catch (_errScope) {
      scopeRoots = [];
    }
    if (!scopeRoots.length) scopeRoots = [document.body].filter(Boolean);

    const queryInScopes = (sel) => {
      const out = [];
      const seenEl = new Set();
      for (const root of scopeRoots) {
        if (!root || typeof root.querySelectorAll !== "function") continue;
        try {
          root.querySelectorAll(sel).forEach((el) => {
            if (seenEl.has(el)) return;
            seenEl.add(el);
            out.push(el);
          });
        } catch (_errQ) {
          // ignore
        }
      }
      return out;
    };

    queryInScopes(`[${CARD_DATA}]`).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const token = (
        card.dataset[CARD_MARK] ||
        card.getAttribute(CARD_DATA) ||
        ""
      ).toLowerCase();
      if (!token) return;
      applyTokenCard(card, token);
    });

    queryInScopes(`.gmgn-fee-mode-icon[data-fee-token]`).forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      const token = String(icon.dataset.feeToken || "").toLowerCase();
      if (!TARGET_TOKEN_RE.test(token)) return;
      const card =
        icon.closest?.(`[${CARD_DATA}]`) ||
        climbTaxRecvCardRoot(icon.parentElement || icon);
      applyTokenCard(card, token);
    });

    document.querySelectorAll(`[${TAX_RECV_HIDE_ATTR}="1"]`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (!isTaxRecvHideScopeCard(el)) setCardTaxRecvHidden(el, false);
    });
  }

  function scheduleTaxRecvHideApply(delayMs) {
    const d = Math.max(0, Number(delayMs) || 0);
    if (taxRecvHideApplyTimer) {
      window.clearTimeout(taxRecvHideApplyTimer);
      taxRecvHideApplyTimer = 0;
    }
    taxRecvHideApplyTimer = window.setTimeout(() => {
      taxRecvHideApplyTimer = 0;
      try {
        applyTaxRecvHideNow();
      } catch (_err) {
        // ignore
      }
      if (lastOverlayOpen || (typeof isOverlayFast === "function" && isOverlayFast())) {
        try {
          applySearchOverlayHideNow();
        } catch (_ov) {
          // ignore
        }
      }
    }, d);
  }

  function deriveHostFeeMode(raw) {
    const dividend_bps = Number(raw.dividend_bps) || 0;
    const market_bps = Number(raw.market_bps) || 0;
    const deflation_bps = Number(raw.deflation_bps) || 0;
    const lp_bps = Number(raw.lp_bps) || 0;
    const giggle_charity_bps = Number(raw.giggle_charity_bps) || 0;
    const binance_charity_bps = Number(raw.binance_charity_bps) || 0;
    const is_vault = Boolean(raw.is_vault);
    const segments = [];
    if (dividend_bps > 0) segments.push({ kind: "holder", bps: dividend_bps, pri: 0 });
    if (market_bps > 0) {
      segments.push({
        kind: is_vault ? "gift" : "creator",
        bps: market_bps,
        pri: is_vault ? 1 : 4
      });
    }
    if (giggle_charity_bps > 0) segments.push({ kind: "giggle", bps: giggle_charity_bps, pri: 2 });
    if (binance_charity_bps > 0) {
      segments.push({ kind: "binance", bps: binance_charity_bps, pri: 3 });
    }
    if (deflation_bps > 0) segments.push({ kind: "burn", bps: deflation_bps, pri: 5 });
    if (lp_bps > 0) segments.push({ kind: "lp", bps: lp_bps, pri: 6 });
    if (!segments.length) return { mode: "unknown", top_segment: "unknown" };
    segments.sort((a, b) => b.bps - a.bps || a.pri - b.pri);
    const top_segment = segments[0].kind;
    let mode = top_segment;
    if (segments.length > 1) mode = "hybrid";
    return { mode, top_segment };
  }

  function collectBasketAddrRows(entries) {
    const rows = [];
    const seen = new Set();
    const ingest = (entry) => {
      if (!entry || !Array.isArray(entry.basket_assets)) return;
      for (const b of entry.basket_assets) {
        const a = String(b?.address || "").toLowerCase();
        const s = String(b?.symbol || b?.name || "").trim();
        if (!/^0x[a-f0-9]{40}$/.test(a) || !s || seen.has(a)) continue;
        seen.add(a);
        rows.push({ address: a, symbol: s });
      }
    };
    if (!entries) return rows;
    if (Array.isArray(entries)) {
      for (const item of entries) {
        if (Array.isArray(item) && item[1]) ingest(item[1]);
        else ingest(item);
      }
    }
    return rows;
  }

  function broadcastBasketAddrCache(entries) {
    const rows = collectBasketAddrRows(entries);
    if (!rows.length) return;
    try {
      window.postMessage({ source: "flap-fee-info", type: "basket-addr-cache", rows }, "*");
    } catch (_bc) {
      // ignore
    }
  }

  function hostFeeQuoteBecameReal(prev, entry) {
    if (!prev || !entry) return false;
    if (forceVaultNativePoolQuote(entry) && !isRealPoolQuoteSymbol(entry.quote_symbol || "")) {
      return false;
    }
    const nextQ = formatPoolQuoteSymbol(entry.quote_symbol || "");
    const prevNative = quoteSymbolLooksNative(prev.quote_symbol);
    const nextNative = quoteSymbolLooksNative(entry.quote_symbol);
    if (prevNative && !nextNative && nextQ) return true;
    const prevTok = String(prev.quote_token || "").toLowerCase();
    const nextTok = String(entry.quote_token || "").toLowerCase();
    if (
      (!prevTok || prevTok === WBNB_ADDRESS) &&
      nextTok &&
      nextTok !== WBNB_ADDRESS &&
      nextTok !== prevTok &&
      nextTok !== "0x0000000000000000000000000000000000000000"
    ) {
      return true;
    }
    return false;
  }

  function hostFeeDividendBecameReal(prev, entry) {
    if (!prev || !entry) return false;
    const prevUnresolved = dividendSymbolLooksUnresolved(prev.dividend_symbol || "");
    const nextUnresolved = dividendSymbolLooksUnresolved(entry.dividend_symbol || "");
    return prevUnresolved && !nextUnresolved;
  }

  function hostFeeEntryShouldApply(prev, entry) {
    if (!prev) return true;
    if (hostFeeQuoteBecameReal(prev, entry)) return true;
    if (hostFeeDividendBecameReal(prev, entry)) return true;
    const prevDiv = compactBasketSymbol(prev.dividend_symbol || "");
    const nextDiv = compactBasketSymbol(entry.dividend_symbol || "");
    if (
      prevDiv &&
      nextDiv &&
      prevDiv !== nextDiv &&
      !dividendSymbolLooksUnresolved(entry.dividend_symbol)
    ) {
      return true;
    }
    if (prev.is_stocks_vault && !entry.is_stocks_vault && !entry.is_vault) return true;
    if (entry.is_stocks_vault && !prev.is_stocks_vault) {
      if (!basketLooksLikeNativeOnly(entry.basket_assets)) return true;
    }
    // leftover 💎/QQQB 写在纯金库卡上：fiber 金库必须覆盖（15min 采样 币安商城）
    if (entry.is_vault && !prev.is_vault) return true;
    if (
      entry.is_vault &&
      (Number(entry.dividend_bps) || 0) === 0 &&
      (Number(prev.dividend_bps) || 0) > 0
    ) {
      return true;
    }
    // leftover 💎 写在创作者卡上（15min_r2 Cat of Gnosis）
    if (
      entry.source_host &&
      !entry.is_vault &&
      (Number(entry.dividend_bps) || 0) === 0 &&
      (Number(entry.market_bps) || 0) > 0 &&
      ((Number(prev.dividend_bps) || 0) > 0 || prev.is_stocks_vault)
    ) {
      return true;
    }
    const pb = normalizeBasketAssets(prev.basket_assets).length;
    const nb = normalizeBasketAssets(entry.basket_assets).length;
    if (nb > pb) return true;
    if (
      dividendPayoutLooksNative(entry) &&
      !dividendPayoutLooksNative(prev) &&
      (Number(entry.dividend_bps) || 0) > 0 &&
      entry.source_host
    ) {
      return true;
    }
    if (
      nb < pb &&
      entry.source_host &&
      (prev.is_stocks_vault || prev.is_vault)
    ) {
      const nextIsTaxVault =
        entry.is_vault && !entry.is_stocks_vault && nb === 0;
      if (nextIsTaxVault) return true;
      return false;
    }
    if (
      entry.source_host &&
      !prev.source_host &&
      prev.__needsChain !== true &&
      basketSymbolsReady(prev.basket_assets) &&
      basketSymbolsReady(entry.basket_assets) &&
      pb > 0 &&
      pb === nb
    ) {
      const prevSyms = basketDisplaySymbols(prev.basket_assets).sort().join(",");
      const nextSyms = basketDisplaySymbols(entry.basket_assets).sort().join(",");
      if (prevSyms && nextSyms && prevSyms !== nextSyms) return false;
    }
    if (entry.source_host && !prev.source_host) {
      if (nb > pb) return true;
      if (prev.label && prev.__needsChain !== true) return false;
      return true;
    }
    if (entry.__needsChain !== true && prev.__needsChain === true) return true;
    if (
      entry.source_host &&
      basketSymbolsReady(entry.basket_assets) &&
      !basketSymbolsReady(prev.basket_assets)
    ) {
      return true;
    }
    if (
      !entry.source_host &&
      prev.source_host &&
      entry.dividend_symbol &&
      prev.dividend_symbol &&
      compactDisplaySymbol(entry.dividend_symbol) !==
        compactDisplaySymbol(prev.dividend_symbol)
    ) {
      return true;
    }
    if (prev.source_host && prev.__needsChain !== true && !entry.source_host) return false;
    return !prev.source_host || prev.__needsChain === true;
  }

  function applyHostFeeQuotePatches(patches) {
    if (!isBadgeAccessAllowed()) return;
    if (!Array.isArray(patches) || !patches.length) return;
    for (const raw of patches) {
      if (!raw || typeof raw !== "object") continue;
      const token = String(raw.address || "")
        .trim()
        .toLowerCase();
      if (!TARGET_TOKEN_RE.test(token)) continue;
      const prev = resolveEntry(token);
      if (!prev) continue;
      if (forceVaultNativePoolQuote(prev) && !isRealPoolQuoteSymbol(raw.quote_symbol || "")) {
        continue;
      }
      const fromAddr = catalogTitleForQuoteAddr(raw.quote_token || "");
      const nextRaw = fromAddr || String(raw.quote_symbol || "").trim();
      const nextQ = formatPoolQuoteSymbol(nextRaw);
      if (!nextQ || quoteSymbolLooksNative(nextQ)) continue;
      const curQ = formatPoolQuoteSymbol(prev.quote_symbol || "");
      const nextTok = String(raw.quote_token || "").toLowerCase();
      if (curQ === nextQ && (!nextTok || nextTok === (prev.quote_token || ""))) continue;
      if (!quoteSymbolLooksNative(prev.quote_symbol) && curQ && curQ !== nextQ) continue;
      const entry = {
        ...prev,
        quote_symbol: nextQ,
        quote_token: nextTok || prev.quote_token || ""
      };
      modeCache.set(token, entry);
      applyModeToKnownCards(token, entry);
    }
  }

  function applyHostFeeEntries(entries) {
    if (!isBadgeAccessAllowed()) return;
    if (!Array.isArray(entries) || !entries.length) return;
    const confirmed = [];
    for (const raw of entries) {
      if (!raw || typeof raw !== "object") continue;
      const token = String(raw.address || "")
        .trim()
        .toLowerCase();
      if (!TARGET_TOKEN_RE.test(token)) continue;
      const derived = deriveHostFeeMode(raw);
      const top_payout_symbol = String(
        raw.top_payout_symbol || raw.dividend_symbol || raw.quote_symbol || ""
      ).trim();
      const payload = {
        mode: derived.mode,
        label: "",
        title: "",
        top_segment: derived.top_segment,
        top_payout_symbol,
        dividend_bps: Number(raw.dividend_bps) || 0,
        market_bps: Number(raw.market_bps) || 0,
        deflation_bps: Number(raw.deflation_bps) || 0,
        lp_bps: Number(raw.lp_bps) || 0,
        giggle_charity_bps: Number(raw.giggle_charity_bps) || 0,
        binance_charity_bps: Number(raw.binance_charity_bps) || 0,
        is_vault: Boolean(raw.is_vault),
        is_stocks_vault: Boolean(raw.is_stocks_vault),
        buy_tax_bps: Number(raw.buy_tax_bps) || 0,
        sell_tax_bps: Number(raw.sell_tax_bps) || 0,
        dividend_symbol: String(raw.dividend_symbol || "").trim(),
        quote_symbol: String(raw.quote_symbol || "").trim(),
        quote_token: String(raw.quote_token || raw.quote_address || "").toLowerCase(),
        vault_address: String(raw.vault_address || "").toLowerCase(),
        basket_assets: normalizeBasketAssets(raw.basket_assets),
        fetched_at: Date.now()
      };
      const entry = normalizeResult(payload);
      if (!entry) continue;
      entry.source_host = raw.source === "debot" ? "debot" : "gmgn";
      entry.__needsChain = raw.__needsChain === true;
      entry.__awaitSecurity = raw.__awaitSecurity === true;
      entry.__basketPendingUntil =
        typeof raw.__basketPendingUntil === "number" ? raw.__basketPendingUntil : 0;
      if (
        entry.__awaitSecurity &&
        entry.__basketPendingUntil > 0 &&
        Date.now() >= entry.__basketPendingUntil
      ) {
        if (
          basketLikelyTruncated(entry.basket_assets, entry) &&
          normalizeBasketAssets(entry.basket_assets).length >= 3
        ) {
          entry.__basketPendingUntil = Date.now() + 12000;
        } else {
          entry.__awaitSecurity = false;
          if (basketSymbolsReady(entry.basket_assets)) entry.__needsChain = false;
        }
      }
      const prev = modeCache.get(token);
      if (prev && !prev.source_host && prev.__needsChain !== true) {
        // /modes 已定案：host-fee 不再用 fiber/DOM 猜篮子或底池。
        continue;
      }
      if (prev && !hostFeeEntryShouldApply(prev, entry)) continue;
      if (prev && Number(prev.fetched_at) > 0) {
        entry.fetched_at = prev.fetched_at;
      }
      modeCache.set(token, entry);
      // Debot 稳的 💎/👨‍🍳（launchpad_extra 已有正 pct）不再排队 /modes。
      // 空金库 / 币股篮子 / __needsChain 才回源。
      if (
        hostFeeShouldDeferToModes(entry) ||
        entry.__needsChain === true ||
        hostFeeAllocationBps(entry) <= 0
      ) {
        queueToken(token, { deferFlush: true });
        if (isGmgnHost() || isDebotHost()) gmgnNewCardPendingTokens.add(token);
      } else {
        releaseQueuedTokenIfHostFeeReady(token);
      }
      if (isHostFeeEntryPending(entry) || entry.__needsChain === true) {
        schedulePendingHostFeePaint(token);
      }
      confirmed.push([token, entry]);
      try {
        ingestFeeEntryForTaxRecv(token, entry);
      } catch (_ing) {
        // ignore
      }
    }
    if (!confirmed.length) return;
    if (confirmed.some(([, e]) => e.source_host === "gmgn")) {
      noteGmgnHostFeeSeen();
    }
    if (confirmed.some(([, e]) => e.source_host === "debot")) {
      noteDebotHostFeeSeen();
    }
    broadcastBasketAddrCache(confirmed.map(([, e]) => e));
    confirmed.forEach(([token, entry]) => {
      let eff = entry;
      const cards = findCardsByCa(token);
      for (let ci = 0; ci < cards.length; ci += 1) {
        const before = eff;
        const enriched = enrichEntrySymbolsFromDom(cards[ci], eff, token);
        if (enriched !== eff) {
          eff = enriched;
          modeCache.set(token, eff);
          maybeRepaintAfterEntryEnrich(token, cards[ci], before, enriched);
        }
      }
      applyModeToKnownCards(token, eff, cards);
    });
    if (isGmgnHost()) {
      try {
        paintUnpaintedTargetViewportQuick("host-fee", null, true);
        if (!isTokenDetailRoute()) {
          paintGmgnCachedViewportCards("host-fee");
        }
      } catch (_p) {
        // ignore
      }
    } else if (isDebotHost()) {
      try {
        paintDebotHostFeeViewport("host-fee");
      } catch (_dp) {
        // ignore
      }
    }
    scheduleTaxRecvHideApply(30);
    if (requestQueue.size > 0) {
      maybeFlushRequestQueue("host-fee-upgrade");
    }
    if (needsHostTaxFeedPoll() && requestQueue.size > 0) {
      scheduleHostTaxFeedRetry("host-fee-done");
    }
  }

  function installHostFeeBridge() {
    window.addEventListener("message", (event) => {
      try {
        if (event.source && event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== "flap-fee-info") return;
        if (data.type === "host-fee-ranks-done" && data.site === "debot") {
          if (!debotRanksDoneAt) debotRanksDoneAt = Date.now();
          if (requestQueue.size > 0) scheduleHostTaxFeedRetry("ranks-done");
          return;
        }
        if (data.type === "host-fee-quote-patch") {
          applyHostFeeQuotePatches(data.entries);
          return;
        }
        if (data.type !== "host-fee-map") return;
        applyHostFeeEntries(data.entries);
      } catch (_err) {
        // ignore
      }
    });
  }

  function installTaxRecvHideBridge() {
    window.addEventListener("message", (event) => {
      try {
        // Page main-world postMessage; some embeds use null source — still accept same-window data.
        if (event.source && event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== "flap-fee-info") return;
        if (data.type !== "tax-recv-map") return;
        const changed = mergeTaxRecvEntries(data.entries);
        if (changed || taxRecvHidePrefs.enabled) {
          scheduleTaxRecvHideApply(20);
        }
      } catch (_err) {
        // ignore
      }
    });
  }

  function hydrateBadgeTheme() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get([BADGE_THEME_KEY], (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        badgeTheme = normalizeBadgeTheme(items?.[BADGE_THEME_KEY]);
        rerenderAllBadges();
      });
    } catch {
      // ignore
    }
  }

  function hydrateBadgeSolidDark() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get(
        [BADGE_SOLID_DARK_KEY, BADGE_DARK_TRANSPARENT_KEY_LEGACY],
        (items) => {
          if (!isExtensionContextValid() || chrome.runtime.lastError) return;
          if (Object.prototype.hasOwnProperty.call(items || {}, BADGE_SOLID_DARK_KEY)) {
            badgeSolidDark = items[BADGE_SOLID_DARK_KEY] === true;
          } else if (
            Object.prototype.hasOwnProperty.call(items || {}, BADGE_DARK_TRANSPARENT_KEY_LEGACY)
          ) {
            // Old "背景透明" checked → translucent (solid=false); unchecked → solid.
            badgeSolidDark = items[BADGE_DARK_TRANSPARENT_KEY_LEGACY] !== true;
          } else {
            badgeSolidDark = DEFAULT_BADGE_SOLID_DARK;
          }
          rerenderAllBadges();
        }
      );
    } catch {
      // ignore
    }
  }

  function clampBadgeOffset(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(BADGE_OFFSET_MIN, Math.min(BADGE_OFFSET_MAX, Math.round(v)));
  }

  function normalizeBadgeOffsets(raw) {
    const out = {
      gmgn: { ...DEFAULT_BADGE_OFFSETS.gmgn },
      debot: { ...DEFAULT_BADGE_OFFSETS.debot }
    };
    if (!raw || typeof raw !== "object") return out;
    for (const site of ["gmgn", "debot"]) {
      const o = raw[site];
      if (o && typeof o === "object") {
        out[site] = {
          enabled: o.enabled === true,
          x: clampBadgeOffset(o.x ?? DEFAULT_BADGE_OFFSETS[site].x),
          y: clampBadgeOffset(o.y ?? DEFAULT_BADGE_OFFSETS[site].y)
        };
      }
    }
    return out;
  }

  function getSiteOffsetKey() {
    return siteStrategy && siteStrategy.name === "debot" ? "debot" : "gmgn";
  }

  /**
   * Active site placement: default (Tax) or absolute vs card top-left.
   * 0.4.22: list rows on K-line side 战壕 share home coords; header stays Tax-only.
   * @param {HTMLElement|null} card
   */
  function getActiveBadgePosition(card) {
    const key = getSiteOffsetKey();
    const o = badgeOffsets[key] || DEFAULT_BADGE_OFFSETS[key];
    // Belt: Debot K-line top zone never absolute (config may have debot.enabled=true).
    if (card && isDebotTokenPage() && isDebotTokenHeaderZoneCard(card)) {
      return { enabled: false, x: 0, y: 0 };
    }
    if (!canUseTrenchAbsoluteCoords(card || null)) {
      return { enabled: false, x: 0, y: 0 };
    }
    return {
      enabled: o?.enabled === true,
      x: clampBadgeOffset(o?.x ?? 12),
      y: clampBadgeOffset(o?.y ?? 8)
    };
  }

  /**
   * Remove every badge tied to a card (inside + siblings + same-token orphans).
   * Fixes double-badge when default Tax mount left a sibling outside card.
   */
  function removeAllBadgesForCard(card, tokenHint) {
    if (!(card instanceof HTMLElement)) return;
    const token =
      tokenHint ||
      card.dataset[CARD_MARK] ||
      card.getAttribute(CARD_DATA) ||
      "";

    const canRemove = (n) => {
      // 0.5.4: locked K-line header badge is immortal until SPA leave (resetOurDomMarks).
      if (isGmgnLockedHeaderBadge(n)) return false;
      return true;
    };

    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
      if (!canRemove(n)) return;
      try {
        n.remove();
      } catch (_err) {
        // ignore
      }
    });

    // Immediate siblings (placeBesideTaxChip beforebegin / afterend).
    for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
      if (
        sib instanceof HTMLElement &&
        (sib.dataset?.[ICON_MARK] === "1" || sib.getAttribute?.(ICON_DATA) === "1")
      ) {
        if (!canRemove(sib)) continue;
        try {
          sib.remove();
        } catch (_err) {
          // ignore
        }
      }
    }

    // Parent-level siblings near this card (climbed Tax mounts).
    const parent = card.parentElement;
    if (parent) {
      Array.from(parent.children).forEach((ch) => {
        if (!(ch instanceof HTMLElement)) return;
        if (ch === card) return;
        if (ch.dataset?.[ICON_MARK] !== "1" && ch.getAttribute?.(ICON_DATA) !== "1") return;
        if (!canRemove(ch)) return;
        const feeTok = ch.dataset?.feeToken || "";
        if (token && feeTok && feeTok !== token) return;
        // Only remove if visually adjacent to this card (same row band).
        try {
          const cr = card.getBoundingClientRect();
          const ir = ch.getBoundingClientRect();
          if (Math.abs(ir.top - cr.top) > cr.height + 8) return;
          if (ir.right < cr.left - 8 || ir.left > cr.right + 8) return;
        } catch (_err) {
          // ignore geometry
        }
        try {
          ch.remove();
        } catch (_err2) {
          // ignore
        }
      });
    }

    // Orphans with same token still in document (absolute remount leftovers).
    // 0.4.51: NEVER remove badges owned by another marked card (三栏同 CA 必留).
    // Geometry gate: only wipe orphans visually on THIS card (Tax sibling mounts).
    if (token) {
      const escapedToken = globalThis.CSS?.escape ? CSS.escape(token) : token;
      document
        .querySelectorAll(`[${ICON_DATA}="1"][data-fee-token="${escapedToken}"]`)
        .forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (!canRemove(n)) return;
        // Keep if already inside this card (should have been cleared above).
        if (card.contains(n)) {
          try {
            n.remove();
          } catch (_err) {
            // ignore
          }
          return;
        }
        // Belong to a different marked card → keep (multi-column same CA).
        const hostCard = n.closest?.(`[${CARD_DATA}]`);
        if (hostCard && hostCard !== card) return;
        // Sibling/orphan of this card only if geometrically on the same visual row/card.
        try {
          const cr = card.getBoundingClientRect();
          const ir = n.getBoundingClientRect();
          if (ir.width < 2 || ir.height < 2) {
            try {
              n.remove();
            } catch (_err0) {
              // ignore
            }
            return;
          }
          if (Math.abs(ir.top - cr.top) > cr.height + 12) return;
          if (ir.right < cr.left - 12 || ir.left > cr.right + 12) return;
        } catch (_err) {
          // No geometry → do not risk wiping other columns.
          return;
        }
        try {
          n.remove();
        } catch (_err2) {
          // ignore
        }
        });
    }
  }

  function ensureCardPositioning(card) {
    if (!(card instanceof HTMLElement)) return;
    try {
      const st = window.getComputedStyle(card);
      if (st.position === "static") {
        card.style.position = "relative";
        card.dataset.flapPosRel = "1";
      }
    } catch (_err) {
      card.style.position = "relative";
      card.dataset.flapPosRel = "1";
    }
  }

  function clearAbsoluteBadgeStyles(icon) {
    if (!(icon instanceof HTMLElement)) return;
    icon.style.position = "";
    icon.style.left = "";
    icon.style.top = "";
    icon.style.right = "";
    icon.style.bottom = "";
    icon.style.margin = "";
    icon.style.zIndex = "";
    icon.style.cursor = "";
    icon.classList.remove("is-dragging");
    delete icon.dataset.feePosMode;
    delete icon.dataset.feeOx;
    delete icon.dataset.feeOy;
  }

  function applyAbsoluteBadgeStyles(icon, x, y) {
    if (!(icon instanceof HTMLElement)) return;
    const cx = clampBadgeOffset(x);
    const cy = clampBadgeOffset(y);
    icon.style.position = "absolute";
    icon.style.left = `${cx}px`;
    icon.style.top = `${cy}px`;
    icon.style.right = "auto";
    icon.style.bottom = "auto";
    icon.style.margin = "0";
    icon.style.zIndex = "40";
    icon.dataset.feePosMode = "absolute";
    icon.dataset.feeOx = String(cx);
    icon.dataset.feeOy = String(cy);
    if (badgeDragEdit) icon.style.cursor = "grab";
  }

  /**
   * Place badge: default = natural Tax mount; absolute = card top-left (x,y).
   * @returns {boolean}
   */
  function placeBadgeOnCard(card, icon) {
    if (!(card instanceof HTMLElement) || !(icon instanceof HTMLElement)) return false;
    const pos = getActiveBadgePosition(card);
    const token = icon.dataset.feeToken || card.dataset[CARD_MARK] || "";

    // Defense: wipe leftovers on THIS card only (keep `icon` itself).
    // Do NOT remove same-token badges on other column cards (三栏重复 CA).
    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
      if (n !== icon) {
        try {
          n.remove();
        } catch (_err) {
          // ignore
        }
      }
    });
    for (const sib of [card.previousElementSibling, card.nextElementSibling]) {
      if (!(sib instanceof HTMLElement) || sib === icon) continue;
      if (sib.dataset?.[ICON_MARK] === "1" || sib.matches?.(`[${ICON_DATA}="1"]`)) {
        try {
          sib.remove();
        } catch (_err) {
          // ignore
        }
      }
    }

    if (pos.enabled) {
      // 0.4.48: wipe nested marks BEFORE append so placeIcon leftovers cannot remain.
      clearNestedFeeMarksUnder(card, token);
      ensureCardPositioning(card);
      if (icon.parentElement !== card) {
        try {
          card.appendChild(icon);
        } catch (_err) {
          return false;
        }
      }
      applyAbsoluteBadgeStyles(icon, pos.x, pos.y);
      purgeAbsoluteDuplicatesOnCard(card, icon, token);
      syncBadgeDragCursor(icon);
      return true;
    }

    // Default: beside Tax / 总税率
    clearAbsoluteBadgeStyles(icon);
    const target = siteStrategy.findIconTarget(card);
    if (!target) return false;
    siteStrategy.placeIcon(target, icon);
    icon.dataset.feePosMode = "default";
    syncBadgeDragCursor(icon);
    return true;
  }

  /** Re-apply placement for an existing icon (scan / storage / drag end). */
  function applyBadgeOffset(icon) {
    if (!(icon instanceof HTMLElement)) return;
    const card = findCardForBadgeIcon(icon);
    if (!card) return;
    const pos = getActiveBadgePosition(card);
    const want = pos.enabled ? "absolute" : "default";
    const have = icon.dataset.feePosMode || "";

    if (want === "absolute") {
      ensureCardPositioning(card);
      if (icon.parentElement !== card) {
        try {
          card.appendChild(icon);
        } catch (_err) {
          return;
        }
      }
      applyAbsoluteBadgeStyles(icon, pos.x, pos.y);
      syncBadgeDragCursor(icon);
      return;
    }

    // default mode: if was absolute, need remount via renderMode (caller forceRemount)
    if (have === "absolute") {
      // leave for remount path — only clear styles if already on tax flow parent
      clearAbsoluteBadgeStyles(icon);
      icon.dataset.feePosMode = "default";
    }
    syncBadgeDragCursor(icon);
  }

  function findCardForBadgeIcon(icon) {
    if (!(icon instanceof HTMLElement)) return null;
    // GMGN: TokenItem href 优先于可能滞后的 data mark（防 7777 徽章挂在 ffff 行上）
    try {
      if (isGmgnHost()) {
        const item = icon.closest?.(
          "[href*='/bsc/token/'][href*='0x'], [href*='/token/'][href*='0x']"
        );
        if (item instanceof HTMLElement) return item;
      }
    } catch (_g) {
      // ignore
    }
    const marked = icon.closest?.(`[${CARD_DATA}]`);
    if (marked instanceof HTMLElement) return marked;
    // Sibling of card (placeBesideTaxChip beforebegin)
    const next = icon.nextElementSibling;
    if (next instanceof HTMLElement && next.dataset?.[CARD_MARK]) return next;
    const prev = icon.previousElementSibling;
    if (prev instanceof HTMLElement && prev.dataset?.[CARD_MARK]) return prev;
    // Parent chain may hold mark
    let p = icon.parentElement;
    for (let i = 0; p && i < 8; i += 1) {
      if (p.dataset?.[CARD_MARK]) return p;
      // GMGN 上爬时遇到 TokenItem 即停
      try {
        const href = p.getAttribute?.("href") || "";
        if (href && href.indexOf("/token/") !== -1 && href.indexOf("0x") !== -1) {
          return p;
        }
      } catch (_h) {
        // ignore
      }
      p = p.parentElement;
    }
    return null;
  }

  function syncBadgeDragCursor(icon) {
    if (!(icon instanceof HTMLElement)) return;
    if (badgeDragEdit) {
      icon.style.cursor = "grab";
      icon.title = (icon.title || "").replace(/\s*\|?\s*拖拽调位置.*/, "") + " | 拖拽调位置";
    } else if (icon.style.cursor === "grab" || icon.style.cursor === "grabbing") {
      icon.style.cursor = "";
    }
  }

  function applyOffsetToAllIcons() {
    // 0.4.15: NEVER CSS-only move for mode switch — always remount once.
    // CSS-only left a Tax-mounted badge + absolute child = double on Debot.
    remountAllBadgesForPosition();
    dedupeBadgesByToken();
  }

  function remountAllBadgesForPosition() {
    invalidateBadgeSignatures();
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const token = card.dataset[CARD_MARK] || card.getAttribute(CARD_DATA) || "";
      if (!token) return;
      // Absolute mode: only outermost marked card paints (Debot nested double-fix).
      const pos = getActiveBadgePosition(card);
      if (pos.enabled && isNestedFeeCard(card)) {
        removeAllBadgesForCard(card, token);
        try {
          delete card.dataset[CARD_MARK];
          card.removeAttribute(CARD_DATA);
        } catch (_err) {
          // ignore
        }
        return;
      }
      const entry =
        modeCache.get(token) ||
        (isPersistentCacheHit(token) ? persistentCache.get(token) : null);
      if (!entry) return;
      renderMode(card, token, entry, { forceRemount: true });
    });
    dedupeBadgesByToken();
  }

  function hydrateBadgeOffsets() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get([BADGE_OFFSET_KEY], (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        badgeOffsets = normalizeBadgeOffsets(items?.[BADGE_OFFSET_KEY]);
        applyOffsetToAllIcons();
      });
    } catch {
      // ignore
    }
  }

  function hydrateBadgeDragEdit() {
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.get([BADGE_DRAG_EDIT_KEY], (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        setBadgeDragEdit(items?.[BADGE_DRAG_EDIT_KEY] === true);
      });
    } catch {
      // ignore
    }
  }

  function setBadgeDragEdit(on) {
    badgeDragEdit = on === true;
    if (badgeDragEdit) installBadgeDragHandlers();
    else uninstallBadgeDragHandlers();
    try {
      document.documentElement.classList.toggle("flap-fee-drag-edit", badgeDragEdit);
      document.body?.classList?.toggle("flap-fee-drag-edit", badgeDragEdit);
    } catch (_err) {
      // ignore
    }
    document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => syncBadgeDragCursor(icon));
    // Turning drag on must not leave stacked badges from prior abs experiments.
    dedupeBadgesByToken();
    if (badgeDragEdit && (isTrenchListPage() || isTokenDetailRoute())) {
      scheduleScan(50, { force: true, immediate: true, light: isTokenPageSettledWithBadge() });
    }
  }

  function persistActiveSitePosition(pos) {
    const key = getSiteOffsetKey();
    const next = normalizeBadgeOffsets({
      ...badgeOffsets,
      [key]: {
        enabled: pos.enabled === true,
        x: clampBadgeOffset(pos.x),
        y: clampBadgeOffset(pos.y)
      }
    });
    badgeOffsets = next;
    if (!isExtensionContextValid() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.set({ [BADGE_OFFSET_KEY]: next }, () => {
        void chrome.runtime?.lastError;
      });
    } catch (_err) {
      // ignore
    }
  }

  function installBadgeDragHandlers() {
    if (badgeDragHandlersInstalled) return;
    badgeDragHandlersInstalled = true;
    // Capture so we beat site click handlers on the card.
    document.addEventListener("pointerdown", onBadgePointerDown, true);
    document.addEventListener("pointermove", onBadgePointerMove, true);
    document.addEventListener("pointerup", onBadgePointerUp, true);
    document.addEventListener("pointercancel", onBadgePointerUp, true);
  }

  function uninstallBadgeDragHandlers() {
    if (!badgeDragHandlersInstalled) return;
    badgeDragHandlersInstalled = false;
    document.removeEventListener("pointerdown", onBadgePointerDown, true);
    document.removeEventListener("pointermove", onBadgePointerMove, true);
    document.removeEventListener("pointerup", onBadgePointerUp, true);
    document.removeEventListener("pointercancel", onBadgePointerUp, true);
    if (badgeDragState) {
      try {
        badgeDragState.icon?.classList?.remove("is-dragging");
      } catch (_err) {
        // ignore
      }
      badgeDragState = null;
    }
  }

  function onBadgePointerDown(e) {
    if (!badgeDragEdit || badgeDragState) return;
    if (e.button != null && e.button !== 0) return;
    const icon = e.target instanceof Element ? e.target.closest(`[${ICON_DATA}="1"]`) : null;
    if (!(icon instanceof HTMLElement)) return;
    const card = findCardForBadgeIcon(icon);
    if (!(card instanceof HTMLElement)) return;
    // 0.4.22: home 战壕 + K-line side list rows; never K-line header 总税率.
    if (!canUseTrenchAbsoluteCoords(card)) return;

    e.preventDefault();
    e.stopPropagation();

    // Lift current visual position into card-absolute coords (works from Tax default too).
    ensureCardPositioning(card);
    const cardRect = card.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const startX = clampBadgeOffset(iconRect.left - cardRect.left + (card.scrollLeft || 0));
    const startY = clampBadgeOffset(iconRect.top - cardRect.top + (card.scrollTop || 0));

    if (icon.parentElement !== card) {
      try {
        card.appendChild(icon);
      } catch (_err) {
        return;
      }
    }
    applyAbsoluteBadgeStyles(icon, startX, startY);
    icon.classList.add("is-dragging");
    icon.style.cursor = "grabbing";

    badgeDragState = {
      icon,
      card,
      pointerId: e.pointerId,
      grabOffsetX: e.clientX - iconRect.left,
      grabOffsetY: e.clientY - iconRect.top
    };
    try {
      icon.setPointerCapture(e.pointerId);
    } catch (_err) {
      // ignore
    }
  }

  function onBadgePointerMove(e) {
    if (!badgeDragState) return;
    if (e.pointerId !== badgeDragState.pointerId) return;
    const { icon, card, grabOffsetX, grabOffsetY } = badgeDragState;
    if (!icon.isConnected || !card.isConnected) {
      badgeDragState = null;
      return;
    }
    e.preventDefault();
    const cardRect = card.getBoundingClientRect();
    const x = clampBadgeOffset(e.clientX - grabOffsetX - cardRect.left + (card.scrollLeft || 0));
    const y = clampBadgeOffset(e.clientY - grabOffsetY - cardRect.top + (card.scrollTop || 0));
    // Live move ONLY the dragged badge (not all cards).
    icon.style.left = `${x}px`;
    icon.style.top = `${y}px`;
    icon.dataset.feeOx = String(x);
    icon.dataset.feeOy = String(y);
  }

  function onBadgePointerUp(e) {
    if (!badgeDragState) return;
    if (e.pointerId != null && e.pointerId !== badgeDragState.pointerId) return;
    const { icon, card } = badgeDragState;
    const x = clampBadgeOffset(parseInt(icon.style.left, 10) || 0);
    const y = clampBadgeOffset(parseInt(icon.style.top, 10) || 0);
    try {
      icon.releasePointerCapture?.(badgeDragState.pointerId);
    } catch (_err) {
      // ignore
    }
    icon.classList.remove("is-dragging");
    icon.style.cursor = "";
    badgeDragState = null;

    if (!canUseTrenchAbsoluteCoords(card)) {
      // Header / invalid — discard; still turn off drag.
      setBadgeDragEdit(false);
      try {
        if (isExtensionContextValid() && chrome.storage?.local) {
          chrome.storage.local.set({ [BADGE_DRAG_EDIT_KEY]: false }, () => {
            void chrome.runtime?.lastError;
          });
        }
      } catch (_err) {
        // ignore
      }
      return;
    }

    // Persist + enable absolute mode for this site (same gmgn key as home 战壕).
    persistActiveSitePosition({ enabled: true, x, y });
    // Dedup then apply absolute to every trench badge.
    if (card instanceof HTMLElement) {
      const tok = icon.dataset.feeToken || card.dataset[CARD_MARK] || "";
      removeAllBadgesForCard(card, tok);
      // Re-place the dragged visual as the single badge for this card.
      try {
        ensureCardPositioning(card);
        card.appendChild(icon);
        applyAbsoluteBadgeStyles(icon, x, y);
      } catch (_err) {
        // ignore
      }
    }
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((c) => {
      if (!(c instanceof HTMLElement) || c === card) return;
      const token = c.dataset[CARD_MARK] || "";
      if (!token) return;
      const entry =
        modeCache.get(token) ||
        (isPersistentCacheHit(token) ? persistentCache.get(token) : null);
      if (!entry) return;
      renderMode(c, token, entry, { forceRemount: true });
    });
    dedupeBadgesByToken();

    // 0.4.20: auto-disable drag after one placement — re-open in popup to drag again.
    setBadgeDragEdit(false);
    try {
      if (isExtensionContextValid() && chrome.storage?.local) {
        chrome.storage.local.set({ [BADGE_DRAG_EDIT_KEY]: false }, () => {
          void chrome.runtime?.lastError;
        });
      }
    } catch (_err) {
      // ignore
    }
  }

  function watchDisplayPrefs() {
    if (!isExtensionContextValid() || !chrome.storage?.onChanged) return;
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = false;
        if (changes[DISPLAY_PREFS_KEY]) {
          displayPrefs = normalizeDisplayPrefs(changes[DISPLAY_PREFS_KEY].newValue);
          if (!isHoverTipEnabled()) hideFeeTooltip();
          dirty = true;
        }
        if (changes[UI_LANG_KEY]) {
          uiLang = changes[UI_LANG_KEY].newValue === "en" ? "en" : "zh";
          dirty = true;
        }
        if (changes[BADGE_THEME_KEY]) {
          badgeTheme = normalizeBadgeTheme(changes[BADGE_THEME_KEY].newValue);
          dirty = true;
        }
        if (changes[BADGE_SOLID_DARK_KEY]) {
          badgeSolidDark = changes[BADGE_SOLID_DARK_KEY].newValue === true;
          dirty = true;
        }
        if (changes[BADGE_OFFSET_KEY]) {
          badgeOffsets = normalizeBadgeOffsets(changes[BADGE_OFFSET_KEY].newValue);
          applyOffsetToAllIcons();
        }
        if (changes[BADGE_DRAG_EDIT_KEY]) {
          setBadgeDragEdit(changes[BADGE_DRAG_EDIT_KEY].newValue === true);
        }
        if (changes[TAX_RECV_HIDE_KEY]) {
          const prevPrefs = { ...taxRecvHidePrefs };
          taxRecvHidePrefs = normalizeTaxRecvHidePrefs(changes[TAX_RECV_HIDE_KEY].newValue);
          const enabledNow = taxRecvHidePrefs.enabled === true;
          const enabledWas = prevPrefs.enabled === true;
          const thrChanged =
            Number(prevPrefs.thresholdPct) !== Number(taxRecvHidePrefs.thresholdPct);
          const allowChanged = taxRecvAllowSig(prevPrefs) !== taxRecvAllowSig(taxRecvHidePrefs);
          pushTaxRecvPrefsToPage({ refresh: enabledNow });
          if (!enabledNow) {
            // 关闭：清 DOM 标记 + 整页 reload（去掉 JSON 过滤后的残缺列表）
            clearAllTaxRecvDomHide();
            try {
              sessionStorage.removeItem("flapFeeInfo.listFilterRefresh.v1");
            } catch (_ss) {
              // ignore
            }
            if (enabledWas && isTaxRecvListReflowPage()) {
              scheduleTaxRecvListReflow("prefs-off");
              return;
            }
            scheduleTaxRecvHideApply(0);
            return;
          }
          // 开启或改阈值：清标记 + reload，document_start 即带 prefs 过滤首包
          clearAllTaxRecvDomHide();
          if (!enabledWas || thrChanged || allowChanged) {
            try {
              sessionStorage.removeItem("flapFeeInfo.listFilterRefresh.v1");
            } catch (_ss2) {
              // ignore
            }
            scheduleTaxRecvListReflow("prefs-change");
          }
          scheduleTaxRecvHideApply(0);
        }
        if (changes[SUFFIX_HIDE_KEY]) {
          const wasOn = suffixHidePrefs.enabled === true;
          suffixHidePrefs = normalizeSuffixHidePrefs(changes[SUFFIX_HIDE_KEY].newValue);
          pushSuffixHidePrefsToPage();
          const nowOn = suffixHidePrefs.enabled === true;
          // 规则变化：GMGN 需 reload 让 page-hook 用新规则滤首包/WS
          if (wasOn !== nowOn || nowOn) {
            try {
              sessionStorage.removeItem("flapFeeInfo.listFilterRefresh.v1");
            } catch (_ss3) {
              // ignore
            }
            if (isTaxRecvListReflowPage()) {
              scheduleTaxRecvListReflow("suffix-hide-change");
            } else {
              scheduleTaxRecvHideApply(0);
            }
          } else {
            clearAllTaxRecvDomHide();
            scheduleTaxRecvHideApply(0);
          }
        }
        if (changes[VAULT_HIDE_KEY]) {
          const wasOn = vaultHidePrefs.enabled === true;
          vaultHidePrefs = normalizeVaultHidePrefs(changes[VAULT_HIDE_KEY].newValue);
          pushVaultHidePrefsToPage();
          const nowOn = vaultHidePrefs.enabled === true;
          if (wasOn !== nowOn || nowOn) {
            try {
              sessionStorage.removeItem("flapFeeInfo.listFilterRefresh.v1");
            } catch (_ss4) {
              // ignore
            }
            if (isTaxRecvListReflowPage()) {
              scheduleTaxRecvListReflow("vault-hide-change");
            } else {
              scheduleTaxRecvHideApply(0);
            }
          } else {
            clearAllTaxRecvDomHide();
            scheduleTaxRecvHideApply(0);
          }
        }
        if (changes[SEARCH_HIDE_KEY]) {
          searchHidePrefs = normalizeSearchHidePrefs(changes[SEARCH_HIDE_KEY].newValue);
          scheduleSearchOverlayHideApply(0);
        }
        if (changes[LICENSE_KEY]) {
          licenseAccessKey = String(changes[LICENSE_KEY].newValue?.key || "").trim();
          void refreshLicenseAccessState("storage");
        }
        if (changes[DEVICE_ID_KEY]) {
          licenseDeviceId = normalizeLicenseDeviceId(changes[DEVICE_ID_KEY].newValue);
          if (licenseAccessKey) void refreshLicenseAccessState("device-id");
        }
        if (dirty) rerenderAllBadges();
      });
    } catch {
      // ignore
    }
  }

  /** Re-apply badge text after popup toggles change. */
  function rerenderAllBadges() {
    invalidateBadgeSignatures();
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      const token = card.dataset[CARD_MARK] || card.getAttribute(CARD_DATA) || "";
      if (!token) return;
      const entry =
        modeCache.get(token) ||
        (isPersistentCacheHit(token) ? persistentCache.get(token) : null);
      if (!entry) return;
      // Position mode may need remount (Tax vs absolute).
      renderMode(card, token, entry, {
        forceRemount: getActiveBadgePosition(card).enabled
      });
    });
    scheduleTaxRecvHideApply(40);
  }

  function getBasketAssetsForDisplay(entry) {
    const prefs = displayPrefs || DEFAULT_DISPLAY_PREFS;
    if (prefs.basket === false) return [];
    return normalizeBasketAssets(entry?.basket_assets);
  }

  function basketPairText(assets) {
    const syms = basketDisplaySymbols(assets);
    if (syms.length >= 2) return `${syms[0]}&${syms[1]}`;
    if (syms.length === 1) return syms[0];
    return "";
  }

  /**
   * Compact fee allocation from bps, filtered by displayPrefs.
   * When payoutArrow is on, annotate the single largest *visible* segment with →SYMBOL
   * (never omit when equals pool quote — user wants explicit payout).
   * Index vault gift: 📈 + first two basket symbols (not →IB-xxx).
   */
  function buildFeeLabel(entry, domQuoteSymbol) {
    const prefs = displayPrefs || DEFAULT_DISPLAY_PREFS;
    const domQuote = compactDisplaySymbol(domQuoteSymbol || "");
    const basketAssets = getBasketAssetsForDisplay(entry);
    const basketPair = basketPairText(basketAssets);
    const useStockGift = Boolean(
      entry.is_vault &&
        basketPair &&
        !basketLooksLikeNativeOnly(basketAssets) &&
        isTrustedStockVault(entry)
    );
    const candidates = [];
    if ((entry.dividend_bps || 0) > 0 && prefs.holder !== false) {
      candidates.push({ kind: "holder", emoji: "💎", bps: entry.dividend_bps, pri: 0 });
    }
    if ((entry.market_bps || 0) > 0) {
      if (entry.is_vault && prefs.gift !== false) {
        candidates.push({
          kind: "gift",
          emoji: useStockGift ? STOCK_EMOJI : GIFT_EMOJI,
          bps: entry.market_bps,
          pri: 1
        });
      } else if (!entry.is_vault && prefs.creator !== false) {
        candidates.push({ kind: "creator", emoji: "👨‍🍳", bps: entry.market_bps, pri: 4 });
      }
    }
    if ((entry.giggle_charity_bps || 0) > 0 && prefs.giggle !== false) {
      candidates.push({ kind: "giggle", emoji: "🎓", bps: entry.giggle_charity_bps, pri: 2 });
    }
    if ((entry.binance_charity_bps || 0) > 0 && prefs.binance !== false) {
      candidates.push({ kind: "binance", emoji: "💛", bps: entry.binance_charity_bps, pri: 3 });
    }
    if ((entry.deflation_bps || 0) > 0 && prefs.burn !== false) {
      candidates.push({ kind: "burn", emoji: "🔥", bps: entry.deflation_bps, pri: 5 });
    }
    if ((entry.lp_bps || 0) > 0 && prefs.lp !== false) {
      candidates.push({ kind: "lp", emoji: "💧", bps: entry.lp_bps, pri: 6 });
    }

    if (!candidates.length) {
      if (entry.mode === "unknown" && prefs.unknown !== false) {
        return modeMeta.unknown.fallback;
      }
      // All segments hidden by prefs — empty fee part.
      return "";
    }

    // Prefer API top_segment if still visible; else re-pick among visible.
    let top =
      entry.top_segment && entry.top_segment !== "unknown" ? entry.top_segment : null;
    if (!top || !candidates.some((c) => c.kind === top)) {
      const sorted = [...candidates].sort((a, b) => b.bps - a.bps || a.pri - b.pri);
      top = sorted[0].kind;
    }

    // Resolve →SYMBOL for the *visible* top only (don't reuse API top symbol on another kind).
    let topSym = "";
    if (prefs.payoutArrow !== false && top) {
      if (top === "gift" && useStockGift) {
        topSym = ""; // basket pair appended without arrow / IB-xxx
      } else if (top === "holder") {
        topSym = tickerSymbolForArrow(
          entry.dividend_symbol ||
            entry.top_payout_symbol ||
            entry.quote_symbol ||
            domQuote ||
            ""
        );
      } else if (top === "gift") {
        const srcGift =
          entry.dividend_symbol ||
          entry.top_payout_symbol ||
          entry.quote_symbol ||
          domQuote ||
          "";
        if (forceVaultNativePoolQuote(entry) && looksLikeStockQuoteChip(srcGift, entry)) {
          topSym = compactDisplaySymbol(vaultDefaultPoolQuote());
        } else {
          topSym = tickerSymbolForArrow(srcGift);
        }
      } else if (
        top === "creator" ||
        top === "lp" ||
        top === "giggle" ||
        top === "binance"
      ) {
        const srcQ = entry.quote_symbol || domQuote || "";
        if (
          forceVaultNativePoolQuote(entry) &&
          (looksLikeStockQuoteChip(srcQ, entry) ||
            looksLikeStockQuoteChip(compactBasketSymbol(srcQ), entry) ||
            looksLikeStockQuoteChip(compactDisplaySymbol(srcQ), entry))
        ) {
          const fallback = domQuote || vaultDefaultPoolQuote();
          topSym = looksLikeStockQuoteChip(fallback, entry)
            ? compactDisplaySymbol(vaultDefaultPoolQuote())
            : compactDisplaySymbol(fallback);
        } else {
          topSym = compactDisplaySymbol(srcQ);
        }
      } else if (top === entry.top_segment) {
        topSym = compactDisplaySymbol(entry.top_payout_symbol || domQuote || "");
      }
      // burn: tax symbol not always cached client-side — omit arrow if unknown
    }

    // Highest share first (leftmost); tie-break matches server SEGMENT_PRIORITY.
    candidates.sort((a, b) => b.bps - a.bps || a.pri - b.pri);

    const parts = candidates.map((c) => {
      // 0.4.48: 100% → icon only (💎 not 💎100%); partial still shows percent.
      const base = formatSegmentBase(c.emoji, c.bps);
      if (c.kind === "gift" && useStockGift) {
        return `${base}${basketPair}`;
      }
      if (c.kind === top && topSym) return `${base}→${topSym}`;
      return base;
    });
    return parts.join("");
  }

  /**
   * Badge text: {🦋|🖐️|🪙}QUOTE | fee (spaces around |), honor displayPrefs.
   * Returns empty string when everything is toggled off.
   */
  function buildDisplayLabel(entry, quoteSymbol, token) {
    const prefs = displayPrefs || DEFAULT_DISPLAY_PREFS;
    const fee = buildFeeLabel(entry, quoteSymbol);
    const showPool = prefs.pool !== false && Boolean(quoteSymbol);
    const prefix = poolPrefixForToken(token || "");
    if (showPool && fee) return `${prefix}${quoteSymbol} | ${fee}`;
    if (showPool) return `${prefix}${quoteSymbol}`;
    return fee;
  }

  function tipT(key) {
    const pack = TIP_I18N[uiLang] || TIP_I18N.zh;
    return pack[key] != null ? pack[key] : TIP_I18N.zh[key] || key;
  }

  function bpsToPercentLabel(bps) {
    const n = Number(bps) || 0;
    if (n % 100 === 0) return `${n / 100}%`;
    const v = n / 100;
    return `${String(v.toFixed(1)).replace(/\.0$/, "")}%`;
  }

  function buildTipModel(entry, quoteSymbol, label, token) {
    const basket = getBasketAssetsForDisplay(entry);
    return {
      label: label || "",
      quoteSymbol: quoteSymbol || "",
      poolPrefix: poolPrefixForToken(token || ""),
      buyTax: bpsToPercentLabel(entry.buy_tax_bps),
      sellTax: bpsToPercentLabel(entry.sell_tax_bps),
      titleLines: String(entry.title || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6),
      basket
    };
  }

  function computeBadgePresentation(entry, quoteSymbol, token) {
    const theme = badgeTheme === "light" ? "light" : "dark";
    const solidDarkClass =
      theme === "dark" && badgeSolidDark ? "gmgn-fee-mode-icon--solid-dark" : "";
    const tok = String(token || "").toLowerCase();
    // 未就绪：固定 emoji + 待加载（不拼半截 fee / 错篮子，避免突变）
    if (isFeeLoadingEntry(entry) || isHostFeeEntryPending(entry)) {
      const label = loadingBadgeLabel();
      const title = loadingBadgeTitle();
      const className = [
        "gmgn-fee-mode-icon",
        `gmgn-fee-mode-icon--theme-${theme}`,
        solidDarkClass,
        "gmgn-fee-mode-icon--loading",
        `gmgn-fee-mode-icon--${siteStrategy.name}`
      ]
        .filter(Boolean)
        .join(" ");
      return {
        label,
        title,
        className,
        meta: { className: "loading", fallback: label, title },
        basketCount: 0,
        tipModel: {
          label,
          quoteSymbol: "",
          poolPrefix: poolPrefixForToken(tok),
          buyTax: "",
          sellTax: "",
          titleLines: [title],
          basket: []
        },
        basketPair: null,
        isLoading: true
      };
    }
    const meta = modeMeta[entry.mode] || modeMeta.unknown;
    const label = buildDisplayLabel(entry, quoteSymbol, tok);
    const basketAssets = getBasketAssetsForDisplay(entry);
    const basketCount = basketAssets.length;
    // For muted "&" between first two symbols (e.g. SPCX&TSLA).
    const pairSyms = basketDisplaySymbols(basketAssets);
    const basketPair =
      pairSyms.length >= 2 && label.includes(`${pairSyms[0]}&${pairSyms[1]}`)
        ? { left: pairSyms[0], right: pairSyms[1] }
        : null;
    const segmentCount =
      Number((entry.dividend_bps || 0) > 0) +
      Number((entry.market_bps || 0) > 0) +
      Number((entry.giggle_charity_bps || 0) > 0) +
      Number((entry.binance_charity_bps || 0) > 0) +
      Number((entry.deflation_bps || 0) > 0) +
      Number((entry.lp_bps || 0) > 0);
    // Light: never translucent / never honor solidDark toggle — CSS forces solid dark chip.
    // Dark: optional solid-dark class when user checks 深色背景.
    const className = [
      "gmgn-fee-mode-icon",
      `gmgn-fee-mode-icon--theme-${theme}`,
      solidDarkClass,
      `gmgn-fee-mode-icon--${meta.className}`,
      `gmgn-fee-mode-icon--${siteStrategy.name}`,
      segmentCount >= 3 ? "gmgn-fee-mode-icon--wide" : "",
      segmentCount >= 2 ? "gmgn-fee-mode-icon--multi" : "",
      quoteSymbol && displayPrefs.pool !== false ? "gmgn-fee-mode-icon--with-pool" : "",
      basketCount >= 3 ? "gmgn-fee-mode-icon--has-count" : "",
      basketCount > 0 ? "gmgn-fee-mode-icon--basket" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const tipModel = buildTipModel(entry, quoteSymbol, label, tok);
    // Legacy plain title kept for rare code paths; UI uses custom tooltip.
    const title = tipModel.titleLines.join("\n");
    return {
      label,
      title,
      className,
      meta,
      basketCount,
      tipModel,
      basketPair,
      isLoading: false
    };
  }

  /** Fill label node; mute "&" between basket tickers so SPCX / TSLA stand out. */
  function fillBadgeLabelText(textEl, label, basketPair) {
    textEl.textContent = "";
    const text = String(label || "");
    if (!basketPair?.left || !basketPair?.right) {
      textEl.textContent = text;
      return;
    }
    const pair = `${basketPair.left}&${basketPair.right}`;
    const idx = text.indexOf(pair);
    if (idx < 0) {
      textEl.textContent = text;
      return;
    }
    if (idx > 0) {
      textEl.appendChild(document.createTextNode(text.slice(0, idx)));
    }
    const leftEl = document.createElement("span");
    leftEl.className = "gmgn-fee-mode-icon__sym";
    leftEl.textContent = basketPair.left;
    textEl.appendChild(leftEl);
    const ampEl = document.createElement("span");
    ampEl.className = "gmgn-fee-mode-icon__amp";
    ampEl.textContent = "&";
    ampEl.setAttribute("aria-hidden", "true");
    textEl.appendChild(ampEl);
    const rightEl = document.createElement("span");
    rightEl.className = "gmgn-fee-mode-icon__sym";
    rightEl.textContent = basketPair.right;
    textEl.appendChild(rightEl);
    if (idx + pair.length < text.length) {
      textEl.appendChild(document.createTextNode(text.slice(idx + pair.length)));
    }
  }

  function isHoverTipEnabled() {
    return Boolean(displayPrefs && displayPrefs.hoverTip === true);
  }

  function ensureFeeTooltip() {
    if (feeTooltipEl && document.contains(feeTooltipEl)) return feeTooltipEl;
    const el = document.createElement("div");
    el.className = "gmgn-fee-mode-tooltip";
    el.setAttribute("role", "tooltip");
    el.hidden = true;
    (document.documentElement || document.body).appendChild(el);
    feeTooltipEl = el;
    installFeeTooltipGuards();
    return el;
  }

  function installFeeTooltipGuards() {
    if (window.__flapFeeTipGuards === 1) return;
    window.__flapFeeTipGuards = 1;
    const hideNow = () => hideFeeTooltip();
    try {
      window.addEventListener("scroll", hideNow, true);
      window.addEventListener("wheel", hideNow, { capture: true, passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) hideNow();
      });
      window.addEventListener("blur", hideNow);
    } catch (_err) {
      // ignore
    }
  }

  function scheduleHideFeeTooltip(ms) {
    if (feeTooltipHideTimer) window.clearTimeout(feeTooltipHideTimer);
    feeTooltipHideTimer = window.setTimeout(() => {
      feeTooltipHideTimer = 0;
      hideFeeTooltip();
    }, ms);
  }

  function hideFeeTooltip() {
    if (feeTooltipHideTimer) {
      window.clearTimeout(feeTooltipHideTimer);
      feeTooltipHideTimer = 0;
    }
    feeTooltipAnchor = null;
    if (!feeTooltipEl) return;
    feeTooltipEl.hidden = true;
    feeTooltipEl.innerHTML = "";
    feeTooltipEl.style.left = "-9999px";
    feeTooltipEl.style.top = "0px";
  }

  function appendTipKv(parent, keyText, valueText) {
    const row = document.createElement("div");
    row.className = "gmgn-fee-mode-tooltip__row";
    const k = document.createElement("span");
    k.className = "gmgn-fee-mode-tooltip__k";
    k.textContent = keyText;
    const v = document.createElement("span");
    v.className = "gmgn-fee-mode-tooltip__v";
    v.textContent = valueText;
    row.append(k, v);
    parent.appendChild(row);
  }

  function renderFeeTooltipContent(model) {
    const theme = badgeTheme === "light" ? "light" : "dark";
    const root = ensureFeeTooltip();
    root.className = `gmgn-fee-mode-tooltip gmgn-fee-mode-tooltip--theme-${theme}`;
    root.innerHTML = "";

    const head = document.createElement("div");
    head.className = "gmgn-fee-mode-tooltip__head";
    head.textContent = model.label || tipT("taxAlloc");
    root.appendChild(head);

    if (model.quoteSymbol) {
      appendTipKv(
        root,
        tipT("pool"),
        `${model.poolPrefix || POOL_PREFIX_DEFAULT}${model.quoteSymbol}`
      );
    }

    appendTipKv(root, tipT("buySell"), `${model.buyTax} / ${model.sellTax}`);

    if (model.basket && model.basket.length) {
      const sec = document.createElement("div");
      sec.className = "gmgn-fee-mode-tooltip__sec";
      const secTitle = document.createElement("div");
      secTitle.className = "gmgn-fee-mode-tooltip__sec-title";
      secTitle.textContent = `${tipT("basket")} · ${model.basket.length}`;
      sec.appendChild(secTitle);
      const list = document.createElement("ul");
      list.className = "gmgn-fee-mode-tooltip__list";
      for (const asset of model.basket) {
        const li = document.createElement("li");
        const nameEl = document.createElement("span");
        nameEl.className = "gmgn-fee-mode-tooltip__name";
        nameEl.textContent = asset.name || asset.symbol || "—";
        const symEl = document.createElement("span");
        symEl.className = "gmgn-fee-mode-tooltip__sym";
        symEl.textContent = asset.symbol || "";
        li.append(nameEl, symEl);
        list.appendChild(li);
      }
      sec.appendChild(list);
      root.appendChild(sec);
    }

    return root;
  }

  function positionFeeTooltip(anchor) {
    const tip = ensureFeeTooltip();
    if (!anchor || !document.contains(anchor)) return;
    const ar = anchor.getBoundingClientRect();
    const pad = 8;
    tip.hidden = false;
    // Measure after unhide
    const tr = tip.getBoundingClientRect();
    let left = ar.left + ar.width / 2 - tr.width / 2;
    let top = ar.bottom + 6;
    if (top + tr.height > window.innerHeight - pad) {
      top = ar.top - tr.height - 6;
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - tr.height - pad));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function showFeeTooltip(anchor) {
    if (!isHoverTipEnabled()) {
      hideFeeTooltip();
      return;
    }
    if (!(anchor instanceof HTMLElement) || !document.contains(anchor)) return;
    const data = badgeTipData.get(anchor);
    if (!data?.tipModel) return;
    if (feeTooltipHideTimer) {
      window.clearTimeout(feeTooltipHideTimer);
      feeTooltipHideTimer = 0;
    }
    feeTooltipAnchor = anchor;
    renderFeeTooltipContent(data.tipModel);
    positionFeeTooltip(anchor);
  }

  function bindBadgeTooltip(icon) {
    if (!(icon instanceof HTMLElement) || icon.dataset.feeTipBound === "1") return;
    icon.dataset.feeTipBound = "1";
    icon.addEventListener("mouseenter", () => {
      if (!isHoverTipEnabled()) return;
      showFeeTooltip(icon);
    });
    icon.addEventListener("mouseleave", () => scheduleHideFeeTooltip(50));
  }

  function isFourTaxToken(token) {
    const ca = String(token || "").toLowerCase();
    return /^0x[a-f0-9]{36}ffff$/.test(ca);
  }

  function isFlapTaxToken(token) {
    const ca = String(token || "").toLowerCase();
    return /^0x[a-f0-9]{36}(8888|7777)$/.test(ca);
  }

  /** 底池前缀：Four 🖐️ · Flap 🦋 · 其它 🪙 */
  function poolPrefixForToken(token) {
    if (isFourTaxToken(token)) return POOL_PREFIX_FOUR;
    if (isFlapTaxToken(token)) return POOL_PREFIX_FLAP;
    return POOL_PREFIX_DEFAULT;
  }

  function normalizeSuffixHideRule(raw, idx) {
    const id =
      raw && typeof raw.id === "string" && raw.id
        ? raw.id
        : `r${Date.now().toString(36)}_${idx || 0}`;
    let suffix = String(raw?.suffix || "")
      .trim()
      .toLowerCase()
      .replace(/^0x/, "");
    suffix = suffix.replace(/[^a-f0-9]/g, "").slice(0, 12);
    return {
      id,
      suffix,
      enabled: raw?.enabled !== false
    };
  }

  function normalizeSuffixHidePrefs(raw) {
    const out = { enabled: false, rules: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const list = Array.isArray(raw.rules) ? raw.rules : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.rules.length < SUFFIX_HIDE_MAX_RULES; i++) {
      const r = normalizeSuffixHideRule(list[i], i);
      if (!r.suffix || r.suffix.length < 1) continue;
      if (seen.has(r.suffix)) continue;
      seen.add(r.suffix);
      out.rules.push(r);
    }
    return out;
  }

  /** 仅 BSC：地址是否命中自定义尾号屏蔽 */
  function shouldHideByCustomSuffix(token) {
    if (!suffixHidePrefs || suffixHidePrefs.enabled !== true) return false;
    if (!isAllowedScanChain()) return false;
    const addr = String(token || "")
      .trim()
      .toLowerCase();
    if (!addr.startsWith("0x") || addr.length < 6) return false;
    const rules = suffixHidePrefs.rules || [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (!r || r.enabled === false) continue;
      const s = String(r.suffix || "").toLowerCase();
      if (s && addr.endsWith(s)) return true;
    }
    return false;
  }

  function normalizeVaultHidePrefs(raw) {
    const out = { ...DEFAULT_VAULT_HIDE };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    out.hideTaxVault = raw.hideTaxVault === true;
    out.hideStockVault = raw.hideStockVault === true;
    return out;
  }

  function pushVaultHidePrefsToPage() {
    const prefs = {
      enabled: vaultHidePrefs.enabled === true,
      hideTaxVault: vaultHidePrefs.hideTaxVault === true,
      hideStockVault: vaultHidePrefs.hideStockVault === true
    };
    const payload = JSON.stringify(prefs);
    try {
      document.documentElement?.setAttribute("data-flap-vault-hide", payload);
    } catch (_e) {
      // ignore
    }
    try {
      localStorage.setItem(VAULT_HIDE_KEY, payload);
    } catch (_ls) {
      // ignore
    }
    syncGmgnShareWorkerForFilters();
    try {
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "vault-hide-prefs",
          prefs
        },
        "*"
      );
    } catch (_e2) {
      // ignore
    }
  }

  function pushSuffixHidePrefsToPage() {
    const prefs = {
      enabled: suffixHidePrefs.enabled === true,
      rules: (suffixHidePrefs.rules || []).map((r) => ({
        suffix: r.suffix,
        enabled: r.enabled !== false
      }))
    };
    const payload = JSON.stringify(prefs);
    try {
      document.documentElement?.setAttribute("data-flap-suffix-hide", payload);
    } catch (_e) {
      // ignore
    }
    try {
      localStorage.setItem(SUFFIX_HIDE_KEY, payload);
    } catch (_ls) {
      // ignore
    }
    syncGmgnShareWorkerForFilters();
    try {
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "suffix-hide-prefs",
          prefs
        },
        "*"
      );
    } catch (_e2) {
      // ignore
    }
  }

  /**
   * 徽章点击目标：
   * - Flap 8888/7777 → flap.sh taxinfo
   * - Four ffff → four.meme 代币页（用户指定 zh-TW/token/{ca}）
   */
  function buildTaxDetailUrl(token) {
    const ca = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(ca)) return "";
    if (isFourTaxToken(ca)) {
      return `${FOUR_TOKEN_PAGE_BASE}/${ca}`;
    }
    if (isFlapTaxToken(ca)) {
      const lang = uiLang === "en" ? "en" : "zh";
      return `${FLAP_TAXINFO_BASE}/${ca}/taxinfo?lang=${lang}`;
    }
    return "";
  }

  function buildFlapTaxinfoUrl(token) {
    // 兼容旧名：统一走 buildTaxDetailUrl
    return buildTaxDetailUrl(token);
  }

  function openTaxDetail(token) {
    const url = buildTaxDetailUrl(token);
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_err) {
      try {
        location.assign(url);
      } catch (_err2) {
        // ignore
      }
    }
  }

  function openFlapTaxinfo(token) {
    openTaxDetail(token);
  }

  function isOpenTaxinfoEnabled() {
    const prefs = displayPrefs || DEFAULT_DISPLAY_PREFS;
    return prefs.openTaxinfo !== false;
  }

  /**
   * Click / Enter → Flap taxinfo 或 Four.meme token 页。
   * Skip when drag-edit or pointer moved (drag). Bound once per badge node.
   */
  function bindBadgeClick(icon) {
    if (!(icon instanceof HTMLElement) || icon.dataset.feeClickBound === "1") return;
    icon.dataset.feeClickBound = "1";
    let ptrDown = null;

    icon.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button != null && e.button !== 0) return;
        ptrDown = { x: e.clientX, y: e.clientY };
      },
      true
    );

    icon.addEventListener(
      "click",
      (e) => {
        if (!isOpenTaxinfoEnabled()) return;
        // Drag-to-position mode: never hijack navigation.
        if (badgeDragEdit || badgeDragState) return;
        if (ptrDown) {
          const dx = Math.abs((e.clientX || 0) - ptrDown.x);
          const dy = Math.abs((e.clientY || 0) - ptrDown.y);
          ptrDown = null;
          if (dx > 6 || dy > 6) return;
        }
        const token = icon.dataset.feeToken || "";
        if (!TARGET_TOKEN_RE.test(token)) return;
        e.preventDefault();
        e.stopPropagation();
        openTaxDetail(token);
      },
      true
    );

    icon.addEventListener("keydown", (e) => {
      if (!isOpenTaxinfoEnabled()) return;
      if (badgeDragEdit || badgeDragState) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const token = icon.dataset.feeToken || "";
      if (!TARGET_TOKEN_RE.test(token)) return;
      e.preventDefault();
      e.stopPropagation();
      openTaxDetail(token);
    });
  }

  /**
   * Paint badge DOM: main label + optional basket count chip; custom tooltip (no native title).
   */
  function applyBadgeUi(icon, presentation, token) {
    if (!(icon instanceof HTMLElement) || !presentation) return;
    const { label, className, basketCount, tipModel } = presentation;
    const isLoading = presentation.isLoading === true;
    // 加载中不可点进 taxinfo，避免半截状态误导
    const clickable = !isLoading && isOpenTaxinfoEnabled();
    const finalClass = clickable
      ? `${className} gmgn-fee-mode-icon--clickable`.trim()
      : className;
    icon.className = finalClass;
    icon.dataset.feeToken = token || icon.dataset.feeToken || "";
    icon.dataset.feeSig = label || "";
    icon.dataset.feeBasketCount = String(basketCount || 0);
    icon.dataset.feeOpenTaxinfo = clickable ? "1" : "0";
    if (isLoading) icon.dataset.feeLoading = "1";
    else delete icon.dataset.feeLoading;
    icon.removeAttribute("title");
    icon.setAttribute("tabindex", "0");
    icon.setAttribute("role", clickable ? "link" : "img");
    const ariaExtra = clickable
      ? uiLang === "en"
        ? isFourTaxToken(token)
          ? " — open Four.meme tax page"
          : " — open Flap tax info"
        : isFourTaxToken(token)
          ? " — 打开 Four.meme 税收页"
          : " — 打开 Flap 税收详情"
      : "";
    icon.setAttribute("aria-label", `${label || "fee"}${ariaExtra}`);

    icon.textContent = "";
    const textEl = document.createElement("span");
    textEl.className = "gmgn-fee-mode-icon__text";
    fillBadgeLabelText(textEl, label || "", presentation.basketPair || null);
    icon.appendChild(textEl);
    if ((basketCount || 0) >= 3) {
      const countEl = document.createElement("span");
      countEl.className = "gmgn-fee-mode-icon__count";
      countEl.textContent = String(basketCount);
      countEl.setAttribute("aria-hidden", "true");
      icon.appendChild(countEl);
    }

    badgeTipData.set(icon, { tipModel: tipModel || { label, basket: [] } });
    bindBadgeTooltip(icon);
    bindBadgeClick(icon);
    if (feeTooltipAnchor === icon) {
      if (isHoverTipEnabled()) showFeeTooltip(icon);
      else hideFeeTooltip();
    } else if (feeTooltipAnchor && !document.contains(feeTooltipAnchor)) {
      hideFeeTooltip();
    }
  }

  /** True when badge is missing, wrong token/label, or detached from preferred Debot mount. */
  function badgeNeedsUpdate(card, token, entry) {
    // Doubles / orphans near card → always remount.
    if (countBadgesNearCard(card, token) !== 1) return true;

    const existing = card.querySelector(`[${ICON_DATA}="1"]`);
    if (!existing || !document.contains(existing)) return true;
    if (existing.dataset.feeToken !== token) return true;

    // 占位 → 正式数据：必须更新
    if (existing.dataset.feeLoading === "1" && !isFeeLoadingEntry(entry)) return true;
    // 仍无数据且已是占位：稳定，不重挂
    if (existing.dataset.feeLoading === "1" && isFeeLoadingEntry(entry)) {
      const want = loadingBadgeLabel();
      const textEl = existing.querySelector(".gmgn-fee-mode-icon__text");
      const shown = textEl ? textEl.textContent : existing.textContent;
      if (shown === want) return false;
    }

    // Cheap text/class check first (avoid layout + mount search every scan).
    const quoteSymbol = isFeeLoadingEntry(entry)
      ? ""
      : resolveQuoteSymbol(card, entry);
    const presentation = computeBadgePresentation(entry, quoteSymbol, token);
    const { label, className, basketCount } = presentation;
    if (!label) return true;
    const textEl = existing.querySelector(".gmgn-fee-mode-icon__text");
    const shown = textEl ? textEl.textContent : existing.textContent;
    if (shown !== label) return true;
    const wantClick = isOpenTaxinfoEnabled();
    const wantClass = wantClick
      ? `${className} gmgn-fee-mode-icon--clickable`.trim()
      : className;
    if (existing.className !== wantClass) return true;
    if ((existing.dataset.feeOpenTaxinfo === "1") !== wantClick) return true;
    const wantCount = (basketCount || 0) >= 3 ? String(basketCount) : "";
    const countEl = existing.querySelector(".gmgn-fee-mode-icon__count");
    const haveCount = countEl ? countEl.textContent || "" : "";
    if (wantCount !== haveCount) return true;

    // Not actually painted (0×0) → remount. (single rect read)
    const er = existing.getBoundingClientRect();
    if (er.width < 2 || er.height < 2) return true;

    // Parent still in document is enough most of the time; skip expensive remount search.
    if (!existing.parentElement || !document.contains(existing.parentElement)) return true;
    return false;
  }

  function renderMode(card, token, entry, options = {}) {
    const forceRemount = options.forceRemount === true;
    if (shouldDeferGmgnTrenchResizeWork()) return false;
    // 仅 7777/8888/ffff 挂徽章；其它尾号直接清掉误挂
    const tok = String(token || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(tok)) {
      try {
        removeAllBadgesForCard(card, tok);
      } catch (_e) {
        // ignore
      }
      return false;
    }
    // 钱包追踪 / 顶 ticker / 搜索钱包区：禁止挂载
    if (card instanceof HTMLElement && isBadgeMountForbidden(card)) {
      wipeForbiddenMountBadges(card, true);
      return false;
    }
    if (!isBadgeAccessAllowed()) {
      try {
        removeAllBadgesForCard(card, tok);
      } catch (_lic) {
        // ignore
      }
      return false;
    }
    // 虚拟列表复用 / 错挂：行身份 CA 必须 === tok，且必须是目标尾号
    try {
      const idCa = extractCardHrefToken(card);
      if (idCa) {
        if (!TARGET_TOKEN_RE.test(idCa)) {
          wipeNonTargetCardBadges(card, idCa);
          return false;
        }
        if (idCa !== tok) {
          removeAllBadgesForCard(card, tok);
          return false;
        }
      }
      const live = siteStrategy?.extractToken?.(card);
      if (live != null && live !== tok) {
        removeAllBadgesForCard(card, tok);
        return false;
      }
    } catch (_e2) {
      // ignore — continue paint
    }
    const quoteSymbol = isFeeLoadingEntry(entry)
      ? ""
      : resolveQuoteSymbol(card, entry);
    const presentation = computeBadgePresentation(entry, quoteSymbol, tok);
    const { label } = presentation;
    const pos = getActiveBadgePosition(card);
    const wantMode = pos.enabled ? "absolute" : "default";

    // 0.4.48 Debot absolute: nested CARD_MARK (metrics row inside MuiCard) must NOT paint.
    // Outer card owns the single absolute badge — nested paint = visual double stack.
    if (wantMode === "absolute" && isNestedFeeCard(card)) {
      removeAllBadgesForCard(card, token);
      try {
        delete card.dataset[CARD_MARK];
        card.removeAttribute(CARD_DATA);
      } catch (_err) {
        // ignore
      }
      return true;
    }

    // All toggles off or nothing to show → clear badge.（loading 占位始终有 label）
    if (!label) {
      removeAllBadgesForCard(card, token);
      return true;
    }

    // Count badges for this card/token — more than one → force remount/dedup.
    const multi = countBadgesNearCard(card, token) > 1;

    // In-place update when node still valid AND placement mode matches AND single badge.
    const existing =
      card.querySelector(`[${ICON_DATA}="1"]`) ||
      (card.previousElementSibling?.dataset?.[ICON_MARK] === "1"
        ? card.previousElementSibling
        : null);
    if (
      !forceRemount &&
      !multi &&
      existing &&
      document.contains(existing) &&
      existing.dataset.feeToken === token &&
      (existing.dataset.feePosMode || "default") === wantMode &&
      !(isInsideOverlayDialog(card) && existing.dataset.feeOverlayPos === "volume")
    ) {
      const er = existing.getBoundingClientRect();
      if (er.width >= 2 && er.height >= 2 && existing.parentElement) {
        applyBadgeUi(existing, presentation, token);
        if (wantMode === "absolute") {
          applyAbsoluteBadgeStyles(existing, pos.x, pos.y);
        }
        syncBadgeDragCursor(existing);
        return true;
      }
    }

    // Default Tax mode needs a mount target; absolute only needs the card.
    if (!pos.enabled) {
      const target = siteStrategy.findIconTarget(card);
      if (!target) {
        // Layout may not be ready right after tab resume; keep mark so next scan retries.
        return false;
      }
    }

    // Always full cleanup before (re)mount — kills double-badge.
    removeAllBadgesForCard(card, token);
    if (wantMode === "absolute") {
      clearNestedFeeMarksUnder(card, token);
    }

    const icon = document.createElement("span");
    icon.dataset[ICON_MARK] = "1";
    applyBadgeUi(icon, presentation, token);

    if (!placeBadgeOnCard(card, icon)) {
      // Absolute always succeeds if card exists; Tax path missing target.
      try {
        icon.remove();
      } catch (_err) {
        // ignore
      }
      return false;
    }
    if (wantMode === "absolute") {
      purgeAbsoluteDuplicatesOnCard(card, icon, token);
    }
    return true;
  }

  function clearCardIcon(card) {
    const token = card instanceof HTMLElement ? card.dataset[CARD_MARK] || "" : "";
    removeAllBadgesForCard(card, token);
    if (card instanceof HTMLElement) delete card.dataset[CARD_MARK];
  }

  /**
   * Soft cleanup by default (detached icons only).
   * Deep mode re-extracts tokens — only on force remount / rare tick (expensive).
   */
  function cleanupMarkedCards(options = {}) {
    const deep = options.deep === true;
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      if (!document.contains(card)) {
        clearCardIcon(card);
        return;
      }
      const token = card.dataset[CARD_MARK];
      if (!token) {
        clearCardIcon(card);
        return;
      }
      // 0.5.3: protect GMGN K-line header card from deep extract thrash.
      if (isGmgnHost() && isGmgnHeaderMarkedCard(card)) return;
      const icon = card.querySelector(`[${ICON_DATA}="1"]`);
      // Badge may be afterend sibling of short CA (outside marked host) — don't treat as missing.
      if (icon && !document.contains(icon)) {
        try {
          icon.remove();
        } catch (_err) {
          // ignore
        }
      }
      if (!deep) return;
      const live = siteStrategy.extractToken(card);
      // Soft after wake: attrs may lag — do NOT wipe mark/icon on temporary null extract.
      if (live == null) return;
      if (live !== token) clearCardIcon(card);
    });
  }

  /** Invalidate stable-badge short-circuit so next scan recomputes labels (prefs/theme). */
  function invalidateBadgeSignatures() {
    document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
      if (icon instanceof HTMLElement) delete icon.dataset.feeSig;
    });
  }

  function findGmgnTrenchTaxHost(card) {
    if (!(card instanceof HTMLElement) || !isGmgnHost()) return null;
    const host = card.querySelector(GMGN_TRENCH_TAX_SELECTOR);
    if (!(host instanceof HTMLElement)) return null;
    try {
      const r = host.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.height > 40) return null;
    } catch (_err) {
      return null;
    }
    return host;
  }

  function resolveGmgnTaxMountHost(taxEl) {
    if (!(taxEl instanceof HTMLElement)) return taxEl;
    const dedicated = taxEl.closest?.(GMGN_TRENCH_TAX_SELECTOR);
    if (dedicated instanceof HTMLElement) return dedicated;
    return taxEl;
  }

  /** GMGN 战壕列表：徽章紧贴 .trenches-tax 右侧，避免塞进 16px 内芯或掉到下一行。 */
  function placeGmgnListTaxBadge(taxEl, icon) {
    if (!(taxEl instanceof HTMLElement) || !(icon instanceof HTMLElement)) return;
    icon.dataset.feeMountSide = "tax-after";
    const host = resolveGmgnTaxMountHost(taxEl);
    host.insertAdjacentElement("afterend", icon);
  }

  /** GMGN 关闭税收展示时：挂进代币名行内部右侧（与 Tax 同视觉带）。 */
  function placeGmgnListNameBadge(nameEl, icon) {
    if (!(nameEl instanceof HTMLElement) || !(icon instanceof HTMLElement)) return;
    icon.dataset.feeMountSide = "name-after";
    if (nameEl.dataset.flapMount === "gmgn-trench-name") {
      try {
        nameEl.appendChild(icon);
        return;
      } catch (_err) {
        // fall through
      }
    }
    nameEl.insertAdjacentElement("afterend", icon);
  }

  function gmgnLeafLooksLikeTokenName(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t || t.length < 1 || t.length > 36) return false;
    if (/^Tax\s/i.test(t) || /^Fees?\s/i.test(t)) return false;
    if (/^(MC|V|L|H|F|Run|AI报告)/i.test(t)) return false;
    if (TARGET_SHORT_TOKEN_RE.test(t) || SHORT_TOKEN_RE.test(t)) return false;
    if (/^0x[a-fA-F0-9]/i.test(t)) return false;
    if (/^[\d$.,]+%?$/.test(t)) return false;
    if (/^⚡|^(BNB|SOL|ETH|WBNB)$/i.test(t)) return false;
    return true;
  }

  /**
   * GMGN 战壕 TokenItem：用户设置里关闭「税收」后无 Tax 芯片。
   * 回退到代币名行（原 Tax 左侧同一高度带），避免整卡不画徽章。
   */
  function findGmgnTrenchNameMount(card) {
    if (!(card instanceof HTMLElement) || !isGmgnHost()) return null;
    if (findTaxTag(card)) return null;

    const cached = gmgnTaxMountCache.get(card);
    if (
      cached &&
      cached.kind === "name" &&
      cached.el instanceof HTMLElement &&
      document.contains(cached.el) &&
      card.contains(cached.el) &&
      Date.now() - cached.at < GMGN_TAX_MOUNT_CACHE_MS
    ) {
      return cached.el;
    }

    const cr = card.getBoundingClientRect();
    if (cr.width < 120 || cr.height < 40) return null;

    const leaves = card.querySelectorAll("span, div, p, a");
    const max = Math.min(leaves.length, 140);
    let bestLeaf = null;
    let bestScore = Infinity;

    for (let i = 0; i < max; i += 1) {
      const el = leaves[i];
      if (!(el instanceof HTMLElement)) continue;
      if (el.matches(`[${ICON_DATA}="1"]`) || el.querySelector(`[${ICON_DATA}="1"]`)) continue;
      if (el.childElementCount > 3) continue;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!gmgnLeafLooksLikeTokenName(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.width > 220 || r.height > 36) continue;
      if (r.top > cr.top + cr.height * 0.48) continue;
      if (r.left > cr.left + cr.width * 0.78) continue;
      const score = r.top * 1000 + r.left;
      if (score < bestScore) {
        bestScore = score;
        bestLeaf = el;
      }
    }

    if (!(bestLeaf instanceof HTMLElement)) return null;

    let row = bestLeaf;
    const leafRect = bestLeaf.getBoundingClientRect();
    for (let depth = 0; depth < 4 && row.parentElement instanceof HTMLElement; depth += 1) {
      const parent = row.parentElement;
      const pr = parent.getBoundingClientRect();
      if (
        pr.height > 0 &&
        pr.height <= 44 &&
        pr.width >= leafRect.width &&
        pr.width <= cr.width * 0.92
      ) {
        row = parent;
      } else {
        break;
      }
    }

    row.dataset.flapMount = "gmgn-trench-name";
    gmgnTaxMountCache.set(card, { at: Date.now(), el: row, kind: "name" });
    return row;
  }

  function placeBesideTaxChip(target, icon) {
    if (!(target instanceof HTMLElement) || !(icon instanceof HTMLElement)) return;
    if (isGmgnHost() && !isGmgnTokenPage()) {
      placeGmgnListTaxBadge(target, icon);
      return;
    }
    let anchor = target;
    let parent = target.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1) {
      const style = window.getComputedStyle(parent);
      const overflowHidden =
        style.overflow === "hidden" ||
        style.overflowX === "hidden" ||
        style.overflowY === "hidden";
      const rect = parent.getBoundingClientRect();
      // Climb out of clipping wrappers, but stop before jumping to the whole card row.
      if (overflowHidden && rect.width < 360) {
        anchor = parent;
        parent = parent.parentElement;
        continue;
      }
      break;
    }
    anchor.insertAdjacentElement("beforebegin", icon);
  }

  /** GMGN 主战壕三列（含 K 线左侧内嵌战壕，不含搜索弹层 / 顶栏）。 */
  function isGmgnFixedTrenchCard(card) {
    if (
      !isGmgnHost() ||
      !(card instanceof HTMLElement) ||
      card.dataset.flapOverlayCard === "1" ||
      isInsideOverlayDialog(card)
    ) {
      return false;
    }
    if (!card.closest?.(GMGN_FIXED_TRENCH_ROOT_SELECTOR)) return false;
    if (isGmgnTokenPage()) return isGmgnTokenTrenchSidebarEl(card);
    return true;
  }

  function repairGmgnTrenchBadgesAfterListReturn(_reason) {
    if (!isGmgnHost() || isGmgnTokenPage()) return 0;
    let repaired = 0;
    const icons = Array.from(document.querySelectorAll(`[${ICON_DATA}="1"]`));
    for (let i = 0; i < icons.length; i += 1) {
      const icon = icons[i];
      if (!(icon instanceof HTMLElement)) continue;
      if (icon.dataset.feeHeader === "1") continue;
      const card =
        icon.closest(`[${CARD_DATA}]`) ||
        icon.closest('div[href*="/token/"]') ||
        icon.closest('a[href*="/token/"]');
      if (!(card instanceof HTMLElement)) {
        try {
          icon.remove();
          repaired += 1;
        } catch (_orphan) {
          // ignore
        }
        continue;
      }
      if (!isGmgnFixedTrenchCard(card)) continue;
      const tok = String(icon.dataset.feeToken || card.dataset[CARD_MARK] || "")
        .trim()
        .toLowerCase();
      if (!TARGET_TOKEN_RE.test(tok)) continue;
      const misplaced = isGmgnTrenchMisplacedBadge(card, icon);
      if (!misplaced) continue;
      removeAllBadgesForCard(card, tok);
      repaired += 1;
      const entry = resolveEntry(tok);
      if (entry && !isHostFeeEntryPending(entry)) {
        renderMode(card, tok, entry, { forceRemount: true });
      }
    }
    return repaired;
  }

  /** 战壕徽章必须贴在 .trenches-tax 右侧同行；name-after 在 Tax 已出现时算错位。 */
  function isGmgnTrenchMisplacedBadge(card, icon) {
    if (!isGmgnFixedTrenchCard(card)) return false;
    if (!(icon instanceof HTMLElement)) return false;
    // 绝对坐标挂在卡片根上，对不齐 Tax 几何；每轮当错位会 560ms 拆挂闪烁。
    if (icon.dataset.feePosMode === "absolute") return false;
    const taxHost = findGmgnTrenchTaxHost(card);
    if (taxHost) {
      // 已贴在该 Tax 后面：hybrid 过长换行/裁切也不能重挂（重挂解不了，只会闪）。
      if (icon.previousElementSibling === taxHost) return false;
      if (icon.dataset.feeMountSide !== "tax-after") return true;
      return icon.previousElementSibling !== taxHost;
    }
    if (icon.dataset.feeLoading === "1") return false;
    if (!card.contains(icon)) {
      try {
        const cr = card.getBoundingClientRect();
        const ir = icon.getBoundingClientRect();
        if (cr.width <= 0 || ir.width <= 0) return true;
        if (Math.abs(ir.top - cr.top) > cr.height * 0.65) return true;
        if (ir.left < cr.left - 8 || ir.left > cr.right + 24) return true;
      } catch (_out) {
        return true;
      }
    }
    const side = icon.dataset.feeMountSide || "";
    if (side !== "name-after") return true;
    const anchor = findGmgnTrenchNameMount(card);
    if (!(anchor instanceof HTMLElement)) return false;
    try {
      const tr = anchor.getBoundingClientRect();
      const ir = icon.getBoundingClientRect();
      if (tr.width <= 0 || ir.width <= 0) return false;
      if (Math.abs(ir.top - tr.top) > 18) return true;
      if (ir.left + 4 < tr.left) return true;
    } catch (_geo) {
      return false;
    }
    return false;
  }

  function findTaxTag(card) {
    if (!(card instanceof HTMLElement) || !card.querySelectorAll) return null;

    // 0.4.43 GMGN: reuse Tax chip mount across virtual-list scan ticks.
    if (isGmgnHost()) {
      const cached = gmgnTaxMountCache.get(card);
      if (
        cached &&
        cached.kind !== "name" &&
        cached.el instanceof HTMLElement &&
        document.contains(cached.el) &&
        card.contains(cached.el) &&
        Date.now() - cached.at < GMGN_TAX_MOUNT_CACHE_MS
      ) {
        return cached.el;
      }
      const dedicated = findGmgnTrenchTaxHost(card);
      if (dedicated) {
        dedicated.dataset.flapMount = "gmgn-trench-tax";
        gmgnTaxMountCache.set(card, { at: Date.now(), el: dedicated, kind: "tax" });
        return dedicated;
      }
    }

    // Match Tax/fee chips; "Tax 0.25%/1.25%" is often wider than 110px so do not hard-cap tightly.
    const tokenTrench = isGmgnTokenPage() && isGmgnTokenTrenchSidebarEl(card);
    const leaves = card.querySelectorAll("span, div");
    // Cap walk — huge GMGN cards under thrash; Debot cards are smaller so full walk is fine.
    const maxCheck = isGmgnHost()
      ? Math.min(leaves.length, tokenTrench ? 160 : 80)
      : leaves.length;
    const candidates = [];
    for (let i = 0; i < maxCheck; i += 1) {
      const el = leaves[i];
      if (!(el instanceof HTMLElement)) continue;
      if (el.matches(`[${ICON_DATA}="1"]`) || el.querySelector(`[${ICON_DATA}="1"]`)) continue;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 48) continue;
      if (!hasFeeTag(text)) continue;
      if (tokenTrench && el.childElementCount > 3) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.width > 280 || rect.height > 40) continue;
      candidates.push(el);
    }

    if (candidates.length === 0) {
      // Do not cache misses — Tax chip may appear a tick later on virtual rows.
      return null;
    }

    // Smallest chip first (most specific Tax badge), but prefer the **top** metadata row.
    const cardRect = card.getBoundingClientRect();
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const topDiff = ar.top - br.top;
      if (Math.abs(topDiff) > 6) return topDiff;
      const areaDiff = ar.width * ar.height - br.width * br.height;
      if (areaDiff !== 0) return areaDiff;
      return (a.textContent || "").length - (b.textContent || "").length;
    });
    const hit = candidates[0];
    if (isGmgnHost() && hit) {
      gmgnTaxMountCache.set(card, { at: Date.now(), el: hit, kind: "tax" });
    }
    return hit;
  }

  /**
   * Debot/Gungnir mount points (js-mcp 2026-08 research):
   *
   * List cards: Debot allows custom 买 button size (up to ~140×100). Mounting on the
   * buy row caused jumpiness because row height/layout changes and our old
   * height≤48 gate failed → fell back to random metric/sidebar nodes.
   *
   * Stable primary: bottom **metrics bar** (flex row with ≥2 `%` chips, h≤40).
   * Secondary: leaf 买 button row (size-tolerant).
   * Token page: stats stack containing 价格+流动性 (right panel).
   * Results cached ~2.5s per card to avoid getComputedStyle thrash.
   */
  function findDebotIconTarget(card) {
    const cached = debotMountCache.get(card);
    const inOverlay = isInsideOverlayDialog(card);

    // Search overlays have their own strict mount. Never reuse/fall through to an
    // older metrics or address mount because that can place the badge over host UI.
    if (inOverlay) {
      if (
        cached &&
        cached.el instanceof HTMLElement &&
        cached.el.dataset.flapMount === "overlay-title" &&
        card.contains(cached.el) &&
        document.contains(cached.el) &&
        Date.now() - cached.at < DEBOT_MOUNT_CACHE_MS
      ) {
        return cached.el;
      }
      const titleMount = findDebotOverlayTitleMount(card);
      if (titleMount) debotMountCache.set(card, { at: Date.now(), el: titleMount });
      return titleMount;
    }

    if (
      cached &&
      cached.el &&
      document.contains(cached.el) &&
      Date.now() - cached.at < DEBOT_MOUNT_CACHE_MS &&
      !(
        (cached.el.dataset.flapMount === "metrics" && findDebotTaxChip(card)) ||
        cached.el.dataset.flapMount === "tax"
      )
    ) {
      return cached.el;
    }

    let el = null;
    if (isDebotTokenPage() && isDebotTokenHeaderCard(card)) {
      // Prefer top header row (title + short CA) — matches user arrow near name.
      const short =
        findDebotShortAddressNode(card) ||
        (findDebotTokenHeaderCard() &&
          findDebotShortAddressNode(findDebotTokenHeaderCard()));
      if (short) {
        const row =
          findDebotShortAddressRow(card) ||
          short.parentElement ||
          short;
        el = markDebotMount(row instanceof HTMLElement ? row : short, "token-header");
      }
      if (!el) {
        const tokenMount = findDebotTokenPageMount(card) || findDebotTokenPageMount(document);
        if (tokenMount) el = markDebotMount(tokenMount, "token-stats");
      }
    } else if (isDebotTokenPage()) {
      const tokenMount = findDebotTokenPageMount(card);
      if (tokenMount) el = markDebotMount(tokenMount, "token-stats");
    }

    if (!el && !isDebotTokenPage()) {
      const tax = findDebotTaxChip(card);
      if (tax) {
        const col = findDebotOverflowInfoCol(tax, card);
        el = col ? markDebotMount(col, "tax-col") : markDebotMount(tax, "tax");
      }
    }

    if (!el) {
      const metrics = findDebotMetricsBar(card);
      if (metrics) el = markDebotMount(metrics, "metrics");
    }

    if (!el) {
      const buyMount = findDebotBuyMount(card);
      if (buyMount) el = markDebotMount(buyMount.row, "buy", buyMount.buyWrap);
    }

    if (!el) {
      const shortRow = findDebotShortAddressRow(card);
      if (shortRow) el = markDebotMount(shortRow, "short");
    }

    if (!el) {
      const shortNode = findDebotShortAddressNode(card);
      if (shortNode) el = markDebotMount(shortNode, "short-leaf");
    }

    if (el) debotMountCache.set(card, { at: Date.now(), el });
    return el;
  }

  /** Debot/Gungnir search overlay: append after the final token-name row item. */
  function findDebotOverlayTitleMount(card) {
    if (!(card instanceof HTMLElement) || !isInsideOverlayDialog(card)) return null;
    const shortNode = findDebotShortAddressNode(card);
    if (!(shortNode instanceof HTMLElement)) return null;

    let addressRow = shortNode;
    for (let depth = 0; addressRow && depth < 5; depth += 1) {
      if (!(addressRow instanceof HTMLElement) || addressRow === card) break;
      const titleRow = addressRow.previousElementSibling;
      if (titleRow instanceof HTMLElement) {
        const addressRect = addressRow.getBoundingClientRect();
        const titleRect = titleRow.getBoundingClientRect();
        const titleText = (titleRow.textContent || "").replace(/\s+/g, " ").trim();
        const hasShortAddress = TARGET_SHORT_TOKEN_RE.test(titleText);
        const sameStack = titleRow.parentElement === addressRow.parentElement;
        const compactRows =
          addressRect.width > 0 &&
          addressRect.width <= 240 &&
          addressRect.height >= 12 &&
          addressRect.height <= 32 &&
          titleRect.width > 0 &&
          titleRect.width <= 280 &&
          titleRect.height >= 12 &&
          titleRect.height <= 32;
        const titleAboveAddress = titleRect.top <= addressRect.top && titleRect.bottom <= addressRect.top + 4;
        if (sameStack && compactRows && titleAboveAddress && titleText && !hasShortAddress) {
          return markDebotMount(titleRow, "overlay-title");
        }
      }
      addressRow = addressRow.parentElement;
    }
    return null;
  }

  function markDebotMount(el, kind, buyWrap) {
    if (!(el instanceof HTMLElement)) return el;
    if (el.dataset.flapMount !== kind) el.dataset.flapMount = kind;
    if (buyWrap instanceof HTMLElement) {
      if (el.dataset.flapBuyId !== "1") el.dataset.flapBuyId = "1";
      if (buyWrap.dataset.flapBuyWrap !== "1") buyWrap.dataset.flapBuyWrap = "1";
    }
    return el;
  }

  /** Name/tax column is overflow:hidden (~300px). Place badge after this column. */
  function findDebotOverflowInfoCol(fromEl, card) {
    if (!(fromEl instanceof HTMLElement) || !(card instanceof HTMLElement)) return null;
    let hidden = null;
    let el = fromEl;
    try {
      const cr = card.getBoundingClientRect();
      for (let i = 0; i < 10 && el && el !== card; i += 1) {
        const st = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (
          (st.overflow === "hidden" || st.overflowX === "hidden") &&
          r.width >= 160 &&
          r.width < cr.width * 0.78 &&
          r.height >= 48 &&
          r.height <= 160
        ) {
          hidden = el;
        }
        el = el.parentElement;
      }
    } catch (_err) {
      return hidden;
    }
    return hidden;
  }

  function findDebotTaxChip(card) {
    if (!(card instanceof HTMLElement) || !card.querySelectorAll) return null;
    const nodes = card.querySelectorAll("span, div");
    const max = Math.min(nodes.length, 80);
    for (let i = 0; i < max; i += 1) {
      const el = nodes[i];
      if (!(el instanceof HTMLElement)) continue;
      if (el.matches?.(`[${ICON_DATA}="1"]`)) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!/^Tax(?:\s*\d+(?:\.\d+)?(?:%\s*\/\s*\d+(?:\.\d+)?)?%)?$/i.test(t) && !/^Tax\s+\d/i.test(t)) {
        continue;
      }
      if (t.length > 22) continue;
      try {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.width < 90 && r.height > 0 && r.height < 28) return el;
      } catch (_err) {
        // ignore
      }
    }
    return null;
  }

  /** Bottom stats strip: e.g. 3% | Run | 1% | 0% | 0% — independent of 买 size. */
  function findDebotMetricsBar(card) {
    const rows = Array.from(card.querySelectorAll("div")).filter((el) => {
      if (el.matches(`[${ICON_DATA}="1"]`)) return false;
      const st = window.getComputedStyle(el);
      if (st.display !== "flex") return false;
      if (st.flexDirection !== "row" && st.flexDirection !== "row-reverse") return false;
      const r = el.getBoundingClientRect();
      if (r.width < 160 || r.height < 14 || r.height > 42) return false;
      const text = (el.textContent || "").replace(/\s+/g, " ");
      const pct = (text.match(/%/g) || []).length;
      if (pct < 2) return false;
      // Exclude giant blocks that merely contain nested metrics.
      if (text.length > 80) return false;
      // Prefer bars in lower half of card.
      const cr = card.getBoundingClientRect();
      if (r.top < cr.top + cr.height * 0.25) return false;
      return true;
    });
    if (!rows.length) return null;
    // Bottom-most bar wins (closest to 买).
    rows.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return rows[0];
  }

  /**
   * Leaf 买 control only (not 464px-wide wrappers). Custom size 5 ≈ 139×100 allowed.
   * @returns {{ row: HTMLElement, buyWrap: HTMLElement } | null}
   */
  function findDebotBuyMount(card) {
    const leaves = [];
    const nodes = card.querySelectorAll("button, [class*='cursor-pointer'], div, span, a");
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (el.matches(`[${ICON_DATA}="1"]`) || el.querySelector(`[${ICON_DATA}="1"]`)) continue;
      const full = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!/^买\s*\d*$/u.test(full) && !/^Buy\s*\d*$/i.test(full)) continue;
      if (full.length > 10) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // Drop full-width layout shells; keep leaf/custom chips (js-mcp: ~139×100 max custom).
      if (r.width > 220) continue;
      if (r.height > 120) continue;
      leaves.push({ el, area: r.width * r.height });
    }
    if (!leaves.length) return null;
    leaves.sort((a, b) => a.area - b.area);
    const buyLeaf = leaves[0].el;

    let buyWrap = buyLeaf;
    if (buyLeaf.parentElement && buyLeaf.parentElement !== card) {
      const pr = buyLeaf.parentElement.getBoundingClientRect();
      // Wrap box roughly same size as leaf (not a huge row).
      if (pr.width > 0 && pr.width <= 240 && pr.height > 0 && pr.height <= 130) {
        buyWrap = buyLeaf.parentElement;
      }
    }

    let row = buyWrap.parentElement;
    for (let depth = 0; row && depth < 6; depth += 1) {
      if (!(row instanceof HTMLElement)) break;
      const st = window.getComputedStyle(row);
      const isRowFlex =
        st.display === "flex" &&
        (st.flexDirection === "row" || st.flexDirection === "row-reverse");
      const rect = row.getBoundingClientRect();
      // Allow tall custom-buy rows (was ≤48 → missed size 5).
      if (isRowFlex && rect.width >= 80 && rect.height >= 16 && rect.height <= 140 && row.contains(buyWrap)) {
        return { row, buyWrap };
      }
      row = row.parentElement;
    }
    if (buyWrap.parentElement instanceof HTMLElement) {
      return { row: buyWrap.parentElement, buyWrap };
    }
    return null;
  }

  /** Token detail: right-side stats (价格 / 流动性 / 交易费…). */
  function findDebotTokenPageMount(card) {
    const scope = card && card.querySelectorAll ? card : document;
    const nodes = scope.querySelectorAll ? scope.querySelectorAll("div") : [];
    const list = Array.from(nodes).filter((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ");
      if (!t.includes("价格") || !t.includes("流动性")) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 140 || r.width > 520) return false;
      if (r.height < 48 || r.height > 420) return false;
      if (r.top > window.innerHeight * 0.75) return false;
      // Prefer compact stats column, not whole page.
      if (t.length > 400) return false;
      return true;
    });
    if (!list.length) return null;
    list.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return list[0];
  }

  function findDebotShortAddressRow(card) {
    const shortNode = findDebotShortAddressNode(card);
    if (!shortNode) return null;
    let parent = shortNode.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      if (!(parent instanceof HTMLElement)) break;
      const rect = parent.getBoundingClientRect();
      if (rect.width >= 140 && rect.height >= 14 && rect.height <= 64) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return shortNode.parentElement instanceof HTMLElement ? shortNode.parentElement : shortNode;
  }

  function findDebotShortAddressNode(card) {
    const candidates = Array.from(card.querySelectorAll("span, div, a, p, button"));
    const matched = candidates.filter((el) => {
      if (!TARGET_SHORT_TOKEN_RE.test(el.textContent || "")) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.width <= 160 && rect.height > 0 && rect.height <= 36;
    });
    if (matched.length === 0) return null;
    matched.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return matched[0];
  }

  /**
   * Debot 战壕：徽章贴在 overflow 名称列右侧、与 Tax 同行。
   * 父级是 space-between（左名称列 / 右 MC+买）。徽章绝不能当 flex 中间项，
   * 否则会把右侧买按钮挤成 0 宽并漂在卡片正中。
   */
  function placeDebotTaxColBadge(col, icon) {
    if (!(col instanceof HTMLElement) || !(icon instanceof HTMLElement)) return;
    const parent = col.parentElement;
    if (!(parent instanceof HTMLElement)) {
      col.insertAdjacentElement("afterend", icon);
      return;
    }
    icon.dataset.feeMountSide = "tax-col";
    try {
      if (window.getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
    } catch (_pos) {
      // ignore
    }
    if (icon.parentElement !== parent) parent.appendChild(icon);
    try {
      const pr = parent.getBoundingClientRect();
      const cr = col.getBoundingClientRect();
      let top = 0;
      const card =
        col.closest?.('a[href*="/token/"]') ||
        (col.parentElement && col.parentElement.closest?.('a[href*="/token/"]')) ||
        col;
      const tax = findDebotTaxChip(card instanceof HTMLElement ? card : col);
      if (tax) {
        top = Math.max(0, Math.round(tax.getBoundingClientRect().top - pr.top));
      }
      icon.style.position = "absolute";
      icon.style.left = `${Math.max(0, Math.round(cr.right - pr.left + 6))}px`;
      icon.style.top = `${top}px`;
      icon.style.margin = "0";
      icon.style.zIndex = "4";
    } catch (_geo) {
      col.insertAdjacentElement("afterend", icon);
    }
  }

  /**
   * Place badge:
   * - metrics / token-stats: append (stable end of row)
   * - buy: before 买 wrap
   * - short: afterend
   */
  function placeDebotIcon(target, icon) {
    const kind = target?.dataset?.flapMount || "";
    // Never leave an older badge next to the new mount point.
    if (target && target.querySelectorAll) {
      target.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
        if (n !== icon) {
          try {
            n.remove();
          } catch (_err) {
            // ignore
          }
        }
      });
    }

    if (kind === "tax-col") {
      placeDebotTaxColBadge(target, icon);
      return;
    }
    if (kind === "tax") {
      target.insertAdjacentElement("afterend", icon);
      return;
    }

    // Token header: afterend of short CA，不要 append 进名称行（Debot 会把行 innerText/HTML 写进 document.title）。
    if (kind === "token-header") {
      icon.dataset.feeMountSide = "token-header";
      const short = findDebotShortAddressNode(target);
      const leaf =
        short instanceof HTMLElement
          ? short
          : TARGET_SHORT_TOKEN_RE.test(String(target.textContent || "").trim()) &&
              String(target.textContent || "").trim().length <= 24
            ? target
            : target;
      leaf.insertAdjacentElement("afterend", icon);
      return;
    }
    if (kind === "token-stats" || kind === "overlay-title") {
      if (kind === "overlay-title") icon.dataset.feeOverlayPos = "title";
      target.append(icon);
      return;
    }

    if (kind === "buy") {
      const buyWrap =
        target.querySelector?.("[data-flap-buy-wrap='1']") || findBuyWrapInRow(target);
      if (buyWrap) {
        buyWrap.insertAdjacentElement("beforebegin", icon);
        return;
      }
    }

    if (kind === "short-leaf" || (kind === "short" && TARGET_SHORT_TOKEN_RE.test((target.textContent || "").trim()) && (target.textContent || "").trim().length <= 24)) {
      target.insertAdjacentElement("afterend", icon);
      return;
    }

    // metrics / token-stats / default: append to stable container
    let anchor = target;
    let parent = target.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1) {
      const style = window.getComputedStyle(parent);
      const overflowHidden =
        style.overflow === "hidden" ||
        style.overflowX === "hidden" ||
        style.overflowY === "hidden";
      const rect = parent.getBoundingClientRect();
      if (overflowHidden && rect.width > 0 && rect.width < 420 && kind !== "metrics" && kind !== "token-stats") {
        anchor = parent;
        parent = parent.parentElement;
        continue;
      }
      break;
    }
    anchor.append(icon);
  }

  function findBuyWrapInRow(row) {
    if (!(row instanceof HTMLElement)) return null;
    const marked = row.querySelector("[data-flap-buy-wrap='1']");
    if (marked) return marked;
    const kids = Array.from(row.children);
    for (let i = 0; i < kids.length; i += 1) {
      const kid = kids[i];
      if (kid.matches?.(`[${ICON_DATA}="1"]`)) continue;
      const tx = (kid.textContent || "").replace(/\s+/g, " ").trim();
      if (/^买\s*\d*$/u.test(tx) || /^Buy\s*\d*$/i.test(tx)) return kid;
      if (tx.length <= 10 && (/买\s*\d/.test(tx) || /Buy\s*\d/i.test(tx))) return kid;
    }
    return null;
  }

  function toKebab(value) {
    return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  }

  function debugInfo(event, payload) {
    if (!DEBUG_LOG) return;
    console.info(`${DEBUG_PREFIX} ${event} ${formatPayload(payload)}`);
  }

  function debugWarn(event, payload) {
    // Always log warns (pipeline stuck) but keep payload cheap.
    console.warn(`${DEBUG_PREFIX} ${event} ${formatPayload(payload)}`);
  }

  function debugError(event, payload) {
    console.error(`${DEBUG_PREFIX} ${event} ${formatPayload(payload)}`);
  }

  function formatPayload(payload) {
    try {
      return JSON.stringify(normalizePayload(payload));
    } catch {
      return String(payload);
    }
  }

  function normalizePayload(payload) {
    if (payload instanceof Error) return normalizeError(payload);
    if (Array.isArray(payload)) return payload.map(normalizePayload);
    if (payload && typeof payload === "object") {
      return Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, normalizePayload(value)])
      );
    }
    return payload;
  }

  function normalizeError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return {
      name: "NonError",
      message: String(error)
    };
  }

  function isCompleteCacheEntry(value) {
    return (
      value &&
      confirmedModes.has(value.mode) &&
      typeof value.label === "string" &&
      value.label &&
      typeof value.fetchedAt === "number"
    );
  }

  /** False after extension reload/update; old content scripts must stop using chrome.*. */
  function isExtensionContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function markPersistentCacheReady() {
    persistentCacheReady = true;
    persistentCacheReadyWaiters.splice(0).forEach((resolve) => resolve());
    // 0.5.8: after storage hydrate, force header paint + list scan (refresh often races cache).
    try {
      if (isGmgnHost() && isGmgnTokenPage()) {
        window.setTimeout(() => {
          if (!isExtensionContextValid() || !isTabVisible()) return;
          try {
            tryPaintGmgnTokenHeader("cache-ready");
          } catch (_err) {
            // ignore
          }
          scheduleScan(0, {
            force: true,
            immediate: false,
            light: false,
            bypassForceGap: true
          });
        }, 50);
      } else {
        scheduleScan(80, { force: false, immediate: false });
      }
    } catch (_err) {
      // ignore
    }
  }

  function hydratePersistentCache() {
    if (!isExtensionContextValid() || !chrome.storage?.local) {
      markPersistentCacheReady();
      return;
    }

    try {
      chrome.storage.local.get([PERSISTENT_CACHE_KEY], (items) => {
        // Reload extension while this tab is open → context dies; callback must no-op.
        if (!isExtensionContextValid() || chrome.runtime.lastError) {
          markPersistentCacheReady();
          return;
        }
        try {
          const entries = items?.[PERSISTENT_CACHE_KEY];
          if (entries && typeof entries === "object") {
            const now = Date.now();
            Object.entries(entries).forEach(([token, value]) => {
              if (!isCompleteCacheEntry(value)) return;
              if (now - value.fetchedAt > PERSISTENT_CACHE_TTL_MS) return;
              persistentCache.set(token, {
                mode: value.mode,
                label: value.label,
                title: value.title || modeMeta[value.mode]?.title || modeMeta.unknown.title,
                dividend_bps: Number(value.dividend_bps) || 0,
                market_bps: Number(value.market_bps) || 0,
                deflation_bps: Number(value.deflation_bps) || 0,
                lp_bps: Number(value.lp_bps) || 0,
                giggle_charity_bps: Number(value.giggle_charity_bps) || 0,
                binance_charity_bps: Number(value.binance_charity_bps) || 0,
                is_vault: Boolean(value.is_vault),
                buy_tax_bps: Number(value.buy_tax_bps) || 0,
                sell_tax_bps: Number(value.sell_tax_bps) || 0,
                top_segment: typeof value.top_segment === "string" ? value.top_segment : "unknown",
                top_payout_symbol:
                  typeof value.top_payout_symbol === "string" ? value.top_payout_symbol : "",
                dividend_symbol:
                  typeof value.dividend_symbol === "string" ? value.dividend_symbol : "",
                quote_symbol: typeof value.quote_symbol === "string" ? value.quote_symbol : "",
                quote_token: typeof value.quote_token === "string" ? value.quote_token.toLowerCase() : "",
                vault_address:
                  typeof value.vault_address === "string" ? value.vault_address : "",
                basket_assets: normalizeBasketAssets(value.basket_assets),
                fetched_at: Math.floor(value.fetchedAt / 1000)
              });
            });
            broadcastBasketAddrCache([...persistentCache.values()]);
          }
        } catch (error) {
          if (!String(error?.message || error).includes("Extension context invalidated")) {
            debugWarn("cache:hydrate-failed", normalizeError(error));
          }
        }
        markPersistentCacheReady();
      });
    } catch (error) {
      if (!String(error?.message || error).includes("Extension context invalidated")) {
        debugWarn("cache:hydrate-start-failed", normalizeError(error));
      }
      markPersistentCacheReady();
    }
  }

  function waitForPersistentCache() {
    if (persistentCacheReady) return Promise.resolve();
    return new Promise((resolve) => persistentCacheReadyWaiters.push(resolve));
  }

  function cacheAgeMs(entry) {
    if (typeof entry.fetchedAt === "number") return entry.fetchedAt;
    if (typeof entry.fetched_at === "number") return entry.fetched_at * 1000;
    return 0;
  }

  function isPersistentCacheHit(token) {
    const entry = persistentCache.get(token);
    if (!entry) return false;
    if (!confirmedModes.has(entry.mode) || !entry.label) {
      persistentCache.delete(token);
      return false;
    }
    const ageBase = cacheAgeMs(entry);
    if (!ageBase || Date.now() - ageBase > PERSISTENT_CACHE_TTL_MS) {
      persistentCache.delete(token);
      persistCacheSoon();
      return false;
    }
    return true;
  }

  function persistConfirmedModes(entries) {
    for (const [token, entry] of entries) {
      if (!confirmedModes.has(entry.mode) || !entry.label) continue;
      persistentCache.set(token, {
        mode: entry.mode,
        label: entry.label,
        title: entry.title,
        dividend_bps: entry.dividend_bps,
        market_bps: entry.market_bps,
        deflation_bps: entry.deflation_bps,
        lp_bps: entry.lp_bps,
        giggle_charity_bps: entry.giggle_charity_bps || 0,
        binance_charity_bps: entry.binance_charity_bps || 0,
        is_vault: entry.is_vault,
        buy_tax_bps: entry.buy_tax_bps,
        sell_tax_bps: entry.sell_tax_bps,
        top_segment: entry.top_segment || "unknown",
        top_payout_symbol: entry.top_payout_symbol || "",
        dividend_symbol: entry.dividend_symbol || "",
        quote_symbol: entry.quote_symbol || "",
        quote_token: entry.quote_token || "",
        vault_address: entry.vault_address || "",
        basket_assets: normalizeBasketAssets(entry.basket_assets),
        fetchedAt:
          typeof entry.fetched_at === "number" ? entry.fetched_at * 1000 : Date.now()
      });
    }
    persistCacheSoon();
  }

  let persistTimer = null;
  function persistCacheSoon() {
    if (persistTimer) return;
    const delay = Math.max(500, PERSIST_MIN_INTERVAL_MS - (Date.now() - lastPersistWallMs));
    persistTimer = window.setTimeout(async () => {
      persistTimer = null;
      await waitForPersistentCache();
      if (!isExtensionContextValid() || !chrome.storage?.local) return;

      const now = Date.now();
      if (now - lastPersistWallMs < PERSIST_MIN_INTERVAL_MS * 0.5) return;
      lastPersistWallMs = now;

      // LRU trim by fetchedAt before write.
      const rows = [];
      for (const [token, entry] of persistentCache.entries()) {
        if (!confirmedModes.has(entry.mode) || !entry.label) continue;
        const fetchedAt = cacheAgeMs(entry) || now;
        if (now - fetchedAt > PERSISTENT_CACHE_TTL_MS) {
          persistentCache.delete(token);
          continue;
        }
        rows.push({ token, entry, fetchedAt });
      }
      rows.sort((a, b) => b.fetchedAt - a.fetchedAt);
      while (rows.length > PERSISTENT_CACHE_MAX_ENTRIES) {
        const drop = rows.pop();
        if (drop) persistentCache.delete(drop.token);
      }

      const serialized = {};
      for (const { token, entry, fetchedAt } of rows) {
        serialized[token] = {
          mode: entry.mode,
          label: entry.label,
          title: entry.title,
          dividend_bps: entry.dividend_bps,
          market_bps: entry.market_bps,
          deflation_bps: entry.deflation_bps,
          lp_bps: entry.lp_bps,
          giggle_charity_bps: entry.giggle_charity_bps || 0,
          binance_charity_bps: entry.binance_charity_bps || 0,
          is_vault: entry.is_vault,
          buy_tax_bps: entry.buy_tax_bps,
          sell_tax_bps: entry.sell_tax_bps,
          top_segment: entry.top_segment || "unknown",
          top_payout_symbol: entry.top_payout_symbol || "",
          dividend_symbol: entry.dividend_symbol || "",
          quote_symbol: entry.quote_symbol || "",
          quote_token: entry.quote_token || "",
          vault_address: entry.vault_address || "",
          basket_assets: normalizeBasketAssets(entry.basket_assets),
          fetchedAt
        };
      }

      try {
        chrome.storage.local.set({ [PERSISTENT_CACHE_KEY]: serialized }, () => {
          void chrome.runtime?.lastError;
        });
      } catch {
        // Extension reloaded mid-flight.
      }
    }, delay);
  }

  // Observe documentElement (roots detach after SPA). Chart thrash is filtered below.
  // 0.4.41 GMGN: closer to 0.4.22 — no tryPaint/overlay storm on every mut.
  // 0.4.43 GMGN: records relevance + scroll cooldown (Debot path unchanged).
  const mutationObserver = new MutationObserver((records) => {
    // Before fixed GMGN surfaces mount, documentElement is discovery-only.
    // Do not run card, text, overlay, or layout probes for unrelated page churn.
    if (
      isGmgnHost() &&
      lastObserverRoots.length === 1 &&
      lastObserverRoots[0] === document.documentElement
    ) {
      if (gmgnDiscoveryMutationLooksRelevant(records)) {
        scheduleGmgnObserverRefresh(40);
      }
      return;
    }
    if (
      isDebotHost() &&
      lastObserverRoots.length === 1 &&
      lastObserverRoots[0] === document.documentElement
    ) {
      if (debotDiscoveryMutationLooksRelevant(records)) {
        scheduleDebotObserverRefresh(40);
      }
      return;
    }
    // These callbacks are generated in bulk while virtual lists recycle rows.
    // Exit before any route/context checks or layout reads on the scroll hot path.
    if (isGmgnScrollCooling() || isDebotScrollCooling()) return;
    if (isGmgnTrenchResizeCooling()) {
      gmgnTrenchResizeDirty = true;
      return;
    }
    if (!isTabVisible()) return;
    if (!isExtensionContextValid()) return;
    if (!isScanPageAllowed()) return;
    if (!tryFinishListReturnTransition("document-mutation")) return;

    // Header badges live inside React-owned rows. Repair only when the current address row
    // or an explicitly locked header badge was replaced; unrelated chart ticks are ignored.
    if (isGmgnTokenPage()) {
      const token = extractTokenFromUrl();
      if (
        token &&
        !hasGmgnTokenHeaderBadge() &&
        gmgnHeaderMutationLooksRelevant(records, token)
      ) {
        scheduleGmgnHeaderRepair("document-mutation");
        scheduleGmgnObserverRefresh(40);
      }
    } else if (isDebotTokenPage()) {
      const token = extractTokenFromUrl();
      if (
        token &&
        !hasDebotTokenHeaderBadge() &&
        debotHeaderMutationLooksRelevant(records, token)
      ) {
        scheduleDebotHeaderRepair("document-mutation");
      }
    }
    if (isGmgnTokenPage()) collectGmgnEmbeddedDirtyCards(records);
    // Debot header only (throttled). GMGN uses progressive/click-once — not every chart mut.
    if (isDebotTokenPage() && extractTokenFromUrl() && !hasDebotTokenHeaderBadge()) {
      const now = Date.now();
      if (now - debotHeaderMutPaintAt >= 400) {
        debotHeaderMutPaintAt = now;
        try {
          tryPaintDebotTokenHeader("mutation");
        } catch (_err) {
          // ignore
        }
      }
    }

    // During SPA rebuild: mark dirty only; progressive + quiet-end handle full paint.
    if (isSpaQuiet()) {
      spaDomDirty = true;
      return;
    }
    // 刷新首屏让宿主先画；首扫已按 GMGN_FIRST_SCAN_DELAY_MS 排队。
    if (
      isGmgnHost() &&
      !isTokenDetailRoute() &&
      Date.now() - hostListBootAt < GMGN_FIRST_SCAN_DELAY_MS
    ) {
      return;
    }
    if (
      isDebotHost() &&
      isTrenchListPage() &&
      Date.now() - hostListBootAt < DEBOT_FIRST_SCAN_DELAY_MS
    ) {
      return;
    }
    // 0.4.12: non-8888/7777 token page — chart noise must not schedule scans.
    if (isNonTargetTokenPage()) return;

    // 0.4.43 GMGN: while columns scroll, let host paint; resume timer fills badges after settle.
    // 0.4.44: do NOT block during list-return soft (K→战壕 needs mutation/DOM to fill holes).
    if (isGmgnScrollCooling() && !isOverlayFast() && !isSpaListReturnSoft()) {
      return;
    }
    if (isDebotScrollCooling() && !isOverlayFast() && !isSpaListReturnSoft()) {
      return;
    }

    // 0.4.43 GMGN: ignore pure ticker / unrelated node churn. New visible cards
    // take a direct bounded path and do not wait for the regular scan interval.
    if (isGmgnHost()) {
      if (!gmgnMutationLooksRelevant(records)) return;
      // K 线内嵌战壕与首页一样：新卡走独立快路径，不把插入交给 chart light-scan。
      if (collectGmgnNewCardMutations(records) > 0) return;
    }
    if (isDebotHost() && (isTrenchListPage() || isDebotTokenPage())) {
      if (collectDebotNewCardMutations(records) > 0) return;
      if (!debotMutationLooksRelevant(records)) return;
    } else if (isDebotHost() && !debotMutationLooksRelevant(records)) {
      return;
    }

    if (mutationDebounceTimer) return;

    // Overlay: only when already known open (cached) — avoid quickHasOpenOverlay every mut on GMGN home.
    const overlayNow = overlayDetectCache.at && Date.now() - overlayDetectCache.at < 250
      ? overlayDetectCache.open
      : quickHasOpenOverlay();
    if (overlayNow && !lastOverlayOpen) {
      lastOverlayOpen = true;
      if (isGmgnHost() || isDebotHost()) {
        scheduleGmgnOverlayPaint("mutation-open", 120, true);
      } else {
        armOverlayFastScan("mutation-open");
      }
      return;
    }
    if (!overlayNow && lastOverlayOpen) {
      lastOverlayOpen = false;
      overlayFastUntil = 0;
      try {
        clearSearchOverlayHidesIfAny();
      } catch (_clrOv) {
        // ignore
      }
      if (isGmgnHost() || isDebotHost()) {
        cancelGmgnOverlayPaint();
        if (isGmgnHost() && gmgnEmbeddedDirtyCards.size > 0) scheduleGmgnEmbeddedDirtyPass();
        if (isDebotHost()) {
          scanRootsCache = { at: 0, roots: [] };
          try {
            ensureDocumentObserver();
          } catch (_rebind) {
            // ignore
          }
        }
      }
    }

    if (overlayNow) {
      if (isGmgnHost() || isDebotHost()) {
        scheduleGmgnOverlayPaint("mutation-update", 180, false);
        return;
      }
      mutationDebounceTimer = window.setTimeout(() => {
        mutationDebounceTimer = null;
        if (!isTabVisible() || !isExtensionContextValid()) return;
        if (!quickHasOpenOverlay()) return;
        try {
          fastPaintOverlayFromCache();
        } catch (_err) {
          // ignore
        }
        scheduleScan(0, {
          force: true,
          light: true,
          immediate: true,
          bypassForceGap: true
        });
      }, MUTATION_SCAN_DEBOUNCE_HOME_OVERLAY_MS);
      return;
    }

    // Token settled: light scan. GMGN/Debot K 线图表 mutation 不扫；侧栏走 dirty/停滚补绘.
    if (isTokenPageSettledWithBadge()) {
      if (
        (isGmgnHost() && isGmgnTokenPage()) ||
        (isDebotHost() && isDebotTokenPage())
      ) {
        return;
      }
      const debounceMs = MUTATION_SCAN_DEBOUNCE_TOKEN_LIGHT_MS;
      mutationDebounceTimer = window.setTimeout(() => {
        mutationDebounceTimer = null;
        if (!isTabVisible() || !isExtensionContextValid()) return;
        if (isSpaQuiet() || isNonTargetTokenPage()) return;
        scheduleScan(0, { force: true, light: true, immediate: false });
      }, debounceMs);
      return;
    }

    // Unsettled / list: longer debounce on GMGN list thrash.
    const tokenUnsettled =
      (isDebotTokenPage() && extractTokenFromUrl() && !hasDebotTokenHeaderBadge()) ||
      (isGmgnTokenPage() && extractTokenFromUrl() && !hasGmgnTokenHeaderBadge());
    const debounceMs = tokenUnsettled
      ? 800
      : isTokenDetailRoute()
        ? MUTATION_SCAN_DEBOUNCE_TOKEN_LOADING_MS
        : isGmgnHost() || (isDebotHost() && isTrenchListPage())
          ? gmgnMutationDebounceMs()
          : MUTATION_SCAN_DEBOUNCE_MS;
    mutationDebounceTimer = window.setTimeout(() => {
      mutationDebounceTimer = null;
      if (!isTabVisible()) return;
      if (isSpaQuiet()) {
        spaDomDirty = true;
        return;
      }
      if (isNonTargetTokenPage()) return;
      // Scroll may have started during debounce window (list-return soft still runs).
      if (isGmgnScrollCooling() && !isOverlayFast() && !isSpaListReturnSoft()) return;
      if (isDebotScrollCooling() && !isOverlayFast() && !isSpaListReturnSoft()) return;
      if (isTokenPageSettledWithBadge()) {
        // 0.5.2: settled K-line still needs light/non-force scan so left 战壕 keeps badges
        // (was full skip on GMGN token → multi-panel left column starved).
        if (isGmgnHost() && isGmgnTokenPage()) {
          pendingLightScan = false;
          scheduleScan(0, { force: false, immediate: false, light: false });
          return;
        }
        scheduleScan(0, { force: true, light: true });
        return;
      }
      if (isDebotTokenPage()) {
        tryPaintDebotTokenHeader("mutation-scan");
        if (!hasDebotTokenHeaderBadge()) maybeScheduleDebotHeaderFullScan("mutation-scan");
        return;
      }
      if (isGmgnTokenPage()) {
        // 0.5.2: header paint + side 战壕 scan (was header-only return → left column never filled).
        tryPaintGmgnTokenHeader("mutation-scan");
        pendingLightScan = false;
        scheduleScan(0, { force: false, immediate: false, light: false });
        return;
      }
      // 0.4.42 / 0.4.22: GMGN list mutations use NON-force scan (SCAN_INTERVAL 900ms gate).
      // force:true every mut was continuous jank while virtual list thrash.
      pendingLightScan = false;
      if (isGmgnHost()) {
        scheduleScan(0, { force: false, immediate: false, light: false });
      } else {
        scheduleScan(0, { force: false, immediate: false, light: false });
      }
    }, debounceMs);
  });

  function rebindMutationObserver() {
    // 0.4.8: always documentElement — scoped roots detach after SPA and go silent.
    ensureDocumentObserver();
  }

  try {
    ensureDocumentObserver();
    // 0.4.42 / 0.8.63: delay root probe so first paint of host is not competing.
    if (!isGmgnHost() && !isDebotHost()) getScanRoots(true);
  } catch (_err) {
    ensureDocumentObserver();
  }

  // 0.4.5: do NOT full-scan on every scroll (was main jank vs 0.3.4).
  // Virtual-list hosts: passive scroll/wheel marks cooldown; one resume scan after settle.
  if (isGmgnHost()) {
    document.addEventListener("pointerdown", beginGmgnTrenchResize, true);
    document.addEventListener("mousedown", beginGmgnTrenchResize, true);
    window.addEventListener("pointerup", finishGmgnTrenchResize, true);
    window.addEventListener("pointercancel", finishGmgnTrenchResize, true);
    window.addEventListener("mouseup", finishGmgnTrenchResize, true);
    window.addEventListener("blur", finishGmgnTrenchResize, true);
  }

  if (isGmgnHost() || isDebotHost()) {
    const onListScroll = (event) => {
      try {
        if (isGmgnHost()) noteGmgnScrollActivity(event.target);
        else noteDebotScrollActivity(event.target);
      } catch (_err) {
        // ignore
      }
    };
    window.addEventListener("scroll", onListScroll, { passive: true, capture: true });
  }

  // GMGN search/tabs can mount outside the observed trench roots. Refresh the
  // fixed-surface registry on user interaction instead of keeping a document-wide
  // mutation observer alive for chart/ticker churn.
  if (isGmgnHost()) {
    document.addEventListener("click", () => scheduleGmgnObserverRefresh(60), true);
    document.addEventListener(
      "focusin",
      (event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          scheduleGmgnObserverRefresh(20);
        }
      },
      true
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "/" || (event.ctrlKey && event.key.toLowerCase() === "k")) {
          scheduleGmgnObserverRefresh(60);
        }
      },
      true
    );
  }

  window.addEventListener(
    "hashchange",
    () => {
      onSpaRouteChange("hashchange");
    },
    { passive: true }
  );
  window.addEventListener("popstate", () => {
    onSpaRouteChange("popstate");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenSinceMs = Date.now();
      return;
    }
    onTabResume("visibilitychange");
  });
  window.addEventListener("pageshow", (event) => {
    // bfcache restore or normal show
    if (document.visibilityState === "visible") {
      onTabResume(event.persisted ? "pageshow-bfcache" : "pageshow");
    }
  });
  // focus alone (popup / DevTools) must not remount — onTabResume short-circuits focus.
  window.addEventListener("focus", () => onTabResume("focus"));
  // Page Lifecycle API (Chrome): freeze/resume while backgrounded.
  document.addEventListener("freeze", () => {
    hiddenSinceMs = Date.now();
  });
  document.addEventListener("resume", () => {
    onTabResume("document-resume");
  });
  // Chromium: tab discarded for memory then restored — same as long background freeze.
  if ("wasDiscarded" in document && document.wasDiscarded) {
    hardResetPipeline("init-was-discarded");
  }

  // 0.5.8: GMGN token page — early header paint + scan (cache may land via markPersistentCacheReady).
  // Full-width/list still uses longer delay to avoid host hydration contention.
  if (isGmgnHost()) {
    if (isGmgnTokenPage()) {
      scheduleScan(200, { force: true, immediate: false });
      window.setTimeout(() => {
        try {
          tryPaintGmgnTokenHeader("boot-300");
        } catch (_err) {
          // ignore
        }
      }, 300);
      window.setTimeout(() => {
        try {
          tryPaintGmgnTokenHeader("boot-800");
        } catch (_err) {
          // ignore
        }
        scheduleScan(0, {
          force: true,
          immediate: false,
          light: false,
          bypassForceGap: true
        });
        try {
          paintUnpaintedTargetViewportQuick("boot-trench-800", null, true);
        } catch (_trench800) {
          // ignore
        }
      }, 800);
      [1400].forEach((ms) => {
        window.setTimeout(() => {
          if (!isExtensionContextValid() || !isTabVisible() || !isGmgnTokenPage()) return;
          try {
            paintUnpaintedTargetViewportQuick(`boot-trench-${ms}`, null, true);
          } catch (_bootTrench) {
            // ignore
          }
        }, ms);
      });
    } else {
      scheduleScan(GMGN_FIRST_SCAN_DELAY_MS, { force: false, immediate: false });
    }
  } else {
    scheduleScan(100, { force: true, immediate: true });
  }
})();
