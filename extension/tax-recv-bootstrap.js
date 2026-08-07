/**
 * document_start (isolated): push tax-recv prefs into PAGE before first list XHR when possible.
 * MAIN page-hook reads data-flap-tax-recv + postMessage.
 */
(() => {
  const KEY = "flapFeeInfo.taxRecvHide.v1";
  const PREFS_ATTR = "data-flap-tax-recv";
  const DEFAULT = { enabled: false, thresholdPct: 100 };

  function normalize(raw) {
    const out = { ...DEFAULT };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const thr = Number(raw.thresholdPct);
    if (Number.isFinite(thr)) {
      out.thresholdPct = Math.max(1, Math.min(100, Math.round(thr)));
    }
    return out;
  }

  function publish(prefs) {
    const p = normalize(prefs);
    const payload = JSON.stringify({
      enabled: p.enabled === true,
      thresholdPct: p.thresholdPct
    });
    // 1) DOM attr — page-hook MutationObserver / 低频同步可读
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute(PREFS_ATTR, payload);
      }
    } catch (_e1) {
      // ignore
    }
    // 2) 页面 localStorage（同源同步，供 MAIN page-hook document_start 下一跳秒读）
    try {
      localStorage.setItem(KEY, payload);
    } catch (_ls) {
      // ignore
    }
    // 2b) GMGN 列表过滤依赖主线程 WSS：开启屏蔽时临时写入，关闭时仅清理我们占用的
    try {
      const ownKey = "flapFeeInfo.ownedDisableShareWorker";
      if (p.enabled === true) {
        localStorage.setItem("disableShareWorker", "true");
        localStorage.setItem(ownKey, "1");
      } else if (localStorage.getItem(ownKey) === "1") {
        localStorage.removeItem("disableShareWorker");
        localStorage.removeItem(ownKey);
      }
    } catch (_sw) {
      // ignore
    }
    // 3) postMessage（MAIN 已放宽 source 校验）
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
  }

  // 启动时若 localStorage 已有，先同步 attr（storage 回调前的窗口）
  try {
    const cached = localStorage.getItem(KEY);
    if (cached) {
      try {
        publish(JSON.parse(cached));
      } catch (_c) {
        // ignore
      }
    }
  } catch (_ls0) {
    // ignore
  }

  function load() {
    try {
      if (!chrome?.storage?.local) {
        publish(DEFAULT);
        return;
      }
      chrome.storage.local.get([KEY], (items) => {
        try {
          if (chrome.runtime?.lastError) {
            publish(DEFAULT);
            return;
          }
          publish(items?.[KEY]);
        } catch (_err) {
          publish(DEFAULT);
        }
      });
    } catch (_err2) {
      publish(DEFAULT);
    }
  }

  load();
  // storage may resolve after first paint — re-push
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
        if (area !== "local" || !changes[KEY]) return;
        publish(changes[KEY].newValue);
      });
    }
  } catch (_l) {
    // ignore
  }
})();
