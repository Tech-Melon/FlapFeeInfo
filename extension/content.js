(() => {
  const DEFAULT_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";
  const TOKEN_RE = /0x[a-fA-F0-9]{40}/;
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777)$/;
  const SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}[a-fA-F0-9]{2,6}/i;
  const TARGET_SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}(8888|7777)/i;
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
  const SCAN_INTERVAL_MS = 900;
  const REQUEST_TIMEOUT_MS = 28000;
  // Background tabs freeze timers; if a batch never finishes, unblock after this wall time.
  const BATCH_STUCK_MS = 30000;
  // On tab resume, force-kill in-flight fetch if older than this (avoid Abort cascade on short blurs).
  const RESUME_FORCE_MIN_AGE_MS = 8000;
  // After long background ONLY: brief force remount window (short blur must NOT remount).
  const RESUME_FORCE_REMOUNT_MS = 3500;
  // Hidden longer than this → soft/hard pipeline revive + force remount.
  const RESUME_LONG_HIDDEN_MS = 10000;
  // While tab is visible, periodic self-heal ONLY when unhealthy (never full remount).
  const PIPELINE_WATCHDOG_MS = 45000;
  // If no successful scan for this long while visible, force one (watchdog).
  const SCAN_STALE_MS = 120000;
  // Cap *real work* per scan (stable badges do not count). Debot 3 cols ≈ 40+ cards.
  const MAX_CANDIDATES_PER_SCAN = 120;
  const MAX_CARDS_PER_SCAN = 56;
  const MAX_BATCH_TOKENS = 48;
  const BATCH_FLUSH_MS = 350;
  const RETRY_BASE_MS = 900;
  const RETRY_MAX_MS = 12000;
  const PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  // Debot mount result cache (avoids getComputedStyle thrash every scan).
  const DEBOT_MOUNT_CACHE_MS = 4000;
  // chrome.storage rewrite throttle + max entries (LRU by fetchedAt).
  const PERSIST_MIN_INTERVAL_MS = 10000;
  const PERSISTENT_CACHE_MAX_ENTRIES = 800;
  // Mutation → scan debounce (ms). Snappy enough for list refresh, still coalesces thrash.
  const MUTATION_SCAN_DEBOUNCE_MS = 400;
  // Token/K-line while badge still loading: longer coalesce against chart Mutation flood.
  const MUTATION_SCAN_DEBOUNCE_TOKEN_LOADING_MS = 900;
  // SPA: swallow mutation flood while host rebuilds (chart/list); progressive scans fill holes.
  const SPA_NAV_QUIET_MS = 650;
  // Cache header "总税率" node — avoid document-wide span/div walks every root refresh.
  const TAX_LABEL_CACHE_MS = 20000;
  // Coalesce multi pushState/replaceState during one navigation.
  const SPA_NAV_COALESCE_MS = 40;
  // Progressive hole-fill offsets from quiet end (ms). Shorter than 0.4.10's 6×/2800ms.
  // List/meme boards (Debot 3-col + GMGN home): 4 passes, last ~2s.
  const SPA_NAV_SCAN_OFFSETS_LIST_MS = [0, 400, 1100, 2000];
  // Token / K-line page: fewer passes, early-stop when header badge exists.
  const SPA_NAV_SCAN_OFFSETS_TOKEN_MS = [0, 500, 1300];
  // Independent route poll — sites often capture native history before our wrap.
  const ROUTE_POLL_MS = 500;
  // Expensive mark cleanup only every N scans (0.3.4 never re-extracted every tick).
  const CLEANUP_EVERY_N_SCANS = 10;
  // Console spam costs main-thread time on Debot/GMGN — off by default.
  const DEBUG_LOG = false;
  // Steady-state: painted badges free; unpainted prioritized.
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
  /** Wall clock of last completed scanVisibleCards (watchdog uses this). */
  let lastScanWallMs = 0;
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
  /** Cached GMGN "总税率" label node (invalidated on SPA). */
  let taxRateLabelCache = { el: null, at: 0 };
  let pipelineWatchdogId = null;
  /** Scan timers scheduled with force (must not leave scanScheduled stuck). */
  let scanTimerIds = [];
  /** WeakMap card -> { at, el } for Debot mount reuse. Replaced on SPA (fresh map). */
  let debotMountCache = new WeakMap();
  /** card -> last extracted full CA (skip deep scan when stable). Replaced on SPA. */
  let cardTokenCache = new WeakMap();
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
  /** Last bound observer roots (skip rebind when identity unchanged). */
  let lastObserverRoots = [];

  hydratePersistentCache();
  hydrateDisplayPrefs();
  hydrateBadgeTheme();
  hydrateBadgeSolidDark();
  hydrateBadgeOffsets();
  hydrateBadgeDragEdit();
  watchDisplayPrefs();
  installBadgeDragHandlers();
  startPipelineWatchdog();
  installHistoryHooks();
  startRoutePoller();

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
            return root;
          }
        }
        return climbGmgnListCard(node);
      },
      extractToken(card) {
        // URL CA only for the token-page header root — never paint list rows with page CA.
        if (isGmgnTokenPage() && isGmgnTokenHeaderCard(card)) {
          return extractTokenFromUrl() || extractCardTokenFromAttrs(card);
        }
        return extractCardTokenFromAttrs(card);
      },
      findIconTarget(card) {
        if (isGmgnTokenPage() && isGmgnTokenHeaderCard(card)) {
          return findGmgnTokenPageMount() || findTaxTag(card);
        }
        // List / search dialog: Tax chip first; compact row fallback (no Tax in history modal).
        return findTaxTag(card) || findCompactRowMount(card);
      },
      placeIcon(target, icon) {
        if (isGmgnTokenPage() && target?.dataset?.flapMount) {
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
    const inDialog = isInsideOverlayDialog(node);
    // History/search rows are short (~44–56px); list cards ~124px.
    const minHeight = inDialog ? 40 : 58;
    const maxHeight = inDialog ? 120 : 280;
    const minWidth = inDialog ? 180 : 200;
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
    const root = findGmgnTokenPageRoot();
    return !!(root && card === root);
  }

  function isInsideOverlayDialog(node) {
    if (!(node instanceof HTMLElement)) return false;
    try {
      return !!node.closest?.('[role="dialog"], [role="alertdialog"]');
    } catch (_err) {
      return false;
    }
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

  /** URL ?chain= (gmgn/debot/gungnir). Empty → treat as unknown. */
  function getUrlChain() {
    try {
      return String(new URL(location.href).searchParams.get("chain") || "").toLowerCase();
    } catch (_err) {
      return "";
    }
  }

  /** Only BSC trenches for now; Robinhood / other chains → no scan. */
  function isAllowedScanChain() {
    const chain = getUrlChain();
    if (!chain) {
      // GMGN token pages sometimes omit chain in path-only URLs — allow token if host ok.
      if (isGmgnTokenPage() || isDebotTokenPage()) return true;
      // Home/meme without chain param: default boards are usually bsc — allow.
      return true;
    }
    if (chain === "robinhood" || chain === "rh") return false;
    return chain === "bsc";
  }

  /**
   * List war-room / 战壕 boards where free badge drag + absolute coords apply.
   * K-line / token detail NEVER use absolute/drag (always 总税率 / Tax mount).
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
    if (host.endsWith("debot.ai") || host.endsWith("gungnir.bot")) {
      return /\/meme/i.test(path) || path === "/" || path === "";
    }
    return false;
  }

  /**
   * Hard gate: whether this page should run fee scans at all.
   * - chain=Robinhood → off
   * - non-bsc (when chain present) → off
   * - allowed: gmgn (list + token on bsc), debot/gungnir meme (+ token if needed)
   */
  function isScanPageAllowed() {
    if (!isAllowedScanChain()) return false;
    const host = location.hostname || "";
    const path = location.pathname || "/";
    if (host.endsWith("gmgn.ai")) return true;
    if (host.endsWith("debot.ai") || host.endsWith("gungnir.bot")) {
      // Meme trenches + token detail; skip pure unrelated routes if any.
      if (/\/meme/i.test(path) || /\/token\//i.test(path) || path === "/" || path === "") {
        return true;
      }
      return false;
    }
    return false;
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
    // List/home: root-scoped candidates only (no extra full-page walks).
    if (!isGmgnTokenPage()) return getCandidateNodes();

    const nodes = getCandidateNodes();
    const root = findGmgnTokenPageRoot();
    if (root && !nodes.includes(root)) nodes.unshift(root);
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

  /** Token detail URL with a CA that is NOT 8888/7777 — no fee badge work needed. */
  function isNonTargetTokenPage() {
    if (!isTokenDetailRoute()) return false;
    const m = String(location.pathname || "").match(/0x[a-fA-F0-9]{40}/i);
    if (!m) return false;
    return !TARGET_TOKEN_RE.test(m[0].toLowerCase());
  }

  /** Token/K-line page already has at least one painted badge. */
  function isTokenPageSettledWithBadge() {
    if (!isTokenDetailRoute()) return false;
    try {
      return !!document.querySelector(`[${ICON_DATA}="1"]`);
    } catch (_err) {
      return false;
    }
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

  /**
   * Narrow side panels (钱包追踪 / 持仓) — not meme board cards.
   * 0.4.14: do NOT use left<100 && width<300 (kills 新创建 column rows).
   * Only true narrow rails (~≤200px) or AI-only rails without Tax/MC.
   */
  function isDebotSideRailCard(card) {
    if (!(card instanceof HTMLElement)) return false;
    const r = card.getBoundingClientRect();
    // True side rails are very narrow (js-mcp: ~168px DOGI/TSLAB).
    if (r.width > 0 && r.width <= 200) return true;
    // Far-right 持仓 strip only when narrow.
    if (r.right > window.innerWidth - 40 && r.width > 0 && r.width < 280) return true;
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
    // chain=Robinhood / non-allowed pages: never schedule work.
    if (!isScanPageAllowed()) return;
    // Non-force coalesces; force always schedules (but clear stuck flag first).
    if (scanScheduled && !force) return;
    if (force) {
      // Drop stale "scanScheduled" lock from timers that never ran while frozen.
      scanScheduled = false;
    }
    scanScheduled = true;

    const timerId = window.setTimeout(() => {
      scanTimerIds = scanTimerIds.filter((id) => id !== timerId);
      scanScheduled = false;
      if (!isTabVisible() && !force) return;
      if (!isExtensionContextValid()) return;
      const now = performance.now();
      if (!force && now - lastScanAt < SCAN_INTERVAL_MS) {
        scheduleScan(SCAN_INTERVAL_MS - (now - lastScanAt));
        return;
      }
      lastScanAt = now;
      runWhenIdle(scanVisibleCards, { immediate: immediate || force });
    }, delay);
    scanTimerIds.push(timerId);
    // Bound list
    if (scanTimerIds.length > 24) {
      const old = scanTimerIds.shift();
      if (old) window.clearTimeout(old);
    }
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

  function isSpaQuiet() {
    return Date.now() < spaQuietUntil;
  }

  function cardsPerScanBudget() {
    // Full budget always — stable cards free; SPA must cover 3-col lists in one pass.
    return MAX_CARDS_PER_SCAN;
  }

  /**
   * Stable SPA route key. Ignore volatile `ref=` so only real path/tab/chain changes fire.
   * js-mcp: GMGN logo → `/?chain=bsc&ref=…&tab=home` from `/bsc/token/0x…`.
   */
  function getRouteKey() {
    try {
      const u = new URL(location.href);
      const chain = u.searchParams.get("chain") || "";
      const tab = u.searchParams.get("tab") || "";
      // pathname drives token↔list; chain/tab distinguish boards.
      return `${u.pathname}|c=${chain}|t=${tab}`;
    } catch (_err) {
      return `${location.pathname}${location.search}`;
    }
  }

  /**
   * SPA: token detail ↔ list (GMGN / Debot / Gungnir) keeps the content script alive but rebuilds DOM.
   * Soft route change — NOT tab resume (no force-remount storm).
   * Work is deferred out of history.pushState stack to avoid nav jank.
   *
   * js-mcp finding: GMGN may capture native history before our wrap → pushState hook silent.
   * Route poller + path-poll inside scan are the reliable signals.
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
  }

  /** Independent of history hooks / mutation observer (survives detached roots). */
  function startRoutePoller() {
    if (routePollId) return;
    routePollId = window.setInterval(() => {
      if (!isExtensionContextValid() || !isTabVisible()) return;
      try {
        onSpaRouteChange("route-poll");
      } catch (_err) {
        // ignore
      }
    }, ROUTE_POLL_MS);
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

    // SPA nav is not tab-background freeze.
    resumeForceRemountUntil = 0;
    spaQuietUntil = Date.now() + SPA_NAV_QUIET_MS;
    spaDomDirty = false;

    // Drop pending scans from previous route (avoid stacking work during nav).
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    lastScanAt = 0;
    clearSpaNavScanTimers();

    debugInfo("spa:route", {
      reason,
      from: prevKey.slice(0, 80),
      to: nextKey.slice(0, 80)
    });

    // Coalesce multi pushState/replaceState / poll hits in one navigation frame.
    spaNavCoalesceTimer = window.setTimeout(() => {
      spaNavCoalesceTimer = null;
      beginSpaRouteSettle(prevKey, nextKey);
    }, SPA_NAV_COALESCE_MS);
  }

  /** Token detail / K-line routes need fewer progressive scans than meme boards. */
  function isTokenDetailRoute() {
    return isGmgnTokenPage() || isDebotTokenPage();
  }

  function getSpaScanOffsets() {
    // Route key already updated before settle — use current location.
    return isTokenDetailRoute() ? SPA_NAV_SCAN_OFFSETS_TOKEN_MS : SPA_NAV_SCAN_OFFSETS_LIST_MS;
  }

  /** Token page: stop further SPA force-scans once any badge is painted (header enough). */
  function shouldCancelSpaProgressive() {
    if (!isTokenDetailRoute()) return false;
    // Non-8888/7777 token pages never need progressive hole-fill.
    if (isNonTargetTokenPage()) return true;
    try {
      return !!document.querySelector(`[${ICON_DATA}="1"]`);
    } catch (_err) {
      return false;
    }
  }

  /**
   * After route key stabilizes: clear old marks cheaply, rebind roots, progressive scans.
   * Must NOT run heavy DOM walks synchronously inside history hooks (was main SPA jank).
   * 0.4.11: fewer passes + only first immediate; token early-stop — fixes ~3s K-line jank.
   */
  function beginSpaRouteSettle(_prevKey, _nextKey) {
    if (!isExtensionContextValid() || !isTabVisible()) return;

    // Fresh caches — virtual list reuses nodes with stale token/mount mapping.
    debotMountCache = new WeakMap();
    cardTokenCache = new WeakMap();
    scanRootsCache = { at: 0, roots: [] };
    taxRateLabelCache = { el: null, at: 0 };

    // Cheap full reset of OUR marks only (including body/chakra shells from token page).
    resetOurDomMarks();

    // ALWAYS observe documentElement — list roots detach on SPA and go silent (js-mcp).
    ensureDocumentObserver();

    // Progressive hole-fill: list boards get more passes; token/K-line fewer.
    const base = SPA_NAV_QUIET_MS;
    const offsets = getSpaScanOffsets();
    offsets.forEach((offset, index) => {
      const timerId = window.setTimeout(() => {
        spaNavScanTimers = spaNavScanTimers.filter((id) => id !== timerId);
        if (!isTabVisible() || !isExtensionContextValid()) return;

        // Token page already has a badge from an earlier pass — skip remaining force work.
        if (index > 0 && shouldCancelSpaProgressive()) {
          clearSpaNavScanTimers();
          spaQuietUntil = 0;
          return;
        }

        // Drop quiet so this scan and mutations can run.
        if (Date.now() < spaQuietUntil) spaQuietUntil = 0;
        spaDomDirty = false;
        // Refresh roots each pass (home columns vs token header / Debot cards).
        scanRootsCache = { at: 0, roots: [] };
        try {
          getScanRoots(true);
        } catch (_err) {
          // ignore
        }
        ensureDocumentObserver();
        lastScanAt = 0;
        // Only first pass immediate — later passes yield to host chart/list paint (js-mcp).
        scheduleScan(0, { force: true, immediate: index === 0 });

        // After first paint on token page, cancel pending progressive timers soon.
        if (index === 0 && isTokenDetailRoute()) {
          const checkId = window.setTimeout(() => {
            spaNavScanTimers = spaNavScanTimers.filter((id) => id !== checkId);
            if (shouldCancelSpaProgressive()) clearSpaNavScanTimers();
          }, 80);
          spaNavScanTimers.push(checkId);
        }
      }, base + offset);
      spaNavScanTimers.push(timerId);
    });
  }

  /** Keep a live MutationObserver on documentElement (roots may detach after SPA). */
  function ensureDocumentObserver() {
    try {
      const docEl = document.documentElement;
      if (!docEl) return;
      const already =
        lastObserverRoots.length === 1 && lastObserverRoots[0] === docEl;
      if (already) return;
      mutationObserver.disconnect();
      mutationObserver.observe(docEl, { childList: true, subtree: true });
      lastObserverRoots = [docEl];
    } catch (_err) {
      // ignore
    }
  }

  /** Remove all our badge marks/icons from the document (SPA leave/enter). */
  function resetOurDomMarks() {
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
    // 0.4.15: doubles must never short-circuit the scan.
    if (countBadgesNearCard(card, marked) !== 1) return false;
    const existing = card.querySelector(`[${ICON_DATA}="1"]`);
    if (
      !existing ||
      existing.dataset.feeToken !== marked ||
      !document.contains(existing) ||
      !existing.textContent
    ) {
      return false;
    }
    if (!cardStillMatchesToken(card, marked)) return false;
    const er = existing.getBoundingClientRect();
    return er.width >= 2 && er.height >= 2;
  }

  function scanVisibleCards() {
    if (!persistentCacheReady) {
      scheduleScan(100);
      return;
    }
    if (!isTabVisible()) return;
    if (!isScanPageAllowed()) {
      // Leave Robinhood / wrong chain clean — drop our marks if any.
      if (scanGeneration % 20 === 0) {
        try {
          document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => n.remove());
          document.querySelectorAll(`[${CARD_DATA}]`).forEach((c) => {
            if (c instanceof HTMLElement) delete c.dataset[CARD_MARK];
          });
        } catch (_err) {
          // ignore
        }
      }
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
    lastScanWallMs = Date.now();
    scanGeneration += 1;

    const seenCards = new Set();
    const nodes = siteStrategy.getCandidateNodes();
    let touched = 0;
    let rendered = 0;
    let queued = 0;
    let skippedCached = 0;
    const budget = cardsPerScanBudget();
    const forceRemount = isResumeForceRemount();

    // Expensive re-extract cleanup is rare (every N scans / force remount / SPA).
    if (forceRemount || scanGeneration % CLEANUP_EVERY_N_SCANS === 0) {
      cleanupMarkedCards({ deep: forceRemount });
    }

    // Collect unique visible cards first, then prioritize unpainted (Debot 右列饿死修复).
    const allCards = [];
    for (const node of nodes) {
      if (!isNearViewport(node)) continue;
      const card = siteStrategy.findCard(node);
      if (!card || seenCards.has(card) || !isVisible(card)) continue;
      // Reject full-page shells (token SPA leftover / body mark).
      if (card === document.body || card === document.documentElement) continue;
      {
        const cr = card.getBoundingClientRect();
        if (cr.height > window.innerHeight * 0.85 && cr.width > window.innerWidth * 0.85) {
          continue;
        }
      }
      seenCards.add(card);
      allCards.push(card);
    }

    // 0.4.15: keep outermost cards only — nested climbToCard caused 2 badges on 1 visual row.
    const outerCards = allCards.filter((card) => {
      return !allCards.some((other) => other !== card && other.contains(card));
    });

    const needWork = [];
    for (const card of outerCards) {
      // Nested mark cleanup: drop CARD_MARK on discarded inner nodes.
      // (handled by only painting outerCards)

      if (isStablePaintedCard(card, forceRemount)) {
        // 0.4.10: stale feeSig may keep wrong 🪙BNB after API has 币安人生 — cheap recheck.
        const marked = card.dataset[CARD_MARK];
        const existing = marked ? card.querySelector(`[${ICON_DATA}="1"]`) : null;
        const entry = marked ? resolveEntry(marked) : null;
        if (existing && entry && poolBadgeNeedsQuoteRefresh(existing, entry)) {
          needWork.push(card);
        } else {
          skippedCached += 1;
          // Stable cards do NOT consume budget — left/mid columns must not starve 已开盘.
        }
      } else {
        needWork.push(card);
      }
    }

    let truncated = false;
    for (const card of needWork) {
      if (touched >= budget) {
        truncated = true;
        break;
      }

      const token = siteStrategy.extractToken(card);
      if (!token) {
        clearCardIcon(card);
        continue;
      }

      card.dataset[CARD_MARK] = token;
      touched += 1;

      const entry = resolveEntry(token);
      if (entry) {
        // Doubles always remount (isStable may have been false but fast path still ran).
        if (countBadgesNearCard(card, token) > 1) {
          renderMode(card, token, entry, { forceRemount: true });
          rendered += 1;
          continue;
        }
        // Fast path: badge already correct — zero layout remount.
        const existing = card.querySelector(`[${ICON_DATA}="1"]`);
        if (
          existing &&
          document.contains(existing) &&
          existing.dataset.feeToken === token &&
          !forceRemount
        ) {
          if (existing.dataset.feeSig && existing.textContent === existing.dataset.feeSig) {
            // Keep absolute coords in sync; mode mismatch → fall through to remount.
            const pos = getActiveBadgePosition();
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
          const quoteSymbol = resolveQuoteSymbol(card, entry);
          const { label, className, title } = computeBadgePresentation(entry, quoteSymbol);
          if (label && existing.textContent === label && existing.className === className) {
            existing.dataset.feeSig = label;
            const pos = getActiveBadgePosition();
            if (pos.enabled) applyAbsoluteBadgeStyles(existing, pos.x, pos.y);
            else syncBadgeDragCursor(existing);
            skippedCached += 1;
            rendered += 1;
            continue;
          }
          if (label) {
            existing.textContent = label;
            existing.title = `${title}${token}`;
            existing.className = className;
            existing.dataset.feeToken = token;
            existing.dataset.feeSig = label;
            const pos = getActiveBadgePosition();
            if (pos.enabled) applyAbsoluteBadgeStyles(existing, pos.x, pos.y);
            else syncBadgeDragCursor(existing);
            skippedCached += 1;
            rendered += 1;
            continue;
          }
        }
        if (badgeNeedsUpdate(card, token, entry)) {
          renderMode(card, token, entry, { forceRemount });
        }
        rendered += 1;
      } else {
        queueToken(token);
        queued += 1;
      }
    }

    // Always continue when work remains (not only SPA) — covers Debot 3-col first paint.
    // force:true so SCAN_INTERVAL throttle does not delay hole-fill after left columns.
    if (truncated) {
      scheduleScan(60, { force: true, immediate: true });
    } else if (queued > 0 && requestQueue.size > 0 && !batchActive && !batchTimer) {
      scheduleBatchFlush({ immediate: true });
    }

    // Global safety net: same feeToken must never have 2 icons on page.
    dedupeBadgesByToken();

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

  /**
   * Keep at most one badge per feeToken. Prefer icon inside a marked card.
   * Fixes Debot double-paint when drag/absolute left an orphan + remount.
   */
  function dedupeBadgesByToken() {
    const byToken = new Map();
    document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      const tok = icon.dataset.feeToken || "";
      if (!tok) {
        // Orphan without token — remove.
        try {
          icon.remove();
        } catch (_err) {
          // ignore
        }
        return;
      }
      if (!byToken.has(tok)) byToken.set(tok, []);
      byToken.get(tok).push(icon);
    });
    byToken.forEach((icons) => {
      if (icons.length <= 1) return;
      // Prefer: absolute on card > inside marked card > first
      icons.sort((a, b) => {
        const score = (el) => {
          let s = 0;
          if (el.dataset.feePosMode === "absolute") s += 4;
          if (el.closest?.(`[${CARD_DATA}]`)) s += 2;
          if (el.isConnected) s += 1;
          return s;
        };
        return score(b) - score(a);
      });
      for (let i = 1; i < icons.length; i += 1) {
        try {
          icons[i].remove();
        } catch (_err) {
          // ignore
        }
      }
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
   * Full pipeline revive after long tab freeze.
   * batchActive zombies prevent scheduleBatchFlush → new tokens never show (user: must refresh).
   * Idle resets log as info (not warn) to avoid Chrome "Errors" spam.
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
    if (noisy || batchActive || requeue.length > 0 || requestQueue.size > 0) {
      debugWarn("pipeline:hard-reset", payload);
    } else {
      debugInfo("pipeline:soft-reset", payload);
    }

    batchGeneration += 1;
    abortActiveRequest(reason);
    activeBatchTokens.forEach((token) => requestQueue.add(token));
    activeBatchTokens = [];
    batchActive = false;
    batchStartedAt = 0;
    consecutiveFails = 0;

    if (batchTimer) {
      window.clearTimeout(batchTimer);
      batchTimer = null;
    }
    scanTimerIds.forEach((id) => window.clearTimeout(id));
    scanTimerIds = [];
    scanScheduled = false;
    lastScanAt = 0;
    clearSpaNavScanTimers();
    spaDomDirty = false;

    // MutationObserver can go silent after SPA document swaps / freeze.
    try {
      scanRootsCache = { at: 0, roots: [] };
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

      // No completed scan for a long time while visible
      if (lastScanWallMs > 0 && Date.now() - lastScanWallMs >= SCAN_STALE_MS) {
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
    const longHidden = inferredHidden >= RESUME_LONG_HIDDEN_MS || !!document.wasDiscarded;
    const pipelineDirty =
      batchActive ||
      requestQueue.size > 0 ||
      activeBatchTokens.length > 0 ||
      consecutiveFails > 0 ||
      (scanScheduled && scanTimerIds.length === 0);

    debugInfo("tab:resume", {
      reason,
      queued: requestQueue.size,
      batchActive,
      batchAgeMs: ageMs || null,
      hiddenMs: inferredHidden || null,
      longHidden,
      pipelineDirty
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
      if (scanScheduled && scanTimerIds.length === 0) scanScheduled = false;
      if (requestQueue.size > 0) scheduleBatchFlush({ immediate: true });
      // focus alone (extension popup / DevTools) → skip; visibility short return → soft scan
      if (reason !== "focus") {
        scheduleScan(80, { force: false, immediate: false });
      }
      return;
    }

    // Long freeze / discarded tab: revive pipeline + brief remount window.
    if (pipelineDirty || document.wasDiscarded) {
      hardResetPipeline(
        document.wasDiscarded ? "resume-was-discarded" : "resume-long-hidden",
        { noisy: pipelineDirty }
      );
    } else {
      scanTimerIds.forEach((id) => window.clearTimeout(id));
      scanTimerIds = [];
      scanScheduled = false;
      lastScanAt = 0;
      if (batchTimer) {
        window.clearTimeout(batchTimer);
        batchTimer = null;
      }
      debugInfo("pipeline:idle-resume", { reason, hiddenMs: inferredHidden });
    }

    resumeForceRemountUntil = now + RESUME_FORCE_REMOUNT_MS;
    lastScanAt = 0;
    scanScheduled = false;
    reapplyCachedIconsOnPage();
    scheduleBatchFlush({ immediate: true });
    // Two scans only (mutations cover late virtual-list paint).
    [0, 1200].forEach((ms) => {
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
    if (
      !forceRefresh &&
      scanRootsCache.roots.length > 0 &&
      now - scanRootsCache.at < SCAN_ROOTS_TTL_MS
    ) {
      // Drop detached roots
      const alive = scanRootsCache.roots.filter((r) => r.isConnected);
      if (alive.length) {
        scanRootsCache.roots = alive;
        return alive;
      }
    }

    const roots = [];
    const host = location.hostname || "";

    if (host.endsWith("gmgn.ai")) {
      if (isGmgnTokenPage()) {
        const root = findGmgnTokenPageRoot();
        if (root && root !== document.body) roots.push(root);
      }
      // Home / war room / token-page side boards (always — not only when path is /).
      document
        .querySelectorAll(
          "div.flex.flex-col.flex-1.overflow-hidden, div.flex.flex-col.flex-1.border-line-100"
        )
        .forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const r = el.getBoundingClientRect();
          if (r.width >= 240 && r.height >= 200) roots.push(el);
        });
      // Fallback: largest overflow pane when no columns matched
      if (!roots.length) {
        document.querySelectorAll("div.overflow-auto, div.overflow-hidden").forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const r = el.getBoundingClientRect();
          if (r.width >= 400 && r.height >= 400 && r.top < window.innerHeight) roots.push(el);
        });
      }
    } else if (host.endsWith("debot.ai") || host.endsWith("gungnir.bot")) {
      if (isDebotTokenPage()) {
        const mount = findDebotTokenPageMount(document.body);
        if (mount) roots.push(mount.closest?.(".MuiBox-root") || mount);
      }
      // 0.4.14: include 新创建 (left column). Do NOT require r.left > 80.
      document.querySelectorAll(".MuiCard-root, div.MuiPaper-root.MuiCard-root").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const r = el.getBoundingClientRect();
        if (r.width >= 240 && r.height >= 240) roots.push(el);
      });
      // Column containers (战壕 3 cols) when Paper root sizing differs.
      document
        .querySelectorAll(
          ".MuiStack-root, [class*='MuiGrid'], div[class*='overflow']"
        )
        .forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const r = el.getBoundingClientRect();
          // Tall column boards
          if (r.width >= 240 && r.width <= 520 && r.height >= 360 && r.top < window.innerHeight) {
            roots.push(el);
          }
        });
      if (!roots.length) {
        const main =
          document.querySelector(".MuiContainer-root") ||
          document.querySelector(".MuiStack-root.modernize-qcy9u1");
        if (main instanceof HTMLElement) roots.push(main);
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

    scanRootsCache = { at: now, roots: uniq.length ? uniq : [document.body].filter(Boolean) };
    // Observer stays on documentElement (rebindMutationObserver is a no-op keep-alive).
    ensureDocumentObserver();
    return scanRootsCache.roots;
  }

  function isDialogRoot(el) {
    if (!(el instanceof HTMLElement)) return false;
    const role = (el.getAttribute("role") || "").toLowerCase();
    return role === "dialog" || role === "alertdialog";
  }

  /**
   * Only visible open dialogs (GMGN search/history). Cap 2 — never whole document.
   */
  function collectOpenDialogRoots(roots) {
    if (!document.querySelectorAll) return;
    let added = 0;
    document.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach((el) => {
      if (added >= 2) return;
      if (!(el instanceof HTMLElement) || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      // Visible mid-size modal (not full-viewport shell, not tiny toast).
      if (r.width < 280 || r.height < 120) return;
      if (r.width > window.innerWidth * 0.98 && r.height > window.innerHeight * 0.92) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (r.right < 0 || r.left > window.innerWidth) return;
      roots.push(el);
      added += 1;
    });
  }

  function getCandidateNodes() {
    const inView = [];
    const offscreen = [];
    const seen = new Set();

    const addNode = (node, priority = 0) => {
      if (!(node instanceof HTMLElement) || seen.has(node)) return;
      seen.add(node);
      const item = { node, priority };
      // Viewport-first: process on-screen cards first (smooth scroll / steady state).
      if (isNearViewport(node)) inView.push(item);
      else offscreen.push(item);
    };

    const collectFromRoot = (root) => {
      if (!root || !root.querySelectorAll) return;
      // Prefer site token routes over external flap.sh icons (js-mcp: flap.sh 18×18 noise).
      root
        .querySelectorAll(
          "a[href*='/token/'][href*='8888'], a[href*='/token/'][href*='7777'], " +
            "a[href*='/bsc/token/'][href*='8888'], a[href*='/bsc/token/'][href*='7777']"
        )
        .forEach((n) => addNode(n, 2));
      root.querySelectorAll(SUFFIX_SELECTORS).forEach((n) => {
        const href = (n.getAttribute && n.getAttribute("href")) || "";
        // Deprioritize external explorer / flap icons
        if (/flap\.sh|bscscan|etherscan/i.test(href)) addNode(n, 0);
        else addNode(n, 1);
      });
      // Short CA text in compact leaves
      if (inView.length < MAX_CANDIDATES_PER_SCAN) {
        const leaves = root.querySelectorAll("a, span");
        const maxCheck = Math.min(leaves.length, 200);
        for (let i = 0; i < maxCheck; i += 1) {
          if (inView.length + offscreen.length >= MAX_CANDIDATES_PER_SCAN * 2) break;
          const el = leaves[i];
          const t = el.textContent || "";
          if (t.length > 24 || t.length < 8) continue;
          if (TARGET_SHORT_TOKEN_RE.test(t)) addNode(el, 1);
        }
      }
    };

    const roots = getScanRoots();
    for (const root of roots) {
      if (inView.length + offscreen.length >= MAX_CANDIDATES_PER_SCAN * 2) break;
      collectFromRoot(root);
    }

    // SPA hole-fill: if roots empty/wrong, scan body once.
    // 0.4.12: never full-body walk on settled/non-target token pages (chart DOM thrash).
    if (inView.length + offscreen.length < 8 && document.body) {
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
    const merged = inView.concat(offscreen.slice(0, 12)).map((x) => x.node);
    return merged.slice(0, MAX_CANDIDATES_PER_SCAN);
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

    // Fast path: card already resolved this short form.
    const cached = cardTokenCache.get(card);
    if (cached && cached.token && (!shortAddress || cached.short === shortAddress)) {
      return cached.token;
    }

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
      if (token) {
        cardTokenCache.set(card, { token, short: shortAddress || "" });
        return token;
      }
    }

    const tokenNodes = card.querySelectorAll(
      "a[href*='0x'], [title*='0x'], [aria-label*='0x'], [data-token*='0x'], [data-address*='0x'], [data-ca*='0x'], [data-contract*='0x']"
    );
    const maxNodes = Math.min(tokenNodes.length, 40);
    for (let i = 0; i < maxNodes; i += 1) {
      const node = tokenNodes[i];
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
        if (token) {
          cardTokenCache.set(card, { token, short: shortAddress || "" });
          return token;
        }
      }
    }

    // Deep attribute scan only on small cards / miss (avoid querySelectorAll("*") on every scan).
    const all = card.querySelectorAll("a, button, [data-token], [data-address], [data-ca], [href*='0x']");
    const maxDeep = Math.min(all.length, 60);
    for (let i = 0; i < maxDeep; i += 1) {
      const el = all[i];
      if (!el.attributes || el.attributes.length === 0) continue;
      for (let j = 0; j < el.attributes.length; j += 1) {
        const value = el.attributes[j].value;
        if (!value || value.length < 42 || value.indexOf("0x") === -1) continue;
        const token = accept(normalizeToken(value));
        if (token) {
          cardTokenCache.set(card, { token, short: shortAddress || "" });
          return token;
        }
      }
    }

    // Last resort: textContent only (skip full innerHTML serialization).
    const blob = card.textContent || "";
    if (blob.length < 8000) {
      const re = /0x[a-fA-F0-9]{36}(8888|7777)/gi;
      let match = re.exec(blob);
      while (match) {
        const token = accept(match[0].toLowerCase());
        if (token) {
          cardTokenCache.set(card, { token, short: shortAddress || "" });
          return token;
        }
        match = re.exec(blob);
      }
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
    // textContent once beats querySelectorAll("span,div,a") on every climb step.
    const text = card.textContent || "";
    if (!text) return false;
    if (text.length <= 6000) return SHORT_TOKEN_RE.test(text);
    return SHORT_TOKEN_RE.test(text.slice(0, 4000));
  }

  function findTargetShortAddress(card) {
    const text = card.textContent || "";
    if (!text) return null;
    const slice = text.length > 8000 ? text.slice(0, 5000) : text;
    const match = slice.match(TARGET_SHORT_TOKEN_RE);
    return match ? match[0] : null;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
  }

  /** Near viewport (small margin) — used to skip climb/extract on off-screen nodes. */
  function isNearViewport(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    return rect.bottom >= -60 && rect.top <= window.innerHeight + 100;
  }

  /**
   * Cheap recycle guard for virtual lists (no full extractToken).
   * True when card still looks like `token` (short CA or href/data match).
   */
  function cardStillMatchesToken(card, token) {
    if (!card || !token) return false;
    const text = card.textContent || "";
    const shortSlice = text.length > 6000 ? text.slice(0, 4000) : text;
    const shortMatch = shortSlice.match(TARGET_SHORT_TOKEN_RE);
    if (shortMatch) return tokenMatchesShort(token, shortMatch[0]);

    // Token detail / full CA in href only
    const hrefEl = card.querySelector?.("a[href*='0x']");
    if (hrefEl) {
      const hrefToken = normalizeToken(hrefEl.getAttribute("href"));
      if (hrefToken) return hrefToken === token;
    }
    const dataToken = normalizeToken(
      card.getAttribute("data-token") ||
        card.getAttribute("data-address") ||
        card.getAttribute("data-ca")
    );
    if (dataToken) return dataToken === token;

    // No short/href signal — keep badge (safer than wipe on temporary empty paint).
    return true;
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
    if (batchActive) {
      const ageMs = batchStartedAt ? Date.now() - batchStartedAt : BATCH_STUCK_MS + 1;
      if (ageMs >= BATCH_STUCK_MS || !batchStartedAt) {
        recoverStuckBatch(true, "flush-start-zombie");
      } else {
        return;
      }
    }
    if (batchActive || requestQueue.size === 0) return;

    // Old content script after extension reload: stop all network work silently.
    if (!isExtensionContextValid()) {
      requestQueue.clear();
      batchActive = false;
      batchStartedAt = 0;
      activeBatchTokens = [];
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
        batchActive = false;
        batchStartedAt = 0;
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
      if (!(card instanceof HTMLElement)) return;
      // Soft match after SPA: trust mark if short CA still matches (avoid full extract thrash).
      const live = siteStrategy.extractToken(card);
      if (live == null && cardStillMatchesToken(card, token)) {
        renderMode(card, token, entry);
        return;
      }
      if (live === token) {
        renderMode(card, token, entry);
      } else if (live != null) {
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

  /**
   * True when painted pool segment disagrees with API quote_symbol (stale 🪙BNB feeSig).
   */
  function poolBadgeNeedsQuoteRefresh(icon, entry) {
    if (!(icon instanceof HTMLElement) || !entry) return false;
    if (displayPrefs && displayPrefs.pool === false) return false;
    const apiQ = normalizeQuoteSymbol(entry.quote_symbol || "", { allowCjk: true });
    if (!apiQ) return false;
    const text = icon.textContent || "";
    const pipe = text.indexOf(" | ");
    const poolPart =
      pipe >= 0 ? text.slice(0, pipe) : text.startsWith(POOL_PREFIX) ? text : "";
    if (!poolPart) return true;
    return !poolPart.includes(apiQ);
  }

  /**
   * Pool/quote for badge: API first (chain truth), then DOM chips, then GMGN native default.
   * Fixes meme quote pools (e.g. 币安人生) mislabeled as BNB when no /static/quotes icon.
   */
  function resolveQuoteSymbol(card, entry) {
    const apiRaw =
      entry && typeof entry.quote_symbol === "string" ? entry.quote_symbol.trim() : "";
    if (apiRaw) {
      const fromApi = normalizeQuoteSymbol(apiRaw, { allowCjk: true });
      if (fromApi) return fromApi;
    }

    const fromDom = extractQuoteSymbolFromDom(card);
    if (fromDom) return fromDom;

    // Only when API empty AND no DOM chip — typical WBNB pair on GMGN has no quote icon.
    if (siteStrategy.name === "gmgn") {
      const native = GMGN_CHAIN_NATIVE_QUOTE[getGmgnChainKey()];
      if (native) return native;
    }
    return "";
  }

  /**
   * Read quote/pool symbol from site DOM only (no chain-native default).
   * Debot: aria-label "BNB 流动池" / "币安人生 流动池" / img alt.
   * GMGN: RWA "/static/quotes/xxx.png", special icons (USD1/USDT).
   */
  function extractQuoteSymbolFromDom(card) {
    if (!card || !card.querySelector) return "";

    // Debot / Gungnir pool chip
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

    // GMGN RWA / stock quote icon: alt="NVDAB quote icon", src=/static/quotes/...
    const quoteImg = card.querySelector(
      'img[alt$=" quote icon"], img[alt*=" quote icon"], img[src*="/static/quotes/"]'
    );
    if (quoteImg) {
      const alt = quoteImg.getAttribute("alt") || "";
      const fromAlt = normalizeQuoteSymbol(alt.replace(/\s*quote\s*icon\s*$/i, ""), {
        allowCjk: true
      });
      if (fromAlt) return fromAlt;
      const src = quoteImg.currentSrc || quoteImg.getAttribute("src") || "";
      const fromSrc = src.match(/\/quotes\/([^./?#]+)/i);
      if (fromSrc) {
        const sym = normalizeQuoteSymbol(fromSrc[1], { allowCjk: true });
        if (sym) return sym;
      }
    }

    // GMGN special base quotes: USD1 / USDT / WETH (not under /static/quotes/)
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
   * 0.4.14: absolute/drag ONLY on trench list pages — never K-line / token detail.
   */
  function getActiveBadgePosition() {
    const key = getSiteOffsetKey();
    const o = badgeOffsets[key] || DEFAULT_BADGE_OFFSETS[key];
    // K-line / token: always natural 总税率 / Tax mount.
    if (!isTrenchListPage()) {
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

    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
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
    if (token) {
      document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.dataset.feeToken !== token) return;
        // Keep if already inside this card (should have been cleared above).
        if (card.contains(n)) {
          try {
            n.remove();
          } catch (_err) {
            // ignore
          }
          return;
        }
        // Outside: drop if near this card or unparented from any marked card.
        const hostCard = n.closest?.(`[${CARD_DATA}]`);
        if (hostCard && hostCard !== card) return;
        try {
          n.remove();
        } catch (_err) {
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
    const pos = getActiveBadgePosition();
    const token = icon.dataset.feeToken || card.dataset[CARD_MARK] || "";

    // Defense: wipe any leftover siblings/orphans before insert (keep `icon` itself).
    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
      if (n !== icon) {
        try {
          n.remove();
        } catch (_err) {
          // ignore
        }
      }
    });
    if (token) {
      document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((n) => {
        if (n === icon) return;
        if (n.dataset.feeToken !== token) return;
        const host = n.closest?.(`[${CARD_DATA}]`);
        if (host && host !== card && !card.contains(host) && !host.contains(card)) return;
        try {
          n.remove();
        } catch (_err) {
          // ignore
        }
      });
    }

    if (pos.enabled) {
      ensureCardPositioning(card);
      if (icon.parentElement !== card) {
        try {
          card.appendChild(icon);
        } catch (_err) {
          return false;
        }
      }
      applyAbsoluteBadgeStyles(icon, pos.x, pos.y);
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
    const pos = getActiveBadgePosition();
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
      const token = card.dataset[CARD_MARK] || card.getAttribute(CARD_DATA) || "";
      if (!token) return;
      const entry =
        modeCache.get(token) ||
        (isPersistentCacheHit(token) ? persistentCache.get(token) : null);
      if (!entry) return;
      renderMode(card, token, entry, { forceRemount: true });
    });
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
    try {
      document.documentElement.classList.toggle("flap-fee-drag-edit", badgeDragEdit);
      document.body?.classList?.toggle("flap-fee-drag-edit", badgeDragEdit);
    } catch (_err) {
      // ignore
    }
    document.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => syncBadgeDragCursor(icon));
    // Turning drag on must not leave stacked badges from prior abs experiments.
    dedupeBadgesByToken();
    if (badgeDragEdit && isTrenchListPage()) {
      scheduleScan(50, { force: true, immediate: true });
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
    // Capture so we beat site click handlers on the card.
    document.addEventListener("pointerdown", onBadgePointerDown, true);
    document.addEventListener("pointermove", onBadgePointerMove, true);
    document.addEventListener("pointerup", onBadgePointerUp, true);
    document.addEventListener("pointercancel", onBadgePointerUp, true);
  }

  function onBadgePointerDown(e) {
    if (!badgeDragEdit || badgeDragState) return;
    // 0.4.14: drag only on trench list boards — never K-line / token.
    if (!isTrenchListPage()) return;
    if (e.button != null && e.button !== 0) return;
    const icon = e.target instanceof Element ? e.target.closest(`[${ICON_DATA}="1"]`) : null;
    if (!(icon instanceof HTMLElement)) return;
    const card = findCardForBadgeIcon(icon);
    if (!(card instanceof HTMLElement)) return;

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
    icon.style.cursor = badgeDragEdit ? "grab" : "";
    badgeDragState = null;

    if (!isTrenchListPage()) {
      // Drag ended after navigation — discard absolute for K-line safety.
      return;
    }

    // Persist + enable absolute mode for this site; next paint / all icons share coords.
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
        syncBadgeDragCursor(icon);
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
      renderMode(card, token, entry, { forceRemount: getActiveBadgePosition().enabled });
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
    // Light: never translucent / never honor solidDark toggle — CSS forces solid dark chip.
    // Dark: optional solid-dark class when user checks 深色背景.
    const solidDarkClass =
      theme === "dark" && badgeSolidDark ? "gmgn-fee-mode-icon--solid-dark" : "";
    const className = [
      "gmgn-fee-mode-icon",
      `gmgn-fee-mode-icon--theme-${theme}`,
      solidDarkClass,
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

    // Cheap text/class check first (avoid layout + mount search every scan).
    const quoteSymbol = resolveQuoteSymbol(card, entry);
    const { label, className, title } = computeBadgePresentation(entry, quoteSymbol);
    if (!label) return true;
    if (existing.textContent !== label) return true;
    if (existing.className !== className) return true;
    if (existing.title !== `${title}${token}`) return true;

    // Not actually painted (0×0) → remount. (single rect read)
    const er = existing.getBoundingClientRect();
    if (er.width < 2 || er.height < 2) return true;

    // Parent still in document is enough most of the time; skip expensive remount search.
    if (!existing.parentElement || !document.contains(existing.parentElement)) return true;
    return false;
  }

  function renderMode(card, token, entry, options = {}) {
    const forceRemount = options.forceRemount === true || isResumeForceRemount();
    const quoteSymbol = resolveQuoteSymbol(card, entry);
    const { label, title, className } = computeBadgePresentation(entry, quoteSymbol);
    const pos = getActiveBadgePosition();
    const wantMode = pos.enabled ? "absolute" : "default";

    // All toggles off or nothing to show → clear badge.
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
      (existing.dataset.feePosMode || "default") === wantMode
    ) {
      const er = existing.getBoundingClientRect();
      if (er.width >= 2 && er.height >= 2 && existing.parentElement) {
        existing.textContent = label;
        existing.title = `${title}${token}`;
        existing.className = className;
        existing.dataset.feeToken = token;
        existing.dataset.feeSig = label;
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

    const icon = document.createElement("span");
    icon.dataset[ICON_MARK] = "1";
    icon.dataset.feeToken = token;
    icon.dataset.feeSig = label;
    icon.textContent = label;
    icon.title = `${title}${token}`;
    icon.className = className;

    if (!placeBadgeOnCard(card, icon)) {
      // Absolute always succeeds if card exists; Tax path missing target.
      try {
        icon.remove();
      } catch (_err) {
        // ignore
      }
      return false;
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
      const icon = card.querySelector(`[${ICON_DATA}="1"]`);
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
   * Results cached ~2.5s per card to avoid getComputedStyle thrash.
   */
  function findDebotIconTarget(card) {
    const cached = debotMountCache.get(card);
    if (
      cached &&
      cached.el &&
      document.contains(cached.el) &&
      Date.now() - cached.at < DEBOT_MOUNT_CACHE_MS
    ) {
      return cached.el;
    }

    let el = null;
    if (isDebotTokenPage()) {
      const tokenMount = findDebotTokenPageMount(card);
      if (tokenMount) el = markDebotMount(tokenMount, "token-stats");
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
          void chrome.runtime?.lastError;
        });
      } catch {
        // Extension reloaded mid-flight.
      }
    }, delay);
  }

  // Observe documentElement (roots detach after SPA). Chart thrash is filtered below.
  const mutationObserver = new MutationObserver(() => {
    if (!isTabVisible()) return;
    if (!isExtensionContextValid()) return;
    if (!isScanPageAllowed()) return;
    // During SPA rebuild: mark dirty only; progressive scans + quiet-end handle paint.
    if (isSpaQuiet()) {
      spaDomDirty = true;
      return;
    }
    // 0.4.12: non-8888/7777 token page — chart noise must not schedule scans.
    if (isNonTargetTokenPage()) return;
    // 0.4.12: token/K-line already painted — stop mutation-driven full-page scans.
    if (isTokenPageSettledWithBadge()) return;

    if (mutationDebounceTimer) return;
    // Longer debounce while token badge still loading (chart keeps mutating).
    const debounceMs = isTokenDetailRoute()
      ? MUTATION_SCAN_DEBOUNCE_TOKEN_LOADING_MS
      : MUTATION_SCAN_DEBOUNCE_MS;
    mutationDebounceTimer = window.setTimeout(() => {
      mutationDebounceTimer = null;
      if (!isTabVisible()) return;
      if (isSpaQuiet()) {
        spaDomDirty = true;
        return;
      }
      if (isNonTargetTokenPage() || isTokenPageSettledWithBadge()) return;
      scheduleScan(debounceMs);
    }, debounceMs);
  });

  function rebindMutationObserver() {
    // 0.4.8: always documentElement — scoped roots detach after SPA and go silent.
    ensureDocumentObserver();
  }

  try {
    ensureDocumentObserver();
    getScanRoots(true);
  } catch (_err) {
    ensureDocumentObserver();
  }

  // 0.4.5: NO scroll listener — scrolling + 150ms full scan was main jank vs 0.3.4.
  // Virtual lists fire mutations; Intersection-ish viewport cull handles the rest.
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
    resumeForceRemountUntil = Date.now() + RESUME_FORCE_REMOUNT_MS;
    hardResetPipeline("init-was-discarded");
  }

  scheduleScan(100, { force: true, immediate: true });
})();
