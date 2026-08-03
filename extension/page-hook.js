/**
 * Runs in the PAGE main world (not content-script isolated world).
 * Debot/GMGN SPA often call history.pushState in main world; wrapping only
 * inside the content script is unreliable across Chromium builds.
 * Bridge: window.postMessage → content.js listens.
 */
(() => {
  if (window.__flapFeeInfoPageHook) return;
  window.__flapFeeInfoPageHook = 1;

  const fire = (reason) => {
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
    } catch (_err) {
      // ignore
    }
  };

  const wrap = (type) => {
    try {
      const orig = history[type];
      if (typeof orig !== "function") return;
      history[type] = function flapFeeWrappedHistory() {
        const ret = orig.apply(this, arguments);
        fire(type);
        return ret;
      };
    } catch (_err) {
      // ignore
    }
  };

  wrap("pushState");
  wrap("replaceState");

  try {
    window.addEventListener("popstate", () => fire("popstate"), true);
  } catch (_err) {
    // ignore
  }

  try {
    if (window.navigation && typeof window.navigation.addEventListener === "function") {
      window.navigation.addEventListener("navigate", () => {
        queueMicrotask(() => fire("navigation"));
      });
    }
  } catch (_err) {
    // ignore
  }
})();
