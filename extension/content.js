(() => {
  const DEFAULT_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";
  const TOKEN_RE = /0x[a-fA-F0-9]{40}/;
  const TARGET_TOKEN_RE = /^0x[a-fA-F0-9]{36}8888$/;
  const SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}[a-fA-F0-9]{2,6}/i;
  const TARGET_SHORT_TOKEN_RE = /0x[a-fA-F0-9]{2,6}\.{2,}8888/i;
  const SCAN_INTERVAL_MS = 1200;
  const REQUEST_TIMEOUT_MS = 30000;
  const MAX_CANDIDATES_PER_SCAN = 180;
  const MAX_CARDS_PER_SCAN = 80;
  const MAX_BATCH_TOKENS = 120;
  const BATCH_FLUSH_MS = 350;
  const CARD_MARK = "gmgnFeeModeCard";
  const ICON_MARK = "gmgnFeeModeIcon";
  const CARD_DATA = `data-${toKebab(CARD_MARK)}`;
  const ICON_DATA = `data-${toKebab(ICON_MARK)}`;

  const modeMeta = {
    holder: { icon: "💎钻", title: "Fee mode: holder dividend", className: "holder" },
    gift: { icon: "🎁礼", title: "Fee mode: vault gift", className: "gift" },
    creator: { icon: "🧑‍🍳创", title: "Fee mode: creator marketing", className: "creator" },
    unknown: { icon: "❓️未", title: "Fee mode: unknown", className: "unknown" }
  };

  const siteStrategy = createSiteStrategy();
  if (!siteStrategy) return;

  const modeCache = new Map();
  const requestQueue = new Set();
  let batchTimer = null;
  let batchActive = false;
  let scanScheduled = false;
  let lastScanAt = 0;

  function createSiteStrategy() {
    if (location.hostname.endsWith("gmgn.ai")) return createGmgnStrategy();
    if (location.hostname.endsWith("debot.ai")) return createDebotStrategy();
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
      placeIcon(target, icon) {
        target.prepend(icon);
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
      } else {
        queueToken(token);
      }
    }
  }

  function getCandidateNodes() {
    const candidates = [];
    const seen = new Set();

    const addNode = (node) => {
      if (!(node instanceof HTMLElement) || seen.has(node)) return;
      seen.add(node);
      candidates.push(node);
    };

    document
      .querySelectorAll(
        "a[href*='8888'], [title*='8888'], [aria-label*='8888'], [data-token*='8888'], [data-address*='8888']"
      )
      .forEach(addNode);

    const textNodes = document.evaluate(
      "//*[contains(text(), '8888')]",
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
    if (modeCache.has(token) || requestQueue.has(token)) return;
    requestQueue.add(token);
    scheduleBatchFlush();
  }

  function scheduleBatchFlush() {
    if (batchTimer || batchActive) return;
    batchTimer = window.setTimeout(flushTokenBatch, BATCH_FLUSH_MS);
  }

  async function flushTokenBatch() {
    batchTimer = null;
    if (batchActive || requestQueue.size === 0) return;

    const tokens = Array.from(requestQueue).slice(0, MAX_BATCH_TOKENS);
    tokens.forEach((token) => requestQueue.delete(token));
    batchActive = true;

    try {
      const data = await queryModes(tokens);
      Object.entries(data.results || {}).forEach(([token, result]) => {
        if (!result || !modeMeta[result.mode]) return;
        modeCache.set(token, result.mode);
        applyModeToKnownCards(token, result.mode);
      });
    } catch {
      tokens.forEach((token) => requestQueue.add(token));
    } finally {
      batchActive = false;
      if (requestQueue.size > 0) scheduleBatchFlush();
    }
  }

  async function queryModes(tokens) {
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
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("batch query failed");
      return data;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function applyModeToKnownCards(token, mode) {
    document.querySelectorAll(`[${CARD_DATA}="${token}"]`).forEach((card) => {
      if (siteStrategy.extractToken(card) === token) {
        renderMode(card, token, mode);
      } else {
        clearCardIcon(card);
      }
    });
  }

  function renderMode(card, token, mode) {
    const target = siteStrategy.findIconTarget(card);
    if (!target) return;

    card.querySelectorAll(`[${ICON_DATA}="1"]`).forEach((oldIcon) => oldIcon.remove());

    const icon = document.createElement("span");
    icon.dataset[ICON_MARK] = "1";
    icon.className = "gmgn-fee-mode-icon";
    siteStrategy.placeIcon(target, icon);

    const meta = modeMeta[mode] || modeMeta.unknown;
    icon.textContent = meta.icon;
    icon.title = `${meta.title}\n${token}`;
    icon.className = `gmgn-fee-mode-icon gmgn-fee-mode-icon--${meta.className} gmgn-fee-mode-icon--${siteStrategy.name}`;
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

  function findTaxTag(card) {
    const candidates = Array.from(card.querySelectorAll("span, div"));
    return candidates.find((el) => {
      const text = el.textContent?.trim() || "";
      const rect = el.getBoundingClientRect();
      return hasFeeTag(text) && rect.width <= 110 && rect.height <= 30;
    });
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

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("scroll", () => scheduleScan(100), { passive: true });
  window.addEventListener("hashchange", () => scheduleScan(100), { passive: true });
  scheduleScan(100);
})();
