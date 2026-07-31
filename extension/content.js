(() => {
  const DEFAULT_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";
  const TOKEN_RE = /0x[a-fA-F0-9]{40}/;
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}(8888|7777)$/;
  const SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}[a-fA-F0-9]{2,6}/i;
  const TARGET_SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}(8888|7777)/i;
  const SCAN_INTERVAL_MS = 1200;
  const REQUEST_TIMEOUT_MS = 30000;
  const MAX_CANDIDATES_PER_SCAN = 180;
  const MAX_CARDS_PER_SCAN = 80;
  const MAX_BATCH_TOKENS = 120;
  const BATCH_FLUSH_MS = 350;
  const PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const PERSISTENT_CACHE_KEY = "flapFeeInfo.modeCache.v2";
  const DEBUG_PREFIX = "[FlapFeeInfo]";
  const CARD_MARK = "gmgnFeeModeCard";
  const ICON_MARK = "gmgnFeeModeIcon";
  const CARD_DATA = `data-${toKebab(CARD_MARK)}`;
  const ICON_DATA = `data-${toKebab(ICON_MARK)}`;
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
  let scanScheduled = false;
  let lastScanAt = 0;
  let persistentCacheReady = false;
  let persistentCacheReadyWaiters = [];

  hydratePersistentCache();

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
      getCandidateNodes,
      findCard(node) {
        return climbToCard(node, {
          maxDepth: 8,
          maxHeight: 180,
          requireFeeTag: true
        });
      },
      extractToken: extractCardTokenFromAttrs,
      findIconTarget: findTaxTag,
      // Put badge outside the narrow Tax chip / overflow:hidden wrappers.
      placeIcon(target, icon) {
        placeBesideTaxChip(target, icon);
      }
    };
  }

  function createDebotStrategy() {
    return {
      name: "debot",
      getCandidateNodes,
      findCard(node) {
        return climbToCard(node, {
          maxDepth: 7,
          maxHeight: 180,
          requireFeeTag: false
        });
      },
      extractToken: extractCardTokenFromAttrs,
      findIconTarget(card) {
        return findDebotMetricRow(card);
      },
      placeIcon(target, icon) {
        target.append(icon);
      }
    };
  }

  function scheduleScan(delay = 250) {
    if (scanScheduled) return;
    scanScheduled = true;

    window.setTimeout(() => {
      scanScheduled = false;
      const now = performance.now();
      if (now - lastScanAt < SCAN_INTERVAL_MS) {
        scheduleScan(SCAN_INTERVAL_MS - (now - lastScanAt));
        return;
      }
      lastScanAt = now;
      runWhenIdle(scanVisibleCards);
    }, delay);
  }

  function runWhenIdle(fn) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(fn, { timeout: 800 });
      return;
    }
    window.setTimeout(fn, 0);
  }

  function scanVisibleCards() {
    if (!persistentCacheReady) {
      scheduleScan(100);
      return;
    }

    const seenCards = new Set();
    const nodes = siteStrategy.getCandidateNodes();
    let touched = 0;

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

      if (modeCache.has(token)) {
        renderMode(card, token, modeCache.get(token));
      } else if (isPersistentCacheHit(token)) {
        const entry = persistentCache.get(token);
        modeCache.set(token, entry);
        renderMode(card, token, entry);
      } else {
        queueToken(token);
      }
    }

    debugInfo("scan", {
      site: siteStrategy.name,
      candidates: nodes.length,
      touched,
      queued: requestQueue.size
    });
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
    let current = node;
    for (let depth = 0; current && depth < options.maxDepth; depth += 1) {
      if (!(current instanceof HTMLElement)) break;
      const rect = current.getBoundingClientRect();
      const text = current.textContent || "";

      if (
        rect.width >= 260 &&
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

  function extractCardTokenFromAttrs(card) {
    const shortAddress = findTargetShortAddress(card);
    if (!shortAddress) return null;

    const direct = [
      card.getAttribute("href"),
      card.getAttribute("title"),
      card.getAttribute("aria-label"),
      card.getAttribute("data-token"),
      card.getAttribute("data-address")
    ];

    for (const value of direct) {
      const token = normalizeToken(value);
      if (token) return token;
    }

    const tokenNodes = card.querySelectorAll(
      "a[href*='0x'], [title*='0x'], [aria-label*='0x'], [data-token*='0x'], [data-address*='0x']"
    );
    for (const node of tokenNodes) {
      const token =
        normalizeToken(node.getAttribute("href")) ||
        normalizeToken(node.getAttribute("title")) ||
        normalizeToken(node.getAttribute("aria-label")) ||
        normalizeToken(node.getAttribute("data-token")) ||
        normalizeToken(node.getAttribute("data-address"));
      if (token) return token;
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

  function scheduleBatchFlush() {
    if (batchTimer || batchActive) return;
    batchTimer = window.setTimeout(flushTokenBatch, BATCH_FLUSH_MS);
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
    if (batchActive || requestQueue.size === 0) return;

    // Old content script after extension reload: stop all network work silently.
    if (!isExtensionContextValid()) {
      requestQueue.clear();
      return;
    }

    const tokens = Array.from(requestQueue).slice(0, MAX_BATCH_TOKENS);
    tokens.forEach((token) => requestQueue.delete(token));
    batchActive = true;

    try {
      debugInfo("request:start", { tokens });
      const data = await queryModes(tokens);
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
    } catch (error) {
      if (isContextInvalidError(error)) {
        requestQueue.clear();
        return;
      }
      debugWarn("request:failed", { tokens, error: normalizeError(error) });
      tokens.forEach((token) => requestQueue.add(token));
    } finally {
      batchActive = false;
      if (isExtensionContextValid() && requestQueue.size > 0) scheduleBatchFlush();
    }
  }

  async function queryModes(tokens) {
    if (!isExtensionContextValid()) {
      throw new Error("Extension context invalidated");
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
        debugError("request:bad-response", {
          status: res.status,
          body: data
        });
        throw new Error("batch query failed");
      }
      return data;
    } catch (error) {
      if (!isContextInvalidError(error)) {
        debugError("request:error", error);
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
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

  /** Compact badge text from bps (no spaces) so GMGN chips do not clip mid-emoji. */
  function buildDisplayLabel(entry) {
    const parts = [];
    if ((entry.dividend_bps || 0) > 0) parts.push(`💎${bpsToPercentStr(entry.dividend_bps)}`);
    if ((entry.market_bps || 0) > 0) {
      parts.push(
        entry.is_vault
          ? `🎁${bpsToPercentStr(entry.market_bps)}`
          : `👨‍🍳${bpsToPercentStr(entry.market_bps)}`
      );
    }
    if ((entry.deflation_bps || 0) > 0) parts.push(`🔥${bpsToPercentStr(entry.deflation_bps)}`);
    if ((entry.lp_bps || 0) > 0) parts.push(`💧${bpsToPercentStr(entry.lp_bps)}`);
    if (parts.length > 0) return parts.join("");
    if (typeof entry.label === "string" && entry.label) return entry.label.replace(/\s+/g, "");
    return modeMeta[entry.mode]?.fallback || modeMeta.unknown.fallback;
  }

  function renderMode(card, token, entry) {
    const target = siteStrategy.findIconTarget(card);
    if (!target) return;

    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((oldIcon) => oldIcon.remove());

    const icon = document.createElement("span");
    icon.dataset[ICON_MARK] = "1";
    siteStrategy.placeIcon(target, icon);

    const meta = modeMeta[entry.mode] || modeMeta.unknown;
    const label = buildDisplayLabel(entry);
    const segmentCount =
      Number((entry.dividend_bps || 0) > 0) +
      Number((entry.market_bps || 0) > 0) +
      Number((entry.deflation_bps || 0) > 0) +
      Number((entry.lp_bps || 0) > 0);

    icon.textContent = label;
    icon.title = `${entry.title || meta.title}\n${token}`;
    icon.className = [
      "gmgn-fee-mode-icon",
      `gmgn-fee-mode-icon--${meta.className}`,
      `gmgn-fee-mode-icon--${siteStrategy.name}`,
      segmentCount >= 3 ? "gmgn-fee-mode-icon--wide" : "",
      segmentCount >= 2 ? "gmgn-fee-mode-icon--multi" : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  function clearCardIcon(card) {
    delete card.dataset[CARD_MARK];
    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((icon) => icon.remove());
  }

  function cleanupMarkedCards() {
    document.querySelectorAll(`[${CARD_DATA}]`).forEach((card) => {
      const token = card.dataset[CARD_MARK];
      if (!token || siteStrategy.extractToken(card) !== token) clearCardIcon(card);
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

  function findDebotMetricRow(card) {
    const shortNode = findDebotShortAddressNode(card);
    if (!shortNode) return null;

    const shortRect = shortNode.getBoundingClientRect();
    const candidates = Array.from(card.querySelectorAll("div, span")).filter((el) => {
      if (el.contains(shortNode)) return false;
      if (el.querySelector(`[${ICON_DATA}="1"]`)) return false;

      const rect = el.getBoundingClientRect();
      const text = el.textContent || "";
      return (
        rect.top >= shortRect.top - 10 &&
        rect.left > shortRect.right + 8 &&
        rect.width >= 130 &&
        rect.height >= 16 &&
        rect.height <= 34 &&
        /%|Run|USD/i.test(text)
      );
    });

    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return Math.abs(ar.top - shortRect.top) - Math.abs(br.top - shortRect.top) || ar.left - br.left;
    });

    return candidates[0] || null;
  }

  function findDebotShortAddressNode(card) {
    const candidates = Array.from(card.querySelectorAll("span, div, a"));
    return candidates.find((el) => {
      if (!TARGET_SHORT_TOKEN_RE.test(el.textContent || "")) return false;
      const rect = el.getBoundingClientRect();
      return rect.width <= 120 && rect.height <= 28;
    });
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

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("scroll", () => scheduleScan(100), { passive: true });
  window.addEventListener("hashchange", () => scheduleScan(100), { passive: true });
  scheduleScan(100);
})();
