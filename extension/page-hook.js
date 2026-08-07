/**
 * PAGE main world · document_start（早于页面脚本）
 *
 * 懒挂载（建议 A）：
 *   · 默认只装 SPA history 桥（对齐 0.5.25）
 *   · 仅 tax-recv enabled 时 installTaxRecvNetworkHooks()
 *     （XHR/fetch/WS/MessagePort/SharedWorker/JSON.parse）
 *   · 开屏蔽时 owned 写 gmgn disableShareWorker；关则清理
 * ★ 仅 7777/8888；禁止 DOM reflow / 乱包 dedicated Worker
 */
(() => {
  const HOOK_VER = 46;
  /** 仅当「资金接收方屏蔽」开启时，由插件临时写入，关闭时清理 */
  const OWNED_DISABLE_SW = "flapFeeInfo.ownedDisableShareWorker";
  const PREFS_ATTR = "data-flap-tax-recv";
  const LS_KEY = "flapFeeInfo.taxRecvHide.v1";
  /** 与 content.js TARGET_TOKEN_RE 一致 */
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777)$/i;
  const prev = Number(window.__flapFeeInfoPageHook) || 0;
  if (prev >= HOOK_VER) return;
  window.__flapFeeInfoPageHook = HOOK_VER;

  const NativeWebSocket = window.WebSocket;
  const NativeSharedWorker = window.SharedWorker;

  /** @type {{ enabled: boolean, thresholdPct: number }} */
  let taxRecvPrefs = { enabled: false, thresholdPct: 100 };
  let taxRecvEnabled = false;

  let lastGmgnTrench = null;
  /** @type {string[]} */
  let lastDebotRanksUrls = [];

  // ---------- prefs ----------
  function applyPrefsObject(p) {
    if (!p || typeof p !== "object") return;
    taxRecvPrefs = {
      enabled: p.enabled === true,
      thresholdPct: Math.max(1, Math.min(100, Math.round(Number(p.thresholdPct) || 100)))
    };
    taxRecvEnabled = taxRecvPrefs.enabled === true;
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
      if (!raw) return;
      applyPrefsObject(JSON.parse(raw));
    } catch (_e) {
      // ignore
    }
  }

  let lastAttrSyncAt = 0;
  function prefsOn() {
    if (taxRecvEnabled) return true;
    const now = Date.now();
    if (now - lastAttrSyncAt >= 80) {
      lastAttrSyncAt = now;
      readPrefsSync();
    }
    return taxRecvEnabled;
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
    // 双保险：无尾号不屏蔽
    if (!isTargetTaxTokenAddr(gmgnAddr(t))) return false;
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

    const thr = taxRecvPrefs.thresholdPct;
    const pct = gmgnCreatorRecvPct(tal);
    if (pct == null) return false;
    // marketing% ≥ 阈值 → 屏蔽（含部分 👨‍🍳 的 hybrid）
    return pct + 1e-9 >= thr;
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
    if (!isTargetTaxTokenAddr(row.contract)) return false;
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
    return pct + 1e-9 >= taxRecvPrefs.thresholdPct;
  }

  function tokenShouldHide(item) {
    if (isGmgnTokenItem(item) && gmgnTokenHide(item)) return true;
    if (isDebotTokenItem(item) && debotRowHide(item)) return true;
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

  function isDebotNewCreationRanksUrl(url) {
    const u = String(url || "");
    if (!u) return false;
    try {
      const parsed = new URL(u, "https://debot.ai");
      const col = String(parsed.searchParams.get("column") || "")
        .trim()
        .toLowerCase();
      if (col) return col === "new" || col === "new_creation" || col === "newcreation";
    } catch (_e) {
      // ignore
    }
    return /[?&]column=new(?:&|#|$)/i.test(u);
  }

  function filterTokenArrayInPlace(arr, kind) {
    if (!Array.isArray(arr)) return 0;
    const hideFn = (item) => {
      if (kind === "gmgn") return isGmgnTokenItem(item) && gmgnTokenHide(item);
      if (kind === "debot") return isDebotTokenItem(item) && debotRowHide(item);
      return tokenShouldHide(item);
    };
    const isTok = (item) => {
      if (kind === "gmgn") return isGmgnTokenItem(item);
      if (kind === "debot") return isDebotTokenItem(item);
      return isGmgnTokenItem(item) || isDebotTokenItem(item);
    };
    let removed = 0;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (isTok(item) && hideFn(item)) {
        removed += 1;
        try {
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
        if (isGmgnTokenItem(row) && gmgnTokenHide(row)) {
          removed += 1;
          const addr = gmgnAddr(row);
          if (addr) hideAddrs.add(addr);
          noteRemovedSample(addr, gmgnTal(row), "delta-nc");
          continue;
        }
        // 存活的税币进 keepPool，供新创建 HTTP 滤空后回填
        try {
          if (isGmgnTokenItem(row)) rememberKeepToken(row, "new_creation");
        } catch (_rk) {
          // ignore
        }
        data.t[w++] = row;
      }
      data.t.length = w;
      // a = 本帧 add 列表：只剔除我们屏蔽的 7777/8888，绝不动其它 CA
      if (Array.isArray(data.a) && hideAddrs.size > 0) {
        let wa = 0;
        for (let i = 0; i < data.a.length; i++) {
          const addr = String(data.a[i] || "")
            .trim()
            .toLowerCase();
          if (addr && hideAddrs.has(addr)) continue;
          data.a[wa++] = data.a[i];
        }
        data.a.length = wa;
      }
    }
    return removed;
  }

  /**
   * 原地从数组/对象属性中删除应藏 token。
   * GMGN：只动 new_creation（HTTP）+ 已判定为 nc 的 delta；不扫即将打满/已开盘。
   * Debot：仅用于 column=new 的 ranks 响应整包（调用方保证 URL）。
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
      return removed;
    }
    // Debot ranks（整响应即一列）：深 walk 删 hide token
    const hideFn = (item) => isDebotTokenItem(item) && debotRowHide(item);
    const isTok = (item) => isDebotTokenItem(item);
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
        for (const k of Object.keys(o)) {
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
      if (removed > 0) {
        scrubGmgnDeltaAddList(data);
        noteFilter({
          channel,
          removed,
          thr: taxRecvPrefs.thresholdPct,
          kind: "auto"
        });
        return { data, changed: true, drop: false };
      }
    } catch (_e) {
      try {
        const clone = JSON.parse(JSON.stringify(data));
        const removed = filterJsonInPlace(clone, "auto");
        if (removed > 0) {
          scrubGmgnDeltaAddList(clone);
          noteFilter({
            channel,
            removed,
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
    if (u.includes("/dashboard/meme/v3/ranks") || u.includes("meme/v3/ranks")) {
      return "debot";
    }
    return false;
  }

  function rememberDebotUrl(url) {
    const u = String(url || "");
    if (!u) return;
    // 只记新创建 ranks，softRefresh 不误拉即将打满/已迁移
    if (!isDebotNewCreationRanksUrl(u)) return;
    lastDebotRanksUrls = lastDebotRanksUrls.filter((x) => x !== u);
    lastDebotRanksUrls.unshift(u);
    if (lastDebotRanksUrls.length > 8) lastDebotRanksUrls.length = 8;
  }

  /**
   * 服务端 trenches_rank 的 limit 实测硬顶 60（传 280 仍只回 60）。
   * 新创建列 thr=20 时约 80% 纯 👨‍🍳，滤完只剩 ~12 → 列表「空」。
   * keepPool：跨响应/WS 记住非屏蔽 7777/8888，滤后回填列到接近原生密度。
   */
  const KEEP_POOL_SS = "flapFeeInfo.taxKeepPool.v1";
  /** @type {Map<string, { t: object, at: number, col: string }>} */
  const keepPool = new Map();
  /** FIFO 地址序，避免热路径 sort 驱逐 */
  const keepPoolOrder = [];
  let keepPoolLoaded = false;
  let keepPoolSaveAt = 0;
  const KEEP_POOL_SAVE_MIN_MS = 8000;
  // 仅回填新创建（屏蔽只影响该列）
  const COL_PAD_TARGET = {
    new_creation: 52
  };

  function loadKeepPool() {
    if (keepPoolLoaded) return;
    keepPoolLoaded = true;
    try {
      const raw = sessionStorage.getItem(KEEP_POOL_SS);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        const row = arr[i];
        if (!row || !row.a || !row.tok || typeof row.tok !== "object") continue;
        const a = String(row.a).toLowerCase();
        if (!isTargetTaxTokenAddr(a)) continue;
        if (keepPool.has(a)) continue;
        keepPool.set(a, {
          t: row.tok,
          at: Number(row.at) || 0,
          col: typeof row.col === "string" ? row.col : ""
        });
        keepPoolOrder.push(a);
      }
    } catch (_e) {
      // ignore
    }
  }

  function saveKeepPool(force) {
    const now = Date.now();
    if (!force && now - keepPoolSaveAt < KEEP_POOL_SAVE_MIN_MS) return;
    keepPoolSaveAt = now;
    try {
      // 只持久化最近 80 条，避免 sessionStorage 大 JSON 卡住主线程
      const start = Math.max(0, keepPoolOrder.length - 80);
      const arr = [];
      for (let i = start; i < keepPoolOrder.length; i++) {
        const a = keepPoolOrder[i];
        const v = keepPool.get(a);
        if (!v || !v.t) continue;
        arr.push({ a, tok: v.t, at: v.at, col: v.col || "" });
      }
      sessionStorage.setItem(KEEP_POOL_SS, JSON.stringify(arr));
    } catch (_e) {
      // quota / private mode
    }
  }

  function rememberKeepToken(item, col) {
    if (!item || typeof item !== "object") return;
    const addr = gmgnAddr(item);
    if (!isTargetTaxTokenAddr(addr)) return;
    if (!gmgnTal(item)) return;
    if (gmgnTokenHide(item)) return;
    const prev = keepPool.get(addr);
    const now = Date.now();
    // 热路径：已在池内且 3s 内只刷新时间戳，避免反复挂大对象/写序
    if (prev && now - (prev.at || 0) < 3000) {
      prev.at = now;
      if (col && !prev.col) prev.col = col;
      return;
    }
    if (!prev) keepPoolOrder.push(addr);
    keepPool.set(addr, {
      t: item,
      at: now,
      col: col || (prev && prev.col) || ""
    });
    // FIFO 驱逐，禁止 sort（滚动时 WS 高频）
    while (keepPoolOrder.length > 180) {
      const old = keepPoolOrder.shift();
      if (old) keepPool.delete(old);
    }
  }

  function rememberTokensFromGmgnRoot(root) {
    if (!root || typeof root !== "object") return;
    // 屏蔽仅新创建：池子也只记该列，避免把即将打满/已开盘塞进新创建
    const tokens = root.new_creation && root.new_creation.tokens;
    if (!Array.isArray(tokens)) return;
    for (let i = 0; i < tokens.length; i++) {
      rememberKeepToken(tokens[i], "new_creation");
    }
  }

  function padGmgnColumnTokens(tokens, col) {
    if (!Array.isArray(tokens)) return 0;
    const target = COL_PAD_TARGET[col] || 48;
    if (tokens.length >= target) return 0;
    loadKeepPool();
    const have = new Set();
    for (let i = 0; i < tokens.length; i++) {
      const a = gmgnAddr(tokens[i]);
      if (a) have.add(a);
    }
    let added = 0;
    // 从新到旧扫 FIFO 尾部，不做全表 sort
    const tryPad = (sameColOnly) => {
      for (let i = keepPoolOrder.length - 1; i >= 0; i--) {
        if (tokens.length >= target) return;
        const a = keepPoolOrder[i];
        const v = a ? keepPool.get(a) : null;
        if (!a || !v || !v.t || have.has(a)) continue;
        if (gmgnTokenHide(v.t)) {
          keepPool.delete(a);
          continue;
        }
        if (sameColOnly && v.col && col && v.col !== col) continue;
        tokens.push(v.t);
        have.add(a);
        added += 1;
      }
    };
    tryPad(true);
    if (tokens.length < target) tryPad(false);
    return added;
  }

  function padGmgnTrenchesAfterFilter(json) {
    if (!json || typeof json !== "object") return { padded: 0 };
    const root = json.data && (json.data["0"] || json.data[0] || json.data);
    if (!root || typeof root !== "object") return { padded: 0 };
    let padded = 0;
    const per = {};
    // 只垫新创建
    const tokens = root.new_creation && root.new_creation.tokens;
    if (Array.isArray(tokens)) {
      const n = padGmgnColumnTokens(tokens, "new_creation");
      per.new_creation = n;
      padded += n;
    }
    if (padded > 0) saveKeepPool();
    return { padded, per };
  }

  /** 尝试抬 limit（服务端可能仍顶 60；保留无害） */
  function expandGmgnTrenchesRequestBody(bodyStr) {
    if (!prefsOn() || bodyStr == null || typeof bodyStr !== "string" || bodyStr.length < 8) {
      return bodyStr;
    }
    try {
      const json = JSON.parse(bodyStr);
      const params = json && Array.isArray(json.params) ? json.params : null;
      if (!params || !params.length) return bodyStr;
      let changed = false;
      // 仅抬新创建 limit（其它列不屏蔽，无需抬）
      const COL_MIN = {
        new_creation: 280
      };
      for (let i = 0; i < params.length; i++) {
        const p = params[i];
        if (!p || typeof p !== "object") continue;
        for (const col of Object.keys(COL_MIN)) {
          const block = p[col];
          if (!block || typeof block !== "object") continue;
          const want = COL_MIN[col];
          const cur = Number(block.limit);
          if (!Number.isFinite(cur) || cur < want) {
            block.limit = want;
            changed = true;
          }
        }
      }
      if (!changed) return bodyStr;
      return JSON.stringify(json);
    } catch (_e) {
      return bodyStr;
    }
  }

  function processBody(url, text) {
    const kind = urlLooksUseful(url);
    if (!kind || !text || text.length < 2) return null;
    if (!prefsOn()) return null;
    // Debot：三列分请求；仅 column=new（新创建）过滤
    if (kind === "debot" && !isDebotNewCreationRanksUrl(url)) {
      return null;
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (_e) {
      return null;
    }
    try {
      loadKeepPool();
      // 诊断：新创建 tokens 过滤前后数量
      let colStats = null;
      if (kind === "gmgn") {
        try {
          const root = json && json.data && (json.data["0"] || json.data[0] || json.data);
          if (root && typeof root === "object") {
            // 滤前：只记新创建非屏蔽税币
            rememberTokensFromGmgnRoot(root);
            colStats = {};
            const tokens = root.new_creation && root.new_creation.tokens;
            if (Array.isArray(tokens)) colStats.new_creation = { before: tokens.length };
          }
        } catch (_s) {
          colStats = null;
        }
      }
      const removed = filterJsonInPlace(json, kind);
      let padInfo = { padded: 0 };
      if (kind === "gmgn") {
        padInfo = padGmgnTrenchesAfterFilter(json);
        saveKeepPool();
      }
      if (colStats) {
        try {
          const root = json && json.data && (json.data["0"] || json.data[0] || json.data);
          for (const col of Object.keys(colStats)) {
            const tokens = root && root[col] && root[col].tokens;
            colStats[col].after = Array.isArray(tokens) ? tokens.length : -1;
            colStats[col].pad = (padInfo.per && padInfo.per[col]) || 0;
          }
          window.__flapFeeTrenchColStats = {
            ...colStats,
            removed,
            padded: padInfo.padded,
            pool: keepPool.size,
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
        padded: padInfo.padded || 0,
        pool: keepPool.size,
        rawLen: text.length,
        thr: taxRecvPrefs.thresholdPct,
        cols: colStats || undefined
      });
      // 有删除或有回填都要改写 body
      if (removed <= 0 && !(padInfo.padded > 0)) return null;
      return JSON.stringify(json);
    } catch (_e2) {
      return null;
    }
  }

  function softRefreshLists() {
    // 开启时重拉列表（过滤后写入 React）；关闭时由 content 整页 reload 恢复
    if (!prefsOn()) return;
    try {
      if (lastGmgnTrench && lastGmgnTrench.url) {
        const { url, method } = lastGmgnTrench;
        let body = lastGmgnTrench.body || "{}";
        body = expandGmgnTrenchesRequestBody(body) || body;
        const xhr = new XMLHttpRequest();
        xhr.open(method || "POST", url);
        try {
          xhr.setRequestHeader("Content-Type", "application/json");
        } catch (_h) {
          // ignore
        }
        xhr.send(body);
      }
    } catch (_e) {
      // ignore
    }
    try {
      for (const u of lastDebotRanksUrls.slice(0, 6)) {
        window.fetch(u, { credentials: "include", cache: "no-store" }).catch(() => {});
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
          const was = taxRecvEnabled;
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
            ensureTaxRecvRuntime(taxRecvEnabled ? "prefs-on" : "prefs-off");
          }
          if (taxRecvEnabled && (!was || data.refresh === true)) {
            queueMicrotask(softRefreshLists);
          }
        }
        if (data.type === "tax-recv-refresh") {
          if (taxRecvEnabled) queueMicrotask(softRefreshLists);
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
      if (enabled) {
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
    try {
      loadKeepPool();
    } catch (_lp) {
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
          if (removed > 0) {
            scrubGmgnDeltaAddList(clone);
            shape = isDelta ? "delta" : "feed";
          }
        }
        if (removed <= 0) return null;
        noteFilter({
          channel: channel || "ws",
          removed,
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
                if (removed <= 0) {
                  removed = filterJsonInPlace(obj, "auto");
                  if (removed > 0) scrubGmgnDeltaAddList(obj);
                }
                if (removed > 0) {
                  noteFilter({
                    channel: "json-parse",
                    removed,
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
          try {
            if (typeof input === "string") url = input;
            else if (input && typeof input.url === "string") url = input.url;
          } catch (_e) {
            url = "";
          }
          const kind = urlLooksUseful(url);
          if (kind === "debot") rememberDebotUrl(url);
          let nextArgs = args;
          if (kind === "gmgn") {
            try {
              let body = null;
              if (init && init.body != null) {
                body = typeof init.body === "string" ? init.body : null;
              }
              if (body && prefsOn()) {
                const boosted = expandGmgnTrenchesRequestBody(body);
                if (boosted && boosted !== body) {
                  const nextInit = Object.assign({}, init || {}, { body: boosted });
                  nextArgs = [input, nextInit];
                  body = boosted;
                }
              }
              lastGmgnTrench = {
                url,
                body: body || lastGmgnTrench?.body || "{}",
                method: "POST"
              };
            } catch (_e) {
              // ignore
            }
          }
          const p = origFetch.apply(this, nextArgs);
          if (!kind || !p || typeof p.then !== "function") return p;
          return p.then(async (res) => {
            try {
              if (!res || !res.ok || typeof res.clone !== "function") return res;
              const text = await res.clone().text();
              const next = processBody(url, text);
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
        const cacheKey = () =>
          `${taxRecvEnabled ? 1 : 0}:${taxRecvPrefs.thresholdPct}`;

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
            const next = processBody(u, raw);
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
            this.__flapFeeFilteredText = null;
            this.__flapFeeFilterKey = "";
            this.__flapFeeDidFilter = false;
          } catch (_e) {
            this.__flapFeeUrl = "";
          }
          return XO.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
          let sendBody = body;
          try {
            const u = this.__flapFeeUrl || "";
            const kind = urlLooksUseful(u);
            if (kind === "gmgn") {
              if (typeof sendBody === "string" && prefsOn()) {
                const boosted = expandGmgnTrenchesRequestBody(sendBody);
                if (boosted && boosted !== sendBody) sendBody = boosted;
              }
              lastGmgnTrench = {
                url: u,
                body: typeof sendBody === "string" ? sendBody : lastGmgnTrench?.body || "{}",
                method: this.__flapFeeMethod || "POST"
              };
            }
            if (kind === "debot") rememberDebotUrl(u);
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
          if (sendBody !== body) return XS.call(this, sendBody);
          return XS.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send.__flapFeeTaxRecv = HOOK_VER;
      }
    } catch (_e) {
      // ignore
    }
  }

  function ensureTaxRecvRuntime(reason) {
    if (!taxRecvEnabled) {
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
          const before = taxRecvEnabled;
          readPrefsSync();
          if (taxRecvEnabled !== before) {
            ensureTaxRecvRuntime("attr");
          }
        } catch (_e) {
          // ignore
        }
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: [PREFS_ATTR]
      });
    }
  } catch (_mo) {
    // ignore
  }
})();
