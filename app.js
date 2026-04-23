(function () {
  "use strict";

  var STORAGE_V1 = "family-budget-v1";
  var STORAGE_V2 = "family-budget-v2";
  var MENU_MONTH_SPAN = 60;

  /** Các biểu tượng có sẵn khi tạo / sửa danh mục */
  var ICON_PRESETS = [
    { id: "food", sym: "🍜" },
    { id: "receipt", sym: "🧾" },
    { id: "shield", sym: "🛡️" },
    { id: "cart", sym: "🛒" },
    { id: "car", sym: "🚗" },
    { id: "home", sym: "🏠" },
    { id: "pill", sym: "💊" },
    { id: "bolt", sym: "⚡" },
    { id: "money", sym: "💰" },
    { id: "pin", sym: "📌" },
  ];
  var ICON_PRESET_NAMES = {
    food: "Ăn uống",
    receipt: "Hóa đơn",
    shield: "Bảo hiểm",
    cart: "Siêu thị",
    car: "Đi lại",
    home: "Nhà cửa",
    pill: "Sức khỏe",
    bolt: "Điện nước",
    money: "Tài chính",
    pin: "Khác",
  };

  /** Nhãn cho id danh mục cũ (trước khi có danh mục tùy chỉnh) — dùng khi gộp dữ liệu cũ */
  var LEGACY_CATEGORY_LABELS = {
    "an-uong": "Ăn uống",
    "thoi-trang": "Thời trang",
    "giai-tri": "Giải trí",
    "con-nhim": "Nhím",
    "con-hy": "Hy",
    "sinh-hoat": "Sinh hoạt",
    "di-lai": "Đi lại / Giao thông",
    "suc-khoe": "Sức khỏe",
    "nha-cua": "Nhà cửa / Tiện ích",
    "hoc-tap": "Học tập / Phát triển",
    "tiet-kiem": "Tiết kiệm",
    "dau-tu": "Đầu tư",
    "tra-no": "Trả nợ",
    "khac": "Khác",
    "con-cai": "Nhím",
  };

  function defaultCategories() {
    return [
      { id: "cat-an-uong", label: "Ăn uống", iconId: "food" },
      { id: "cat-hoa-don", label: "Hoá đơn", iconId: "receipt" },
      { id: "cat-bao-hiem", label: "Bảo hiểm", iconId: "shield" },
      { id: "cat-sieu-thi", label: "Siêu thị", iconId: "cart" },
      { id: "cat-di-lai", label: "Đi lại", iconId: "car" },
    ];
  }

  function catUid() {
    return "c-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function iconIdToSym(iconId) {
    var i;
    for (i = 0; i < ICON_PRESETS.length; i++) {
      if (ICON_PRESETS[i].id === iconId) return ICON_PRESETS[i].sym;
    }
    return "📌";
  }

  function normalizeCategoryRow(c) {
    var label = c && typeof c.label === "string" ? c.label.trim() : "";
    if (!label) label = "Danh mục";
    if (label.length > 40) label = label.slice(0, 40);
    var rawId = c && typeof c.id === "string" ? c.id.trim() : "";
    var id = rawId || catUid();
    var iconId = c && typeof c.iconId === "string" ? c.iconId : "pin";
    var okIcon = false;
    var j;
    for (j = 0; j < ICON_PRESETS.length; j++) {
      if (ICON_PRESETS[j].id === iconId) {
        okIcon = true;
        break;
      }
    }
    if (!okIcon) iconId = "pin";
    return { id: id, label: label, iconId: iconId };
  }

  var VND_PER_INPUT_UNIT = 1000;

  function currentMonthKey() {
    var d = new Date();
    var mo = d.getMonth() + 1;
    return d.getFullYear() + "-" + (mo < 10 ? "0" : "") + mo;
  }

  function parseMoneyInput(str) {
    if (str == null || String(str).trim() === "") return 0;
    var cleaned = String(str)
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");
    var n = parseFloat(cleaned);
    return isNaN(n) ? 0 : Math.round(n);
  }

  function parseNganCoefficient(str) {
    if (str == null || String(str).trim() === "") return 0;
    var s = String(str).trim().replace(/\s/g, "").replace(",", ".");
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseMoneyToVND(str) {
    var s = String(str || "").trim();
    if (!s) return 0;
    if (looksLikeFormattedVND(s)) return parseMoneyInput(s);
    return Math.round(parseNganCoefficient(s) * VND_PER_INPUT_UNIT);
  }

  function formatAsNganDisplay(vnd) {
    if (!vnd || vnd <= 0) return "";
    var k = vnd / VND_PER_INPUT_UNIT;
    if (Math.abs(k - Math.round(k)) < 1e-6) return String(Math.round(k));
    var rounded = Math.round(k * 1000) / 1000;
    return rounded.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }

  function looksLikeFormattedVND(str) {
    return /^\d{1,3}(\.\d{3})+$/.test(String(str).replace(/\s/g, ""));
  }

  function formatMoneyVND(n) {
    if (typeof n !== "number" || isNaN(n)) n = 0;
    return (
      n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " \u20ab"
    );
  }

  /** Hiển thị ngắn cho tổng quan: 250k, 1,5tr, 20tr, 1,2tỷ */
  function formatShortDecimal(x) {
    var r = Math.round(x * 100) / 100;
    if (Math.abs(r - Math.round(r)) < 1e-8) return String(Math.round(r));
    var s = r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return s.replace(".", ",");
  }

  function formatMoneyVNDShort(n) {
    if (typeof n !== "number" || isNaN(n)) n = 0;
    var sign = "";
    if (n < 0) {
      sign = "-";
      n = Math.abs(n);
    }
    n = Math.round(n);
    if (n === 0) return sign + "0 \u20ab";
    if (n < 1000) return sign + n + " \u20ab";
    if (n < 1e6) {
      return sign + formatShortDecimal(n / 1000) + "k \u20ab";
    }
    if (n < 1e9) {
      return sign + formatShortDecimal(n / 1e6) + "tr \u20ab";
    }
    return sign + formatShortDecimal(n / 1e9) + "tỷ \u20ab";
  }

  function uid() {
    return "e-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function defaultFixedTemplates() {
    return [];
  }

  function defaultSettings() {
    return {
      defaultLimit: 0,
      themeMode: "dark",
    };
  }

  var THEME_PRESETS = {
    dark: {
      appBg: "#0c1014",
      appText: "#f0f4f8",
      bgElevated: "#111820",
      surface: "#161d26",
      surface2: "#1c2530",
      surfacePress: "#222c3a",
      border: "rgba(255, 255, 255, 0.08)",
      borderStrong: "rgba(255, 255, 255, 0.12)",
      muted: "#8a9aad",
      muted2: "#5c6b7f",
      accent: "#34c3a0",
      accentSoft: "rgba(52, 195, 160, 0.14)",
      accentText: "#6ee4c4",
      accentPress: "#2aa888",
      danger: "#e07070",
      dangerSoft: "rgba(224, 112, 112, 0.12)",
    },
    light: {
      appBg: "#f3f6fb",
      appText: "#1d2733",
      bgElevated: "#ffffff",
      surface: "#ffffff",
      surface2: "#eef3fa",
      surfacePress: "#e6edf7",
      border: "rgba(18, 35, 56, 0.12)",
      borderStrong: "rgba(18, 35, 56, 0.2)",
      muted: "#5e6f85",
      muted2: "#7b8b9e",
      accent: "#2f8ef0",
      accentSoft: "rgba(47, 142, 240, 0.14)",
      accentText: "#246fc0",
      accentPress: "#287ad0",
      danger: "#c75f67",
      dangerSoft: "rgba(199, 95, 103, 0.12)",
    },
    blue: {
      appBg: "#0d1827",
      appText: "#ecf3ff",
      bgElevated: "#122136",
      surface: "#17273f",
      surface2: "#1c2f4a",
      surfacePress: "#243b5d",
      border: "rgba(154, 194, 255, 0.14)",
      borderStrong: "rgba(154, 194, 255, 0.22)",
      muted: "#90a7c5",
      muted2: "#6f89aa",
      accent: "#5ba8f0",
      accentSoft: "rgba(91, 168, 240, 0.16)",
      accentText: "#8bc3f8",
      accentPress: "#498fd0",
      danger: "#e37c8c",
      dangerSoft: "rgba(227, 124, 140, 0.14)",
    },
    green: {
      appBg: "#0f1a15",
      appText: "#eef8f3",
      bgElevated: "#13221b",
      surface: "#182b22",
      surface2: "#1e342a",
      surfacePress: "#264236",
      border: "rgba(152, 206, 178, 0.14)",
      borderStrong: "rgba(152, 206, 178, 0.22)",
      muted: "#90a99a",
      muted2: "#6f8a7b",
      accent: "#5ac48f",
      accentSoft: "rgba(90, 196, 143, 0.16)",
      accentText: "#85ddb0",
      accentPress: "#45a775",
      danger: "#df8a85",
      dangerSoft: "rgba(223, 138, 133, 0.14)",
    },
    pink: {
      appBg: "#1a1118",
      appText: "#f8edf5",
      bgElevated: "#241724",
      surface: "#2b1b2b",
      surface2: "#352136",
      surfacePress: "#432a45",
      border: "rgba(233, 172, 219, 0.14)",
      borderStrong: "rgba(233, 172, 219, 0.22)",
      muted: "#b59ab0",
      muted2: "#917b8d",
      accent: "#d87abf",
      accentSoft: "rgba(216, 122, 191, 0.16)",
      accentText: "#efabd9",
      accentPress: "#bc61a4",
      danger: "#e08898",
      dangerSoft: "rgba(224, 136, 152, 0.14)",
    },
  };

  function normalizeThemeMode(v) {
    var key = typeof v === "string" ? v.trim().toLowerCase() : "";
    return THEME_PRESETS[key] ? key : "dark";
  }

  function normalizeSettings(s) {
    var out = s && typeof s === "object" ? s : {};
    var lim = out.defaultLimit;
    out.defaultLimit =
      typeof lim === "number" && !isNaN(lim) ? Math.max(0, Math.round(lim)) : 0;
    out.themeMode = normalizeThemeMode(out.themeMode);
    return out;
  }

  function loadAppData() {
    try {
      var raw = localStorage.getItem(STORAGE_V2);
      if (raw) {
        var d = JSON.parse(raw);
        var months = d.months && typeof d.months === "object" ? d.months : {};
        var fixedTemplates;
        if (Array.isArray(d.fixedTemplates)) {
          fixedTemplates = d.fixedTemplates;
        } else if (d.fixedTemplates === undefined) {
          fixedTemplates = defaultFixedTemplates();
        } else {
          fixedTemplates = [];
        }
        var settings = normalizeSettings(d.settings);
        var categories;
        if (Array.isArray(d.categories) && d.categories.length > 0) {
          categories = d.categories;
        } else {
          categories = defaultCategories();
        }
        return {
          months: months,
          fixedTemplates: fixedTemplates,
          settings: settings,
          categories: categories,
        };
      }
    } catch (e) {}
    var months = {};
    try {
      var v1 = localStorage.getItem(STORAGE_V1);
      if (v1) {
        var old = JSON.parse(v1);
        months[currentMonthKey()] = {
          income:
            typeof old.income === "number"
              ? old.income
              : parseMoneyInput(String(old.income || "")),
          expenses: Array.isArray(old.expenses) ? old.expenses : [],
        };
        try {
          localStorage.setItem(
            STORAGE_V2,
            JSON.stringify({
              months: months,
              fixedTemplates: defaultFixedTemplates(),
              settings: defaultSettings(),
              categories: defaultCategories(),
            })
          );
        } catch (e3) {}
      }
    } catch (e2) {}
    return {
      months: months,
      fixedTemplates: defaultFixedTemplates(),
      settings: defaultSettings(),
      categories: defaultCategories(),
    };
  }

  function saveAppData() {
    try {
      localStorage.setItem(
        STORAGE_V2,
        JSON.stringify({
          months: app.months,
          fixedTemplates: app.fixedTemplates,
          settings: app.settings,
          categories: app.categories,
        })
      );
    } catch (e) {}
  }

  var app = loadAppData();
  if (!Array.isArray(app.fixedTemplates)) app.fixedTemplates = defaultFixedTemplates();
  if (!app.settings || typeof app.settings !== "object") app.settings = defaultSettings();
  app.settings = normalizeSettings(app.settings);

  function applyThemeSettings() {
    var root = document.documentElement;
    var s = app && app.settings ? app.settings : defaultSettings();
    var p = THEME_PRESETS[normalizeThemeMode(s.themeMode)];
    root.style.setProperty("--app-bg", p.appBg);
    root.style.setProperty("--app-text", p.appText);
    root.style.setProperty("--bg-elevated", p.bgElevated);
    root.style.setProperty("--surface", p.surface);
    root.style.setProperty("--surface-2", p.surface2);
    root.style.setProperty("--surface-press", p.surfacePress);
    root.style.setProperty("--border", p.border);
    root.style.setProperty("--border-strong", p.borderStrong);
    root.style.setProperty("--muted", p.muted);
    root.style.setProperty("--muted2", p.muted2);
    root.style.setProperty("--accent", p.accent);
    root.style.setProperty("--accent-soft", p.accentSoft);
    root.style.setProperty("--accent-text", p.accentText);
    root.style.setProperty("--accent-press", p.accentPress);
    root.style.setProperty("--danger", p.danger);
    root.style.setProperty("--danger-soft", p.dangerSoft);
  }

  applyThemeSettings();

  function migrateMonthIncomeUserSet(m) {
    if (!m || (m.incomeUserSet !== undefined && m.incomeUserSet !== null)) return;
    // Chỉ coi đã chỉnh hạn mức khi từng có thu nhập/hạn mức > 0 (dữ liệu cũ). Có chi tiêu ≠ đã đặt hạn mức.
    if ((m.income || 0) > 0) {
      m.incomeUserSet = true;
    } else {
      m.incomeUserSet = false;
    }
  }

  function migrateAllMonthsIncomeUserSet() {
    Object.keys(app.months).forEach(function (k) {
      migrateMonthIncomeUserSet(app.months[k]);
    });
  }

  migrateAllMonthsIncomeUserSet();

  function collectOrphanCategoryIds() {
    var set = {};
    function add(id) {
      if (id && typeof id === "string") set[id] = true;
    }
    Object.keys(app.months).forEach(function (k) {
      var m = app.months[k];
      if (!m || !Array.isArray(m.expenses)) return;
      m.expenses.forEach(function (e) {
        add(e.category);
      });
    });
    (app.fixedTemplates || []).forEach(function (t) {
      add(t.category);
    });
    return Object.keys(set);
  }

  function mergeOrphanCategoriesIntoList() {
    collectOrphanCategoryIds().forEach(function (id) {
      var exists = app.categories.some(function (c) {
        return c.id === id;
      });
      if (exists) return;
      app.categories.push({
        id: id,
        label: LEGACY_CATEGORY_LABELS[id] || id,
        iconId: "pin",
      });
    });
  }

  function ensureAppCategories() {
    if (!Array.isArray(app.categories) || app.categories.length === 0) {
      app.categories = defaultCategories();
    } else {
      app.categories = app.categories.map(normalizeCategoryRow);
    }
    mergeOrphanCategoriesIntoList();
  }

  ensureAppCategories();

  function findCategory(id) {
    var i;
    for (i = 0; i < app.categories.length; i++) {
      if (app.categories[i].id === id) return app.categories[i];
    }
    return null;
  }

  function categoryIdExists(id) {
    return !!findCategory(id);
  }

  function getCategoryLabel(id) {
    var c = findCategory(id);
    if (c) return c.label;
    return LEGACY_CATEGORY_LABELS[id] || id;
  }

  function getCategoryIconSym(id) {
    var c = findCategory(id);
    return iconIdToSym(c ? c.iconId : "pin");
  }

  function getFirstCategoryId() {
    return app.categories[0] ? app.categories[0].id : "cat-an-uong";
  }

  function reassignCategoryEverywhere(fromId, toId) {
    Object.keys(app.months).forEach(function (k) {
      var m = app.months[k];
      if (!m || !Array.isArray(m.expenses)) return;
      m.expenses.forEach(function (e) {
        if (e.category === fromId) e.category = toId;
      });
    });
    (app.fixedTemplates || []).forEach(function (t) {
      if (t.category === fromId) t.category = toId;
    });
  }

  var activeMonthKey = null;
  var state = null;
  var editingExpenseId = null;
  var editingFixedTemplateId = null;
  var editingCategoryId = null;
  var expenseListFilter = "all";
  var incomeProgrammatic = false;
  var incomeDirty = false;

  function getDefaultMonthlyLimit() {
    return app.settings && typeof app.settings.defaultLimit === "number"
      ? Math.max(0, Math.round(app.settings.defaultLimit))
      : 0;
  }

  function ensureMonth(k) {
    if (!app.months[k]) {
      app.months[k] = {
        income: 0,
        expenses: [],
        incomeUserSet: false,
      };
    }
    if (!Array.isArray(app.months[k].expenses)) app.months[k].expenses = [];
    if (typeof app.months[k].income !== "number") app.months[k].income = 0;
    migrateMonthIncomeUserSet(app.months[k]);
    return app.months[k];
  }

  function totalExpensesForMonth(m) {
    if (!m || !m.expenses) return 0;
    return m.expenses.reduce(function (s, e) {
      return s + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
  }

  function monthHasData(k) {
    var m = app.months[k];
    if (!m) return false;
    if ((m.income || 0) > 0) return true;
    if (m.expenses && m.expenses.length > 0) return true;
    return false;
  }

  function formatMonthKeyVi(key) {
    var p = key.split("-");
    if (p.length !== 2) return key;
    return "Tháng " + String(parseInt(p[1], 10)) + " · " + p[0];
  }

  function allMenuMonthKeys() {
    var set = {};
    var out = [];
    var d = new Date();
    var i;
    for (i = 0; i < MENU_MONTH_SPAN; i++) {
      var y = d.getFullYear();
      var mo = d.getMonth() + 1;
      var k = y + "-" + (mo < 10 ? "0" : "") + mo;
      if (!set[k]) {
        set[k] = true;
        out.push(k);
      }
      d.setMonth(d.getMonth() - 1);
    }
    Object.keys(app.months).forEach(function (k) {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(k) && !set[k]) {
        set[k] = true;
        out.push(k);
      }
    });
    out.sort(function (a, b) {
      return b.localeCompare(a);
    });
    return out;
  }

  var URL_PARAM_THANG = "thang";

  function readThangFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search).get(URL_PARAM_THANG);
      if (!p || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return null;
      return p;
    } catch (e) {
      return null;
    }
  }

  function hasInvalidThangParam() {
    try {
      var u = new URL(window.location.href);
      return u.searchParams.has(URL_PARAM_THANG) && !readThangFromUrl();
    } catch (e2) {
      return false;
    }
  }

  function buildUrlWithThang(key) {
    var url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM_THANG, key);
    return url.pathname + url.search + url.hash;
  }

  function buildUrlWithoutThang() {
    var url = new URL(window.location.href);
    url.searchParams.delete(URL_PARAM_THANG);
    var q = url.searchParams.toString();
    return url.pathname + (q ? "?" + q : "") + url.hash;
  }

  function syncUrlToMonth(key) {
    if (readThangFromUrl() === key) return;
    history.pushState({ thang: key }, "", buildUrlWithThang(key));
  }

  var elMonthScreenTitle = document.getElementById("month-screen-title");
  var elIncome = document.getElementById("monthly-income");
  var elIncomePreview = document.getElementById("income-amount-preview");
  var elSummaryCard = document.getElementById("summary-card");
  var elLimitViewMode = document.getElementById("limit-view-mode");
  var elLimitEditPanel = document.getElementById("limit-edit-panel");
  var elBtnLimitEdit = document.getElementById("btn-limit-edit");
  var elBtnLimitDone = document.getElementById("btn-limit-done");
  var elBtnLimitCancel = document.getElementById("btn-limit-cancel");
  var elCategory = document.getElementById("expense-category");
  var elName = document.getElementById("expense-name");
  var elAmount = document.getElementById("expense-amount");
  var elExpensePreview = document.getElementById("expense-amount-preview");
  var elForm = document.getElementById("expense-form");
  var elExpenseFixed = document.getElementById("expense-fixed");
  var elExpenseList = document.getElementById("expense-list");
  var elEmpty = document.getElementById("empty-state");
  var elExpenseFilterAll = document.getElementById("expense-filter-all");
  var elExpenseFilterFixed = document.getElementById("expense-filter-fixed");
  var elExpenseFilterFlex = document.getElementById("expense-filter-flex");
  var elReportModeBreakdown = document.getElementById("report-mode-breakdown");
  var elReportModePie = document.getElementById("report-mode-pie");
  var elReportBreakdownView = document.getElementById("report-breakdown-view");
  var elReportPieView = document.getElementById("report-pie-view");
  var elSumIncome = document.getElementById("sum-income");
  var elSumExpenses = document.getElementById("sum-expenses");
  var elSumBalance = document.getElementById("sum-balance");
  var elMonthForecastNote = document.getElementById("month-forecast-note");
  var elMonthForecastDay = document.getElementById("month-forecast-day");
  var elMonthForecastWeek = document.getElementById("month-forecast-week");
  var elBalanceForecastNote = document.getElementById("balance-forecast-note");
  var elBalanceForecastDay = document.getElementById("balance-forecast-day");
  var elBalanceForecastWeek = document.getElementById("balance-forecast-week");
  var elBreakdown = document.getElementById("category-breakdown");
  var elBtnClear = document.getElementById("btn-clear-all");
  var elPieEmpty = document.getElementById("pie-chart-empty");
  var elPieBody = document.getElementById("pie-chart-body");
  var elPieSlices = document.getElementById("expense-pie-slices");
  var elPieLegend = document.getElementById("expense-pie-legend");
  var elPieTitle = document.getElementById("pie-svg-title");

  var elSideMenu = document.getElementById("side-menu");
  var elSideMenuBackdrop = document.getElementById("side-menu-backdrop");
  var elSideMenuPanel = document.getElementById("side-menu-panel");
  var elSideMenuList = document.getElementById("side-menu-month-list");
  var elBtnOpenMenu = document.getElementById("btn-open-menu");
  var elBtnCloseMenu = document.getElementById("btn-close-menu");
  var elMenuJumpMonth = document.getElementById("menu-jump-month");
  var elMenuJumpBtn = document.getElementById("menu-jump-btn");

  var elViewMonth = document.getElementById("view-month");
  var elViewSettings = document.getElementById("view-settings");
  var elBtnOpenSettings = document.getElementById("btn-open-settings");
  var elBtnCloseSettings = document.getElementById("btn-close-settings");
  var elSettingsDefaultLimit = document.getElementById("settings-default-limit");
  var elSettingsDefaultLimitPreview = document.getElementById("settings-default-limit-preview");
  var elSettingsThemeOptions = document.getElementById("settings-theme-options");
  var elSettingsFixedList = document.getElementById("settings-fixed-templates-list");
  var elSettingsAddFixedForm = document.getElementById("settings-add-fixed-form");
  var elSettingsAddFixedCategory = document.getElementById("settings-add-fixed-category");
  var elSettingsAddFixedName = document.getElementById("settings-add-fixed-name");
  var elSettingsAddFixedAmount = document.getElementById("settings-add-fixed-amount");
  var elSettingsAddFixedAmountPreview = document.getElementById("settings-add-fixed-amount-preview");
  var elSettingsCategoriesList = document.getElementById("settings-categories-list");
  var elSettingsAddCategoryForm = document.getElementById("settings-add-category-form");
  var elSettingsNewCategoryLabel = document.getElementById("settings-new-category-label");
  var elSettingsNewCategoryIconSelect = document.getElementById("settings-new-category-icon-select");
  var elEditCategoryDialog = document.getElementById("edit-category-dialog");
  var elEditCategoryBackdrop = document.getElementById("edit-category-backdrop");
  var elEditCategoryLabelInput = document.getElementById("edit-category-label-input");
  var elEditCategoryIcons = document.getElementById("edit-category-icons");
  var elEditCategoryIconId = document.getElementById("edit-category-icon-id");
  var elEditCategorySave = document.getElementById("edit-category-save");
  var elEditCategoryCancel = document.getElementById("edit-category-cancel");

  var elEditFixedDialog = document.getElementById("edit-fixed-template-dialog");
  var elEditFixedBackdrop = document.getElementById("edit-fixed-template-backdrop");
  var elEditFixedTitle = document.getElementById("edit-fixed-template-title");
  var elEditFixedCategory = document.getElementById("edit-fixed-template-category");
  var elEditFixedName = document.getElementById("edit-fixed-template-name");
  var elEditFixedAmount = document.getElementById("edit-fixed-template-amount");
  var elEditFixedAmountPreview = document.getElementById("edit-fixed-template-amount-preview");
  var elEditFixedSave = document.getElementById("edit-fixed-template-save");
  var elEditFixedCancel = document.getElementById("edit-fixed-template-cancel");

  var elFixedTemplatesList = document.getElementById("fixed-templates-list");

  var elEditDialog = document.getElementById("edit-expense-dialog");
  var elEditBackdrop = document.getElementById("edit-expense-backdrop");
  var elEditDesc = document.getElementById("edit-expense-desc");
  var elEditExpenseCategory = document.getElementById("edit-expense-category");
  var elEditExpenseName = document.getElementById("edit-expense-name");
  var elEditAmount = document.getElementById("edit-expense-amount");
  var elEditAmountPreview = document.getElementById("edit-expense-amount-preview");
  var elEditTemplateNote = document.getElementById("edit-expense-template-note");
  var elEditSave = document.getElementById("edit-expense-save");
  var elEditCancel = document.getElementById("edit-expense-cancel");
  var reportMode = "pie";

  function fillCategorySelect(el) {
    if (!el) return;
    el.innerHTML = "";
    app.categories.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = iconIdToSym(c.iconId) + "  " + c.label;
      el.appendChild(opt);
    });
  }

  function refreshAllCategorySelects() {
    fillCategorySelect(elCategory);
    fillCategorySelect(elSettingsAddFixedCategory);
    fillCategorySelect(elEditFixedCategory);
    fillCategorySelect(elEditExpenseCategory);
  }

  function renderIconPicker(containerEl, hiddenEl, selectedId) {
    if (!containerEl || !hiddenEl) return;
    var sel = selectedId;
    var valid = false;
    var i;
    for (i = 0; i < ICON_PRESETS.length; i++) {
      if (ICON_PRESETS[i].id === sel) {
        valid = true;
        break;
      }
    }
    if (!valid) sel = "pin";
    hiddenEl.value = sel;
    containerEl.innerHTML = "";
    ICON_PRESETS.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-picker-btn" + (p.id === sel ? " is-selected" : "");
      btn.textContent = p.sym;
      btn.setAttribute("aria-pressed", p.id === sel ? "true" : "false");
      btn.addEventListener("click", function () {
        hiddenEl.value = p.id;
        var ch = containerEl.querySelectorAll(".icon-picker-btn");
        var j;
        for (j = 0; j < ch.length; j++) {
          var on = ch[j] === btn;
          ch[j].classList.toggle("is-selected", on);
          ch[j].setAttribute("aria-pressed", on ? "true" : "false");
        }
      });
      containerEl.appendChild(btn);
    });
  }

  function renderSettingsNewCategoryIconPicker() {
    if (!elSettingsNewCategoryIconSelect) return;
    var current = elSettingsNewCategoryIconSelect.value || "food";
    elSettingsNewCategoryIconSelect.innerHTML = "";
    ICON_PRESETS.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.sym;
      opt.title = ICON_PRESET_NAMES[p.id] || p.id;
      elSettingsNewCategoryIconSelect.appendChild(opt);
    });
    elSettingsNewCategoryIconSelect.value = current;
    if (!elSettingsNewCategoryIconSelect.value) {
      elSettingsNewCategoryIconSelect.value = "food";
    }
    var selected = ICON_PRESET_NAMES[elSettingsNewCategoryIconSelect.value] || "Biểu tượng";
    elSettingsNewCategoryIconSelect.title = "Biểu tượng: " + selected;
  }

  function renderSettingsCategoriesList() {
    if (!elSettingsCategoriesList) return;
    elSettingsCategoriesList.innerHTML = "";
    app.categories.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "settings-category-row";

      var sym = document.createElement("span");
      sym.className = "settings-category-sym";
      sym.textContent = iconIdToSym(c.iconId);
      sym.setAttribute("aria-hidden", "true");

      var mid = document.createElement("div");
      mid.className = "settings-category-mid";
      var title = document.createElement("span");
      title.className = "settings-category-title";
      title.textContent = c.label;
      mid.appendChild(title);

      var actions = document.createElement("div");
      actions.className = "settings-category-actions";

      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn-icon btn-icon-muted";
      btnEdit.setAttribute("aria-label", "Sửa danh mục");
      btnEdit.appendChild(iconPencilSvg());
      btnEdit.addEventListener("click", function () {
        openEditCategoryDialog(c.id);
      });

      var btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-icon btn-icon-danger";
      btnDel.setAttribute("aria-label", "Xóa danh mục");
      btnDel.appendChild(iconTrashSvg());
      btnDel.addEventListener("click", function () {
        deleteCategoryFromSettings(c.id);
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
      li.appendChild(sym);
      li.appendChild(mid);
      li.appendChild(actions);
      elSettingsCategoriesList.appendChild(li);
    });
  }

  function deleteCategoryFromSettings(id) {
    if (app.categories.length <= 1) {
      window.alert("Cần giữ ít nhất một danh mục.");
      return;
    }
    if (!confirm("Xóa danh mục này? Mọi khoản chi và khoản cố định đang dùng danh mục này sẽ chuyển sang danh mục khác.")) {
      return;
    }
    var rest = app.categories.filter(function (c) {
      return c.id !== id;
    });
    var toId = rest[0] ? rest[0].id : getFirstCategoryId();
    reassignCategoryEverywhere(id, toId);
    app.categories = rest;
    saveAppData();
    refreshAllCategorySelects();
    renderSettingsCategoriesList();
    if (activeMonthKey && state) {
      state.expenses = state.expenses.map(normalizeExpenseRow);
      syncFixedIntoMonth(state);
      persistAndRender();
    } else {
      renderFixedTemplatesList();
    }
  }

  function closeEditCategoryDialog() {
    editingCategoryId = null;
    if (elEditCategoryDialog) {
      elEditCategoryDialog.hidden = true;
      elEditCategoryDialog.setAttribute("aria-hidden", "true");
    }
    if (
      (!elEditDialog || elEditDialog.hidden) &&
      (!elEditFixedDialog || elEditFixedDialog.hidden)
    ) {
      document.body.classList.remove("modal-open");
    }
  }

  function openEditCategoryDialog(catId) {
    var c = findCategory(catId);
    if (!c || !elEditCategoryDialog) return;
    editingCategoryId = catId;
    if (elEditCategoryLabelInput) elEditCategoryLabelInput.value = c.label;
    renderIconPicker(elEditCategoryIcons, elEditCategoryIconId, c.iconId);
    elEditCategoryDialog.hidden = false;
    elEditCategoryDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(function () {
      if (elEditCategoryLabelInput) elEditCategoryLabelInput.focus();
    }, 0);
  }

  function saveEditCategoryDialog() {
    if (!editingCategoryId) return;
    var c = findCategory(editingCategoryId);
    if (!c) {
      closeEditCategoryDialog();
      return;
    }
    var label = elEditCategoryLabelInput ? elEditCategoryLabelInput.value.trim() : "";
    if (!label) {
      if (elEditCategoryLabelInput) elEditCategoryLabelInput.focus();
      return;
    }
    if (label.length > 40) label = label.slice(0, 40);
    c.label = label;
    c.iconId = elEditCategoryIconId ? elEditCategoryIconId.value : "pin";
    var ok = false;
    var i;
    for (i = 0; i < ICON_PRESETS.length; i++) {
      if (ICON_PRESETS[i].id === c.iconId) {
        ok = true;
        break;
      }
    }
    if (!ok) c.iconId = "pin";
    saveAppData();
    closeEditCategoryDialog();
    renderSettingsCategoriesList();
    refreshAllCategorySelects();
    if (activeMonthKey && state) persistAndRender();
  }

  function formatPreviewPlainVND(vnd) {
    if (!vnd || vnd <= 0) return "";
    return vnd.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " \u20ab";
  }

  function updateAmountPreview(inputEl, previewEl) {
    if (!previewEl) return;
    var vnd = parseMoneyToVND(inputEl.value);
    if (vnd > 0) {
      previewEl.textContent = "= " + formatPreviewPlainVND(vnd);
      previewEl.removeAttribute("hidden");
      previewEl.setAttribute("aria-hidden", "false");
    } else {
      previewEl.textContent = "";
      previewEl.setAttribute("hidden", "");
      previewEl.setAttribute("aria-hidden", "true");
    }
  }

  function bindAmountPreview(inputEl, previewEl) {
    if (!inputEl || !previewEl) return;
    function tick() {
      updateAmountPreview(inputEl, previewEl);
    }
    inputEl.addEventListener("input", tick);
    inputEl.addEventListener("focus", tick);
    tick();
  }

  function normalizeExpenseRow(row) {
    var cat = row.category;
    if (cat === "con-cai") cat = "con-nhim";
    if (!categoryIdExists(cat)) cat = getFirstCategoryId();
    var o = {
      id: row.id || uid(),
      category: cat,
      name: typeof row.name === "string" ? row.name.trim() : "",
      amount: typeof row.amount === "number" && row.amount >= 0 ? Math.round(row.amount) : 0,
    };
    if (row.templateId) o.templateId = row.templateId;
    return o;
  }

  function syncFixedIntoMonth(m) {
    if (!Array.isArray(app.fixedTemplates)) return;
    app.fixedTemplates.forEach(function (t) {
      if (!t || !t.id || !categoryIdExists(t.category)) return;
      var exists = m.expenses.some(function (e) {
        return e.templateId === t.id;
      });
      if (!exists) {
        m.expenses.push({
          id: uid(),
          templateId: t.id,
          category: t.category,
          name: typeof t.name === "string" ? t.name.trim() : "",
          amount:
            typeof t.amount === "number" && t.amount >= 0
              ? Math.round(t.amount)
              : 0,
        });
      }
    });
  }

  function findFixedTemplate(templateId) {
    if (!templateId || !app.fixedTemplates) return null;
    var i;
    for (i = 0; i < app.fixedTemplates.length; i++) {
      if (app.fixedTemplates[i].id === templateId) return app.fixedTemplates[i];
    }
    return null;
  }

  function syncExpenseRowsFromTemplate(t) {
    if (!t || !t.id) return;
    Object.keys(app.months).forEach(function (k) {
      var m = app.months[k];
      if (!m || !Array.isArray(m.expenses)) return;
      m.expenses.forEach(function (e) {
        if (e.templateId === t.id) {
          e.category = t.category;
          e.name = typeof t.name === "string" ? t.name.trim() : "";
          e.amount =
            typeof t.amount === "number" && t.amount >= 0
              ? Math.round(t.amount)
              : 0;
        }
      });
    });
  }

  function totalExpenses() {
    if (!state) return 0;
    return state.expenses.reduce(function (s, e) {
      return s + e.amount;
    }, 0);
  }

  function totalsByCategory() {
    var map = {};
    app.categories.forEach(function (c) {
      map[c.id] = 0;
    });
    if (!state) return map;
    state.expenses.forEach(function (e) {
      if (map[e.category] == null) map[e.category] = 0;
      map[e.category] += e.amount;
    });
    return map;
  }

  var PIE_COLORS = [
    "#34c3a0",
    "#5b9fe8",
    "#c78fff",
    "#e8b84a",
    "#e07070",
    "#5fd4c8",
    "#9ab87a",
    "#d4a574",
    "#8b9fe0",
    "#c45c9c",
    "#7dd4b0",
    "#a8b0c0",
    "#6b8cce",
    "#9a8ad4",
    "#5ccea8",
    "#e8986a",
  ];

  function pieSlicePath(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0);
    var y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1);
    var y1 = cy + r * Math.sin(a1);
    var large = a1 - a0 > Math.PI ? 1 : 0;
    return (
      "M " +
      cx +
      " " +
      cy +
      " L " +
      x0 +
      " " +
      y0 +
      " A " +
      r +
      " " +
      r +
      " 0 " +
      large +
      " 1 " +
      x1 +
      " " +
      y1 +
      " Z"
    );
  }

  function renderPieChart() {
    if (!elPieBody || !elPieSlices || !elPieLegend || !state) return;
    var byCat = totalsByCategory();
    var segments = [];
    app.categories.forEach(function (c) {
      var amt = byCat[c.id] || 0;
      if (amt > 0) segments.push({ id: c.id, label: c.label, amount: amt });
    });
    var total = segments.reduce(function (s, x) {
      return s + x.amount;
    }, 0);

    if (total <= 0 || !segments.length) {
      elPieEmpty.hidden = false;
      elPieBody.hidden = true;
      elPieSlices.innerHTML = "";
      elPieLegend.innerHTML = "";
      return;
    }

    elPieEmpty.hidden = true;
    elPieBody.hidden = false;

    var cx = 0;
    var cy = 0;
    var r = 100;
    var stroke = "#161d26";
    elPieSlices.innerHTML = "";

    if (segments.length === 1) {
      var circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circ.setAttribute("cx", String(cx));
      circ.setAttribute("cy", String(cy));
      circ.setAttribute("r", String(r));
      circ.setAttribute("fill", PIE_COLORS[0]);
      circ.setAttribute("stroke", stroke);
      circ.setAttribute("stroke-width", "2");
      elPieSlices.appendChild(circ);
    } else {
      var start = -Math.PI / 2;
      segments.forEach(function (seg, i) {
        var frac = seg.amount / total;
        var a0 = start;
        var a1 = start + frac * 2 * Math.PI;
        start = a1;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pieSlicePath(cx, cy, r, a0, a1));
        path.setAttribute("fill", PIE_COLORS[i % PIE_COLORS.length]);
        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linejoin", "round");
        elPieSlices.appendChild(path);
      });
    }

    elPieLegend.innerHTML = "";
    segments.forEach(function (seg, i) {
      var pct = total > 0 ? Math.round((seg.amount / total) * 1000) / 10 : 0;
      var li = document.createElement("li");
      li.className = "pie-legend-item";
      var dot = document.createElement("span");
      dot.className = "pie-legend-dot";
      dot.style.background = PIE_COLORS[i % PIE_COLORS.length];
      dot.setAttribute("aria-hidden", "true");
      var text = document.createElement("span");
      text.className = "pie-legend-text";
      text.innerHTML =
        '<span class="pie-legend-label"></span><span class="pie-legend-meta"></span>';
      text.querySelector(".pie-legend-label").textContent = seg.label;
      text.querySelector(".pie-legend-meta").textContent =
        formatMoneyVND(seg.amount) + " · " + pct + "%";
      li.appendChild(dot);
      li.appendChild(text);
      elPieLegend.appendChild(li);
    });

    if (elPieTitle) {
      var parts = segments.map(function (s) {
        return s.label + " " + Math.round((s.amount / total) * 100) + "%";
      });
      elPieTitle.textContent = "Chi tiêu theo danh mục: " + parts.join(", ");
    }
  }

  function renderSummary() {
    if (!state) return;
    var income = state.income;
    var spent = totalExpenses();
    var balance = income - spent;

    elSumIncome.textContent = formatMoneyVNDShort(income);
    elSumIncome.title = formatMoneyVND(income);
    elSumExpenses.textContent = formatMoneyVNDShort(spent);
    elSumExpenses.title = formatMoneyVND(spent);
    elSumBalance.textContent = formatMoneyVNDShort(balance);
    elSumBalance.title = formatMoneyVND(balance);

    var highlight = elSumBalance.closest(".summary-row-balance");
    if (highlight) {
      highlight.classList.toggle("negative", balance < 0);
    }
    renderBalanceForecast(balance, income);
  }

  function parseMonthKeyParts(key) {
    var m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(key || ""));
    if (!m) return null;
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
  }

  function calcRemainingDaysAndWeeks(monthKey) {
    var p = parseMonthKeyParts(monthKey);
    if (!p) return { days: 0, weeks: 0 };
    var monthStart = new Date(p.year, p.month - 1, 1);
    var monthEnd = new Date(p.year, p.month, 0);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (today > monthEnd) return { days: 0, weeks: 0 };
    var from = today < monthStart ? monthStart : today;
    var oneDayMs = 24 * 60 * 60 * 1000;
    var days = Math.floor((monthEnd.getTime() - from.getTime()) / oneDayMs) + 1;
    if (days < 0) days = 0;
    var weeks = days > 0 ? days / 7 : 0;
    return { days: days, weeks: weeks };
  }

  function calcMonthDaysAndWeeks(monthKey) {
    var p = parseMonthKeyParts(monthKey);
    if (!p) return { days: 0, weeks: 0 };
    var days = new Date(p.year, p.month, 0).getDate();
    var weeks = days > 0 ? days / 7 : 0;
    return { days: days, weeks: weeks };
  }

  function renderBalanceForecast(balance, income) {
    if (
      !elMonthForecastNote ||
      !elMonthForecastDay ||
      !elMonthForecastWeek ||
      !elBalanceForecastNote ||
      !elBalanceForecastDay ||
      !elBalanceForecastWeek
    ) {
      return;
    }
    var monthPeriod = calcMonthDaysAndWeeks(activeMonthKey);
    if (monthPeriod.days > 0) {
      var monthPerDay = income / monthPeriod.days;
      var monthPerWeek = monthPeriod.weeks > 0 ? income / monthPeriod.weeks : income;
      elMonthForecastNote.textContent =
        "Theo hạn mức ban đầu của tháng (" +
        formatMoneyVND(income) +
        ") trong " +
        monthPeriod.days +
        " ngày.";
      elMonthForecastDay.textContent = formatMoneyVND(Math.round(monthPerDay));
      elMonthForecastWeek.textContent = formatMoneyVND(Math.round(monthPerWeek));
    } else {
      elMonthForecastNote.textContent = "Không đọc được thông tin tháng hiện tại.";
      elMonthForecastDay.textContent = "-";
      elMonthForecastWeek.textContent = "-";
    }

    var period = calcRemainingDaysAndWeeks(activeMonthKey);
    if (period.days <= 0) {
      elBalanceForecastNote.textContent = "Tháng này không còn ngày nào để phân bổ.";
      elBalanceForecastDay.textContent = "-";
      elBalanceForecastWeek.textContent = "-";
      return;
    }
    var perDay = balance / period.days;
    var perWeek = period.weeks > 0 ? balance / period.weeks : balance;
    var roundWeeksForNote = Math.floor(period.weeks);
    if (period.weeks - roundWeeksForNote > 0.5) roundWeeksForNote += 1;
    elBalanceForecastNote.textContent =
      "Còn " + period.days + " ngày (~" + roundWeeksForNote + " tuần).";
    elBalanceForecastDay.textContent = formatMoneyVND(Math.round(perDay));
    elBalanceForecastWeek.textContent = formatMoneyVND(Math.round(perWeek));
  }

  function renderThemeModeOptions() {
    if (!elSettingsThemeOptions) return;
    var mode = normalizeThemeMode(app.settings && app.settings.themeMode);
    var buttons = elSettingsThemeOptions.querySelectorAll(".theme-mode-btn");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-theme-mode") === mode;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function renderBreakdown() {
    elBreakdown.innerHTML = "";
    if (!state) return;
    var byCat = totalsByCategory();
    app.categories.forEach(function (c) {
      var amt = byCat[c.id] || 0;
      if (amt === 0) return;
      var li = document.createElement("li");
      li.className = "breakdown-item";
      var icon = document.createElement("span");
      icon.className = "breakdown-icon";
      icon.textContent = iconIdToSym(c.iconId);
      icon.setAttribute("aria-hidden", "true");
      var mid = document.createElement("span");
      mid.className = "breakdown-mid";
      var lab = document.createElement("span");
      lab.className = "label";
      lab.textContent = c.label;
      mid.appendChild(lab);
      var am = document.createElement("span");
      am.className = "amount";
      am.textContent = formatMoneyVND(amt);
      li.appendChild(icon);
      li.appendChild(mid);
      li.appendChild(am);
      elBreakdown.appendChild(li);
    });
    if (!elBreakdown.children.length) {
      var empty = document.createElement("li");
      empty.className = "breakdown-item breakdown-empty";
      empty.textContent = "Chưa có chi theo danh mục.";
      elBreakdown.appendChild(empty);
    }
  }

  function iconTrashSvg() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon-svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-trash");
    svg.appendChild(use);
    return svg;
  }

  function iconPencilSvg() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon-svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-pencil");
    svg.appendChild(use);
    return svg;
  }

  function removeFixedTemplateById(templateId) {
    app.fixedTemplates = app.fixedTemplates.filter(function (x) {
      return x.id !== templateId;
    });
    saveAppData();
    renderFixedTemplatesList();
  }

  function renderFixedTemplatesInto(ul, showEdit) {
    if (!ul) return;
    ul.innerHTML = "";
    if (!Array.isArray(app.fixedTemplates) || !app.fixedTemplates.length) {
      var empty = document.createElement("li");
      empty.className = "fixed-template-row";
      empty.textContent = showEdit
        ? "Chưa có khoản cố định — thêm bên dưới hoặc đánh dấu khi thêm chi ở trang tháng."
        : "Chưa có khoản cố định — bật “Cố định hàng tháng” khi thêm hoặc vào Cài đặt.";
      empty.style.color = "var(--muted)";
      empty.style.fontSize = "0.8125rem";
      ul.appendChild(empty);
      return;
    }
    app.fixedTemplates.forEach(function (t) {
      var li = document.createElement("li");
      li.className = "fixed-template-row";

      var mid = document.createElement("div");
      mid.className = "fixed-template-row-mid";
      var title = document.createElement("span");
      title.className = "fixed-template-row-title";
      var catLabel = getCategoryLabel(t.category);
      title.textContent = t.name ? t.name + " · " + catLabel : catLabel;
      var sub = document.createElement("span");
      sub.className = "fixed-template-row-amt";
      sub.textContent = formatMoneyVND(t.amount);
      mid.appendChild(title);
      mid.appendChild(sub);

      var btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-icon btn-icon-danger";
      btnDel.setAttribute("aria-label", "Xóa khỏi khoản cố định");
      btnDel.appendChild(iconTrashSvg());
      btnDel.addEventListener("click", function () {
        if (
          !confirm(
            "Xóa khoản cố định này? Các tháng sau sẽ không tự thêm nữa. Dòng trong các tháng giữ nguyên — bạn có thể xóa tay trong danh sách chi."
          )
        ) {
          return;
        }
        removeFixedTemplateById(t.id);
      });

      if (showEdit) {
        var actions = document.createElement("div");
        actions.className = "fixed-template-row-actions";
        var btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn-icon btn-icon-muted";
        btnEdit.setAttribute("aria-label", "Sửa khoản cố định");
        btnEdit.appendChild(iconPencilSvg());
        btnEdit.addEventListener("click", function () {
          openEditFixedTemplateDialog(t.id);
        });
        actions.appendChild(btnEdit);
        actions.appendChild(btnDel);
        li.appendChild(mid);
        li.appendChild(actions);
      } else {
        li.appendChild(mid);
        li.appendChild(btnDel);
      }
      ul.appendChild(li);
    });
  }

  function renderFixedTemplatesList() {
    renderFixedTemplatesInto(elFixedTemplatesList, false);
    renderFixedTemplatesInto(elSettingsFixedList, true);
  }

  function renderExpenseList() {
    elExpenseList.innerHTML = "";
    if (!state) return;
    var rows = getVisibleExpenses();
    var hasRows = rows.length > 0;
    elEmpty.hidden = hasRows;
    if (!hasRows) {
      elEmpty.textContent =
        expenseListFilter === "all"
          ? "Chưa có khoản chi. Thêm ở trên."
          : "Không có khoản chi phù hợp bộ lọc.";
    }
    renderExpenseFilterButtons();

    rows.forEach(function (e) {
      var li = document.createElement("li");
      li.className = "expense-row";
      li.dataset.id = e.id;

      var ico = document.createElement("span");
      ico.className = "expense-cat-ico";
      ico.textContent = getCategoryIconSym(e.category);
      ico.title = getCategoryLabel(e.category);

      var mid = document.createElement("div");
      mid.className = "expense-row-mid";
      var wrap = document.createElement("div");
      wrap.className = "expense-row-line-wrap";
      if (e.templateId) {
        var badge = document.createElement("span");
        badge.className = "expense-badge-fixed";
        badge.textContent = "Cố định";
        badge.setAttribute("aria-hidden", "true");
        wrap.appendChild(badge);
      }
      var line = document.createElement("span");
      line.className = "expense-row-line";
      var namePart = e.name ? e.name : getCategoryLabel(e.category);
      line.textContent = namePart;
      line.title = getCategoryLabel(e.category) + (e.name ? " · " + e.name : "");
      wrap.appendChild(line);
      mid.appendChild(wrap);

      var amt = document.createElement("span");
      amt.className = "expense-row-amt";
      amt.textContent = formatMoneyVND(e.amount);

      var actions = document.createElement("div");
      actions.className = "expense-row-actions";

      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn-icon btn-icon-muted";
      btnEdit.setAttribute("aria-label", "Sửa số tiền");
      btnEdit.appendChild(iconPencilSvg());
      btnEdit.addEventListener("click", function () {
        openEditExpenseDialog(e.id);
      });

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-icon btn-icon-danger";
      btn.setAttribute("aria-label", "Xóa khoản chi");
      btn.appendChild(iconTrashSvg());
      btn.addEventListener("click", function () {
        removeExpense(e.id);
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btn);

      li.appendChild(ico);
      li.appendChild(mid);
      li.appendChild(amt);
      li.appendChild(actions);
      elExpenseList.appendChild(li);
    });

    var total = rows.reduce(function (sum, e) {
      return sum + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
    var totalLi = document.createElement("li");
    totalLi.className = "expense-total-row";
    totalLi.innerHTML =
      '<span class="expense-total-label">Tổng chi</span><span class="expense-total-amount"></span>';
    totalLi.querySelector(".expense-total-amount").textContent = formatMoneyVND(total);
    elExpenseList.appendChild(totalLi);
  }

  function isFixedExpenseRow(e) {
    return !!(e && e.templateId);
  }

  function expenseDisplayName(e) {
    if (!e) return "";
    if (typeof e.name === "string" && e.name.trim()) return e.name.trim();
    return getCategoryLabel(e.category);
  }

  function getVisibleExpenses() {
    if (!state || !Array.isArray(state.expenses)) return [];
    var rows = state.expenses.filter(function (e) {
      if (expenseListFilter === "fixed") return isFixedExpenseRow(e);
      if (expenseListFilter === "flex") return !isFixedExpenseRow(e);
      return true;
    });
    rows.sort(function (a, b) {
      var af = isFixedExpenseRow(a) ? 0 : 1;
      var bf = isFixedExpenseRow(b) ? 0 : 1;
      if (af !== bf) return af - bf;
      var cmp = expenseDisplayName(a).localeCompare(expenseDisplayName(b), "vi", {
        sensitivity: "base",
      });
      if (cmp !== 0) return cmp;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
    return rows;
  }

  function renderExpenseFilterButtons() {
    var map = [
      { key: "all", el: elExpenseFilterAll },
      { key: "fixed", el: elExpenseFilterFixed },
      { key: "flex", el: elExpenseFilterFlex },
    ];
    map.forEach(function (x) {
      if (!x.el) return;
      var active = expenseListFilter === x.key;
      x.el.classList.toggle("is-active", active);
      x.el.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setExpenseFilter(next) {
    if (next !== "all" && next !== "fixed" && next !== "flex") return;
    expenseListFilter = next;
    renderExpenseList();
  }

  function renderReportModeButtons() {
    var map = [
      { key: "breakdown", el: elReportModeBreakdown },
      { key: "pie", el: elReportModePie },
    ];
    map.forEach(function (x) {
      if (!x.el) return;
      var active = reportMode === x.key;
      x.el.classList.toggle("is-active", active);
      x.el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (elReportBreakdownView) elReportBreakdownView.hidden = reportMode !== "breakdown";
    if (elReportPieView) elReportPieView.hidden = reportMode !== "pie";
  }

  function setReportMode(next) {
    if (next !== "breakdown" && next !== "pie") return;
    reportMode = next;
    renderReportModeButtons();
  }

  function scrollAndHighlightExpenseRow(expenseId) {
    if (!expenseId || !elExpenseList) return;
    var row = elExpenseList.querySelector('.expense-row[data-id="' + expenseId + '"]');
    if (!row) return;
    row.classList.remove("expense-row-new-highlight");
    // Force reflow to restart animation if needed.
    void row.offsetWidth;
    row.classList.add("expense-row-new-highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setTimeout(function () {
      row.classList.remove("expense-row-new-highlight");
    }, 2000);
  }

  function persistAndRender() {
    if (!activeMonthKey || !state) return;
    saveAppData();
    renderSummary();
    renderBreakdown();
    renderExpenseList();
    renderPieChart();
    renderReportModeButtons();
    renderFixedTemplatesList();
    if (elSideMenu && !elSideMenu.hidden) {
      renderSideMenuList();
    }
    if (elViewSettings && !elViewSettings.hidden) {
      renderSettingsCategoriesList();
    }
  }

  function removeExpense(id) {
    if (!state) return;
    state.expenses = state.expenses.filter(function (e) {
      return e.id !== id;
    });
    persistAndRender();
  }

  function renderSideMenuList() {
    if (!elSideMenuList) return;
    elSideMenuList.innerHTML = "";
    allMenuMonthKeys().forEach(function (k) {
      var has = monthHasData(k);
      var m = app.months[k];
      var spent = m ? totalExpensesForMonth(m) : 0;
      var inc = m ? m.income || 0 : 0;
      var bal = inc - spent;

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "side-menu-item" + (k === activeMonthKey ? " is-active" : "");

      var cal = document.createElement("span");
      cal.className = "side-menu-item-ico";
      cal.setAttribute("aria-hidden", "true");
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "icon-svg icon-svg-muted");
      svg.setAttribute("width", "20");
      svg.setAttribute("height", "20");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#icon-calendar");
      svg.appendChild(use);
      cal.appendChild(svg);

      var txt = document.createElement("span");
      txt.className = "side-menu-item-text";
      var t1 = document.createElement("span");
      t1.className = "side-menu-item-title";
      t1.textContent = formatMonthKeyVi(k);
      var t2 = document.createElement("span");
      t2.className =
        "side-menu-item-status" + (has ? " has-data" : " no-data");
      if (has) {
        t2.textContent =
          "Hạn mức " +
          formatMoneyVND(inc) +
          " · Chi " +
          formatMoneyVND(spent) +
          " · Còn " +
          formatMoneyVND(bal);
      } else {
        t2.textContent = "Chưa có dữ liệu";
      }
      txt.appendChild(t1);
      txt.appendChild(t2);

      var arr = document.createElement("span");
      arr.className = "side-menu-item-chevron";
      arr.setAttribute("aria-hidden", "true");
      var svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg2.setAttribute("class", "icon-svg");
      svg2.setAttribute("width", "16");
      svg2.setAttribute("height", "16");
      var use2 = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use2.setAttribute("href", "#icon-chevron-right");
      svg2.appendChild(use2);
      arr.appendChild(svg2);

      btn.appendChild(cal);
      btn.appendChild(txt);
      btn.appendChild(arr);
      btn.addEventListener("click", function () {
        closeSideMenu(true);
        openMonth(k);
      });

      li.appendChild(btn);
      elSideMenuList.appendChild(li);
    });
  }

  function openSideMenu() {
    if (!elSideMenu) return;
    cancelLimitEdit();
    if (elMenuJumpMonth) elMenuJumpMonth.value = activeMonthKey || currentMonthKey();
    renderSideMenuList();
    elSideMenu.hidden = false;
    elSideMenu.setAttribute("aria-hidden", "false");
    document.body.classList.add("side-menu-open");
    if (elBtnOpenMenu) elBtnOpenMenu.setAttribute("aria-expanded", "true");
    setTimeout(function () {
      if (elBtnCloseMenu) elBtnCloseMenu.focus();
    }, 0);
  }

  function closeSideMenu(skipReturnFocus) {
    if (!elSideMenu) return;
    elSideMenu.hidden = true;
    elSideMenu.setAttribute("aria-hidden", "true");
    document.body.classList.remove("side-menu-open");
    if (elBtnOpenMenu) {
      elBtnOpenMenu.setAttribute("aria-expanded", "false");
      if (!skipReturnFocus) elBtnOpenMenu.focus();
    }
  }

  function setIncomeFieldFromState() {
    if (!state || !elIncome) return;
    incomeProgrammatic = true;
    incomeDirty = false;
    elIncome.value = formatAsNganDisplay(state.income);
    updateAmountPreview(elIncome, elIncomePreview);
    incomeProgrammatic = false;
  }

  function isLimitEditOpen() {
    return elLimitEditPanel && !elLimitEditPanel.hidden;
  }

  function closeLimitEditPanel() {
    if (!elLimitEditPanel || !elLimitViewMode) return;
    elLimitEditPanel.hidden = true;
    elLimitViewMode.hidden = false;
    if (elBtnLimitEdit) elBtnLimitEdit.setAttribute("aria-expanded", "false");
    if (elSummaryCard) elSummaryCard.classList.remove("summary-limit-editing");
  }

  function cancelLimitEdit() {
    incomeDirty = false;
    if (!isLimitEditOpen()) return;
    if (state && elIncome) setIncomeFieldFromState();
    closeLimitEditPanel();
  }

  function openLimitEdit() {
    if (!state || !elLimitEditPanel || !elLimitViewMode) return;
    if (isLimitEditOpen()) return;
    setIncomeFieldFromState();
    elLimitEditPanel.hidden = false;
    elLimitViewMode.hidden = true;
    if (elBtnLimitEdit) elBtnLimitEdit.setAttribute("aria-expanded", "true");
    if (elSummaryCard) elSummaryCard.classList.add("summary-limit-editing");
    setTimeout(function () {
      elIncome.focus();
      elIncome.select();
    }, 0);
  }

  function applyLimitEditAndClose(shouldRender) {
    if (!state || !elIncome || !isLimitEditOpen()) return;
    var v = parseMoneyToVND(elIncome.value);
    state.incomeUserSet = true;
    incomeDirty = false;
    state.income = v;
    setIncomeFieldFromState();
    closeLimitEditPanel();
    if (shouldRender) persistAndRender();
    else saveAppData();
  }

  function showMonthView() {
    if (elViewSettings) {
      elViewSettings.hidden = true;
      elViewSettings.setAttribute("aria-hidden", "true");
    }
    if (elViewMonth) {
      elViewMonth.hidden = false;
      elViewMonth.removeAttribute("aria-hidden");
    }
    document.body.classList.remove("settings-open");
  }

  function showSettingsView() {
    if (elViewMonth) {
      elViewMonth.hidden = true;
      elViewMonth.setAttribute("aria-hidden", "true");
    }
    if (elViewSettings) {
      elViewSettings.hidden = false;
      elViewSettings.removeAttribute("aria-hidden");
    }
    document.body.classList.add("settings-open");
  }

  function openSettings() {
    cancelLimitEdit();
    flushIncomeFromField();
    closeSideMenu(true);
    closeEditExpenseDialog();
    closeEditFixedTemplateDialog();
    closeEditCategoryDialog();
    if (elSettingsDefaultLimit) {
      elSettingsDefaultLimit.value = formatAsNganDisplay(getDefaultMonthlyLimit());
      updateAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
    }
    renderThemeModeOptions();
    renderFixedTemplatesList();
    renderSettingsCategoriesList();
    renderSettingsNewCategoryIconPicker();
    showSettingsView();
    setTimeout(function () {
      if (elBtnCloseSettings) elBtnCloseSettings.focus();
    }, 0);
  }

  function closeSettings() {
    showMonthView();
    if (activeMonthKey) {
      openMonth(activeMonthKey, { skipUrl: true });
    }
    if (elBtnOpenSettings) elBtnOpenSettings.focus();
  }

  function openMonth(key, opts) {
    opts = opts || {};
    cancelLimitEdit();
    flushIncomeFromField();
    ensureMonth(key);
    state = app.months[key];
    state.expenses = state.expenses.map(normalizeExpenseRow);
    if (!state.incomeUserSet) {
      state.income = getDefaultMonthlyLimit();
    }
    syncFixedIntoMonth(state);
    activeMonthKey = key;

    elMonthScreenTitle.textContent = formatMonthKeyVi(key);

    setIncomeFieldFromState();
    updateAmountPreview(elAmount, elExpensePreview);

    persistAndRender();

    if (!opts.fromPop && !opts.skipUrl) {
      syncUrlToMonth(key);
    }
  }

  function flushIncomeFromField() {
    if (!activeMonthKey || !state || !elIncome) return;
    if (!isLimitEditOpen()) return;
    applyLimitEditAndClose(false);
  }

  elIncome.addEventListener("input", function () {
    if (incomeProgrammatic || !state) return;
    incomeDirty = true;
  });

  elIncome.addEventListener("blur", function (ev) {
    if (!state) return;
    if (!isLimitEditOpen()) return;
    var rt = ev.relatedTarget;
    if (rt && elLimitEditPanel && elLimitEditPanel.contains(rt)) return;
    applyLimitEditAndClose(true);
  });

  elIncome.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      elIncome.blur();
    }
  });

  if (elBtnLimitEdit) elBtnLimitEdit.addEventListener("click", openLimitEdit);
  if (elBtnLimitDone) elBtnLimitDone.addEventListener("click", function () {
    applyLimitEditAndClose(true);
  });
  if (elBtnLimitCancel) elBtnLimitCancel.addEventListener("click", cancelLimitEdit);

  window.addEventListener("popstate", function () {
    showMonthView();
    cancelLimitEdit();
    closeEditFixedTemplateDialog();
    closeEditExpenseDialog();
    closeEditCategoryDialog();
    var key = readThangFromUrl();
    if (!key) {
      key = currentMonthKey();
      try {
        history.replaceState({ thang: key }, "", buildUrlWithThang(key));
      } catch (e) {}
    }
    openMonth(key, { fromPop: true, skipUrl: true });
  });

  window.addEventListener("pagehide", flushIncomeFromField);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushIncomeFromField();
  });

  elForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!state) return;
    var amount = parseMoneyToVND(elAmount.value);
    if (amount <= 0) {
      elAmount.focus();
      return;
    }
    var nameTrim = elName.value.trim();
    var cat = elCategory.value;
    var isFixed = elExpenseFixed && elExpenseFixed.checked;
    var templateId = null;
    if (isFixed) {
      templateId = "ft-" + uid();
      app.fixedTemplates.push({
        id: templateId,
        category: cat,
        name: nameTrim,
        amount: amount,
      });
    }
    var row = {
      id: uid(),
      category: cat,
      name: nameTrim,
      amount: amount,
    };
    if (templateId) row.templateId = templateId;
    state.expenses.push(row);
    elName.value = "";
    elAmount.value = "";
    updateAmountPreview(elAmount, elExpensePreview);
    if (elExpenseFixed) elExpenseFixed.checked = false;
    persistAndRender();
    scrollAndHighlightExpenseRow(row.id);
  });

  if (elBtnClear) {
    elBtnClear.addEventListener("click", function () {
      if (!state || !state.expenses.length) return;
      if (
        confirm(
          "Xóa hết các khoản chi của tháng này? Hạn mức tháng giữ nguyên. Các khoản cố định sẽ được thêm lại ngay."
        )
      ) {
        state.expenses = [];
        syncFixedIntoMonth(state);
        persistAndRender();
      }
    });
  }

  if (elExpenseFilterAll) {
    elExpenseFilterAll.addEventListener("click", function () {
      setExpenseFilter("all");
    });
  }
  if (elExpenseFilterFixed) {
    elExpenseFilterFixed.addEventListener("click", function () {
      setExpenseFilter("fixed");
    });
  }
  if (elExpenseFilterFlex) {
    elExpenseFilterFlex.addEventListener("click", function () {
      setExpenseFilter("flex");
    });
  }
  if (elReportModeBreakdown) {
    elReportModeBreakdown.addEventListener("click", function () {
      setReportMode("breakdown");
    });
  }
  if (elReportModePie) {
    elReportModePie.addEventListener("click", function () {
      setReportMode("pie");
    });
  }

  elBtnOpenMenu.addEventListener("click", openSideMenu);
  elBtnCloseMenu.addEventListener("click", closeSideMenu);
  elSideMenuBackdrop.addEventListener("click", closeSideMenu);

  elBtnOpenSettings.addEventListener("click", openSettings);
  elBtnCloseSettings.addEventListener("click", closeSettings);

  if (elSettingsDefaultLimit) {
    elSettingsDefaultLimit.addEventListener("blur", function () {
      app.settings.defaultLimit = parseMoneyToVND(elSettingsDefaultLimit.value);
      elSettingsDefaultLimit.value = formatAsNganDisplay(app.settings.defaultLimit);
      updateAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
      saveAppData();
    });
  }

  if (elSettingsThemeOptions) {
    elSettingsThemeOptions.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".theme-mode-btn") : null;
      if (!btn) return;
      var mode = normalizeThemeMode(btn.getAttribute("data-theme-mode"));
      if (mode === app.settings.themeMode) return;
      app.settings.themeMode = mode;
      applyThemeSettings();
      renderThemeModeOptions();
      saveAppData();
    });
  }

  if (elSettingsAddCategoryForm) {
    elSettingsAddCategoryForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var lab = elSettingsNewCategoryLabel ? elSettingsNewCategoryLabel.value.trim() : "";
      if (!lab) {
        if (elSettingsNewCategoryLabel) elSettingsNewCategoryLabel.focus();
        return;
      }
      if (lab.length > 40) lab = lab.slice(0, 40);
      var iconId = elSettingsNewCategoryIconSelect ? elSettingsNewCategoryIconSelect.value : "pin";
      app.categories.push(
        normalizeCategoryRow({ id: catUid(), label: lab, iconId: iconId })
      );
      saveAppData();
      if (elSettingsNewCategoryLabel) elSettingsNewCategoryLabel.value = "";
      renderSettingsCategoriesList();
      renderSettingsNewCategoryIconPicker();
      refreshAllCategorySelects();
      if (activeMonthKey && state) persistAndRender();
    });
  }
  if (elSettingsNewCategoryIconSelect) {
    elSettingsNewCategoryIconSelect.addEventListener("change", function () {
      var selected = ICON_PRESET_NAMES[elSettingsNewCategoryIconSelect.value] || "Biểu tượng";
      elSettingsNewCategoryIconSelect.title = "Biểu tượng: " + selected;
    });
  }

  if (elEditCategorySave) elEditCategorySave.addEventListener("click", saveEditCategoryDialog);
  if (elEditCategoryCancel) elEditCategoryCancel.addEventListener("click", closeEditCategoryDialog);
  if (elEditCategoryBackdrop) elEditCategoryBackdrop.addEventListener("click", closeEditCategoryDialog);
  if (elEditCategoryLabelInput) {
    elEditCategoryLabelInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        saveEditCategoryDialog();
      }
    });
  }

  elSettingsAddFixedForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var amount = parseMoneyToVND(elSettingsAddFixedAmount.value);
    if (amount <= 0) {
      elSettingsAddFixedAmount.focus();
      return;
    }
    var cat = elSettingsAddFixedCategory.value;
    if (!categoryIdExists(cat)) return;
    app.fixedTemplates.push({
      id: "ft-" + uid(),
      category: cat,
      name: elSettingsAddFixedName.value.trim(),
      amount: amount,
    });
    elSettingsAddFixedName.value = "";
    elSettingsAddFixedAmount.value = "";
    updateAmountPreview(elSettingsAddFixedAmount, elSettingsAddFixedAmountPreview);
    saveAppData();
    if (state) syncFixedIntoMonth(state);
    renderFixedTemplatesList();
    if (activeMonthKey && state) persistAndRender();
  });

  elEditFixedSave.addEventListener("click", saveEditFixedTemplateDialog);
  elEditFixedCancel.addEventListener("click", closeEditFixedTemplateDialog);
  elEditFixedBackdrop.addEventListener("click", closeEditFixedTemplateDialog);
  elEditFixedAmount.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      saveEditFixedTemplateDialog();
    }
  });

  function openEditExpenseDialog(expenseId) {
    if (!state || !elEditDialog) return;
    cancelLimitEdit();
    closeEditFixedTemplateDialog();
    closeEditCategoryDialog();
    var e = state.expenses.find(function (x) {
      return x.id === expenseId;
    });
    if (!e) return;
    editingExpenseId = expenseId;
    var cat = getCategoryLabel(e.category);
    var line = e.name ? e.name + " · " + cat : cat;
    elEditDesc.textContent = line;
    if (elEditExpenseCategory) elEditExpenseCategory.value = e.category;
    if (elEditExpenseName) elEditExpenseName.value = e.name || "";
    elEditAmount.value = formatAsNganDisplay(e.amount);
    updateAmountPreview(elEditAmount, elEditAmountPreview);
    if (elEditTemplateNote) {
      if (e.templateId) {
        elEditTemplateNote.hidden = false;
        elEditTemplateNote.removeAttribute("hidden");
      } else {
        elEditTemplateNote.hidden = true;
        elEditTemplateNote.setAttribute("hidden", "");
      }
    }
    elEditDialog.hidden = false;
    elEditDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(function () {
      elEditAmount.focus();
      elEditAmount.select();
    }, 0);
  }

  function closeEditExpenseDialog() {
    editingExpenseId = null;
    if (elEditDialog) {
      elEditDialog.hidden = true;
      elEditDialog.setAttribute("aria-hidden", "true");
    }
    if ((!elEditFixedDialog || elEditFixedDialog.hidden) && (!elEditCategoryDialog || elEditCategoryDialog.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  function closeEditFixedTemplateDialog() {
    editingFixedTemplateId = null;
    if (elEditFixedDialog) {
      elEditFixedDialog.hidden = true;
      elEditFixedDialog.setAttribute("aria-hidden", "true");
    }
    if ((!elEditDialog || elEditDialog.hidden) && (!elEditCategoryDialog || elEditCategoryDialog.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  function openEditFixedTemplateDialog(templateId) {
    closeEditCategoryDialog();
    var t = findFixedTemplate(templateId);
    if (!t || !elEditFixedDialog) return;
    editingFixedTemplateId = templateId;
    if (elEditFixedTitle) elEditFixedTitle.textContent = "Sửa khoản cố định";
    elEditFixedCategory.value = t.category;
    elEditFixedName.value = t.name || "";
    elEditFixedAmount.value = formatAsNganDisplay(t.amount);
    updateAmountPreview(elEditFixedAmount, elEditFixedAmountPreview);
    elEditFixedDialog.hidden = false;
    elEditFixedDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(function () {
      elEditFixedAmount.focus();
      elEditFixedAmount.select();
    }, 0);
  }

  function saveEditFixedTemplateDialog() {
    if (!editingFixedTemplateId) return;
    var t = findFixedTemplate(editingFixedTemplateId);
    if (!t) {
      closeEditFixedTemplateDialog();
      return;
    }
    var cat = elEditFixedCategory.value;
    if (!categoryIdExists(cat)) return;
    var amount = parseMoneyToVND(elEditFixedAmount.value);
    if (amount <= 0) {
      elEditFixedAmount.focus();
      return;
    }
    t.category = cat;
    t.name = elEditFixedName.value.trim();
    t.amount = amount;
    syncExpenseRowsFromTemplate(t);
    saveAppData();
    closeEditFixedTemplateDialog();
    renderFixedTemplatesList();
    if (activeMonthKey && state) persistAndRender();
  }

  function saveEditExpenseDialog() {
    if (!state || !editingExpenseId) return;
    var e = state.expenses.find(function (x) {
      return x.id === editingExpenseId;
    });
    if (!e) {
      closeEditExpenseDialog();
      return;
    }
    var cat = elEditExpenseCategory ? elEditExpenseCategory.value : e.category;
    if (!categoryIdExists(cat)) return;
    var nameTrim = elEditExpenseName ? elEditExpenseName.value.trim() : "";
    var amount = parseMoneyToVND(elEditAmount.value);
    if (amount <= 0) {
      elEditAmount.focus();
      return;
    }
    e.category = cat;
    e.name = nameTrim;
    e.amount = amount;
    if (e.templateId) {
      var t = findFixedTemplate(e.templateId);
      if (t) {
        t.category = cat;
        t.name = nameTrim;
        t.amount = amount;
      }
    }
    closeEditExpenseDialog();
    persistAndRender();
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      if (isLimitEditOpen()) {
        ev.preventDefault();
        cancelLimitEdit();
        return;
      }
      if (elEditCategoryDialog && !elEditCategoryDialog.hidden) {
        ev.preventDefault();
        closeEditCategoryDialog();
        return;
      }
      if (elEditFixedDialog && !elEditFixedDialog.hidden) {
        ev.preventDefault();
        closeEditFixedTemplateDialog();
        return;
      }
      if (elViewSettings && !elViewSettings.hidden) {
        ev.preventDefault();
        closeSettings();
        return;
      }
      if (elEditDialog && !elEditDialog.hidden) {
        ev.preventDefault();
        closeEditExpenseDialog();
        return;
      }
      if (elSideMenu && !elSideMenu.hidden) {
        closeSideMenu();
      }
    }
  });

  function closeInfoPopups(exceptDetails) {
    var opened = document.querySelectorAll(
      "details.inline-info-hint[open], details.summary-forecast-info[open]"
    );
    var i;
    for (i = 0; i < opened.length; i++) {
      if (exceptDetails && opened[i] === exceptDetails) continue;
      opened[i].removeAttribute("open");
    }
  }

  document.addEventListener("click", function (ev) {
    var keepOpen =
      ev.target && ev.target.closest
        ? ev.target.closest("details.inline-info-hint, details.summary-forecast-info")
        : null;
    if (!keepOpen) closeInfoPopups(null);
  });

  elMenuJumpBtn.addEventListener("click", function () {
    var v = elMenuJumpMonth && elMenuJumpMonth.value;
    if (!v || v.length < 7) return;
    closeSideMenu(true);
    openMonth(v);
  });

  elEditSave.addEventListener("click", saveEditExpenseDialog);
  elEditCancel.addEventListener("click", closeEditExpenseDialog);
  elEditBackdrop.addEventListener("click", closeEditExpenseDialog);
  elEditAmount.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      saveEditExpenseDialog();
    }
  });

  fillCategorySelect(elCategory);
  fillCategorySelect(elSettingsAddFixedCategory);
  fillCategorySelect(elEditFixedCategory);
  fillCategorySelect(elEditExpenseCategory);
  bindAmountPreview(elIncome, elIncomePreview);
  bindAmountPreview(elAmount, elExpensePreview);
  bindAmountPreview(elEditAmount, elEditAmountPreview);
  bindAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
  bindAmountPreview(elSettingsAddFixedAmount, elSettingsAddFixedAmountPreview);
  bindAmountPreview(elEditFixedAmount, elEditFixedAmountPreview);

  if (hasInvalidThangParam()) {
    try {
      history.replaceState({}, "", buildUrlWithoutThang());
    } catch (e3) {}
  }

  var initialKey = readThangFromUrl() || currentMonthKey();
  if (readThangFromUrl() !== initialKey) {
    try {
      history.replaceState({ thang: initialKey }, "", buildUrlWithThang(initialKey));
    } catch (e4) {}
  }

  openMonth(initialKey, { skipUrl: true });
})();
