(() => {
  const PREFS_KEY = "flapFeeInfo.displayPrefs.v1";
  const THEME_KEY = "flapFeeInfo.badgeTheme.v1";
  const OFFSET_KEY = "flapFeeInfo.badgeOffset.v2";
  const DRAG_KEY = "flapFeeInfo.badgeDragEdit.v1";
  const DEFAULT_THEME = "dark";
  const DEFAULT_OFFSETS = {
    gmgn: { enabled: false, x: 12, y: 8 },
    debot: { enabled: false, x: 12, y: 8 }
  };
  const OFFSET_MIN = -40;
  const OFFSET_MAX = 640;

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
  const btnOffsetReset = document.getElementById("btnOffsetReset");
  const offsetStatus = document.getElementById("offsetStatus");
  const dragEditToggle = document.getElementById("dragEditToggle");
  const offsetInputs = Array.from(document.querySelectorAll(".offset-input"));
  const offsetEnables = Array.from(document.querySelectorAll(".offset-enable-input"));
  const offsetSteps = Array.from(document.querySelectorAll(".btn-step"));
  const offsetSites = Array.from(document.querySelectorAll(".offset-site"));

  /** @type {{ gmgn: {enabled:boolean,x:number,y:number}, debot: {enabled:boolean,x:number,y:number} }} */
  let offsets = {
    gmgn: { ...DEFAULT_OFFSETS.gmgn },
    debot: { ...DEFAULT_OFFSETS.debot }
  };
  let dragEdit = false;
  let saveTimer = null;

  function clampOffset(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Math.round(v)));
  }

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

  function normalizeOffsets(raw) {
    const out = {
      gmgn: { ...DEFAULT_OFFSETS.gmgn },
      debot: { ...DEFAULT_OFFSETS.debot }
    };
    if (!raw || typeof raw !== "object") return out;
    for (const site of ["gmgn", "debot"]) {
      const o = raw[site];
      if (o && typeof o === "object") {
        out[site] = {
          enabled: o.enabled === true,
          x: clampOffset(o.x ?? DEFAULT_OFFSETS[site].x),
          y: clampOffset(o.y ?? DEFAULT_OFFSETS[site].y)
        };
      }
    }
    return out;
  }

  function loadAll() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([PREFS_KEY, THEME_KEY, OFFSET_KEY, DRAG_KEY], (items) => {
          if (chrome.runtime.lastError) {
            resolve({
              prefs: { ...DEFAULT_PREFS },
              theme: DEFAULT_THEME,
              offsets: normalizeOffsets(null),
              dragEdit: false
            });
            return;
          }
          resolve({
            prefs: normalizePrefs(items?.[PREFS_KEY]),
            theme: normalizeTheme(items?.[THEME_KEY]),
            offsets: normalizeOffsets(items?.[OFFSET_KEY]),
            dragEdit: items?.[DRAG_KEY] === true
          });
        });
      } catch {
        resolve({
          prefs: { ...DEFAULT_PREFS },
          theme: DEFAULT_THEME,
          offsets: normalizeOffsets(null),
          dragEdit: false
        });
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

  function saveOffsets(next) {
    const normalized = normalizeOffsets(next);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [OFFSET_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function saveDragEdit(on) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [DRAG_KEY]: on === true }, () => {
          void chrome.runtime?.lastError;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  function scheduleSaveOffsets() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      saveTimer = null;
      offsets = await saveOffsets(offsets);
      updateStatus();
    }, 160);
  }

  function updateStatus() {
    if (!offsetStatus) return;
    const g = offsets.gmgn;
    const d = offsets.debot;
    const parts = [];
    parts.push(g.enabled ? `GMGN 坐标(${g.x},${g.y})` : "GMGN 贴税率");
    parts.push(d.enabled ? `Debot 坐标(${d.x},${d.y})` : "Debot 贴税率");
    if (dragEdit) parts.push("拖拽中");
    offsetStatus.textContent = parts.join(" · ");
  }

  function fillOffsetUI(data) {
    for (const input of offsetInputs) {
      const site = input.dataset.site;
      const axis = input.dataset.axis;
      if (!site || !axis || !data[site]) continue;
      input.value = String(data[site][axis] ?? 0);
    }
    for (const cb of offsetEnables) {
      const site = cb.dataset.site;
      if (!site || !data[site]) continue;
      cb.checked = data[site].enabled === true;
    }
    for (const box of offsetSites) {
      const site = box.dataset.site;
      if (!site || !data[site]) continue;
      box.classList.toggle("is-disabled", data[site].enabled !== true);
    }
  }

  function readOffsetsFromUI() {
    const next = {
      gmgn: { ...offsets.gmgn },
      debot: { ...offsets.debot }
    };
    for (const cb of offsetEnables) {
      const site = cb.dataset.site;
      if (!site || !next[site]) continue;
      next[site].enabled = cb.checked === true;
    }
    for (const input of offsetInputs) {
      const site = input.dataset.site;
      const axis = input.dataset.axis;
      if (!site || !axis || !next[site]) continue;
      next[site][axis] = clampOffset(input.value);
      input.value = String(next[site][axis]);
    }
    return next;
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

  dragEditToggle?.addEventListener("change", async () => {
    dragEdit = dragEditToggle.checked === true;
    await saveDragEdit(dragEdit);
    updateStatus();
  });

  for (const cb of offsetEnables) {
    cb.addEventListener("change", () => {
      offsets = readOffsetsFromUI();
      fillOffsetUI(offsets);
      scheduleSaveOffsets();
    });
  }

  for (const input of offsetInputs) {
    input.addEventListener("change", () => {
      offsets = readOffsetsFromUI();
      // typing coords implies enable
      const site = input.dataset.site;
      if (site && offsets[site]) offsets[site].enabled = true;
      fillOffsetUI(offsets);
      scheduleSaveOffsets();
    });
    input.addEventListener("input", () => {
      offsets = readOffsetsFromUI();
      const site = input.dataset.site;
      if (site && offsets[site]) offsets[site].enabled = true;
      fillOffsetUI(offsets);
      scheduleSaveOffsets();
    });
  }

  for (const btn of offsetSteps) {
    btn.addEventListener("click", () => {
      const site = btn.dataset.site;
      const axis = btn.dataset.axis;
      const delta = Number(btn.dataset.delta) || 0;
      if (!site || !axis || !offsets[site]) return;
      offsets[site][axis] = clampOffset((Number(offsets[site][axis]) || 0) + delta);
      offsets[site].enabled = true;
      fillOffsetUI(offsets);
      scheduleSaveOffsets();
    });
  }

  btnOffsetReset?.addEventListener("click", async () => {
    offsets = normalizeOffsets(null);
    fillOffsetUI(offsets);
    await saveOffsets(offsets);
    updateStatus();
    if (offsetStatus) offsetStatus.textContent = "已恢复默认（贴税率旁）";
  });

  // Live refresh when drag on page writes storage
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[OFFSET_KEY]) {
        offsets = normalizeOffsets(changes[OFFSET_KEY].newValue);
        fillOffsetUI(offsets);
        updateStatus();
      }
      if (changes[DRAG_KEY]) {
        dragEdit = changes[DRAG_KEY].newValue === true;
        if (dragEditToggle) dragEditToggle.checked = dragEdit;
        updateStatus();
      }
    });
  } catch {
    // ignore
  }

  loadAll().then(({ prefs, theme, offsets: loadedOffsets, dragEdit: loadedDrag }) => {
    renderTheme(theme);
    renderPrefs(prefs);
    offsets = loadedOffsets;
    dragEdit = loadedDrag;
    if (dragEditToggle) dragEditToggle.checked = dragEdit;
    fillOffsetUI(offsets);
    updateStatus();
  });
})();
