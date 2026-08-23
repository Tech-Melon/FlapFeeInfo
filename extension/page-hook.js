/**
 * PAGE main world · document_start（早于页面脚本）
 *
 * 懒挂载（建议 A）：
 *   · 默认只装 SPA history 桥（对齐 0.5.25）
 *   · 仅 tax-recv / 自定义尾号屏蔽 enabled 时 installTaxRecvNetworkHooks()
 *     （XHR/fetch/WS/MessagePort/SharedWorker/JSON.parse）
 *   · 开屏蔽时 owned 写 gmgn disableShareWorker；关则清理
 * ★ 仅 BSC；禁止 DOM reflow / 乱包 dedicated Worker
 */
(() => {
  const HOOK_VER = 80;
  try {
    if (window.__flapFeeInfoPageHook !== HOOK_VER) {
      window.__flapFeeInfoPageHook = HOOK_VER;
      if (document.documentElement) {
        document.documentElement.setAttribute("data-flap-page-hook-ver", String(HOOK_VER));
      }
    }
  } catch (_bootMark) {
    // ignore — 继续安装钩子（重复注入时仍要补齐 host-fee）
  }
  /** 仅当列表过滤开启时，由插件临时写入，关闭时清理 */
  const OWNED_DISABLE_SW = "flapFeeInfo.ownedDisableShareWorker";
  const PREFS_ATTR = "data-flap-tax-recv";
  const LS_KEY = "flapFeeInfo.taxRecvHide.v1";
  const SUFFIX_ATTR = "data-flap-suffix-hide";
  const SUFFIX_LS_KEY = "flapFeeInfo.suffixHide.v1";
  const VAULT_HIDE_ATTR = "data-flap-vault-hide";
  const VAULT_HIDE_LS_KEY = "flapFeeInfo.vaultHide.v1";
  const SUFFIX_MAX_RULES = 24;
  /** 与 content.js 一致：Flap 8888/7777 + Four.meme ffff */
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777|ffff)$/i;
  /**
   * 新创建保留池（仅过滤开启时）：
   * - 宿主 API 常在 ~2 分钟后把币移出 new_creation；开屏蔽后 disableShareWorker，
   *   列表不再靠 SW 累积，币会「到点消失」。
   * - 本池记住已见过的非屏蔽行：最多保留 NC_KEEP_MAX_AGE_MS，展示上限 NC_KEEP_MAX_CARDS。
   * - 满卡时优先保留更新鲜的（按 lastSeen）；超时一律丢弃。不再无限垫 1h 旧币。
   */
  const NC_KEEP_MAX_AGE_MS = 10 * 60 * 1000;
  const NC_KEEP_MAX_CARDS = 40;
  /** GMGN 战壕「新创建」时间筛选（毫秒）；0 = 未检测到，用默认 10min */
  let gmgnNewCreationMaxAgeMs = 0;

  /**
   * @type {Map<string, { item: object, firstSeen: number, lastSeen: number, kind: string }>}
   */
  const ncKeepPool = new Map();

  const NativeWebSocket = window.WebSocket;
  const NativeSharedWorker = window.SharedWorker;
  const NativeMessagePortOnmessage = Object.getOwnPropertyDescriptor(
    MessagePort.prototype,
    "onmessage"
  );
  const NativeMessagePortAdd = MessagePort.prototype.addEventListener;
  const NativeMessagePortRm = MessagePort.prototype.removeEventListener;
  const NativeMessagePortStart = MessagePort.prototype.start;
  const NativeWebSocketOnmessage = Object.getOwnPropertyDescriptor(
    NativeWebSocket.prototype,
    "onmessage"
  );
  const NativeWebSocketAdd = NativeWebSocket.prototype.addEventListener;
  const NativeWebSocketRm = NativeWebSocket.prototype.removeEventListener;

  function shouldHookWsUrl(url) {
    const u = String(url || "");
    if (!u) return false;
    if (/latency|rtt|health|speed-test|sub-tx-hash|helius|rpc/i.test(u)) return false;
    if (/portal-ws/i.test(u) && /debot\.ai|gungnir/i.test(u)) return true;
    if (/sgws\.debot\.ai/i.test(u)) return true;
    if (/wss?:\/\//i.test(u) && (/ws\.gmgn\.ai/i.test(u) || /ws\.wenmoon\.cc/i.test(u))) {
      return true;
    }
    if (/wss?:\/\//i.test(u) && /gmgn\.ai/i.test(u)) return true;
    return false;
  }
  let taxRecvPrefs = { enabled: false, thresholdPct: 100 };
  let taxRecvEnabled = false;
  /** @type {{ enabled: boolean, rules: Array<{suffix:string, enabled:boolean}> }} */
  let suffixHidePrefs = { enabled: false, rules: [] };
  let suffixHideEnabled = false;
  /** @type {{ enabled: boolean, hideTaxVault: boolean, hideStockVault: boolean }} */
  let vaultHidePrefs = { enabled: false, hideTaxVault: false, hideStockVault: false };
  let vaultHideEnabled = false;

  let lastGmgnTrench = null;
  /** @type {string[]} */
  let lastDebotRanksUrls = [];

  function gmgnItemAgeMs(item) {
    if (!item || typeof item !== "object") return null;
    const raw =
      item.open_timestamp ??
      item.create_time ??
      item.created_at ??
      item.t ??
      item.f?.t ??
      item.f?.open_timestamp;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n < 1e12 ? n * 1000 : n;
    return Math.max(0, Date.now() - ms);
  }

  /**
   * 从 GMGN trenches_rank POST body 推断「新创建」最大币龄（与用户 UI 1m/3m 对齐）。
   * @returns {number|null} ms
   */
  function parseGmgnNewCreationMaxAgeMs(bodyRaw) {
    if (!bodyRaw) return null;
    try {
      const body = typeof bodyRaw === "string" ? JSON.parse(bodyRaw) : bodyRaw;
      if (!body || typeof body !== "object") return null;
      const directMin = Number(
        body.max_create_age_minutes ??
          body.create_age_minutes ??
          body.nc_age_minutes ??
          body.new_creation_age_minutes
      );
      if (Number.isFinite(directMin) && directMin > 0) {
        return Math.round(directMin * 60 * 1000);
      }
      const directSec = Number(
        body.max_create_age_sec ??
          body.max_age_sec ??
          body.age_sec ??
          body.max_open_age ??
          body.open_age
      );
      if (Number.isFinite(directSec) && directSec > 0) {
        return Math.round(directSec * 1000);
      }
      const minTs = Number(
        body.open_timestamp_from ??
          body.min_open_timestamp ??
          body.open_timestamp_gte ??
          body.from_open_timestamp
      );
      if (Number.isFinite(minTs) && minTs > 0) {
        const ms = minTs < 1e12 ? minTs * 1000 : minTs;
        return Math.max(60 * 1000, Date.now() - ms);
      }
      const filters = []
        .concat(body.filters, body.filter, body.new_creation_filters)
        .flat()
        .filter(Boolean);
      for (let i = 0; i < filters.length; i++) {
        const s = String(filters[i]).toLowerCase();
        let m = s.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
        if (m) return Number(m[1]) * 60 * 1000;
        m = s.match(/(\d+)\s*s(?:ec(?:onds?)?)?/);
        if (m) return Number(m[1]) * 1000;
        if (s === "1m" || s.includes("created_1m") || s.includes("1_min")) {
          return 60 * 1000;
        }
        if (s.includes("3m") || s.includes("3_min")) return 3 * 60 * 1000;
        if (s.includes("5m") || s.includes("5_min")) return 5 * 60 * 1000;
      }
      const dur = body.duration || body.new_creation_duration || body.age_filter;
      if (dur && typeof dur === "object") {
        const mins = Number(dur.minutes ?? dur.min ?? dur.m);
        if (Number.isFinite(mins) && mins > 0) return mins * 60 * 1000;
        const sec = Number(dur.seconds ?? dur.sec ?? dur.s);
        if (Number.isFinite(sec) && sec > 0) return sec * 1000;
      }
    } catch (_e) {
      return null;
    }
    return null;
  }

  function rememberGmgnTrenchRequest(bodyRaw) {
    const cap = parseGmgnNewCreationMaxAgeMs(bodyRaw);
    if (cap != null && cap > 0) {
      gmgnNewCreationMaxAgeMs = cap;
      try {
        window.__flapFeeGmgnNcAgeMs = cap;
      } catch (_w) {
        // ignore
      }
    }
  }

  /** 保留池有效时长：min(插件 10min, GMGN 用户时间筛选) */
  function getNcKeepMaxAgeMs() {
    if (gmgnNewCreationMaxAgeMs > 0) {
      return Math.min(NC_KEEP_MAX_AGE_MS, gmgnNewCreationMaxAgeMs);
    }
    return NC_KEEP_MAX_AGE_MS;
  }

  function itemWithinNcKeepAge(item) {
    const maxAge = getNcKeepMaxAgeMs();
    const age = gmgnItemAgeMs(item);
    if (age == null) return true;
    return age <= maxAge;
  }

  // ---------- prefs ----------
  function clampTaxRecvThreshold(raw) {
    const thr = Number(raw);
    if (!Number.isFinite(thr)) return 100;
    return Math.max(0, Math.min(100, Math.round(thr)));
  }

  /** 阈值 0 = 严格 >0%（有 dev 份额就挡）；>0 的阈值仍按 ≥ 比较。 */
  function exceedsTaxRecvThreshold(pct, thr) {
    if (!Number.isFinite(pct) || pct <= 0) return false;
    const t = Number(thr);
    const threshold = Number.isFinite(t) ? t : 100;
    if (threshold <= 0) return true;
    return pct + 1e-9 >= threshold;
  }

  function applyPrefsObject(p) {
    if (!p || typeof p !== "object") return;
    taxRecvPrefs = {
      enabled: p.enabled === true,
      thresholdPct: clampTaxRecvThreshold(p.thresholdPct)
    };
    taxRecvEnabled = taxRecvPrefs.enabled === true;
  }

  function applySuffixHideObject(p) {
    const out = { enabled: false, rules: [] };
    if (!p || typeof p !== "object") {
      suffixHidePrefs = out;
      suffixHideEnabled = false;
      return;
    }
    out.enabled = p.enabled === true;
    const list = Array.isArray(p.rules) ? p.rules : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.rules.length < SUFFIX_MAX_RULES; i++) {
      const raw = list[i];
      let suffix = String(raw?.suffix || "")
        .trim()
        .toLowerCase()
        .replace(/^0x/, "")
        .replace(/[^a-f0-9]/g, "")
        .slice(0, 12);
      if (!suffix || seen.has(suffix)) continue;
      seen.add(suffix);
      out.rules.push({
        suffix,
        enabled: raw?.enabled !== false
      });
    }
    suffixHidePrefs = out;
    suffixHideEnabled =
      out.enabled === true && out.rules.some((r) => r && r.enabled !== false && r.suffix);
  }

  function readPrefsSync() {
    try {
      let raw =
        (document.documentElement && document.documentElement.getAttribute(PREFS_ATTR)) ||
        "";
      if (!raw) {
        try {
          raw = localStorage.getItem(LS_KEY) || "";
        } catch (_ls) {
          raw = "";
        }
      }
      if (raw) applyPrefsObject(JSON.parse(raw));
    } catch (_e) {
      // ignore
    }
    try {
      let sraw =
        (document.documentElement && document.documentElement.getAttribute(SUFFIX_ATTR)) ||
        "";
      if (!sraw) {
        try {
          sraw = localStorage.getItem(SUFFIX_LS_KEY) || "";
        } catch (_ls2) {
          sraw = "";
        }
      }
      if (sraw) applySuffixHideObject(JSON.parse(sraw));
    } catch (_e2) {
      // ignore
    }
    try {
      let vraw =
        (document.documentElement && document.documentElement.getAttribute(VAULT_HIDE_ATTR)) ||
        "";
      if (!vraw) {
        try {
          vraw = localStorage.getItem(VAULT_HIDE_LS_KEY) || "";
        } catch (_ls3) {
          vraw = "";
        }
      }
      if (vraw) applyVaultHideObject(JSON.parse(vraw));
    } catch (_e3) {
      // ignore
    }
  }

  let lastAttrSyncAt = 0;

  /**
   * 仅 BSC 过滤列表/WS.
   * - GMGN: ?chain=bsc | /bsc/token/…
   * - Debot 双站 debot.ai / gungnir.bot: /meme?chain=bsc | /token/bsc/…
   * - robinhood / sol 等：完全不碰
   */
  function isBscPageContext() {
    try {
      const u = new URL(location.href);
      const q = String(u.searchParams.get("chain") || "").toLowerCase();
      // Debot 战壕主入口 /meme?chain=bsc（双站同 query）
      if (q === "bsc") return true;
      if (q) return false;
      const path = String(u.pathname || "");
      // GMGN K 线
      if (/^\/bsc(\/|$)/i.test(path) || /\/bsc\/token\//i.test(path)) return true;
      // Debot/Gungnir K 线 /token/bsc/…
      if (/\/token\/bsc(?:\/|$)/i.test(path)) return true;
      if (/\/token\/[a-z0-9_-]+(?:\/|$)/i.test(path) && !/\/token\/bsc(?:\/|$)/i.test(path)) {
        return false;
      }
      const host = String(u.hostname || "").toLowerCase();
      // GMGN 战壕首页无 ?chain= 时默认 BSC（与 content 扫卡一致；显式他链已由 q 拦截）
      if (host === "gmgn.ai" || host.endsWith(".gmgn.ai")) {
        if (path === "/" || path === "" || /^\/meme/i.test(path)) return true;
      }
      // Debot/Gungnir 战壕 /meme 无 chain 时默认 BSC
      if (host.endsWith("debot.ai") || host.endsWith("gungnir.bot")) {
        if (path === "/" || path === "" || /^\/meme/i.test(path)) return true;
      }
      return false;
    } catch (_e) {
      return false;
    }
  }

  function applyVaultHideObject(p) {
    vaultHidePrefs = {
      enabled: p?.enabled === true,
      hideTaxVault: p?.hideTaxVault === true,
      hideStockVault: p?.hideStockVault === true
    };
    vaultHideEnabled = vaultHidePrefs.enabled === true;
  }

  /** 任一侧列表过滤开启（资金接收 / 金库 / 自定义尾号） */
  function anyFilterEnabled() {
    return taxRecvEnabled || vaultHideEnabled || suffixHideEnabled;
  }

  function prefsOn() {
    if (!isBscPageContext()) return false;
    if (anyFilterEnabled()) return true;
    const now = Date.now();
    if (now - lastAttrSyncAt >= 80) {
      lastAttrSyncAt = now;
      readPrefsSync();
    }
    return anyFilterEnabled();
  }

  /** 地址是否命中自定义尾号屏蔽（调用方保证 BSC + enabled） */
  function shouldHideByCustomSuffix(addr) {
    if (!suffixHideEnabled) return false;
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    if (!a.startsWith("0x") || a.length < 6) return false;
    const rules = suffixHidePrefs.rules || [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (!r || r.enabled === false) continue;
      const s = String(r.suffix || "").toLowerCase();
      if (s && a.endsWith(s)) return true;
    }
    return false;
  }

  /** 最近误杀排查用：最多保留 40 条被滤地址 + s_tal 摘要 */
  const lastRemovedRing = [];
  function noteRemovedSample(addr, tal, channel) {
    try {
      const a = String(addr || "").toLowerCase();
      if (!a) return;
      const s =
        tal && typeof tal === "object"
          ? {
              m: tal.marketing,
              d: tal.dividend,
              v: tal.is_vault,
              ma: Boolean(tal.market_address)
            }
          : null;
      lastRemovedRing.push({ a: a.slice(-12), s, ch: channel || "", t: Date.now() });
      if (lastRemovedRing.length > 40) lastRemovedRing.shift();
      window.__flapFeeLastRemoved = lastRemovedRing.slice(-12);
    } catch (_e) {
      // ignore
    }
  }

  function noteFilter(meta) {
    try {
      window.__flapFeeLastFilter = { ...meta, t: Date.now() };
    } catch (_e) {
      // ignore
    }
  }

  // ---------- token rules ----------
  function sameAddr(a, b) {
    const x = String(a || "")
      .trim()
      .toLowerCase();
    const y = String(b || "")
      .trim()
      .toLowerCase();
    return Boolean(x && y && x.length >= 10 && x === y);
  }

  function mktToPct(m) {
    if (m == null || m === "") return null;
    const n = Number(m);
    if (!Number.isFinite(n)) return null;
    // GMGN: marketing 1 = 100%, 0.5 = 50%；也兼容 100 / 50 百分数
    const pct = n > 1.0001 ? n : n * 100;
    if (pct >= 99.9) return 100;
    return pct;
  }

  /**
   * 取税分配对象。
   * HTTP trenches_rank: token.s_tal
   * WSS trenches_delta: data.t[i] = { c, a, f: { s_tal, ... } }
   */
  function gmgnTal(item) {
    if (!item || typeof item !== "object") return null;
    if (item.s_tal && typeof item.s_tal === "object") return item.s_tal;
    if (item.tax_allocation && typeof item.tax_allocation === "object") {
      return item.tax_allocation;
    }
    const f = item.f;
    if (f && typeof f === "object") {
      if (f.s_tal && typeof f.s_tal === "object") return f.s_tal;
      if (f.tax_allocation && typeof f.tax_allocation === "object") {
        return f.tax_allocation;
      }
    }
    return null;
  }

  function gmgnAddr(item) {
    if (!item || typeof item !== "object") return "";
    const a = item.a || item.address;
    if (a) return String(a).toLowerCase();
    const f = item.f;
    if (f && typeof f === "object") {
      const fa = f.a || f.address;
      if (fa) return String(fa).toLowerCase();
    }
    return "";
  }

  function isTargetTaxTokenAddr(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    return TARGET_TOKEN_RE.test(a);
  }

  function isGmgnTokenItem(item) {
    if (!item || typeof item !== "object") return false;
    const addr = gmgnAddr(item);
    // 非 7777/8888：不当作可过滤 token（避免误删其它 CA）
    if (!isTargetTaxTokenAddr(addr)) return false;
    return Boolean(gmgnTal(item));
  }

  function isDebotTokenItem(item) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.contract !== "string" ||
      !item.meta ||
      typeof item.meta !== "object" ||
      !item.meta.launchpad_extra ||
      typeof item.meta.launchpad_extra !== "object"
    ) {
      return false;
    }
    return isTargetTaxTokenAddr(item.contract);
  }

  /**
   * 金库 / vault 真值（GMGN 可能给 true/1/"true"）。
   * 金库 gift（币股篮子等）永远不进「资金接收方」屏蔽。
   */
  function isGmgnVaultTal(tal) {
    if (!tal || typeof tal !== "object") return false;
    const v = tal.is_vault;
    if (v === true || v === 1 || v === "1" || v === "true" || v === "True") {
      return true;
    }
    if (
      tal.is_stocks_vault === true ||
      tal.is_stocks_vault === 1 ||
      tal.is_stocks_vault === "true"
    ) {
      return true;
    }
    return false;
  }

  function gmgnHasBasketTokens(tal) {
    return coerceDividendTokenList(tal?.dividend_tokens).length > 0;
  }

  function gmgnLaunchpadFamily(item) {
    const raw =
      item?.launchpad_platform ||
      item?.launchpad ||
      item?.launchpad_platform_name ||
      item?.f?.launchpad_platform ||
      item?.f?.launchpad ||
      item?.f?.launchpad_platform_name ||
      "";
    return String(raw || "").toLowerCase();
  }

  function gmgnIsFlapStocksLaunchpad(item) {
    const lp = gmgnLaunchpadFamily(item);
    return lp.includes("flap_stock") || lp.includes("flap_stocks");
  }

  /**
   * GMGN s_tal 金库分型：stock=币股篮子金库；tax=税收金库（纯 🎁 vault）。
   * Four ffff 的 marketing+market_address 是「税收钱包」，不是 is_vault 金库 → 返回 null。
   */
  function gmgnVaultKind(tal, item) {
    if (!tal || typeof tal !== "object") return null;
    if (gmgnHasBasketTokens(tal) || tal.is_stocks_vault === true) return "stock";
    if (gmgnIsFlapStocksLaunchpad(item)) return "stock";
    if (isGmgnVaultTal(tal)) return "tax";
    const lp = gmgnLaunchpadFamily(item);
    if (!lp.includes("flap")) return null;
    const mkt = mktToPct(tal.marketing);
    const div = mktToPct(tal.dividend);
    if (
      mkt != null &&
      mkt > 0 &&
      (div == null || div <= 0) &&
      tal.market_address &&
      !gmgnHasBasketTokens(tal)
    ) {
      return "tax";
    }
    return null;
  }

  function debotVaultKind(extra) {
    if (!extra || typeof extra !== "object") return null;
    if (extra.is_stocks_vault === true) return "stock";
    const basket = extra.basket_assets || extra.rwa_assets || extra.stock_assets;
    if (Array.isArray(basket) && basket.length > 0) return "stock";
    if (extra.is_vault === true) return "tax";
    const founder = extra.founder_address || extra.fee_receiver;
    const vault = extra.vault_address;
    if (founder && vault && sameAddr(founder, vault)) return "tax";
    return null;
  }

  function shouldHideVaultKind(kind) {
    if (!vaultHideEnabled || !kind) return false;
    if (kind === "stock") return vaultHidePrefs.hideStockVault === true;
    if (kind === "tax") return vaultHidePrefs.hideTaxVault === true;
    return false;
  }

  // ---------- host fee fast-path (GMGN s_tal / Debot launchpad_extra) ----------
  /** @type {Map<string, object>} */
  const hostFeeDedupe = new Map();
  /** @type {object[]} */
  let hostFeePending = [];
  let hostFeeFlushTimer = 0;
  const HOST_FEE_DEDUPE_MS = 8000;
  const SECURITY_BASKET_FETCH_GAP_MS = 45000;
  const securityBasketInflight = new Set();
  const securityBasketLastAt = new Map();

  function ratioToBps(v) {
    if (v == null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const pct = n > 1.0001 ? n : n * 100;
    return Math.round(Math.min(100, pct) * 100);
  }

  function pickTalField(tal, keys) {
    if (!tal || typeof tal !== "object") return null;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (tal[k] != null && tal[k] !== "") return tal[k];
    }
    return null;
  }

  /** WBNB / 零地址等常见分红代币 → 展示符号 */
  function symbolFromKnownTokenAddress(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    if (!a) return "";
    if (
      a === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" ||
      a === "0x0000000000000000000000000000000000000000"
    ) {
      return "BNB";
    }
    return "";
  }

  /** Flap 币股 vault 常见篮子成分（GMGN/Debot 列表常只给 address） */
  const KNOWN_VAULT_STOCK_SYMBOL_BY_ADDR = {
    "0x02fca66c1d1afb4e2a7884261eb00f63598a7436": "FXION",
    "0x9b8e987e6fec8cf1380c4dca7071e2c7853aeea1": "NVDAB"
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
    return raw.length > 6 ? raw.slice(0, 6) : raw;
  }

  function basketSymbolsReady(assets) {
    if (!Array.isArray(assets) || !assets.length) return false;
    if (assets.length < 2) return Boolean(assets[0]?.symbol);
    const syms = assets.map((a) => compactBasketSymbol(a?.symbol || "")).filter(Boolean);
    if (syms.length < 2) return false;
    return syms[0] !== syms[1];
  }

  function hostFeeBasketNeedsHydration(basket_assets, isStockVault) {
    if (!isStockVault) return false;
    if (!Array.isArray(basket_assets) || !basket_assets.length) return true;
    return !basketSymbolsReady(basket_assets);
  }

  function symbolFromKnownStockAddress(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    return KNOWN_VAULT_STOCK_SYMBOL_BY_ADDR[a] || "";
  }

  /** GMGN dividend_tokens 可能是数组，也可能是 { address: token } 映射 */
  function coerceDividendTokenList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") {
      const vals = Object.values(raw);
      if (vals.length && typeof vals[0] === "object") return vals;
    }
    return [];
  }

  function gmgnResolveQuoteSymbol(item, tal) {
    const candidates = [
      item?.quote_symbol,
      item?.quote,
      item?.q,
      item?.f?.quote_symbol,
      item?.f?.quote,
      item?.f?.q,
      tal?.quote_symbol,
      tal?.quote
    ];
    for (let i = 0; i < candidates.length; i++) {
      const s = String(candidates[i] || "").trim();
      if (s) return s;
    }
    return "";
  }

  function gmgnResolveDividendSymbol(item, tal, basket_assets) {
    if (basket_assets && basket_assets.length >= 2) return "";
    if (basket_assets && basket_assets[0]?.symbol) return basket_assets[0].symbol;
    const fromTal = String(
      tal?.dividend_symbol || tal?.dividend_token_symbol || tal?.ds || ""
    ).trim();
    if (fromTal) return fromTal;
    const dt = tal?.dividend_token;
    if (dt && typeof dt === "object") {
      const sym = String(dt.symbol || dt.name || dt.ticker || "").trim();
      if (sym) return sym;
    }
    const f = item?.f;
    if (f && typeof f === "object") {
      const fs = String(
        f.dividend_symbol || f.dividend_token_symbol || f.ds || ""
      ).trim();
      if (fs) return fs;
      const fdt = f.dividend_token;
      if (fdt && typeof fdt === "object") {
        const sym = String(fdt.symbol || fdt.name || fdt.ticker || "").trim();
        if (sym) return sym;
      }
    }
    const dts = coerceDividendTokenList(tal?.dividend_tokens);
    if (dts.length) {
      for (let i = 0; i < dts.length; i++) {
        const sym = symbolFromKnownTokenAddress(dts[i]?.address || dts[i]?.token);
        if (sym) return sym;
      }
    }
    const dtAddr =
      typeof tal?.dividend_token === "string"
        ? tal.dividend_token
        : tal?.dividend_token?.address;
    const known = symbolFromKnownTokenAddress(dtAddr);
    if (known) return known;
    return "";
  }

  function hostFeeUrlLooksUseful(url) {
    const u = String(url || "");
    if (!u) return false;
    return (
      u.includes("trenches_rank") ||
      /meme\/v\d+\/ranks/i.test(u) ||
      u.includes("mutil_window_token_security_launchpad") ||
      u.includes("token_info_brief")
    );
  }

  function gmgnIsFourmeme(item, tal) {
    const lp = gmgnLaunchpadFamily(item);
    if (lp.includes("fourmeme") || lp.includes("four_meme") || lp === "four") return true;
    const addr = gmgnAddr(item);
    return /ffff$/i.test(addr);
  }

  /** Four ffff：marketing+market_address 是税收钱包，不是 👨‍🍳 创作者 */
  function gmgnIsFourTaxWallet(tal, item) {
    if (!tal || typeof tal !== "object") return false;
    if (!gmgnIsFourmeme(item, tal)) return false;
    const mkt = mktToPct(tal.marketing);
    return mkt != null && mkt > 0;
  }

  function normalizeGmgnBasket(tokens) {
    const list = coerceDividendTokenList(tokens);
    const out = [];
    const multi = list.length > 1;
    for (let i = 0; i < list.length && out.length < 12; i++) {
      const t = list[i];
      if (!t || typeof t !== "object") continue;
      const address = String(t.address || t.token || "").toLowerCase();
      let sym = String(t.symbol || t.name || t.ticker || "").trim();
      if (!sym && address) {
        if (!multi) sym = symbolFromKnownStockAddress(address);
      }
      if (!sym) continue;
      out.push({
        address,
        symbol: sym.slice(0, 16),
        name: String(t.name || sym).trim().slice(0, 32)
      });
    }
    return out;
  }

  function normalizeDebotBasket(extra) {
    if (!extra || typeof extra !== "object") return [];
    let raw =
      extra.basket_assets || extra.rwa_assets || extra.stock_assets || extra.basket || [];
    if ((!Array.isArray(raw) || raw.length === 0) && Array.isArray(extra.vault_tokens)) {
      raw = extra.vault_tokens.map((addr, idx) => ({
        address: addr,
        share: Array.isArray(extra.vault_shares) ? extra.vault_shares[idx] : undefined
      }));
    }
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length && out.length < 12; i++) {
      const t = raw[i];
      if (!t || typeof t !== "object") continue;
      const address = String(t.address || t.token || "").toLowerCase();
      let sym = String(t.symbol || t.name || t.ticker || "").trim();
      const multi = raw.length > 1;
      if (!sym && address && !multi) sym = symbolFromKnownStockAddress(address);
      if (!sym) continue;
      out.push({
        address,
        symbol: sym.slice(0, 16),
        name: String(t.name || sym).trim().slice(0, 32)
      });
    }
    return out;
  }

  function stockSymbolsFromTaxDom(el, source) {
    if (!(el instanceof HTMLElement)) return [];
    const syms = [];
    const seen = new Set();
    const pushSym = (raw) => {
      const sym = compactBasketSymbol(raw);
      if (!sym || sym === "BNB" || seen.has(sym)) return;
      seen.add(sym);
      syms.push(sym);
    };
    if (source === "debot") {
      el.querySelectorAll(
        'img[src*="/images/share/bstocks/"], img[src*="/images/chain/designer-icons/coin/"]'
      ).forEach((img) => {
        const src = img.currentSrc || img.getAttribute("src") || "";
        const fromPath = src.match(/\/(?:bstocks|coin)\/([^./?#]+)/i);
        if (fromPath) pushSym(fromPath[1]);
        else pushSym(img.getAttribute("alt") || "");
      });
      return syms;
    }
    const tax = el.querySelector(".trenches-tax");
    if (!tax) return syms;
    tax.querySelectorAll('img[src*="/quotes/"], img[src*="/static/quotes/"]').forEach((img) => {
      const src = img.currentSrc || img.getAttribute("src") || "";
      const m = src.match(/\/quotes\/([^./?#]+)/i);
      if (m) pushSym(m[1]);
    });
    return syms;
  }

  function isSingleAssetStockVault(entry) {
    if (!entry || !entry.is_vault) return false;
    const stockish =
      entry.is_stocks_vault === true ||
      (Array.isArray(entry.basket_assets) && entry.basket_assets.length >= 1);
    if (!stockish) return false;
    return (Number(entry.market_bps) || 0) >= 10000 && (Number(entry.dividend_bps) || 0) === 0;
  }

  function hydrateHostFeeBasket(entry, scopeEl, source) {
    if (!entry || !entry.is_vault) return entry;
    const assets = Array.isArray(entry.basket_assets) ? entry.basket_assets : [];
    if (
      isSingleAssetStockVault(entry) &&
      assets.length === 1 &&
      compactBasketSymbol(assets[0]?.symbol || "")
    ) {
      return entry;
    }
    const domSyms = stockSymbolsFromTaxDom(scopeEl, source)
      .map((s) => compactBasketSymbol(s))
      .filter(Boolean);
    if (!domSyms.length) {
      // 无 DOM 时仍可用已知地址补符号
      let changed = false;
      const next = assets.map((row) => {
        if (!row || typeof row !== "object" || row.symbol) return row;
        const fromAddr = symbolFromKnownStockAddress(row.address);
        if (!fromAddr) return row;
        changed = true;
        const sym = compactBasketSymbol(fromAddr);
        return { ...row, symbol: sym, name: row.name || sym };
      });
      if (!changed) return entry;
      const out = { ...entry, basket_assets: next };
      if (out.__needsChain && basketSymbolsReady(next)) out.__needsChain = false;
      return out;
    }
    const usedAddr = new Set();
    const usedSym = new Set();
    const next = [];
    for (const sym of domSyms) {
      if (usedSym.has(sym)) continue;
      usedSym.add(sym);
      const matched =
        assets.find(
          (a) =>
            a &&
            compactBasketSymbol(a.symbol) === sym &&
            !usedAddr.has(String(a.address || ""))
        ) ||
        assets.find((a) => a && a.address && !usedAddr.has(a.address) && !a.symbol) ||
        null;
      if (matched?.address) usedAddr.add(matched.address);
      next.push({
        address: matched?.address || "",
        symbol: sym,
        name: matched?.name || sym
      });
    }
    for (const row of assets) {
      if (isSingleAssetStockVault(entry) && domSyms.length === 1) break;
      if (!row || typeof row !== "object") continue;
      const sym = compactBasketSymbol(row.symbol);
      if (sym && usedSym.has(sym)) continue;
      if (row.address && usedAddr.has(row.address)) continue;
      if (row.address) usedAddr.add(row.address);
      if (sym) usedSym.add(sym);
      next.push({
        ...row,
        symbol: sym || compactBasketSymbol(symbolFromKnownStockAddress(row.address)) || row.symbol || ""
      });
    }
    const out = {
      ...entry,
      basket_assets: next,
      is_stocks_vault: entry.is_stocks_vault === true || next.length >= 1
    };
    if (out.__needsChain && basketSymbolsReady(next)) out.__needsChain = false;
    return out;
  }

  function finalizeHostFeeEntry(entry) {
    if (!entry) return entry;
    const isStockVault =
      entry.is_stocks_vault === true ||
      (Array.isArray(entry.basket_assets) && entry.basket_assets.length >= 1);
    if (hostFeeBasketNeedsHydration(entry.basket_assets, isStockVault)) {
      entry.__needsChain = true;
    } else if (isStockVault && basketSymbolsReady(entry.basket_assets)) {
      entry.__needsChain = false;
    }
    return entry;
  }

  function gmgnSecurityTaxBps(item) {
    const sec =
      (item && item.security) ||
      (item && item.s) ||
      (item && item.f && item.f.security) ||
      (item && item.f && item.f.s) ||
      null;
    if (!sec || typeof sec !== "object") return { buy: 0, sell: 0 };
    return {
      buy: ratioToBps(sec.buy_tax ?? sec.buy_tax_rate ?? sec.buyTax),
      sell: ratioToBps(sec.sell_tax ?? sec.sell_tax_rate ?? sec.sellTax)
    };
  }

  function gmgnChainKey() {
    const path = String(location.pathname || "");
    const m = path.match(/\/(bsc|eth|base|sol|tron)(?:\/|$)/i);
    return m ? m[1].toLowerCase() : "bsc";
  }

  function maybeScheduleSecurityBasketFetch(entry) {
    if (!entry || entry.source !== "gmgn") return;
    const n = Array.isArray(entry.basket_assets) ? entry.basket_assets.length : 0;
    if (n < 2 || n > 4) return;
    if (!entry.is_stocks_vault && n < 2) return;
    if ((Number(entry.market_bps) || 0) < 9000) return;
    scheduleSecurityBasketFetch(entry.address);
  }

  function scheduleSecurityBasketFetch(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    if (!TARGET_TOKEN_RE.test(a) || securityBasketInflight.has(a)) return;
    const last = securityBasketLastAt.get(a) || 0;
    if (Date.now() - last < SECURITY_BASKET_FETCH_GAP_MS) return;
    securityBasketInflight.add(a);
    window.setTimeout(() => {
      void fetchGmgnSecurityBasket(a).finally(() => {
        securityBasketInflight.delete(a);
      });
    }, 0);
  }

  async function fetchGmgnSecurityBasket(addr) {
    const a = String(addr || "")
      .trim()
      .toLowerCase();
    if (!TARGET_TOKEN_RE.test(a)) return;
    const url = `https://gmgn.ai/api/v1/mutil_window_token_security_launchpad?chain=${encodeURIComponent(
      gmgnChainKey()
    )}&address=${encodeURIComponent(a)}`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      const lp = json?.data?.launchpad;
      const sec = json?.data?.security || json?.data?.token?.security;
      const tal = sec?.tax_allocation || sec?.s_tal;
      if (!tal || typeof tal !== "object") return;
      collectHostFeesFromGmgnItem({
        a,
        s_tal: tal,
        security: sec,
        launchpad: lp?.launchpad,
        launchpad_platform: lp?.launchpad_platform,
        f: {
          launchpad: lp?.launchpad,
          launchpad_platform: lp?.launchpad_platform
        }
      });
      securityBasketLastAt.set(a, Date.now());
    } catch (_sec) {
      // ignore
    }
  }

  function hostFeeSig(entry) {
    if (!entry) return "";
    return [
      entry.dividend_bps || 0,
      entry.market_bps || 0,
      entry.deflation_bps || 0,
      entry.lp_bps || 0,
      entry.giggle_charity_bps || 0,
      entry.binance_charity_bps || 0,
      entry.is_vault ? 1 : 0,
      entry.buy_tax_bps || 0,
      entry.sell_tax_bps || 0,
      (entry.basket_assets || []).map((b) => b.symbol).join("+")
    ].join("|");
  }

  function flushHostFeePendingNow() {
    if (hostFeeFlushTimer) {
      window.clearTimeout(hostFeeFlushTimer);
      hostFeeFlushTimer = 0;
    }
    while (hostFeePending.length > 0) {
      const batch = hostFeePending.splice(0, 48);
      if (!batch.length) break;
      try {
        window.postMessage(
          { source: "flap-fee-info", type: "host-fee-map", entries: batch },
          "*"
        );
      } catch (_pm) {
        // ignore
      }
    }
  }

  function queueHostFeeEntry(entry) {
    if (!entry || !entry.address || !TARGET_TOKEN_RE.test(entry.address)) return;
    const addr = String(entry.address).toLowerCase();
    const sig = hostFeeSig(entry);
    const prev = hostFeeDedupe.get(addr);
    const now = Date.now();
    if (prev && prev.sig === sig && now - prev.at < HOST_FEE_DEDUPE_MS) return;
    hostFeeDedupe.set(addr, { sig, at: now });
    hostFeePending.push(entry);
    maybeScheduleSecurityBasketFetch(entry);
    if (hostFeeFlushTimer) return;
    hostFeeFlushTimer = window.setTimeout(() => {
      hostFeeFlushTimer = 0;
      flushHostFeePendingNow();
    }, 0);
  }

  function gmgnHostFeeFromItem(item) {
    const addr = gmgnAddr(item);
    if (!TARGET_TOKEN_RE.test(addr)) return null;
    const tal = gmgnTal(item);
    if (!tal || typeof tal !== "object") return null;
    const dividend_bps = ratioToBps(
      pickTalField(tal, [
        "dividend",
        "dvtx",
        "dividend_tax",
        "holder_tax",
        "holder",
        "dividend_pct",
        "dividend_rate"
      ])
    );
    const market_bps = ratioToBps(
      pickTalField(tal, [
        "marketing",
        "marketing_tax",
        "mktx",
        "dev_tax",
        "dev",
        "market",
        "founder"
      ])
    );
    const deflation_bps = ratioToBps(
      pickTalField(tal, ["burn", "burn_rate", "brtx", "deflation"])
    );
    const lp_bps = ratioToBps(
      pickTalField(tal, ["liquidity", "lp", "lp_tax", "lqtx", "liquidity_tax"])
    );
    const giggle_charity_bps = ratioToBps(
      pickTalField(tal, ["giggle_charity_tax", "giggle_charity", "giggle"])
    );
    const binance_charity_bps = ratioToBps(
      pickTalField(tal, ["binance_charity_tax", "binance_charity", "binance"])
    );
    const is_vault = isGmgnVaultTal(tal);
    const basket_assets = normalizeGmgnBasket(tal.dividend_tokens);
    const vaultKind = gmgnVaultKind(tal, item);
    const is_stocks_vault =
      tal.is_stocks_vault === true ||
      tal.is_stocks_vault === 1 ||
      tal.is_stocks_vault === "true" ||
      vaultKind === "stock" ||
      gmgnIsFlapStocksLaunchpad(item) ||
      basket_assets.length >= 2;
    const tax = gmgnSecurityTaxBps(item);
    const quote_symbol = gmgnResolveQuoteSymbol(item, tal);
    const dividend_symbol = gmgnResolveDividendSymbol(item, tal, basket_assets);
    const totalBps =
      dividend_bps +
      market_bps +
      deflation_bps +
      lp_bps +
      giggle_charity_bps +
      binance_charity_bps;
    const isStockVault = is_stocks_vault || basket_assets.length > 0;
    const needsChain =
      totalBps <= 0 || hostFeeBasketNeedsHydration(basket_assets, isStockVault);
    return finalizeHostFeeEntry({
      address: addr,
      source: "gmgn",
      dividend_bps,
      market_bps,
      deflation_bps,
      lp_bps,
      giggle_charity_bps,
      binance_charity_bps,
      is_vault,
      is_stocks_vault,
      buy_tax_bps: tax.buy,
      sell_tax_bps: tax.sell,
      basket_assets,
      vault_address: String(tal.market_address || tal.vault_address || "")
        .trim()
        .toLowerCase(),
      quote_symbol,
      dividend_symbol,
      top_payout_symbol: dividend_symbol || quote_symbol,
      __needsChain: needsChain
    });
  }

  function debotHostFeeFromRow(row) {
    if (!row || typeof row !== "object") return null;
    const addr = String(row.contract || "")
      .trim()
      .toLowerCase();
    if (!TARGET_TOKEN_RE.test(addr)) return null;
    const meta = row.meta && typeof row.meta === "object" ? row.meta : null;
    const extra = (meta && meta.launchpad_extra) || row.launchpad_extra;
    if (!extra || typeof extra !== "object") return null;
    const dividend_bps = ratioToBps(extra.dividend_pct ?? extra.holder_pct);
    const market_bps = ratioToBps(
      extra.founder_pct_vault ?? extra.founder_pct ?? extra.marketing_pct_vault ?? extra.marketing_pct
    );
    const deflation_bps = ratioToBps(extra.burn_pct);
    const lp_bps = ratioToBps(extra.liquidity_pct ?? extra.lp_pct);
    const giggle_charity_bps = ratioToBps(
      extra.giggle_charity_pct ?? extra.giggle_pct ?? extra.rate_giggle_charity
    );
    const binance_charity_bps = ratioToBps(
      extra.binance_charity_pct ?? extra.binance_pct ?? extra.rate_binance_charity
    );
    const is_vault =
      extra.is_vault === true ||
      extra.is_stocks_vault === true ||
      debotVaultKind(extra) === "tax" ||
      debotVaultKind(extra) === "stock";
    const basket_assets = normalizeDebotBasket(extra);
    const is_stocks_vault = extra.is_stocks_vault === true || basket_assets.length >= 2;
    const buy_tax_bps = ratioToBps(
      row.buy_tax ?? row.buy_tax_rate ?? extra.buy_tax ?? extra.buy_tax_rate
    );
    const sell_tax_bps = ratioToBps(
      row.sell_tax ?? row.sell_tax_rate ?? extra.sell_tax ?? extra.sell_tax_rate
    );
    const quote_symbol = String(row.quote_symbol || extra.quote_symbol || "").trim();
    let dividend_symbol = basket_assets[0]?.symbol || quote_symbol;
    if (is_stocks_vault && basket_assets.length >= 2) dividend_symbol = "";
    const divAddr = String(
      extra.dividend_token || extra.base_token || ""
    ).toLowerCase();
    const divFromAddr = symbolFromKnownTokenAddress(divAddr);
    if (divFromAddr) dividend_symbol = divFromAddr;
    const totalBps =
      dividend_bps +
      market_bps +
      deflation_bps +
      lp_bps +
      giggle_charity_bps +
      binance_charity_bps;
    const isStockVault = is_stocks_vault || basket_assets.length > 0;
    const needsChain =
      totalBps <= 0 || hostFeeBasketNeedsHydration(basket_assets, isStockVault);
    return finalizeHostFeeEntry({
      address: addr,
      source: "debot",
      dividend_bps,
      market_bps,
      deflation_bps,
      lp_bps,
      giggle_charity_bps,
      binance_charity_bps,
      is_vault,
      is_stocks_vault,
      buy_tax_bps,
      sell_tax_bps,
      basket_assets,
      vault_address: String(extra.vault_address || extra.fee_receiver || "")
        .trim()
        .toLowerCase(),
      quote_symbol,
      dividend_symbol,
      top_payout_symbol: dividend_symbol || quote_symbol,
      __needsChain: needsChain
    });
  }

  function collectHostFeesFromGmgnItem(item) {
    try {
      const entry = gmgnHostFeeFromItem(item);
      if (entry) queueHostFeeEntry(entry);
    } catch (_e) {
      // ignore
    }
  }

  function collectHostFeesFromDebotRow(row) {
    try {
      const entry = debotHostFeeFromRow(row);
      if (entry) queueHostFeeEntry(entry);
    } catch (_e) {
      // ignore
    }
  }

  function collectHostFeesFromGmgnTokens(arr) {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) collectHostFeesFromGmgnItem(arr[i]);
  }

  /** 只扫已知宿主路径，避免全树 walk（HTTP/WS 热路径降载）。 */
  function collectHostFeesFromJson(json, depth) {
    const d = depth || 0;
    if (!isBscPageContext() || !json || typeof json !== "object") return;
    if (d > 4) return;
    let handled = false;
    try {
      // GMGN WS delta / update
      if (
        json.channel === "trenches_delta" ||
        json.channel === "trenches_update"
      ) {
        const data = json.data;
        if (data && Array.isArray(data.t)) collectHostFeesFromGmgnTokens(data.t);
        handled = true;
      }
      if (Array.isArray(json.t)) {
        collectHostFeesFromGmgnTokens(json.t);
        handled = true;
      }

      // Debot Socket.IO: ["meme:new", { token }]
      if (
        Array.isArray(json) &&
        json.length >= 2 &&
        typeof json[0] === "string" &&
        /meme:/i.test(json[0])
      ) {
        const payload = json[1];
        const tok =
          payload && typeof payload === "object"
            ? payload.token || payload
            : null;
        if (tok) collectHostFeesFromDebotRow(tok);
        handled = true;
      }

      const tryGmgnNcBlock = (block) => {
        if (block && Array.isArray(block.tokens)) {
          collectHostFeesFromGmgnTokens(block.tokens);
          handled = true;
        }
      };

      tryGmgnNcBlock(json.new_creation);
      const data = json.data;
      if (data && typeof data === "object") {
        tryGmgnNcBlock(data.new_creation);
        if (Array.isArray(data.new_creations)) {
          for (let i = 0; i < data.new_creations.length; i++) {
            collectHostFeesFromDebotRow(data.new_creations[i]);
          }
          handled = true;
        }
        for (const debotCol of ["completing", "completed"]) {
          const col = data[debotCol];
          if (!Array.isArray(col)) continue;
          for (let i = 0; i < col.length; i++) {
            collectHostFeesFromDebotRow(col[i]);
          }
          handled = true;
        }
        if (data.channel === "trenches_delta" || data.channel === "trenches_update") {
          if (Array.isArray(data.t)) collectHostFeesFromGmgnTokens(data.t);
          if (data.data && Array.isArray(data.data.t)) {
            collectHostFeesFromGmgnTokens(data.data.t);
          }
          handled = true;
        }
        for (const k of Object.keys(data)) {
          if (isGmgnNewCreationColumnKey(k)) tryGmgnNcBlock(data[k]);
        }
      }
      for (const k of Object.keys(json)) {
        if (k === "data" || k === "new_creation") continue;
        if (isGmgnNewCreationColumnKey(k)) tryGmgnNcBlock(json[k]);
      }

      // SharedWorker 外壳：{ type, payload/data/message/body: { channel, data } }
      if (!handled && d < 3) {
        for (const k of ["payload", "data", "body", "message"]) {
          const inner = json[k];
          if (inner && typeof inner === "object" && inner !== json) {
            collectHostFeesFromJson(inner, d + 1);
          }
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  function collectHostFeesFromHttp(url, text) {
    const u = String(url || "");
    if (!hostFeeUrlLooksUseful(u)) {
      return;
    }
    if (!text || text.length < 40) return;
    try {
      const json = JSON.parse(text);
      collectHostFeesFromJson(json);
      if (/meme\/v\d+\/ranks/i.test(u)) {
        flushHostFeePendingNow();
        try {
          window.postMessage(
            { source: "flap-fee-info", type: "host-fee-ranks-done", site: "debot" },
            "*"
          );
        } catch (_rd) {
          // ignore
        }
      }
      if (u.includes("mutil_window_token_security_launchpad")) {
        const lp = json?.data?.launchpad;
        const sec = json?.data?.security || json?.data?.token?.security;
        const tal = sec?.tax_allocation || sec?.s_tal;
        const ca = String(json?.data?.address || lp?.address || "").toLowerCase();
        if (tal && TARGET_TOKEN_RE.test(ca)) {
          collectHostFeesFromGmgnItem({
            a: ca,
            s_tal: tal,
            security: sec,
            launchpad: lp?.launchpad,
            launchpad_platform: lp?.launchpad_platform,
            f: {
              launchpad: lp?.launchpad,
              launchpad_platform: lp?.launchpad_platform
            }
          });
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  function textMightBeHostFeeFeed(text) {
    if (typeof text !== "string" || text.length < 40) return false;
    return (
      text.indexOf("s_tal") !== -1 ||
      text.indexOf("tax_allocation") !== -1 ||
      text.indexOf("launchpad_extra") !== -1 ||
      text.indexOf("trenches_delta") !== -1 ||
      text.indexOf("trenches_update") !== -1 ||
      text.indexOf("trenches_rank") !== -1 ||
      text.indexOf("new_creations") !== -1
    );
  }

  /** GMGN SharedWorker / MessagePort 帧：与 HTTP 一样提取 s_tal（过滤关时也要跑） */
  function unwrapSocketIoText(text) {
    if (typeof text !== "string") return text;
    const t = text.trim();
    if (!t) return t;
    const m = t.match(/^\d+(\[.*\])$/s);
    if (m) return m[1];
    return t;
  }

  function tapHostFeePortData(data) {
    if (!isBscPageContext() || data == null) return;
    try {
      const NativeJSONParse =
        (JSON.parse && JSON.parse.__flapFeeNative) || JSON.parse.bind(JSON);
      if (typeof data === "string") {
        if (!textMightBeHostFeeFeed(data)) return;
        const payload = unwrapSocketIoText(data);
        const c0 = payload.charAt(0);
        if (c0 !== "{" && c0 !== "[") return;
        collectHostFeesFromJson(NativeJSONParse(payload));
      } else if (typeof data === "object") {
        collectHostFeesFromJson(data);
      }
    } catch (_tap) {
      // ignore
    }
  }

  function gmgnSymbolFromTaxDom(el) {
    if (!(el instanceof HTMLElement)) return "";
    const tax = el.querySelector(".trenches-tax");
    if (!tax) return "";
    const img = tax.querySelector('img[src*="/static/quotes/"]');
    if (img) {
      const src = img.currentSrc || img.getAttribute("src") || "";
      const m = src.match(/\/quotes\/([^./?#]+)/i);
      if (m) return String(m[1]).trim().toUpperCase();
    }
    // BNB/WBNB 分红：GMGN 用 external-res 或 BNB 图标，无 /static/quotes/
    const hasReferral = tax.querySelector(
      'svg[data-icon="IconReferral16pxRegular"]'
    );
    if (hasReferral) {
      const tal = scrapeGmgnTaxAllocationFromFiber(el);
      const dts = coerceDividendTokenList(tal?.dividend_tokens);
      if (dts.length) {
        for (let i = 0; i < dts.length; i++) {
          const sym = symbolFromKnownTokenAddress(dts[i]?.address || dts[i]?.token);
          if (sym) return sym;
        }
      }
      return "BNB";
    }
    return "";
  }

  function debotSymbolFromPoolDom(el) {
    if (!(el instanceof HTMLElement)) return "";
    const pool = el.querySelector(
      '[aria-label$="流动池"], [aria-label*=" 流动池"], [aria-label*="池子"]'
    );
    if (!pool) return "";
    const img = pool.querySelector("img[alt]");
    if (img) {
      const alt = String(img.getAttribute("alt") || "").trim();
      const name = alt.replace(/\s*(流动池|池子)\s*$/u, "").trim();
      if (name && /^[A-Za-z0-9]{1,12}$/.test(name)) return name.toUpperCase();
    }
    const aria = pool.getAttribute("aria-label") || "";
    const part = aria
      .replace(/\s*(流动池|池子)\s*$/u, "")
      .trim();
    if (part && /^[A-Za-z0-9]{1,12}$/.test(part)) return part.toUpperCase();
    return "";
  }

  function applyDomSymbolsToHostFee(entry, scopeEl, source) {
    if (!entry || !(scopeEl instanceof HTMLElement)) return entry;
    const domSym =
      source === "debot"
        ? debotSymbolFromPoolDom(scopeEl)
        : gmgnSymbolFromTaxDom(scopeEl);
    if (domSym) {
      if (!entry.dividend_symbol && entry.dividend_bps > 0) {
        entry.dividend_symbol = domSym;
      }
      if (!entry.quote_symbol) entry.quote_symbol = domSym;
      entry.top_payout_symbol =
        entry.dividend_symbol || entry.quote_symbol || domSym;
    }
    return entry;
  }

  function scrapeGmgnLaunchpadFromFiber(root) {
    const fiberKey = Object.keys(root).find((k) => k.startsWith("__reactFiber"));
    if (!fiberKey) return "";
    let found = "";
    const pickLp = (p) => {
      if (!p || typeof p !== "object") return "";
      const candidates = [
        p.launchpad_platform,
        p.launchpad_platform_name,
        p.launchpad,
        p.fallbackToken?.launchpad_platform,
        p.fallbackToken?.launchpad,
        p.token?.launchpad_platform,
        p.token?.launchpad,
        p.security?.launchpad_platform
      ];
      for (let i = 0; i < candidates.length; i++) {
        const s = String(candidates[i] || "").trim();
        if (s) return s;
      }
      return "";
    };
    const walk = (node, depth) => {
      if (!node || depth > 55 || found) return;
      const lp = pickLp(node.memoizedProps);
      if (lp) {
        found = lp;
        return;
      }
      walk(node.child, depth + 1);
      walk(node.sibling, depth + 1);
    };
    walk(root[fiberKey], 0);
    return found;
  }

  function scrapeGmgnTaxAllocationFromFiber(root) {
    const fiberKey = Object.keys(root).find((k) => k.startsWith("__reactFiber"));
    if (!fiberKey) return null;
    let found = null;
    const pickTal = (p) => {
      if (!p || typeof p !== "object") return null;
      const tal =
        p.tax_allocation ||
        p.taxAllocation ||
        p.fallbackToken?.tax_allocation ||
        p.fallbackToken?.taxAllocation ||
        p.token?.tax_allocation ||
        p.token?.taxAllocation;
      return tal && typeof tal === "object" ? tal : null;
    };
    const walk = (node, depth) => {
      if (!node || depth > 55 || found) return;
      const tal = pickTal(node.memoizedProps);
      if (tal) {
        found = tal;
        return;
      }
      walk(node.child, depth + 1);
      walk(node.sibling, depth + 1);
    };
    walk(root[fiberKey], 0);
    return found;
  }

  function scrapeDebotLaunchpadFromFiber(root) {
    const fiberKey = Object.keys(root).find((k) => k.startsWith("__reactFiber"));
    if (!fiberKey) return null;
    let found = null;
    const walk = (node, depth) => {
      if (!node || depth > 55 || found) return;
      const p = node.memoizedProps;
      if (p && typeof p === "object") {
        if (p.launchpad_extra && typeof p.launchpad_extra === "object") {
          found = { contract: p.contract, meta: { launchpad_extra: p.launchpad_extra } };
          return;
        }
        if (p.meta?.launchpad_extra) {
          found = { contract: p.contract, meta: p.meta };
          return;
        }
        if (p.token?.meta?.launchpad_extra) {
          found = { contract: p.token.contract, meta: p.token.meta };
          return;
        }
        if (p.row?.meta?.launchpad_extra) {
          found = { contract: p.row.contract, meta: p.row.meta };
          return;
        }
      }
      walk(node.child, depth + 1);
      walk(node.sibling, depth + 1);
    };
    walk(root[fiberKey], 0);
    return found;
  }

  function resolveGmgnCardElement(node) {
    if (!(node instanceof HTMLElement)) return null;
    if (node.matches?.('[data-sentry-source-file="TokenItem.tsx"]')) return node;
    return (
      node.closest?.('[data-sentry-source-file="TokenItem.tsx"]') ||
      node.closest?.('[href*="/bsc/token/0x"]') ||
      null
    );
  }

  function gmgnAddrFromCard(card) {
    if (!(card instanceof HTMLElement)) return "";
    const dataLeaf =
      card.querySelector?.("#token-base-address, [data-addr]") ||
      (card.matches?.("#token-base-address, [data-addr]") ? card : null);
    if (dataLeaf instanceof HTMLElement) {
      const raw =
        dataLeaf.getAttribute?.("data-addr") ||
        dataLeaf.getAttribute?.("title") ||
        dataLeaf.textContent ||
        "";
      const dm = String(raw).match(/0x[a-fA-F0-9]{40}/i);
      if (dm) return dm[0].toLowerCase();
    }
    const href =
      card.getAttribute("href") ||
      card.querySelector?.("[href*='/bsc/token/0x']")?.getAttribute("href") ||
      "";
    const m = href.match(/0x[a-fA-F0-9]{40}/i);
    return m ? m[0].toLowerCase() : "";
  }

  function resolveDebotCardElement(node) {
    if (!(node instanceof HTMLElement)) return null;
    let cur = node;
    for (let depth = 0; cur && depth < 14; depth += 1) {
      if (
        cur.querySelector?.('[aria-label*="流动池"]') &&
        /0x[a-fA-F0-9]{4,}/.test(cur.textContent || "")
      ) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return node.closest?.("div") || node;
  }

  function debotAddrFromCard(card) {
    if (!(card instanceof HTMLElement)) return "";
    const fromAttr =
      card.getAttribute("data-contract") ||
      card.getAttribute("data-address") ||
      card.dataset?.contract ||
      card.dataset?.address ||
      "";
    if (TARGET_TOKEN_RE.test(fromAttr)) return String(fromAttr).toLowerCase();
    const href =
      card.querySelector?.("a[href*='0x']")?.getAttribute("href") ||
      card.getAttribute("href") ||
      "";
    const m = href.match(/0x[a-fA-F0-9]{40}/i);
    if (m) return m[0].toLowerCase();
    const clip = card.querySelector?.("[data-clipboard-text], [data-address]");
    const clipVal =
      clip?.getAttribute?.("data-clipboard-text") ||
      clip?.getAttribute?.("data-address") ||
      "";
    const cm = String(clipVal).match(/0x[a-fA-F0-9]{40}/i);
    if (cm) return cm[0].toLowerCase();
    return "";
  }

  function processGmgnReactTaxCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const addr = gmgnAddrFromCard(card);
    if (!TARGET_TOKEN_RE.test(addr)) return;
    const tal = scrapeGmgnTaxAllocationFromFiber(card);
    if (!tal) return;
    const launchpad_platform = scrapeGmgnLaunchpadFromFiber(card);
    let entry = gmgnHostFeeFromItem({
      a: addr,
      tax_allocation: tal,
      launchpad_platform,
      f: launchpad_platform ? { launchpad_platform } : undefined
    });
    if (!entry) return;
    entry = applyDomSymbolsToHostFee(entry, card, "gmgn");
    entry = hydrateHostFeeBasket(entry, card, "gmgn");
    queueHostFeeEntry(finalizeHostFeeEntry(entry));
  }

  function processDebotReactTaxCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const scope = resolveDebotCardElement(card);
    const scraped = scrapeDebotLaunchpadFromFiber(scope);
    const addr = debotAddrFromCard(scope) || String(scraped?.contract || "").toLowerCase();
    if (!TARGET_TOKEN_RE.test(addr)) return;
    const row =
      scraped && scraped.meta
        ? { contract: addr, meta: scraped.meta }
        : null;
    if (!row) return;
    let entry = debotHostFeeFromRow(row);
    if (!entry) return;
    entry = applyDomSymbolsToHostFee(entry, scope, "debot");
    entry = hydrateHostFeeBasket(entry, scope, "debot");
    queueHostFeeEntry(finalizeHostFeeEntry(entry));
  }

  const GMGN_HOST_FEE_ROOT_SEL =
    '[data-sentry-source-file="PumpSubX.tsx"], [data-sentry-source-file="PumpSubAX.tsx"], div.flex.flex-col.flex-1.overflow-hidden';
  const DEBOT_HOST_FEE_ROOT_SEL =
    '.MuiStack-root, [class*="MuiGrid"], div[class*="overflow-y"], div[class*="overflow-auto"]';
  const HOST_FEE_OBSERVE_MAX_ROOTS = 8;
  const HOST_FEE_SCAN_MAX_NODES = 24;

  function collectHostFeeObserveRoots() {
    const host = location.hostname || "";
    const path = location.pathname || "";
    const roots = [];
    const seen = new Set();
    const push = (el) => {
      if (!(el instanceof HTMLElement) || !el.isConnected || seen.has(el)) return;
      seen.add(el);
      roots.push(el);
    };
    if (/debot\.ai|gungnir\.bot/i.test(host)) {
      if (/\/token\//i.test(path)) {
        const header = document.querySelector(
          "[title^='0x'], [data-clipboard-text^='0x'], .ca-text"
        );
        if (header instanceof HTMLElement) {
          const box =
            header.closest?.(".MuiBox-root, .MuiCard-root, .MuiStack-root") ||
            header.parentElement;
          if (box instanceof HTMLElement) push(box);
        }
      } else if (/\/meme/i.test(path) || path === "/" || path === "") {
        document.querySelectorAll(DEBOT_HOST_FEE_ROOT_SEL).forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const r = el.getBoundingClientRect();
          if (r.width >= 200 && r.height >= 280 && r.top < window.innerHeight + 200) {
            push(el);
          }
        });
        const sample = document.querySelector("[data-contract]");
        const col = sample?.closest?.(".MuiStack-root, [class*='overflow']");
        if (col instanceof HTMLElement) push(col);
      }
    } else if (/gmgn\.ai/i.test(host)) {
      if (/\/token\//i.test(path)) {
        const header = document.querySelector(
          '#token-base-address, [data-addr], [title^="0x"], [data-clipboard-text^="0x"]'
        );
        if (header instanceof HTMLElement) {
          const box =
            header.closest?.("div.flex, header, main, [class*='token']") ||
            header.parentElement;
          if (box instanceof HTMLElement) push(box);
        }
      } else {
        document.querySelectorAll(GMGN_HOST_FEE_ROOT_SEL).forEach((el) => push(el));
        if (!roots.length) {
          const sample = document.querySelector('[href*="/bsc/token/0x"]');
          const col = sample?.closest?.("div.flex.flex-col");
          if (col instanceof HTMLElement) push(col);
        }
      }
    }
    return roots.slice(0, HOST_FEE_OBSERVE_MAX_ROOTS);
  }

  function installDomHostFeeReactTap() {
    if (window.__flapFeeDomReactTap === HOOK_VER) return;
    if (!isBscPageContext()) return;
    window.__flapFeeDomReactTap = HOOK_VER;
    const scheduled = new WeakSet();
    const schedule = (card, kind) => {
      if (!(card instanceof HTMLElement) || scheduled.has(card)) return;
      scheduled.add(card);
      window.setTimeout(() => {
        scheduled.delete(card);
        try {
          if (kind === "debot") processDebotReactTaxCard(card);
          else processGmgnReactTaxCard(card);
        } catch (_pr) {
          // ignore
        }
      }, 0);
    };
    const hostIsDebot = () => /debot\.ai|gungnir\.bot/i.test(location.hostname || "");
    const scanRoot = (root) => {
      if (!(root instanceof HTMLElement)) return;
      const debot = hostIsDebot();
      let budget = HOST_FEE_SCAN_MAX_NODES;
      if (debot) {
        const cards = root.matches?.("[data-contract], [href*='0x']")
          ? [root]
          : root.querySelectorAll?.("[data-contract], a[href*='0x']");
        cards?.forEach?.((el) => {
          if (budget <= 0) return;
          budget -= 1;
          const card = resolveDebotCardElement(el);
          if (card instanceof HTMLElement) schedule(card, "debot");
        });
        return;
      }
      const card = resolveGmgnCardElement(root);
      if (card) schedule(card, "gmgn");
      root
        .querySelectorAll?.(
          '[data-sentry-source-file="TokenItem.tsx"], [href*="/bsc/token/0x"]'
        )
        .forEach((el) => {
          if (budget <= 0) return;
          budget -= 1;
          const c = resolveGmgnCardElement(el);
          if (c) schedule(c, "gmgn");
        });
    };
    const onScanToken = (ev) => {
      try {
        const token = String(ev?.detail?.token || "")
          .trim()
          .toLowerCase();
        if (!TARGET_TOKEN_RE.test(token)) return;
        const short = token.slice(-8);
        const roots = collectHostFeeObserveRoots();
        const scope = roots.length ? roots : [document.documentElement];
        let hits = 0;
        for (let ri = 0; ri < scope.length && hits < 6; ri += 1) {
          const root = scope[ri];
          if (!root?.querySelectorAll) continue;
          root
            .querySelectorAll(`[href*="${short}"], [data-contract="${token}"]`)
            .forEach((el) => {
              if (hits >= 6) return;
              if (!(el instanceof HTMLElement)) return;
              hits += 1;
              if (hostIsDebot()) {
                schedule(resolveDebotCardElement(el) || el, "debot");
              } else {
                const c = resolveGmgnCardElement(el);
                if (c) schedule(c, "gmgn");
              }
            });
        }
      } catch (_st) {
        // ignore
      }
    };
    try {
      window.addEventListener("flap-fee-scan-card", onScanToken);
    } catch (_ev) {
      // ignore
    }
    const observedRoots = new WeakSet();
    let rootMo = null;
    const attachObservers = () => {
      const roots = collectHostFeeObserveRoots();
      if (!roots.length || !rootMo) return false;
      for (let i = 0; i < roots.length; i += 1) {
        const root = roots[i];
        if (observedRoots.has(root)) continue;
        observedRoots.add(root);
        try {
          rootMo.observe(root, { childList: true, subtree: true });
        } catch (_ob) {
          // ignore
        }
        scanRoot(root);
      }
      return roots.length > 0;
    };
    try {
      rootMo = new MutationObserver((records) => {
        for (let i = 0; i < records.length; i += 1) {
          const rec = records[i];
          rec.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) scanRoot(n);
          });
          if (
            rec.target instanceof HTMLElement &&
            (rec.target.closest?.(".trenches-tax") ||
              rec.target.matches?.('[aria-label*="流动池"]'))
          ) {
            scanRoot(rec.target);
          }
        }
      });
      if (!attachObservers()) {
        window.setTimeout(() => attachObservers(), 400);
      }
      window.setTimeout(() => attachObservers(), 1200);
    } catch (_mo) {
      // ignore
    }
  }

  function installHostFeePortTap() {
    if (window.__flapFeeHostFeePortTap === HOOK_VER) return;
    window.__flapFeeHostFeePortTap = HOOK_VER;
    const hostPortWrapMap = new WeakMap();

    function wrapHostPortFn(fn) {
      if (typeof fn !== "function") return fn;
      let wrapped = hostPortWrapMap.get(fn);
      if (wrapped) return wrapped;
      wrapped = function flapFeeHostPortTap(ev) {
        try {
          if (ev && ev.data != null) tapHostFeePortData(ev.data);
        } catch (_e) {
          // ignore
        }
        return fn.apply(this, arguments);
      };
      hostPortWrapMap.set(fn, wrapped);
      return wrapped;
    }

    const nativePortOm = NativeMessagePortOnmessage;
    try {
      if (
        nativePortOm &&
        typeof nativePortOm.set === "function" &&
        !MessagePort.prototype.__flapFeeHostFeePortOm
      ) {
        MessagePort.prototype.__flapFeeHostFeePortOm = HOOK_VER;
        Object.defineProperty(MessagePort.prototype, "onmessage", {
          configurable: true,
          enumerable: true,
          get: function () {
            return this.__flapFeeHostPortOmUser || null;
          },
          set: function (fn) {
            this.__flapFeeHostPortOmUser = fn;
            if (typeof fn !== "function") {
              try {
                nativePortOm.set.call(this, fn);
              } catch (_e) {
                // ignore
              }
              return;
            }
            try {
              nativePortOm.set.call(this, wrapHostPortFn(fn));
            } catch (_e2) {
              try {
                nativePortOm.set.call(this, fn);
              } catch (_e3) {
                // ignore
              }
            }
          }
        });
      }
    } catch (_pom) {
      // ignore
    }

    try {
      if (
        typeof NativeMessagePortAdd === "function" &&
        !MessagePort.prototype.__flapFeeHostFeePortAdd
      ) {
        MessagePort.prototype.__flapFeeHostFeePortAdd = HOOK_VER;
        MessagePort.prototype.addEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            return NativeMessagePortAdd.call(
              this,
              type,
              wrapHostPortFn(listener),
              opt
            );
          }
          return NativeMessagePortAdd.call(this, type, listener, opt);
        };
      }
      if (
        typeof NativeMessagePortRm === "function" &&
        !MessagePort.prototype.__flapFeeHostFeePortRm
      ) {
        MessagePort.prototype.__flapFeeHostFeePortRm = HOOK_VER;
        MessagePort.prototype.removeEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            const w = hostPortWrapMap.get(listener);
            if (w) return NativeMessagePortRm.call(this, type, w, opt);
          }
          return NativeMessagePortRm.call(this, type, listener, opt);
        };
      }
    } catch (_padd) {
      // ignore
    }

    try {
      const nativePortStart = NativeMessagePortStart;
      if (typeof nativePortStart === "function" && !MessagePort.prototype.__flapFeeHostFeeStart) {
        MessagePort.prototype.__flapFeeHostFeeStart = HOOK_VER;
        MessagePort.prototype.start = function flapFeeHostPortStart() {
          try {
            if (!this.__flapFeeHostFeeStartTap) {
              this.__flapFeeHostFeeStartTap = HOOK_VER;
              NativeMessagePortAdd.call(this, "message", (ev) => {
                try {
                  if (ev && ev.data != null) tapHostFeePortData(ev.data);
                } catch (_st) {
                  // ignore
                }
              });
            }
          } catch (_tap) {
            // ignore
          }
          return nativePortStart.call(this);
        };
      }
    } catch (_pst) {
      // ignore
    }

    if (typeof NativeSharedWorker === "function" && !window.SharedWorker.__flapFeeHostFeeSw) {
      function FlapHostFeeSharedWorker(scriptURL, options) {
        const sw =
          options !== undefined
            ? new NativeSharedWorker(scriptURL, options)
            : new NativeSharedWorker(scriptURL);
        try {
          const u = String(scriptURL || "");
          if (/\/workers\/gmgn/i.test(u) || /\/_next\/static\/workers\/gmgn/i.test(u)) {
            const list = (window.__flapFeeWorkersCreated =
              window.__flapFeeWorkersCreated || []);
            list.push({ u: u.slice(0, 120), kind: "shared", ver: HOOK_VER });
            if (list.length > 20) list.shift();
          }
        } catch (_e) {
          // ignore
        }
        try {
          if (sw.port) {
            try {
              sw.port.start();
            } catch (_ps) {
              // ignore
            }
          }
        } catch (_p) {
          // ignore
        }
        return sw;
      }
      try {
        FlapHostFeeSharedWorker.prototype = NativeSharedWorker.prototype;
        Object.setPrototypeOf(FlapHostFeeSharedWorker, NativeSharedWorker);
      } catch (_p) {
        // ignore
      }
      FlapHostFeeSharedWorker.__flapFeeHostFeeSw = HOOK_VER;
      try {
        if (!window.SharedWorker.__flapFeeTaxRecv) {
          window.SharedWorker = FlapHostFeeSharedWorker;
        }
      } catch (_e) {
        // ignore
      }
    }
  }

  function installHostFeeWebSocketTap() {
    if (window.__flapFeeHostFeeWsTap === HOOK_VER) return;
    window.__flapFeeHostFeeWsTap = HOOK_VER;
    const hostWsWrapMap = new WeakMap();

    function wrapHostWsFn(fn) {
      if (typeof fn !== "function") return fn;
      let wrapped = hostWsWrapMap.get(fn);
      if (wrapped) return wrapped;
      wrapped = function flapFeeHostWsTap(ev) {
        try {
          if (ev && ev.data != null) tapHostFeePortData(ev.data);
        } catch (_e) {
          // ignore
        }
        return fn.apply(this, arguments);
      };
      hostWsWrapMap.set(fn, wrapped);
      return wrapped;
    }

    const nativeWsOm = NativeWebSocketOnmessage;
    try {
      if (
        nativeWsOm &&
        typeof nativeWsOm.set === "function" &&
        !NativeWebSocket.prototype.__flapFeeHostFeeWsOm
      ) {
        NativeWebSocket.prototype.__flapFeeHostFeeWsOm = HOOK_VER;
        Object.defineProperty(NativeWebSocket.prototype, "onmessage", {
          configurable: true,
          enumerable: true,
          get: function () {
            return this.__flapFeeHostWsOmUser || null;
          },
          set: function (fn) {
            this.__flapFeeHostWsOmUser = fn;
            if (typeof fn !== "function") {
              try {
                nativeWsOm.set.call(this, fn);
              } catch (_e) {
                // ignore
              }
              return;
            }
            try {
              nativeWsOm.set.call(this, wrapHostWsFn(fn));
            } catch (_e2) {
              try {
                nativeWsOm.set.call(this, fn);
              } catch (_e3) {
                // ignore
              }
            }
          }
        });
      }
    } catch (_wom) {
      // ignore
    }

    try {
      if (
        typeof NativeWebSocketAdd === "function" &&
        !NativeWebSocket.prototype.__flapFeeHostFeeWsAdd
      ) {
        NativeWebSocket.prototype.__flapFeeHostFeeWsAdd = HOOK_VER;
        NativeWebSocket.prototype.addEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            return NativeWebSocketAdd.call(
              this,
              type,
              wrapHostWsFn(listener),
              opt
            );
          }
          return NativeWebSocketAdd.call(this, type, listener, opt);
        };
      }
      if (
        typeof NativeWebSocketRm === "function" &&
        !NativeWebSocket.prototype.__flapFeeHostFeeWsRm
      ) {
        NativeWebSocket.prototype.__flapFeeHostFeeWsRm = HOOK_VER;
        NativeWebSocket.prototype.removeEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            const w = hostWsWrapMap.get(listener);
            if (w) return NativeWebSocketRm.call(this, type, w, opt);
          }
          return NativeWebSocketRm.call(this, type, listener, opt);
        };
      }
    } catch (_wadd) {
      // ignore
    }

    const OrigWebSocket = window.WebSocket;
    if (typeof OrigWebSocket === "function" && !OrigWebSocket.__flapFeeHostFeeWsCtor) {
      function FlapHostFeeWebSocket(url, protocols) {
        const ws =
          protocols !== undefined
            ? new OrigWebSocket(url, protocols)
            : new OrigWebSocket(url);
        try {
          if (shouldHookWsUrl(url)) ws.__flapFeeHostFeeWs = HOOK_VER;
        } catch (_e) {
          // ignore
        }
        return ws;
      }
      try {
        FlapHostFeeWebSocket.prototype = OrigWebSocket.prototype;
        Object.setPrototypeOf(FlapHostFeeWebSocket, OrigWebSocket);
        FlapHostFeeWebSocket.CONNECTING = OrigWebSocket.CONNECTING;
        FlapHostFeeWebSocket.OPEN = OrigWebSocket.OPEN;
        FlapHostFeeWebSocket.CLOSING = OrigWebSocket.CLOSING;
        FlapHostFeeWebSocket.CLOSED = OrigWebSocket.CLOSED;
      } catch (_p) {
        // ignore
      }
      FlapHostFeeWebSocket.__flapFeeHostFeeWsCtor = HOOK_VER;
      try {
        if (!window.WebSocket.__flapFeeTaxRecv) {
          window.WebSocket = FlapHostFeeWebSocket;
        }
      } catch (_e) {
        // ignore
      }
    }
  }

  function installHostFeeXhrTap() {
    if (window.__flapFeeHostFeeXhrTap === HOOK_VER) return;
    const XO = XMLHttpRequest.prototype.open;
    const XS = XMLHttpRequest.prototype.send;
    if (!XO || !XS || XS.__flapFeeHostFeeXhr === HOOK_VER) return;
    window.__flapFeeHostFeeXhrTap = HOOK_VER;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        this.__flapFeeHostFeeUrl = url != null ? String(url) : "";
      } catch (_e) {
        this.__flapFeeHostFeeUrl = "";
      }
      return XO.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const xhr = this;
      const url = xhr.__flapFeeHostFeeUrl || xhr.__flapFeeUrl || "";
      if (hostFeeUrlLooksUseful(url)) {
        xhr.addEventListener(
          "loadend",
          function flapFeeHostFeeXhrDone() {
            try {
              if (xhr.readyState < 4 || xhr.status < 200 || xhr.status >= 300) return;
              let text = "";
              try {
                const rt = xhr.responseType || "";
                if (!rt || rt === "text" || rt === "") {
                  text = typeof xhr.responseText === "string" ? xhr.responseText : "";
                } else if (rt === "json" && xhr.response && typeof xhr.response === "object") {
                  collectHostFeesFromJson(xhr.response);
                  return;
                }
              } catch (_rt) {
                // ignore
              }
              if (text && text.length >= 40) collectHostFeesFromHttp(url, text);
            } catch (_e) {
              // ignore
            }
          },
          { once: true }
        );
      }
      return XS.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send.__flapFeeHostFeeXhr = HOOK_VER;
  }

  /**
   * GMGN s_tal → 资金接收方（非 vault 的 marketing/创作者）占比 %。
   *
   * 规则：
   * 1) vault / 币股金库 → null（永不按 marketing 屏蔽）
   * 2) 仅认明确 marketing 且 >0（0/"0"/缺省 = 无 👨‍🍳 信号）
   * 3) hybrid（如 💎50%👨‍🍳50%）也返回 marketing%，由阈值决定是否屏蔽
   *    （旧逻辑「div≥mkt 且 div≥50 → 不屏蔽」会把 50/50 整段放行，已废止）
   * 4) 不做 market_address-only→100%（半包误杀纯 💎）
   */
  function gmgnCreatorRecvPct(tal, item) {
    if (!tal || typeof tal !== "object") return null;
    if (isGmgnVaultTal(tal)) return null;
    if (gmgnIsFourTaxWallet(tal, item)) return null;

    const mkt = mktToPct(tal.marketing);
    // 0 / "0" / 空 = 无营销份额
    if (mkt == null || mkt <= 0) return null;
    return mkt;
  }

  function gmgnTokenHide(t) {
    if (!t || typeof t !== "object") return false;
    const addr = gmgnAddr(t);
    // 自定义尾号：任意 CA（不限 7777/8888/ffff）
    if (shouldHideByCustomSuffix(addr)) return true;
    const tal = gmgnTal(t);
    if (vaultHideEnabled) {
      const vKind = gmgnVaultKind(tal, t);
      if (shouldHideVaultKind(vKind)) return true;
    }
    // 资金接收方：仅目标税币 + s_tal
    if (!taxRecvEnabled) return false;
    // 双保险：无尾号不屏蔽
    if (!isTargetTaxTokenAddr(addr)) return false;
    if (!tal || typeof tal !== "object") return false;
    if (isGmgnVaultTal(tal)) return false;

    const divOnly = mktToPct(tal.dividend);
    const mktOnly = mktToPct(tal.marketing);
    // 纯 💎：dividend≈100% 且无 marketing → 永不屏蔽
    if (divOnly != null && divOnly + 1e-9 >= 99 && (mktOnly == null || mktOnly <= 0)) {
      return false;
    }
    // 有 dividend、完全无 marketing 字段 → 持有人向，不屏蔽
    if (divOnly != null && divOnly > 0 && (mktOnly == null || mktOnly <= 0)) {
      return false;
    }

    const pct = gmgnCreatorRecvPct(tal, t);
    if (pct == null) return false;
    // marketing% 达阈值 → 屏蔽（含 hybrid；0 = 严格 >0%，不是 ≥0%）
    return exceedsTaxRecvThreshold(pct, taxRecvPrefs.thresholdPct);
  }

  /**
   * 历史：曾用「a[] 里 7777/8888 必须仍在 t[] 才保留」同步 add 列表。
   * 实测有害：GMGN 常把新地址只放 a[]，本帧 t[] 仅含部分详情/字段更新；
   * 误删后 delta 无法堆积，开启屏蔽时列表只剩首包过滤后的少量卡，
   * 关屏蔽（SharedWorker 累积）则能看到数分钟前的币。
   *
   * 现逻辑：a[] 只在 filterGmgnTrenchesDeltaInPlace 里按 hideAddrs 剔除，
   * 本函数保留为空操作（调用点多，避免漏改）。
   */
  function scrubGmgnDeltaAddList(_root) {
    // no-op — see comment above
  }

  function debotRowHide(row) {
    if (!row || typeof row !== "object") return false;
    const contract = String(row.contract || "").toLowerCase();
    // 自定义尾号：任意 CA
    if (shouldHideByCustomSuffix(contract)) return true;
    const meta = row.meta && typeof row.meta === "object" ? row.meta : null;
    const extra = (meta && meta.launchpad_extra) || row.launchpad_extra;
    if (vaultHideEnabled && extra && typeof extra === "object") {
      const vKind = debotVaultKind(extra);
      if (shouldHideVaultKind(vKind)) return true;
    }
    if (!taxRecvEnabled) return false;
    if (!isTargetTaxTokenAddr(contract)) return false;
    if (!extra || typeof extra !== "object") return false;
    const vaultAddr = extra.vault_address;
    const recvAddr = extra.fee_receiver || extra.founder_address;
    const isVault =
      extra.is_vault === true ||
      extra.is_stocks_vault === true ||
      (vaultAddr && recvAddr && sameAddr(vaultAddr, recvAddr));
    if (isVault) return false;
    const fp = Number(extra.founder_pct);
    if (!Number.isFinite(fp)) return false;
    const pct = fp >= 99.9 && fp <= 100.0001 ? 100 : fp;
    return exceedsTaxRecvThreshold(pct, taxRecvPrefs.thresholdPct);
  }

  function tokenShouldHide(item) {
    // gmgnTokenHide / debotRowHide 已内含自定义尾号
    if (item && typeof item === "object") {
      if (gmgnAddr(item) && gmgnTokenHide(item)) return true;
      if (typeof item.contract === "string" && debotRowHide(item)) return true;
    }
    return false;
  }

  /** 浅检：避免对无关 MessagePort / WS 帧做深 walk */
  function quickMightBeTokenFeed(root) {
    if (!root || typeof root !== "object") return false;
    if (isGmgnTokenItem(root) || isDebotTokenItem(root)) return true;
    if (Array.isArray(root)) {
      const n = Math.min(root.length, 8);
      for (let i = 0; i < n; i++) {
        const it = root[i];
        if (isGmgnTokenItem(it) || isDebotTokenItem(it)) return true;
        if (it && typeof it === "object") {
          if (it.s_tal || it.tax_allocation || it.launchpad_extra) return true;
          if (it.f && (it.f.s_tal || it.f.tax_allocation)) return true;
          if (Array.isArray(it.tokens) && it.tokens[0]) {
            const t0 = it.tokens[0];
            if (isGmgnTokenItem(t0) || isDebotTokenItem(t0)) return true;
          }
        }
      }
      return false;
    }
    // 常见壳：{type, data} / {updates:[]} / {new_creation:{tokens}} / trenches columns
    if (root.s_tal || root.tax_allocation || root.launchpad_extra) return true;
    if (root.new_creation || root.near_completion || root.completed) return true;
    if (root.tokens && Array.isArray(root.tokens)) return true;
    // GMGN WS trenches_delta / trenches_update
    if (Array.isArray(root.updates) && root.updates[0]) {
      const u0 = root.updates[0];
      if (u0 && typeof u0 === "object" && (u0.a || u0.address || u0.s_tal || u0.tax_allocation)) {
        return true;
      }
    }
    try {
      const keys = Object.keys(root);
      for (let i = 0; i < Math.min(keys.length, 16); i++) {
        const v = root[keys[i]];
        if (!v || typeof v !== "object") continue;
        if (isGmgnTokenItem(v) || isDebotTokenItem(v)) return true;
        if (Array.isArray(v)) {
          const t0 = v[0];
          if (isGmgnTokenItem(t0) || isDebotTokenItem(t0)) return true;
          if (t0 && typeof t0 === "object" && (t0.s_tal || t0.tax_allocation) && (t0.a || t0.address)) {
            return true;
          }
        } else if (Array.isArray(v.tokens)) {
          const t0 = v.tokens[0];
          if (isGmgnTokenItem(t0) || isDebotTokenItem(t0)) return true;
        } else if (Array.isArray(v.updates)) {
          return true;
        }
      }
    } catch (_e) {
      return false;
    }
    return false;
  }

  function payloadLooksLikeTokenFeed(root) {
    if (!quickMightBeTokenFeed(root)) return false;
    let found = false;
    const walk = (o, depth) => {
      if (found || !o || depth > 8) return;
      if (Array.isArray(o)) {
        for (let i = 0; i < o.length && i < 48; i++) {
          const it = o[i];
          if (isGmgnTokenItem(it) || isDebotTokenItem(it)) {
            found = true;
            return;
          }
          if (it && typeof it === "object") walk(it, depth + 1);
          if (found) return;
        }
        return;
      }
      if (typeof o === "object") {
        if (isGmgnTokenItem(o) || isDebotTokenItem(o)) {
          found = true;
          return;
        }
        for (const v of Object.values(o)) {
          walk(v, depth + 1);
          if (found) return;
        }
      }
    };
    try {
      walk(root, 0);
    } catch (_e) {
      return false;
    }
    return found;
  }

  /**
   * 资金接收方屏蔽范围：仅「新创建」栏。
   * GMGN HTTP: new_creation.tokens；fid 如 bsc_nc_*（不含 bsc_ncp_ / bsc_cp_）
   * Debot HTTP: ranks?column=new（completing/completed 整响应跳过）
   * Debot WS meme:new upsert：新币插入，仍过滤
   */
  function isGmgnNewCreationColumnKey(key) {
    const k = String(key || "")
      .trim()
      .toLowerCase();
    return k === "new_creation" || k === "newcreation";
  }

  function isGmgnNewCreationFilterId(fid) {
    const s = String(fid || "")
      .trim()
      .toLowerCase();
    if (!s) return false;
    // near_completion = ncp；completed = cp；new_creation = nc
    if (/(^|_)ncp(_|$)/.test(s)) return false;
    if (/(^|_)cp(_|$)/.test(s) && !/(^|_)nc(_|$)/.test(s)) return false;
    if (/(^|_)nc(_|$)/.test(s)) return true;
    if (s.includes("new_creation") || s.includes("newcreation")) return true;
    return false;
  }

  function isDebotNewCreationColumnValue(col) {
    const c = String(col || "")
      .trim()
      .toLowerCase();
    return c === "new" || c === "new_creation" || c === "newcreation";
  }

  /**
   * 从 Debot ranks POST body 取 column。
   * v3 常把 column 放 query；v4 改为 JSON body：{"column":"new",...}
   */
  function parseDebotColumnFromBody(body) {
    if (body == null || body === "") return "";
    try {
      if (typeof body === "string") {
        const s = body.trim();
        if (!s) return "";
        if (s.startsWith("{")) {
          const j = JSON.parse(s);
          if (j && typeof j === "object") {
            return String(j.column || "").trim().toLowerCase();
          }
          return "";
        }
        // form / querystring
        const m = s.match(/(?:^|&)column=([^&]*)/i);
        if (m) {
          try {
            return decodeURIComponent(m[1] || "")
              .trim()
              .toLowerCase();
          } catch (_d) {
            return String(m[1] || "")
              .trim()
              .toLowerCase();
          }
        }
      }
    } catch (_e) {
      // ignore
    }
    return "";
  }

  /** URL query 上的 column（v3 兼容） */
  function parseDebotColumnFromUrl(url) {
    const u = String(url || "");
    if (!u) return "";
    try {
      const parsed = new URL(u, "https://debot.ai");
      return String(parsed.searchParams.get("column") || "")
        .trim()
        .toLowerCase();
    } catch (_e) {
      // ignore
    }
    const m = u.match(/[?&]column=([^&]*)/i);
    if (m) {
      try {
        return decodeURIComponent(m[1] || "")
          .trim()
          .toLowerCase();
      } catch (_d2) {
        return String(m[1] || "")
          .trim()
          .toLowerCase();
      }
    }
    return "";
  }

  /**
   * 是否「新创建」ranks 请求。
   * v4：column 仅在 POST JSON body，URL 只有 request_id。
   */
  function isDebotNewCreationRanksUrl(url, body) {
    const colUrl = parseDebotColumnFromUrl(url);
    if (colUrl) return isDebotNewCreationColumnValue(colUrl);
    const colBody = parseDebotColumnFromBody(body);
    if (colBody) return isDebotNewCreationColumnValue(colBody);
    // 无 column 信息时不猜测（避免误滤即将打满/已迁移）
    return false;
  }

  /**
   * 响应侧兜底：v4 包体常带 data.new_creations / completing / completed。
   * 仅当 new_creations 有数据且另两列为空时，可判定为本请求是新创建列。
   */
  function responseLooksLikeDebotNewCreationOnly(json) {
    try {
      const d = json && json.data;
      if (!d || typeof d !== "object") return false;
      const nc = d.new_creations;
      const cp = d.completing;
      const cd = d.completed;
      const nNc = Array.isArray(nc) ? nc.length : -1;
      const nCp = Array.isArray(cp) ? cp.length : 0;
      const nCd = Array.isArray(cd) ? cd.length : 0;
      return nNc > 0 && nCp === 0 && nCd === 0;
    } catch (_e) {
      return false;
    }
  }

  function filterTokenArrayInPlace(arr, kind) {
    if (!Array.isArray(arr)) return 0;
    const hideFn = (item) => {
      if (kind === "gmgn") {
        // 尾号可拦任意 CA；资金接收仍走 s_tal 税币
        if (gmgnAddr(item) && shouldHideByCustomSuffix(gmgnAddr(item))) return true;
        return isGmgnTokenItem(item) && gmgnTokenHide(item);
      }
      if (kind === "debot") {
        const c = String(item?.contract || "").toLowerCase();
        if (c && shouldHideByCustomSuffix(c)) return true;
        return isDebotTokenItem(item) && debotRowHide(item);
      }
      return tokenShouldHide(item);
    };
    const isTok = (item) => {
      if (kind === "gmgn") return Boolean(gmgnAddr(item)) || isGmgnTokenItem(item);
      if (kind === "debot") {
        return Boolean(item && typeof item.contract === "string") || isDebotTokenItem(item);
      }
      return (
        Boolean(gmgnAddr(item)) ||
        Boolean(item && typeof item.contract === "string") ||
        isGmgnTokenItem(item) ||
        isDebotTokenItem(item)
      );
    };
    let removed = 0;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (isTok(item) && hideFn(item)) {
        removed += 1;
        try {
          const gone = String(gmgnAddr(item) || item.contract || "")
            .trim()
            .toLowerCase();
          if (gone) ncKeepPool.delete(gone);
          noteRemovedSample(gmgnAddr(item) || item.contract, gmgnTal(item), "col");
        } catch (_nr) {
          // ignore
        }
        continue;
      }
      arr[w++] = item;
      // 不深 walk 子数组：列 tokens 已是叶子列表
    }
    arr.length = w;
    return removed;
  }

  function ncItemAddr(item, kind) {
    if (!item || typeof item !== "object") return "";
    if (kind === "debot") {
      return String(item.contract || "")
        .trim()
        .toLowerCase();
    }
    return String(gmgnAddr(item) || item.contract || item.address || "")
      .trim()
      .toLowerCase();
  }

  function cloneNcItem(item) {
    try {
      return JSON.parse(JSON.stringify(item));
    } catch (_e) {
      return item;
    }
  }

  function pruneNcKeepPool() {
    const now = Date.now();
    const maxAge = getNcKeepMaxAgeMs();
    for (const [addr, ent] of [...ncKeepPool.entries()]) {
      if (!ent || now - ent.firstSeen > maxAge) {
        ncKeepPool.delete(addr);
        continue;
      }
      if (ent.item && !itemWithinNcKeepAge(ent.item)) {
        ncKeepPool.delete(addr);
        continue;
      }
      // 偏好变更后：池内项若已应屏蔽则丢掉
      try {
        const item = ent.item;
        if (!item) {
          ncKeepPool.delete(addr);
          continue;
        }
        if (shouldHideByCustomSuffix(addr)) {
          ncKeepPool.delete(addr);
          continue;
        }
        if (ent.kind === "debot") {
          if (debotRowHide(item)) ncKeepPool.delete(addr);
        } else if (isGmgnTokenItem(item) && gmgnTokenHide(item)) {
          ncKeepPool.delete(addr);
        }
      } catch (_p) {
        // ignore single entry
      }
    }
    // 硬顶：池过大时丢掉最早 firstSeen
    if (ncKeepPool.size > NC_KEEP_MAX_CARDS * 2) {
      const ordered = [...ncKeepPool.entries()].sort(
        (a, b) => (a[1]?.firstSeen || 0) - (b[1]?.firstSeen || 0)
      );
      while (ncKeepPool.size > NC_KEEP_MAX_CARDS * 2 && ordered.length) {
        const [addr] = ordered.shift();
        ncKeepPool.delete(addr);
      }
    }
  }

  /**
   * 只记入保留池（delta 瘦身行 / 存活帧）。不改 arr。
   * 若对象字段很少（纯 delta），仅刷新 lastSeen，不覆盖已有完整 item。
   */
  function rememberNewCreationItems(arr, kind) {
    if (!Array.isArray(arr) || !prefsOn()) return;
    const now = Date.now();
    const k = kind === "debot" ? "debot" : "gmgn";
    const maxAge = getNcKeepMaxAgeMs();
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const addr = ncItemAddr(item, kind);
      if (!addr || !/^0x[a-f0-9]{40}$/.test(addr)) continue;
      if (k === "gmgn" && !itemWithinNcKeepAge(item)) continue;
      const prevEnt = ncKeepPool.get(addr);
      const keys = item && typeof item === "object" ? Object.keys(item).length : 0;
      // HTTP 全量行通常字段多；delta 常只有 c/a/f 等
      const looksFull = keys >= 6;
      if (prevEnt && !looksFull) {
        prevEnt.lastSeen = now;
        continue;
      }
      ncKeepPool.set(addr, {
        item: cloneNcItem(item),
        firstSeen: prevEnt && Number.isFinite(prevEnt.firstSeen) ? prevEnt.firstSeen : now,
        lastSeen: now,
        kind: k
      });
    }
    pruneNcKeepPool();
  }

  /**
   * 按 10 分钟 / 满 NC_KEEP_MAX_CARDS 回填到 HTTP 全量 tokens 数组。
   * @returns {number} padded count
   */
  function padNewCreationArray(arr, kind) {
    if (!Array.isArray(arr) || !prefsOn()) return 0;
    rememberNewCreationItems(arr, kind);
    pruneNcKeepPool();
    const now = Date.now();
    const maxAge = getNcKeepMaxAgeMs();
    const have = new Set();
    for (let i = 0; i < arr.length; i++) {
      const a = ncItemAddr(arr[i], kind);
      if (a) have.add(a);
    }
    const k = kind === "debot" ? "debot" : "gmgn";
    const cands = [];
    for (const [addr, ent] of ncKeepPool) {
      if (have.has(addr)) continue;
      if (ent.kind && ent.kind !== k) continue;
      if (now - ent.firstSeen > maxAge) continue;
      if (ent.item && !itemWithinNcKeepAge(ent.item)) continue;
      // 缺完整快照的不垫（delta 瘦行无法当卡片）
      if (!ent.item || Object.keys(ent.item).length < 4) continue;
      cands.push([addr, ent]);
    }
    // 较新 lastSeen 优先垫回（live 顺序在前，垫在列尾）
    cands.sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
    let padded = 0;
    for (let i = 0; i < cands.length; i++) {
      if (arr.length >= NC_KEEP_MAX_CARDS) break;
      const [addr, ent] = cands[i];
      arr.push(cloneNcItem(ent.item));
      have.add(addr);
      padded += 1;
    }
    try {
      window.__flapFeeNcKeep = {
        pool: ncKeepPool.size,
        padded,
        maxAgeMs: getNcKeepMaxAgeMs(),
        gmgnCapMs: gmgnNewCreationMaxAgeMs,
        maxCards: NC_KEEP_MAX_CARDS,
        t: now
      };
    } catch (_dbg) {
      // ignore
    }
    return padded;
  }

  /** HTTP 全量：先记再垫 */
  function rememberAndPadNewCreation(arr, kind) {
    return padNewCreationArray(arr, kind);
  }

  /** delta.r 移除列表：仍在保留期内的 CA 不让宿主删掉 */
  function filterNcDeltaRemovesInPlace(data) {
    if (!data || !Array.isArray(data.r) || data.r.length === 0) return 0;
    if (ncKeepPool.size === 0) return 0;
    pruneNcKeepPool();
    const now = Date.now();
    const maxAge = getNcKeepMaxAgeMs();
    let kept = 0;
    let w = 0;
    for (let i = 0; i < data.r.length; i++) {
      const addr = String(data.r[i] || "")
        .trim()
        .toLowerCase();
      if (addr && ncKeepPool.has(addr)) {
        const ent = ncKeepPool.get(addr);
        if (ent && now - ent.firstSeen <= maxAge && itemWithinNcKeepAge(ent.item)) {
          kept += 1;
          continue;
        }
      }
      data.r[w++] = data.r[i];
    }
    data.r.length = w;
    return kept;
  }

  /**
   * GMGN trenches_rank HTTP：只滤 new_creation.tokens，不动即将打满/已开盘。
   */
  function filterGmgnHttpNewCreationInPlace(json) {
    if (!json || typeof json !== "object") return 0;
    let removed = 0;
    const seen = new Set();
    const tryBlock = (block) => {
      if (!block || typeof block !== "object" || seen.has(block)) return;
      seen.add(block);
      if (Array.isArray(block.tokens)) {
        removed += filterTokenArrayInPlace(block.tokens, "gmgn");
        rememberAndPadNewCreation(block.tokens, "gmgn");
      }
    };
    const tryObj = (o, depth) => {
      if (!o || typeof o !== "object" || depth > 6) return;
      if (Array.isArray(o)) {
        for (let i = 0; i < Math.min(o.length, 8); i++) tryObj(o[i], depth + 1);
        return;
      }
      if (o.new_creation) tryBlock(o.new_creation);
      for (const k of Object.keys(o)) {
        if (isGmgnNewCreationColumnKey(k)) tryBlock(o[k]);
      }
      // data.0 / data[0]
      if (o.data && typeof o.data === "object") {
        tryObj(o.data, depth + 1);
        if (o.data["0"]) tryObj(o.data["0"], depth + 1);
        if (o.data[0]) tryObj(o.data[0], depth + 1);
      }
    };
    tryObj(json, 0);
    return removed;
  }

  /**
   * GMGN WSS trenches_delta 专用：
   * { channel, data: { fid, v, a:[addr], r:[addr], t:[{c,a,f:{s_tal}}] } }
   * 仅当 fid 属新创建（bsc_nc_*）时过滤；ncp/cp 原样放行。
   * @returns {number} removed
   */
  function filterGmgnTrenchesDeltaInPlace(root) {
    if (!root || typeof root !== "object") return 0;
    // 允许根即 data，或 {channel,data}
    const nodes = [];
    if (root.channel === "trenches_delta" || root.channel === "trenches_update") {
      if (root.data && typeof root.data === "object") nodes.push(root.data);
    } else if (Array.isArray(root.t) || Array.isArray(root.a)) {
      nodes.push(root);
    } else if (root.data && typeof root.data === "object" && Array.isArray(root.data.t)) {
      nodes.push(root.data);
    }
    let removed = 0;
    for (let n = 0; n < nodes.length; n++) {
      const data = nodes[n];
      if (!data || !Array.isArray(data.t)) continue;
      const fid = data.fid || data.filter_id || data.filterId || "";
      // 无 fid 时：保守不滤（避免误伤即将打满/已开盘增量）
      // 有 fid 时：仅新创建
      if (fid) {
        if (!isGmgnNewCreationFilterId(fid)) continue;
      } else {
        // 部分帧只有 t/a 无 fid：若 channel 外壳带 fid 则用外壳
        const outerFid =
          root.fid ||
          root.filter_id ||
          (root.data && (root.data.fid || root.data.filter_id)) ||
          "";
        if (outerFid && !isGmgnNewCreationFilterId(outerFid)) continue;
        if (!outerFid && !fid) {
          // 无法判定列 → 不滤 delta（HTTP 首包已管新创建）
          continue;
        }
      }
      const hideAddrs = new Set();
      let w = 0;
      for (let i = 0; i < data.t.length; i++) {
        const row = data.t[i];
        const addr = gmgnAddr(row);
        const bySuffix = addr && shouldHideByCustomSuffix(addr);
        const byRecv = isGmgnTokenItem(row) && gmgnTokenHide(row);
        if (bySuffix || byRecv) {
          removed += 1;
          if (addr) hideAddrs.add(addr);
          noteRemovedSample(addr, gmgnTal(row), bySuffix ? "delta-suffix" : "delta-nc");
          continue;
        }
        data.t[w++] = row;
      }
      data.t.length = w;
      // 存活增量只记地址/刷新 lastSeen，不 pad 进 delta.t（避免污染增量语义）
      if (data.t.length > 0) {
        rememberNewCreationItems(data.t, "gmgn");
      }
      // a = 本帧 add 列表：剔除屏蔽地址（尾号规则可拦任意 CA）
      if (Array.isArray(data.a) && (hideAddrs.size > 0 || suffixHideEnabled)) {
        let wa = 0;
        for (let i = 0; i < data.a.length; i++) {
          const addr = String(data.a[i] || "")
            .trim()
            .toLowerCase();
          if (addr && (hideAddrs.has(addr) || shouldHideByCustomSuffix(addr))) continue;
          data.a[wa++] = data.a[i];
        }
        data.a.length = wa;
      }
      // r = 宿主要移除的地址：保留期内的 CA 吞掉，避免 ~2 分钟被踢出新创建
      const rBlocked = filterNcDeltaRemovesInPlace(data);
      // 让上游 changed 判定生效（仅吞 r 也算修改）
      if (rBlocked > 0) removed += rBlocked;
    }
    return removed;
  }

  /**
   * 原地从数组/对象属性中删除应藏 token。
   * GMGN：只动 new_creation（HTTP）+ 已判定为 nc 的 delta；不扫即将打满/已开盘。
   * Debot：优先只滤 data.new_creations（v3/v4）；否则深 walk（旧形态）。
   * @returns {number} removed
   */
  function filterJsonInPlace(json, kind) {
    // 必须用 prefsOn：热路径上 taxRecvEnabled 可能尚未从 attr 同步
    if (!prefsOn() || !json || typeof json !== "object") return 0;
    let removed = 0;
    // GMGN / auto：delta(nc) + HTTP 仅 new_creation
    if (kind === "gmgn" || kind === "auto") {
      removed += filterGmgnTrenchesDeltaInPlace(json);
      removed += filterGmgnHttpNewCreationInPlace(json);
      // Debot WS upsert 等 auto 路径：顺带处理 meme:new
      try {
        removed += neutralizeDebotUpsertMessages(json);
      } catch (_n) {
        // ignore
      }
      return removed;
    }
    // Debot ranks：只动 new_creations，绝不碰 completing / completed
    try {
      const d = json.data;
      if (d && typeof d === "object" && Array.isArray(d.new_creations)) {
        removed += filterTokenArrayInPlace(d.new_creations, "debot");
        rememberAndPadNewCreation(d.new_creations, "debot");
        return removed;
      }
    } catch (_nc) {
      // fallthrough deep walk
    }
    // 旧形态兜底：深 walk 删 hide token（含自定义尾号）
    const hideFn = (item) => {
      if (!item || typeof item !== "object") return false;
      const c = String(item.contract || "").toLowerCase();
      if (c && shouldHideByCustomSuffix(c)) return true;
      return isDebotTokenItem(item) && debotRowHide(item);
    };
    const isTok = (item) =>
      Boolean(item && typeof item.contract === "string") || isDebotTokenItem(item);
    const walk = (o, depth) => {
      if (!o || depth > 12) return;
      if (Array.isArray(o)) {
        let w = 0;
        for (let i = 0; i < o.length; i++) {
          const item = o[i];
          if (isTok(item) && hideFn(item)) {
            removed += 1;
            try {
              noteRemovedSample(item.contract, null, "debot-walk");
            } catch (_nr) {
              // ignore
            }
            continue;
          }
          o[w++] = item;
          if (item && typeof item === "object") walk(item, depth + 1);
        }
        o.length = w;
        return;
      }
      if (typeof o === "object") {
        // 显式跳过非新创建桶，防误伤
        for (const k of Object.keys(o)) {
          if (k === "completing" || k === "completed" || k === "near_completion") {
            continue;
          }
          const v = o[k];
          if (!v || typeof v !== "object") continue;
          if (isTok(v) && hideFn(v)) {
            try {
              delete o[k];
            } catch (_d) {
              try {
                o[k] = null;
              } catch (_n) {
                // ignore
              }
            }
            removed += 1;
            continue;
          }
          walk(v, depth + 1);
        }
      }
    };
    walk(json, 0);
    return removed;
  }

  /**
   * SharedWorker / port 对象消息（不必先 payloadLooksLike）。
   * 兼容：直接 delta、外层再包一层、Debot 风格 token 嵌套。
   */
  function filterLiveObject(data, channel) {
    if (!prefsOn() || data == null || typeof data !== "object") {
      return { data, changed: false, drop: false };
    }
    if (tokenShouldHide(data)) {
      noteFilter({ channel, drop: 1, thr: taxRecvPrefs.thresholdPct });
      return { data: null, changed: true, drop: true };
    }

    // 1) GMGN trenches_delta 优先（SharedWorker 主路径）
    try {
      let removedDelta = filterGmgnTrenchesDeltaInPlace(data);
      if (removedDelta <= 0 && data && typeof data === "object") {
        // 常见外壳：{ type, payload } / { data: { channel, data } }
        for (const k of ["payload", "data", "body", "message"]) {
          const inner = data[k];
          if (inner && typeof inner === "object") {
            removedDelta += filterGmgnTrenchesDeltaInPlace(inner);
          }
        }
      }
      if (removedDelta > 0) {
        scrubGmgnDeltaAddList(data);
        noteFilter({
          channel: channel || "port",
          removed: removedDelta,
          thr: taxRecvPrefs.thresholdPct,
          shape: "delta"
        });
        return { data, changed: true, drop: false };
      }
    } catch (_d) {
      // ignore
    }

    // 2) Debot 单 token upsert 嵌在对象里
    try {
      const dropDebot = neutralizeDebotUpsertMessages(data);
      if (dropDebot > 0) {
        noteFilter({
          channel: channel || "port",
          removed: dropDebot,
          thr: taxRecvPrefs.thresholdPct,
          shape: "debot-upsert"
        });
        return { data, changed: true, drop: false };
      }
    } catch (_db) {
      // ignore
    }

    if (!payloadLooksLikeTokenFeed(data) && !quickMightBeTokenFeed(data)) {
      return { data, changed: false, drop: false };
    }
    try {
      const removed = filterJsonInPlace(data, "auto");
      const padded =
        (window.__flapFeeNcKeep && Number(window.__flapFeeNcKeep.padded)) || 0;
      if (removed > 0 || padded > 0) {
        scrubGmgnDeltaAddList(data);
        noteFilter({
          channel,
          removed,
          padded,
          thr: taxRecvPrefs.thresholdPct,
          kind: "auto"
        });
        return { data, changed: true, drop: false };
      }
    } catch (_e) {
      try {
        const clone = JSON.parse(JSON.stringify(data));
        const removed = filterJsonInPlace(clone, "auto");
        const padded =
          (window.__flapFeeNcKeep && Number(window.__flapFeeNcKeep.padded)) || 0;
        if (removed > 0 || padded > 0) {
          scrubGmgnDeltaAddList(clone);
          noteFilter({
            channel,
            removed,
            padded,
            thr: taxRecvPrefs.thresholdPct,
            kind: "auto-clone"
          });
          return { data: clone, changed: true, drop: false };
        }
      } catch (_e2) {
        // ignore
      }
    }
    return { data, changed: false, drop: false };
  }

  /**
   * Debot WSS: 42["meme:new",{ action:"upsert", token:{ contract, meta.launchpad_extra } }, ack?]
   * 应藏则去掉 token / 改 noop，避免增量又把纯 👨‍🍳 插回列表。
   * @returns {number}
   */
  function neutralizeDebotUpsertMessages(root) {
    if (!root || typeof root !== "object") return 0;
    let removed = 0;
    const tryOne = (msg) => {
      if (!msg || typeof msg !== "object") return;
      const tok = msg.token;
      if (tok && isDebotTokenItem(tok) && debotRowHide(tok)) {
        try {
          msg.action = "noop";
          delete msg.token;
        } catch (_e) {
          try {
            msg.token = null;
          } catch (_e2) {
            // ignore
          }
        }
        removed += 1;
        return;
      }
      // 列表形态
      if (Array.isArray(msg.tokens)) {
        let w = 0;
        for (let i = 0; i < msg.tokens.length; i++) {
          const row = msg.tokens[i];
          if (isDebotTokenItem(row) && debotRowHide(row)) {
            removed += 1;
            continue;
          }
          msg.tokens[w++] = row;
        }
        msg.tokens.length = w;
      }
    };
    if (Array.isArray(root)) {
      for (let i = 0; i < root.length; i++) {
        if (root[i] && typeof root[i] === "object") tryOne(root[i]);
      }
      return removed;
    }
    tryOne(root);
    // 深一层外壳
    for (const k of ["payload", "data", "body", "message"]) {
      const inner = root[k];
      if (inner && typeof inner === "object") {
        if (Array.isArray(inner)) {
          for (let i = 0; i < inner.length; i++) tryOne(inner[i]);
        } else tryOne(inner);
      }
    }
    return removed;
  }

  function patchEventData(ev, value) {
    try {
      Object.defineProperty(ev, "data", {
        configurable: true,
        enumerable: true,
        writable: false,
        value
      });
      // 校验是否写上（部分浏览器 MessageEvent.data 不可覆写）
      try {
        if (ev.data === value) return true;
      } catch (_r) {
        return true;
      }
      return ev.data === value;
    } catch (_e) {
      return false;
    }
  }

  function deliverWsMessage(fn, ev, nextData) {
    if (typeof fn !== "function") return undefined;
    if (nextData == null || nextData === ev.data) {
      return fn.call(this, ev);
    }
    if (patchEventData(ev, nextData)) {
      return fn.call(this, ev);
    }
    // patch 失败：构造新 MessageEvent 交给业务
    try {
      const fake = new MessageEvent("message", {
        data: nextData,
        origin: ev.origin || "",
        lastEventId: ev.lastEventId || "",
        source: ev.source || null,
        ports: ev.ports ? Array.from(ev.ports) : []
      });
      return fn.call(this, fake);
    } catch (_e2) {
      try {
        return fn.call(this, { data: nextData, type: "message" });
      } catch (_e3) {
        return fn.call(this, ev);
      }
    }
  }

  // ---------- HTTP（对齐原生：筛完的列表再进 React）----------
  function urlLooksUseful(url) {
    const u = String(url || "");
    if (!u) return false;
    if (u.includes("trenches_rank")) return "gmgn";
    // Debot / Gungnir ranks：v3 → v4（2026-08 起页面只打 v4），兼容更高版本号
    if (/\/dashboard\/meme\/v\d+\/ranks/i.test(u) || /meme\/v\d+\/ranks/i.test(u)) {
      return "debot";
    }
    // 历史精确串
    if (u.includes("/dashboard/meme/v3/ranks") || u.includes("meme/v3/ranks")) {
      return "debot";
    }
    if (u.includes("/dashboard/meme/v4/ranks") || u.includes("meme/v4/ranks")) {
      return "debot";
    }
    return false;
  }

  /**
   * 只记新创建 ranks（含 body），softRefresh 不误拉即将打满/已迁移。
   * @type {{ url: string, body: string }[]}
   */
  let lastDebotRanksReqs = [];

  function rememberDebotUrl(url, body) {
    const u = String(url || "");
    if (!u) return;
    const b = typeof body === "string" ? body : "";
    if (!isDebotNewCreationRanksUrl(u, b)) return;
    lastDebotRanksReqs = lastDebotRanksReqs.filter((x) => x && x.url !== u);
    lastDebotRanksReqs.unshift({ url: u, body: b });
    if (lastDebotRanksReqs.length > 8) lastDebotRanksReqs.length = 8;
    // 兼容旧字段（调试）
    lastDebotRanksUrls = lastDebotRanksReqs.map((x) => x.url);
  }

  /**
   * 处理列表响应：只删 hide token，不垫旧币、不改请求体。
   *
   * 历史坑：
   * - keepPool 回填会把 1h 前的 CA 塞进「新创建」，时序错乱
   * - expand limit / softRefresh 重放旧 body 会冲掉 GMGN 原生筛选条件
   * - Debot v4：URL 无 column，必须读 POST body；漏匹配则整段不滤
   *
   * @param {string} url
   * @param {string} text
   * @param {string} [reqBody]
   */
  function processBody(url, text, reqBody) {
    const kind = urlLooksUseful(url);
    if (!kind || !text || text.length < 2) return null;
    if (!prefsOn()) return null;
    let json;
    try {
      json = JSON.parse(text);
    } catch (_e) {
      return null;
    }
    // Debot：三列分请求；仅 column=new（新创建）过滤
    // v4 body 带 column；若 body 未捕获，响应侧 new_creations-only 兜底
    if (kind === "debot") {
      const isNew =
        isDebotNewCreationRanksUrl(url, reqBody) ||
        responseLooksLikeDebotNewCreationOnly(json);
      if (!isNew) return null;
    }
    try {
      let colStats = null;
      if (kind === "gmgn") {
        try {
          const root = json && json.data && (json.data["0"] || json.data[0] || json.data);
          if (root && typeof root === "object") {
            colStats = {};
            const tokens = root.new_creation && root.new_creation.tokens;
            if (Array.isArray(tokens)) colStats.new_creation = { before: tokens.length };
          }
        } catch (_s) {
          colStats = null;
        }
      }
      if (kind === "debot") {
        try {
          const nc = json && json.data && json.data.new_creations;
          if (Array.isArray(nc)) {
            colStats = { new_creations: { before: nc.length } };
          }
        } catch (_ds) {
          colStats = null;
        }
      }
      const removed = filterJsonInPlace(json, kind);
      const padded =
        (window.__flapFeeNcKeep && Number(window.__flapFeeNcKeep.padded)) || 0;
      if (colStats) {
        try {
          if (kind === "debot" && colStats.new_creations) {
            const nc = json && json.data && json.data.new_creations;
            colStats.new_creations.after = Array.isArray(nc) ? nc.length : -1;
          } else {
            const root = json && json.data && (json.data["0"] || json.data[0] || json.data);
            for (const col of Object.keys(colStats)) {
              const tokens = root && root[col] && root[col].tokens;
              colStats[col].after = Array.isArray(tokens) ? tokens.length : -1;
            }
          }
          window.__flapFeeTrenchColStats = {
            ...colStats,
            removed,
            padded,
            keepPool: (window.__flapFeeNcKeep && window.__flapFeeNcKeep.pool) || 0,
            t: Date.now()
          };
        } catch (_s2) {
          // ignore
        }
      }
      noteFilter({
        enabled: true,
        kind,
        channel: "http",
        removed,
        padded,
        rawLen: text.length,
        thr: taxRecvPrefs.thresholdPct,
        cols: colStats || undefined,
        debotV: (/meme\/v(\d+)\/ranks/i.exec(String(url || "")) || [])[1] || ""
      });
      // 有删除或保留池回填时都要改写响应（仅 pad 也必须 stringify）
      if (removed <= 0 && padded <= 0) return null;
      return JSON.stringify(json);
    } catch (_e2) {
      return null;
    }
  }

  /**
   * 设置变更后局部重放最近一次 new_creation 请求（不重载整页）。
   * GMGN：trenches_rank（body 含用户原生时间筛选）；Debot v4：meme/v{n}/ranks POST。
   */
  function softRefreshGmgnNewCreation() {
    try {
      const req = lastGmgnTrench;
      if (!req || !req.url) return;
      const init = {
        credentials: "include",
        cache: "no-store",
        method: req.method || "POST"
      };
      if (req.body) {
        init.headers = { "content-type": "application/json" };
        init.body = req.body;
      }
      window.fetch(req.url, init).catch(() => {});
    } catch (_g) {
      // ignore
    }
  }

  function softRefreshLists() {
    softRefreshGmgnNewCreation();
    try {
      for (const req of lastDebotRanksReqs.slice(0, 4)) {
        if (!req || !req.url) continue;
        if (!isDebotNewCreationRanksUrl(req.url, req.body)) continue;
        const init = {
          credentials: "include",
          cache: "no-store",
          method: "POST",
          headers: { "content-type": "application/json" }
        };
        if (req.body) init.body = req.body;
        window.fetch(req.url, init).catch(() => {});
      }
    } catch (_e2) {
      // ignore
    }
  }

  // ---------- SPA ----------
  if (!window.__flapFeeInfoSpaHook) {
    window.__flapFeeInfoSpaHook = 1;
    const fireSpa = (reason) => {
      try {
        window.postMessage(
          {
            source: "flap-fee-info",
            type: "spa",
            reason: String(reason || "history"),
            href: String(location.href || ""),
            path: String(location.pathname || "")
          },
          "*"
        );
      } catch (_e) {
        // ignore
      }
    };
    const wrapHistory = (type) => {
      try {
        const orig = history[type];
        if (typeof orig !== "function") return;
        history[type] = function flapFeeHistory() {
          const ret = orig.apply(this, arguments);
          fireSpa(type);
          return ret;
        };
      } catch (_e) {
        // ignore
      }
    };
    wrapHistory("pushState");
    wrapHistory("replaceState");
    try {
      window.addEventListener("popstate", () => fireSpa("popstate"), true);
    } catch (_e) {
      // ignore
    }
  }

  // prefs bridge（content/bootstrap postMessage 的 source 往往 !== window）
  try {
    window.addEventListener("message", (event) => {
      try {
        const data = event.data;
        if (!data || data.source !== "flap-fee-info") return;
        if (data.type === "tax-recv-prefs") {
          const was = anyFilterEnabled();
          applyPrefsObject(data.prefs || {});
          try {
            const payload = JSON.stringify({
              enabled: taxRecvPrefs.enabled,
              thresholdPct: taxRecvPrefs.thresholdPct
            });
            document.documentElement?.setAttribute(PREFS_ATTR, payload);
            localStorage.setItem(LS_KEY, payload);
          } catch (_a) {
            // ignore
          }
          // 懒挂载：开启时装网络钩子；关闭清 owned（钩子随 reload 卸掉）
          if (typeof ensureTaxRecvRuntime === "function") {
            ensureTaxRecvRuntime(anyFilterEnabled() ? "prefs-on" : "prefs-off");
          }
          if (anyFilterEnabled() && (!was || data.refresh === true)) {
            queueMicrotask(softRefreshLists);
          }
        }
        if (data.type === "suffix-hide-prefs") {
          const was = anyFilterEnabled();
          applySuffixHideObject(data.prefs || {});
          try {
            const payload = JSON.stringify({
              enabled: suffixHidePrefs.enabled === true,
              rules: (suffixHidePrefs.rules || []).map((r) => ({
                suffix: r.suffix,
                enabled: r.enabled !== false
              }))
            });
            document.documentElement?.setAttribute(SUFFIX_ATTR, payload);
            localStorage.setItem(SUFFIX_LS_KEY, payload);
          } catch (_a2) {
            // ignore
          }
          if (typeof ensureTaxRecvRuntime === "function") {
            ensureTaxRecvRuntime(anyFilterEnabled() ? "suffix-on" : "suffix-off");
          }
          if (anyFilterEnabled()) {
            queueMicrotask(softRefreshLists);
          }
        }
        if (data.type === "vault-hide-prefs") {
          const was = anyFilterEnabled();
          applyVaultHideObject(data.prefs || {});
          try {
            const payload = JSON.stringify({
              enabled: vaultHidePrefs.enabled === true,
              hideTaxVault: vaultHidePrefs.hideTaxVault === true,
              hideStockVault: vaultHidePrefs.hideStockVault === true
            });
            document.documentElement?.setAttribute(VAULT_HIDE_ATTR, payload);
            localStorage.setItem(VAULT_HIDE_LS_KEY, payload);
          } catch (_a3) {
            // ignore
          }
          if (typeof ensureTaxRecvRuntime === "function") {
            ensureTaxRecvRuntime(anyFilterEnabled() ? "vault-on" : "vault-off");
          }
          if (anyFilterEnabled() && (!was || data.refresh === true)) {
            queueMicrotask(softRefreshLists);
          }
        }
        if (data.type === "tax-recv-refresh" || data.type === "list-filter-refresh") {
          queueMicrotask(softRefreshLists);
        }
      } catch (_e) {
        // ignore
      }
    });
  } catch (_e) {
    // ignore
  }

  function syncGmgnShareWorkerMode(enabled) {
    try {
      // 仅 BSC 写 disableShareWorker，避免 robinhood 等链被误伤
      if (enabled && isBscPageContext()) {
        localStorage.setItem("disableShareWorker", "true");
        localStorage.setItem(OWNED_DISABLE_SW, "1");
      } else if (localStorage.getItem(OWNED_DISABLE_SW) === "1") {
        localStorage.removeItem("disableShareWorker");
        localStorage.removeItem(OWNED_DISABLE_SW);
      }
    } catch (_e) {
      // ignore
    }
  }

  /**
   * 仅屏蔽开启时安装网络过滤钩子（幂等）。
   * 关闭后 content 会 reload，下一跳不会进入此函数。
   */
  function installTaxRecvNetworkHooks() {
    if (window.__flapFeeTaxRecvNetHooks === HOOK_VER) return;
    window.__flapFeeTaxRecvNetHooks = HOOK_VER;
    try {
      window.__flapFeeTaxRecvNetHooksAt = Date.now();
    } catch (_t) {
      // ignore
    }
    // 清掉历史 keepPool session 残留；内存池由本版 10min/40 卡逻辑管理
    try {
      sessionStorage.removeItem("flapFeeInfo.taxKeepPool.v1");
    } catch (_ss) {
      // ignore
    }
    try {
      ncKeepPool.clear();
    } catch (_clr) {
      // ignore
    }

    // ============================================================
    // MessagePort.prototype — GMGN SharedWorker 实时主路径
    // 源码: new SharedWorker(...gmgn.js); this.port.onmessage = this.onMessage
    // 只包原型 setter，不依赖 SharedWorker 构造时机；非 token 帧零深 walk
    // ============================================================
    const portFnWrapMap = new WeakMap();

    function wrapPortMessageFn(fn, channel) {
      if (typeof fn !== "function") return fn;
      let wrapped = portFnWrapMap.get(fn);
      if (wrapped) return wrapped;
      wrapped = function flapFeePortOm(ev) {
        try {
          if (ev && ev.data != null) tapHostFeePortData(ev.data);
        } catch (_hft) {
          // ignore
        }
        try {
          if (!prefsOn() || !ev || ev.data == null) {
            return fn.apply(this, arguments);
          }
          // SharedWorker 可能推 string(JSON) 或 object
          if (typeof ev.data === "string") {
            const next = filterLiveText(ev.data, channel || "port-str");
            if (next !== ev.data) {
              if (patchEventData(ev, next)) return fn.apply(this, arguments);
              try {
                return fn.call(this, { data: next, type: "message" });
              } catch (_s) {
                // fallthrough
              }
            }
            return fn.apply(this, arguments);
          }
          if (typeof ev.data === "object") {
            const r = filterLiveObject(ev.data, channel || "port");
            if (r.drop) return undefined;
            if (r.changed && r.data !== ev.data) {
              if (!patchEventData(ev, r.data)) {
                try {
                  return fn.call(this, { data: r.data, type: "message" });
                } catch (_d) {
                  // fallthrough
                }
              }
            }
          }
        } catch (_fe) {
          // ignore — 原样交给业务
        }
        return fn.apply(this, arguments);
      };
      portFnWrapMap.set(fn, wrapped);
      return wrapped;
    }

    /**
     * 开启屏蔽时：临时让 GMGN 走主线程 WSS（list 过滤可靠）。
     * 关闭时：仅当本插件写入过时才 remove，不碰用户其它用途。
     * 不修改浏览器全局 SharedWorker，只写 gmgn.ai 同源 localStorage。
     */

    try {
      const nativePortOm = NativeMessagePortOnmessage;
      if (nativePortOm && typeof nativePortOm.set === "function") {
        Object.defineProperty(MessagePort.prototype, "onmessage", {
          configurable: true,
          enumerable: true,
          get: function () {
            return this.__flapFeePortOmUser || null;
          },
          set: function (fn) {
            this.__flapFeePortOmUser = fn;
            if (typeof fn !== "function") {
              try {
                nativePortOm.set.call(this, fn);
              } catch (_e) {
                // ignore
              }
              return;
            }
            try {
              nativePortOm.set.call(this, wrapPortMessageFn(fn, "port-om"));
            } catch (_e2) {
              try {
                nativePortOm.set.call(this, fn);
              } catch (_e3) {
                // ignore
              }
            }
          }
        });
      }
    } catch (_portOm) {
      // ignore
    }

    try {
      if (typeof NativeMessagePortAdd === "function") {
        MessagePort.prototype.addEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            return NativeMessagePortAdd.call(
              this,
              type,
              wrapPortMessageFn(listener, "port-add"),
              opt
            );
          }
          return NativeMessagePortAdd.call(this, type, listener, opt);
        };
      }
      if (typeof NativeMessagePortRm === "function") {
        MessagePort.prototype.removeEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            const w = portFnWrapMap.get(listener);
            if (w) return NativeMessagePortRm.call(this, type, w, opt);
          }
          return NativeMessagePortRm.call(this, type, listener, opt);
        };
      }
    } catch (_portAdd) {
      // ignore
    }

    // SharedWorker：构造打点 + 确保 port 走 MessagePort 原型 setter
    if (typeof NativeSharedWorker === "function") {
      function FlapSharedWorker(scriptURL, options) {
        const sw =
          options !== undefined
            ? new NativeSharedWorker(scriptURL, options)
            : new NativeSharedWorker(scriptURL);
        try {
          const u = String(scriptURL || "");
          if (/\/workers\/gmgn/i.test(u) || /\/_next\/static\/workers\/gmgn/i.test(u)) {
            const list = (window.__flapFeeWorkersCreated =
              window.__flapFeeWorkersCreated || []);
            list.push({ u: u.slice(0, 120), kind: "shared", ver: HOOK_VER });
            if (list.length > 20) list.shift();
            try {
              if (sw.port) {
                sw.port.__flapFeeGmgnPort = HOOK_VER;
                // 若业务先拿到 native port 再赋 onmessage，原型 hook 已覆盖；
                // 这里再 start 不强制，避免双 start
              }
            } catch (_p) {
              // ignore
            }
          }
        } catch (_e) {
          // ignore
        }
        return sw;
      }
      try {
        FlapSharedWorker.prototype = NativeSharedWorker.prototype;
        Object.setPrototypeOf(FlapSharedWorker, NativeSharedWorker);
      } catch (_p) {
        // ignore
      }
      FlapSharedWorker.__flapFeeTaxRecv = HOOK_VER;
      try {
        window.SharedWorker = FlapSharedWorker;
      } catch (_e) {
        // ignore
      }
    }

    // ============================================================
    // WebSocket
    //   Debot: portal-ws / sgws · Engine.IO 42
    //   GMGN:  ws.gmgn.ai / ws.wenmoon.cc · 纯 JSON
    //          （localStorage.disableShareWorker=true 时走主线程，不 new SharedWorker）
    // ============================================================
    function textMightBeTaxFeed(text) {
      return (
        text.indexOf("founder_pct") !== -1 ||
        text.indexOf("tax_allocation") !== -1 ||
        text.indexOf("launchpad_extra") !== -1 ||
        text.indexOf("launchpadExtra") !== -1 ||
        text.indexOf('"s_tal"') !== -1 ||
        text.indexOf("s_tal") !== -1 ||
        text.indexOf("marketing") !== -1 ||
        text.indexOf("trenches_delta") !== -1 ||
        text.indexOf("trenches_update") !== -1 ||
        text.indexOf("meme:new") !== -1 ||
        text.indexOf("meme:update") !== -1
      );
    }

    const NativeJSONParse =
      (JSON.parse && JSON.parse.__flapFeeNative) || JSON.parse.bind(JSON);

    function filterParsedFeed(parsed, channel, prefix) {
      if (!parsed || typeof parsed !== "object") return null;
      // delta 不依赖 quickMight — 直接专用过滤
      const isDelta =
        parsed.channel === "trenches_delta" ||
        parsed.channel === "trenches_update" ||
        (parsed.data && Array.isArray(parsed.data.t));
      // Debot Socket.IO: ["meme:new", { action, token }]
      const isDebotSock =
        Array.isArray(parsed) &&
        parsed.length >= 2 &&
        typeof parsed[0] === "string" &&
        /meme:|token:|rank/i.test(parsed[0]);
      if (
        !isDelta &&
        !isDebotSock &&
        !payloadLooksLikeTokenFeed(parsed) &&
        !quickMightBeTokenFeed(parsed)
      ) {
        return null;
      }
      try {
        const clone = NativeJSONParse(JSON.stringify(parsed));
        let removed = 0;
        let shape = "feed";
        let padded = 0;
        if (isDelta) {
          removed = filterGmgnTrenchesDeltaInPlace(clone);
          if (removed > 0) shape = "delta";
        }
        if (removed <= 0 && (isDebotSock || Array.isArray(clone))) {
          removed = neutralizeDebotUpsertMessages(clone);
          if (removed > 0) shape = "debot-upsert";
        }
        if (removed <= 0) {
          removed = filterJsonInPlace(clone, "auto");
          padded =
            (window.__flapFeeNcKeep && Number(window.__flapFeeNcKeep.padded)) || 0;
          if (removed > 0 || padded > 0) {
            scrubGmgnDeltaAddList(clone);
            shape = isDelta ? "delta" : "feed";
          }
        }
        if (removed <= 0 && padded <= 0) return null;
        noteFilter({
          channel: channel || "ws",
          removed,
          padded,
          thr: taxRecvPrefs.thresholdPct,
          shape
        });
        return (prefix || "") + JSON.stringify(clone);
      } catch (_e) {
        return null;
      }
    }

    function filterLiveText(text, channel) {
      if (!prefsOn() || typeof text !== "string" || text.length < 40) return text;
      if (!textMightBeTaxFeed(text)) return text;

      // --- GMGN：纯 JSON 帧（deserializer: JSON.parse）---
      const c0 = text.charAt(0);
      if (c0 === "{" || c0 === "[") {
        try {
          const parsed = NativeJSONParse(text);
          const next = filterParsedFeed(parsed, channel || "ws-gmgn", "");
          return next != null ? next : text;
        } catch (_e) {
          return text;
        }
      }

      // --- Debot：Engine.IO / Socket.IO 事件帧 42... ---
      if (text.charCodeAt(0) !== 52 || text.charCodeAt(1) !== 50) return text;
      try {
        let rest = text.slice(2);
        let prefix = "42";
        if (rest.charAt(0) === "/") {
          const comma = rest.indexOf(",");
          if (comma > 0) {
            prefix = "42" + rest.slice(0, comma + 1);
            rest = rest.slice(comma + 1);
          }
        }
        if (!rest || (rest.charAt(0) !== "[" && rest.charAt(0) !== "{")) return text;
        const parsed = NativeJSONParse(rest);
        const next = filterParsedFeed(parsed, channel || "ws-debot", prefix);
        return next != null ? next : text;
      } catch (_e) {
        return text;
      }
    }

    /**
     * 兜底：即使 MessageEvent.data 无法 patch，app 的 JSON.parse(e.data) 仍会经过这里。
     * 只处理 trenches_delta / 含 s_tal 的列表 JSON，避免拖慢全局 parse。
     */
    try {
      if (JSON.parse.__flapFeeTaxRecv !== HOOK_VER) {
        const wrappedParse = function flapFeeJsonParse(text, reviver) {
          if (typeof text !== "string" || text.length < 40) {
            return NativeJSONParse(text, reviver);
          }
          const mightFilter =
            prefsOn() &&
            (text.charAt(0) === "{" || text.charAt(0) === "[") &&
            (text.indexOf("trenches_delta") !== -1 ||
              text.indexOf("trenches_update") !== -1 ||
              (text.indexOf("s_tal") !== -1 && text.indexOf("marketing") !== -1));
          if (!mightFilter) {
            return NativeJSONParse(text, reviver);
          }
          try {
            const obj = NativeJSONParse(text);
            if (!obj || typeof obj !== "object") {
              return NativeJSONParse(text, reviver);
            }
            let removed = filterGmgnTrenchesDeltaInPlace(obj);
            let padded = 0;
            if (removed <= 0) {
              removed = filterJsonInPlace(obj, "auto");
              padded =
                (window.__flapFeeNcKeep && Number(window.__flapFeeNcKeep.padded)) ||
                0;
              if (removed > 0 || padded > 0) scrubGmgnDeltaAddList(obj);
            }
            if (removed > 0 || padded > 0) {
              noteFilter({
                channel: "json-parse",
                removed,
                padded,
                thr: taxRecvPrefs.thresholdPct,
                shape:
                  obj.channel === "trenches_delta" || obj.channel === "trenches_update"
                    ? "delta"
                    : "feed"
              });
              const out = JSON.stringify(obj);
              return reviver !== undefined
                ? NativeJSONParse(out, reviver)
                : NativeJSONParse(out);
            }
            return reviver !== undefined
              ? NativeJSONParse(JSON.stringify(obj), reviver)
              : obj;
          } catch (_fe) {
            return NativeJSONParse(text, reviver);
          }
        };
        wrappedParse.__flapFeeTaxRecv = HOOK_VER;
        JSON.parse = wrappedParse;
      }
    } catch (_jp) {
      // ignore
    }

    if (typeof NativeWebSocket === "function") {
      const nativeWsOm = Object.getOwnPropertyDescriptor(
        NativeWebSocket.prototype,
        "onmessage"
      );

      function wrapWsFn(fn, channel) {
        if (typeof fn !== "function") return fn;
        if (fn.__flapFeeWsWrap === HOOK_VER) return fn;
        const wrapped = function (ev) {
          try {
            if (ev && ev.data != null) tapHostFeePortData(ev.data);
          } catch (_hft) {
            // ignore
          }
          try {
            if (prefsOn() && ev && typeof ev.data === "string") {
              const next = filterLiveText(ev.data, channel);
              if (next !== ev.data) {
                return deliverWsMessage.call(this, fn, ev, next);
              }
            }
          } catch (_e) {
            // ignore
          }
          return fn.apply(this, arguments);
        };
        wrapped.__flapFeeWsWrap = HOOK_VER;
        return wrapped;
      }

      function FlapWebSocket(url, protocols) {
        const ws =
          protocols !== undefined
            ? new NativeWebSocket(url, protocols)
            : new NativeWebSocket(url);
        try {
          const hook = shouldHookWsUrl(url);
          ws.__flapFeeFilterWs = hook ? 1 : 0;
          ws.__flapFeeWsChannel = /sgws/i.test(String(url || ""))
            ? "ws-sgws"
            : "ws-portal";
        } catch (_e) {
          // ignore
        }
        return ws;
      }
      try {
        FlapWebSocket.prototype = NativeWebSocket.prototype;
        Object.setPrototypeOf(FlapWebSocket, NativeWebSocket);
        FlapWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
        FlapWebSocket.OPEN = NativeWebSocket.OPEN;
        FlapWebSocket.CLOSING = NativeWebSocket.CLOSING;
        FlapWebSocket.CLOSED = NativeWebSocket.CLOSED;
      } catch (_p) {
        // ignore
      }
      FlapWebSocket.__flapFeeTaxRecv = HOOK_VER;

      if (nativeWsOm && typeof nativeWsOm.set === "function") {
        try {
          Object.defineProperty(NativeWebSocket.prototype, "onmessage", {
            configurable: true,
            enumerable: true,
            get: function () {
              return this.__flapFeeWsOmUser || null;
            },
            set: function (fn) {
              this.__flapFeeWsOmUser = fn;
              if (!this.__flapFeeFilterWs || typeof fn !== "function") {
                nativeWsOm.set.call(this, fn);
                return;
              }
              nativeWsOm.set.call(
                this,
                wrapWsFn(fn, this.__flapFeeWsChannel || "ws")
              );
            }
          });
        } catch (_e) {
          // ignore
        }
      }

      try {
        const nativeAdd = NativeWebSocket.prototype.addEventListener;
        if (typeof nativeAdd === "function") {
          NativeWebSocket.prototype.addEventListener = function (type, fn, opt) {
            if (
              type === "message" &&
              this.__flapFeeFilterWs &&
              typeof fn === "function"
            ) {
              return nativeAdd.call(
                this,
                type,
                wrapWsFn(fn, this.__flapFeeWsChannel || "ws"),
                opt
              );
            }
            return nativeAdd.call(this, type, fn, opt);
          };
        }
      } catch (_e) {
        // ignore
      }

      try {
        window.WebSocket = FlapWebSocket;
      } catch (_e) {
        // ignore
      }
    }

    // ============================================================
    // HTTP XHR / fetch
    // ============================================================
    try {
      const origFetch = window.fetch;
      if (typeof origFetch === "function" && origFetch.__flapFeeTaxRecv !== HOOK_VER) {
        const wrapped = function flapFeeFetch() {
          const args = arguments;
          const input = args[0];
          const init = args[1];
          let url = "";
          let reqBody = "";
          try {
            if (typeof input === "string") url = input;
            else if (input && typeof input.url === "string") url = input.url;
          } catch (_e) {
            url = "";
          }
          try {
            if (init && init.body != null && typeof init.body === "string") {
              reqBody = init.body;
            } else if (input && typeof input === "object" && typeof input.clone === "function") {
              // Request 对象 body 不便同步读；依赖 URL / 响应兜底
              reqBody = "";
            }
          } catch (_b) {
            reqBody = "";
          }
          const kind = urlLooksUseful(url);
          if (kind === "debot") rememberDebotUrl(url, reqBody);
          // 不改写请求体（保留 GMGN 原生筛选/limit）
          if (kind === "gmgn") {
            rememberGmgnTrenchRequest(reqBody);
            try {
              lastGmgnTrench = {
                url,
                body: reqBody || lastGmgnTrench?.body || "{}",
                method: "POST"
              };
            } catch (_e) {
              // ignore
            }
          }
          const p = origFetch.apply(this, args);
          if (!kind || !p || typeof p.then !== "function") return p;
          return p.then(async (res) => {
            try {
              if (!res || !res.ok || typeof res.clone !== "function") return res;
              const text = await res.clone().text();
              collectHostFeesFromHttp(url, text);
              const next = processBody(url, text, reqBody);
              if (next == null) return res;
              return new Response(next, {
                status: res.status,
                statusText: res.statusText,
                headers: res.headers
              });
            } catch (_e) {
              return res;
            }
          });
        };
        wrapped.__flapFeeTaxRecv = HOOK_VER;
        window.fetch = wrapped;
      }
    } catch (_e) {
      // ignore
    }

    try {
      const XO = XMLHttpRequest.prototype.open;
      const XS = XMLHttpRequest.prototype.send;
      if (XS.__flapFeeTaxRecv !== HOOK_VER) {
        const rtDesc = Object.getOwnPropertyDescriptor(
          XMLHttpRequest.prototype,
          "responseText"
        );
        const respDesc = Object.getOwnPropertyDescriptor(
          XMLHttpRequest.prototype,
          "response"
        );
        const rawText = (xhr) => {
          try {
            if (rtDesc && typeof rtDesc.get === "function") return rtDesc.get.call(xhr);
          } catch (_e) {
            // ignore
          }
          return "";
        };
        const cacheKey = () => {
          const suf = (suffixHidePrefs.rules || [])
            .filter((r) => r && r.enabled !== false && r.suffix)
            .map((r) => r.suffix)
            .join(",");
          return `${taxRecvEnabled ? 1 : 0}:${taxRecvPrefs.thresholdPct}|s${
            suffixHideEnabled ? 1 : 0
          }:${suf}`;
        };

        const filteredText = (xhr) => {
          try {
            const u = xhr.__flapFeeUrl || "";
            if (!urlLooksUseful(u) || xhr.readyState < 4) return null;
            const key = cacheKey();
            if (xhr.__flapFeeFilteredText != null && xhr.__flapFeeFilterKey === key) {
              return xhr.__flapFeeFilteredText;
            }
            const raw = rawText(xhr);
            if (typeof raw !== "string" || raw.length < 2) return null;
            const next = processBody(u, raw, xhr.__flapFeeBody || "");
            xhr.__flapFeeFilterKey = key;
            xhr.__flapFeeFilteredText = next != null ? next : raw;
            xhr.__flapFeeDidFilter = next != null;
            return xhr.__flapFeeFilteredText;
          } catch (_e) {
            return null;
          }
        };

        if (rtDesc && rtDesc.configurable !== false) {
          Object.defineProperty(XMLHttpRequest.prototype, "responseText", {
            configurable: true,
            enumerable: rtDesc.enumerable,
            get: function () {
              const f = filteredText(this);
              if (f != null) return f;
              return rawText(this);
            }
          });
        }
        if (respDesc && respDesc.configurable !== false) {
          Object.defineProperty(XMLHttpRequest.prototype, "response", {
            configurable: true,
            enumerable: respDesc.enumerable,
            get: function () {
              let rt = "";
              try {
                rt = this.responseType || "";
              } catch (_e) {
                rt = "";
              }
              if (rt === "json") {
                const f = filteredText(this);
                if (f != null) {
                  try {
                    return JSON.parse(f);
                  } catch (_p) {
                    // fallthrough
                  }
                }
                try {
                  return respDesc.get.call(this);
                } catch (_e2) {
                  return null;
                }
              }
              if (rt && rt !== "" && rt !== "text") {
                try {
                  return respDesc.get.call(this);
                } catch (_e3) {
                  return null;
                }
              }
              const f = filteredText(this);
              if (f != null) return f;
              try {
                return respDesc.get.call(this);
              } catch (_e4) {
                return rawText(this);
              }
            }
          });
        }

        XMLHttpRequest.prototype.open = function (method, url) {
          try {
            this.__flapFeeUrl = url != null ? String(url) : "";
            this.__flapFeeMethod = method != null ? String(method) : "GET";
            this.__flapFeeBody = "";
            this.__flapFeeFilteredText = null;
            this.__flapFeeFilterKey = "";
            this.__flapFeeDidFilter = false;
          } catch (_e) {
            this.__flapFeeUrl = "";
          }
          return XO.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
          try {
            const u = this.__flapFeeUrl || "";
            const bodyStr = typeof body === "string" ? body : "";
            try {
              this.__flapFeeBody = bodyStr;
            } catch (_bb) {
              // ignore
            }
            const kind = urlLooksUseful(u);
            if (kind === "gmgn") {
              rememberGmgnTrenchRequest(bodyStr);
              // 原样记录，不改 body
              lastGmgnTrench = {
                url: u,
                body: bodyStr || lastGmgnTrench?.body || "{}",
                method: this.__flapFeeMethod || "POST"
              };
            }
            if (kind === "debot") rememberDebotUrl(u, bodyStr);
            const xhr = this;
            xhr.addEventListener("loadend", function () {
              try {
                const u = xhr.__flapFeeUrl || "";
                if (hostFeeUrlLooksUseful(u)) {
                  let text = "";
                  try {
                    text = rawText(xhr);
                  } catch (_rt) {
                    text = "";
                  }
                  if (text && text.length >= 40) collectHostFeesFromHttp(u, text);
                }
                if (urlLooksUseful(u)) void xhr.responseText;
              } catch (_e) {
                // ignore
              }
            });
          } catch (_e) {
            // ignore
          }
          return XS.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send.__flapFeeTaxRecv = HOOK_VER;
      }
    } catch (_e) {
      // ignore
    }
  }

  function ensureTaxRecvRuntime(reason) {
    if (!anyFilterEnabled()) {
      syncGmgnShareWorkerMode(false);
      return;
    }
    syncGmgnShareWorkerMode(true);
    try {
      installTaxRecvNetworkHooks();
    } catch (_inst) {
      try {
        window.__flapFeeTaxRecvNetHooksErr = String(
          (_inst && _inst.message) || _inst
        );
      } catch (_e) {
        // ignore
      }
    }
  }

  /**
   * BSC 页始终安装：从 GMGN s_tal / Debot launchpad_extra 提取徽章快路径数据。
   * 与列表过滤钩子独立；过滤关闭时仍可减少 /modes。
   */
  function installHostFeeNetworkHooks() {
    if (window.__flapFeeHostFeeHooks === HOOK_VER) return;
    if (!isBscPageContext()) return;
    window.__flapFeeHostFeeHooks = HOOK_VER;
    try {
      document.documentElement?.setAttribute("data-flap-host-fee-ver", String(HOOK_VER));
    } catch (_attr) {
      // ignore
    }
    const NativeJSONParse =
      (JSON.parse && JSON.parse.__flapFeeNative) || JSON.parse.bind(JSON);
    try {
      if (!JSON.parse.__flapFeeHostFee) {
        const wrappedParse = function flapFeeHostJsonParse(text, reviver) {
          if (typeof text === "string" && text.length >= 40 && textMightBeHostFeeFeed(text)) {
            try {
              const obj = NativeJSONParse(text);
              collectHostFeesFromJson(obj);
              return reviver !== undefined
                ? NativeJSONParse(JSON.stringify(obj), reviver)
                : obj;
            } catch (_hf) {
              // fallthrough
            }
          }
          return NativeJSONParse(text, reviver);
        };
        wrappedParse.__flapFeeHostFee = HOOK_VER;
        wrappedParse.__flapFeeNative = NativeJSONParse;
        JSON.parse = wrappedParse;
      }
    } catch (_jp) {
      // ignore
    }
    try {
      const origFetch = window.fetch;
      if (typeof origFetch === "function" && !origFetch.__flapFeeHostFee) {
        const wrappedFetch = function flapFeeHostFetch() {
          const args = arguments;
          const input = args[0];
          let url = "";
          try {
            if (typeof input === "string") url = input;
            else if (input && typeof input.url === "string") url = input.url;
          } catch (_u) {
            url = "";
          }
          const p = origFetch.apply(this, args);
          const u = String(url || "");
          if (
            !p ||
            typeof p.then !== "function" ||
            !hostFeeUrlLooksUseful(u)
          ) {
            return p;
          }
          return p.then(async (res) => {
            try {
              if (res && res.ok && typeof res.clone === "function") {
                const text = await res.clone().text();
                collectHostFeesFromHttp(url, text);
              }
            } catch (_e) {
              // ignore
            }
            return res;
          });
        };
        wrappedFetch.__flapFeeHostFee = HOOK_VER;
        window.fetch = wrappedFetch;
      }
    } catch (_f) {
      // ignore
    }
    try {
      installHostFeeXhrTap();
    } catch (_xt) {
      // ignore
    }
    try {
      installHostFeeWebSocketTap();
    } catch (_wt) {
      // ignore
    }
    try {
      installHostFeePortTap();
    } catch (_pt) {
      // ignore
    }
  }

  // ---------- boot：SPA 已装；host-fee 常开；过滤 enabled 时装网络过滤 ----------
  readPrefsSync();
  try {
    if (isBscPageContext()) {
      installHostFeePortTap();
      installHostFeeWebSocketTap();
      installHostFeeXhrTap();
    }
  } catch (_earlyPt) {
    // ignore
  }
  installHostFeeNetworkHooks();
  try {
    installDomHostFeeReactTap();
  } catch (_rt) {
    // ignore
  }
  ensureTaxRecvRuntime("boot");

  try {
    if (typeof MutationObserver === "function" && document.documentElement) {
      new MutationObserver(() => {
        try {
          const before = anyFilterEnabled();
          readPrefsSync();
          if (anyFilterEnabled() !== before) {
            ensureTaxRecvRuntime("attr");
          }
        } catch (_e) {
          // ignore
        }
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: [PREFS_ATTR, SUFFIX_ATTR, VAULT_HIDE_ATTR]
      });
    }
  } catch (_mo) {
    // ignore
  }

  try {
    if (window.__flapFeeHostFeeHooks === HOOK_VER && document.documentElement) {
      document.documentElement.setAttribute("data-flap-host-fee-ver", String(HOOK_VER));
    }
  } catch (_fin) {
    // ignore
  }
})();
