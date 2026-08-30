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
  const VAULT_HIDE_KEY = "flapFeeInfo.vaultHide.v1";
  const SEARCH_HIDE_KEY = "flapFeeInfo.searchHide.v1";
  const DEV_COUNT_MARK_KEY = "flapFeeInfo.devCountMark.v1";
  const TW_HANDLE_MARK_KEY = "flapFeeInfo.twHandleMark.v1";
  const SYMBOL_DUP_MARK_KEY = "flapFeeInfo.symbolDupMark.v1";
  const LICENSE_KEY = "flapFeeInfo.license.v1";
  const DEVICE_ID_KEY = "flapFeeInfo.deviceId.v1";
  const LICENSE_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";
  const LICENSE_PURCHASE_URL = "https://t.me/TechMelon_Pay_bot?start=flap";
  const DEFAULT_THEME = "dark";
  const DEFAULT_TAX_RECV_HIDE = { enabled: false, thresholdPct: 100, allow: [] };
  const TAX_RECV_ALLOW_MAX = 24;
  const DEFAULT_SUFFIX_HIDE = { enabled: false, rules: [] };
  const DEFAULT_VAULT_HIDE = {
    enabled: false,
    hideTaxVault: false,
    hideStockVault: false
  };
  const DEFAULT_SEARCH_HIDE = { enabled: false };
  const DEFAULT_DEV_COUNT_MARK = { enabled: false, rules: [] };
  const DEFAULT_TW_HANDLE_MARK = { enabled: false, rules: [] };
  const DEFAULT_SYMBOL_DUP_MARK = {
    enabled: false,
    waitDup: true,
    windowMin: 5,
    color: "#facc15"
  };
  const DEV_COUNT_MARK_MAX = 12;
  const TW_HANDLE_MARK_MAX = 24;
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
      catFilterDesc: "首页与 K 线左侧「新创建」",
      catMark: "卡片标记",
      catMarkDesc: "发币次数 · 推特备注 · 重复代号",
      devCountSection: "Dev 发币次数",
      devCountHint:
        "仅 GMGN / Debot 战壕卡。GMGN 用 creator_created_count；Debot 用 ranks 的 dev_token_stats.created_count。左侧光条 + 「×次数」。比较符可选 < ≤ = ≥ >（默认 <）。多条命中时精确相等优先。",
      devCountEnableTitle: "启用发币次数标记",
      devCountEnableDesc: "左侧光条颜色自定义；次数显示在头像旁",
      devCountMinPh: "次数",
      devCountHint2: "例：<10 绿色、=1 蓝色、>100 红色。最多 12 条。",
      devCountEmpty: "暂无规则，填写次数并选色后添加",
      twHandleSection: "推特备注（右侧色条）",
      twHandleHint:
        "仅 GMGN / Debot 战壕卡。扫一眼：左侧色条+×次数 = 发币次数；右侧色条 + 推特旁备注 = 关注的号。Debot 备注挂在指标行第 2 个小图标后面。",
      twHandleEnableTitle: "启用推特标记",
      twHandleEnableDesc: "右侧色条颜色 + 链接旁备注名",
      twHandlePh: "@handle",
      twHandleNotePh: "备注·何一",
      twHandleHint2: "handle 不区分大小写，可带 @。最多 24 条。",
      twHandleEmpty: "暂无规则，填写 handle 与备注后添加",
      twHandleInvalid: "请填写有效 handle",
      twHandleDup: "已添加过",
      symbolDupSection: "新创建重复代号",
      symbolDupHint:
        "仅「新创建」列。按发布时间：先发的 symbol 上色（参考价值更高）。默认要等到出现第 2 个相同 symbol 才给最早那个上色，并在后发的代号左上角加红泡。",
      symbolDupEnableTitle: "启用重复代号标记",
      symbolDupEnableDesc: "只作用于 GMGN / Debot 新创建列",
      symbolDupWaitTitle: "等出现相同代号再标记",
      symbolDupWaitDesc: "默认开。关掉则第一次出现立刻上色，不再画红泡",
      symbolDupWindowLabel: "计数窗口（分钟）",
      symbolDupColorLabel: "首次颜色",
      searchHideTitle: "搜索框结果也屏蔽",
      searchHideDesc: "默认关。开启后，已启用的资金接收/金库规则同样作用于搜索弹层",
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
      pref_hoverTip_title: "悬停显示详细信息",
      pref_hoverTip_desc: "默认关闭；勾选后鼠标停在徽章上弹出浮窗",
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
        "BSC 首页战壕与 K 线左侧「新创建」列生效，不含 K 线顶栏。搜索弹层需另开上方「搜索框结果也屏蔽」。不额外请求；默认关闭。改开关后 GMGN / Debot 会刷新页面。金库类型见下方「金库屏蔽」。",
      taxRecvEnableTitle: "启用屏蔽",
      taxRecvEnableDesc: "过滤首页与 K 线左侧「新创建」（改开关会刷新页面）",
      taxRecvThresholdLabel: "阈值 ≥",
      taxRecvThresholdLabelGt: "阈值 >",
      taxRecvHint2:
        "首页/K 线左侧「新创建」：7777/8888/ffff 且 👨‍🍳 达阈值则屏蔽（含 hybrid）。0% = 严格大于 0%（有 dev 分配就挡，不挡 0%）。纯 💎 持有人分红不挡。",
      taxRecvAllowLabel: "接收地址白名单",
      taxRecvAllowPh: "0x… 接收地址",
      taxRecvAllowHint:
        "资金打到这些地址的代币不屏蔽（GMGN：market_address / creator；Debot：fee_receiver）。最多 24 条。",
      taxRecvAllowEmpty: "还没有白名单地址。",
      taxRecvAllowInvalid: "请粘贴完整 0x 地址（40 位 hex）",
      taxRecvAllowDup: "已添加过",
      vaultHideSection: "金库屏蔽",
      vaultHideHint:
        "BSC 首页战壕与 K 线左侧「新创建」列。按类型屏蔽，不看分红比例：96%🎁+4%💎 仍是税收金库。Four ffff 税收钱包不算金库。默认关闭。搜索弹层需另开「搜索框结果也屏蔽」。改开关后 GMGN 会刷新页面。",
      vaultHideEnableTitle: "启用金库屏蔽",
      vaultHideEnableDesc: "按下方选项过滤首页与 K 线左侧「新创建」（改开关会刷新页面）",
      vaultHideTaxTitle: "屏蔽税收金库",
      vaultHideTaxDesc: "🎁 税收金库（含 96%金库+4%分红；单枚 QQQB/NVDA 分红币也算）",
      vaultHideStockTitle: "屏蔽币股金库",
      vaultHideStockDesc: "📈 Flap Stocks / Flap 币股（FXIO 等篮子）。默认不屏蔽",
      vaultHideHint2:
        "打开总开关且未勾子项时，默认屏蔽税收金库。只勾税收 → 保留 📈 币股篮子。可与资金接收叠加。",
      suffixHideSection: "自定义尾号屏蔽",
      suffixHideHint:
        "仅 BSC。隐藏指定十六进制尾号的 CA（可多条）。首页战壕与 K 线左侧「新创建」数据层过滤。默认关闭。改开关后 GMGN 会刷新页面。",
      suffixHideEnableTitle: "启用尾号屏蔽",
      suffixHideEnableDesc: "开启后按下方规则过滤列表",
      suffixAddPlaceholder: "如 0000 / dead",
      suffixAddBtn: "添加",
      suffixHideHint2: "例：添加 dead → 屏蔽所有以 dead 结尾的 0x 地址。最多 24 条；仅 hex 字符。",
      suffixRuleDel: "删除",
      suffixEmpty: "暂无规则，在下方输入尾号后添加",
      licenseGetKeyBtn: "去 TG Bot 获取密钥",
      licenseSection: "访问许可证",
      licenseHeroTitle: "访问许可证",
      licenseHeroSub: "即将收费，请先填密钥",
      licensePillFree: "未配置",
      licensePillActive: "已配置",
      licenseHint:
        "服务端已开启付费鉴权：未填密钥将无法显示徽章。在 TG Bot 购买 Flap 套餐（0.01 BNB/月）后粘贴密钥；一钥绑定本 Chrome 配置，换机可点「换绑到此设备」。",
      licenseKeyLabel: "访问密钥",
      licenseKeyPlaceholder: "粘贴 TG Bot 发来的密钥",
      licenseSaveBtn: "验证并保存",
      licenseClearBtn: "清除",
      licenseRebindBtn: "换绑到此设备",
      licenseSaved: "验证通过，已保存",
      licenseCleared: "已清除",
      licenseEmpty: "未填写密钥",
      licenseInvalid: "密钥格式无效",
      licenseVerifying: "正在验证…",
      licenseVerifyFail: "验证失败，请检查密钥或网络",
      licenseExpired: "密钥已过期",
      licenseNoPerm: "密钥无 Flap 权限",
      licenseDeviceMismatch: "此密钥已绑定其它设备，可点「换绑到此设备」",
      licenseRebinding: "正在换绑…",
      licenseRebound: "已换绑到本设备",
      licenseRebindFail: "换绑失败，请稍后重试",
      licensePillVerified: "已验证",
      licenseHeroSubVerified: "密钥有效 · 点击展开可换绑或清除",
      licenseHeroSubFree: "即将收费，请先填密钥",
      licenseHeroSubActive: "已保存密钥 · 点击展开管理",
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
      catFilterDesc: "Home & K-line left New creation",
      catMark: "Card marks",
      catMarkDesc: "Dev count · Twitter notes · Repeat ticker",
      devCountSection: "Dev launch count",
      devCountHint:
        "GMGN and Debot trench cards. GMGN uses creator_created_count; Debot uses ranks dev_token_stats.created_count. Left bar + ×count. Choose < ≤ = ≥ > (default <). Exact match wins, then the tighter threshold.",
      devCountEnableTitle: "Mark by launch count",
      devCountEnableDesc: "Custom bar color; count chip beside the avatar",
      devCountMinPh: "count",
      devCountHint2: "e.g. <10 green, =1 blue, >100 red. Max 12 rules.",
      devCountEmpty: "No rules yet. Enter a count and pick a color.",
      twHandleSection: "Twitter note (right bar)",
      twHandleHint:
        "GMGN and Debot trench cards. Left bar + ×count = launch count; right bar + note = watched handle. On Debot the note sits after the second small icon in the stats row.",
      twHandleEnableTitle: "Mark Twitter handles",
      twHandleEnableDesc: "Right-bar color + note beside the link",
      twHandlePh: "@handle",
      twHandleNotePh: "note",
      twHandleHint2: "Case-insensitive; @ optional. Max 24.",
      twHandleEmpty: "No rules yet. Add a handle and a note.",
      twHandleInvalid: "Enter a valid handle",
      twHandleDup: "Already added",
      symbolDupSection: "Repeat ticker on new creations",
      symbolDupHint:
        "New-creation column only. The earliest published ticker is highlighted (more useful as a reference). By default it waits for a 2nd same symbol, then colors the earliest and puts a red bubble on the later copies' top-left.",
      symbolDupEnableTitle: "Mark repeat tickers",
      symbolDupEnableDesc: "GMGN / Debot new-creation column only",
      symbolDupWaitTitle: "Wait for a duplicate before marking",
      symbolDupWaitDesc: "On by default. Off: color the first hit immediately, no red bubbles",
      symbolDupWindowLabel: "Window (minutes)",
      symbolDupColorLabel: "First-hit color",
      searchHideTitle: "Also hide in search",
      searchHideDesc: "Off by default. When on, enabled fund-recipient/vault rules also apply to the search overlay",
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
      pref_hoverTip_title: "Hover details",
      pref_hoverTip_desc: "Off by default; show a popup when hovering a badge",
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
        "BSC home trench and K-line left New creation column. Not the K-line header. Search overlay needs “Also hide in search” above. No extra requests; off by default. GMGN / Debot reload when this changes. See Vault hide below.",
      taxRecvEnableTitle: "Enable hide",
      taxRecvEnableDesc: "Filter home & K-line left New creation (page reloads)",
      taxRecvThresholdLabel: "Threshold ≥",
      taxRecvThresholdLabelGt: "Threshold >",
      taxRecvHint2:
        "Home/K-line left New creation: hide 7777/8888/ffff when marketing hits threshold (incl. hybrid). 0% = strictly > 0%. Pure 💎 holder dividend kept.",
      taxRecvAllowLabel: "Recipient allowlist",
      taxRecvAllowPh: "0x… recipient",
      taxRecvAllowHint:
        "Tokens paying these wallets are not hidden (GMGN: market_address / creator; Debot: fee_receiver). Max 24.",
      taxRecvAllowEmpty: "No allowlist addresses yet.",
      taxRecvAllowInvalid: "Paste a full 0x address (40 hex chars)",
      taxRecvAllowDup: "Already added",
      vaultHideSection: "Vault hide",
      vaultHideHint:
        "BSC home trench and K-line left New creation. Hide by type, not share: 96%🎁+4%💎 is still a tax vault. Four ffff tax wallet is not a vault. Off by default. Search overlay needs “Also hide in search”. GMGN reloads when this changes.",
      vaultHideEnableTitle: "Enable vault hide",
      vaultHideEnableDesc: "Filter home & K-line left New creation (page reloads)",
      vaultHideTaxTitle: "Hide tax vaults",
      vaultHideTaxDesc: "🎁 tax vaults (including 96% vault + 4% holder; single QQQB/NVDA payout)",
      vaultHideStockTitle: "Hide equity vaults",
      vaultHideStockDesc: "📈 Flap Stocks / Flap 币股 baskets (FXIO). Off by default",
      vaultHideHint2:
        "Master on with no subtype checked defaults to hiding tax vaults. Tax-only keeps 📈 baskets. Stacks with fund-recipient hide.",
      suffixHideSection: "Custom CA suffix hide",
      suffixHideHint:
        "BSC only. Hide CAs ending with a hex suffix (multi-rule). Filters home trench and K-line left New creation. Off by default. GMGN reloads when this changes.",
      suffixHideEnableTitle: "Enable suffix hide",
      suffixHideEnableDesc: "Filter list by rules below",
      suffixAddPlaceholder: "e.g. 0000 / dead",
      suffixAddBtn: "Add",
      suffixHideHint2:
        "E.g. add dead → hide all 0x addresses ending in dead. Max 24 rules; hex only.",
      suffixRuleDel: "Del",
      suffixEmpty: "No rules yet — type a suffix below and add",
      licenseGetKeyBtn: "Get key from TG Bot",
      licenseSection: "License",
      licenseHeroTitle: "Access license",
      licenseHeroSub: "Paid mode — paste your TG bot key",
      licensePillFree: "Not set",
      licensePillActive: "Configured",
      licenseHint:
        "License is required to load badges. Buy the Flap plan in TG Bot (0.01 BNB/mo), paste the key here; one key per Chrome profile. Use Rebind on a new device.",
      licenseKeyLabel: "Access key",
      licenseKeyPlaceholder: "Paste key from TG Bot",
      licenseSaveBtn: "Verify & save",
      licenseClearBtn: "Clear",
      licenseRebindBtn: "Rebind to this device",
      licenseSaved: "Verified and saved",
      licenseCleared: "Cleared",
      licenseEmpty: "No key saved",
      licenseInvalid: "Invalid key format",
      licenseVerifying: "Verifying…",
      licenseVerifyFail: "Verification failed — check key or network",
      licenseExpired: "Key expired",
      licenseNoPerm: "Key has no Flap permission",
      licenseDeviceMismatch: "Key bound to another device — use Rebind",
      licenseRebinding: "Rebinding…",
      licenseRebound: "Rebound to this device",
      licenseRebindFail: "Rebind failed — try again later",
      licensePillVerified: "Verified",
      licenseHeroSubVerified: "Key valid · expand to rebind or clear",
      licenseHeroSubFree: "Paid mode — paste your TG bot key",
      licenseHeroSubActive: "Key saved · expand to manage",
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
    "hoverTip",
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
    hoverTip: "💬",
    burn: "🔥",
    lp: "💧",
    payoutArrow: "→",
    unknown: "❓️"
  };

  const DEFAULT_PREFS = Object.fromEntries(
    PREF_KEYS.map((k) => [k, k === "hoverTip" ? false : true])
  );

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
  const taxRecvAllowWrap = document.getElementById("taxRecvAllowWrap");
  const taxRecvAllowList = document.getElementById("taxRecvAllowList");
  const taxRecvAllowInput = document.getElementById("taxRecvAllowInput");
  const taxRecvAllowAdd = document.getElementById("taxRecvAllowAdd");
  const suffixHideEnabled = document.getElementById("suffixHideEnabled");
  const suffixRulesWrap = document.getElementById("suffixRulesWrap");
  const suffixRulesList = document.getElementById("suffixRulesList");
  const suffixAddInput = document.getElementById("suffixAddInput");
  const suffixAddBtn = document.getElementById("suffixAddBtn");
  const searchHideEnabled = document.getElementById("searchHideEnabled");
  const vaultHideEnabled = document.getElementById("vaultHideEnabled");
  const vaultHideTax = document.getElementById("vaultHideTax");
  const vaultHideStock = document.getElementById("vaultHideStock");
  const vaultHideOptions = document.getElementById("vaultHideOptions");
  const devCountEnabled = document.getElementById("devCountEnabled");
  const devCountRulesWrap = document.getElementById("devCountRulesWrap");
  const devCountRulesList = document.getElementById("devCountRulesList");
  const devCountMinInput = document.getElementById("devCountMinInput");
  const devCountOpSelect = document.getElementById("devCountOp");
  const devCountColorInput = document.getElementById("devCountColorInput");
  const devCountAddBtn = document.getElementById("devCountAddBtn");
  const twHandleEnabled = document.getElementById("twHandleEnabled");
  const twHandleRulesWrap = document.getElementById("twHandleRulesWrap");
  const twHandleRulesList = document.getElementById("twHandleRulesList");
  const twHandleInput = document.getElementById("twHandleInput");
  const twHandleNoteInput = document.getElementById("twHandleNoteInput");
  const twHandleColorInput = document.getElementById("twHandleColorInput");
  const twHandleAddBtn = document.getElementById("twHandleAddBtn");
  const symbolDupEnabled = document.getElementById("symbolDupEnabled");
  const symbolDupRulesWrap = document.getElementById("symbolDupRulesWrap");
  const symbolDupWait = document.getElementById("symbolDupWait");
  const symbolDupWindow = document.getElementById("symbolDupWindow");
  const symbolDupColor = document.getElementById("symbolDupColor");

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
  let vaultHideState = { ...DEFAULT_VAULT_HIDE };
  let vaultHideSaveTimer = null;
  let searchHideState = { ...DEFAULT_SEARCH_HIDE };
  let searchHideSaveTimer = null;
  let devCountMarkState = { ...DEFAULT_DEV_COUNT_MARK };
  let devCountSaveTimer = null;
  let twHandleMarkState = { ...DEFAULT_TW_HANDLE_MARK };
  let twHandleSaveTimer = null;
  let symbolDupMarkState = { ...DEFAULT_SYMBOL_DUP_MARK };
  let symbolDupSaveTimer = null;

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

  function normalizeEvmAllowAddress(raw) {
    const s = String(raw || "").trim().toLowerCase();
    const m = s.match(/0x[a-f0-9]{40}/);
    if (m) return m[0];
    const hex = s.replace(/^0x/, "").replace(/[^a-f0-9]/g, "");
    if (hex.length === 40) return `0x${hex}`;
    return "";
  }

  function shortAllowAddress(addr) {
    const a = String(addr || "");
    if (a.length < 12) return a;
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  }

  function normalizeTaxRecvHide(raw) {
    const out = { enabled: false, thresholdPct: 100, allow: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const thr = Number(raw.thresholdPct);
    if (Number.isFinite(thr)) {
      out.thresholdPct = Math.max(0, Math.min(100, Math.round(thr)));
    }
    const list = Array.isArray(raw.allow) ? raw.allow : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.allow.length < TAX_RECV_ALLOW_MAX; i += 1) {
      const row = list[i];
      const address = normalizeEvmAllowAddress(row && (row.address || row.addr || row));
      if (!address || seen.has(address)) continue;
      seen.add(address);
      out.allow.push({
        id: row && row.id ? String(row.id) : `a${out.allow.length}`,
        address,
        enabled: !row || row.enabled !== false
      });
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

  function normalizeVaultHide(raw) {
    const out = { ...DEFAULT_VAULT_HIDE };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    out.hideTaxVault = raw.hideTaxVault === true;
    out.hideStockVault = raw.hideStockVault === true;
    return out;
  }

  function normalizeSearchHide(raw) {
    return { enabled: raw && raw.enabled === true };
  }

  function normalizeHexColor(raw, fallback) {
    const s = String(raw || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
    }
    return fallback;
  }

  function normalizeDevCountOp(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === "lt" || s === "<") return "lt";
    if (s === "lte" || s === "<=" || s === "≤") return "lte";
    if (s === "eq" || s === "=" || s === "==" || s === "===") return "eq";
    if (s === "gt" || s === ">") return "gt";
    if (s === "gte" || s === ">=" || s === "≥") return "gte";
    return "";
  }

  function devCountOpLabel(op) {
    if (op === "lt") return "<";
    if (op === "lte") return "≤";
    if (op === "eq") return "=";
    if (op === "gt") return ">";
    return "≥";
  }

  function normalizeDevCountMark(raw) {
    const out = { enabled: false, rules: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const list = Array.isArray(raw.rules) ? raw.rules : [];
    for (let i = 0; i < list.length && out.rules.length < DEV_COUNT_MARK_MAX; i += 1) {
      const r = list[i] || {};
      const min = Math.max(0, Math.min(999999, Math.floor(Number(r.min))));
      if (!Number.isFinite(min)) continue;
      const op = normalizeDevCountOp(r.op) || (r.op == null ? "gte" : "lt");
      out.rules.push({
        id: String(r.id || `d${Date.now().toString(36)}_${i}`),
        op,
        min,
        color: normalizeHexColor(r.color, "#f59e0b"),
        enabled: r.enabled !== false
      });
    }
    return out;
  }

  function normalizeTwHandle(raw) {
    return String(raw || "")
      .trim()
      .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0]
      .replace(/\u2026|\.{2,}$/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 32);
  }

  function normalizeTwHandleMark(raw) {
    const out = { enabled: false, rules: [] };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    const list = Array.isArray(raw.rules) ? raw.rules : [];
    const seen = new Set();
    for (let i = 0; i < list.length && out.rules.length < TW_HANDLE_MARK_MAX; i += 1) {
      const r = list[i] || {};
      const handle = normalizeTwHandle(r.handle);
      if (!handle || handle.length < 2 || seen.has(handle)) continue;
      seen.add(handle);
      const note = String(r.note || "").trim().slice(0, 16);
      out.rules.push({
        id: String(r.id || `t${Date.now().toString(36)}_${i}`),
        handle,
        note,
        color: normalizeHexColor(r.color, "#fbbf24"),
        enabled: r.enabled !== false
      });
    }
    return out;
  }

  function normalizeSymbolDupMark(raw) {
    const out = { ...DEFAULT_SYMBOL_DUP_MARK };
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.enabled === true;
    out.waitDup = raw.waitDup !== false;
    const win = Math.floor(Number(raw.windowMin));
    out.windowMin = Number.isFinite(win) ? Math.max(1, Math.min(60, win)) : 5;
    out.color = normalizeHexColor(raw.color, DEFAULT_SYMBOL_DUP_MARK.color);
    return out;
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
  let licenseVerified = false;
  let licenseDeviceMismatch = false;
  let licenseCollapsed = false;
  let licenseBusy = false;
  const licenseHero = document.getElementById("licenseHero");
  const licenseToggle = document.getElementById("licenseToggle");
  const licenseChevron = document.getElementById("licenseChevron");
  const licenseBody = document.getElementById("licenseBody");
  const licenseHeroSub = document.getElementById("licenseHeroSub");
  const licenseKeyInput = document.getElementById("licenseKeyInput");
  const licenseSaveBtn = document.getElementById("licenseSaveBtn");
  const licenseClearBtn = document.getElementById("licenseClearBtn");
  const licenseRebindBtn = document.getElementById("licenseRebindBtn");
  const licenseStatus = document.getElementById("licenseStatus");
  const licensePill = document.getElementById("licensePill");
  const licenseGetKeyBtn = document.getElementById("licenseGetKeyBtn");

  function normalizeDeviceId(raw) {
    const id = String(raw?.id || raw || "")
      .trim()
      .toLowerCase();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
    ) {
      return id;
    }
    return "";
  }

  function ensureDeviceId() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([DEVICE_ID_KEY], (items) => {
          if (chrome.runtime.lastError) {
            resolve("");
            return;
          }
          let id = normalizeDeviceId(items?.[DEVICE_ID_KEY]);
          if (!id && typeof crypto !== "undefined" && crypto.randomUUID) {
            id = crypto.randomUUID().toLowerCase();
            chrome.storage.local.set({ [DEVICE_ID_KEY]: { id } });
          }
          resolve(id || "");
        });
      } catch {
        resolve("");
      }
    });
  }

  function licenseHeaders(key, deviceId) {
    const headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (deviceId) headers["X-Flap-Device-Id"] = deviceId;
    return headers;
  }

  function mapLicenseError(code) {
    if (code === "license_expired") return t("licenseExpired");
    if (code === "license_no_flap_perm") return t("licenseNoPerm");
    if (code === "license_device_mismatch") return t("licenseDeviceMismatch");
    return t("licenseVerifyFail");
  }

  async function callLicenseApi(path, key, deviceId) {
    const res = await fetch(`${LICENSE_API_BASE}${path}`, {
      method: "POST",
      headers: licenseHeaders(key, deviceId),
      body: "{}",
      cache: "no-store"
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  async function verifyLicenseKey(key, deviceId) {
    const { res, data } = await callLicenseApi("/license/verify", key, deviceId);
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || "license_verify_failed",
        deviceMismatch: data?.error === "license_device_mismatch"
      };
    }
    if (key && data.device_bound && data.device_match === false) {
      return { ok: false, error: "license_device_mismatch", deviceMismatch: true };
    }
    return { ok: true, data };
  }

  async function rebindLicenseKey(key, deviceId) {
    const { res, data } = await callLicenseApi("/license/rebind", key, deviceId);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || "license_rebind_failed" };
    }
    return { ok: true, data };
  }

  function setLicenseStatus(msg) {
    if (licenseStatus) licenseStatus.textContent = msg || "";
  }

  function setLicenseCollapsed(on) {
    licenseCollapsed = on === true;
    if (licenseHero) licenseHero.classList.toggle("is-collapsed", licenseCollapsed);
    if (licenseToggle) licenseToggle.setAttribute("aria-expanded", licenseCollapsed ? "false" : "true");
    if (licenseChevron) licenseChevron.textContent = licenseCollapsed ? "▸" : "▾";
  }

  function toggleLicenseCollapsed() {
    setLicenseCollapsed(!licenseCollapsed);
  }

  function currentLicenseKey() {
    return String(licenseKeyInput?.value || licenseState.key || "").trim();
  }

  function updateLicenseRebindVisibility() {
    if (!licenseRebindBtn) return;
    const typed = currentLicenseKey();
    const show = Boolean(typed) && licenseDeviceMismatch === true;
    licenseRebindBtn.hidden = !show;
    const wrap = document.getElementById("licenseExtraActions");
    if (wrap) wrap.hidden = !show;
  }

  function updateLicenseHeroSub() {
    if (!licenseHeroSub) return;
    if (!licenseState.key) {
      licenseHeroSub.textContent = t("licenseHeroSubFree");
      return;
    }
    if (licenseVerified) {
      licenseHeroSub.textContent = t("licenseHeroSubVerified");
      return;
    }
    licenseHeroSub.textContent = t("licenseHeroSubActive");
  }

  function updateLicensePill() {
    if (!licensePill) return;
    if (!licenseState.key) {
      licensePill.dataset.state = "free";
      licensePill.textContent = t("licensePillFree");
      return;
    }
    if (licenseVerified) {
      licensePill.dataset.state = "verified";
      licensePill.textContent = t("licensePillVerified");
      return;
    }
    licensePill.dataset.state = "active";
    licensePill.textContent = t("licensePillActive");
  }

  function openLicensePurchasePage() {
    const url = LICENSE_PURCHASE_URL;
    try {
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url, active: true });
        return;
      }
    } catch (_tabs) {
      // ignore
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function setLicenseBusy(on) {
    licenseBusy = on === true;
    if (licenseSaveBtn) licenseSaveBtn.disabled = licenseBusy;
    if (licenseClearBtn) licenseClearBtn.disabled = licenseBusy;
    if (licenseRebindBtn) licenseRebindBtn.disabled = licenseBusy;
  }

  function renderLicenseUI(state, opts = {}) {
    licenseState = normalizeLicense(state) || { ...DEFAULT_LICENSE };
    if (licenseKeyInput && document.activeElement !== licenseKeyInput) {
      licenseKeyInput.value = licenseState.key || "";
    }
    if (opts.verified === true) licenseVerified = true;
    if (opts.verified === false) licenseVerified = false;
    if (opts.deviceMismatch === true) licenseDeviceMismatch = true;
    if (opts.deviceMismatch === false) licenseDeviceMismatch = false;
    updateLicensePill();
    updateLicenseHeroSub();
    updateLicenseRebindVisibility();
    if (!licenseState.key) {
      setLicenseStatus(t("licenseEmpty"));
      setLicenseCollapsed(false);
    }
  }

  async function applyLicenseVerificationResult(key, result, { collapseOnSuccess = true } = {}) {
    if (!result.ok) {
      licenseVerified = false;
      licenseDeviceMismatch = result.deviceMismatch === true;
      // 新设备验证冲突：先把密钥留在本机，才能显示并点击「换绑到此设备」
      if (licenseDeviceMismatch && key) {
        const saved = await saveLicense({ key });
        if (saved) licenseState = saved;
      }
      updateLicensePill();
      updateLicenseHeroSub();
      updateLicenseRebindVisibility();
      setLicenseStatus(mapLicenseError(result.error));
      setLicenseCollapsed(false);
      return false;
    }

    licenseVerified = Boolean(key);
    licenseDeviceMismatch = false;
    const saved = await saveLicense(key ? { key } : { key: "" });
    if (!saved && key) {
      setLicenseStatus(t("licenseVerifyFail"));
      return false;
    }
    if (saved) licenseState = saved;
    updateLicensePill();
    updateLicenseHeroSub();
    updateLicenseRebindVisibility();
    if (key) {
      setLicenseStatus(t("licenseSaved"));
      if (collapseOnSuccess) setLicenseCollapsed(true);
    } else {
      setLicenseStatus(t("licenseEmpty"));
      setLicenseCollapsed(false);
    }
    return true;
  }

  async function onLicenseSave() {
    if (licenseBusy) return;
    const raw = licenseKeyInput?.value || "";
    const next = normalizeLicense({ key: raw });
    if (!next) {
      setLicenseStatus(t("licenseInvalid"));
      setLicenseCollapsed(false);
      return;
    }

    if (!next.key) {
      await applyLicenseVerificationResult("", { ok: true, data: { free: true } });
      return;
    }

    setLicenseBusy(true);
    setLicenseStatus(t("licenseVerifying"));
    try {
      const deviceId = await ensureDeviceId();
      const result = await verifyLicenseKey(next.key, deviceId);
      await applyLicenseVerificationResult(next.key, result, { collapseOnSuccess: true });
    } catch {
      setLicenseStatus(t("licenseVerifyFail"));
      setLicenseCollapsed(false);
    } finally {
      setLicenseBusy(false);
    }
  }

  async function onLicenseRebind() {
    if (licenseBusy) return;
    const key = String(licenseKeyInput?.value || licenseState.key || "").trim();
    const next = normalizeLicense({ key });
    if (!next?.key) {
      setLicenseStatus(t("licenseInvalid"));
      return;
    }

    setLicenseBusy(true);
    setLicenseStatus(t("licenseRebinding"));
    try {
      const deviceId = await ensureDeviceId();
      if (!deviceId) {
        setLicenseStatus(t("licenseRebindFail"));
        return;
      }
      const rebound = await rebindLicenseKey(next.key, deviceId);
      if (!rebound.ok) {
        setLicenseStatus(mapLicenseError(rebound.error) || t("licenseRebindFail"));
        return;
      }
      const verify = await verifyLicenseKey(next.key, deviceId);
      if (!verify.ok) {
        setLicenseStatus(t("licenseRebindFail"));
        return;
      }
      licenseDeviceMismatch = false;
      await applyLicenseVerificationResult(next.key, verify, { collapseOnSuccess: true });
      setLicenseStatus(t("licenseRebound"));
    } catch {
      setLicenseStatus(t("licenseRebindFail"));
    } finally {
      setLicenseBusy(false);
    }
  }

  async function onLicenseClear() {
    if (licenseBusy) return;
    if (licenseKeyInput) licenseKeyInput.value = "";
    await saveLicense({ key: "" });
    licenseState = { ...DEFAULT_LICENSE };
    licenseVerified = false;
    licenseDeviceMismatch = false;
    updateLicensePill();
    updateLicenseHeroSub();
    updateLicenseRebindVisibility();
    setLicenseStatus(t("licenseCleared"));
    setLicenseCollapsed(false);
  }

  async function refreshStoredLicense() {
    if (!licenseState.key) {
      renderLicenseUI(licenseState);
      return;
    }
    setLicenseBusy(true);
    try {
      const deviceId = await ensureDeviceId();
      const result = await verifyLicenseKey(licenseState.key, deviceId);
      if (result.ok) {
        licenseVerified = true;
        licenseDeviceMismatch = false;
        updateLicensePill();
        updateLicenseHeroSub();
        updateLicenseRebindVisibility();
        setLicenseCollapsed(true);
      } else {
        licenseVerified = false;
        licenseDeviceMismatch = result.deviceMismatch === true;
        updateLicensePill();
        updateLicenseHeroSub();
        updateLicenseRebindVisibility();
        setLicenseStatus(mapLicenseError(result.error));
        setLicenseCollapsed(false);
      }
    } catch {
      licenseVerified = false;
      updateLicensePill();
      updateLicenseHeroSub();
      setLicenseCollapsed(false);
    } finally {
      setLicenseBusy(false);
    }
  }

  if (licenseToggle) licenseToggle.addEventListener("click", () => toggleLicenseCollapsed());
  if (licenseGetKeyBtn) {
    licenseGetKeyBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openLicensePurchasePage();
    });
  }
  if (licenseSaveBtn) licenseSaveBtn.addEventListener("click", () => void onLicenseSave());
  if (licenseClearBtn) licenseClearBtn.addEventListener("click", () => void onLicenseClear());
  if (licenseRebindBtn) licenseRebindBtn.addEventListener("click", () => void onLicenseRebind());
  if (licenseKeyInput) {
    licenseKeyInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void onLicenseSave();
      }
    });
    licenseKeyInput.addEventListener("input", () => {
      const typed = String(licenseKeyInput.value || "").trim();
      if (typed !== String(licenseState.key || "").trim()) {
        licenseDeviceMismatch = false;
      }
      updateLicenseRebindVisibility();
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
            VAULT_HIDE_KEY,
            SEARCH_HIDE_KEY,
            LICENSE_KEY,
            DEV_COUNT_MARK_KEY,
            TW_HANDLE_MARK_KEY,
            SYMBOL_DUP_MARK_KEY,
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
                vaultHide: { ...DEFAULT_VAULT_HIDE },
                searchHide: { ...DEFAULT_SEARCH_HIDE },
                license: { ...DEFAULT_LICENSE },
                devCountMark: { ...DEFAULT_DEV_COUNT_MARK },
                twHandleMark: { ...DEFAULT_TW_HANDLE_MARK },
                symbolDupMark: { ...DEFAULT_SYMBOL_DUP_MARK },
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
              vaultHide: normalizeVaultHide(items?.[VAULT_HIDE_KEY]),
              searchHide: normalizeSearchHide(items?.[SEARCH_HIDE_KEY]),
              license: normalizeLicense(items?.[LICENSE_KEY]) || { ...DEFAULT_LICENSE },
              devCountMark: normalizeDevCountMark(items?.[DEV_COUNT_MARK_KEY]),
              twHandleMark: normalizeTwHandleMark(items?.[TW_HANDLE_MARK_KEY]),
              symbolDupMark: normalizeSymbolDupMark(items?.[SYMBOL_DUP_MARK_KEY]),
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
          vaultHide: { ...DEFAULT_VAULT_HIDE },
          searchHide: { ...DEFAULT_SEARCH_HIDE },
          license: { ...DEFAULT_LICENSE },
          devCountMark: { ...DEFAULT_DEV_COUNT_MARK },
          twHandleMark: { ...DEFAULT_TW_HANDLE_MARK },
          symbolDupMark: { ...DEFAULT_SYMBOL_DUP_MARK },
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
    if (!taxRecvAllowList) return;
    taxRecvAllowList.innerHTML = "";
    const allow = taxRecvState.allow || [];
    if (!allow.length) {
      const empty = document.createElement("div");
      empty.className = "suffix-empty";
      empty.textContent = t("taxRecvAllowEmpty");
      taxRecvAllowList.appendChild(empty);
      return;
    }
    for (const rule of allow) {
      const row = document.createElement("div");
      row.className = "suffix-rule-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = rule.enabled !== false;
      cb.title = rule.address;
      cb.addEventListener("change", () => {
        const r = taxRecvState.allow.find((x) => x.id === rule.id);
        if (!r) return;
        r.enabled = cb.checked === true;
        scheduleSaveTaxRecv();
      });
      const text = document.createElement("span");
      text.className = "suffix-rule-text" + (rule.enabled === false ? " is-off" : "");
      text.textContent = shortAllowAddress(rule.address);
      text.title = rule.address;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "suffix-rule-del";
      del.textContent = t("suffixRuleDel");
      del.addEventListener("click", () => {
        taxRecvState.allow = taxRecvState.allow.filter((x) => x.id !== rule.id);
        scheduleSaveTaxRecv();
      });
      row.append(cb, text, del);
      taxRecvAllowList.appendChild(row);
    }
  }

  function readTaxRecvFromUI() {
    const thrRaw = Number(taxRecvThreshold?.value ?? taxRecvThresholdRange?.value ?? 100);
    return normalizeTaxRecvHide({
      enabled: taxRecvEnabled?.checked === true,
      thresholdPct: thrRaw,
      allow: taxRecvState.allow
    });
  }

  function tryAddTaxRecvAllow() {
    if (!taxRecvAllowInput) return;
    const address = normalizeEvmAllowAddress(taxRecvAllowInput.value);
    if (!address) {
      taxRecvAllowInput.placeholder = t("taxRecvAllowInvalid");
      taxRecvAllowInput.value = "";
      return;
    }
    const exists = (taxRecvState.allow || []).some((r) => r.address === address);
    if (exists) {
      taxRecvAllowInput.placeholder = t("taxRecvAllowDup");
      taxRecvAllowInput.value = "";
      return;
    }
    if ((taxRecvState.allow || []).length >= TAX_RECV_ALLOW_MAX) return;
    taxRecvState.allow = [
      ...(taxRecvState.allow || []),
      { id: `a${Date.now().toString(36)}`, address, enabled: true }
    ];
    taxRecvAllowInput.value = "";
    taxRecvAllowInput.placeholder = t("taxRecvAllowPh");
    scheduleSaveTaxRecv();
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

  function saveVaultHide(state) {
    const normalized = normalizeVaultHide(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [VAULT_HIDE_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveVaultHide() {
    if (vaultHideSaveTimer) window.clearTimeout(vaultHideSaveTimer);
    vaultHideSaveTimer = window.setTimeout(async () => {
      vaultHideSaveTimer = null;
      vaultHideState = await saveVaultHide(vaultHideState);
      renderVaultHideUI(vaultHideState);
    }, 120);
  }

  function saveSearchHide(state) {
    const normalized = normalizeSearchHide(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [SEARCH_HIDE_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveSearchHide() {
    if (searchHideSaveTimer) window.clearTimeout(searchHideSaveTimer);
    searchHideSaveTimer = window.setTimeout(async () => {
      searchHideSaveTimer = null;
      searchHideState = await saveSearchHide(searchHideState);
      renderSearchHideUI(searchHideState);
    }, 120);
  }

  function renderSearchHideUI(state) {
    searchHideState = normalizeSearchHide(state);
    if (searchHideEnabled) searchHideEnabled.checked = searchHideState.enabled === true;
  }

  function renderVaultHideUI(state) {
    vaultHideState = normalizeVaultHide(state);
    if (vaultHideEnabled) vaultHideEnabled.checked = vaultHideState.enabled === true;
    if (vaultHideTax) vaultHideTax.checked = vaultHideState.hideTaxVault === true;
    if (vaultHideStock) vaultHideStock.checked = vaultHideState.hideStockVault === true;
    if (vaultHideOptions) {
      vaultHideOptions.classList.toggle("is-disabled", vaultHideState.enabled !== true);
    }
  }

  function readVaultHideFromUI() {
    return normalizeVaultHide({
      enabled: vaultHideEnabled?.checked === true,
      hideTaxVault: vaultHideTax?.checked === true,
      hideStockVault: vaultHideStock?.checked === true
    });
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

  function saveDevCountMark(state) {
    const normalized = normalizeDevCountMark(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [DEV_COUNT_MARK_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveDevCountMark() {
    if (devCountSaveTimer) window.clearTimeout(devCountSaveTimer);
    renderDevCountMarkUI(devCountMarkState);
    devCountSaveTimer = window.setTimeout(() => {
      devCountSaveTimer = null;
      void saveDevCountMark(devCountMarkState);
    }, 120);
  }

  function renderDevCountMarkUI(state) {
    devCountMarkState = normalizeDevCountMark(state);
    if (devCountEnabled) {
      devCountEnabled.checked = devCountMarkState.enabled === true;
    }
    if (devCountRulesWrap) {
      devCountRulesWrap.classList.toggle("is-disabled", devCountMarkState.enabled !== true);
    }
    if (!devCountRulesList) return;
    devCountRulesList.innerHTML = "";
    const rules = devCountMarkState.rules || [];
    if (!rules.length) {
      const empty = document.createElement("div");
      empty.className = "suffix-empty";
      empty.textContent = t("devCountEmpty");
      devCountRulesList.appendChild(empty);
      return;
    }
    for (const rule of rules) {
      const row = document.createElement("div");
      row.className = "suffix-rule-row";
      row.dataset.id = rule.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = rule.enabled !== false;
      cb.addEventListener("change", () => {
        const r = devCountMarkState.rules.find((x) => x.id === rule.id);
        if (!r) return;
        r.enabled = cb.checked === true;
        scheduleSaveDevCountMark();
      });

      const swatch = document.createElement("span");
      swatch.className = "mark-rule-swatch";
      swatch.style.background = rule.color;

      const color = document.createElement("input");
      color.type = "color";
      color.className = "mark-color-input";
      color.value = rule.color;
      color.addEventListener("input", () => {
        const r = devCountMarkState.rules.find((x) => x.id === rule.id);
        if (!r) return;
        r.color = normalizeHexColor(color.value, r.color);
        swatch.style.background = r.color;
        scheduleSaveDevCountMark();
      });

      const text = document.createElement("span");
      text.className = "suffix-rule-text mark-rule-label" + (rule.enabled === false ? " is-off" : "");
      text.textContent = `${devCountOpLabel(rule.op)} ${rule.min}`;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "suffix-rule-del";
      del.textContent = t("suffixRuleDel");
      del.addEventListener("click", () => {
        devCountMarkState.rules = devCountMarkState.rules.filter((x) => x.id !== rule.id);
        scheduleSaveDevCountMark();
      });

      row.append(cb, swatch, text, color, del);
      devCountRulesList.appendChild(row);
    }
  }

  function tryAddDevCountRule() {
    const min = Math.max(0, Math.min(999999, Math.floor(Number(devCountMinInput?.value))));
    if (!Number.isFinite(min)) return;
    const op = normalizeDevCountOp(devCountOpSelect?.value) || "lt";
    const color = normalizeHexColor(devCountColorInput?.value, "#f59e0b");
    const exists = (devCountMarkState.rules || []).some((r) => r.min === min && r.op === op);
    if (exists) return;
    if ((devCountMarkState.rules || []).length >= DEV_COUNT_MARK_MAX) return;
    devCountMarkState.rules = [
      ...(devCountMarkState.rules || []),
      { id: `d${Date.now().toString(36)}`, op, min, color, enabled: true }
    ];
    if (!devCountMarkState.enabled) {
      devCountMarkState.enabled = true;
      if (devCountEnabled) devCountEnabled.checked = true;
    }
    scheduleSaveDevCountMark();
  }

  function saveTwHandleMark(state) {
    const normalized = normalizeTwHandleMark(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [TW_HANDLE_MARK_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveTwHandleMark() {
    if (twHandleSaveTimer) window.clearTimeout(twHandleSaveTimer);
    renderTwHandleMarkUI(twHandleMarkState);
    twHandleSaveTimer = window.setTimeout(() => {
      twHandleSaveTimer = null;
      void saveTwHandleMark(twHandleMarkState);
    }, 120);
  }

  function renderTwHandleMarkUI(state) {
    twHandleMarkState = normalizeTwHandleMark(state);
    if (twHandleEnabled) {
      twHandleEnabled.checked = twHandleMarkState.enabled === true;
    }
    if (twHandleRulesWrap) {
      twHandleRulesWrap.classList.toggle("is-disabled", twHandleMarkState.enabled !== true);
    }
    if (!twHandleRulesList) return;
    twHandleRulesList.innerHTML = "";
    const rules = twHandleMarkState.rules || [];
    if (!rules.length) {
      const empty = document.createElement("div");
      empty.className = "suffix-empty";
      empty.textContent = t("twHandleEmpty");
      twHandleRulesList.appendChild(empty);
      return;
    }
    for (const rule of rules) {
      const row = document.createElement("div");
      row.className = "suffix-rule-row";
      row.dataset.id = rule.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = rule.enabled !== false;
      cb.addEventListener("change", () => {
        const r = twHandleMarkState.rules.find((x) => x.id === rule.id);
        if (!r) return;
        r.enabled = cb.checked === true;
        scheduleSaveTwHandleMark();
      });

      const swatch = document.createElement("span");
      swatch.className = "mark-rule-swatch";
      swatch.style.background = rule.color;

      const color = document.createElement("input");
      color.type = "color";
      color.className = "mark-color-input";
      color.value = rule.color;
      color.addEventListener("input", () => {
        const r = twHandleMarkState.rules.find((x) => x.id === rule.id);
        if (!r) return;
        r.color = normalizeHexColor(color.value, r.color);
        swatch.style.background = r.color;
        scheduleSaveTwHandleMark();
      });

      const text = document.createElement("span");
      text.className = "suffix-rule-text mark-rule-label" + (rule.enabled === false ? " is-off" : "");
      const note = rule.note ? ` · ${rule.note}` : "";
      text.textContent = `@${rule.handle}${note}`;
      text.title = text.textContent;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "suffix-rule-del";
      del.textContent = t("suffixRuleDel");
      del.addEventListener("click", () => {
        twHandleMarkState.rules = twHandleMarkState.rules.filter((x) => x.id !== rule.id);
        scheduleSaveTwHandleMark();
      });

      row.append(cb, swatch, text, color, del);
      twHandleRulesList.appendChild(row);
    }
  }

  function tryAddTwHandleRule() {
    const handle = normalizeTwHandle(twHandleInput?.value);
    if (!handle || handle.length < 2) {
      if (twHandleInput) twHandleInput.placeholder = t("twHandleInvalid");
      return;
    }
    const exists = (twHandleMarkState.rules || []).some((r) => r.handle === handle);
    if (exists) {
      if (twHandleInput) {
        twHandleInput.placeholder = t("twHandleDup");
        twHandleInput.value = "";
      }
      return;
    }
    if ((twHandleMarkState.rules || []).length >= TW_HANDLE_MARK_MAX) return;
    const note = String(twHandleNoteInput?.value || "").trim().slice(0, 16);
    const color = normalizeHexColor(twHandleColorInput?.value, "#fbbf24");
    twHandleMarkState.rules = [
      ...(twHandleMarkState.rules || []),
      { id: `t${Date.now().toString(36)}`, handle, note, color, enabled: true }
    ];
    if (!twHandleMarkState.enabled) {
      twHandleMarkState.enabled = true;
      if (twHandleEnabled) twHandleEnabled.checked = true;
    }
    if (twHandleInput) {
      twHandleInput.value = "";
      twHandleInput.placeholder = t("twHandlePh");
    }
    if (twHandleNoteInput) twHandleNoteInput.value = "";
    scheduleSaveTwHandleMark();
  }

  function saveSymbolDupMark(state) {
    const normalized = normalizeSymbolDupMark(state);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [SYMBOL_DUP_MARK_KEY]: normalized }, () => {
          void chrome.runtime?.lastError;
          resolve(normalized);
        });
      } catch {
        resolve(normalized);
      }
    });
  }

  function scheduleSaveSymbolDupMark() {
    if (symbolDupSaveTimer) window.clearTimeout(symbolDupSaveTimer);
    renderSymbolDupMarkUI(symbolDupMarkState);
    symbolDupSaveTimer = window.setTimeout(() => {
      symbolDupSaveTimer = null;
      void saveSymbolDupMark(symbolDupMarkState);
    }, 120);
  }

  function renderSymbolDupMarkUI(state) {
    symbolDupMarkState = normalizeSymbolDupMark(state);
    if (symbolDupEnabled) {
      symbolDupEnabled.checked = symbolDupMarkState.enabled === true;
    }
    if (symbolDupRulesWrap) {
      symbolDupRulesWrap.classList.toggle("is-disabled", symbolDupMarkState.enabled !== true);
    }
    if (symbolDupWait) symbolDupWait.checked = symbolDupMarkState.waitDup !== false;
    if (symbolDupWindow) symbolDupWindow.value = String(symbolDupMarkState.windowMin);
    if (symbolDupColor) symbolDupColor.value = symbolDupMarkState.color;
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
    renderVaultHideUI(vaultHideState);
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
  taxRecvAllowAdd?.addEventListener("click", () => tryAddTaxRecvAllow());
  taxRecvAllowInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      tryAddTaxRecvAllow();
    }
  });

  suffixHideEnabled?.addEventListener("change", () => {
    suffixHideState = normalizeSuffixHide({
      ...suffixHideState,
      enabled: suffixHideEnabled.checked === true
    });
    renderSuffixHideUI(suffixHideState);
    scheduleSaveSuffixHide();
  });

  searchHideEnabled?.addEventListener("change", () => {
    searchHideState = normalizeSearchHide({
      enabled: searchHideEnabled.checked === true
    });
    renderSearchHideUI(searchHideState);
    scheduleSaveSearchHide();
  });

  vaultHideEnabled?.addEventListener("change", () => {
    vaultHideState = readVaultHideFromUI();
    if (
      vaultHideState.enabled &&
      vaultHideState.hideTaxVault !== true &&
      vaultHideState.hideStockVault !== true
    ) {
      vaultHideState.hideTaxVault = true;
    }
    renderVaultHideUI(vaultHideState);
    scheduleSaveVaultHide();
  });
  vaultHideTax?.addEventListener("change", () => {
    vaultHideState = readVaultHideFromUI();
    scheduleSaveVaultHide();
  });
  vaultHideStock?.addEventListener("change", () => {
    vaultHideState = readVaultHideFromUI();
    scheduleSaveVaultHide();
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

  devCountEnabled?.addEventListener("change", () => {
    devCountMarkState.enabled = devCountEnabled.checked === true;
    scheduleSaveDevCountMark();
  });
  devCountAddBtn?.addEventListener("click", () => tryAddDevCountRule());
  devCountMinInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      tryAddDevCountRule();
    }
  });
  twHandleEnabled?.addEventListener("change", () => {
    twHandleMarkState.enabled = twHandleEnabled.checked === true;
    scheduleSaveTwHandleMark();
  });
  twHandleAddBtn?.addEventListener("click", () => tryAddTwHandleRule());
  twHandleInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      tryAddTwHandleRule();
    }
  });
  twHandleNoteInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      tryAddTwHandleRule();
    }
  });
  symbolDupEnabled?.addEventListener("change", () => {
    symbolDupMarkState.enabled = symbolDupEnabled.checked === true;
    scheduleSaveSymbolDupMark();
  });
  symbolDupWait?.addEventListener("change", () => {
    symbolDupMarkState.waitDup = symbolDupWait.checked === true;
    scheduleSaveSymbolDupMark();
  });
  symbolDupWindow?.addEventListener("change", () => {
    const n = Math.floor(Number(symbolDupWindow.value));
    symbolDupMarkState.windowMin = Number.isFinite(n) ? Math.max(1, Math.min(60, n)) : 5;
    scheduleSaveSymbolDupMark();
  });
  symbolDupColor?.addEventListener("input", () => {
    symbolDupMarkState.color = normalizeHexColor(symbolDupColor.value, DEFAULT_SYMBOL_DUP_MARK.color);
    scheduleSaveSymbolDupMark();
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
        renderVaultHideUI(vaultHideState);
        renderSearchHideUI(searchHideState);
        renderDevCountMarkUI(devCountMarkState);
        renderTwHandleMarkUI(twHandleMarkState);
        renderSymbolDupMarkUI(symbolDupMarkState);
      }
      if (changes[TAX_RECV_HIDE_KEY]) {
        taxRecvState = normalizeTaxRecvHide(changes[TAX_RECV_HIDE_KEY].newValue);
        renderTaxRecvUI(taxRecvState);
      }
      if (changes[SUFFIX_HIDE_KEY]) {
        suffixHideState = normalizeSuffixHide(changes[SUFFIX_HIDE_KEY].newValue);
        renderSuffixHideUI(suffixHideState);
      }
      if (changes[VAULT_HIDE_KEY]) {
        vaultHideState = normalizeVaultHide(changes[VAULT_HIDE_KEY].newValue);
        renderVaultHideUI(vaultHideState);
      }
      if (changes[SEARCH_HIDE_KEY]) {
        searchHideState = normalizeSearchHide(changes[SEARCH_HIDE_KEY].newValue);
        renderSearchHideUI(searchHideState);
      }
      if (changes[DEV_COUNT_MARK_KEY]) {
        devCountMarkState = normalizeDevCountMark(changes[DEV_COUNT_MARK_KEY].newValue);
        renderDevCountMarkUI(devCountMarkState);
      }
      if (changes[TW_HANDLE_MARK_KEY]) {
        twHandleMarkState = normalizeTwHandleMark(changes[TW_HANDLE_MARK_KEY].newValue);
        renderTwHandleMarkUI(twHandleMarkState);
      }
      if (changes[SYMBOL_DUP_MARK_KEY]) {
        symbolDupMarkState = normalizeSymbolDupMark(changes[SYMBOL_DUP_MARK_KEY].newValue);
        renderSymbolDupMarkUI(symbolDupMarkState);
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
      vaultHide: loadedVaultHide,
      searchHide: loadedSearchHide,
      license: loadedLicense,
      devCountMark: loadedDevCount,
      twHandleMark: loadedTwHandle,
      symbolDupMark: loadedSymbolDup,
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
      vaultHideState = normalizeVaultHide(loadedVaultHide);
      searchHideState = normalizeSearchHide(loadedSearchHide);
      devCountMarkState = normalizeDevCountMark(loadedDevCount);
      twHandleMarkState = normalizeTwHandleMark(loadedTwHandle);
      symbolDupMarkState = normalizeSymbolDupMark(loadedSymbolDup);
      applyStaticI18n();
      renderTheme(theme);
      renderPrefs(prefs);
      renderTaxRecvUI(taxRecvState);
      renderSuffixHideUI(suffixHideState);
      renderVaultHideUI(vaultHideState);
      renderSearchHideUI(searchHideState);
      renderDevCountMarkUI(devCountMarkState);
      renderTwHandleMarkUI(twHandleMarkState);
      renderSymbolDupMarkUI(symbolDupMarkState);
      renderLicenseUI(loadedLicense);
      void refreshStoredLicense();
      bindCollapseHeads();
      setSectionExpanded("theme", false);
      setSectionExpanded("taxRecv", false);
      setSectionExpanded("vaultHide", false);
      setSectionExpanded("suffixHide", false);
      setSectionExpanded("devCount", false);
      setSectionExpanded("twHandle", false);
      setSectionExpanded("symbolDup", false);
      setSectionExpanded("pref", false);
      setSectionExpanded("pos", false);
      fillOffsetUI(offsets);
      updateStatus();
    }
  );
})();
