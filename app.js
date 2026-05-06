(function () {
  "use strict";

  var STORAGE_V1 = "family-budget-v1";
  var STORAGE_V2 = "family-budget-v2";
  var MENU_MONTH_SPAN = 60;
  var SUPABASE_URL =
    window.SUPABASE_URL || "https://sfngotvwotmlqelkjzpr.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY =
    window.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_e6LA2cOnFrWPLXn_Oc1pdw_hHFAWPLx";
  var SUPABASE_TABLE = "family_budget_states";
  var SUPABASE_STATE_ID = "shared-default";

  /** Các biểu tượng có sẵn khi tạo / sửa danh mục */
  var ICON_PRESETS = [
    { id: "food", sym: "🍜" },
    { id: "receipt", sym: "🧾" },
    { id: "shield", sym: "🛡️" },
    { id: "cart", sym: "🛒" },
    { id: "car", sym: "🚗" },
    { id: "baby", sym: "👶" },
    { id: "home", sym: "🏠" },
    { id: "pill", sym: "💊" },
    { id: "bolt", sym: "⚡" },
    { id: "money", sym: "💰" },
    { id: "tuition", sym: "🎓" },
    { id: "entertainment", sym: "🎬" },
    { id: "travel", sym: "✈️" },
    { id: "fashion", sym: "👔" },
    { id: "gift", sym: "🎁" },
    { id: "pet", sym: "🐕" },
    { id: "fitness", sym: "🏋️" },
    { id: "book", sym: "📚" },
    { id: "pin", sym: "📌" },
  ];
  var ICON_PRESET_NAMES = {
    food: "Ăn uống",
    receipt: "Hóa đơn",
    shield: "Bảo hiểm",
    cart: "Siêu thị",
    car: "Đi lại",
    baby: "Baby",
    home: "Nhà cửa",
    pill: "Sức khỏe",
    bolt: "Điện nước",
    money: "Tài chính",
    tuition: "Học phí",
    entertainment: "Giải trí",
    travel: "Du lịch",
    fashion: "Thời trang",
    gift: "Quà tặng",
    pet: "Vật nuôi",
    fitness: "Thể thao / gym",
    book: "Sách",
    pin: "Khác",
  };

  /** Hũ ảo trên màn tháng: danh mục chưa gắn hũ nào */
  var CONSOLIDATED_JAR_ID = "__consolidated";
  var CONSOLIDATED_JAR_LABEL = "Tổng hợp";
  var CONSOLIDATED_JAR_COLOR = "#7d8fa3";

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

  function normalizeHexColor(raw) {
    var s = typeof raw === "string" ? raw.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return (
        "#" +
        s[1] +
        s[1] +
        s[2] +
        s[2] +
        s[3] +
        s[3]
      ).toLowerCase();
    }
    return "#e8a598";
  }

  function normalizeSpendingJarRow(j) {
    var row = j && typeof j === "object" ? j : {};
    var ids = Array.isArray(row.categoryIds)
      ? row.categoryIds.filter(function (id) {
          return typeof id === "string" && id;
        })
      : [];
    var lim = row.limitAmount;
    var limitAmount =
      typeof lim === "number" && !isNaN(lim) ? Math.max(0, Math.round(lim)) : 0;
    var label = typeof row.label === "string" ? row.label.trim().slice(0, 40) : "";
    if (!label) label = "Hũ";
    var jid = typeof row.id === "string" && row.id ? row.id : "jar-" + uid();
    var uAt =
      typeof row.updatedAt === "number" && row.updatedAt > 0
        ? Math.round(row.updatedAt)
        : Date.now();
    return {
      id: jid,
      label: label,
      color: normalizeHexColor(row.color),
      limitAmount: limitAmount,
      categoryIds: ids,
      updatedAt: uAt,
    };
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

  function formatMoneyCompact(n) {
    if (typeof n !== "number" || isNaN(n)) n = 0;
    var sign = "";
    if (n < 0) {
      sign = "-";
      n = Math.abs(n);
    }
    n = Math.round(n);
    if (n < 1000) return sign + n;
    if (n < 1e6) return sign + formatShortDecimal(n / 1000) + "k";
    if (n < 1e9) return sign + formatShortDecimal(n / 1e6) + "tr";
    return sign + formatShortDecimal(n / 1e9) + "tỷ";
  }

  function formatMoneyListShort(n) {
    if (typeof n !== "number" || isNaN(n)) n = 0;
    var sign = "";
    if (n < 0) {
      sign = "-";
      n = Math.abs(n);
    }
    n = Math.round(n);
    if (n < 1000) return sign + n;
    if (n < 1e6) return sign + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    if (n < 1e9) return sign + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "tr";
    return sign + (n / 1e9).toFixed(1).replace(/\.0$/, "") + "tỷ";
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
    mint: {
      appBg: "#eef8f3",
      appText: "#1f2c25",
      bgElevated: "#ffffff",
      surface: "#ffffff",
      surface2: "#e8f4ed",
      surfacePress: "#deede4",
      border: "rgba(35, 68, 52, 0.12)",
      borderStrong: "rgba(35, 68, 52, 0.2)",
      muted: "#5c7265",
      muted2: "#7a9084",
      accent: "#4fab7f",
      accentSoft: "rgba(79, 171, 127, 0.14)",
      accentText: "#2f7f5d",
      accentPress: "#43996f",
      danger: "#c86f6a",
      dangerSoft: "rgba(200, 111, 106, 0.12)",
    },
    purple: {
      appBg: "#23171f",
      appText: "#f9edf2",
      bgElevated: "#2d1d27",
      surface: "#35222e",
      surface2: "#402834",
      surfacePress: "#4e3241",
      border: "rgba(238, 182, 203, 0.16)",
      borderStrong: "rgba(238, 182, 203, 0.24)",
      muted: "#ba9ba8",
      muted2: "#987b87",
      accent: "#e184ac",
      accentSoft: "rgba(225, 132, 172, 0.16)",
      accentText: "#f1b2cb",
      accentPress: "#c76f95",
      danger: "#e0918f",
      dangerSoft: "rgba(224, 145, 143, 0.14)",
    },
    "pink-pastel": {
      appBg: "#fff2f8",
      appText: "#2d2430",
      bgElevated: "#ffffff",
      surface: "#ffffff",
      surface2: "#fdebf4",
      surfacePress: "#f7e0ec",
      border: "rgba(99, 53, 82, 0.13)",
      borderStrong: "rgba(99, 53, 82, 0.21)",
      muted: "#756274",
      muted2: "#957e93",
      accent: "#ce78a4",
      accentSoft: "rgba(206, 120, 164, 0.14)",
      accentText: "#a85d84",
      accentPress: "#b7648f",
      danger: "#cc7478",
      dangerSoft: "rgba(204, 116, 120, 0.12)",
    },
    gray: {
      appBg: "#e6e6e8",
      appText: "#25272b",
      bgElevated: "#ffffff",
      surface: "#ffffff",
      surface2: "#e0e0e3",
      surfacePress: "#d4d5da",
      border: "rgba(37, 39, 43, 0.13)",
      borderStrong: "rgba(37, 39, 43, 0.22)",
      muted: "#60636b",
      muted2: "#7d8088",
      accent: "#6d7684",
      accentSoft: "rgba(109, 118, 132, 0.14)",
      accentText: "#4f5764",
      accentPress: "#5f6774",
      danger: "#b06e72",
      dangerSoft: "rgba(176, 110, 114, 0.12)",
    },
  };

  function normalizeThemeMode(v) {
    var key = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (key === "green") key = "mint";
    if (key === "pink") key = "purple";
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

  function normalizeAppDataShape(d) {
    var src = d && typeof d === "object" ? d : {};
    var months = src.months && typeof src.months === "object" ? src.months : {};
    var fixedTemplates;
    if (Array.isArray(src.fixedTemplates)) {
      fixedTemplates = src.fixedTemplates.map(normalizeFixedTemplateRow);
    } else if (src.fixedTemplates === undefined) {
      fixedTemplates = defaultFixedTemplates();
    } else {
      fixedTemplates = [];
    }
    var settings = normalizeSettings(src.settings);
    var categories;
    if (Array.isArray(src.categories) && src.categories.length > 0) {
      categories = src.categories;
    } else {
      categories = defaultCategories();
    }
    var spendingJarsSrc = Array.isArray(src.spendingJars) ? src.spendingJars : [];
    var spendingJars = spendingJarsSrc.map(normalizeSpendingJarRow);
    return {
      months: months,
      fixedTemplates: fixedTemplates,
      settings: settings,
      categories: categories,
      spendingJars: spendingJars,
    };
  }

  function normalizeFixedTemplateRow(t) {
    var row = t && typeof t === "object" ? t : {};
    var cat = typeof row.category === "string" ? row.category : "cat-an-uong";
    var out = {
      id: row.id || "ft-" + uid(),
      category: cat,
      name: typeof row.name === "string" ? row.name.trim() : "",
      amount:
        typeof row.amount === "number" && row.amount >= 0 ? Math.round(row.amount) : 0,
      updatedAt: fixedTemplateUpdatedAt(row) || nowTs(),
    };
    if (typeof row.deletedAt === "number" && row.deletedAt > 0) {
      out.deletedAt = Math.round(row.deletedAt);
    }
    return out;
  }

  function loadAppData() {
    try {
      var raw = localStorage.getItem(STORAGE_V2);
      if (raw) {
        return normalizeAppDataShape(JSON.parse(raw));
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
              spendingJars: [],
            })
          );
        } catch (e3) {}
      }
    } catch (e2) {}
    return normalizeAppDataShape({
      months: months,
      fixedTemplates: defaultFixedTemplates(),
      settings: defaultSettings(),
      categories: defaultCategories(),
      spendingJars: [],
    });
  }

  var supabaseClient = null;
  var supabaseChannel = null;
  var supabaseEnabled = false;
  var supabaseUserEmail = "";
  var supabaseInitialMonthKey = "";
  var lastSyncedPayload = "";
  var isApplyingCloudSnapshot = false;
  var cloudSyncTimer = null;
  var authStateListenerBound = false;

  function setAuthSyncHint(text, kind) {
    var el = document.getElementById("auth-sync-hint");
    if (!el) return;
    if (!text) {
      el.textContent = "";
      el.hidden = true;
      el.classList.remove("is-error", "is-ok");
      return;
    }
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-ok", kind === "ok");
  }

  function nowTs() {
    return Date.now();
  }

  function expenseUpdatedAt(e) {
    if (!e || typeof e !== "object") return 0;
    var v = typeof e.updatedAt === "number" ? e.updatedAt : 0;
    if (v > 0) return v;
    return expenseCreatedAt(e);
  }

  function fixedTemplateUpdatedAt(t) {
    if (!t || typeof t !== "object") return 0;
    var v = typeof t.updatedAt === "number" ? t.updatedAt : 0;
    if (v > 0) return v;
    var id = typeof t.id === "string" ? t.id : "";
    var m = /^ft-e-([0-9a-z]+)-/.exec(id) || /^ft-([0-9a-z]+)-/.exec(id);
    if (!m) return 0;
    var n = parseInt(m[1], 36);
    return isNaN(n) ? 0 : n;
  }

  function jarUpdatedAt(j) {
    if (!j || typeof j !== "object") return 0;
    var v = typeof j.updatedAt === "number" ? j.updatedAt : 0;
    return v > 0 ? v : 0;
  }

  function isRowDeleted(row) {
    return !!(row && typeof row.deletedAt === "number" && row.deletedAt > 0);
  }

  function isMonthDeleted(m) {
    return !!(m && typeof m.deletedAt === "number" && m.deletedAt > 0);
  }

  function getAppPayload() {
    return {
      months: app.months,
      fixedTemplates: app.fixedTemplates,
      settings: app.settings,
      categories: app.categories,
      spendingJars: app.spendingJars,
    };
  }

  function mergeRowsById(remoteRows, localRows, getId, getUpdated) {
    var map = {};
    var out = [];
    function put(row) {
      if (!row || typeof row !== "object") return;
      var id = getId(row);
      if (!id) return;
      var prev = map[id];
      if (!prev) {
        map[id] = row;
        out.push(row);
        return;
      }
      if (getUpdated(row) >= getUpdated(prev)) {
        map[id] = row;
        var idx = out.indexOf(prev);
        if (idx >= 0) out[idx] = row;
      }
    }
    (Array.isArray(remoteRows) ? remoteRows : []).forEach(put);
    (Array.isArray(localRows) ? localRows : []).forEach(put);
    return out;
  }

  function mergePayloadForCloud(remotePayload, localPayload) {
    var remote = normalizeAppDataShape(remotePayload || {});
    var local = normalizeAppDataShape(localPayload || {});
    var merged = {
      months: {},
      fixedTemplates: mergeRowsById(
        remote.fixedTemplates,
        local.fixedTemplates,
        function (t) {
          return t && t.id;
        },
        fixedTemplateUpdatedAt
      ),
      settings: local.settings,
      categories: local.categories,
      spendingJars: mergeRowsById(
        remote.spendingJars || [],
        local.spendingJars || [],
        function (j) {
          return j && j.id;
        },
        jarUpdatedAt
      ).map(normalizeSpendingJarRow),
    };
    var monthKeys = {};
    Object.keys(remote.months || {}).forEach(function (k) {
      monthKeys[k] = true;
    });
    Object.keys(local.months || {}).forEach(function (k) {
      monthKeys[k] = true;
    });
    Object.keys(monthKeys).forEach(function (k) {
      var rm = remote.months[k] || {};
      var lm = local.months[k] || {};
      var rmDeletedAt = typeof rm.deletedAt === "number" ? rm.deletedAt : 0;
      var lmDeletedAt = typeof lm.deletedAt === "number" ? lm.deletedAt : 0;
      if (rmDeletedAt > 0 || lmDeletedAt > 0) {
        if (rmDeletedAt >= lmDeletedAt) {
          merged.months[k] = { deletedAt: rmDeletedAt };
        } else {
          merged.months[k] = { deletedAt: lmDeletedAt };
        }
        return;
      }
      merged.months[k] = {
        income:
          typeof lm.income === "number"
            ? lm.income
            : typeof rm.income === "number"
            ? rm.income
            : 0,
        incomeUserSet:
          lm.incomeUserSet !== undefined
            ? !!lm.incomeUserSet
            : rm.incomeUserSet !== undefined
            ? !!rm.incomeUserSet
            : false,
        expenses: mergeRowsById(
          rm.expenses || [],
          lm.expenses || [],
          function (e) {
            return e && e.id;
          },
          expenseUpdatedAt
        ).map(normalizeExpenseRow),
      };
    });
    return merged;
  }

  function saveAppDataToLocal() {
    try {
      localStorage.setItem(STORAGE_V2, JSON.stringify(getAppPayload()));
    } catch (e) {}
  }

  async function syncToSupabaseNow() {
    if (!supabaseEnabled || !supabaseClient || isApplyingCloudSnapshot) return;
    var payload = getAppPayload();
    var payloadJson = "";
    try {
      payloadJson = JSON.stringify(payload);
    } catch (e) {
      return;
    }
    if (payloadJson === lastSyncedPayload) return;
    var mergedPayload = payload;
    try {
      var remoteRes = await supabaseClient
        .from(SUPABASE_TABLE)
        .select("payload")
        .eq("id", SUPABASE_STATE_ID)
        .maybeSingle();
      if (!remoteRes.error && remoteRes.data && remoteRes.data.payload) {
        mergedPayload = mergePayloadForCloud(remoteRes.data.payload, payload);
      }
    } catch (eRemote) {}
    var res = await supabaseClient.from(SUPABASE_TABLE).upsert(
      {
        id: SUPABASE_STATE_ID,
        payload: mergedPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (!res.error) {
      try {
        lastSyncedPayload = JSON.stringify(mergedPayload);
      } catch (e2) {
        lastSyncedPayload = payloadJson;
      }
      setAuthSyncHint("Đã lưu lên cloud.", "ok");
    } else {
      console.warn("Supabase sync failed:", res.error.message);
      setAuthSyncHint("Không ghi được cloud: " + res.error.message, "error");
    }
  }

  function queueSupabaseSync() {
    if (!supabaseEnabled || isApplyingCloudSnapshot) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(function () {
      cloudSyncTimer = null;
      syncToSupabaseNow();
    }, 350);
  }

  function saveAppData() {
    saveAppDataToLocal();
    queueSupabaseSync();
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
        if (isRowDeleted(e)) return;
        add(e.category);
      });
    });
    (app.fixedTemplates || []).forEach(function (t) {
      if (isRowDeleted(t)) return;
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
  ensureSpendingJarsNormalized();

  function normalizeAllFixedTemplates() {
    if (!Array.isArray(app.fixedTemplates)) {
      app.fixedTemplates = defaultFixedTemplates();
      return;
    }
    app.fixedTemplates = app.fixedTemplates.map(function (t) {
      var row = normalizeFixedTemplateRow(t);
      if (!categoryIdExists(row.category)) row.category = getFirstCategoryId();
      return row;
    });
  }

  normalizeAllFixedTemplates();

  function applyNormalizedAppData(nextData) {
    app.months = nextData.months;
    app.fixedTemplates = nextData.fixedTemplates;
    app.settings = normalizeSettings(nextData.settings);
    app.categories = nextData.categories;
    migrateAllMonthsIncomeUserSet();
    ensureAppCategories();
    app.spendingJars = Array.isArray(nextData.spendingJars)
      ? nextData.spendingJars.map(normalizeSpendingJarRow)
      : [];
    ensureSpendingJarsNormalized();
    normalizeAllFixedTemplates();
  }

  async function pullSupabaseStateAndRender() {
    if (!supabaseClient || !supabaseEnabled) return;
    try {
      var fetchRes = await supabaseClient
        .from(SUPABASE_TABLE)
        .select("payload")
        .eq("id", SUPABASE_STATE_ID)
        .maybeSingle();
      if (fetchRes.error) {
        console.warn("Supabase load failed:", fetchRes.error.message);
        setAuthSyncHint("Không đọc được cloud: " + fetchRes.error.message, "error");
        return;
      }
      if (fetchRes.data && fetchRes.data.payload) {
        isApplyingCloudSnapshot = true;
        try {
          applyNormalizedAppData(normalizeAppDataShape(fetchRes.data.payload));
          saveAppDataToLocal();
          applyThemeSettings();
          refreshAllCategorySelects();
          openMonth(activeMonthKey || supabaseInitialMonthKey || currentMonthKey(), {
            skipUrl: true,
          });
          lastSyncedPayload = JSON.stringify(getAppPayload());
          setAuthSyncHint("Đã tải dữ liệu từ cloud.", "ok");
        } finally {
          isApplyingCloudSnapshot = false;
        }
      } else {
        setAuthSyncHint("Cloud chưa có bản ghi — đang đẩy dữ liệu local lên...", "ok");
        await syncToSupabaseNow();
      }
    } catch (e) {
      console.warn("Supabase load exception:", e);
      setAuthSyncHint("Lỗi khi tải cloud. Mở Console (F12) để xem chi tiết.", "error");
    }
  }

  async function manualCloudSync() {
    if (!createSupabaseClientIfNeeded() || !supabaseEnabled) {
      setAuthSyncHint("Đăng nhập trước để đồng bộ.", "error");
      return;
    }
    if (elBtnCloudSync) {
      elBtnCloudSync.disabled = true;
      elBtnCloudSync.classList.add("is-syncing");
    }
    setAuthSyncHint("Đang gộp dữ liệu máy + cloud và lưu...", "ok");
    try {
      var fetchRes = await supabaseClient
        .from(SUPABASE_TABLE)
        .select("payload")
        .eq("id", SUPABASE_STATE_ID)
        .maybeSingle();
      if (fetchRes.error) {
        setAuthSyncHint("Không đọc cloud: " + fetchRes.error.message, "error");
        return;
      }
      var localPayload = getAppPayload();
      var merged;
      if (fetchRes.data && fetchRes.data.payload) {
        merged = mergePayloadForCloud(fetchRes.data.payload, localPayload);
      } else {
        merged = normalizeAppDataShape(localPayload);
      }
      isApplyingCloudSnapshot = true;
      try {
        applyNormalizedAppData(merged);
        saveAppDataToLocal();
        applyThemeSettings();
        refreshAllCategorySelects();
        openMonth(activeMonthKey || supabaseInitialMonthKey || currentMonthKey(), {
          skipUrl: true,
        });
      } finally {
        isApplyingCloudSnapshot = false;
      }
      lastSyncedPayload = "";
      await syncToSupabaseNow();
      setAuthSyncHint("Đã đồng bộ hai chiều (gộp + lưu cloud).", "ok");
    } catch (e) {
      console.warn("manualCloudSync:", e);
      setAuthSyncHint("Đồng bộ thất bại.", "error");
    } finally {
      if (elBtnCloudSync) {
        elBtnCloudSync.classList.remove("is-syncing");
        elBtnCloudSync.disabled = !supabaseEnabled;
      }
    }
  }

  function detachSupabaseChannel() {
    if (!supabaseClient || !supabaseChannel) return;
    supabaseClient.removeChannel(supabaseChannel);
    supabaseChannel = null;
  }

  function attachSupabaseRealtime() {
    if (!supabaseClient || !supabaseEnabled) return;
    detachSupabaseChannel();
    supabaseChannel = supabaseClient
      .channel("family-budget-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SUPABASE_TABLE,
          filter: "id=eq." + SUPABASE_STATE_ID,
        },
        function (payload) {
          if (!payload || !payload.new || !payload.new.payload) return;
          var cloudData = normalizeAppDataShape(payload.new.payload);
          var cloudJson;
          try {
            cloudJson = JSON.stringify(cloudData);
          } catch (e) {
            return;
          }
          if (cloudJson === lastSyncedPayload) return;
          isApplyingCloudSnapshot = true;
          try {
            applyNormalizedAppData(cloudData);
            saveAppDataToLocal();
            applyThemeSettings();
            refreshAllCategorySelects();
            openMonth(activeMonthKey || supabaseInitialMonthKey || currentMonthKey(), {
              skipUrl: true,
            });
            lastSyncedPayload = cloudJson;
          } finally {
            isApplyingCloudSnapshot = false;
          }
        }
      )
      .subscribe();
  }

  async function enableSupabaseSyncBySession(session) {
    if (!session || !session.user) return;
    supabaseEnabled = true;
    supabaseUserEmail = session.user.email || "";
    await pullSupabaseStateAndRender();
    attachSupabaseRealtime();
    await syncToSupabaseNow();
    renderAuthUi();
  }

  async function disableSupabaseSync() {
    supabaseEnabled = false;
    supabaseUserEmail = "";
    lastSyncedPayload = "";
    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    detachSupabaseChannel();
    setAuthSyncHint("", "");
    renderAuthUi();
  }

  function createSupabaseClientIfNeeded() {
    if (supabaseClient) return supabaseClient;
    if (
      !SUPABASE_URL ||
      !SUPABASE_PUBLISHABLE_KEY ||
      !window.supabase ||
      !window.supabase.createClient
    ) {
      return null;
    }
    if (
      typeof SUPABASE_PUBLISHABLE_KEY === "string" &&
      SUPABASE_PUBLISHABLE_KEY.length > 0 &&
      SUPABASE_PUBLISHABLE_KEY.indexOf("eyJ") !== 0
    ) {
      console.warn(
        "Supabase: key trong app nên là anon public JWT (bắt đầu eyJ...) từ Project Settings → API. Key dạng sb_publishable_... có thể không dùng được cho PostgREST."
      );
    }
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });
      return supabaseClient;
    } catch (e) {
      console.warn("Supabase init failed:", e);
      return null;
    }
  }

  function bindSupabaseAuthListener() {
    if (!supabaseClient || authStateListenerBound) return;
    authStateListenerBound = true;
    supabaseClient.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        void disableSupabaseSync();
        return;
      }
      if (event === "SIGNED_IN" && session) {
        void enableSupabaseSyncBySession(session);
      }
    });
  }

  async function initSupabaseSync(initialMonthKey) {
    supabaseInitialMonthKey = initialMonthKey || currentMonthKey();
    if (!createSupabaseClientIfNeeded()) {
      return;
    }
    bindSupabaseAuthListener();
    try {
      var auth = await supabaseClient.auth.getSession();
      if (auth && auth.data && auth.data.session) {
        await enableSupabaseSyncBySession(auth.data.session);
      }
    } catch (e2) {
      console.warn("Supabase session load failed:", e2);
    }
  }

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

  function dedupeJarCategoriesExclusive() {
    if (!Array.isArray(app.spendingJars)) return;
    var claimed = {};
    app.spendingJars.forEach(function (j) {
      var next = [];
      (j.categoryIds || []).forEach(function (id) {
        if (!categoryIdExists(id)) return;
        if (claimed[id]) return;
        claimed[id] = true;
        next.push(id);
      });
      if (next.length !== (j.categoryIds || []).length) {
        j.categoryIds = next;
        j.updatedAt = nowTs();
      }
    });
  }

  function ensureSpendingJarsNormalized() {
    if (!Array.isArray(app.spendingJars)) app.spendingJars = [];
    app.spendingJars = app.spendingJars.map(normalizeSpendingJarRow);
    app.spendingJars.forEach(function (j) {
      j.categoryIds = (j.categoryIds || []).filter(categoryIdExists);
    });
    dedupeJarCategoriesExclusive();
  }

  function reserveCategoriesForJar(jarId, catIds) {
    var set = {};
    catIds.forEach(function (id) {
      if (categoryIdExists(id)) set[id] = true;
    });
    app.spendingJars.forEach(function (j) {
      if (j.id === jarId) return;
      var prev = (j.categoryIds || []).slice();
      var next = prev.filter(function (id) {
        return !set[id];
      });
      if (next.length !== prev.length) {
        j.categoryIds = next;
        j.updatedAt = nowTs();
      }
    });
  }

  function findSpendingJar(jarId) {
    if (!jarId || !Array.isArray(app.spendingJars)) return null;
    var i;
    for (i = 0; i < app.spendingJars.length; i++) {
      if (app.spendingJars[i].id === jarId) return app.spendingJars[i];
    }
    return null;
  }

  function remapCategoryInJars(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    app.spendingJars.forEach(function (j) {
      var seen = {};
      var next = [];
      (j.categoryIds || []).forEach(function (id) {
        var nid = id === fromId ? toId : id;
        if (!categoryIdExists(nid)) return;
        if (seen[nid]) return;
        seen[nid] = true;
        next.push(nid);
      });
      if (JSON.stringify(next) !== JSON.stringify(j.categoryIds || [])) {
        j.categoryIds = next;
        j.updatedAt = nowTs();
      }
    });
    dedupeJarCategoriesExclusive();
  }

  function computeJarSpentForMonth(month, jar) {
    if (!month || !Array.isArray(month.expenses) || !jar) return 0;
    var set = {};
    (jar.categoryIds || []).forEach(function (id) {
      set[id] = true;
    });
    return month.expenses.reduce(function (s, e) {
      if (isRowDeleted(e)) return s;
      if (set[e.category]) return s + e.amount;
      return s;
    }, 0);
  }

  function getCategoryIdsClaimedByUserJars() {
    var set = {};
    (app.spendingJars || []).forEach(function (j) {
      (j.categoryIds || []).forEach(function (id) {
        set[id] = true;
      });
    });
    return set;
  }

  function getUnclaimedCategoryIds() {
    var claimed = getCategoryIdsClaimedByUserJars();
    var out = [];
    app.categories.forEach(function (c) {
      if (!claimed[c.id]) out.push(c.id);
    });
    return out;
  }

  function computeSpentForCategories(month, categoryIds) {
    if (!month || !Array.isArray(month.expenses) || !categoryIds.length) return 0;
    var set = {};
    categoryIds.forEach(function (id) {
      set[id] = true;
    });
    return month.expenses.reduce(function (s, e) {
      if (isRowDeleted(e)) return s;
      if (set[e.category]) return s + e.amount;
      return s;
    }, 0);
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
  var editingJarId = null;
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
    if (isMonthDeleted(app.months[k])) {
      app.months[k].deletedAt = 0;
      app.months[k].income = 0;
      app.months[k].expenses = [];
      app.months[k].incomeUserSet = false;
    }
    if (!Array.isArray(app.months[k].expenses)) app.months[k].expenses = [];
    if (typeof app.months[k].income !== "number") app.months[k].income = 0;
    migrateMonthIncomeUserSet(app.months[k]);
    return app.months[k];
  }

  function totalExpensesForMonth(m) {
    if (!m || !m.expenses) return 0;
    return m.expenses.reduce(function (s, e) {
      if (isRowDeleted(e)) return s;
      return s + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
  }

  function monthHasData(k) {
    var m = app.months[k];
    if (!m) return false;
    if (isMonthDeleted(m)) return false;
    if ((m.income || 0) > 0) return true;
    if (
      m.expenses &&
      m.expenses.some(function (e) {
        return !isRowDeleted(e);
      })
    )
      return true;
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
    Object.keys(app.months).forEach(function (k) {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(k) && monthHasData(k) && !set[k]) {
        set[k] = true;
        out.push(k);
      }
    });
    if (
      activeMonthKey &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(activeMonthKey) &&
      !set[activeMonthKey]
    ) {
      out.push(activeMonthKey);
    }
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
  var elReportModePie = document.getElementById("report-mode-pie");
  var elReportModeJars = document.getElementById("report-mode-jars");
  var elReportJarPieToolbar = document.getElementById("report-jar-pie-toolbar");
  var elReportJarPieBack = document.getElementById("report-jar-pie-back");
  var elReportJarPieHint = document.getElementById("report-jar-pie-hint");
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
  var elAuthStatusText = document.getElementById("auth-status-text");
  var elBtnCloudSync = document.getElementById("btn-cloud-sync");
  var elBtnAuthToggle = document.getElementById("btn-auth-toggle");

  var elViewMonth = document.getElementById("view-month");
  var elViewSettings = document.getElementById("view-settings");
  var elBtnOpenSettings = document.getElementById("btn-open-settings");
  var elBtnCloseSettings = document.getElementById("btn-close-settings");
  var elSettingsDefaultLimit = document.getElementById("settings-default-limit");
  var elSettingsDefaultLimitPreview = document.getElementById("settings-default-limit-preview");
  var elSettingsThemeSelect = document.getElementById("settings-theme-select");
  var elSettingsFixedList = document.getElementById("settings-fixed-templates-list");
  var elSettingsAddFixedPanel = document.getElementById("settings-add-fixed-panel");
  var elBtnSettingsShowAddFixed = document.getElementById("btn-settings-show-add-fixed");
  var elBtnSettingsCancelAddFixed = document.getElementById("btn-settings-cancel-add-fixed");
  var elSettingsAddFixedForm = document.getElementById("settings-add-fixed-form");
  var elSettingsAddFixedCategory = document.getElementById("settings-add-fixed-category");
  var elSettingsAddFixedName = document.getElementById("settings-add-fixed-name");
  var elSettingsAddFixedAmount = document.getElementById("settings-add-fixed-amount");
  var elSettingsAddFixedAmountPreview = document.getElementById("settings-add-fixed-amount-preview");
  var elSettingsCategoriesList = document.getElementById("settings-categories-list");
  var elSettingsAddCategoryPanel = document.getElementById("settings-add-category-panel");
  var elBtnSettingsShowAddCategory = document.getElementById("btn-settings-show-add-category");
  var elBtnSettingsCancelAddCategory = document.getElementById("btn-settings-cancel-add-category");
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

  var elMonthJarsCard = document.getElementById("month-jars-card");
  var elMonthJarsList = document.getElementById("month-jars-list");
  var elSettingsJarsList = document.getElementById("settings-jars-list");
  var elSettingsAddJarForm = document.getElementById("settings-add-jar-form");
  var elSettingsNewJarLabel = document.getElementById("settings-new-jar-label");
  var elSettingsNewJarColor = document.getElementById("settings-new-jar-color");
  var elSettingsNewJarColorSwatches = document.getElementById("settings-new-jar-color-swatches");
  var elSettingsNewJarLimit = document.getElementById("settings-new-jar-limit");
  var elSettingsNewJarLimitPreview = document.getElementById("settings-new-jar-limit-preview");
  var elSettingsNewJarCategories = document.getElementById("settings-new-jar-categories");
  var elSettingsAddJarPanel = document.getElementById("settings-add-jar-panel");
  var elBtnSettingsShowAddJar = document.getElementById("btn-settings-show-add-jar");
  var elBtnSettingsCancelAddJar = document.getElementById("btn-settings-cancel-add-jar");
  var elEditJarDialog = document.getElementById("edit-jar-dialog");
  var elEditJarBackdrop = document.getElementById("edit-jar-backdrop");
  var elEditJarLabelInput = document.getElementById("edit-jar-label-input");
  var elEditJarColor = document.getElementById("edit-jar-color");
  var elEditJarColorSwatches = document.getElementById("edit-jar-color-swatches");
  var elEditJarLimit = document.getElementById("edit-jar-limit");
  var elEditJarLimitPreview = document.getElementById("edit-jar-limit-preview");
  var elEditJarCategories = document.getElementById("edit-jar-categories");
  var elEditJarSave = document.getElementById("edit-jar-save");
  var elEditJarCancel = document.getElementById("edit-jar-cancel");

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
  var elEditExpenseFixed = document.getElementById("edit-expense-fixed");
  var elEditTemplateNote = document.getElementById("edit-expense-template-note");
  var elEditSave = document.getElementById("edit-expense-save");
  var elEditCancel = document.getElementById("edit-expense-cancel");
  var elAuthDialog = document.getElementById("auth-dialog");
  var elAuthBackdrop = document.getElementById("auth-backdrop");
  var elAuthEmail = document.getElementById("auth-email");
  var elAuthPassword = document.getElementById("auth-password");
  var elAuthError = document.getElementById("auth-error");
  var elAuthSubmit = document.getElementById("auth-submit");
  var elAuthCancel = document.getElementById("auth-cancel");
  var reportMode = "pie";
  /** Khi báo cáo ở chế độ Hũ: null = pie tất cả hũ; id hũ hoặc CONSOLIDATED_JAR_ID = pie danh mục trong hũ */
  var reportJarDrillId = null;

  var JAR_COLOR_PRESETS = [
    "#e8a598",
    "#f3b8c8",
    "#d7b6ff",
    "#a9c4ff",
    "#8fd3ff",
    "#7fe0d2",
    "#9fd6a8",
    "#f5d68a",
    "#f7b37a",
    "#d1d7e0",
  ];

  function renderJarColorSwatches(containerEl, hiddenInputEl, selectedColor) {
    if (!containerEl || !hiddenInputEl) return;
    var sel = normalizeHexColor(selectedColor || hiddenInputEl.value || "#e8a598");
    hiddenInputEl.value = sel;
    containerEl.innerHTML = "";
    var list = JAR_COLOR_PRESETS.slice();
    var hasSel = list.some(function (hex) {
      return normalizeHexColor(hex) === sel;
    });
    if (!hasSel) list.unshift(sel);
    list.forEach(function (hex) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jar-color-swatch" + (normalizeHexColor(hex) === sel ? " is-selected" : "");
      btn.style.background = hex;
      btn.setAttribute("aria-label", "Chọn màu " + hex);
      btn.setAttribute("aria-pressed", normalizeHexColor(hex) === sel ? "true" : "false");
      btn.addEventListener("click", function () {
        hiddenInputEl.value = normalizeHexColor(hex);
        renderJarColorSwatches(containerEl, hiddenInputEl, hiddenInputEl.value);
      });
      li.appendChild(btn);
      containerEl.appendChild(li);
    });
  }

  function renderAuthUi() {
    if (elAuthStatusText) {
      if (supabaseEnabled) {
        var emailMask = supabaseUserEmail || "đã đăng nhập";
        elAuthStatusText.textContent = "Đang đồng bộ cloud: " + emailMask;
      } else {
        elAuthStatusText.textContent = "Đang dùng local trên thiết bị này.";
        setAuthSyncHint("", "");
      }
    }
    if (elBtnAuthToggle) {
      elBtnAuthToggle.textContent = supabaseEnabled ? "Đăng xuất cloud sync" : "Đăng nhập để đồng bộ";
    }
    if (elBtnCloudSync) {
      elBtnCloudSync.disabled = !supabaseEnabled;
      elBtnCloudSync.title = supabaseEnabled
        ? "Gộp dữ liệu trên máy với cloud, cập nhật màn hình, rồi lưu lên server"
        : "Đăng nhập để đồng bộ cloud";
    }
  }

  function setAuthError(message) {
    if (!elAuthError) return;
    if (!message) {
      elAuthError.textContent = "";
      elAuthError.hidden = true;
      elAuthError.classList.remove("is-error");
      return;
    }
    elAuthError.textContent = message;
    elAuthError.hidden = false;
    elAuthError.classList.add("is-error");
  }

  function openAuthDialog() {
    if (!elAuthDialog) return;
    setAuthError("");
    if (elAuthPassword) elAuthPassword.value = "";
    if (elAuthEmail && !elAuthEmail.value && supabaseUserEmail) elAuthEmail.value = supabaseUserEmail;
    elAuthDialog.hidden = false;
    elAuthDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(function () {
      if (elAuthEmail) elAuthEmail.focus();
    }, 0);
  }

  function closeAuthDialog() {
    if (!elAuthDialog) return;
    elAuthDialog.hidden = true;
    elAuthDialog.setAttribute("aria-hidden", "true");
    setAuthError("");
    if (
      (!elEditDialog || elEditDialog.hidden) &&
      (!elEditFixedDialog || elEditFixedDialog.hidden) &&
      (!elEditCategoryDialog || elEditCategoryDialog.hidden) &&
      (!elEditJarDialog || elEditJarDialog.hidden)
    ) {
      document.body.classList.remove("modal-open");
    }
  }

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

  function piggyBankUseSvg(color, size) {
    var px = size || 40;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "jar-pig-svg");
    svg.setAttribute("width", String(px));
    svg.setAttribute("height", String(px));
    svg.setAttribute("viewBox", "0 0 512 512");
    svg.style.color = color || "#e8a598";
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-piggy-bank");
    svg.appendChild(use);
    return svg;
  }

  function renderJarCategoryCheckboxes(containerEl, namePrefix, selectedIds) {
    if (!containerEl) return;
    var sel = {};
    (selectedIds || []).forEach(function (id) {
      sel[id] = true;
    });
    containerEl.innerHTML = "";
    app.categories.forEach(function (c) {
      var label = document.createElement("label");
      label.className = "jar-cat-check-label";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = namePrefix;
      cb.value = c.id;
      cb.checked = !!sel[c.id];
      var span = document.createElement("span");
      span.className = "jar-cat-check-text";
      span.textContent = iconIdToSym(c.iconId) + " " + c.label;
      label.appendChild(cb);
      label.appendChild(span);
      containerEl.appendChild(label);
    });
  }

  function readCheckedCategoryIds(containerEl) {
    if (!containerEl) return [];
    var out = [];
    var inputs = containerEl.querySelectorAll('input[type="checkbox"]');
    var i;
    for (i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) out.push(inputs[i].value);
    }
    return out;
  }

  function renderSettingsJarsList() {
    if (!elSettingsJarsList) return;
    ensureSpendingJarsNormalized();
    elSettingsJarsList.innerHTML = "";
    app.spendingJars.forEach(function (j) {
      var li = document.createElement("li");
      li.className = "settings-jar-row";

      var pic = document.createElement("div");
      pic.className = "settings-jar-pig-wrap";
      pic.appendChild(piggyBankUseSvg(j.color, 44));

      var mid = document.createElement("div");
      mid.className = "settings-jar-mid";
      var title = document.createElement("span");
      title.className = "settings-jar-title";
      title.textContent = j.label;
      var meta = document.createElement("span");
      meta.className = "settings-jar-meta";
      var limText =
        j.limitAmount > 0
          ? "Hạn mức " + formatMoneyVNDShort(j.limitAmount)
          : "Chưa đặt hạn mức";
      var nCat = (j.categoryIds || []).length;
      meta.textContent = limText + " · " + nCat + " danh mục";
      mid.appendChild(title);
      mid.appendChild(meta);

      var actions = document.createElement("div");
      actions.className = "settings-jar-actions";
      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn-icon btn-icon-muted";
      btnEdit.setAttribute("aria-label", "Sửa hũ");
      btnEdit.appendChild(iconPencilSvg());
      btnEdit.addEventListener("click", function () {
        openEditJarDialog(j.id);
      });
      var btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-icon btn-icon-danger";
      btnDel.setAttribute("aria-label", "Xóa hũ");
      btnDel.appendChild(iconTrashSvg());
      btnDel.addEventListener("click", function () {
        deleteJarFromSettings(j.id);
      });
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);

      li.appendChild(pic);
      li.appendChild(mid);
      li.appendChild(actions);
      elSettingsJarsList.appendChild(li);
    });
  }

  function renderNewJarCategoryCheckboxes() {
    renderJarCategoryCheckboxes(elSettingsNewJarCategories, "jar-cat-new", []);
  }

  function resetSettingsAddJarForm() {
    if (elSettingsNewJarLabel) elSettingsNewJarLabel.value = "";
    if (elSettingsNewJarColor) elSettingsNewJarColor.value = "#e8a598";
    renderJarColorSwatches(elSettingsNewJarColorSwatches, elSettingsNewJarColor, "#e8a598");
    if (elSettingsNewJarLimit) elSettingsNewJarLimit.value = "";
    updateAmountPreview(elSettingsNewJarLimit, elSettingsNewJarLimitPreview);
    renderNewJarCategoryCheckboxes();
  }

  function setSettingsAddJarPanelOpen(open) {
    if (elSettingsAddJarPanel) {
      elSettingsAddJarPanel.hidden = !open;
      if (open) {
        elSettingsAddJarPanel.removeAttribute("aria-hidden");
      } else {
        elSettingsAddJarPanel.setAttribute("aria-hidden", "true");
      }
    }
    if (elBtnSettingsShowAddJar) elBtnSettingsShowAddJar.hidden = !!open;
    if (!open) resetSettingsAddJarForm();
  }

  function resetSettingsAddCategoryForm() {
    if (elSettingsNewCategoryLabel) elSettingsNewCategoryLabel.value = "";
    if (elSettingsNewCategoryIconSelect) elSettingsNewCategoryIconSelect.value = "food";
    renderSettingsNewCategoryIconPicker();
  }

  function setSettingsAddCategoryPanelOpen(open) {
    if (elSettingsAddCategoryPanel) {
      elSettingsAddCategoryPanel.hidden = !open;
      if (open) elSettingsAddCategoryPanel.removeAttribute("aria-hidden");
      else elSettingsAddCategoryPanel.setAttribute("aria-hidden", "true");
    }
    if (elBtnSettingsShowAddCategory) elBtnSettingsShowAddCategory.hidden = !!open;
    if (!open) resetSettingsAddCategoryForm();
  }

  function resetSettingsAddFixedForm() {
    if (elSettingsAddFixedName) elSettingsAddFixedName.value = "";
    if (elSettingsAddFixedAmount) elSettingsAddFixedAmount.value = "";
    updateAmountPreview(elSettingsAddFixedAmount, elSettingsAddFixedAmountPreview);
    refreshAllCategorySelects();
    if (elSettingsAddFixedCategory) elSettingsAddFixedCategory.value = getFirstCategoryId();
  }

  function setSettingsAddFixedPanelOpen(open) {
    if (elSettingsAddFixedPanel) {
      elSettingsAddFixedPanel.hidden = !open;
      if (open) elSettingsAddFixedPanel.removeAttribute("aria-hidden");
      else elSettingsAddFixedPanel.setAttribute("aria-hidden", "true");
    }
    if (elBtnSettingsShowAddFixed) elBtnSettingsShowAddFixed.hidden = !!open;
    if (!open) {
      resetSettingsAddFixedForm();
    } else {
      refreshAllCategorySelects();
      if (elSettingsAddFixedCategory) elSettingsAddFixedCategory.value = getFirstCategoryId();
    }
  }

  function renderMonthSpendingJars() {
    if (!elMonthJarsCard || !elMonthJarsList) return;
    ensureSpendingJarsNormalized();
    var jars = app.spendingJars || [];
    var unclaimedIds = getUnclaimedCategoryIds();
    var showCard = jars.length > 0 || unclaimedIds.length > 0;
    if (!showCard) {
      elMonthJarsCard.hidden = true;
      return;
    }
    elMonthJarsCard.hidden = false;
    elMonthJarsList.innerHTML = "";
    if (!state) return;

    function appendMonthJarRow(label, color, limitAmount, spent, categoryIds, rowClass) {
      var li = document.createElement("li");
      li.className = "month-jar-row" + (rowClass ? " " + rowClass : "");

      var pic = document.createElement("div");
      pic.className = "month-jar-pig-wrap";
      pic.appendChild(piggyBankUseSvg(color, 40));

      var body = document.createElement("div");
      body.className = "month-jar-body";
      var h = document.createElement("div");
      h.className = "month-jar-head";
      var name = document.createElement("span");
      name.className = "month-jar-name";
      name.textContent = label;
      var amt = document.createElement("span");
      amt.className = "month-jar-amounts";
      if (limitAmount > 0) {
        amt.textContent =
          formatMoneyVNDShort(spent) + " / " + formatMoneyVNDShort(limitAmount);
      } else {
        amt.textContent = formatMoneyVNDShort(spent);
      }
      h.appendChild(name);
      h.appendChild(amt);

      var barWrap = document.createElement("div");
      barWrap.className = "jar-progress-wrap";
      var bar = document.createElement("div");
      bar.className = "jar-progress-bar";
      var fill = document.createElement("div");
      fill.className = "jar-progress-fill";
      if (limitAmount > 0) {
        var pct = Math.min(100, Math.round((spent / limitAmount) * 100));
        fill.style.width = pct + "%";
        if (spent > limitAmount) fill.classList.add("is-over");
      } else {
        fill.style.width = spent > 0 ? "100%" : "0%";
        fill.classList.add("is-neutral");
      }
      bar.appendChild(fill);
      barWrap.appendChild(bar);

      var cats = document.createElement("p");
      cats.className = "month-jar-cats";
      if (!categoryIds.length) {
        cats.textContent = "Chưa gắn danh mục";
      } else {
        cats.textContent = categoryIds
          .map(function (id) {
            return getCategoryLabel(id);
          })
          .join(" · ");
      }

      body.appendChild(h);
      body.appendChild(barWrap);
      body.appendChild(cats);
      li.appendChild(pic);
      li.appendChild(body);
      elMonthJarsList.appendChild(li);
    }

    jars.forEach(function (j) {
      var spent = computeJarSpentForMonth(state, j);
      appendMonthJarRow(j.label, j.color, j.limitAmount, spent, j.categoryIds || [], "");
    });

    if (unclaimedIds.length > 0) {
      var cSpent = computeSpentForCategories(state, unclaimedIds);
      appendMonthJarRow(
        CONSOLIDATED_JAR_LABEL,
        CONSOLIDATED_JAR_COLOR,
        0,
        cSpent,
        unclaimedIds,
        "month-jar-row-consolidated"
      );
    }
  }

  function openEditJarDialog(jarId) {
    var j = app.spendingJars.filter(function (x) {
      return x.id === jarId;
    })[0];
    if (!j || !elEditJarDialog) return;
    closeEditCategoryDialog();
    closeEditFixedTemplateDialog();
    editingJarId = jarId;
    if (elEditJarLabelInput) elEditJarLabelInput.value = j.label;
    if (elEditJarColor) elEditJarColor.value = j.color;
    renderJarColorSwatches(elEditJarColorSwatches, elEditJarColor, j.color);
    if (elEditJarLimit) elEditJarLimit.value = formatAsNganDisplay(j.limitAmount);
    updateAmountPreview(elEditJarLimit, elEditJarLimitPreview);
    renderJarCategoryCheckboxes(elEditJarCategories, "jar-cat-edit", j.categoryIds || []);
    elEditJarDialog.hidden = false;
    elEditJarDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(function () {
      if (elEditJarLabelInput) elEditJarLabelInput.focus();
    }, 0);
  }

  function closeEditJarDialog() {
    editingJarId = null;
    if (elEditJarDialog) {
      elEditJarDialog.hidden = true;
      elEditJarDialog.setAttribute("aria-hidden", "true");
    }
    if (
      (!elEditDialog || elEditDialog.hidden) &&
      (!elEditFixedDialog || elEditFixedDialog.hidden) &&
      (!elEditCategoryDialog || elEditCategoryDialog.hidden) &&
      (!elAuthDialog || elAuthDialog.hidden)
    ) {
      document.body.classList.remove("modal-open");
    }
  }

  function saveEditJarDialog() {
    if (!editingJarId) return;
    var j = app.spendingJars.filter(function (x) {
      return x.id === editingJarId;
    })[0];
    if (!j) {
      closeEditJarDialog();
      return;
    }
    var label = elEditJarLabelInput ? elEditJarLabelInput.value.trim() : "";
    if (!label) {
      if (elEditJarLabelInput) elEditJarLabelInput.focus();
      return;
    }
    if (label.length > 40) label = label.slice(0, 40);
    var limitVnd = parseMoneyToVND(elEditJarLimit ? elEditJarLimit.value : "0");
    if (limitVnd < 0) limitVnd = 0;
    var catIds = readCheckedCategoryIds(elEditJarCategories).filter(categoryIdExists);
    if (!catIds.length) {
      window.alert("Chọn ít nhất một danh mục cho hũ.");
      return;
    }
    reserveCategoriesForJar(j.id, catIds);
    j.label = label;
    j.color = normalizeHexColor(elEditJarColor ? elEditJarColor.value : j.color);
    j.limitAmount = limitVnd;
    j.categoryIds = catIds;
    j.updatedAt = nowTs();
    dedupeJarCategoriesExclusive();
    saveAppData();
    closeEditJarDialog();
    renderSettingsJarsList();
    renderNewJarCategoryCheckboxes();
    if (activeMonthKey && state) persistAndRender();
  }

  function deleteJarFromSettings(jarId) {
    if (
      !confirm(
        "Xóa hũ này? Các khoản chi đã nhập không bị xóa; chỉ bỏ nhóm thống kê theo hũ."
      )
    ) {
      return;
    }
    var next = app.spendingJars.filter(function (j) {
      return j.id !== jarId;
    });
    if (next.length === app.spendingJars.length) return;
    app.spendingJars = next;
    saveAppData();
    renderSettingsJarsList();
    if (activeMonthKey && state) persistAndRender();
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
    remapCategoryInJars(id, toId);
    app.categories = rest;
    saveAppData();
    refreshAllCategorySelects();
    renderSettingsCategoriesList();
    if (activeMonthKey && state) {
      state.expenses = state.expenses.map(normalizeExpenseRow);
      syncFixedIntoMonth(state, activeMonthKey);
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
      (!elEditFixedDialog || elEditFixedDialog.hidden) &&
      (!elAuthDialog || elAuthDialog.hidden) &&
      (!elEditJarDialog || elEditJarDialog.hidden)
    ) {
      document.body.classList.remove("modal-open");
    }
  }

  function openEditCategoryDialog(catId) {
    var c = findCategory(catId);
    if (!c || !elEditCategoryDialog) return;
    closeEditJarDialog();
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
    var updatedAt =
      typeof row.updatedAt === "number" && row.updatedAt > 0
        ? Math.round(row.updatedAt)
        : expenseCreatedAt(row) || nowTs();
    var o = {
      id: row.id || uid(),
      category: cat,
      name: typeof row.name === "string" ? row.name.trim() : "",
      amount: typeof row.amount === "number" && row.amount >= 0 ? Math.round(row.amount) : 0,
      updatedAt: updatedAt,
    };
    if (row.templateId) o.templateId = row.templateId;
    if (typeof row.deletedAt === "number" && row.deletedAt > 0) {
      o.deletedAt = Math.round(row.deletedAt);
    }
    return o;
  }

  function syncFixedIntoMonth(m, monthKey) {
    if (!Array.isArray(app.fixedTemplates)) return;
    // Chỉ tự động bổ sung khoản cố định cho tháng hiện tại/tương lai.
    // Tháng quá khứ sẽ không tự thêm nếu còn thiếu.
    if (
      monthKey &&
      typeof monthKey === "string" &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)
    ) {
      var nowKey = currentMonthKey();
      if (monthKey < nowKey) return;
    }
    app.fixedTemplates.forEach(function (t) {
      if (!t || !t.id || !categoryIdExists(t.category) || isRowDeleted(t)) return;
      var exists = m.expenses.some(function (e) {
        // Keep month-level deletion tombstones: if user deleted a fixed row in this month,
        // do not auto-recreate it after refresh.
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
          updatedAt: nowTs(),
        });
      }
    });
  }

  function findFixedTemplate(templateId) {
    if (!templateId || !app.fixedTemplates) return null;
    var i;
    for (i = 0; i < app.fixedTemplates.length; i++) {
      if (app.fixedTemplates[i].id === templateId && !isRowDeleted(app.fixedTemplates[i])) {
        return app.fixedTemplates[i];
      }
    }
    return null;
  }

  function syncExpenseRowsFromTemplate(t) {
    if (!t || !t.id) return;
    Object.keys(app.months).forEach(function (k) {
      var m = app.months[k];
      if (!m || !Array.isArray(m.expenses)) return;
      m.expenses.forEach(function (e) {
        if (isRowDeleted(e)) return;
        if (e.templateId === t.id) {
          e.category = t.category;
          e.name = typeof t.name === "string" ? t.name.trim() : "";
          e.amount =
            typeof t.amount === "number" && t.amount >= 0
              ? Math.round(t.amount)
              : 0;
          e.updatedAt = nowTs();
        }
      });
    });
  }

  function totalExpenses() {
    if (!state) return 0;
    return state.expenses.reduce(function (s, e) {
      if (isRowDeleted(e)) return s;
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
      if (isRowDeleted(e)) return;
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

  function sliceFillAt(i, seg) {
    return seg.fill || PIE_COLORS[i % PIE_COLORS.length];
  }

  /**
   * segments: { id, label, amount, fill? }[]
   * onSegmentClick: null hoặc function (seg) — dùng cho pie hũ (mở chi tiết)
   */
  function renderPieChartFromSegments(segments, accessibleTitle, onSegmentClick) {
    if (!elPieBody || !elPieSlices || !elPieLegend) return;

    var total = segments.reduce(function (s, x) {
      return s + x.amount;
    }, 0);

    if (total <= 0 || !segments.length) {
      elPieEmpty.hidden = false;
      elPieBody.hidden = true;
      elPieSlices.innerHTML = "";
      elPieLegend.innerHTML = "";
      if (elPieTitle) elPieTitle.textContent = accessibleTitle || "Biểu đồ";
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
      var seg0 = segments[0];
      var circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circ.setAttribute("cx", String(cx));
      circ.setAttribute("cy", String(cy));
      circ.setAttribute("r", String(r));
      circ.setAttribute("fill", sliceFillAt(0, seg0));
      circ.setAttribute("stroke", stroke);
      circ.setAttribute("stroke-width", "2");
      if (onSegmentClick) {
        circ.classList.add("pie-slice-interactive");
        circ.setAttribute("tabindex", "0");
        circ.addEventListener("click", function () {
          onSegmentClick(seg0);
        });
        circ.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onSegmentClick(seg0);
          }
        });
      }
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
        path.setAttribute("fill", sliceFillAt(i, seg));
        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linejoin", "round");
        if (onSegmentClick) {
          path.classList.add("pie-slice-interactive");
          path.setAttribute("tabindex", "0");
          path.addEventListener("click", function () {
            onSegmentClick(seg);
          });
          path.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSegmentClick(seg);
            }
          });
        }
        elPieSlices.appendChild(path);
      });
    }

    elPieLegend.innerHTML = "";
    segments.forEach(function (seg, i) {
      var pct = total > 0 ? Math.round((seg.amount / total) * 1000) / 10 : 0;
      var li = document.createElement("li");
      li.className =
        "pie-legend-item" +
        (onSegmentClick ? " pie-legend-item-interactive" : "");
      var dot = document.createElement("span");
      dot.className = "pie-legend-dot";
      dot.style.background = sliceFillAt(i, seg);
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
      if (onSegmentClick) {
        li.setAttribute("tabindex", "0");
        li.addEventListener("click", function () {
          onSegmentClick(seg);
        });
        li.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onSegmentClick(seg);
          }
        });
      }
      elPieLegend.appendChild(li);
    });

    if (elPieTitle) {
      var parts = segments.map(function (s) {
        return s.label + " " + Math.round((s.amount / total) * 100) + "%";
      });
      elPieTitle.textContent = accessibleTitle + ": " + parts.join(", ");
    }
  }

  function renderCategoryPieChart() {
    if (!state) return;
    var byCat = totalsByCategory();
    var segments = [];
    app.categories.forEach(function (c) {
      var amt = byCat[c.id] || 0;
      if (amt > 0) segments.push({ id: c.id, label: c.label, amount: amt });
    });
    renderPieChartFromSegments(segments, "Chi tiêu theo danh mục", null);
  }

  function renderJarPieChart() {
    if (!elPieBody || !elPieSlices || !elPieLegend || !state) return;
    ensureSpendingJarsNormalized();
    var byCat = totalsByCategory();

    function openJarDrill(seg) {
      reportJarDrillId = seg.id;
      renderReportModeButtons();
      renderPieChart();
    }

    if (reportJarDrillId) {
      if (
        reportJarDrillId !== CONSOLIDATED_JAR_ID &&
        !findSpendingJar(reportJarDrillId)
      ) {
        reportJarDrillId = null;
        renderJarPieChart();
        return;
      }
      var categorySegments = [];
      if (reportJarDrillId === CONSOLIDATED_JAR_ID) {
        getUnclaimedCategoryIds().forEach(function (cid) {
          var amt = byCat[cid] || 0;
          if (amt > 0) {
            var catRow = findCategory(cid);
            categorySegments.push({
              id: cid,
              label: catRow ? catRow.label : getCategoryLabel(cid),
              amount: amt,
            });
          }
        });
      } else {
        var jar = findSpendingJar(reportJarDrillId);
        if (!jar) {
          reportJarDrillId = null;
          renderJarPieChart();
          return;
        }
        (jar.categoryIds || []).forEach(function (cid) {
          var amt = byCat[cid] || 0;
          if (amt > 0) {
            var catRow = findCategory(cid);
            categorySegments.push({
              id: cid,
              label: catRow ? catRow.label : getCategoryLabel(cid),
              amount: amt,
            });
          }
        });
      }
      var jarTitle =
        reportJarDrillId === CONSOLIDATED_JAR_ID
          ? CONSOLIDATED_JAR_LABEL
          : findSpendingJar(reportJarDrillId)
          ? findSpendingJar(reportJarDrillId).label
          : "";
      renderPieChartFromSegments(
        categorySegments,
        "Hũ «" + jarTitle + "» — theo danh mục",
        null
      );
      return;
    }

    var segments = [];
    (app.spendingJars || []).forEach(function (j) {
      var spent = computeJarSpentForMonth(state, j);
      if (spent > 0) {
        segments.push({
          id: j.id,
          label: j.label,
          amount: spent,
          fill: j.color,
        });
      }
    });
    var unclaimed = getUnclaimedCategoryIds();
    if (unclaimed.length) {
      var cSpent = computeSpentForCategories(state, unclaimed);
      if (cSpent > 0) {
        segments.push({
          id: CONSOLIDATED_JAR_ID,
          label: CONSOLIDATED_JAR_LABEL,
          amount: cSpent,
          fill: CONSOLIDATED_JAR_COLOR,
        });
      }
    }

    renderPieChartFromSegments(segments, "Chi tiêu theo hũ", openJarDrill);
  }

  function renderPieChart() {
    if (!elPieBody || !elPieSlices || !elPieLegend || !state) return;
    if (reportMode === "pie") {
      renderCategoryPieChart();
      return;
    }
    if (reportMode === "jars") {
      renderJarPieChart();
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
    if (!elSettingsThemeSelect) return;
    var mode = normalizeThemeMode(app.settings && app.settings.themeMode);
    elSettingsThemeSelect.value = mode;
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
    var t = findFixedTemplate(templateId);
    if (!t) return;
    t.deletedAt = nowTs();
    t.updatedAt = nowTs();
    saveAppData();
    renderFixedTemplatesList();
  }

  function renderFixedTemplatesInto(ul, showEdit) {
    if (!ul) return;
    ul.innerHTML = "";
    var visibleTemplates = Array.isArray(app.fixedTemplates)
      ? app.fixedTemplates.filter(function (t) {
          return !isRowDeleted(t);
        })
      : [];
    if (!visibleTemplates.length) {
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
    visibleTemplates.forEach(function (t) {
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
    var totalRecords = rows.length;
    var hasRows = totalRecords > 0;
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
      var track = document.createElement("div");
      track.className = "expense-swipe-track";
      var main = document.createElement("div");
      main.className = "expense-swipe-main";

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
      var inputDate = formatExpenseInputDate(e);
      if (inputDate) {
        var dateEl = document.createElement("span");
        dateEl.className = "expense-row-date";
        dateEl.textContent = inputDate;
        mid.appendChild(dateEl);
      }

      var amt = document.createElement("span");
      amt.className = "expense-row-amt";
      amt.textContent = formatMoneyListShort(e.amount);

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

      actions.appendChild(btnEdit);
      main.appendChild(ico);
      main.appendChild(mid);
      main.appendChild(amt);
      main.appendChild(actions);

      var btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "expense-item-delete";
      btnDelete.setAttribute("aria-label", "Xóa khoản chi");
      btnDelete.appendChild(iconTrashSvg());
      btnDelete.addEventListener("click", function (ev) {
        ev.stopPropagation();
        removeExpense(e.id);
      });

      track.appendChild(main);
      track.appendChild(btnDelete);
      li.appendChild(track);
      setExpenseRowOffset(li, 0, false);
      attachExpenseSwipe(li, main);
      elExpenseList.appendChild(li);
    });

    var total = rows.reduce(function (sum, e) {
      return sum + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
    var totalLi = document.createElement("li");
    totalLi.className = "expense-total-row";
    totalLi.innerHTML =
      '<span class="expense-total-label"></span><span class="expense-total-amount"></span>';
    totalLi.querySelector(".expense-total-label").textContent =
      "Tổng chi (" + totalRecords + " khoản)";
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
      if (isRowDeleted(e)) return false;
      if (expenseListFilter === "fixed") return isFixedExpenseRow(e);
      if (expenseListFilter === "flex") return !isFixedExpenseRow(e);
      return true;
    });
    rows.sort(function (a, b) {
      var at = expenseCreatedAt(a);
      var bt = expenseCreatedAt(b);
      if (at !== bt) return bt - at;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
    return rows;
  }

  function expenseCreatedAt(e) {
    var id = e && typeof e.id === "string" ? e.id : "";
    var m = /^e-([0-9a-z]+)-/.exec(id);
    if (!m) return 0;
    var n = parseInt(m[1], 36);
    return isNaN(n) ? 0 : n;
  }

  function formatExpenseInputDate(e) {
    var ts = expenseCreatedAt(e);
    if (!ts && e && typeof e.updatedAt === "number" && e.updatedAt > 0) {
      ts = e.updatedAt;
    }
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    return day + "/" + month;
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
      { key: "pie", el: elReportModePie },
      { key: "jars", el: elReportModeJars },
    ];
    map.forEach(function (x) {
      if (!x.el) return;
      var active = reportMode === x.key;
      x.el.classList.toggle("is-active", active);
      x.el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (elReportPieView)
      elReportPieView.hidden = reportMode !== "pie" && reportMode !== "jars";
    if (elReportJarPieToolbar) {
      elReportJarPieToolbar.hidden = reportMode !== "jars";
    }
    if (elReportJarPieBack) {
      elReportJarPieBack.hidden = reportMode !== "jars" || !reportJarDrillId;
    }
    if (elReportJarPieHint) {
      if (reportMode === "jars" && !reportJarDrillId) {
        elReportJarPieHint.textContent =
          "Chọn một phần biểu đồ hoặc mục chú giải để xem chi tiết theo danh mục trong hũ.";
        elReportJarPieHint.hidden = false;
      } else {
        elReportJarPieHint.textContent = "";
        elReportJarPieHint.hidden = true;
      }
    }
  }

  function setReportMode(next) {
    if (next !== "pie" && next !== "jars") return;
    if (next !== "jars") reportJarDrillId = null;
    reportMode = next;
    renderReportModeButtons();
    renderPieChart();
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
    renderExpenseList();
    renderPieChart();
    renderReportModeButtons();
    renderFixedTemplatesList();
    renderMonthSpendingJars();
    if (elSideMenu && !elSideMenu.hidden) {
      renderSideMenuList();
    }
    if (elViewSettings && !elViewSettings.hidden) {
      renderSettingsCategoriesList();
      renderSettingsJarsList();
    }
  }

  function removeExpense(id) {
    if (!state) return;
    var e = state.expenses.find(function (x) {
      return x.id === id;
    });
    if (!e) return;
    e.deletedAt = nowTs();
    e.updatedAt = nowTs();
    persistAndRender();
  }

  var EXPENSE_SWIPE_DELETE_PX = 64;
  var SIDE_MENU_SWIPE_DELETE_PX = 67;

  function setExpenseRowOffset(li, px, animate) {
    if (!li) return;
    var main = li.querySelector(".expense-swipe-main");
    if (!main) return;
    var x = Math.max(0, Math.min(EXPENSE_SWIPE_DELETE_PX, Math.round(px || 0)));
    main.style.transition = animate ? "transform 0.2s ease" : "none";
    main.style.transform = "translateX(" + -x + "px)";
    li.dataset.swipeOffset = String(x);
    li.classList.toggle("is-swiped", x > 0);
    li.classList.toggle("is-swiped-open", x >= EXPENSE_SWIPE_DELETE_PX);
  }

  function closeAllExpenseSwipes(exceptLi) {
    if (!elExpenseList) return;
    var rows = elExpenseList.querySelectorAll("li.expense-row.is-swiped-open");
    var i;
    for (i = 0; i < rows.length; i++) {
      if (exceptLi && rows[i] === exceptLi) continue;
      setExpenseRowOffset(rows[i], 0, true);
    }
  }

  function attachExpenseSwipe(li, main) {
    if (!li || !main) return;
    var startX = 0;
    var startY = 0;
    var baseOffset = 0;
    var dragging = false;
    var touchId = null;

    main.addEventListener("click", function (ev) {
      if ((parseInt(li.dataset.swipeOffset || "0", 10) || 0) > 0) {
        ev.preventDefault();
        setExpenseRowOffset(li, 0, true);
      }
    });

    main.addEventListener(
      "touchstart",
      function (ev) {
        if (!ev.changedTouches || !ev.changedTouches.length) return;
        closeAllExpenseSwipes(li);
        var t = ev.changedTouches[0];
        touchId = t.identifier;
        startX = t.clientX;
        startY = t.clientY;
        baseOffset = parseInt(li.dataset.swipeOffset || "0", 10) || 0;
        dragging = true;
      },
      { passive: true }
    );

    main.addEventListener(
      "touchmove",
      function (ev) {
        if (!dragging || touchId == null || !ev.changedTouches) return;
        var i;
        var t = null;
        for (i = 0; i < ev.changedTouches.length; i++) {
          if (ev.changedTouches[i].identifier === touchId) {
            t = ev.changedTouches[i];
            break;
          }
        }
        if (!t) return;
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
          dragging = false;
          return;
        }
        var offset = baseOffset - dx;
        setExpenseRowOffset(li, offset, false);
      },
      { passive: true }
    );

    function finishTouch() {
      if (!li) return;
      var offset = parseInt(li.dataset.swipeOffset || "0", 10) || 0;
      var shouldOpen = offset >= EXPENSE_SWIPE_DELETE_PX * 0.45;
      setExpenseRowOffset(li, shouldOpen ? EXPENSE_SWIPE_DELETE_PX : 0, true);
      dragging = false;
      touchId = null;
    }

    main.addEventListener("touchend", finishTouch, { passive: true });
    main.addEventListener("touchcancel", finishTouch, { passive: true });
  }

  function setSideMenuRowOffset(li, px, animate) {
    if (!li) return;
    var main = li.querySelector(".side-menu-swipe-main");
    if (!main) return;
    var x = Math.max(0, Math.min(SIDE_MENU_SWIPE_DELETE_PX, Math.round(px || 0)));
    main.style.transition = animate ? "transform 0.2s ease" : "none";
    main.style.transform = "translateX(" + -x + "px)";
    li.dataset.swipeOffset = String(x);
    li.classList.toggle("is-swiped", x > 0);
    li.classList.toggle("is-swiped-open", x >= SIDE_MENU_SWIPE_DELETE_PX);
  }

  function closeAllSideMenuSwipes(exceptLi) {
    if (!elSideMenuList) return;
    var rows = elSideMenuList.querySelectorAll("li.is-swiped-open");
    var i;
    for (i = 0; i < rows.length; i++) {
      if (exceptLi && rows[i] === exceptLi) continue;
      setSideMenuRowOffset(rows[i], 0, true);
    }
  }

  function deleteMonthDataByKey(key) {
    if (!key || !app.months[key]) return;
    if (!confirm("Xóa toàn bộ dữ liệu tháng này? Hành động này không thể hoàn tác.")) {
      return;
    }
    app.months[key] = {
      deletedAt: nowTs(),
      income: 0,
      expenses: [],
      incomeUserSet: false,
    };
    if (activeMonthKey === key) {
      openMonth(currentMonthKey(), { skipUrl: true });
      saveAppData();
    } else {
      saveAppData();
      renderSideMenuList();
    }
  }

  function attachSideMenuSwipe(li, track, btnMain, monthKey) {
    if (!li || !track || !btnMain) return;
    var startX = 0;
    var startY = 0;
    var baseOffset = 0;
    var dragging = false;
    var touchId = null;

    btnMain.addEventListener("click", function (ev) {
      if ((parseInt(li.dataset.swipeOffset || "0", 10) || 0) > 0) {
        ev.preventDefault();
        setSideMenuRowOffset(li, 0, true);
        return;
      }
      closeSideMenu(true);
      openMonth(monthKey);
    });

    btnMain.addEventListener(
      "touchstart",
      function (ev) {
        if (!ev.changedTouches || !ev.changedTouches.length) return;
        closeAllSideMenuSwipes(li);
        var t = ev.changedTouches[0];
        touchId = t.identifier;
        startX = t.clientX;
        startY = t.clientY;
        baseOffset = parseInt(li.dataset.swipeOffset || "0", 10) || 0;
        dragging = true;
      },
      { passive: true }
    );

    btnMain.addEventListener(
      "touchmove",
      function (ev) {
        if (!dragging || touchId == null || !ev.changedTouches) return;
        var i;
        var t = null;
        for (i = 0; i < ev.changedTouches.length; i++) {
          if (ev.changedTouches[i].identifier === touchId) {
            t = ev.changedTouches[i];
            break;
          }
        }
        if (!t) return;
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
          dragging = false;
          return;
        }
        var offset = baseOffset - dx;
        setSideMenuRowOffset(li, offset, false);
      },
      { passive: true }
    );

    function finishTouch() {
      if (!li) return;
      var offset = parseInt(li.dataset.swipeOffset || "0", 10) || 0;
      var shouldOpen = offset >= SIDE_MENU_SWIPE_DELETE_PX * 0.45;
      setSideMenuRowOffset(li, shouldOpen ? SIDE_MENU_SWIPE_DELETE_PX : 0, true);
      dragging = false;
      touchId = null;
    }

    btnMain.addEventListener("touchend", finishTouch, { passive: true });
    btnMain.addEventListener("touchcancel", finishTouch, { passive: true });
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
      var track = document.createElement("div");
      track.className = "side-menu-swipe-track";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "side-menu-item side-menu-swipe-main" + (k === activeMonthKey ? " is-active" : "");

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
          formatMoneyCompact(inc) +
          " · Chi " +
          formatMoneyCompact(spent) +
          " · Còn " +
          formatMoneyCompact(bal);
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

      var btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "side-menu-item-delete";
      btnDelete.setAttribute("aria-label", "Xóa tháng này");
      var svgDelete = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgDelete.setAttribute("class", "icon-svg");
      svgDelete.setAttribute("width", "16");
      svgDelete.setAttribute("height", "16");
      svgDelete.setAttribute("aria-hidden", "true");
      var useDelete = document.createElementNS("http://www.w3.org/2000/svg", "use");
      useDelete.setAttribute("href", "#icon-trash");
      svgDelete.appendChild(useDelete);
      btnDelete.appendChild(svgDelete);
      btnDelete.addEventListener("click", function (ev) {
        ev.stopPropagation();
        deleteMonthDataByKey(k);
      });

      track.appendChild(btn);
      track.appendChild(btnDelete);
      li.appendChild(track);
      setSideMenuRowOffset(li, 0, false);
      attachSideMenuSwipe(li, track, btn, k);
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
    closeEditJarDialog();
    if (elSettingsDefaultLimit) {
      elSettingsDefaultLimit.value = formatAsNganDisplay(getDefaultMonthlyLimit());
      updateAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
    }
    renderThemeModeOptions();
    renderFixedTemplatesList();
    renderSettingsCategoriesList();
    renderSettingsNewCategoryIconPicker();
    renderSettingsJarsList();
    setSettingsAddJarPanelOpen(false);
    setSettingsAddCategoryPanelOpen(false);
    setSettingsAddFixedPanelOpen(false);
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
    syncFixedIntoMonth(state, key);
    activeMonthKey = key;
    reportJarDrillId = null;

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
    closeAuthDialog();
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
        updatedAt: nowTs(),
      });
    }
    var row = {
      id: uid(),
      category: cat,
      name: nameTrim,
      amount: amount,
      updatedAt: nowTs(),
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
        syncFixedIntoMonth(state, activeMonthKey);
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
  if (elReportModePie) {
    elReportModePie.addEventListener("click", function () {
      setReportMode("pie");
    });
  }
  if (elReportModeJars) {
    elReportModeJars.addEventListener("click", function () {
      setReportMode("jars");
    });
  }
  if (elReportJarPieBack) {
    elReportJarPieBack.addEventListener("click", function () {
      if (reportMode !== "jars") return;
      reportJarDrillId = null;
      renderReportModeButtons();
      renderPieChart();
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

  if (elSettingsThemeSelect) {
    elSettingsThemeSelect.addEventListener("change", function () {
      var mode = normalizeThemeMode(elSettingsThemeSelect.value);
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
      renderSettingsCategoriesList();
      renderNewJarCategoryCheckboxes();
      refreshAllCategorySelects();
      if (activeMonthKey && state) persistAndRender();
      setSettingsAddCategoryPanelOpen(false);
    });
  }
  if (elSettingsNewCategoryIconSelect) {
    elSettingsNewCategoryIconSelect.addEventListener("change", function () {
      var selected = ICON_PRESET_NAMES[elSettingsNewCategoryIconSelect.value] || "Biểu tượng";
      elSettingsNewCategoryIconSelect.title = "Biểu tượng: " + selected;
    });
  }

  if (elSettingsAddJarForm) {
    elSettingsAddJarForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var lab = elSettingsNewJarLabel ? elSettingsNewJarLabel.value.trim() : "";
      if (!lab) {
        if (elSettingsNewJarLabel) elSettingsNewJarLabel.focus();
        return;
      }
      if (lab.length > 40) lab = lab.slice(0, 40);
      var limitVnd = parseMoneyToVND(elSettingsNewJarLimit ? elSettingsNewJarLimit.value : "0");
      if (limitVnd <= 0) {
        if (elSettingsNewJarLimit) elSettingsNewJarLimit.focus();
        return;
      }
      var catIds = readCheckedCategoryIds(elSettingsNewJarCategories).filter(categoryIdExists);
      if (!catIds.length) {
        window.alert("Chọn ít nhất một danh mục cho hũ.");
        return;
      }
      var newId = "jar-" + uid();
      reserveCategoriesForJar(newId, catIds);
      app.spendingJars.push(
        normalizeSpendingJarRow({
          id: newId,
          label: lab,
          color: normalizeHexColor(elSettingsNewJarColor ? elSettingsNewJarColor.value : "#e8a598"),
          limitAmount: limitVnd,
          categoryIds: catIds,
          updatedAt: nowTs(),
        })
      );
      saveAppData();
      renderSettingsJarsList();
      setSettingsAddJarPanelOpen(false);
      if (activeMonthKey && state) persistAndRender();
    });
  }
  if (elBtnSettingsShowAddJar) {
    elBtnSettingsShowAddJar.addEventListener("click", function () {
      setSettingsAddJarPanelOpen(true);
      setTimeout(function () {
        if (elSettingsNewJarLabel) elSettingsNewJarLabel.focus();
      }, 0);
    });
  }
  if (elBtnSettingsCancelAddJar) {
    elBtnSettingsCancelAddJar.addEventListener("click", function () {
      setSettingsAddJarPanelOpen(false);
    });
  }
  if (elBtnSettingsShowAddCategory) {
    elBtnSettingsShowAddCategory.addEventListener("click", function () {
      setSettingsAddCategoryPanelOpen(true);
      setTimeout(function () {
        if (elSettingsNewCategoryLabel) elSettingsNewCategoryLabel.focus();
      }, 0);
    });
  }
  if (elBtnSettingsCancelAddCategory) {
    elBtnSettingsCancelAddCategory.addEventListener("click", function () {
      setSettingsAddCategoryPanelOpen(false);
    });
  }
  if (elBtnSettingsShowAddFixed) {
    elBtnSettingsShowAddFixed.addEventListener("click", function () {
      setSettingsAddFixedPanelOpen(true);
      setTimeout(function () {
        if (elSettingsAddFixedCategory) elSettingsAddFixedCategory.focus();
      }, 0);
    });
  }
  if (elBtnSettingsCancelAddFixed) {
    elBtnSettingsCancelAddFixed.addEventListener("click", function () {
      setSettingsAddFixedPanelOpen(false);
    });
  }
  if (elEditJarSave) elEditJarSave.addEventListener("click", saveEditJarDialog);
  if (elEditJarCancel) elEditJarCancel.addEventListener("click", closeEditJarDialog);
  if (elEditJarBackdrop) elEditJarBackdrop.addEventListener("click", closeEditJarDialog);
  if (elEditJarLimit) {
    elEditJarLimit.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        saveEditJarDialog();
      }
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
      updatedAt: nowTs(),
    });
    saveAppData();
    if (state) syncFixedIntoMonth(state, activeMonthKey);
    renderFixedTemplatesList();
    if (activeMonthKey && state) persistAndRender();
    setSettingsAddFixedPanelOpen(false);
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
    closeEditJarDialog();
    var e = state.expenses.find(function (x) {
      return x.id === expenseId;
    });
    if (!e) return;
    editingExpenseId = expenseId;
    var isPastMonth =
      !!activeMonthKey &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(activeMonthKey) &&
      activeMonthKey < currentMonthKey();
    var cat = getCategoryLabel(e.category);
    var line = e.name ? e.name + " · " + cat : cat;
    elEditDesc.textContent = line;
    if (elEditExpenseCategory) elEditExpenseCategory.value = e.category;
    if (elEditExpenseName) elEditExpenseName.value = e.name || "";
    elEditAmount.value = formatAsNganDisplay(e.amount);
    updateAmountPreview(elEditAmount, elEditAmountPreview);
    if (elEditExpenseFixed) {
      elEditExpenseFixed.checked = !!e.templateId;
      // Không cho tạo mới khoản cố định từ tháng quá khứ.
      // Nếu khoản đã là cố định (có templateId) thì vẫn cho xem trạng thái.
      elEditExpenseFixed.disabled = isPastMonth && !e.templateId;
      elEditExpenseFixed.title = elEditExpenseFixed.disabled
        ? "Chỉ bật cố định ở tháng hiện tại hoặc tương lai."
        : "";
    }
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
    if (
      (!elEditFixedDialog || elEditFixedDialog.hidden) &&
      (!elEditCategoryDialog || elEditCategoryDialog.hidden) &&
      (!elAuthDialog || elAuthDialog.hidden) &&
      (!elEditJarDialog || elEditJarDialog.hidden)
    ) {
      document.body.classList.remove("modal-open");
    }
  }

  function closeEditFixedTemplateDialog() {
    editingFixedTemplateId = null;
    if (elEditFixedDialog) {
      elEditFixedDialog.hidden = true;
      elEditFixedDialog.setAttribute("aria-hidden", "true");
    }
    if (
      (!elEditDialog || elEditDialog.hidden) &&
      (!elEditCategoryDialog || elEditCategoryDialog.hidden) &&
      (!elAuthDialog || elAuthDialog.hidden) &&
      (!elEditJarDialog || elEditJarDialog.hidden)
    ) {
      document.body.classList.remove("modal-open");
    }
  }

  function openEditFixedTemplateDialog(templateId) {
    closeEditCategoryDialog();
    closeEditJarDialog();
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
    t.updatedAt = nowTs();
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
    e.updatedAt = nowTs();
    if (elEditExpenseFixed && elEditExpenseFixed.checked && !e.templateId) {
      var isPastMonth =
        !!activeMonthKey &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(activeMonthKey) &&
        activeMonthKey < currentMonthKey();
      if (isPastMonth) {
        window.alert("Chỉ có thể lưu thành khoản cố định ở tháng hiện tại hoặc tương lai.");
      } else {
        var templateId = "ft-" + uid();
        app.fixedTemplates.push({
          id: templateId,
          category: cat,
          name: nameTrim,
          amount: amount,
          updatedAt: nowTs(),
        });
        e.templateId = templateId;
      }
    }
    if (e.templateId) {
      var t = findFixedTemplate(e.templateId);
      if (t) {
        t.category = cat;
        t.name = nameTrim;
        t.amount = amount;
        t.updatedAt = nowTs();
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
      if (elEditJarDialog && !elEditJarDialog.hidden) {
        ev.preventDefault();
        closeEditJarDialog();
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

  async function handleAuthSubmit() {
    if (!createSupabaseClientIfNeeded()) {
      setAuthError("Supabase chưa sẵn sàng (thiếu URL/key hoặc thư viện).");
      return;
    }
    bindSupabaseAuthListener();
    var email = elAuthEmail ? elAuthEmail.value.trim() : "";
    var password = elAuthPassword ? elAuthPassword.value : "";
    if (!email || !password) {
      setAuthError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    setAuthError("");
    if (elAuthSubmit) {
      elAuthSubmit.disabled = true;
      elAuthSubmit.textContent = "Đang đăng nhập...";
    }
    try {
      var res = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (res.error) {
        setAuthError(res.error.message || "Đăng nhập thất bại.");
        return;
      }
      await enableSupabaseSyncBySession(res.data ? res.data.session : null);
      closeAuthDialog();
    } catch (e) {
      setAuthError("Không thể đăng nhập lúc này.");
    } finally {
      if (elAuthSubmit) {
        elAuthSubmit.disabled = false;
        elAuthSubmit.textContent = "Đăng nhập";
      }
    }
  }

  async function handleAuthToggle() {
    if (!createSupabaseClientIfNeeded()) return;
    bindSupabaseAuthListener();
    if (supabaseEnabled) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {}
      await disableSupabaseSync();
      return;
    }
    openAuthDialog();
  }

  elEditSave.addEventListener("click", saveEditExpenseDialog);
  elEditCancel.addEventListener("click", closeEditExpenseDialog);
  elEditBackdrop.addEventListener("click", closeEditExpenseDialog);
  elEditAmount.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      saveEditExpenseDialog();
    }
  });

  if (elBtnAuthToggle) {
    elBtnAuthToggle.addEventListener("click", handleAuthToggle);
  }
  if (elBtnCloudSync) {
    elBtnCloudSync.addEventListener("click", function () {
      void manualCloudSync();
    });
  }
  if (elAuthSubmit) {
    elAuthSubmit.addEventListener("click", handleAuthSubmit);
  }
  if (elAuthCancel) {
    elAuthCancel.addEventListener("click", closeAuthDialog);
  }
  if (elAuthBackdrop) {
    elAuthBackdrop.addEventListener("click", closeAuthDialog);
  }
  if (elAuthPassword) {
    elAuthPassword.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        handleAuthSubmit();
      }
    });
  }

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
  bindAmountPreview(elSettingsNewJarLimit, elSettingsNewJarLimitPreview);
  bindAmountPreview(elEditJarLimit, elEditJarLimitPreview);

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

  renderAuthUi();
  openMonth(initialKey, { skipUrl: true });
  initSupabaseSync(initialKey);

  document.addEventListener("visibilitychange", function () {
    if (!supabaseEnabled || !supabaseClient) return;
    if (document.visibilityState === "hidden") {
      void syncToSupabaseNow();
    } else if (document.visibilityState === "visible") {
      void pullSupabaseStateAndRender();
    }
  });
  window.addEventListener("pagehide", function () {
    if (supabaseEnabled && supabaseClient) {
      void syncToSupabaseNow();
    }
  });
})();
