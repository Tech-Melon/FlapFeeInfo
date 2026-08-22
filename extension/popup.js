(() => {
  const PREFS_KEY = "flapFeeInfo.displayPrefs.v1";
  const THEME_KEY = "flapFeeInfo.badgeTheme.v1";
  const SOLID_DARK_KEY = "flapFeeInfo.badgeSolidDark.v1";
  const DARK_TRANSPARENT_KEY_LEGACY = "flapFeeInfo.badgeDarkTransparent.v1";
  const OFFSET_KEY = "flapFeeInfo.badgeOffset.v2";
  const DRAG_KEY = "flapFeeInfo.badgeDragEdit.v1";
  const UI_LANG_KEY = "flapFeeInfo.uiLang.v1";
  const TAX_RECV_HIDE_KEY = "flapFeeInfo.taxRecvHide.v1";
  const SUFFIX_HIDE_KEY = "flapFeeInfo.suffixHide.v1";
  const LICENSE_KEY = "flapFeeInfo.license.v1";
  const DEFAULT_THEME = "dark";
  const DEFAULT_TAX_RECV_HIDE = { enabled: false, thresholdPct: 100 };
  const DEFAULT_SUFFIX_HIDE = { enabled: false, rules: [] };
  const DEFAULT_LICENSE = { key: "" };
  const SUFFIX_HIDE_MAX_RULES = 24;
  const DEFAULT_OFFSETS = {
    gmgn: { enabled: false, x: 12, y: 8 },
    debot: { enabled: false, x: 12, y: 8 }
  };
  const OFFSET_MIN = -40;
  const OFFSET_MAX = 640;

  const I18N = {
    zh: {
      appTitle: "技术瓜FlapFeeInfo",
      appSub: "税收徽章 · 许可证 · 设置",
      catTools: "增强工具",
      catToolsDesc: "剪切板 · 搜索 · 阅读",
      catBadge: "徽章外观",
      catBadgeDesc: "主题与显示项",
      catFilter: "列表过滤",
      catFilterDesc: "战壕新创建列",
      catPosition: "徽章位置",
      catPositionDesc: "坐标与拖拽",
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
      pref_pool_desc: "🦋Flap / 🖐️Four / 🪙其它",
      pref_holder_title: "持有人分红",
      pref_holder_desc: "dividend 分配",
      pref_creator_title: "创作者/营销",
      pref_creator_desc: "非 vault 的 market",
      pref_gift_title: "金库 vault",
      pref_gift_desc: "gift / 币股等",
      pref_giggle_title: "Giggle 慈善",
      pref_giggle_desc: "Four.meme Giggle Academy",
      pref_binance_title: "Binance 慈善",
      pref_binance_desc: "Four.meme Binance charity",
      pref_basket_title: "币股分红资产",
      pref_basket_desc: "📈 展示篮子成分（SPCX&TSLA…）",
      pref_openTaxinfo_title: "点击徽章打开详情",
      pref_openTaxinfo_desc: "Flap→flap.sh；Four ffff→four.meme 代币页",
      pref_burn_title: "销毁",
      pref_burn_desc: "deflation",
      pref_lp_title: "回流 LP",
      pref_lp_desc: "加池流动性",
      pref_payoutArrow_title: "分发币种标注",
      pref_payoutArrow_desc: "最大份额 →SYMBOL",
      pref_unknown_title: "未知/未分配",
      pref_unknown_desc: "链上无有效分配时",
      taxRecvSection: "资金接收方屏蔽",
      taxRecvHint:
        "仅战壕/Meme「新创建」栏生效（即将打满/已开盘·已迁移不筛）。不含 K 线顶栏、搜索弹层。不额外请求；金库始终显示。默认关闭。",
      taxRecvEnableTitle: "启用屏蔽",
      taxRecvEnableDesc: "开启后只过滤「新创建」列",
      taxRecvThresholdLabel: "阈值 ≥",
      taxRecvThresholdLabelGt: "阈值 >",
      taxRecvHint2:
        "仅新创建：7777/8888 且 👨‍🍳 达阈值则屏蔽（含 hybrid）。0% = 严格大于 0%（只要有 dev 分配就挡，不会挡 0%）。纯 💎/🎁金库不挡。即将打满与已开盘原样显示。",
      suffixHideSection: "自定义尾号屏蔽",
      suffixHideHint:
        "仅 BSC 生效。隐藏 CA 以指定十六进制尾号结尾的代币（可多条）。战壕「新创建」列数据层过滤。默认关闭。",
      suffixHideEnableTitle: "启用尾号屏蔽",
      suffixHideEnableDesc: "开启后按下方规则过滤列表",
      suffixAddPlaceholder: "如 0000 / dead",
      suffixAddBtn: "添加",
      suffixHideHint2: "例：添加 dead → 屏蔽所有以 dead 结尾的 0x 地址。最多 24 条；仅 hex 字符。",
      suffixRuleDel: "删除",
      suffixEmpty: "暂无规则，在下方输入尾号后添加",
      licenseSection: "许可证（可选）",
      licenseHeroTitle: "访问许可证",
      licenseHeroSub: "当前免费可用 · 付费后粘贴 TG Bot 密钥",
      licensePillFree: "免费",
      licensePillActive: "已配置",
      licenseHint:
        "当前免费可用，密钥可留空。购买 Flap 套餐后粘贴 TG Bot 发来的密钥；一钥绑定本 Chrome 配置。",
      licenseKeyLabel: "访问密钥",
      licenseKeyPlaceholder: "粘贴密钥（可留空）",
      licenseSaveBtn: "保存",
      licenseClearBtn: "清除",
      licenseSaved: "已保存（本机，不会上传原文到其它存储）",
      licenseCleared: "已清除",
      licenseEmpty: "未填写密钥（免费模式）",
      licenseInvalid: "密钥格式无效",
      suffixDup: "该尾号已存在",
      suffixInvalid: "请输入 1–12 位十六进制字符",
    },
    en: {
      appTitle: "TechMelon FlapFeeInfo",
      appSub: "Tax badges · License · Settings",
      catTools: "Productivity",
      catToolsDesc: "Clipboard · Search · Reading",
      catBadge: "Badge look",
      catBadgeDesc: "Theme & display",
      catFilter: "List filters",
      catFilterDesc: "New column only",
      catPosition: "Badge position",
      catPositionDesc: "Coords & drag",
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
      pref_pool_desc: "🦋Flap / 🖐️Four / 🪙other",
      pref_holder_title: "Holder dividend",
      pref_holder_desc: "dividend share",
      pref_creator_title: "Creator / marketing",
      pref_creator_desc: "non-vault market",
      pref_gift_title: "Vault gift",
      pref_gift_desc: "gift / equity, etc.",
      pref_giggle_title: "Giggle charity",
      pref_giggle_desc: "Four.meme Giggle Academy",
      pref_binance_title: "Binance charity",
      pref_binance_desc: "Four.meme Binance charity",
      pref_basket_title: "Equity basket",
      pref_basket_desc: "📈 show underlyings (SPCX&TSLA…)",
      pref_openTaxinfo_title: "Click badge to open",
      pref_openTaxinfo_desc: "Flap→flap.sh; Four ffff→four.meme token page",
      pref_burn_title: "Burn",
      pref_burn_desc: "deflation",
      pref_lp_title: "LP recirculate",
      pref_lp_desc: "add liquidity",
      pref_payoutArrow_title: "Payout symbol",
      pref_payoutArrow_desc: "largest share →SYMBOL",
      pref_unknown_title: "Unknown",
      pref_unknown_desc: "no valid on-chain split",
      taxRecvSection: "Hide fund recipients",
      taxRecvHint:
        "Only the New/Creation column on trench lists (not Almost full / Completed). No K-line header or search overlay. No extra requests; vaults always shown. Off by default.",
      taxRecvEnableTitle: "Enable hide",
      taxRecvEnableDesc: "Only filter the New creation column",
      taxRecvThresholdLabel: "Threshold ≥",
      taxRecvThresholdLabelGt: "Threshold >",
      taxRecvHint2:
        "New column only: hide 7777/8888 when marketing hits the threshold (incl. hybrid). 0% = strictly > 0% (any dev share hides it; a 0% split is kept). Pure 💎 / vault kept.",
      suffixHideSection: "Custom CA suffix hide",
      suffixHideHint:
        "BSC only. Hide tokens whose CA ends with a hex suffix (multi-rule). Filters New creation column at data layer. Off by default.",
      suffixHideEnableTitle: "Enable suffix hide",
      suffixHideEnableDesc: "Filter list by rules below",
      suffixAddPlaceholder: "e.g. 0000 / dead",
      suffixAddBtn: "Add",
      suffixHideHint2:
        "E.g. add dead → hide all 0x addresses ending in dead. Max 24 rules; hex only.",
      suffixRuleDel: "Del",
      suffixEmpty: "No rules yet — type a suffix below and add",
      licenseSection: "License (optional)",
      licenseHeroTitle: "Access license",
      licenseHeroSub: "Free for now · paste TG bot key when paid",
      licensePillFree: "Free",
      licensePillActive: "Configured",
      licenseHint:
        "Free for now — leave blank. Paste key from TG bot after purchase; one key per Chrome profile.",
      licenseKeyLabel: "Access key",
      licenseKeyPlaceholder: "Paste key (optional)",
      licenseSaveBtn: "Save",
      licenseClearBtn: "Clear",
      licenseSaved: "Saved locally (not uploaded elsewhere)",
      licenseCleared: "Cleared",
      licenseEmpty: "No key (free mode)",
      licenseInvalid: "Invalid key format",
      suffixDup: "Suffix already exists",
      suffixInvalid: "Enter 1–12 hex characters",
    }
  };

  const PREF_KEYS = [
    "pool",
    "holder",
    "creator",
    "gift",
    "giggle",
    "binance",
    "basket",
    "openTaxinfo",
    "burn",
    "lp",
    "payoutArrow",
    "unknown"
  ];
  const PREF_EMOJI = {
    pool: "🦋",
    holder: "💎",
    creator: "👨‍🍳",
    gift: "🎁",
    giggle: "🎓",
    binance: "💛",
    basket: "📈",
    openTaxinfo: "🔗",
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
  const taxRecvEnabled = document.getElementById("taxRecvEnabled");
  const taxRecvThreshold = document.getElementById("taxRecvThreshold");
  const taxRecvThresholdRange = document.getElementById("taxRecvThresholdRange");
  const taxRecvThresholdRow = document.getElementById("taxRecvThresholdRow");
  const suffixHideEnabled = document.getElementById("suffixHideEnabled");
  const suffixRulesWrap = document.getElementById("suffixRulesWrap");
  const suffixRulesList = document.getElementById("suffixRulesList");
  const suffixAddInput = document.getElementById("suffixAddInput");
  const suffixAddBtn = document.getElementById("suffixAddBtn");

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
  let taxRecvState = { ...DEFAULT_TAX_RECV_HIDE };
  let taxRecvSaveTimer = null;
  /** @type {{ enabled: boolean, rules: Array<{id:string, suffix:string, enabled:boolean}> }} */
  let suffixHideState = { enabled: false, rules: [] };
  let suffixHideSaveTimer = null;

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

  function normalizeTaxRecvHide(raw) {
    const out = { ...DEFAULT_TAX_RECV_HIDE };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const thr = Number(raw.thresholdPct);
    if (Number.isFinite(thr)) {
      out.thresholdPct = Math.max(0, Math.min(100, Math.round(thr)));
    }
    return out;
  }

  function normalizeSuffixRule(raw, idx) {
    const id =
      raw && typeof raw.id === "string" && raw.id
        ? raw.id
        : `r${Date.now().toString(36)}_${idx || 0}`;
    let suffix = String(raw?.suffix || "")
      .trim()
      .toLowerCase()
      .replace(/^0x/, "")
      .replace(/[^a-f0-9]/g, "")
      .slice(0, 12);
    return {
      id,
      suffix,
      enabled: raw?.enabled !== false
    };
  }

  function normalizeSuffixHide(raw) {
    const out = { enabled: false, rules: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const list = Array.isArray(raw.rules) ? raw.rules : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.rules.length < SUFFIX_HIDE_MAX_RULES; i++) {
      const r = normalizeSuffixRule(list[i], i);
      if (!r.suffix || r.suffix.length < 1) continue;
      if (seen.has(r.suffix)) continue;
      seen.add(r.suffix);
      out.rules.push(r);
    }
    return out;
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

  function normalizeLicense(raw) {
    const key = String(raw?.key || raw || "")
      .trim()
      .replace(/\s+/g, "");
    if (!key) return { ...DEFAULT_LICENSE };
    // Allow printable keys from TG bot (alphanumeric + common separators).
    if (!/^[A-Za-z0-9._~\-]{8,128}$/.test(key)) return null;
    return { key };
  }

  function saveLicense(state) {
    const normalized = normalizeLicense(state);
    if (!normalized) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [LICENSE_KEY]: normalized }, () => {
          resolve(chrome.runtime.lastError ? null : normalized);
        });
      } catch {
        resolve(null);
      }
    });
  }

  let licenseState = { ...DEFAULT_LICENSE };
  const licenseKeyInput = document.getElementById("licenseKeyInput");
  const licenseSaveBtn = document.getElementById("licenseSaveBtn");
  const licenseClearBtn = document.getElementById("licenseClearBtn");
  const licenseStatus = document.getElementById("licenseStatus");
  const licensePill = document.getElementById("licensePill");

  function setLicenseStatus(msg) {
    if (licenseStatus) licenseStatus.textContent = msg || "";
  }

  function updateLicensePill() {
    if (!licensePill) return;
    const active = Boolean(licenseState.key);
    licensePill.dataset.state = active ? "active" : "free";
    licensePill.textContent = active ? t("licensePillActive") : t("licensePillFree");
  }

  function renderLicenseUI(state) {
    licenseState = normalizeLicense(state) || { ...DEFAULT_LICENSE };
    if (licenseKeyInput) {
      licenseKeyInput.value = licenseState.key || "";
    }
    updateLicensePill();
    if (!licenseState.key) {
      setLicenseStatus(t("licenseEmpty"));
    }
  }

  async function onLicenseSave() {
    const raw = licenseKeyInput?.value || "";
    const next = normalizeLicense({ key: raw });
    if (!next) {
      setLicenseStatus(t("licenseInvalid"));
      return;
    }
    const saved = await saveLicense(next);
    if (!saved) {
      setLicenseStatus(t("licenseInvalid"));
      return;
    }
    licenseState = saved;
    updateLicensePill();
    setLicenseStatus(saved.key ? t("licenseSaved") : t("licenseEmpty"));
  }

  async function onLicenseClear() {
    if (licenseKeyInput) licenseKeyInput.value = "";
    await saveLicense({ key: "" });
    licenseState = { ...DEFAULT_LICENSE };
    updateLicensePill();
    setLicenseStatus(t("licenseCleared"));
  }

  if (licenseSaveBtn) licenseSaveBtn.addEventListener("click", () => void onLicenseSave());
  if (licenseClearBtn) licenseClearBtn.addEventListener("click", () => void onLicenseClear());
  if (licenseKeyInput) {
    licenseKeyInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void onLicenseSave();
      }
    });
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
            UI_LANG_KEY,
            TAX_RECV_HIDE_KEY,
            SUFFIX_HIDE_KEY,
            LICENSE_KEY,
          ],
          (items) => {
            if (chrome.runtime.lastError) {
              resolve({
                prefs: { ...DEFAULT_PREFS },
                theme: DEFAULT_THEME,
                solidDark: false,
                offsets: normalizeOffsets(null),
                dragEdit: false,
                lang: "zh",
                taxRecv: { ...DEFAULT_TAX_RECV_HIDE },
                suffixHide: { ...DEFAULT_SUFFIX_HIDE },
                license: { ...DEFAULT_LICENSE },
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
              lang: normalizeLang(items?.[UI_LANG_KEY]),
              taxRecv: normalizeTaxRecvHide(items?.[TAX_RECV_HIDE_KEY]),
              suffixHide: normalizeSuffixHide(items?.[SUFFIX_HIDE_KEY]),
              license: normalizeLicense(items?.[LICENSE_KEY]) || { ...DEFAULT_LICENSE },
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
          lang: "zh",
          taxRecv: { ...DEFAULT_TAX_RECV_HIDE },
          suffixHide: { ...DEFAULT_SUFFIX_HIDE },
          license: { ...DEFAULT_LICENSE },
        });
      }
    });
  }

  function saveTaxRecvHide(state) {
    const normalized = normalizeTaxRecvHide(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [TAX_RECV_HIDE_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveTaxRecv() {
    if (taxRecvSaveTimer) window.clearTimeout(taxRecvSaveTimer);
    taxRecvSaveTimer = window.setTimeout(async () => {
      taxRecvSaveTimer = null;
      taxRecvState = await saveTaxRecvHide(taxRecvState);
      renderTaxRecvUI(taxRecvState);
    }, 120);
  }

  function syncTaxRecvThresholdLabel() {
    const el = document.querySelector('[data-i18n="taxRecvThresholdLabel"]');
    if (!el) return;
    el.textContent =
      Number(taxRecvState.thresholdPct) <= 0 ? t("taxRecvThresholdLabelGt") : t("taxRecvThresholdLabel");
  }

  function renderTaxRecvUI(state) {
    taxRecvState = normalizeTaxRecvHide(state);
    if (taxRecvEnabled) taxRecvEnabled.checked = taxRecvState.enabled === true;
    const thr = String(taxRecvState.thresholdPct);
    if (taxRecvThreshold) taxRecvThreshold.value = thr;
    if (taxRecvThresholdRange) taxRecvThresholdRange.value = thr;
    if (taxRecvThresholdRow) {
      taxRecvThresholdRow.classList.toggle("is-disabled", taxRecvState.enabled !== true);
    }
    syncTaxRecvThresholdLabel();
  }

  function readTaxRecvFromUI() {
    const thrRaw = Number(taxRecvThreshold?.value ?? taxRecvThresholdRange?.value ?? 100);
    return normalizeTaxRecvHide({
      enabled: taxRecvEnabled?.checked === true,
      thresholdPct: thrRaw
    });
  }

  function saveSuffixHide(state) {
    const normalized = normalizeSuffixHide(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [SUFFIX_HIDE_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveSuffixHide() {
    if (suffixHideSaveTimer) window.clearTimeout(suffixHideSaveTimer);
    suffixHideSaveTimer = window.setTimeout(async () => {
      suffixHideSaveTimer = null;
      suffixHideState = await saveSuffixHide(suffixHideState);
      renderSuffixHideUI(suffixHideState);
    }, 120);
  }

  function renderSuffixHideUI(state) {
    suffixHideState = normalizeSuffixHide(state);
    if (suffixHideEnabled) {
      suffixHideEnabled.checked = suffixHideState.enabled === true;
    }
    if (suffixRulesWrap) {
      suffixRulesWrap.classList.toggle("is-disabled", suffixHideState.enabled !== true);
    }
    if (!suffixRulesList) return;
    suffixRulesList.innerHTML = "";
    const rules = suffixHideState.rules || [];
    if (!rules.length) {
      const empty = document.createElement("div");
      empty.className = "suffix-empty";
      empty.textContent = t("suffixEmpty");
      suffixRulesList.appendChild(empty);
      return;
    }
    for (const rule of rules) {
      const row = document.createElement("div");
      row.className = "suffix-rule-row";
      row.dataset.id = rule.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = rule.enabled !== false;
      cb.title = rule.suffix;
      cb.addEventListener("change", () => {
        const r = suffixHideState.rules.find((x) => x.id === rule.id);
        if (!r) return;
        r.enabled = cb.checked === true;
        scheduleSaveSuffixHide();
      });

      const text = document.createElement("span");
      text.className = "suffix-rule-text" + (rule.enabled === false ? " is-off" : "");
      text.textContent = `…${rule.suffix}`;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "suffix-rule-del";
      del.textContent = t("suffixRuleDel");
      del.addEventListener("click", () => {
        suffixHideState.rules = suffixHideState.rules.filter((x) => x.id !== rule.id);
        scheduleSaveSuffixHide();
      });

      row.append(cb, text, del);
      suffixRulesList.appendChild(row);
    }
  }

  function tryAddSuffixRule() {
    if (!suffixAddInput) return;
    let raw = String(suffixAddInput.value || "")
      .trim()
      .toLowerCase()
      .replace(/^0x/, "")
      .replace(/[^a-f0-9]/g, "")
      .slice(0, 12);
    if (!raw) {
      suffixAddInput.placeholder = t("suffixInvalid");
      return;
    }
    const exists = (suffixHideState.rules || []).some((r) => r.suffix === raw);
    if (exists) {
      suffixAddInput.placeholder = t("suffixDup");
      suffixAddInput.value = "";
      return;
    }
    if ((suffixHideState.rules || []).length >= SUFFIX_HIDE_MAX_RULES) return;
    suffixHideState.rules = [
      ...(suffixHideState.rules || []),
      { id: `r${Date.now().toString(36)}`, suffix: raw, enabled: true }
    ];
    // 添加规则时自动开启总开关，避免用户漏勾
    if (!suffixHideState.enabled) {
      suffixHideState.enabled = true;
      if (suffixHideEnabled) suffixHideEnabled.checked = true;
    }
    suffixAddInput.value = "";
    suffixAddInput.placeholder = t("suffixAddPlaceholder");
    scheduleSaveSuffixHide();
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
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.placeholder = t(key);
    });
    if (langToggle) langToggle.textContent = uiLang === "zh" ? "EN" : "中文";
    if (offsetHint) offsetHint.innerHTML = t("offsetHintHtml");
    syncTaxRecvThresholdLabel();
    updatePrefCollapseLabel();
    updateLicensePill();
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

  function setSectionExpanded(name, on) {
    const btn = document.querySelector(`[data-collapse="${name}"]`);
    const body = document.getElementById(`${name}CollapseBody`);
    const expanded = on === true;
    if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (body) body.hidden = !expanded;
    if (btn) btn.classList.toggle("is-expanded", expanded);
    const chevron = btn?.querySelector(".collapse-chevron");
    if (chevron) chevron.textContent = expanded ? "▾" : "▸";
    if (name === "pref") {
      prefsExpanded = expanded;
      updatePrefCollapseLabel();
    }
  }

  function setPrefsExpanded(on) {
    setSectionExpanded("pref", on);
  }

  function bindCollapseHeads() {
    document.querySelectorAll("[data-collapse]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-collapse");
        if (!name) return;
        const expanded = btn.getAttribute("aria-expanded") === "true";
        setSectionExpanded(name, !expanded);
      });
    });
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
    renderTaxRecvUI(taxRecvState);
    renderSuffixHideUI(suffixHideState);
  });

  taxRecvEnabled?.addEventListener("change", () => {
    taxRecvState = readTaxRecvFromUI();
    renderTaxRecvUI(taxRecvState);
    scheduleSaveTaxRecv();
  });

  const syncTaxRecvThreshold = (fromRange) => {
    if (fromRange && taxRecvThresholdRange && taxRecvThreshold) {
      taxRecvThreshold.value = taxRecvThresholdRange.value;
    } else if (!fromRange && taxRecvThreshold && taxRecvThresholdRange) {
      taxRecvThresholdRange.value = taxRecvThreshold.value;
    }
    taxRecvState = readTaxRecvFromUI();
    renderTaxRecvUI(taxRecvState);
    scheduleSaveTaxRecv();
  };
  taxRecvThreshold?.addEventListener("change", () => syncTaxRecvThreshold(false));
  taxRecvThreshold?.addEventListener("input", () => syncTaxRecvThreshold(false));
  taxRecvThresholdRange?.addEventListener("input", () => syncTaxRecvThreshold(true));
  taxRecvThresholdRange?.addEventListener("change", () => syncTaxRecvThreshold(true));

  suffixHideEnabled?.addEventListener("change", () => {
    suffixHideState = normalizeSuffixHide({
      ...suffixHideState,
      enabled: suffixHideEnabled.checked === true
    });
    renderSuffixHideUI(suffixHideState);
    scheduleSaveSuffixHide();
  });
  suffixAddBtn?.addEventListener("click", () => tryAddSuffixRule());
  suffixAddInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      tryAddSuffixRule();
    }
  });
  suffixAddInput?.addEventListener("input", () => {
    // 仅允许 hex
    const cleaned = String(suffixAddInput.value || "")
      .toLowerCase()
      .replace(/^0x/, "")
      .replace(/[^a-f0-9]/g, "")
      .slice(0, 12);
    if (suffixAddInput.value !== cleaned) suffixAddInput.value = cleaned;
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
        renderTaxRecvUI(taxRecvState);
        renderSuffixHideUI(suffixHideState);
      }
      if (changes[TAX_RECV_HIDE_KEY]) {
        taxRecvState = normalizeTaxRecvHide(changes[TAX_RECV_HIDE_KEY].newValue);
        renderTaxRecvUI(taxRecvState);
      }
      if (changes[SUFFIX_HIDE_KEY]) {
        suffixHideState = normalizeSuffixHide(changes[SUFFIX_HIDE_KEY].newValue);
        renderSuffixHideUI(suffixHideState);
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
    ({
      prefs,
      theme,
      solidDark: loadedSolid,
      offsets: loadedOffsets,
      dragEdit: loadedDrag,
      lang,
      taxRecv: loadedTaxRecv,
      suffixHide: loadedSuffixHide,
      license: loadedLicense,
    }) => {
      uiLang = lang;
      solidDark = loadedSolid === true;
      if (solidDarkToggle) solidDarkToggle.checked = solidDark;
      offsets = loadedOffsets;
      dragEdit = loadedDrag;
      if (dragEditToggle) dragEditToggle.checked = dragEdit;
      prefsState = prefs;
      taxRecvState = normalizeTaxRecvHide(loadedTaxRecv);
      suffixHideState = normalizeSuffixHide(loadedSuffixHide);
      applyStaticI18n();
      renderTheme(theme);
      renderPrefs(prefs);
      renderTaxRecvUI(taxRecvState);
      renderSuffixHideUI(suffixHideState);
      renderLicenseUI(loadedLicense);
      bindCollapseHeads();
      setSectionExpanded("theme", false);
      setSectionExpanded("taxRecv", false);
      setSectionExpanded("suffixHide", false);
      setSectionExpanded("pref", false);
      setSectionExpanded("pos", false);
      fillOffsetUI(offsets);
      updateStatus();
    }
  );
})();
