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
  const HOOK_VER = 56;
  /** 仅当列表过滤开启时，由插件临时写入，关闭时清理 */
  const OWNED_DISABLE_SW = "flapFeeInfo.ownedDisableShareWorker";
  const PREFS_ATTR = "data-flap-tax-recv";
  const LS_KEY = "flapFeeInfo.taxRecvHide.v1";
  const SUFFIX_ATTR = "data-flap-suffix-hide";
  const SUFFIX_LS_KEY = "flapFeeInfo.suffixHide.v1";
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
  const prev = Number(window.__flapFeeInfoPageHook) || 0;
  if (prev >= HOOK_VER) return;
  window.__flapFeeInfoPageHook = HOOK_VER;

  /**
   * @type {Map<string, { item: object, firstSeen: number, lastSeen: number, kind: string }>}
   */
  const ncKeepPool = new Map();

  const NativeWebSocket = window.WebSocket;
  const NativeSharedWorker = window.SharedWorker;

  /** @type {{ enabled: boolean, thresholdPct: number }} */
  let taxRecvPrefs = { enabled: false, thresholdPct: 100 };
  let taxRecvEnabled = false;
  /** @type {{ enabled: boolean, rules: Array<{suffix:string, enabled:boolean}> }} */
  let suffixHidePrefs = { enabled: false, rules: [] };
  let suffixHideEnabled = false;

  let lastGmgnTrench = null;
  /** @type {string[]} */
  let lastDebotRanksUrls = [];

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
      // /meme 无 chain 时不主动滤（content 管徽章）；避免他链误伤
      return false;
    } catch (_e) {
      return false;
    }
  }

  /** 任一侧列表过滤开启（资金接收 or 自定义尾号） */
  function anyFilterEnabled() {
    return taxRecvEnabled || suffixHideEnabled;
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
  function gmgnCreatorRecvPct(tal) {
    if (!tal || typeof tal !== "object") return null;
    if (isGmgnVaultTal(tal)) return null;

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
    // 资金接收方：仅目标税币 + s_tal
    if (!taxRecvEnabled) return false;
    // 双保险：无尾号不屏蔽
    if (!isTargetTaxTokenAddr(addr)) return false;
    const tal = gmgnTal(t);
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

    const pct = gmgnCreatorRecvPct(tal);
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
    if (!taxRecvEnabled) return false;
    if (!isTargetTaxTokenAddr(contract)) return false;
    const meta = row.meta && typeof row.meta === "object" ? row.meta : null;
    const extra = (meta && meta.launchpad_extra) || row.launchpad_extra;
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
    for (const [addr, ent] of [...ncKeepPool.entries()]) {
      if (!ent || now - ent.firstSeen > NC_KEEP_MAX_AGE_MS) {
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
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const addr = ncItemAddr(item, kind);
      if (!addr || !/^0x[a-f0-9]{40}$/.test(addr)) continue;
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
      if (now - ent.firstSeen > NC_KEEP_MAX_AGE_MS) continue;
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
        maxAgeMs: NC_KEEP_MAX_AGE_MS,
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
    let kept = 0;
    let w = 0;
    for (let i = 0; i < data.r.length; i++) {
      const addr = String(data.r[i] || "")
        .trim()
        .toLowerCase();
      if (addr && ncKeepPool.has(addr)) {
        const ent = ncKeepPool.get(addr);
        if (ent && now - ent.firstSeen <= NC_KEEP_MAX_AGE_MS) {
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
   * 开启屏蔽时：不要用缓存的旧 body 重拉 trenches。
   * 旧 body 往往不含用户刚改的 GMGN 原生筛选，会表现为「站内筛选失效」。
   * 列表刷新改由 content 整页 reload / 用户自己的请求管道完成。
   * Debot v4：softRefresh 必须带原 POST JSON（column 在 body）。
   */
  function softRefreshLists() {
    // intentionally no-op for GMGN request replay
    if (!prefsOn()) return;
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
          if (anyFilterEnabled() && !was) {
            queueMicrotask(softRefreshLists);
          }
        }
        if (data.type === "tax-recv-refresh") {
          if (anyFilterEnabled()) queueMicrotask(softRefreshLists);
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
      const nativePortOm = Object.getOwnPropertyDescriptor(
        MessagePort.prototype,
        "onmessage"
      );
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
      const nativePortAdd = MessagePort.prototype.addEventListener;
      const nativePortRm = MessagePort.prototype.removeEventListener;
      if (typeof nativePortAdd === "function") {
        MessagePort.prototype.addEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            return nativePortAdd.call(
              this,
              type,
              wrapPortMessageFn(listener, "port-add"),
              opt
            );
          }
          return nativePortAdd.call(this, type, listener, opt);
        };
      }
      if (typeof nativePortRm === "function") {
        MessagePort.prototype.removeEventListener = function (type, listener, opt) {
          if (type === "message" && typeof listener === "function") {
            const w = portFnWrapMap.get(listener);
            if (w) return nativePortRm.call(this, type, w, opt);
          }
          return nativePortRm.call(this, type, listener, opt);
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
    function shouldHookWsUrl(url) {
      const u = String(url || "");
      if (!u) return false;
      if (/latency|rtt|health|speed-test|sub-tx-hash|helius|rpc/i.test(u)) return false;
      if (/portal-ws/i.test(u) && /debot\.ai|gungnir/i.test(u)) return true;
      if (/sgws\.debot\.ai/i.test(u)) return true;
      // GMGN 战壕实时（主线程 polyfill 或直连）
      if (/wss?:\/\//i.test(u) && (/ws\.gmgn\.ai/i.test(u) || /ws\.wenmoon\.cc/i.test(u))) {
        return true;
      }
      if (/wss?:\/\//i.test(u) && /gmgn\.ai/i.test(u)) return true;
      return false;
    }

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

    const NativeJSONParse = JSON.parse.bind(JSON);

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
          if (
            prefsOn() &&
            typeof text === "string" &&
            text.length >= 40 &&
            (text.charAt(0) === "{" || text.charAt(0) === "[") &&
            (text.indexOf("trenches_delta") !== -1 ||
              text.indexOf("trenches_update") !== -1 ||
              (text.indexOf("s_tal") !== -1 && text.indexOf("marketing") !== -1))
          ) {
            try {
              const obj = NativeJSONParse(text);
              if (obj && typeof obj === "object") {
                let removed = filterGmgnTrenchesDeltaInPlace(obj);
                let padded = 0;
                if (removed <= 0) {
                  removed = filterJsonInPlace(obj, "auto");
                  padded =
                    (window.__flapFeeNcKeep &&
                      Number(window.__flapFeeNcKeep.padded)) ||
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
              }
            } catch (_fe) {
              // fallthrough
            }
          }
          return NativeJSONParse(text, reviver);
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
                if (urlLooksUseful(xhr.__flapFeeUrl || "")) void xhr.responseText;
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

  // ---------- boot：SPA 已装；仅 enabled 时装网络过滤 ----------
  readPrefsSync();
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
        attributeFilter: [PREFS_ATTR, SUFFIX_ATTR]
      });
    }
  } catch (_mo) {
    // ignore
  }
})();
