/**
 * document_start (isolated): push list-filter prefs into PAGE before first list XHR.
 * MAIN page-hook reads data-flap-tax-recv / data-flap-suffix-hide + postMessage.
 */
(() => {
  const TAX_KEY = "flapFeeInfo.taxRecvHide.v1";
  const TAX_ATTR = "data-flap-tax-recv";
  const SUFFIX_KEY = "flapFeeInfo.suffixHide.v1";
  const SUFFIX_ATTR = "data-flap-suffix-hide";
  const OWN_KEY = "flapFeeInfo.ownedDisableShareWorker";
  const DEFAULT_TAX = { enabled: false, thresholdPct: 100 };
  const DEFAULT_SUFFIX = { enabled: false, rules: [] };
  const SUFFIX_MAX = 24;

  function normalizeTax(raw) {
    const out = { ...DEFAULT_TAX };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const thr = Number(raw.thresholdPct);
    if (Number.isFinite(thr)) {
      out.thresholdPct = Math.max(0, Math.min(100, Math.round(thr)));
    }
    return out;
  }

  function normalizeSuffix(raw) {
    const out = { enabled: false, rules: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const list = Array.isArray(raw.rules) ? raw.rules : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.rules.length < SUFFIX_MAX; i++) {
      let suffix = String(list[i]?.suffix || "")
        .trim()
        .toLowerCase()
        .replace(/^0x/, "")
        .replace(/[^a-f0-9]/g, "")
        .slice(0, 12);
      if (!suffix || seen.has(suffix)) continue;
      seen.add(suffix);
      out.rules.push({
        suffix,
        enabled: list[i]?.enabled !== false
      });
    }
    return out;
  }

  function isBscPage() {
    try {
      const u = new URL(location.href);
      const q = String(u.searchParams.get("chain") || "").toLowerCase();
      const path = String(u.pathname || "");
      if (q && q !== "bsc") return false;
      return (
        q === "bsc" ||
        /^\/bsc(\/|$)/i.test(path) ||
        /\/bsc\/token\//i.test(path) ||
        /\/token\/bsc(?:\/|$)/i.test(path)
      );
    } catch (_u) {
      return false;
    }
  }

  function syncShareWorker(taxOn, suffixOn) {
    try {
      const filterOn = (taxOn || suffixOn) && isBscPage();
      if (filterOn) {
        localStorage.setItem("disableShareWorker", "true");
        localStorage.setItem(OWN_KEY, "1");
      } else if (localStorage.getItem(OWN_KEY) === "1") {
        localStorage.removeItem("disableShareWorker");
        localStorage.removeItem(OWN_KEY);
      }
    } catch (_sw) {
      // ignore
    }
  }

  function publishTax(prefs) {
    const p = normalizeTax(prefs);
    const payload = JSON.stringify({
      enabled: p.enabled === true,
      thresholdPct: p.thresholdPct
    });
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute(TAX_ATTR, payload);
      }
    } catch (_e1) {
      // ignore
    }
    try {
      localStorage.setItem(TAX_KEY, payload);
    } catch (_ls) {
      // ignore
    }
    try {
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "tax-recv-prefs",
          prefs: {
            enabled: p.enabled === true,
            thresholdPct: p.thresholdPct
          }
        },
        "*"
      );
    } catch (_e2) {
      // ignore
    }
    return p;
  }

  function publishSuffix(prefs) {
    const p = normalizeSuffix(prefs);
    const payload = JSON.stringify({
      enabled: p.enabled === true,
      rules: p.rules
    });
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute(SUFFIX_ATTR, payload);
      }
    } catch (_e1) {
      // ignore
    }
    try {
      localStorage.setItem(SUFFIX_KEY, payload);
    } catch (_ls) {
      // ignore
    }
    try {
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "suffix-hide-prefs",
          prefs: {
            enabled: p.enabled === true,
            rules: p.rules
          }
        },
        "*"
      );
    } catch (_e2) {
      // ignore
    }
    return p;
  }

  function publishAll(taxRaw, suffixRaw) {
    const tax = publishTax(taxRaw);
    const suffix = publishSuffix(suffixRaw);
    const suffixActive =
      suffix.enabled === true &&
      (suffix.rules || []).some((r) => r && r.enabled !== false && r.suffix);
    syncShareWorker(tax.enabled === true, suffixActive);
  }

  // 启动时若 localStorage 已有，先同步 attr（storage 回调前的窗口）
  try {
    let taxCached = null;
    let suffixCached = null;
    try {
      const t = localStorage.getItem(TAX_KEY);
      if (t) taxCached = JSON.parse(t);
    } catch (_c1) {
      // ignore
    }
    try {
      const s = localStorage.getItem(SUFFIX_KEY);
      if (s) suffixCached = JSON.parse(s);
    } catch (_c2) {
      // ignore
    }
    if (taxCached || suffixCached) {
      publishAll(taxCached, suffixCached);
    }
  } catch (_ls0) {
    // ignore
  }

  function load() {
    try {
      if (!chrome?.storage?.local) {
        publishAll(DEFAULT_TAX, DEFAULT_SUFFIX);
        return;
      }
      chrome.storage.local.get([TAX_KEY, SUFFIX_KEY], (items) => {
        try {
          if (chrome.runtime?.lastError) {
            publishAll(DEFAULT_TAX, DEFAULT_SUFFIX);
            return;
          }
          publishAll(items?.[TAX_KEY], items?.[SUFFIX_KEY]);
        } catch (_err) {
          publishAll(DEFAULT_TAX, DEFAULT_SUFFIX);
        }
      });
    } catch (_err2) {
      publishAll(DEFAULT_TAX, DEFAULT_SUFFIX);
    }
  }

  load();
  try {
    setTimeout(load, 0);
    setTimeout(load, 50);
    setTimeout(load, 200);
  } catch (_t) {
    // ignore
  }

  try {
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (!changes[TAX_KEY] && !changes[SUFFIX_KEY]) return;
        // 重读两边，避免一侧变更时清掉另一侧 ShareWorker 状态
        try {
          chrome.storage.local.get([TAX_KEY, SUFFIX_KEY], (items) => {
            if (chrome.runtime?.lastError) return;
            publishAll(items?.[TAX_KEY], items?.[SUFFIX_KEY]);
          });
        } catch (_e) {
          // ignore
        }
      });
    }
  } catch (_l) {
    // ignore
  }
})();
