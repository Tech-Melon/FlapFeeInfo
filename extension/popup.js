(() => {
  const PREFS_KEY = "flapFeeInfo.displayPrefs.v1";
  const THEME_KEY = "flapFeeInfo.badgeTheme.v1";
  const DEFAULT_THEME = "dark";

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
  const themeDark = document.getElementById("themeDark");
  const themeLight = document.getElementById("themeLight");

  function normalizePrefs(raw) {
    const out = { ...DEFAULT_PREFS };
    if (raw && typeof raw === "object") {
      for (const def of PREF_DEFS) {
        if (typeof raw[def.key] === "boolean") out[def.key] = raw[def.key];
      }
    }
    return out;
  }

  function normalizeTheme(raw) {
    return raw === "light" ? "light" : DEFAULT_THEME;
  }

  function loadAll() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([PREFS_KEY, THEME_KEY], (items) => {
          if (chrome.runtime.lastError) {
            resolve({ prefs: { ...DEFAULT_PREFS }, theme: DEFAULT_THEME });
            return;
          }
          resolve({
            prefs: normalizePrefs(items?.[PREFS_KEY]),
            theme: normalizeTheme(items?.[THEME_KEY])
          });
        });
      } catch {
        resolve({ prefs: { ...DEFAULT_PREFS }, theme: DEFAULT_THEME });
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

  function saveTheme(theme) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [THEME_KEY]: normalizeTheme(theme) }, () => {
          void chrome.runtime?.lastError;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  function renderTheme(theme) {
    const t = normalizeTheme(theme);
    themeDark.classList.toggle("is-active", t === "dark");
    themeLight.classList.toggle("is-active", t === "light");
    themeDark.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
    themeLight.setAttribute("aria-pressed", t === "light" ? "true" : "false");
  }

  function renderPrefs(prefs) {
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
        const { prefs: cur } = await loadAll();
        cur[def.key] = input.checked;
        await savePrefs(cur);
      });
    }
  }

  async function setAll(value) {
    const next = Object.fromEntries(PREF_DEFS.map((d) => [d.key, value]));
    await savePrefs(next);
    renderPrefs(next);
  }

  themeDark.addEventListener("click", async () => {
    await saveTheme("dark");
    renderTheme("dark");
  });
  themeLight.addEventListener("click", async () => {
    await saveTheme("light");
    renderTheme("light");
  });

  btnAllOn.addEventListener("click", () => setAll(true));
  btnAllOff.addEventListener("click", () => setAll(false));

  loadAll().then(({ prefs, theme }) => {
    renderTheme(theme);
    renderPrefs(prefs);
  });
})();
