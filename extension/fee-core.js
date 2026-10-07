/**
 * FlapFeeInfo 共享纯逻辑：平台注册表 + 无副作用工具函数。
 * 同一份文件在 ISOLATED（content.js 之前）与 MAIN（page-hook.js 之前）各加载一次，
 * 也被 tests/ 用 Node 直接 require。禁止碰 DOM / chrome.* / 网络。
 */
(function (root) {
  // API 变更必须 +1：插件重载不刷页时 MAIN world 里还留着旧版，同版号会跳过加载。
  const CORE_VER = 4;
  if (root.__flapFeeCore && root.__flapFeeCore.ver === CORE_VER) return;

  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777|ffff)$/i;
  const GENIUS_FUN_SUFFIX_RE = /^0x[a-fA-F0-9]{36}6666$/i;
  // 已迁移 Four 底池（四公主）。只画底池，不进 TARGET、不打 /modes。
  const FOUR_POOL_SUFFIX_RE = /^0x[a-fA-F0-9]{36}4444$/i;

  /**
   * 平台注册表：识别一律「链 + 平台」。
   * - source: "modes" 走后端链上；"host" 只用网站原始数据（缺数据不画、不打 /modes）
   * - launchpad: 匹配宿主 launchpad / launchpad_platform（小写）；数组顺序即优先级
   * - suffix: 尾号快路径（仅提示，宿主给了别的 launchpad 时以宿主为准）
   */
  const PLATFORMS = [
    {
      id: "pons_v2",
      chain: "robinhood",
      source: "host",
      launchpad: /pons_v2/,
      detailUrl: null
    },
    {
      id: "geniusfun",
      chain: "bsc",
      source: "modes",
      launchpad: /genius/,
      suffix: GENIUS_FUN_SUFFIX_RE,
      detailUrl: (ca) => `https://genius.fun/token/${ca}`
    },
    {
      // 精确匹配，避免 homebrew / cheesepad 误伤。尾号常是 6666，不能占 suffix。
      id: "brew",
      chain: "bsc",
      source: "host",
      launchpad: /^brew$/,
      detailUrl: null
    },
    {
      id: "four",
      chain: "bsc",
      source: "modes",
      launchpad: /four/,
      suffix: /^0x[a-fA-F0-9]{36}ffff$/i,
      detailUrl: (ca) => `https://four.meme/zh-TW/token/${ca}`
    },
    {
      // 不设 launchpad：/four/ 必须仍落到上面的 four（ffff 税币打 /modes）。
      id: "four_pool",
      chain: "bsc",
      source: "host",
      suffix: FOUR_POOL_SUFFIX_RE,
      detailUrl: (ca) => `https://four.meme/zh-TW/token/${ca}`
    },
    {
      id: "flap",
      chain: "bsc",
      source: "modes",
      launchpad: /flap/,
      suffix: /^0x[a-fA-F0-9]{36}(8888|7777)$/i,
      detailUrl: (ca, lang) =>
        `https://flap.sh/bnb/${ca}/taxinfo?lang=${lang === "en" ? "en" : "zh"}`
    },
    {
      id: "longxyz",
      chain: "robinhood",
      source: "host",
      // GMGN 带 tax_allocation 才画（js-mcp 2026-09 尚未提供）
      requiresHostAllocation: true,
      launchpad: /longxyz/,
      detailUrl: (ca) => `https://app.long.xyz/tokens/${ca}`
    }
  ];

  const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

  /** 宿主 launchpad 串 → 平台 id；未知返回 ""（调用方可保留原串）。 */
  function platformFromLaunchpad(raw) {
    const lp = String(raw || "").trim().toLowerCase();
    if (!lp) return "";
    for (let i = 0; i < PLATFORMS.length; i += 1) {
      const re = PLATFORMS[i].launchpad;
      if (re && re.test(lp)) return PLATFORMS[i].id;
    }
    return "";
  }

  function platformSpec(id) {
    return PLATFORM_BY_ID.get(String(id || "")) || null;
  }

  /** 按尾号猜平台（仅快路径提示）。 */
  function platformFromSuffix(addr) {
    const a = String(addr || "");
    for (let i = 0; i < PLATFORMS.length; i += 1) {
      const re = PLATFORMS[i].suffix;
      if (re && re.test(a)) return PLATFORMS[i].id;
    }
    return "";
  }

  function taxDetailUrl(platformId, ca, lang) {
    const spec = platformSpec(platformId);
    const addr = String(ca || "").toLowerCase();
    if (!spec || !spec.detailUrl || !/^0x[a-f0-9]{40}$/.test(addr)) return "";
    return spec.detailUrl(addr, lang);
  }

  /** GMGN s_tal 比例（0.99 / 1）或百分数（99）→ bps；≤1 按比例（GMGN 语义）。 */
  function ratioToBps(v) {
    if (v == null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const pct = n > 1.0001 ? n : n * 100;
    return Math.round(Math.min(100, pct) * 100);
  }

  /** Debot launchpad_extra.*_pct 恒为百分比（99 / 1 / 83.33）；1 是 1%。 */
  function pctToBps(v) {
    if (v == null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(Math.min(100, n) * 100);
  }

  /** 金库份额≈100% 且其它段全 0（🎁→CYPH）；🎁50%🔥50% / 🎁96%💎4% 不算。 */
  function isPureVaultShares(vaultBps, otherBps) {
    return vaultBps >= 9990 && otherBps <= 0;
  }

  /** fee entry（host-fee 或 /modes）是否纯税收金库；Genius gift_bps>0 时 market_bps 是厨师段。 */
  function feeEntryIsPureVault(entry) {
    if (!entry || typeof entry !== "object") return false;
    const n = (k) => Number(entry[k]) || 0;
    const gift = n("gift_bps");
    const others =
      n("dividend_bps") +
      n("deflation_bps") +
      n("lp_bps") +
      n("giggle_charity_bps") +
      n("binance_charity_bps") +
      (gift > 0 ? n("market_bps") : 0);
    return isPureVaultShares(Math.max(gift, n("market_bps")), others);
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

  function normalizeCardMarkHandle(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    s = s.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, "");
    s = s.replace(/^@+/, "");
    s = s.split(/[/?#\s]/)[0] || "";
    s = s.replace(/\u2026|\.{2,}$/g, "");
    s = s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (
      !s ||
      s === "search" ||
      s === "intent" ||
      s === "i" ||
      s === "home" ||
      s === "share" ||
      s === "explore"
    ) {
      return "";
    }
    return s;
  }

  function isGeniusFunSuffix(addr) {
    return GENIUS_FUN_SUFFIX_RE.test(String(addr || ""));
  }

  function isFourPoolSuffix(addr) {
    return FOUR_POOL_SUFFIX_RE.test(String(addr || ""));
  }

  /**
   * GMGN 卡片「Tax N%」跟合计税率（默认 trenches.useTotalTax）。
   * bags 按优先级；任一侧出现 total_*（含 "0"）就只用合计，不回落到 buy_tax。
   * 别名：s_tbt/s_tst、totalBuyTax/totalSellTax、s_bt/s_st。
   */
  function gmgnDisplayedTaxBps(bags) {
    const list = Array.isArray(bags) ? bags : [];
    const totalBuyKeys = ["total_buy_tax", "s_tbt", "totalBuyTax"];
    const totalSellKeys = ["total_sell_tax", "s_tst", "totalSellTax"];
    const buyKeys = ["buy_tax", "s_bt", "buyTax"];
    const sellKeys = ["sell_tax", "s_st", "sellTax"];
    const pick = (obj, keys) => {
      if (!obj || typeof obj !== "object") return null;
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const v = obj[k];
        if (v == null || v === "") continue;
        return ratioToBps(v);
      }
      return null;
    };
    for (let i = 0; i < list.length; i += 1) {
      const bag = list[i];
      const tb = pick(bag, totalBuyKeys);
      const ts = pick(bag, totalSellKeys);
      if (tb == null && ts == null) continue;
      return { buy_tax_bps: tb == null ? 0 : tb, sell_tax_bps: ts == null ? 0 : ts };
    }
    for (let i = 0; i < list.length; i += 1) {
      const bag = list[i];
      const b = pick(bag, buyKeys);
      const s = pick(bag, sellKeys);
      if (b == null && s == null) continue;
      return { buy_tax_bps: b == null ? 0 : b, sell_tax_bps: s == null ? 0 : s };
    }
    return { buy_tax_bps: 0, sell_tax_bps: 0 };
  }

  // ---------- 币股篮子（host-fee / 链上 basket_assets 与 Tax 内图对齐） ----------

  function dedupeBasketAssets(rows) {
    const out = [];
    const seenAddr = new Set();
    for (const row of rows || []) {
      if (!row || typeof row !== "object") continue;
      const address = String(row.address || "").toLowerCase();
      const symbol = compactBasketSymbol(row.symbol || row.name || "");
      // basket name 会进 tooltip：剥 <>（issue #1）
      const name = String(row.name || symbol || "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, 48);
      if (!symbol && !name) continue;
      if (address) {
        if (seenAddr.has(address)) continue;
        seenAddr.add(address);
      }
      // 无 address 时不按 symbol 去重：同 symbol 双成分只能靠 address 区分
      out.push({ address, symbol: symbol || compactBasketSymbol(name), name: name || symbol });
    }
    return out;
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

  function basketDisplaySymbols(assets) {
    return (assets || []).map((a) => compactBasketSymbol(a && a.symbol)).filter(Boolean);
  }

  /** 篮子成分名已齐：单成分有 symbol；多成分前两枚可区分。 */
  function basketSymbolsReady(assets) {
    const rows = normalizeBasketAssets(assets);
    if (!rows.length) return false;
    if (rows.length < 2) return Boolean(rows[0] && rows[0].symbol);
    const syms = basketDisplaySymbols(rows);
    if (syms.length < 2) return false;
    return syms[0] !== syms[1];
  }

  /** GMGN 首帧常只给 3–4 枚成分（≥90% 金库/分红）：视为截断，等补齐。 */
  function basketLikelyTruncated(assets, entry) {
    if (!entry || !entry.is_vault) return false;
    const stockish =
      entry.is_stocks_vault === true || (Array.isArray(assets) && assets.length >= 2);
    if (!stockish) return false;
    const n = normalizeBasketAssets(assets).length;
    if (n < 3 || n > 4) return false;
    const mkt = Number(entry.market_bps) || 0;
    const div = Number(entry.dividend_bps) || 0;
    return mkt >= 9000 || div >= 9000;
  }

  function isSingleAssetStockVault(entry) {
    if (!entry || !entry.is_vault) return false;
    if (normalizeBasketAssets(entry.basket_assets).length !== 1) return false;
    return (Number(entry.market_bps) || 0) >= 10000 && (Number(entry.dividend_bps) || 0) === 0;
  }

  /** 篮子成分按 Tax 内图顺序对齐；禁止用 Tax 残留图发明新成分。 */
  function mergeBasketWithTaxDomSymbols(assets, domSyms, entry) {
    const rows = normalizeBasketAssets(assets);
    if (!domSyms || !domSyms.length) return rows;
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
      if (!(matched && matched.address) && rows.length >= 5) continue;
      usedSym.add(sym);
      if (matched && matched.address) usedAddr.add(matched.address);
      if (matched) {
        const msym = compactBasketSymbol(matched.symbol) || sym;
        usedSym.add(msym);
        next.push({ address: matched.address || "", symbol: msym, name: matched.name || msym });
        continue;
      }
      // 地推币纯金库 leftover FXIO 不得变 📈：只有确认币股且无成分时才用图补
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

  // ---------- 其它共享规则 ----------

  /** 自定义尾号规则匹配（门禁各自在 content / page-hook 做）。 */
  function suffixRulesMatch(rules, addr) {
    const a = String(addr || "").trim().toLowerCase();
    if (!a.startsWith("0x") || a.length < 6 || !Array.isArray(rules)) return false;
    for (let i = 0; i < rules.length; i += 1) {
      const r = rules[i];
      if (!r || r.enabled === false) continue;
      const s = String(r.suffix || "").toLowerCase();
      if (s && a.endsWith(s)) return true;
    }
    return false;
  }

  /**
   * 虚拟列表复用 TokenItem：href 换了但 Tax 内图签名没变 → 内图是上一张卡的残留。
   * 纯状态机；DOM 取 href / sig 由调用方做。返回 { stale, next }，next 写回各自的 WeakMap。
   */
  function evmAddr40(raw) {
    const m = String(raw || "")
      .toLowerCase()
      .match(/0x[a-f0-9]{40}/);
    return m ? m[0] : "";
  }

  function pushTaxRecvAddr(out, seen, raw) {
    if (out.length >= 16) return;
    const a = evmAddr40(raw);
    if (!a || seen.has(a)) return;
    seen.add(a);
    out.push(a);
  }

  /** 收款钱包：market/fee/dev/founder/creator，以及 marketing_recipients。不收代币 CA。 */
  function collectTaxRecvFields(out, seen, obj) {
    if (!obj || typeof obj !== "object") return;
    pushTaxRecvAddr(out, seen, obj.market_address);
    pushTaxRecvAddr(out, seen, obj.fee_receiver);
    pushTaxRecvAddr(out, seen, obj.vault_address);
    pushTaxRecvAddr(out, seen, obj.dev_address);
    pushTaxRecvAddr(out, seen, obj.founder_address);
    pushTaxRecvAddr(out, seen, obj.creator);
    pushTaxRecvAddr(out, seen, obj.creator_address);
    pushTaxRecvAddr(out, seen, obj.d_ct);
    const recs = obj.marketing_recipients;
    if (!Array.isArray(recs)) return;
    for (let i = 0; i < recs.length; i += 1) {
      const row = recs[i];
      if (!row || typeof row !== "object") {
        pushTaxRecvAddr(out, seen, row);
        continue;
      }
      pushTaxRecvAddr(out, seen, row.address);
      pushTaxRecvAddr(out, seen, row.addr);
      pushTaxRecvAddr(out, seen, row.wallet);
    }
  }

  function taxRecvAddresses(item, talOrExtra) {
    const out = [];
    const seen = new Set();
    collectTaxRecvFields(out, seen, talOrExtra);
    collectTaxRecvFields(out, seen, item);
    if (item && typeof item === "object") {
      collectTaxRecvFields(out, seen, item.f);
      collectTaxRecvFields(out, seen, item.meta);
      if (item.launchpad_extra && item.launchpad_extra !== talOrExtra) {
        collectTaxRecvFields(out, seen, item.launchpad_extra);
      }
      const meta = item.meta;
      if (
        meta &&
        typeof meta === "object" &&
        meta.launchpad_extra &&
        meta.launchpad_extra !== talOrExtra
      ) {
        collectTaxRecvFields(out, seen, meta.launchpad_extra);
      }
    }
    return out;
  }

  /** allow 为 Set（已规范化）或 {address,enabled}[]。空名单 / 规则关闭 → false。 */
  function taxRecvAllowHit(allow, addrs) {
    if (!allow || addrs == null) return false;
    const list = Array.isArray(addrs) ? addrs : [addrs];
    if (!list.length) return false;
    const asSet = typeof Set !== "undefined" && allow instanceof Set;
    if (asSet) {
      if (!allow.size) return false;
    } else if (!Array.isArray(allow) || !allow.length) {
      return false;
    }
    for (let i = 0; i < list.length; i += 1) {
      const a = evmAddr40(list[i]);
      if (!a) continue;
      if (asSet) {
        if (allow.has(a)) return true;
        continue;
      }
      for (let j = 0; j < allow.length; j += 1) {
        const r = allow[j];
        if (r && typeof r === "object" && r.enabled === false) continue;
        const raw = r && typeof r === "object" ? r.address || r.addr : r;
        if (evmAddr40(raw) === a) return true;
      }
    }
    return false;
  }

  function taxInnerReuseStep(prev, href, sig) {
    if (prev && prev.href && href && prev.href !== href) {
      const stale = Boolean(sig) && sig === prev.sig;
      return { stale, next: { href, sig: stale ? prev.sig : sig, frozen: stale } };
    }
    if (prev && prev.frozen && prev.href === href) {
      if (sig === prev.sig) return { stale: true, next: prev };
      return { stale: false, next: { href, sig, frozen: false } };
    }
    return { stale: false, next: { href, sig, frozen: false } };
  }

  const api = Object.freeze({
    ver: CORE_VER,
    TARGET_TOKEN_RE,
    GENIUS_FUN_SUFFIX_RE,
    FOUR_POOL_SUFFIX_RE,
    PLATFORMS,
    platformFromLaunchpad,
    platformSpec,
    platformFromSuffix,
    taxDetailUrl,
    ratioToBps,
    pctToBps,
    isPureVaultShares,
    feeEntryIsPureVault,
    compactBasketSymbol,
    basketSymbolMatchesDom,
    normalizeCardMarkHandle,
    isGeniusFunSuffix,
    isFourPoolSuffix,
    gmgnDisplayedTaxBps,
    dedupeBasketAssets,
    normalizeBasketAssets,
    basketDisplaySymbols,
    basketSymbolsReady,
    basketLikelyTruncated,
    isSingleAssetStockVault,
    mergeBasketWithTaxDomSymbols,
    suffixRulesMatch,
    taxRecvAddresses,
    taxRecvAllowHit,
    taxInnerReuseStep
  });
  try {
    Object.defineProperty(root, "__flapFeeCore", {
      value: api,
      configurable: true,
      enumerable: false,
      writable: false
    });
  } catch (_def) {
    root.__flapFeeCore = api;
  }
  if (typeof module === "object" && module && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
