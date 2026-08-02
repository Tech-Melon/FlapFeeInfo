(() => {
  const DEFAULT_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";
  const TOKEN_RE = /0x[a-fA-F0-9]{40}/;
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777)$/;
  const SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}[a-fA-F0-9]{2,6}/i;
  const TARGET_SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}(8888|7777)/i;
  const SCAN_INTERVAL_MS = 500;
  const REQUEST_TIMEOUT_MS = 28000;
  // Background tabs freeze timers; if a batch never finishes, unblock after this wall time.
  const BATCH_STUCK_MS = 45000;
  // On tab resume, force-kill in-flight fetch if older than this (avoid Abort cascade on short blurs).
  const RESUME_FORCE_MIN_AGE_MS = 8000;
  // After long background, force full badge remount for this window (GMGN recycles DOM silently).
  const RESUME_FORCE_REMOUNT_MS = 12000;
  // Hidden longer than this → treat as long freeze (timers/fetch may be dead).
  const RESUME_LONG_HIDDEN_MS = 5000;
  // Debot three-column meme boards can expose 100+ 7777 cards in view.
  const MAX_CANDIDATES_PER_SCAN = 240;
  const MAX_CARDS_PER_SCAN = 120;
  const MAX_BATCH_TOKENS = 120;
  const BATCH_FLUSH_MS = 350;
  const RETRY_BASE_MS = 900;
  const RETRY_MAX_MS = 12000;
  const PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  // v3: top_payout_symbol always annotated on largest tax segment (→SYM never omitted).
  const PERSISTENT_CACHE_KEY = "flapFeeInfo.modeCache.v3";
  // Popup toggles: which badge parts to show (default all true).
  const DISPLAY_PREFS_KEY = "flapFeeInfo.displayPrefs.v1";
  const DEFAULT_DISPLAY_PREFS = {
    pool: true,
    holder: true,
    creator: true,
    gift: true,
    burn: true,
    lp: true,
    payoutArrow: true,
    unknown: true
  };
  // Badge color theme: dark (default, for dark sites) | light (solid soft chips for contrast).
  const BADGE_THEME_KEY = "flapFeeInfo.badgeTheme.v1";
  const DEFAULT_BADGE_THEME = "dark";
  const DEBUG_PREFIX = "[FlapFeeInfo]";
  const CARD_MARK = "gmgnFeeModeCard";
  const ICON_MARK = "gmgnFeeModeIcon";
  const CARD_DATA = `data-${toKebab(CARD_MARK)}`;
  const ICON_DATA = `data-${toKebab(ICON_MARK)}`;
  // Pool/quote prefix (coin) — do not hide site pool icons; show all quotes including BNB.
  const POOL_PREFIX = "🪙";
  const MAX_QUOTE_SYMBOL_LEN = 8;
  // GMGN special quote icons (not in /static/quotes/*.png RWA list).
  const GMGN_ICON_QUOTE_RULES = [
    [/usd1/i, "USD1"],
    [/usdt/i, "USDT"],
    [/usdc/i, "USDC"],
    [/weth/i, "WETH"],
    [/wbnb|bnbball|\bbnb\b/i, "BNB"]
  ];
  // Native default quote when GMGN shows no quote chip (standard BNB pair has no icon).
  const GMGN_CHAIN_NATIVE_QUOTE = {
    bsc: "BNB",
    eth: "WETH",
    base: "WETH",
    blast: "WETH",
    arbitrum: "WETH",
    sol: "SOL",
    tron: "TRX"
  };
  const SUFFIX_SELECTORS =
    "a[href*='8888'], a[href*='7777'], [title*='8888'], [title*='7777'], " +
    "[aria-label*='8888'], [aria-label*='7777'], [data-token*='8888'], [data-token*='7777'], " +
    "[data-address*='8888'], [data-address*='7777']";

  const modeMeta = {
    holder: { fallback: "💎", title: "Fee mode: holder dividend", className: "holder" },
    gift: { fallback: "🎁", title: "Fee mode: vault gift", className: "gift" },
    creator: { fallback: "👨‍🍳", title: "Fee mode: creator marketing", className: "creator" },
    burn: { fallback: "🔥", title: "Fee mode: burn / deflation", className: "burn" },
    lp: { fallback: "💧", title: "Fee mode: liquidity", className: "lp" },
    hybrid: { fallback: "💎", title: "Fee mode: hybrid allocation", className: "hybrid" },
    unknown: { fallback: "❓️未", title: "Fee mode: unknown", className: "unknown" }
  };
  const confirmedModes = new Set(Object.keys(modeMeta));

  const siteStrategy = createSiteStrategy();
  if (!siteStrategy) return;

  // token -> full allocation result
  const modeCache = new Map();
  const persistentCache = new Map();
  const requestQueue = new Set();
  let batchTimer = null;
  let batchActive = false;
  let batchStartedAt = 0;
  let batchGeneration = 0;
  let activeAbortController = null;
  /** Tokens currently inside an in-flight /modes request (re-queue on force recover). */
  let activeBatchTokens = [];
  let consecutiveFails = 0;
  let scanScheduled = false;
  let lastScanAt = 0;
  let persistentCacheReady = false;
  let persistentCacheReadyWaiters = [];
  let lastResumeAt = 0;
  /** performance.now() / Date when tab became hidden (0 if visible). */
  let hiddenSinceMs = 0;
  /** Until this timestamp, always remount badges (skip idempotent short-circuit). */
  let resumeForceRemountUntil = 0;
  /** Live display toggles from popup (chrome.storage). */
  let displayPrefs = { ...DEFAULT_DISPLAY_PREFS };
  /** dark | light — badge chrome colors */
  let badgeTheme = DEFAULT_BADGE_THEME;

  hydratePersistentCache();
  hydrateDisplayPrefs();
  hydrateBadgeTheme();
  watchDisplayPrefs();

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
        // Token detail: single header "card" (no list Tax chip).
        if (isGmgnTokenPage()) {
          const root = findGmgnTokenPageRoot();
          if (root && (node === root || root.contains(node) || (node.contains && node.contains(root)))) {
            return root;
          }
          return root;
        }
        return climbToCard(node, {
          maxDepth: 9,
          maxHeight: 240,
          minWidth: 220,
          requireFeeTag: true
        });
      },
      extractToken(card) {
        if (isGmgnTokenPage()) {
          return extractTokenFromUrl() || extractCardTokenFromAttrs(card);
        }
        return extractCardTokenFromAttrs(card);
      },
      findIconTarget(card) {
        if (isGmgnTokenPage()) {
          return findGmgnTokenPageMount() || findTaxTag(card);
        }
        return findTaxTag(card);
      },
      placeIcon(target, icon) {
        if (isGmgnTokenPage()) {
          placeGmgnTokenIcon(target, icon);
          return;
        }
        // Put badge outside the narrow Tax chip / overflow:hidden wrappers.
        placeBesideTaxChip(target, icon);
      }
    };
  }

  function createDebotStrategy() {
    return {
      name: "debot",
      getCandidateNodes,
      findCard(node) {
        // "即将打满" cards with progress rings are taller than plain new-token cards.
        const card = climbToCard(node, {
          maxDepth: 9,
          maxHeight: 320,
          minWidth: 220,
          requireFeeTag: false
        });
        // Skip left/right watchlist rails (js-mcp: ~168px DOGI/TSLAB false cards).
        if (card && isDebotSideRailCard(card)) return null;
        return card;
      },
      extractToken(card) {
        if (isDebotTokenPage()) {
          return extractTokenFromUrl() || extractCardTokenFromAttrs(card);
        }
        return extractCardTokenFromAttrs(card);
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

  function isDebotTokenPage() {
    return /\/token\//i.test(location.pathname || "");
  }

  /** CA from URL path (GMGN/Debot token detail). Only 8888/7777 tax tokens. */
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
    const nodes = getCandidateNodes();
    if (!isGmgnTokenPage()) return nodes;
    const root = findGmgnTokenPageRoot();
    if (root && !nodes.includes(root)) nodes.unshift(root);
    // Also seed short-address nodes in header so climb is not required.
    const ca = extractTokenFromUrl();
    if (ca) {
      document.querySelectorAll("span, a, div").forEach((el) => {
        const t = (el.textContent || "").trim();
        if (TARGET_SHORT_TOKEN_RE.test(t) && t.length < 22 && !nodes.includes(el)) {
          nodes.push(el);
        }
      });
    }
    return nodes.slice(0, MAX_CANDIDATES_PER_SCAN);
  }

  /** Header bar ~h-[70px] containing token metrics (价格/池子/总税率). */
  function findGmgnTokenPageRoot() {
    const taxLab = findGmgnTaxRateLabel();
    if (taxLab) {
      let p = taxLab;
      for (let i = 0; i < 10 && p; i += 1) {
        if (!(p instanceof HTMLElement)) break;
        const r = p.getBoundingClientRect();
        // Header strip (js-mcp: ~2240×70)
        if (r.width > 500 && r.height >= 48 && r.height <= 120 && r.top < 200) {
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
        const r = p.getBoundingClientRect();
        if (r.width > 500 && r.height >= 48 && r.height <= 140 && r.top < 220) return p;
        p = p.parentElement;
      }
    }
    return document.body;
  }

  function findGmgnTaxRateLabel() {
    const nodes = document.querySelectorAll("span, div");
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      // Prefer exact title leaf "总税率" (not long sentences).
      if (t === "总税率") return el;
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.startsWith("总税率") && t.length <= 16) return el;
    }
    return null;
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
    if (kind === "gmgn-header-metrics") {
      const taxCell =
        target.querySelector("[data-flap-tax-cell='1']") ||
        Array.from(target.children).find((c) => (c.textContent || "").includes("总税率"));
      if (taxCell) {
        // Sit immediately to the right of 总税率 column (screenshot arrow).
        taxCell.insertAdjacentElement("afterend", icon);
        return;
      }
      target.append(icon);
      return;
    }
    if (kind === "gmgn-tax-cell") {
      target.insertAdjacentElement("afterend", icon);
      return;
    }
    placeBesideTaxChip(target, icon);
  }

  /** Narrow side panels (钱包追踪 / 持仓) — not meme board cards. */
  function isDebotSideRailCard(card) {
    if (!(card instanceof HTMLElement)) return false;
    const r = card.getBoundingClientRect();
    if (r.width > 0 && r.width < 210) return true;
    // Far-left rail
    if (r.left >= 0 && r.left < 100 && r.width < 300) return true;
    // Far-right rail (持仓)
    if (r.right > window.innerWidth - 40 && r.width < 360) return true;
    const t = (card.textContent || "").replace(/\s+/g, " ");
    if (/AI报告/.test(t) && !/MC|市值|Tax\s*\d/i.test(t)) return true;
    return false;
  }

  function isTabVisible() {
    return document.visibilityState === "visible";
  }

  function scheduleScan(delay = 250, options = {}) {
    const force = options.force === true;
    const immediate = options.immediate === true;
    // Avoid burning CPU/network while the tab is fully hidden (timers are frozen anyway).
    if (!isTabVisible() && !force) return;
    if (scanScheduled && !force) return;
    scanScheduled = true;

    window.setTimeout(() => {
      scanScheduled = false;
      if (!isTabVisible() && !force) return;
      const now = performance.now();
      if (!force && now - lastScanAt < SCAN_INTERVAL_MS) {
        scheduleScan(SCAN_INTERVAL_MS - (now - lastScanAt));
        return;
      }
      lastScanAt = now;
      runWhenIdle(scanVisibleCards, { immediate: immediate || force });
    }, delay);
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
    if (modeCache.has(token)) return modeCache.get(token);
    if (isPersistentCacheHit(token)) {
      const entry = persistentCache.get(token);
      modeCache.set(token, entry);
      return entry;
    }
    return null;
  }

  function scanVisibleCards() {
    if (!persistentCacheReady) {
      scheduleScan(100);
      return;
    }
    if (!isTabVisible()) return;

    recoverStuckBatch();

    const seenCards = new Set();
    const nodes = siteStrategy.getCandidateNodes();
    let touched = 0;
    let rendered = 0;
    let queued = 0;

    cleanupMarkedCards();

    for (const node of nodes) {
      if (touched >= MAX_CARDS_PER_SCAN) break;

      const card = siteStrategy.findCard(node);
      if (!card || seenCards.has(card) || !isVisible(card)) continue;

      const token = siteStrategy.extractToken(card);
      if (!token) {
        clearCardIcon(card);
        continue;
      }

      seenCards.add(card);
      card.dataset[CARD_MARK] = token;
      touched += 1;

      const entry = resolveEntry(token);
      if (entry) {
        // Idempotent normally; after tab resume always remount (see resumeForceRemountUntil).
        if (badgeNeedsUpdate(card, token, entry)) {
          renderMode(card, token, entry, { forceRemount: isResumeForceRemount() });
        }
        rendered += 1;
      } else {
        queueToken(token);
        queued += 1;
      }
    }

    debugInfo("scan", {
      site: siteStrategy.name,
      candidates: nodes.length,
      touched,
      rendered,
      queued,
      queueSize: requestQueue.size,
      batchActive
    });
  }

  function isResumeForceRemount() {
    return Date.now() < resumeForceRemountUntil;
  }

  /** Re-paint badges from memory after tab wake (DOM often recycled). Always remount. */
  function reapplyCachedIconsOnPage() {
    let applied = 0;
    let missing = 0;
    let failedMount = 0;
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const token = card.dataset[CARD_MARK];
      if (!token) return;
      const liveToken = siteStrategy.extractToken(card);
      // Soft: live extract miss after wake ≠ wrong token (attrs may lag).
      if (liveToken && liveToken !== token) {
        clearCardIcon(card);
        return;
      }
      const entry = resolveEntry(token);
      if (entry) {
        // Force remount: SPA may keep an invisible/orphaned badge node after freeze.
        const ok = renderMode(card, token, entry, { forceRemount: true });
        if (ok) applied += 1;
        else failedMount += 1;
      } else {
        queueToken(token);
        missing += 1;
      }
    });
    debugInfo("icons:reapply", { applied, missing, failedMount });
  }

  /**
   * Tab left in background freezes timers/fetch; coming back must unstick pipeline
   * and repaint without requiring a full page reload.
   */
  function onTabResume(reason) {
    if (!isExtensionContextValid() || !isTabVisible()) return;
    const now = Date.now();
    // Debounce focus+visibility double fire.
    if (now - lastResumeAt < 600) return;
    lastResumeAt = now;

    const hiddenMs = hiddenSinceMs > 0 ? now - hiddenSinceMs : 0;
    hiddenSinceMs = 0;
    const ageMs = batchStartedAt ? now - batchStartedAt : 0;
    const longHidden = hiddenMs >= RESUME_LONG_HIDDEN_MS;

    debugInfo("tab:resume", {
      reason,
      queued: requestQueue.size,
      batchActive,
      batchAgeMs: ageMs || null,
      hiddenMs: hiddenMs || null,
      longHidden
    });

    // Kill frozen batches after long background (Chrome freezes fetch + timers).
    if (
      batchActive &&
      (longHidden || ageMs >= RESUME_FORCE_MIN_AGE_MS || ageMs >= BATCH_STUCK_MS)
    ) {
      recoverStuckBatch(true, longHidden ? "resume-long-hidden" : "resume-old-batch");
    }

    // Force remount window: GMGN/Debot virtual lists recycle; idempotent path hides "ghost" badges.
    resumeForceRemountUntil = now + RESUME_FORCE_REMOUNT_MS;
    lastScanAt = 0;
    scanScheduled = false;

    reapplyCachedIconsOnPage();
    if (!batchActive) {
      scheduleBatchFlush({ immediate: true });
    }
    // Staggered scans: Tax chips / virtual rows often appear over several seconds after focus.
    [0, 400, 1000, 2200, 4500, 8000].forEach((ms) => {
      scheduleScan(ms, { force: true, immediate: true });
    });
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
    if (!force && ageMs < BATCH_STUCK_MS) return;
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

  function getCandidateNodes() {
    const candidates = [];
    const seen = new Set();

    const addNode = (node) => {
      if (!(node instanceof HTMLElement) || seen.has(node)) return;
      seen.add(node);
      candidates.push(node);
    };

    document.querySelectorAll(SUFFIX_SELECTORS).forEach(addNode);

    for (const suffix of ["8888", "7777"]) {
      if (candidates.length >= MAX_CANDIDATES_PER_SCAN) break;
      const textNodes = document.evaluate(
        `//*[contains(text(), '${suffix}')]`,
        document.body,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      for (let index = 0; index < textNodes.snapshotLength; index += 1) {
        if (candidates.length >= MAX_CANDIDATES_PER_SCAN) break;
        const node = textNodes.snapshotItem(index);
        if (TARGET_SHORT_TOKEN_RE.test(node?.textContent || "")) addNode(node);
      }
    }

    return candidates.slice(0, MAX_CANDIDATES_PER_SCAN);
  }

  function climbToCard(node, options) {
    const minWidth = typeof options.minWidth === "number" ? options.minWidth : 260;
    let current = node;
    for (let depth = 0; current && depth < options.maxDepth; depth += 1) {
      if (!(current instanceof HTMLElement)) break;
      const rect = current.getBoundingClientRect();
      const text = current.textContent || "";

      if (
        rect.width >= minWidth &&
        rect.height >= 58 &&
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

  /** Match full CA against truncated UI form like 0x65...7777 */
  function tokenMatchesShort(fullToken, shortAddress) {
    if (!shortAddress) return true;
    const short = String(shortAddress).toLowerCase();
    const full = String(fullToken).toLowerCase();
    const parts = short.split(/\.{2,}/);
    if (parts.length < 2) return full.includes(short.replace(/\./g, ""));
    const head = parts[0].replace(/^0x/, "");
    const tail = parts[parts.length - 1];
    return full.startsWith(`0x${head}`) && full.endsWith(tail);
  }

  function extractCardTokenFromAttrs(card) {
    const shortAddress = findTargetShortAddress(card);
    // Prefer short 8888/7777 presence; still allow pure full-CA cards without short UI.

    const accept = (token) => {
      if (!token) return null;
      if (shortAddress && !tokenMatchesShort(token, shortAddress)) return null;
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
      const token = accept(normalizeToken(value));
      if (token) return token;
    }

    const tokenNodes = card.querySelectorAll(
      "a[href*='0x'], [title*='0x'], [aria-label*='0x'], [data-token*='0x'], [data-address*='0x'], [data-ca*='0x'], [data-contract*='0x'], [href*='token'], [href*='address']"
    );
    for (const node of tokenNodes) {
      const attrs = [
        node.getAttribute("href"),
        node.getAttribute("title"),
        node.getAttribute("aria-label"),
        node.getAttribute("data-token"),
        node.getAttribute("data-address"),
        node.getAttribute("data-ca"),
        node.getAttribute("data-contract")
      ];
      for (const value of attrs) {
        const token = accept(normalizeToken(value));
        if (token) return token;
      }
    }

    // Deep scan: any attribute value on card subtree (Debot often buries CA in data-*).
    const all = card.querySelectorAll("*");
    for (let i = 0; i < all.length; i += 1) {
      const el = all[i];
      if (!el.attributes || el.attributes.length === 0) continue;
      for (let j = 0; j < el.attributes.length; j += 1) {
        const value = el.attributes[j].value;
        if (!value || value.length < 42 || value.indexOf("0x") === -1) continue;
        const token = accept(normalizeToken(value));
        if (token) return token;
      }
    }

    // Last resort: full 40-hex in HTML/text (links, JSON blobs in attributes already tried).
    const blob = `${card.innerHTML || ""}\n${card.textContent || ""}`;
    const re = /0x[a-fA-F0-9]{36}(8888|7777)/gi;
    let match = re.exec(blob);
    while (match) {
      const token = accept(match[0].toLowerCase());
      if (token) return token;
      match = re.exec(blob);
    }

    return null;
  }

  function normalizeToken(value) {
    if (!value) return null;
    const full = String(value).match(TOKEN_RE)?.[0];
    if (!full) return null;
    const token = full.toLowerCase();
    return TARGET_TOKEN_RE.test(token) ? token : null;
  }

  function hasFeeTag(text) {
    return /Tax\s*\d/i.test(text) || /fee/i.test(text);
  }

  function hasShortAddress(card) {
    return Array.from(card.querySelectorAll("span, div, a")).some((el) =>
      SHORT_TOKEN_RE.test(el.textContent || "")
    );
  }

  function findTargetShortAddress(card) {
    const candidates = Array.from(card.querySelectorAll("span, div, a"));
    for (const el of candidates) {
      const match = (el.textContent || "").match(TARGET_SHORT_TOKEN_RE);
      if (match) return match[0];
    }
    return null;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
  }

  function queueToken(token) {
    if (modeCache.has(token) || isPersistentCacheHit(token) || requestQueue.has(token)) return;
    requestQueue.add(token);
    debugInfo("queue", { token });
    scheduleBatchFlush();
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
    if (batchActive) return;
    if (batchTimer) {
      if (!immediate && delayMs >= BATCH_FLUSH_MS) return;
      window.clearTimeout(batchTimer);
      batchTimer = null;
    }
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

  async function flushTokenBatch() {
    batchTimer = null;
    if (!isTabVisible()) return;
    recoverStuckBatch(false);
    if (batchActive || requestQueue.size === 0) return;

    // Old content script after extension reload: stop all network work silently.
    if (!isExtensionContextValid()) {
      requestQueue.clear();
      return;
    }

    const tokens = Array.from(requestQueue).slice(0, MAX_BATCH_TOKENS);
    tokens.forEach((token) => requestQueue.delete(token));

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
      debugInfo("request:ok", {
        requested: tokens.length,
        returned: Object.keys(data.results || {}).length,
        missing: (data.missing || []).length,
        upstreamError: data.upstream_error || null
      });
      const confirmed = [];
      Object.entries(data.results || {}).forEach(([token, result]) => {
        const entry = normalizeResult(result);
        if (!entry) return;
        modeCache.set(token, entry);
        confirmed.push([token, entry]);
        applyModeToKnownCards(token, entry);
      });
      if (confirmed.length > 0) {
        persistConfirmedModes(confirmed);
      }
      // Soft-miss: put back so later scans / resume can retry without full reload.
      (data.missing || []).forEach((token) => {
        if (!modeCache.has(token)) requestQueue.add(String(token).toLowerCase());
      });
    } catch (error) {
      if (generation !== batchGeneration) return;
      if (isContextInvalidError(error)) {
        activeBatchTokens = [];
        requestQueue.clear();
        return;
      }

      // Re-queue for retry; do not scream AbortError (normal when timeout/supersede).
      tokens.forEach((token) => requestQueue.add(token));
      activeBatchTokens = [];

      if (isAbortError(error)) {
        debugInfo("request:aborted", {
          tokens,
          error: normalizeError(error)
        });
      } else if (isTransientNetworkError(error)) {
        consecutiveFails += 1;
        debugWarn("request:failed-transient", {
          tokens,
          fails: consecutiveFails,
          error: normalizeError(error)
        });
      } else {
        consecutiveFails += 1;
        debugWarn("request:failed", {
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
          const delayMs = consecutiveFails > 0 ? nextRetryDelayMs() : 0;
          scheduleBatchFlush({
            immediate: delayMs === 0,
            delayMs
          });
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
      const res = await fetch(`${DEFAULT_API_BASE}/modes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
        signal: controller.signal,
        cache: "no-store"
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        debugWarn("request:bad-response", {
          status: res.status,
          body: data
        });
        throw new Error(`batch query failed status=${res.status}`);
      }
      return data;
    } catch (error) {
      // Abort/network are expected under tab freeze; only hard errors at error level.
      if (!isContextInvalidError(error) && !isAbortError(error) && !isTransientNetworkError(error)) {
        debugError("request:error", error);
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onParentAbort);
      }
    }
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
      is_vault: Boolean(result.is_vault),
      buy_tax_bps: Number(result.buy_tax_bps) || 0,
      sell_tax_bps: Number(result.sell_tax_bps) || 0,
      top_segment: topSegment,
      top_payout_symbol: topPayoutSymbol,
      dividend_symbol:
        typeof result.dividend_symbol === "string" ? result.dividend_symbol : "",
      quote_symbol: typeof result.quote_symbol === "string" ? result.quote_symbol : "",
      fetched_at: typeof result.fetched_at === "number" ? result.fetched_at : null
    };
  }

  function applyModeToKnownCards(token, entry) {
    document.querySelectorAll(`[${CARD_DATA}="${token}"]`).forEach((card) => {
      if (siteStrategy.extractToken(card) === token) {
        renderMode(card, token, entry);
      } else {
        clearCardIcon(card);
      }
    });
  }

  function bpsToPercentStr(bps) {
    const value = Number(bps) || 0;
    if (value % 100 === 0) return `${value / 100}%`;
    const text = (value / 100).toFixed(1).replace(/\.0$/, "");
    return `${text}%`;
  }

  function normalizeQuoteSymbol(raw) {
    let symbol = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!symbol) return "";
    if (symbol.length > MAX_QUOTE_SYMBOL_LEN) {
      symbol = symbol.slice(0, MAX_QUOTE_SYMBOL_LEN);
    }
    // Avoid common false positives from logos / chain badges.
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

  /**
   * Read quote/pool symbol from site DOM (do not hide native icons).
   * Debot: aria-label "BNB 流动池" / img alt.
   * GMGN: RWA "/static/quotes/xxx.png", special icons (USD1/USDT), else native BNB on BSC.
   */
  function extractQuoteSymbol(card) {
    if (!card || !card.querySelector) return "";

    // Debot / Gungnir pool chip
    const poolEl = card.querySelector(
      '[aria-label$="流动池"], [aria-label*=" 流动池"], [aria-label*="池子"]'
    );
    if (poolEl) {
      const img = poolEl.querySelector("img[alt]");
      if (img) {
        const fromAlt = normalizeQuoteSymbol(img.alt);
        if (fromAlt) return fromAlt;
      }
      const aria = poolEl.getAttribute("aria-label") || "";
      const latin = aria.match(/[A-Za-z0-9]{1,12}/);
      if (latin) {
        const fromAria = normalizeQuoteSymbol(latin[0]);
        if (fromAria) return fromAria;
      }
    }

    // GMGN RWA / stock quote icon: alt="NVDAB quote icon", src=/static/quotes/...
    const quoteImg = card.querySelector(
      'img[alt$=" quote icon"], img[alt*=" quote icon"], img[src*="/static/quotes/"]'
    );
    if (quoteImg) {
      const alt = quoteImg.getAttribute("alt") || "";
      const fromAlt = normalizeQuoteSymbol(alt.replace(/\s*quote\s*icon\s*$/i, ""));
      if (fromAlt) return fromAlt;
      const src = quoteImg.currentSrc || quoteImg.getAttribute("src") || "";
      const fromSrc = src.match(/\/quotes\/([^./?#]+)/i);
      if (fromSrc) {
        const sym = normalizeQuoteSymbol(fromSrc[1]);
        if (sym) return sym;
      }
    }

    // GMGN special base quotes: USD1 / USDT / WETH (not under /static/quotes/)
    // e.g. data-icon="IconUsd116pxS" src=".../icon_usd1_16px_s....webp" → tooltip "USD1池子"
    const specialImgs = card.querySelectorAll(
      'img[data-icon], img[src*="/static/icons/icon_usd"], img[src*="/static/icons/icon_usdt"], img[src*="/static/icons/icon_usdc"], img[src*="/static/icons/icon_weth"]'
    );
    for (let i = 0; i < specialImgs.length; i += 1) {
      const special = matchGmgnSpecialQuoteIcon(specialImgs[i]);
      if (special) return special;
    }

    // Debot coin / bstocks images (fallback when aria missing)
    const coinImgs = card.querySelectorAll(
      'img[src*="/images/chain/designer-icons/coin/"], img[src*="/images/share/bstocks/"], img[src*="/images/share/usdt"]'
    );
    for (let i = 0; i < coinImgs.length; i += 1) {
      const img = coinImgs[i];
      const fromAlt = normalizeQuoteSymbol(img.getAttribute("alt") || "");
      if (fromAlt) return fromAlt;
      const src = img.currentSrc || img.getAttribute("src") || "";
      const fromPath = src.match(/\/(?:coin|bstocks)\/([^./?#]+)/i);
      if (fromPath) {
        const sym = normalizeQuoteSymbol(fromPath[1]);
        if (sym) return sym;
      }
    }

    // GMGN: standard BNB (WBNB) pairs usually render NO quote chip — default native quote.
    if (siteStrategy.name === "gmgn") {
      const chain = getGmgnChainKey();
      const native = GMGN_CHAIN_NATIVE_QUOTE[chain];
      if (native) return native;
    }

    return "";
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
      chrome.storage.local.get([DISPLAY_PREFS_KEY], (items) => {
        if (!isExtensionContextValid() || chrome.runtime.lastError) return;
        displayPrefs = normalizeDisplayPrefs(items?.[DISPLAY_PREFS_KEY]);
        rerenderAllBadges();
      });
    } catch {
      // Extension reloaded mid-flight.
    }
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

  function watchDisplayPrefs() {
    if (!isExtensionContextValid() || !chrome.storage?.onChanged) return;
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = false;
        if (changes[DISPLAY_PREFS_KEY]) {
          displayPrefs = normalizeDisplayPrefs(changes[DISPLAY_PREFS_KEY].newValue);
          dirty = true;
        }
        if (changes[BADGE_THEME_KEY]) {
          badgeTheme = normalizeBadgeTheme(changes[BADGE_THEME_KEY].newValue);
          dirty = true;
        }
        if (dirty) rerenderAllBadges();
      });
    } catch {
      // ignore
    }
  }

  /** Re-apply badge text after popup toggles change. */
  function rerenderAllBadges() {
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      const token = card.getAttribute(CARD_DATA) || "";
      if (!token) return;
      const entry =
        modeCache.get(token) ||
        (isPersistentCacheHit(token) ? persistentCache.get(token) : null);
      if (!entry) return;
      renderMode(card, token, entry);
    });
  }

  /**
   * Compact fee allocation from bps, filtered by displayPrefs.
   * When payoutArrow is on, annotate the single largest *visible* segment with →SYMBOL
   * (never omit when equals pool quote — user wants explicit payout).
   */
  function buildFeeLabel(entry) {
    const prefs = displayPrefs || DEFAULT_DISPLAY_PREFS;
    const candidates = [];
    if ((entry.dividend_bps || 0) > 0 && prefs.holder !== false) {
      candidates.push({ kind: "holder", emoji: "💎", bps: entry.dividend_bps, pri: 0 });
    }
    if ((entry.market_bps || 0) > 0) {
      if (entry.is_vault && prefs.gift !== false) {
        candidates.push({ kind: "gift", emoji: "🎁", bps: entry.market_bps, pri: 1 });
      } else if (!entry.is_vault && prefs.creator !== false) {
        candidates.push({ kind: "creator", emoji: "👨‍🍳", bps: entry.market_bps, pri: 2 });
      }
    }
    if ((entry.deflation_bps || 0) > 0 && prefs.burn !== false) {
      candidates.push({ kind: "burn", emoji: "🔥", bps: entry.deflation_bps, pri: 3 });
    }
    if ((entry.lp_bps || 0) > 0 && prefs.lp !== false) {
      candidates.push({ kind: "lp", emoji: "💧", bps: entry.lp_bps, pri: 4 });
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
      if (top === entry.top_segment) {
        topSym = String(entry.top_payout_symbol || "").trim();
      } else if (top === "holder") {
        topSym = String(entry.dividend_symbol || entry.top_payout_symbol || "").trim();
      } else if (top === "creator" || top === "gift" || top === "lp") {
        topSym = String(entry.quote_symbol || "").trim();
      }
      // burn: tax symbol not always cached client-side — omit arrow if unknown
    }

    // Highest share first (leftmost); tie-break matches server SEGMENT_PRIORITY.
    candidates.sort((a, b) => b.bps - a.bps || a.pri - b.pri);

    const parts = candidates.map((c) => {
      const base = `${c.emoji}${bpsToPercentStr(c.bps)}`;
      if (c.kind === top && topSym) return `${base}→${topSym}`;
      return base;
    });
    return parts.join("");
  }

  /**
   * Badge text: 🪙QUOTE | fee (spaces around |), honor displayPrefs.
   * Returns empty string when everything is toggled off.
   */
  function buildDisplayLabel(entry, quoteSymbol) {
    const prefs = displayPrefs || DEFAULT_DISPLAY_PREFS;
    const fee = buildFeeLabel(entry);
    const showPool = prefs.pool !== false && Boolean(quoteSymbol);
    if (showPool && fee) return `${POOL_PREFIX}${quoteSymbol} | ${fee}`;
    if (showPool) return `${POOL_PREFIX}${quoteSymbol}`;
    return fee;
  }

  function computeBadgePresentation(entry, quoteSymbol) {
    const meta = modeMeta[entry.mode] || modeMeta.unknown;
    const label = buildDisplayLabel(entry, quoteSymbol);
    const segmentCount =
      Number((entry.dividend_bps || 0) > 0) +
      Number((entry.market_bps || 0) > 0) +
      Number((entry.deflation_bps || 0) > 0) +
      Number((entry.lp_bps || 0) > 0);
    const poolLine = quoteSymbol ? `底池: ${quoteSymbol}\n` : "";
    const title = `${poolLine}${entry.title || meta.title}\n`;
    const theme = badgeTheme === "light" ? "light" : "dark";
    const className = [
      "gmgn-fee-mode-icon",
      `gmgn-fee-mode-icon--theme-${theme}`,
      `gmgn-fee-mode-icon--${meta.className}`,
      `gmgn-fee-mode-icon--${siteStrategy.name}`,
      segmentCount >= 3 ? "gmgn-fee-mode-icon--wide" : "",
      segmentCount >= 2 ? "gmgn-fee-mode-icon--multi" : "",
      quoteSymbol && displayPrefs.pool !== false ? "gmgn-fee-mode-icon--with-pool" : ""
    ]
      .filter(Boolean)
      .join(" ");
    return { label, title, className, meta };
  }

  /** True when badge is missing, wrong token/label, or detached from preferred Debot mount. */
  function badgeNeedsUpdate(card, token, entry) {
    // After long background, always remount (ghost nodes / wrong parent / display:none wrappers).
    if (isResumeForceRemount()) return true;

    const existing = card.querySelector(`[${ICON_DATA}="1"]`);
    if (!existing || !document.contains(existing)) return true;
    if (existing.dataset.feeToken !== token) return true;

    // Not actually painted (0×0 or off-layout) → remount.
    const er = existing.getBoundingClientRect();
    if (er.width < 2 || er.height < 2) return true;

    const quoteSymbol = extractQuoteSymbol(card);
    const { label, className, title } = computeBadgePresentation(entry, quoteSymbol);
    if (!label) return true;
    if (existing.textContent !== label) return true;
    if (existing.className !== className) return true;
    if (existing.title !== `${title}${token}`) return true;

    if (siteStrategy.name === "debot") {
      const preferred = findDebotIconTarget(card);
      if (preferred && existing.parentElement !== preferred) return true;
    }
    // GMGN: badge should sit near Tax chip; if Tax moved and badge is an orphan sibling far away, remount.
    if (siteStrategy.name === "gmgn") {
      const tax = findTaxTag(card);
      if (tax && existing.parentElement && !tax.parentElement?.contains(existing) && !existing.parentElement.contains(tax)) {
        const tr = tax.getBoundingClientRect();
        if (Math.abs(er.top - tr.top) > 40 || Math.abs(er.left - tr.left) > 200) return true;
      }
    }
    return false;
  }

  function renderMode(card, token, entry, options = {}) {
    const forceRemount = options.forceRemount === true || isResumeForceRemount();
    const quoteSymbol = extractQuoteSymbol(card);
    const { label, title, className } = computeBadgePresentation(entry, quoteSymbol);

    // All toggles off or nothing to show → clear badge.
    if (!label) {
      card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((oldIcon) => oldIcon.remove());
      const prevEmpty = card.previousElementSibling;
      if (prevEmpty && prevEmpty.dataset && prevEmpty.dataset[ICON_MARK] === "1") prevEmpty.remove();
      return true;
    }

    // In-place update when node still valid (avoids remove/append flicker every scan).
    const existing = card.querySelector(`[${ICON_DATA}="1"]`);
    if (
      !forceRemount &&
      existing &&
      document.contains(existing) &&
      existing.dataset.feeToken === token
    ) {
      let stay = true;
      const er = existing.getBoundingClientRect();
      if (er.width < 2 || er.height < 2) stay = false;
      if (siteStrategy.name === "debot") {
        const preferred = findDebotIconTarget(card);
        if (preferred && existing.parentElement !== preferred) stay = false;
      }
      if (stay) {
        existing.textContent = label;
        existing.title = `${title}${token}`;
        existing.className = className;
        existing.dataset.feeToken = token;
        return true;
      }
    }

    const target = siteStrategy.findIconTarget(card);
    if (!target) {
      // Layout may not be ready right after tab resume; keep mark so next scan retries.
      return false;
    }

    // Remove previous badge near this card (icon may sit as sibling, not only descendant).
    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((oldIcon) => oldIcon.remove());
    const prev = card.previousElementSibling;
    if (prev && prev.dataset && prev.dataset[ICON_MARK] === "1") prev.remove();

    const icon = document.createElement("span");
    icon.dataset[ICON_MARK] = "1";
    icon.dataset.feeToken = token;
    siteStrategy.placeIcon(target, icon);

    icon.textContent = label;
    icon.title = `${title}${token}`;
    icon.className = className;
    return true;
  }

  function clearCardIcon(card) {
    delete card.dataset[CARD_MARK];
    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => icon.remove());
    const prev = card.previousElementSibling;
    if (prev && prev.dataset && prev.dataset[ICON_MARK] === "1") prev.remove();
  }

  function cleanupMarkedCards() {
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      const token = card.dataset[CARD_MARK];
      if (!token) {
        clearCardIcon(card);
        return;
      }
      const live = siteStrategy.extractToken(card);
      // Soft after wake: attrs may lag — do NOT wipe mark/icon on temporary null extract.
      if (live == null) return;
      if (live !== token) clearCardIcon(card);
    });
  }

  function placeBesideTaxChip(target, icon) {
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

  function findTaxTag(card) {
    // Match Tax/fee chips; "Tax 0.25%/1.25%" is often wider than 110px so do not hard-cap tightly.
    const candidates = Array.from(card.querySelectorAll("span, div")).filter((el) => {
      if (el.matches(`[${ICON_DATA}="1"]`) || el.querySelector(`[${ICON_DATA}="1"]`)) return false;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 48) return false;
      if (!hasFeeTag(text)) return false;
      // Prefer leaf-ish nodes (own short text), not whole rows.
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent || "")
        .join("")
        .trim();
      if (own && !hasFeeTag(own) && el.querySelector("span, div")) {
        // Nested structure is OK when child carries the tax text.
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (rect.width > 280 || rect.height > 40) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    // Smallest chip first (most specific Tax badge).
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const areaDiff = ar.width * ar.height - br.width * br.height;
      if (areaDiff !== 0) return areaDiff;
      return (a.textContent || "").length - (b.textContent || "").length;
    });
    return candidates[0];
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
   */
  function findDebotIconTarget(card) {
    if (isDebotTokenPage()) {
      const tokenMount = findDebotTokenPageMount(card);
      if (tokenMount) return markDebotMount(tokenMount, "token-stats");
    }

    const metrics = findDebotMetricsBar(card);
    if (metrics) return markDebotMount(metrics, "metrics");

    const buyMount = findDebotBuyMount(card);
    if (buyMount) return markDebotMount(buyMount.row, "buy", buyMount.buyWrap);

    const shortRow = findDebotShortAddressRow(card);
    if (shortRow) return markDebotMount(shortRow, "short");

    const shortNode = findDebotShortAddressNode(card);
    if (shortNode) return markDebotMount(shortNode, "short-leaf");

    return null;
  }

  function markDebotMount(el, kind, buyWrap) {
    if (!(el instanceof HTMLElement)) return el;
    el.dataset.flapMount = kind;
    if (buyWrap instanceof HTMLElement) {
      el.dataset.flapBuyId = "1";
      buyWrap.dataset.flapBuyWrap = "1";
    }
    return el;
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
   * Place badge:
   * - metrics / token-stats: append (stable end of row)
   * - buy: before 买 wrap
   * - short: afterend
   */
  function placeDebotIcon(target, icon) {
    const kind = target?.dataset?.flapMount || "";

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
    console.info(`${DEBUG_PREFIX} ${event} ${formatPayload(payload)}`);
  }

  function debugWarn(event, payload) {
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
                is_vault: Boolean(value.is_vault),
                buy_tax_bps: Number(value.buy_tax_bps) || 0,
                sell_tax_bps: Number(value.sell_tax_bps) || 0,
                top_segment: typeof value.top_segment === "string" ? value.top_segment : "unknown",
                top_payout_symbol:
                  typeof value.top_payout_symbol === "string" ? value.top_payout_symbol : "",
                dividend_symbol:
                  typeof value.dividend_symbol === "string" ? value.dividend_symbol : "",
                quote_symbol: typeof value.quote_symbol === "string" ? value.quote_symbol : "",
                fetched_at: Math.floor(value.fetchedAt / 1000)
              });
            });
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
        is_vault: entry.is_vault,
        buy_tax_bps: entry.buy_tax_bps,
        sell_tax_bps: entry.sell_tax_bps,
        top_segment: entry.top_segment || "unknown",
        top_payout_symbol: entry.top_payout_symbol || "",
        dividend_symbol: entry.dividend_symbol || "",
        quote_symbol: entry.quote_symbol || "",
        fetchedAt:
          typeof entry.fetched_at === "number" ? entry.fetched_at * 1000 : Date.now()
      });
    }
    persistCacheSoon();
  }

  let persistTimer = null;
  function persistCacheSoon() {
    if (persistTimer) return;
    persistTimer = window.setTimeout(async () => {
      persistTimer = null;
      await waitForPersistentCache();
      if (!isExtensionContextValid() || !chrome.storage?.local) return;

      const serialized = {};
      const now = Date.now();
      for (const [token, entry] of persistentCache.entries()) {
        if (!confirmedModes.has(entry.mode) || !entry.label) continue;
        const fetchedAt = cacheAgeMs(entry) || now;
        if (now - fetchedAt > PERSISTENT_CACHE_TTL_MS) continue;
        serialized[token] = {
          mode: entry.mode,
          label: entry.label,
          title: entry.title,
          dividend_bps: entry.dividend_bps,
          market_bps: entry.market_bps,
          deflation_bps: entry.deflation_bps,
          lp_bps: entry.lp_bps,
          is_vault: entry.is_vault,
          buy_tax_bps: entry.buy_tax_bps,
          sell_tax_bps: entry.sell_tax_bps,
          top_segment: entry.top_segment || "unknown",
          top_payout_symbol: entry.top_payout_symbol || "",
          dividend_symbol: entry.dividend_symbol || "",
          quote_symbol: entry.quote_symbol || "",
          fetchedAt
        };
      }

      try {
        chrome.storage.local.set({ [PERSISTENT_CACHE_KEY]: serialized }, () => {
          // Ignore invalidated context after reload; nothing useful to log.
          void chrome.runtime?.lastError;
        });
      } catch {
        // Extension reloaded mid-flight.
      }
    }, 500);
  }

  const observer = new MutationObserver(() => {
    if (!isTabVisible()) return;
    scheduleScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener(
    "scroll",
    () => {
      if (!isTabVisible()) return;
      scheduleScan(100);
    },
    { passive: true }
  );
  window.addEventListener("hashchange", () => scheduleScan(100, { force: true }), { passive: true });
  window.addEventListener("popstate", () => scheduleScan(100, { force: true }));

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
  window.addEventListener("focus", () => onTabResume("focus"));
  // Chromium: tab discarded for memory then restored — same as long background freeze.
  if ("wasDiscarded" in document && document.wasDiscarded) {
    resumeForceRemountUntil = Date.now() + RESUME_FORCE_REMOUNT_MS;
  }

  scheduleScan(100, { force: true, immediate: true });
})();
