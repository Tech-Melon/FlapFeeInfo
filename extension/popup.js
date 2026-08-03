(() => {
  const PREFS_KEY = "flapFeeInfo.displayPrefs.v1";
  const THEME_KEY = "flapFeeInfo.badgeTheme.v1";
  const SOLID_DARK_KEY = "flapFeeInfo.badgeSolidDark.v1";
  const DARK_TRANSPARENT_KEY_LEGACY = "flapFeeInfo.badgeDarkTransparent.v1";
  const OFFSET_KEY = "flapFeeInfo.badgeOffset.v2";
  const DRAG_KEY = "flapFeeInfo.badgeDragEdit.v1";
  const UI_LANG_KEY = "flapFeeInfo.uiLang.v1";
  const DEFAULT_THEME = "dark";
  const DEFAULT_OFFSETS = {
    gmgn: { enabled: false, x: 12, y: 8 },
    debot: { enabled: false, x: 12, y: 8 }
  };
  const OFFSET_MIN = -40;
  const OFFSET_MAX = 640;

  const I18N = {
    zh: {
      appTitle: "技术瓜FlapFeeInfo",
      appSub: "徽章显示 · 主题 · 位置",
      themeSection: "颜色主题",
      themeDark: "深色",
      themeDefault: "默认",
      themeHighContrast: "高对比",
      solidDarkTitle: "深色背景",
      solidDarkDesc: "仅「深色」主题可调：勾选=实心深底；默认=半透明配色",
      themeHintDefault: "深色可调背景；「高对比」固定实心深底+彩色字（不可调透明）。",
      themeHintDarkSolid: "深色 + 深色背景：实心深底（贴近卡片底色），彩色字边。",
      themeHintDarkTranslucent: "深色默认：半透明色底 + 彩色字（经典样式，无渐变）。",
      themeHintHighContrast: "高对比：固定实心深底 + 彩色字（不可调透明，保证清晰）。",
      prefSection: "显示项（默认全部开启）",
      prefSectionExpand: "显示项 · 点击展开",
      prefSectionCollapse: "显示项 · 点击收起",
      btnAllOn: "全部开启",
      btnAllOff: "全部关闭",
      posSection: "徽章位置",
      offsetHintHtml:
        "<strong>默认</strong>：贴合税率（Tax）旁，无需配置。<br />" +
        "<strong>卡片坐标 / 拖拽</strong>：GMGN 首页战壕与 <strong>K 线页左侧战壕列表</strong>共用同一套坐标；Debot/Gungnir /meme 另存。" +
        "<strong>K 线顶栏总税率</strong>始终贴合，不走坐标。<br />" +
        "坐标相对小卡片左上角。Robinhood 等非 bsc 链不扫描。",
      dragTitle: "页面内拖拽定位",
      dragDesc: "开启后拖一次徽章；松手写入坐标、同步全站并自动关闭拖拽",
      useCardCoords: "使用卡片坐标",
      btnResetOffset: "恢复默认（贴税率旁）",
      footerHint: "主题/显示项即时刷新。坐标模式关闭时徽章贴 Tax；开启后相对卡片左上角绝对定位。",
      statusGmgnTax: "GMGN 贴税率",
      statusGmgnCoord: "GMGN 坐标",
      statusDebotTax: "Debot 贴税率",
      statusDebotCoord: "Debot 坐标",
      statusDragging: "拖拽中",
      statusReset: "已恢复默认（贴税率旁）",
      pref_pool_title: "底池报价",
      pref_pool_desc: "如 🪙BNB | …",
      pref_holder_title: "持有人分红",
      pref_holder_desc: "dividend 分配",
      pref_creator_title: "创作者/营销",
      pref_creator_desc: "非 vault 的 market",
      pref_gift_title: "金库 vault",
      pref_gift_desc: "gift / 币股等",
      pref_burn_title: "销毁",
      pref_burn_desc: "deflation",
      pref_lp_title: "回流 LP",
      pref_lp_desc: "加池流动性",
      pref_payoutArrow_title: "分发币种标注",
      pref_payoutArrow_desc: "最大份额 →SYMBOL",
      pref_unknown_title: "未知/未分配",
      pref_unknown_desc: "链上无有效分配时"
    },
    en: {
      appTitle: "TechMelon FlapFeeInfo",
      appSub: "Badge · Theme · Position",
      themeSection: "Color theme",
      themeDark: "Dark",
      themeDefault: "Default",
      themeHighContrast: "High contrast",
      solidDarkTitle: "Solid dark fill",
      solidDarkDesc: "Dark theme only: on = solid card-like fill; off = translucent accents",
      themeHintDefault:
        "Dark theme: optional solid fill. High contrast: always solid dark chip (no transparent).",
      themeHintDarkSolid: "Dark + solid fill: opaque chip near card background, accent text.",
      themeHintDarkTranslucent: "Dark default: translucent accent fill + colored text (no gradient).",
      themeHintHighContrast: "High contrast: fixed solid dark chip + colored text (not adjustable).",
      prefSection: "Display items (all on by default)",
      prefSectionExpand: "Display items · expand",
      prefSectionCollapse: "Display items · collapse",
      btnAllOn: "Enable all",
      btnAllOff: "Disable all",
      posSection: "Badge position",
      offsetHintHtml:
        "<strong>Default</strong>: beside Tax chip, no setup.<br />" +
        "<strong>Card coords / drag</strong>: GMGN home trenches and <strong>K-line side trench list</strong> share one offset; Debot/Gungnir /meme stored separately. " +
        "<strong>K-line header tax rate</strong> always sticks, never uses coords.<br />" +
        "Offsets are px from the card top-left. Non-BSC chains (e.g. Robinhood) are not scanned.",
      dragTitle: "Drag to position",
      dragDesc: "Enable, drag one badge once; on release saves coords, syncs all, and turns drag off",
      useCardCoords: "Use card coords",
      btnResetOffset: "Reset (beside Tax)",
      footerHint:
        "Theme / display apply live. Coords off = beside Tax; on = absolute from card top-left.",
      statusGmgnTax: "GMGN beside Tax",
      statusGmgnCoord: "GMGN coords",
      statusDebotTax: "Debot beside Tax",
      statusDebotCoord: "Debot coords",
      statusDragging: "dragging",
      statusReset: "Reset to default (beside Tax)",
      pref_pool_title: "Pool quote",
      pref_pool_desc: "e.g. 🪙BNB | …",
      pref_holder_title: "Holder dividend",
      pref_holder_desc: "dividend share",
      pref_creator_title: "Creator / marketing",
      pref_creator_desc: "non-vault market",
      pref_gift_title: "Vault gift",
      pref_gift_desc: "gift / equity, etc.",
      pref_burn_title: "Burn",
      pref_burn_desc: "deflation",
      pref_lp_title: "LP recirculate",
      pref_lp_desc: "add liquidity",
      pref_payoutArrow_title: "Payout symbol",
      pref_payoutArrow_desc: "largest share →SYMBOL",
      pref_unknown_title: "Unknown",
      pref_unknown_desc: "no valid on-chain split"
    }
  };

  const PREF_KEYS = [
    "pool",
    "holder",
    "creator",
    "gift",
    "burn",
    "lp",
    "payoutArrow",
    "unknown"
  ];
  const PREF_EMOJI = {
    pool: "🪙",
    holder: "💎",
    creator: "👨‍🍳",
    gift: "🎁",
    burn: "🔥",
    lp: "💧",
    payoutArrow: "→",
    unknown: "❓️"
  };

  const DEFAULT_PREFS = Object.fromEntries(PREF_KEYS.map((k) => [k, true]));

  const listEl = document.getElementById("prefList");
  const btnAllOn = document.getElementById("btnAllOn");
  const btnAllOff = document.getElementById("btnAllOff");
  const themeDark = document.getElementById("themeDark");
  const themeLight = document.getElementById("themeLight");
  const solidDarkToggle = document.getElementById("solidDarkToggle");
  const solidDarkRow = document.getElementById("solidDarkRow");
  const themeHint = document.getElementById("themeHint");
  const offsetHint = document.getElementById("offsetHint");
  const btnOffsetReset = document.getElementById("btnOffsetReset");
  const offsetStatus = document.getElementById("offsetStatus");
  const dragEditToggle = document.getElementById("dragEditToggle");
  const langToggle = document.getElementById("langToggle");
  const prefCollapseBtn = document.getElementById("prefCollapseBtn");
  const prefCollapseBody = document.getElementById("prefCollapseBody");
  const prefChevron = document.getElementById("prefChevron");
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
  let solidDark = false;
  let currentTheme = DEFAULT_THEME;
  let uiLang = "zh";
  let prefsState = { ...DEFAULT_PREFS };
  let prefsExpanded = false;
  let saveTimer = null;

  function t(key) {
    const pack = I18N[uiLang] || I18N.zh;
    return pack[key] != null ? pack[key] : I18N.zh[key] || key;
  }

  function clampOffset(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Math.round(v)));
  }

  function normalizePrefs(raw) {
    const out = { ...DEFAULT_PREFS };
    if (raw && typeof raw === "object") {
      for (const key of PREF_KEYS) {
        if (typeof raw[key] === "boolean") out[key] = raw[key];
      }
    }
    return out;
  }

  function normalizeTheme(raw) {
    return raw === "light" ? "light" : DEFAULT_THEME;
  }

  function normalizeLang(raw) {
    return raw === "en" ? "en" : "zh";
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
        chrome.storage.local.get(
          [
            PREFS_KEY,
            THEME_KEY,
            SOLID_DARK_KEY,
            DARK_TRANSPARENT_KEY_LEGACY,
            OFFSET_KEY,
            DRAG_KEY,
            UI_LANG_KEY
          ],
          (items) => {
            if (chrome.runtime.lastError) {
              resolve({
                prefs: { ...DEFAULT_PREFS },
                theme: DEFAULT_THEME,
                solidDark: false,
                offsets: normalizeOffsets(null),
                dragEdit: false,
                lang: "zh"
              });
              return;
            }
            let solid = false;
            if (Object.prototype.hasOwnProperty.call(items || {}, SOLID_DARK_KEY)) {
              solid = items[SOLID_DARK_KEY] === true;
            } else if (
              Object.prototype.hasOwnProperty.call(items || {}, DARK_TRANSPARENT_KEY_LEGACY)
            ) {
              solid = items[DARK_TRANSPARENT_KEY_LEGACY] !== true;
            }
            resolve({
              prefs: normalizePrefs(items?.[PREFS_KEY]),
              theme: normalizeTheme(items?.[THEME_KEY]),
              solidDark: solid,
              offsets: normalizeOffsets(items?.[OFFSET_KEY]),
              dragEdit: items?.[DRAG_KEY] === true,
              lang: normalizeLang(items?.[UI_LANG_KEY])
            });
          }
        );
      } catch {
        resolve({
          prefs: { ...DEFAULT_PREFS },
          theme: DEFAULT_THEME,
          solidDark: false,
          offsets: normalizeOffsets(null),
          dragEdit: false,
          lang: "zh"
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

  function saveSolidDark(on) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [SOLID_DARK_KEY]: on === true }, () => {
          void chrome.runtime?.lastError;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  function saveLang(lang) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [UI_LANG_KEY]: normalizeLang(lang) }, () => {
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

  function applyStaticI18n() {
    document.documentElement.lang = uiLang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const val = t(key);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });
    if (langToggle) langToggle.textContent = uiLang === "zh" ? "EN" : "中文";
    if (offsetHint) offsetHint.innerHTML = t("offsetHintHtml");
    updatePrefCollapseLabel();
    updateStatus();
  }

  function updatePrefCollapseLabel() {
    const titleEl = prefCollapseBtn?.querySelector("[data-i18n='prefSection']");
    if (titleEl) {
      titleEl.textContent = prefsExpanded ? t("prefSectionCollapse") : t("prefSectionExpand");
    }
    if (prefChevron) prefChevron.textContent = prefsExpanded ? "▾" : "▸";
    if (prefCollapseBtn) {
      prefCollapseBtn.setAttribute("aria-expanded", prefsExpanded ? "true" : "false");
    }
  }

  function setPrefsExpanded(on) {
    prefsExpanded = on === true;
    if (prefCollapseBody) prefCollapseBody.hidden = !prefsExpanded;
    updatePrefCollapseLabel();
  }

  function updateStatus() {
    if (!offsetStatus) return;
    const g = offsets.gmgn;
    const d = offsets.debot;
    const parts = [];
    parts.push(
      g.enabled ? `${t("statusGmgnCoord")}(${g.x},${g.y})` : t("statusGmgnTax")
    );
    parts.push(
      d.enabled ? `${t("statusDebotCoord")}(${d.x},${d.y})` : t("statusDebotTax")
    );
    if (dragEdit) parts.push(t("statusDragging"));
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
    const th = normalizeTheme(theme);
    currentTheme = th;
    themeDark.classList.toggle("is-active", th === "dark");
    themeLight.classList.toggle("is-active", th === "light");
    themeDark.setAttribute("aria-pressed", th === "dark" ? "true" : "false");
    themeLight.setAttribute("aria-pressed", th === "light" ? "true" : "false");
    const solidOnlyDark = th === "dark";
    if (solidDarkRow) {
      solidDarkRow.classList.toggle("is-disabled", !solidOnlyDark);
      solidDarkRow.hidden = !solidOnlyDark;
    }
    if (solidDarkToggle) solidDarkToggle.disabled = !solidOnlyDark;
    if (themeHint) {
      if (th === "dark") {
        themeHint.textContent = solidDark
          ? t("themeHintDarkSolid")
          : t("themeHintDarkTranslucent");
      } else {
        themeHint.textContent = t("themeHintHighContrast");
      }
    }
  }

  function renderPrefs(prefs) {
    prefsState = normalizePrefs(prefs);
    listEl.innerHTML = "";
    for (const key of PREF_KEYS) {
      const row = document.createElement("label");
      row.className = "row";
      row.htmlFor = `pref-${key}`;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = `pref-${key}`;
      input.checked = Boolean(prefsState[key]);
      input.dataset.key = key;

      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = PREF_EMOJI[key] || "";

      const label = document.createElement("div");
      label.className = "label";
      label.innerHTML = `<strong></strong><span></span>`;
      label.querySelector("strong").textContent = t(`pref_${key}_title`);
      label.querySelector("span").textContent = t(`pref_${key}_desc`);

      row.append(input, emoji, label);
      listEl.appendChild(row);

      input.addEventListener("change", async () => {
        prefsState[key] = input.checked;
        await savePrefs(prefsState);
      });
    }
  }

  async function setAll(value) {
    const next = Object.fromEntries(PREF_KEYS.map((k) => [k, value]));
    prefsState = next;
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

  solidDarkToggle?.addEventListener("change", async () => {
    solidDark = solidDarkToggle.checked === true;
    await saveSolidDark(solidDark);
    renderTheme(currentTheme);
  });

  btnAllOn.addEventListener("click", () => setAll(true));
  btnAllOff.addEventListener("click", () => setAll(false));

  dragEditToggle?.addEventListener("change", async () => {
    dragEdit = dragEditToggle.checked === true;
    await saveDragEdit(dragEdit);
    updateStatus();
  });

  langToggle?.addEventListener("click", async () => {
    uiLang = uiLang === "zh" ? "en" : "zh";
    await saveLang(uiLang);
    applyStaticI18n();
    renderTheme(currentTheme);
    renderPrefs(prefsState);
  });

  prefCollapseBtn?.addEventListener("click", () => {
    setPrefsExpanded(!prefsExpanded);
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
    if (offsetStatus) offsetStatus.textContent = t("statusReset");
  });

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
      if (changes[THEME_KEY]) {
        renderTheme(normalizeTheme(changes[THEME_KEY].newValue));
      }
      if (changes[SOLID_DARK_KEY]) {
        solidDark = changes[SOLID_DARK_KEY].newValue === true;
        if (solidDarkToggle) solidDarkToggle.checked = solidDark;
        renderTheme(currentTheme);
      }
      if (changes[UI_LANG_KEY]) {
        uiLang = normalizeLang(changes[UI_LANG_KEY].newValue);
        applyStaticI18n();
        renderTheme(currentTheme);
        renderPrefs(prefsState);
      }
      if (changes[PREFS_KEY]) {
        prefsState = normalizePrefs(changes[PREFS_KEY].newValue);
        if (prefsExpanded) renderPrefs(prefsState);
      }
    });
  } catch {
    // ignore
  }

  loadAll().then(
    ({ prefs, theme, solidDark: loadedSolid, offsets: loadedOffsets, dragEdit: loadedDrag, lang }) => {
      uiLang = lang;
      solidDark = loadedSolid === true;
      if (solidDarkToggle) solidDarkToggle.checked = solidDark;
      offsets = loadedOffsets;
      dragEdit = loadedDrag;
      if (dragEditToggle) dragEditToggle.checked = dragEdit;
      prefsState = prefs;
      applyStaticI18n();
      renderTheme(theme);
      renderPrefs(prefs);
      // Display items collapsed by default
      setPrefsExpanded(false);
      fillOffsetUI(offsets);
      updateStatus();
    }
  );
})();
