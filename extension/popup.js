(() => {
  const PREFS_KEY = "flapFeeInfo.displayPrefs.v1";

  /** @type {Array<{ key: string, emoji: string, title: string, desc: string }>} */
  const PREF_DEFS = [
    { key: "pool", emoji: "🪙", title: "底池报价", desc: "如 🪙BNB | …" },
    { key: "holder", emoji: "💎", title: "持有人分红", desc: "dividend 分配" },
    { key: "creator", emoji: "👨‍🍳", title: "创作者/营销", desc: "非 vault 的 market" },
    { key: "gift", emoji: "🎁", title: "金库 vault", desc: "gift / 币股等" },
    { key: "burn", emoji: "🔥", title: "销毁", desc: "deflation" },
    { key: "lp", emoji: "💧", title: "回流 LP", desc: "加池流动性" },
    { key: "payoutArrow", emoji: "→", title: "分发币种标注", desc: "最大份额 →SYMBOL" },
    { key: "unknown", emoji: "❓️", title: "未知/未分配", desc: "链上无有效分配时" }
  ];

  const DEFAULT_PREFS = Object.fromEntries(PREF_DEFS.map((d) => [d.key, true]));

  const listEl = document.getElementById("prefList");
  const btnAllOn = document.getElementById("btnAllOn");
  const btnAllOff = document.getElementById("btnAllOff");

  function normalizePrefs(raw) {
    const out = { ...DEFAULT_PREFS };
    if (raw && typeof raw === "object") {
      for (const def of PREF_DEFS) {
        if (typeof raw[def.key] === "boolean") out[def.key] = raw[def.key];
      }
    }
    return out;
  }

  function loadPrefs() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([PREFS_KEY], (items) => {
          if (chrome.runtime.lastError) {
            resolve({ ...DEFAULT_PREFS });
            return;
          }
          resolve(normalizePrefs(items?.[PREFS_KEY]));
        });
      } catch {
        resolve({ ...DEFAULT_PREFS });
      }
    });
  }

  function savePrefs(prefs) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [PREFS_KEY]: prefs }, () => {
          void chrome.runtime?.lastError;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  function render(prefs) {
    listEl.innerHTML = "";
    for (const def of PREF_DEFS) {
      const row = document.createElement("label");
      row.className = "row";
      row.htmlFor = `pref-${def.key}`;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = `pref-${def.key}`;
      input.checked = Boolean(prefs[def.key]);
      input.dataset.key = def.key;

      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = def.emoji;

      const label = document.createElement("div");
      label.className = "label";
      label.innerHTML = `<strong>${def.title}</strong><span>${def.desc}</span>`;

      row.append(input, emoji, label);
      listEl.appendChild(row);

      input.addEventListener("change", async () => {
        const next = await loadPrefs();
        next[def.key] = input.checked;
        await savePrefs(next);
      });
    }
  }

  async function setAll(value) {
    const next = Object.fromEntries(PREF_DEFS.map((d) => [d.key, value]));
    await savePrefs(next);
    render(next);
  }

  btnAllOn.addEventListener("click", () => setAll(true));
  btnAllOff.addEventListener("click", () => setAll(false));

  loadPrefs().then(render);
})();
