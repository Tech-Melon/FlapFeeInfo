/**
 * document_start (isolated): push list-filter prefs into PAGE before first list XHR.
 * MAIN page-hook reads data-flap-tax-recv / data-flap-suffix-hide / data-flap-vault-hide + postMessage.
 */
(() => {
  const TAX_KEY = "flapFeeInfo.taxRecvHide.v1";
  const TAX_ATTR = "data-flap-tax-recv";
  const SUFFIX_KEY = "flapFeeInfo.suffixHide.v1";
  const SUFFIX_ATTR = "data-flap-suffix-hide";
  const VAULT_KEY = "flapFeeInfo.vaultHide.v1";
  const VAULT_ATTR = "data-flap-vault-hide";
  const OWN_KEY = "flapFeeInfo.ownedDisableShareWorker";
  const DEFAULT_TAX = { enabled: false, thresholdPct: 100, allow: [] };
  const TAX_ALLOW_MAX = 24;
  const DEFAULT_SUFFIX = { enabled: false, rules: [] };
  const DEFAULT_VAULT = { enabled: false, hideTaxVault: false, hideStockVault: false };
  const SUFFIX_MAX = 24;

  function normalizeEvmAddress(raw) {
    const s = String(raw || "").trim().toLowerCase();
    const m = s.match(/0x[a-f0-9]{40}/);
    if (m) return m[0];
    const hex = s.replace(/^0x/, "").replace(/[^a-f0-9]/g, "");
    if (hex.length === 40) return `0x${hex}`;
    return "";
  }

  function normalizeTax(raw) {
    const out = { enabled: false, thresholdPct: 100, allow: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const thr = Number(raw.thresholdPct);
    if (Number.isFinite(thr)) {
      out.thresholdPct = Math.max(0, Math.min(100, Math.round(thr)));
    }
    const list = Array.isArray(raw.allow) ? raw.allow : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.allow.length < TAX_ALLOW_MAX; i += 1) {
      const row = list[i];
      const address = normalizeEvmAddress(row && (row.address || row.addr || row));
      if (!address || seen.has(address)) continue;
      seen.add(address);
      out.allow.push({
        address,
        enabled: !row || row.enabled !== false
      });
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

  function normalizeVault(raw) {
    const out = { ...DEFAULT_VAULT };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    out.hideTaxVault = raw.hideTaxVault === true;
    out.hideStockVault = raw.hideStockVault === true;
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

  function syncShareWorker(taxOn, suffixOn, vaultOn) {
    try {
      const filterOn = (taxOn || suffixOn || vaultOn) && isBscPage();
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
      thresholdPct: p.thresholdPct,
      allow: p.allow || []
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
            thresholdPct: p.thresholdPct,
            allow: p.allow || []
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

  function publishVault(prefs) {
    const p = normalizeVault(prefs);
    const payload = JSON.stringify({
      enabled: p.enabled === true,
      hideTaxVault: p.hideTaxVault === true,
      hideStockVault: p.hideStockVault === true
    });
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute(VAULT_ATTR, payload);
      }
    } catch (_e1) {
      // ignore
    }
    try {
      localStorage.setItem(VAULT_KEY, payload);
    } catch (_ls) {
      // ignore
    }
    try {
      window.postMessage(
        {
          source: "flap-fee-info",
          type: "vault-hide-prefs",
          prefs: {
            enabled: p.enabled === true,
            hideTaxVault: p.hideTaxVault === true,
            hideStockVault: p.hideStockVault === true
          }
        },
        "*"
      );
    } catch (_e2) {
      // ignore
    }
    return p;
  }

  function publishAll(taxRaw, suffixRaw, vaultRaw) {
    const tax = publishTax(taxRaw);
    const suffix = publishSuffix(suffixRaw);
    const vault = publishVault(vaultRaw);
    const suffixActive =
      suffix.enabled === true &&
      (suffix.rules || []).some((r) => r && r.enabled !== false && r.suffix);
    syncShareWorker(tax.enabled === true, suffixActive, vault.enabled === true);
  }

  // 启动时若 localStorage 已有，先同步 attr（storage 回调前的窗口）
  try {
    let taxCached = null;
    let suffixCached = null;
    let vaultCached = null;
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
    try {
      const v = localStorage.getItem(VAULT_KEY);
      if (v) vaultCached = JSON.parse(v);
    } catch (_c3) {
      // ignore
    }
    if (taxCached || suffixCached || vaultCached) {
      publishAll(taxCached, suffixCached, vaultCached);
    }
  } catch (_ls0) {
    // ignore
  }

  function load() {
    try {
      if (!chrome?.storage?.local) {
        publishAll(DEFAULT_TAX, DEFAULT_SUFFIX, DEFAULT_VAULT);
        return;
      }
      chrome.storage.local.get([TAX_KEY, SUFFIX_KEY, VAULT_KEY], (items) => {
        try {
          if (chrome.runtime?.lastError) {
            publishAll(DEFAULT_TAX, DEFAULT_SUFFIX, DEFAULT_VAULT);
            return;
          }
          publishAll(items?.[TAX_KEY], items?.[SUFFIX_KEY], items?.[VAULT_KEY]);
        } catch (_err) {
          publishAll(DEFAULT_TAX, DEFAULT_SUFFIX, DEFAULT_VAULT);
        }
      });
    } catch (_err2) {
      publishAll(DEFAULT_TAX, DEFAULT_SUFFIX, DEFAULT_VAULT);
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
        if (!changes[TAX_KEY] && !changes[SUFFIX_KEY] && !changes[VAULT_KEY]) return;
        try {
          chrome.storage.local.get([TAX_KEY, SUFFIX_KEY, VAULT_KEY], (items) => {
            if (chrome.runtime?.lastError) return;
            publishAll(items?.[TAX_KEY], items?.[SUFFIX_KEY], items?.[VAULT_KEY]);
          });
        } catch (_e) {
          // ignore
        }
      });
    }
  } catch (_l) {
    // ignore
  }

  /** MAIN world page-hook：manifest 为主；仅缺失时单次 script 兜底（禁止并发重试风暴） */
  const PAGE_HOOK_FILE = "page-hook.js";
  const PAGE_HOOK_VER = "87";
  const PAGE_HOOK_INJECT_LOCK_ATTR = "data-flap-page-hook-inject-at";

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

  let pageHookInjectTimer = 0;
  let pageHookInjectAttempts = 0;
  const PAGE_HOOK_MAX_INJECT = 2;

  function schedulePageHookInjectCheck(delayMs) {
    if (pageHookHostFeeReady()) return;
    if (pageHookInjectTimer) return;
    pageHookInjectTimer = window.setTimeout(() => {
      pageHookInjectTimer = 0;
      tryInjectPageHookMain();
    }, Math.max(0, Number(delayMs) || 0));
  }

  function tryInjectPageHookMain() {
    if (pageHookHostFeeReady()) return;
    if (!chrome?.runtime?.getURL) return;
    // manifest / 已有 script 在执行：只等 host-fee 落盘，勿再插 script
    if (pageHookScriptPresent()) {
      schedulePageHookInjectCheck(500);
      return;
    }
    try {
      const lockAt = Number(
        document.documentElement?.getAttribute?.(PAGE_HOOK_INJECT_LOCK_ATTR) || 0
      );
      if (lockAt && Date.now() - lockAt < 3000) {
        schedulePageHookInjectCheck(600);
        return;
      }
    } catch (_lk) {
      // ignore
    }
    if (pageHookInjectAttempts >= PAGE_HOOK_MAX_INJECT) return;
    pageHookInjectAttempts += 1;
    let src = "";
    try {
      src = chrome.runtime.getURL(PAGE_HOOK_FILE);
    } catch (_url) {
      return;
    }
    try {
      document.documentElement?.setAttribute(
        PAGE_HOOK_INJECT_LOCK_ATTR,
        String(Date.now())
      );
    } catch (_mark) {
      // ignore
    }
    try {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => {
        try {
          s.remove();
        } catch (_rm) {
          // ignore
        }
        schedulePageHookInjectCheck(600);
      };
      s.onerror = () => {
        try {
          s.remove();
        } catch (_rm2) {
          // ignore
        }
        try {
          document.documentElement?.removeAttribute(PAGE_HOOK_INJECT_LOCK_ATTR);
        } catch (_clr) {
          // ignore
        }
        if (pageHookInjectAttempts < PAGE_HOOK_MAX_INJECT) {
          schedulePageHookInjectCheck(1200);
        }
      };
      (document.documentElement || document.head || document.body).appendChild(s);
    } catch (_inj) {
      if (pageHookInjectAttempts < PAGE_HOOK_MAX_INJECT) {
        schedulePageHookInjectCheck(1000);
      }
    }
  }

  schedulePageHookInjectCheck(0);
  schedulePageHookInjectCheck(400);
})();
