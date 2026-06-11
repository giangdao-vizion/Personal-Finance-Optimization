(function () {
  "use strict";

  var STORAGE_V1 = "family-budget-v1";
  var STORAGE_V2 = "family-budget-v2";
  var STORAGE_V3 = "family-budget-v3";
  var DATA_SCHEMA_VERSION = 3;
  /** Sau import offline: đăng nhập sẽ đẩy local lên cloud thay vì kéo cloud cũ xuống. */
  var STORAGE_PENDING_CLOUD_PUSH = "family-budget-pending-cloud-push";
  /** Có STORAGE_V2 nhưng chưa có V3 — chặn ghi local cho đến khi migrate. */
  var migrationPending = false;
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
    { id: "fruit", sym: "🍎" },
    { id: "bubble-tea", sym: "🧋" },
    { id: "drink", sym: "🥤" },
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
    fruit: "Trái cây",
    "bubble-tea": "Trà sữa",
    drink: "Ly nước / đồ uống",
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
  var CONSOLIDATED_JAR_LABEL = "Khác";
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

  function defaultCreditCardSettings() {
    return {
      enabled: false,
      statementDay: 1,
      paidCycleEnds: [],
    };
  }

  function defaultSettings() {
    return {
      defaultLimit: 0,
      themeMode: "dark",
      creditCard: defaultCreditCardSettings(),
    };
  }

  function normalizeCreditCardSettings(cc) {
    var src = cc && typeof cc === "object" ? cc : {};
    var day = typeof src.statementDay === "number" ? Math.round(src.statementDay) : 1;
    if (day < 1) day = 1;
    if (day > 31) day = 31;
    var paid = Array.isArray(src.paidCycleEnds)
      ? src.paidCycleEnds.filter(function (k) {
          return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
        })
      : [];
    var seen = {};
    var paidOut = [];
    paid.forEach(function (k) {
      if (seen[k]) return;
      seen[k] = true;
      paidOut.push(k);
    });
    return {
      enabled: !!src.enabled,
      statementDay: day,
      paidCycleEnds: paidOut,
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
    out.creditCard = normalizeCreditCardSettings(out.creditCard);
    return out;
  }

  /** Chỉ phần settings đồng bộ lên cloud — theme giữ cục bộ từng máy. */
  function settingsForCloudStorage(s) {
    var ns = normalizeSettings(s || {});
    return {
      defaultLimit: ns.defaultLimit,
      creditCard: ns.creditCard,
    };
  }

  function getCreditCardSettings() {
    if (!app || !app.settings) return defaultCreditCardSettings();
    return normalizeCreditCardSettings(app.settings.creditCard);
  }

  function isCreditCardFeatureEnabled() {
    return getCreditCardSettings().enabled;
  }

  function daysInCalendarMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function statementDayInMonth(year, month, statementDay) {
    var dim = daysInCalendarMonth(year, month);
    var d = Math.min(Math.max(1, statementDay), dim);
    return { year: year, month: month, day: d };
  }

  function ymdToDayKey(y, mo, d) {
    return (
      y +
      "-" +
      String(mo).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0")
    );
  }

  function addCalendarDays(year, month, day, delta) {
    var dt = new Date(year, month - 1, day);
    dt.setDate(dt.getDate() + delta);
    return {
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
      day: dt.getDate(),
    };
  }

  function formatDayKeyViLong(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!m) return key || "";
    return m[3] + "/" + m[2] + "/" + m[1];
  }

  function computeCreditCardDueDayKey(statementCloseKey) {
    var d = dateFromDayKey(statementCloseKey);
    if (!d) return "";
    var y = d.getFullYear();
    var mo = d.getMonth() + 1;
    var day = d.getDate();
    var due = addCalendarDays(y, mo, day, 15);
    return ymdToDayKey(due.year, due.month, due.day);
  }

  /** Kỳ trước (đã chốt) và kỳ hiện tại theo ngày sao kê. */
  function computeCreditCardCycles(refDate, statementDay) {
    var ref = refDate instanceof Date ? refDate : new Date();
    var today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    var y = today.getFullYear();
    var mo = today.getMonth() + 1;
    var todayKey = ymdToDayKey(y, mo, today.getDate());
    var stmtThis = statementDayInMonth(y, mo, statementDay);
    var closeKey = ymdToDayKey(stmtThis.year, stmtThis.month, stmtThis.day);
    if (todayKey <= closeKey) {
      var pm = mo - 1;
      var py = y;
      if (pm < 1) {
        pm = 12;
        py -= 1;
      }
      var stmtPrev = statementDayInMonth(py, pm, statementDay);
      closeKey = ymdToDayKey(stmtPrev.year, stmtPrev.month, stmtPrev.day);
    }
    var closeParts = dateFromDayKey(closeKey);
    if (!closeParts) {
      return {
        previous: { startKey: "", endKey: "", cycleKey: "", dueKey: "", total: 0 },
        current: { startKey: "", endKey: todayKey, total: 0 },
      };
    }
    var cy = closeParts.getFullYear();
    var cmo = closeParts.getMonth() + 1;
    var pm2 = cmo - 1;
    var py2 = cy;
    if (pm2 < 1) {
      pm2 = 12;
      py2 -= 1;
    }
    var prevCloseStmt = statementDayInMonth(py2, pm2, statementDay);
    var prevCloseKey = ymdToDayKey(prevCloseStmt.year, prevCloseStmt.month, prevCloseStmt.day);
    var prevStartKey = dayKeyShift(prevCloseKey, 1);
    var curStartKey = dayKeyShift(closeKey, 1);
    return {
      previous: {
        startKey: prevStartKey,
        endKey: closeKey,
        cycleKey: closeKey,
        dueKey: computeCreditCardDueDayKey(closeKey),
        total: 0,
      },
      current: {
        startKey: curStartKey,
        endKey: todayKey,
        total: 0,
      },
    };
  }

  function isDayKeyInInclusiveRange(dayKey, startKey, endKey) {
    if (!dayKey || !startKey || !endKey) return false;
    return dayKey >= startKey && dayKey <= endKey;
  }

  function daysUntilDayKey(targetKey, fromDate) {
    var from = fromDate instanceof Date ? fromDate : new Date();
    var fromKey = ymdToDayKey(from.getFullYear(), from.getMonth() + 1, from.getDate());
    var a = dateFromDayKey(fromKey);
    var b = dateFromDayKey(targetKey);
    if (!a || !b) return 0;
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  }

  function isCreditCardExpenseRow(e) {
    return !!(e && e.isCreditCard && !isRowDeleted(e));
  }

  function forEachCreditCardExpense(fn) {
    forEachExpenseInApp(function (e, dk) {
      if (!isCreditCardExpenseRow(e)) return;
      fn(e, dk);
    });
  }

  function getCreditCardExpensesInRange(startKey, endKey) {
    var out = [];
    if (!startKey || !endKey) return out;
    forEachCreditCardExpense(function (e) {
      var dk = dayKeyFromTs(expenseDateTs(e));
      if (isDayKeyInInclusiveRange(dk, startKey, endKey)) out.push(e);
    });
    out.sort(function (a, b) {
      var at = expenseDateTs(a);
      var bt = expenseDateTs(b);
      if (at !== bt) return bt - at;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
    return out;
  }

  function sumExpenseRowsAmount(rows) {
    return (rows || []).reduce(function (s, e) {
      return s + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
  }

  function isCreditCardCyclePaid(cycleKey) {
    if (!cycleKey) return false;
    return getCreditCardSettings().paidCycleEnds.indexOf(cycleKey) >= 0;
  }

  function markCreditCardCyclePaid(cycleKey) {
    if (!cycleKey) return;
    if (!app.settings) app.settings = defaultSettings();
    if (!app.settings.creditCard) app.settings.creditCard = defaultCreditCardSettings();
    var cc = normalizeCreditCardSettings(app.settings.creditCard);
    if (cc.paidCycleEnds.indexOf(cycleKey) < 0) cc.paidCycleEnds.push(cycleKey);
    app.settings.creditCard = cc;
    saveAppData({ configDirty: true });
  }

  function emptyV3AppData() {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      dataUpdatedAt: 0,
      months: {},
      days: {},
      fixedTemplates: defaultFixedTemplates(),
      settings: defaultSettings(),
      categories: defaultCategories(),
      spendingJars: [],
      configDataUpdatedAt: 0,
      configNeedSync: false,
    };
  }

  function normalizeDayShard(raw) {
    var row = raw && typeof raw === "object" ? raw : {};
    var expenses = Array.isArray(row.expenses)
      ? row.expenses.map(normalizeExpenseRow)
      : [];
    return {
      expenses: expenses,
      dataUpdatedAt:
        typeof row.dataUpdatedAt === "number" && row.dataUpdatedAt > 0
          ? Math.round(row.dataUpdatedAt)
          : 0,
      needSync: !!row.needSync,
    };
  }

  function normalizeMonthMeta(raw, monthKey) {
    var row = raw && typeof raw === "object" ? raw : {};
    var out = {
      income: typeof row.income === "number" ? row.income : 0,
      incomeUserSet: !!row.incomeUserSet,
      dataUpdatedAt:
        typeof row.dataUpdatedAt === "number" && row.dataUpdatedAt > 0
          ? Math.round(row.dataUpdatedAt)
          : 0,
      needSync: !!row.needSync,
    };
    if (typeof row.deletedAt === "number" && row.deletedAt > 0) {
      out.deletedAt = Math.round(row.deletedAt);
    }
    migrateMonthIncomeUserSet(out);
    return out;
  }

  function hasV3DayShards(daySrc) {
    if (!daySrc || typeof daySrc !== "object") return false;
    return Object.keys(daySrc).some(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
  }

  function normalizeAppDataShape(d) {
    var src = d && typeof d === "object" ? d : {};
    if (
      !hasV3DayShards(src.days) &&
      ((src.schemaVersion || 0) < DATA_SCHEMA_VERSION ||
        !src.days ||
        typeof src.days !== "object")
    ) {
      return migratePayloadV2ToV3(src).data;
    }
    var months = {};
    var monthSrc = src.months && typeof src.months === "object" ? src.months : {};
    Object.keys(monthSrc).forEach(function (k) {
      months[k] = normalizeMonthMeta(monthSrc[k], k);
    });
    var days = {};
    var daySrc = src.days && typeof src.days === "object" ? src.days : {};
    Object.keys(daySrc).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      days[k] = normalizeDayShard(daySrc[k]);
    });
    var fixedTemplates;
    if (Array.isArray(src.fixedTemplates)) {
      fixedTemplates = src.fixedTemplates.map(normalizeFixedTemplateRow);
    } else {
      fixedTemplates = defaultFixedTemplates();
    }
    var settings = normalizeSettings(src.settings);
    var categories;
    if (Array.isArray(src.categories) && src.categories.length > 0) {
      categories = src.categories.map(normalizeCategoryRow);
    } else {
      categories = defaultCategories();
    }
    var spendingJars = (Array.isArray(src.spendingJars) ? src.spendingJars : []).map(
      normalizeSpendingJarRow
    );
    dedupeFixedExpensesAllMonths(days);
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      dataUpdatedAt:
        typeof src.dataUpdatedAt === "number" && src.dataUpdatedAt > 0
          ? Math.round(src.dataUpdatedAt)
          : 0,
      months: months,
      days: days,
      fixedTemplates: fixedTemplates,
      settings: settings,
      categories: categories,
      spendingJars: spendingJars,
      configDataUpdatedAt:
        typeof src.configDataUpdatedAt === "number" && src.configDataUpdatedAt > 0
          ? Math.round(src.configDataUpdatedAt)
          : 0,
      configNeedSync: !!src.configNeedSync,
    };
  }

  function coercePayloadToV3(payload) {
    if (!payload || typeof payload !== "object") return emptyV3AppData();
    if (
      (payload.schemaVersion || 0) >= DATA_SCHEMA_VERSION &&
      payload.days &&
      typeof payload.days === "object"
    ) {
      return normalizeAppDataShape(payload);
    }
    return migratePayloadV2ToV3(payload).data;
  }

  function expenseDayKeyFromRow(e) {
    if (e && typeof e.dateTs === "number" && e.dateTs > 0) {
      return dayKeyFromTs(Math.round(e.dateTs));
    }
    var id = e && typeof e.id === "string" ? e.id : "";
    var m = /^e-([0-9a-z]+)-/.exec(id);
    if (m) {
      var n = parseInt(m[1], 36);
      if (!isNaN(n) && n > 0) return dayKeyFromTs(n);
    }
    return "";
  }

  function migratePayloadV2ToV3(v2src) {
    var report = {
      ok: true,
      monthCount: 0,
      dayCount: 0,
      expenseCount: 0,
      warnings: [],
    };
    var src = v2src && typeof v2src === "object" ? v2src : {};
    var out = emptyV3AppData();
    var ts = nowTs();
    out.dataUpdatedAt =
      typeof src.dataUpdatedAt === "number" && src.dataUpdatedAt > 0
        ? Math.round(src.dataUpdatedAt)
        : ts;
    out.configDataUpdatedAt = out.dataUpdatedAt;
    out.configNeedSync = true;
    if (Array.isArray(src.fixedTemplates)) {
      out.fixedTemplates = src.fixedTemplates.map(normalizeFixedTemplateRow);
    }
    out.settings = normalizeSettings(src.settings);
    if (Array.isArray(src.categories) && src.categories.length) {
      out.categories = src.categories.map(normalizeCategoryRow);
    }
    out.spendingJars = (Array.isArray(src.spendingJars) ? src.spendingJars : []).map(
      normalizeSpendingJarRow
    );
    var months = src.months && typeof src.months === "object" ? src.months : {};
    Object.keys(months).forEach(function (monthKey) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return;
      var m = months[monthKey] || {};
      report.monthCount += 1;
      out.months[monthKey] = normalizeMonthMeta(m, monthKey);
      out.months[monthKey].dataUpdatedAt = ts;
      out.months[monthKey].needSync = true;
      if (isMonthDeleted(m)) return;
      var expenses = Array.isArray(m.expenses) ? m.expenses : [];
      expenses.forEach(function (e) {
        var row = normalizeExpenseRow(e);
        var dk = expenseDayKeyFromRow(row);
        if (!dk || dk.indexOf(monthKey + "-") !== 0) {
          dk = monthKey + "-01";
          if (!row.dateTs) {
            report.warnings.push(
              "Khoản «" + (row.name || row.id) + "» tháng " + monthKey + " gán vào ngày 01."
            );
          }
        }
        if (!out.days[dk]) {
          out.days[dk] = { expenses: [], dataUpdatedAt: ts, needSync: true };
          report.dayCount += 1;
        }
        out.days[dk].expenses.push(row);
        report.expenseCount += 1;
      });
    });
    return { data: normalizeAppDataShape(out), report: report };
  }

  function needsDataMigration() {
    try {
      if (localStorage.getItem(STORAGE_V3)) return false;
      return !!localStorage.getItem(STORAGE_V2);
    } catch (e) {
      return false;
    }
  }

  function ensureDayShard(dayKey) {
    if (!app.days) app.days = {};
    if (!app.days[dayKey]) {
      app.days[dayKey] = { expenses: [], dataUpdatedAt: 0, needSync: false };
    }
    if (!Array.isArray(app.days[dayKey].expenses)) app.days[dayKey].expenses = [];
    return app.days[dayKey];
  }

  function markDayDirty(dayKey) {
    var shard = ensureDayShard(dayKey);
    shard.dataUpdatedAt = nowTs();
    shard.needSync = true;
    bumpDataRevision();
  }

  function markMonthMetaDirty(monthKey) {
    var m = ensureMonth(monthKey);
    m.dataUpdatedAt = nowTs();
    m.needSync = true;
    bumpDataRevision();
  }

  function markConfigDirty() {
    app.configDataUpdatedAt = nowTs();
    app.configNeedSync = true;
    bumpDataRevision();
  }

  function getMonthExpenses(monthKey) {
    if (!monthKey || !app.days) return [];
    var prefix = monthKey + "-";
    var out = [];
    Object.keys(app.days).forEach(function (dk) {
      if (dk.indexOf(prefix) !== 0) return;
      var shard = app.days[dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      shard.expenses.forEach(function (e) {
        out.push(e);
      });
    });
    return out;
  }

  function flushExpensesToDays(monthKey, expenses) {
    if (!monthKey) return;
    var prefix = monthKey + "-";
    Object.keys(app.days || {}).forEach(function (dk) {
      if (dk.indexOf(prefix) === 0) delete app.days[dk];
    });
    var byDay = {};
    (expenses || []).forEach(function (e) {
      var row = normalizeExpenseRow(e);
      var dk = expenseDayKeyFromRow(row);
      if (!dk || dk.indexOf(prefix) !== 0) dk = monthKey + "-01";
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(row);
    });
    Object.keys(byDay).forEach(function (dk) {
      var shard = ensureDayShard(dk);
      shard.expenses = byDay[dk];
      shard.dataUpdatedAt = nowTs();
      shard.needSync = true;
    });
  }

  function buildMonthState(monthKey) {
    var m = ensureMonth(monthKey);
    return {
      income: m.income,
      incomeUserSet: !!m.incomeUserSet,
      dataUpdatedAt: m.dataUpdatedAt || 0,
      needSync: !!m.needSync,
      deletedAt: m.deletedAt,
      expenses: getMonthExpenses(monthKey).map(normalizeExpenseRow),
    };
  }

  function forEachExpenseInApp(fn) {
    Object.keys(app.days || {}).forEach(function (dk) {
      var shard = app.days[dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      shard.expenses.forEach(function (e) {
        fn(e, dk);
      });
    });
  }

  function clearAllSyncFlagsOnApp() {
    Object.keys(app.days || {}).forEach(function (dk) {
      if (app.days[dk]) app.days[dk].needSync = false;
    });
    Object.keys(app.months || {}).forEach(function (mk) {
      if (app.months[mk]) app.months[mk].needSync = false;
    });
    app.configNeedSync = false;
  }

  function spendingConfigSignature(payload) {
    var n = payload || {};
    return JSON.stringify({
      configDataUpdatedAt: n.configDataUpdatedAt || 0,
      fixedTemplates: n.fixedTemplates || [],
      categories: n.categories || [],
      spendingJars: n.spendingJars || [],
      settings: settingsForCloudStorage(n.settings),
    });
  }

  /** Chuỗi JSON ổn định để so sánh / lastSynced (không gồm theme). */
  function wirePayloadSignature(payload) {
    var n;
    try {
      n = coercePayloadToV3(payload || {});
    } catch (e) {
      return "";
    }
    var daySigs = {};
    Object.keys(n.days || {}).forEach(function (dk) {
      var d = n.days[dk];
      daySigs[dk] = {
        dataUpdatedAt: d.dataUpdatedAt || 0,
        expenses: d.expenses || [],
      };
    });
    var monthSigs = {};
    Object.keys(n.months || {}).forEach(function (mk) {
      var m = n.months[mk];
      monthSigs[mk] = {
        income: m.income,
        incomeUserSet: !!m.incomeUserSet,
        deletedAt: m.deletedAt || 0,
        dataUpdatedAt: m.dataUpdatedAt || 0,
      };
    });
    var w = {
      schemaVersion: DATA_SCHEMA_VERSION,
      dataUpdatedAt: n.dataUpdatedAt || 0,
      months: monthSigs,
      days: daySigs,
      config: spendingConfigSignature(n),
    };
    try {
      return JSON.stringify(w);
    } catch (e2) {
      return "";
    }
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
    migrationPending = needsDataMigration();
    try {
      var rawV3 = localStorage.getItem(STORAGE_V3);
      if (rawV3) {
        return normalizeAppDataShape(JSON.parse(rawV3));
      }
    } catch (e) {
      console.warn("Không đọc được dữ liệu local (family-budget-v3):", e);
    }
    if (migrationPending) {
      return emptyV3AppData();
    }
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
          migrationPending = needsDataMigration();
          if (migrationPending) return emptyV3AppData();
        } catch (e3) {}
      }
    } catch (e2) {}
    return migratePayloadV2ToV3({
      months: months,
      fixedTemplates: defaultFixedTemplates(),
      settings: defaultSettings(),
      categories: defaultCategories(),
      spendingJars: [],
    }).data;
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
  var syncInFlight = false;
  var syncPending = false;
  var syncPendingOpts = null;
  var cloudPollTimer = null;
  /** Poll cloud khi Realtime ngắt (hay gặp trên iPhone/PWA). */
  var CLOUD_POLL_MS = 8000;

  function touchLocalData() {
    /* giữ hook cho telemetry / guard tương lai */
  }

  function stopCloudPoll() {
    if (cloudPollTimer) {
      clearInterval(cloudPollTimer);
      cloudPollTimer = null;
    }
  }

  function startCloudPoll() {
    stopCloudPoll();
    if (!supabaseEnabled) return;
    cloudPollTimer = setInterval(function () {
      if (document.visibilityState !== "visible") return;
      if (isApplyingCloudSnapshot || syncInFlight) return;
      void pullSupabaseStateAndRender();
    }, CLOUD_POLL_MS);
  }

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

  function expenseCreatedAtTs(e) {
    if (e && typeof e.createdAt === "number" && e.createdAt > 0) {
      return Math.round(e.createdAt);
    }
    return expenseCreatedAt(e);
  }

  /** Khi trùng templateId: giữ bản gốc (createdAt cũ hơn), tránh dup auto-syncFixed vs cloud. */
  function pickFixedExpenseKeepWinner(a, b) {
    var aDel = isRowDeleted(a);
    var bDel = isRowDeleted(b);
    if (aDel !== bDel) return aDel ? b : a;
    var aCa = expenseCreatedAtTs(a);
    var bCa = expenseCreatedAtTs(b);
    if (aCa !== bCa) return aCa < bCa ? a : b;
    return expenseUpdatedAt(a) >= expenseUpdatedAt(b) ? a : b;
  }

  function dedupeFixedExpensesInList(expenses) {
    var out = [];
    var liveByTpl = {};
    var tombByTpl = {};
    (Array.isArray(expenses) ? expenses : []).forEach(function (e) {
      var row = normalizeExpenseRow(e);
      if (!row.templateId) {
        out.push(row);
        return;
      }
      if (isRowDeleted(row)) {
        var prevT = tombByTpl[row.templateId];
        if (!prevT) {
          tombByTpl[row.templateId] = row;
          out.push(row);
          return;
        }
        if (expenseUpdatedAt(row) >= expenseUpdatedAt(prevT)) {
          var tIdx = out.indexOf(prevT);
          if (tIdx >= 0) out[tIdx] = row;
          tombByTpl[row.templateId] = row;
        }
        return;
      }
      var prev = liveByTpl[row.templateId];
      if (!prev) {
        liveByTpl[row.templateId] = row;
        out.push(row);
        return;
      }
      var keep = pickFixedExpenseKeepWinner(prev, row);
      if (keep === prev) return;
      var idx = out.indexOf(prev);
      if (idx >= 0) out[idx] = row;
      liveByTpl[row.templateId] = row;
    });
    return out;
  }

  function dedupeFixedExpensesInMonthDays(days, monthKey) {
    if (!monthKey || !days || typeof days !== "object") return;
    var prefix = monthKey + "-";
    var winnerByTpl = {};
    var drop = [];
    Object.keys(days).forEach(function (dk) {
      if (dk.indexOf(prefix) !== 0) return;
      var shard = days[dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      shard.expenses.forEach(function (e) {
        if (!e || !e.templateId) return;
        var prev = winnerByTpl[e.templateId];
        if (!prev) {
          winnerByTpl[e.templateId] = { dk: dk, expense: e };
          return;
        }
        var keep = pickFixedExpenseKeepWinner(prev.expense, e);
        if (keep === prev.expense) {
          drop.push({ dk: dk, id: e.id });
        } else {
          drop.push({ dk: prev.dk, id: prev.expense.id });
          winnerByTpl[e.templateId] = { dk: dk, expense: e };
        }
      });
    });
    drop.forEach(function (d) {
      var shard = days[d.dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      shard.expenses = shard.expenses.filter(function (e) {
        return e.id !== d.id;
      });
    });
    Object.keys(days).forEach(function (dk) {
      if (dk.indexOf(prefix) !== 0) return;
      var shard = days[dk];
      if (
        shard &&
        Array.isArray(shard.expenses) &&
        shard.expenses.length === 0
      ) {
        delete days[dk];
      }
    });
  }

  function dedupeFixedExpensesAllMonths(days) {
    var months = {};
    Object.keys(days || {}).forEach(function (dk) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
      months[dk.slice(0, 7)] = true;
    });
    Object.keys(months).forEach(function (mk) {
      dedupeFixedExpensesInMonthDays(days, mk);
    });
  }

  function payloadHasLiveExpenses(payload) {
    var found = false;
    var days = (payload && payload.days) || {};
    Object.keys(days).forEach(function (dk) {
      if (found) return;
      var shard = days[dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      var i;
      for (i = 0; i < shard.expenses.length; i++) {
        if (!isRowDeleted(shard.expenses[i])) {
          found = true;
          break;
        }
      }
    });
    return found;
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
      schemaVersion: DATA_SCHEMA_VERSION,
      dataUpdatedAt:
        typeof app.dataUpdatedAt === "number" && app.dataUpdatedAt > 0
          ? Math.round(app.dataUpdatedAt)
          : 0,
      months: app.months,
      days: app.days,
      fixedTemplates: app.fixedTemplates,
      settings: app.settings,
      categories: app.categories,
      spendingJars: app.spendingJars,
      configDataUpdatedAt:
        typeof app.configDataUpdatedAt === "number" && app.configDataUpdatedAt > 0
          ? Math.round(app.configDataUpdatedAt)
          : 0,
      configNeedSync: !!app.configNeedSync,
    };
  }

  function bumpDataRevision() {
    app.dataUpdatedAt = nowTs();
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

  /** Gộp danh mục theo id; bên có configDataUpdatedAt mới hơn thắng khi trùng id. */
  function mergeCategoriesByConfigTime(remote, local, rAt, lAt) {
    var map = {};
    (Array.isArray(remote) ? remote : []).forEach(function (c) {
      var row = normalizeCategoryRow(c);
      map[row.id] = { row: row, at: rAt };
    });
    (Array.isArray(local) ? local : []).forEach(function (c) {
      var row = normalizeCategoryRow(c);
      var prev = map[row.id];
      if (!prev || lAt > prev.at) {
        map[row.id] = { row: row, at: lAt };
      }
    });
    var out = [];
    Object.keys(map).forEach(function (id) {
      out.push(map[id].row);
    });
    return out;
  }

  /**
   * Hạn mức tháng: ưu tiên bên user đã chỉnh (incomeUserSet).
   * needSync do thêm chi không được ghi đè hạn mức cloud.
   */
  function mergeMonthIncomeMeta(rm, lm) {
    rm = rm || {};
    lm = lm || {};
    var rAt = rm.dataUpdatedAt || 0;
    var lAt = lm.dataUpdatedAt || 0;
    var ri = typeof rm.income === "number" ? rm.income : 0;
    var li = typeof lm.income === "number" ? lm.income : 0;
    var rUser = !!rm.incomeUserSet;
    var lUser = !!lm.incomeUserSet;
    if (lUser && !rUser) {
      return { income: li, incomeUserSet: true };
    }
    if (rUser && !lUser) {
      return { income: ri, incomeUserSet: true };
    }
    if (lUser && rUser) {
      if (lAt >= rAt) return { income: li, incomeUserSet: true };
      return { income: ri, incomeUserSet: true };
    }
    if (ri > 0 || li > 0) {
      if (rAt >= lAt && ri > 0) return { income: ri, incomeUserSet: false };
      if (li > 0) return { income: li, incomeUserSet: false };
      return { income: ri, incomeUserSet: false };
    }
    return { income: 0, incomeUserSet: false };
  }

  function mergeSpendingConfig(remote, local) {
    var rAt = remote.configDataUpdatedAt || 0;
    var lAt = local.configDataUpdatedAt || 0;
    var useLocal =
      local.configNeedSync && (lAt >= rAt || !remote.configNeedSync);
    var useRemote = remote.configNeedSync && rAt > lAt;
    var settingsBase = useRemote
      ? remote
      : useLocal
      ? local
      : rAt >= lAt
      ? remote
      : local;
    return {
      fixedTemplates: mergeRowsById(
        remote.fixedTemplates,
        local.fixedTemplates,
        function (t) {
          return t && t.id;
        },
        fixedTemplateUpdatedAt
      ),
      categories: mergeCategoriesByConfigTime(
        remote.categories,
        local.categories,
        rAt,
        lAt
      ),
      spendingJars: mergeRowsById(
        remote.spendingJars || [],
        local.spendingJars || [],
        function (j) {
          return j && j.id;
        },
        jarUpdatedAt
      ).map(normalizeSpendingJarRow),
      settings: (function () {
        var merged = normalizeSettings(settingsBase.settings);
        var rCc = normalizeCreditCardSettings((remote.settings || {}).creditCard);
        var lCc = normalizeCreditCardSettings((local.settings || {}).creditCard);
        var paid = {};
        (rCc.paidCycleEnds || []).forEach(function (k) {
          paid[k] = true;
        });
        (lCc.paidCycleEnds || []).forEach(function (k) {
          paid[k] = true;
        });
        merged.creditCard.paidCycleEnds = Object.keys(paid).sort();
        return merged;
      })(),
      configDataUpdatedAt: Math.max(rAt, lAt),
      configNeedSync: false,
    };
  }

  function mergeDayShard(remoteShard, localShard) {
    var r = remoteShard || { expenses: [], dataUpdatedAt: 0, needSync: false };
    var l = localShard || { expenses: [], dataUpdatedAt: 0, needSync: false };
    var rAt = r.dataUpdatedAt || 0;
    var lAt = l.dataUpdatedAt || 0;
    if (!l.needSync && rAt <= lAt && !r.expenses.length && l.expenses.length) {
      return { expenses: l.expenses, dataUpdatedAt: lAt, needSync: false };
    }
    if (!l.needSync && rAt > lAt) {
      return {
        expenses: (r.expenses || []).map(normalizeExpenseRow),
        dataUpdatedAt: rAt,
        needSync: false,
      };
    }
    return {
      expenses: dedupeFixedExpensesInList(
        mergeRowsById(
          r.expenses || [],
          l.expenses || [],
          function (e) {
            return e && e.id;
          },
          expenseUpdatedAt
        ).map(normalizeExpenseRow)
      ),
      dataUpdatedAt: Math.max(rAt, lAt),
      needSync: false,
    };
  }

  function monthHasLiveExpenses(monthKey, dayMap) {
    var prefix = monthKey + "-";
    var keys = Object.keys(dayMap || {});
    var i;
    for (i = 0; i < keys.length; i++) {
      var dk = keys[i];
      if (dk.indexOf(prefix) !== 0) continue;
      var shard = dayMap[dk];
      if (
        shard &&
        Array.isArray(shard.expenses) &&
        shard.expenses.some(function (e) {
          return !isRowDeleted(e);
        })
      ) {
        return true;
      }
    }
    return false;
  }

  function mergePayloadForCloud(remotePayload, localPayload) {
    var remote = coercePayloadToV3(remotePayload || {});
    var local = coercePayloadToV3(localPayload || {});
    var cfg = mergeSpendingConfig(remote, local);
    var merged = {
      schemaVersion: DATA_SCHEMA_VERSION,
      dataUpdatedAt: Math.max(remote.dataUpdatedAt || 0, local.dataUpdatedAt || 0),
      months: {},
      days: {},
      fixedTemplates: cfg.fixedTemplates,
      categories: cfg.categories,
      spendingJars: cfg.spendingJars,
      settings: cfg.settings,
      configDataUpdatedAt: cfg.configDataUpdatedAt,
      configNeedSync: false,
    };
    var dayKeys = {};
    Object.keys(remote.days || {}).forEach(function (k) {
      dayKeys[k] = true;
    });
    Object.keys(local.days || {}).forEach(function (k) {
      dayKeys[k] = true;
    });
    Object.keys(dayKeys).forEach(function (dk) {
      var rShard = remote.days[dk];
      var lShard = local.days[dk];
      if (lShard && lShard.needSync) {
        merged.days[dk] = mergeDayShard(rShard, lShard);
        return;
      }
      if (rShard && (!lShard || (rShard.dataUpdatedAt || 0) > (lShard.dataUpdatedAt || 0))) {
        merged.days[dk] = mergeDayShard(rShard, lShard);
        return;
      }
      if (lShard) {
        merged.days[dk] = normalizeDayShard(lShard);
        merged.days[dk].needSync = false;
        return;
      }
      if (rShard) {
        merged.days[dk] = normalizeDayShard(rShard);
        merged.days[dk].needSync = false;
      }
    });
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
        var localMonthAlive =
          lmDeletedAt <= 0 &&
          ((typeof lm.income === "number" && lm.income > 0) ||
            monthHasLiveExpenses(k, local.days));
        if (!localMonthAlive) {
          var delAt = rmDeletedAt >= lmDeletedAt ? rmDeletedAt : lmDeletedAt;
          merged.months[k] = {
            deletedAt: delAt,
            income: 0,
            incomeUserSet: false,
            dataUpdatedAt: delAt,
            needSync: false,
          };
          var prefix = k + "-";
          Object.keys(merged.days).forEach(function (dk) {
            if (dk.indexOf(prefix) === 0) delete merged.days[dk];
          });
          return;
        }
      }
      var rAt = rm.dataUpdatedAt || 0;
      var lAt = lm.dataUpdatedAt || 0;
      var incomeMeta = mergeMonthIncomeMeta(rm, lm);
      merged.months[k] = {
        income: incomeMeta.income,
        incomeUserSet: incomeMeta.incomeUserSet,
        dataUpdatedAt: Math.max(rAt, lAt),
        needSync: false,
      };
    });
    dedupeFixedExpensesAllMonths(merged.days);
    return merged;
  }

  function readLocalPayloadFromDisk() {
    try {
      var raw = localStorage.getItem(STORAGE_V3);
      if (!raw) return null;
      return coercePayloadToV3(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function saveAppDataToLocal() {
    if (migrationPending) return;
    try {
      localStorage.setItem(STORAGE_V3, JSON.stringify(getAppPayload()));
    } catch (e) {
      console.warn("Không ghi được localStorage:", e);
    }
  }

  function markPendingCloudPush() {
    try {
      localStorage.setItem(STORAGE_PENDING_CLOUD_PUSH, "1");
    } catch (e) {}
  }

  function consumePendingCloudPush() {
    try {
      if (localStorage.getItem(STORAGE_PENDING_CLOUD_PUSH) !== "1") return false;
      localStorage.removeItem(STORAGE_PENDING_CLOUD_PUSH);
      return true;
    } catch (e2) {
      return false;
    }
  }

  /**
   * @param {{ forceLocal?: boolean, skipFlush?: boolean }} [opts]
   * forceLocal: ghi đè cloud bằng payload local (sau import backup đầy đủ).
   * skipFlush: không ghi state tháng đang mở vào app.days trước sync (dùng sau import).
   */
  async function syncToSupabaseNow(opts) {
    opts = opts || {};
    if (!supabaseEnabled || !supabaseClient || isApplyingCloudSnapshot) return;
    if (syncInFlight) {
      syncPending = true;
      syncPendingOpts = mergeSyncOpts(syncPendingOpts, opts);
      return;
    }
    syncInFlight = true;
    try {
      var mergedPayload;
      var remotePayload = null;
      var forceLocal = !!opts.forceLocal;
      var skipFlush = !!opts.skipFlush;
      try {
        var remoteRes = await supabaseClient
          .from(SUPABASE_TABLE)
          .select("payload")
          .eq("id", SUPABASE_STATE_ID)
          .maybeSingle();
        var localPayload = skipFlush ? getAppPayload() : getAppPayloadForSync();
        if (!remoteRes.error && remoteRes.data && remoteRes.data.payload) {
          remotePayload = remoteRes.data.payload;
        }
        if (forceLocal) {
          mergedPayload = coercePayloadToV3(localPayload);
        } else if (remotePayload) {
          mergedPayload = mergePayloadForCloud(remotePayload, localPayload);
        } else {
          mergedPayload = coercePayloadToV3(localPayload);
        }
      } catch (eRemote) {
        mergedPayload = coercePayloadToV3(
          skipFlush ? getAppPayload() : getAppPayloadForSync()
        );
      }
      var mergedSig = wirePayloadSignature(mergedPayload);
      var remoteSig = remotePayload ? wirePayloadSignature(remotePayload) : "";
      if (!forceLocal && mergedSig && mergedSig === remoteSig) {
        lastSyncedPayload = mergedSig;
        return;
      }
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
          lastSyncedPayload = mergedSig;
        } catch (e2) {
          lastSyncedPayload = "";
        }
        applyNormalizedAppData(mergedPayload);
        clearAllSyncFlagsOnApp();
        saveAppDataToLocal();
        refreshMonthUiAfterCloudMerge();
        setAuthSyncHint(
          forceLocal ? "Đã ghi đè cloud bằng dữ liệu trên máy này." : "Đã lưu lên cloud.",
          "ok"
        );
      } else {
        console.warn("Supabase sync failed:", res.error.message);
        setAuthSyncHint("Không ghi được cloud: " + res.error.message, "error");
      }
    } finally {
      syncInFlight = false;
      if (syncPending) {
        var nextOpts = mergeSyncOpts(opts, syncPendingOpts);
        syncPending = false;
        syncPendingOpts = null;
        void syncToSupabaseNow(nextOpts);
      }
    }
  }

  function mergeSyncOpts(a, b) {
    if (!a) return b || {};
    if (!b) return a || {};
    return {
      forceLocal: !!(a.forceLocal || b.forceLocal),
      skipFlush: !!(a.skipFlush || b.skipFlush),
    };
  }

  function queueSupabaseSync(immediate) {
    if (!supabaseEnabled || isApplyingCloudSnapshot) return;
    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    if (immediate) {
      void syncToSupabaseNow();
      return;
    }
    cloudSyncTimer = setTimeout(function () {
      cloudSyncTimer = null;
      syncToSupabaseNow();
    }, 350);
  }

  /** Ghi localStorage ngay (sau flush state → app.months). */
  function persistLocalNow() {
    touchLocalData();
    flushActiveMonthIntoApp();
    bumpDataRevision();
    saveAppDataToLocal();
  }

  /**
   * @param {{ immediateSync?: boolean, sync?: boolean }} [opts]
   * immediateSync: đẩy cloud ngay; mặc định debounce 350ms.
   * sync: false = chỉ local.
   */
  function saveAppData(opts) {
    opts = opts || {};
    if (opts.configDirty) markConfigDirty();
    if (!migrationPending) persistLocalNow();
    if (migrationPending || opts.sync === false) return;
    queueSupabaseSync(!!opts.immediateSync);
  }

  async function saveAppDataAsync(opts) {
    opts = opts || {};
    if (opts.configDirty) markConfigDirty();
    if (!migrationPending) persistLocalNow();
    if (migrationPending || opts.sync === false) return;
    if (opts.immediateSync) {
      await syncToSupabaseNow();
    } else {
      queueSupabaseSync(false);
    }
  }

  var app = loadAppData();
  if (typeof app.dataUpdatedAt !== "number") app.dataUpdatedAt = 0;
  if (!app.days || typeof app.days !== "object") app.days = {};
  if (!app.months || typeof app.months !== "object") app.months = {};
  if (typeof app.configDataUpdatedAt !== "number") app.configDataUpdatedAt = 0;
  if (app.configNeedSync === undefined) app.configNeedSync = false;
  if (!Array.isArray(app.fixedTemplates)) app.fixedTemplates = defaultFixedTemplates();
  if (!app.settings || typeof app.settings !== "object") app.settings = defaultSettings();
  app.settings = normalizeSettings(app.settings);

  function applyThemeSettings() {
    var root = document.documentElement;
    var s = app && app.settings ? app.settings : defaultSettings();
    var p = THEME_PRESETS[normalizeThemeMode(s.themeMode)];
    root.style.setProperty("--app-bg", p.appBg);
    root.style.setProperty("--app-text", p.appText);
    root.style.setProperty("--text", p.appText);
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
    forEachExpenseInApp(function (e) {
      if (isRowDeleted(e)) return;
      add(e.category);
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
    var normalized = coercePayloadToV3(nextData);
    var preservedTheme = normalizeThemeMode(
      app && app.settings && app.settings.themeMode ? app.settings.themeMode : "dark"
    );
    app.schemaVersion = DATA_SCHEMA_VERSION;
    app.dataUpdatedAt =
      typeof normalized.dataUpdatedAt === "number" && normalized.dataUpdatedAt > 0
        ? Math.round(normalized.dataUpdatedAt)
        : 0;
    app.months = normalized.months;
    app.days = normalized.days;
    app.fixedTemplates = normalized.fixedTemplates;
    app.settings = normalizeSettings(normalized.settings);
    app.settings.themeMode = preservedTheme;
    app.categories = normalized.categories;
    app.configDataUpdatedAt = normalized.configDataUpdatedAt || 0;
    app.configNeedSync = !!normalized.configNeedSync;
    migrateAllMonthsIncomeUserSet();
    ensureAppCategories();
    app.spendingJars = Array.isArray(normalized.spendingJars)
      ? normalized.spendingJars.map(normalizeSpendingJarRow)
      : [];
    ensureSpendingJarsNormalized();
    normalizeAllFixedTemplates();
    rebindActiveMonthState({ skipFlush: true });
  }

  /**
   * Giữ `state` trỏ đúng tháng sau khi gộp cloud / import.
   * skipFlush: không ghi state cũ vào app.days (sau khi payload ngoài vừa thay thế local).
   */
  function rebindActiveMonthState(opts) {
    opts = opts || {};
    if (!activeMonthKey) return;
    if (!opts.skipFlush) flushActiveMonthIntoApp();
    var m = app.months[activeMonthKey];
    if (!m || isMonthDeleted(m)) return;
    state = buildMonthState(activeMonthKey);
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
          var remoteOnly = coercePayloadToV3(fetchRes.data.payload);
          var localPayload = getAppPayloadForSync();
          if (!payloadHasLiveExpenses(localPayload)) {
            var diskPayload = readLocalPayloadFromDisk();
            if (payloadHasLiveExpenses(diskPayload)) {
              localPayload = diskPayload;
            }
          }
          var merged;
          if (payloadHasLiveExpenses(localPayload)) {
            merged = mergePayloadForCloud(fetchRes.data.payload, localPayload);
          } else if (payloadHasLiveExpenses(remoteOnly)) {
            merged = remoteOnly;
          } else {
            merged = coercePayloadToV3(localPayload);
          }
          applyCloudMergedPayload(merged);
          setAuthSyncHint("Đã gộp dữ liệu máy + cloud.", "ok");
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
      flushActiveMonthIntoApp();
      var activeMonthPin = pinActiveMonthSnapshot();
      var fetchRes = await supabaseClient
        .from(SUPABASE_TABLE)
        .select("payload")
        .eq("id", SUPABASE_STATE_ID)
        .maybeSingle();
      if (fetchRes.error) {
        setAuthSyncHint("Không đọc cloud: " + fetchRes.error.message, "error");
        return;
      }
      flushActiveMonthIntoApp();
      var localPayload = getAppPayloadForSync();
      var merged;
      if (fetchRes.data && fetchRes.data.payload) {
        merged = mergePayloadForCloud(fetchRes.data.payload, localPayload);
      } else {
        merged = coercePayloadToV3(localPayload);
      }
      merged = mergePinnedActiveMonth(merged, activeMonthPin);
      isApplyingCloudSnapshot = true;
      try {
        applyCloudMergedPayload(merged);
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
        },
        function (payload) {
          if (!payload || !payload.new) return;
          if (payload.new.id !== SUPABASE_STATE_ID || !payload.new.payload) return;
          var cloudData = coercePayloadToV3(payload.new.payload);
          var cloudSig = wirePayloadSignature(cloudData);
          if (cloudSig === lastSyncedPayload) return;
          isApplyingCloudSnapshot = true;
          try {
            var localPayload = getAppPayloadForSync();
            var merged = mergePayloadForCloud(cloudData, localPayload);
            applyCloudMergedPayload(merged);
            setAuthSyncHint("Đã nhận cập nhật từ cloud.", "ok");
          } finally {
            isApplyingCloudSnapshot = false;
          }
        }
      )
      .subscribe(function (status, err) {
        if (status === "SUBSCRIBED") {
          setAuthSyncHint("Realtime cloud đã kết nối.", "ok");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("Supabase Realtime:", status, err || "");
          setAuthSyncHint(
            "Realtime cloud ngắt — vẫn tự kéo cloud mỗi " +
              Math.round(CLOUD_POLL_MS / 1000) +
              "s hoặc khi mở lại app.",
            "error"
          );
          setTimeout(function () {
            if (supabaseEnabled) attachSupabaseRealtime();
          }, 4000);
        }
      });
  }

  async function enableSupabaseSyncBySession(session) {
    if (!session || !session.user) return;
    supabaseEnabled = true;
    supabaseUserEmail = session.user.email || "";
    var pendingPush = consumePendingCloudPush();
    if (pendingPush) {
      await syncToSupabaseNow({ forceLocal: true, skipFlush: true });
    } else {
      await pullSupabaseStateAndRender();
      await syncToSupabaseNow();
    }
    attachSupabaseRealtime();
    startCloudPoll();
    renderAuthUi();
  }

  async function disableSupabaseSync() {
    supabaseEnabled = false;
    supabaseUserEmail = "";
    lastSyncedPayload = "";
    stopCloudPoll();
    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
    }
    detachSupabaseChannel();
    setAuthSyncHint("", "");
    renderAuthUi();
  }

  function resumeCloudSyncFromBackground() {
    if (!supabaseEnabled || !supabaseClient) return;
    attachSupabaseRealtime();
    void (async function () {
      await syncToSupabaseNow();
      await pullSupabaseStateAndRender();
    })();
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
    if (!app || !Array.isArray(app.categories)) return null;
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
    if (!app || !Array.isArray(app.categories) || !app.categories[0]) {
      return "cat-an-uong";
    }
    return app.categories[0].id;
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

  function findJarIdForCategory(catId) {
    if (!catId || !Array.isArray(app.spendingJars)) return "";
    var i;
    for (i = 0; i < app.spendingJars.length; i++) {
      var j = app.spendingJars[i];
      if ((j.categoryIds || []).indexOf(catId) >= 0) return j.id;
    }
    return "";
  }

  function setCategoryJarAssignment(catId, jarId) {
    if (!catId || !categoryIdExists(catId)) return;
    ensureSpendingJarsNormalized();
    if (jarId && findSpendingJar(jarId)) {
      reserveCategoriesForJar(jarId, [catId]);
      var jar = findSpendingJar(jarId);
      var ids = (jar.categoryIds || []).slice();
      if (ids.indexOf(catId) < 0) {
        ids.push(catId);
        jar.categoryIds = ids;
        jar.updatedAt = nowTs();
      }
    } else {
      app.spendingJars.forEach(function (j) {
        var prev = j.categoryIds || [];
        var next = prev.filter(function (id) {
          return id !== catId;
        });
        if (next.length !== prev.length) {
          j.categoryIds = next;
          j.updatedAt = nowTs();
        }
      });
    }
    dedupeJarCategoriesExclusive();
  }

  function renderCategoryJarPicker(pickerEl, hiddenInputEl, selectedJarId) {
    if (!pickerEl || !hiddenInputEl) return;
    ensureSpendingJarsNormalized();
    var sel = selectedJarId && findSpendingJar(selectedJarId) ? selectedJarId : "";
    hiddenInputEl.value = sel;
    pickerEl.innerHTML = "";

    function appendJarOption(jarId, label, color, isOther) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "category-jar-picker-btn" + (jarId === sel ? " is-selected" : "");
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", jarId === sel ? "true" : "false");
      btn.dataset.jarId = jarId;

      var pigWrap = document.createElement("span");
      pigWrap.className =
        "category-jar-picker-pig" + (isOther ? " is-other" : "");
      pigWrap.appendChild(piggyBankUseSvg(color || CONSOLIDATED_JAR_COLOR, 32));

      var text = document.createElement("span");
      text.className = "category-jar-picker-label";
      text.textContent = label;

      btn.appendChild(pigWrap);
      btn.appendChild(text);
      btn.addEventListener("click", function () {
        hiddenInputEl.value = jarId;
        renderCategoryJarPicker(pickerEl, hiddenInputEl, jarId);
      });
      pickerEl.appendChild(btn);
    }

    appendJarOption("", "Chưa gắn hũ (Khác)", CONSOLIDATED_JAR_COLOR, true);
    (app.spendingJars || []).forEach(function (j) {
      appendJarOption(j.id, j.label, j.color, false);
    });
  }

  function readCategoryJarSelectValue(hiddenInputEl) {
    if (!hiddenInputEl) return "";
    var v = hiddenInputEl.value || "";
    return findSpendingJar(v) ? v : "";
  }

  function readCategoryJarPickerValue(hiddenInputEl, pickerEl) {
    var v = readCategoryJarSelectValue(hiddenInputEl);
    if (v) return v;
    if (!pickerEl) return "";
    var selected = pickerEl.querySelector(".category-jar-picker-btn.is-selected");
    var selectedId = selected ? selected.dataset.jarId || "" : "";
    return findSpendingJar(selectedId) ? selectedId : "";
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

  function computeJarSpentForMonth(monthKey, jar) {
    if (!monthKey || !jar) return 0;
    var expenses = getMonthExpenses(monthKey);
    var set = {};
    (jar.categoryIds || []).forEach(function (id) {
      set[id] = true;
    });
    return expenses.reduce(function (s, e) {
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

  function computeSpentForCategories(monthKey, categoryIds) {
    if (!monthKey || !categoryIds.length) return 0;
    var expenses = getMonthExpenses(monthKey);
    var set = {};
    categoryIds.forEach(function (id) {
      set[id] = true;
    });
    return expenses.reduce(function (s, e) {
      if (isRowDeleted(e)) return s;
      if (set[e.category]) return s + e.amount;
      return s;
    }, 0);
  }

  function reassignCategoryEverywhere(fromId, toId) {
    forEachExpenseInApp(function (e, dk) {
      if (e.category === fromId) {
        e.category = toId;
        e.updatedAt = nowTs();
        markDayDirty(dk);
      }
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
  /** null = không lọc; 1…31 = ngày trong tháng `activeMonthKey`. */
  var expenseListFilterDayNum = null;
  /** Lưới ngày chỉ hiện sau khi user bấm nút «Ngày». */
  var expenseListDayGridExpanded = false;
  /** `${monthKey}:${daysInMonth}` — chỉ rebuild DOM lưới ngày khi seal đổi. */
  var expenseListDayGridSeal = "";
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
        incomeUserSet: false,
        dataUpdatedAt: 0,
        needSync: false,
      };
    }
    if (isMonthDeleted(app.months[k])) {
      app.months[k].deletedAt = 0;
      app.months[k].income = 0;
      app.months[k].incomeUserSet = false;
      app.months[k].dataUpdatedAt = 0;
      app.months[k].needSync = false;
    }
    if (typeof app.months[k].income !== "number") app.months[k].income = 0;
    if (app.months[k].dataUpdatedAt === undefined) app.months[k].dataUpdatedAt = 0;
    if (app.months[k].needSync === undefined) app.months[k].needSync = false;
    migrateMonthIncomeUserSet(app.months[k]);
    return app.months[k];
  }

  /**
   * Gộp `state` (tháng đang mở) vào `app.months` + `app.days` trước khi lưu/sync.
   */
  function flushActiveMonthIntoApp() {
    if (!activeMonthKey || !state) return;
    var m = ensureMonth(activeMonthKey);
    m.income = typeof state.income === "number" ? state.income : 0;
    m.incomeUserSet = !!state.incomeUserSet;
    if (state.expenses) {
      flushExpensesToDays(activeMonthKey, state.expenses);
    }
    if (state.deletedAt) m.deletedAt = state.deletedAt;
    markMonthMetaDirty(activeMonthKey);
    state = buildMonthState(activeMonthKey);
  }

  function getAppPayloadForSync() {
    flushActiveMonthIntoApp();
    return getAppPayload();
  }

  function totalExpensesForMonthKey(monthKey) {
    return getMonthExpenses(monthKey).reduce(function (s, e) {
      if (isRowDeleted(e)) return s;
      return s + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
  }

  function monthHasData(k) {
    var m = app.months[k];
    if (!m) return false;
    if (isMonthDeleted(m)) return false;
    if ((m.income || 0) > 0) return true;
    return getMonthExpenses(k).some(function (e) {
      return !isRowDeleted(e);
    });
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

  function exportableMonthKeys() {
    var out = [];
    flushActiveMonthIntoApp();
    Object.keys(app.months || {}).forEach(function (k) {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(k) && monthHasData(k)) out.push(k);
    });
    out.sort(function (a, b) {
      return b.localeCompare(a);
    });
    return out;
  }

  function setSettingsDataStatus(message, kind) {
    if (!elSettingsDataStatus) return;
    if (!message) {
      elSettingsDataStatus.textContent = "";
      elSettingsDataStatus.hidden = true;
      elSettingsDataStatus.classList.remove("is-error", "is-ok");
      return;
    }
    elSettingsDataStatus.textContent = message;
    elSettingsDataStatus.hidden = false;
    elSettingsDataStatus.classList.toggle("is-error", kind === "error");
    elSettingsDataStatus.classList.toggle("is-ok", kind === "ok");
  }

  function selectedExportMonthKeys() {
    if (!elSettingsExportMonths) return [];
    var out = [];
    var inputs = elSettingsExportMonths.querySelectorAll(
      'input[type="checkbox"][data-month-key]'
    );
    var i;
    for (i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) out.push(inputs[i].getAttribute("data-month-key"));
    }
    return out;
  }

  function syncExportToggleAllLabel() {
    if (!elBtnExportDataToggleAll || !elSettingsExportMonths) return;
    var inputs = elSettingsExportMonths.querySelectorAll(
      'input[type="checkbox"][data-month-key]'
    );
    var checked = elSettingsExportMonths.querySelectorAll(
      'input[type="checkbox"][data-month-key]:checked'
    );
    elBtnExportDataToggleAll.textContent =
      inputs.length > 0 && checked.length === inputs.length ? "Bỏ chọn" : "Tất cả";
    elBtnExportDataToggleAll.disabled = inputs.length === 0;
  }

  function renderExportMonthPicker() {
    if (!elSettingsExportMonths) return;
    var keys = exportableMonthKeys();
    elSettingsExportMonths.innerHTML = "";
    if (!keys.length) {
      var empty = document.createElement("p");
      empty.className = "settings-export-empty";
      empty.textContent = "Chưa có tháng nào có dữ liệu để export.";
      elSettingsExportMonths.appendChild(empty);
      if (elBtnExportData) elBtnExportData.disabled = true;
      syncExportToggleAllLabel();
      return;
    }
    if (elBtnExportData) elBtnExportData.disabled = false;
    keys.forEach(function (key) {
      var label = document.createElement("label");
      label.className = "settings-export-month-row";

      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = true;
      input.setAttribute("data-month-key", key);
      input.addEventListener("change", syncExportToggleAllLabel);

      var text = document.createElement("span");
      text.className = "settings-export-month-text";
      text.textContent = formatMonthKeyVi(key);

      var meta = document.createElement("span");
      meta.className = "settings-export-month-meta";
      var month = app.months[key] || {};
      var liveExpenseCount = getMonthExpenses(key).filter(function (e) {
        return !isRowDeleted(e);
      }).length;
      meta.textContent =
        liveExpenseCount +
        " khoản" +
        ((month.income || 0) > 0 ? " · " + formatMoneyVNDShort(month.income) : "");

      label.appendChild(input);
      label.appendChild(text);
      label.appendChild(meta);
      elSettingsExportMonths.appendChild(label);
    });
    syncExportToggleAllLabel();
  }

  function buildBackupPayload(monthKeys) {
    flushActiveMonthIntoApp();
    var keySet = {};
    monthKeys.forEach(function (k) {
      keySet[k] = true;
    });
    var months = {};
    var days = {};
    Object.keys(app.months || {}).forEach(function (k) {
      if (keySet[k] && app.months[k] && !isMonthDeleted(app.months[k])) {
        months[k] = normalizeMonthMeta(app.months[k], k);
      }
    });
    Object.keys(app.days || {}).forEach(function (dk) {
      var mk = dk.slice(0, 7);
      if (keySet[mk] && app.days[dk]) {
        days[dk] = normalizeDayShard(app.days[dk]);
      }
    });
    var data = getAppPayload();
    data.months = months;
    data.days = days;
    return {
      app: "Personal Finance Optimization",
      type: "family-budget-backup",
      version: DATA_SCHEMA_VERSION,
      storageKey: STORAGE_V3,
      exportedAt: new Date().toISOString(),
      data: data,
    };
  }

  function downloadJsonFile(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function exportSelectedData() {
    var selected = selectedExportMonthKeys();
    if (!selected.length) {
      setSettingsDataStatus("Chọn ít nhất một tháng để export.", "error");
      return;
    }
    var payload = buildBackupPayload(selected);
    var datePart = new Date().toISOString().slice(0, 10);
    downloadJsonFile("chi-tieu-tracker-backup-" + datePart + ".json", payload);
    var dayCount = Object.keys(payload.data.days || {}).length;
    var expenseCount = 0;
    Object.keys(payload.data.days || {}).forEach(function (dk) {
      var shard = payload.data.days[dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      expenseCount += shard.expenses.filter(function (e) {
        return !isRowDeleted(e);
      }).length;
    });
    setSettingsDataStatus(
      "Đã export v3: " +
        selected.length +
        " tháng, " +
        dayCount +
        " ngày, " +
        expenseCount +
        " khoản + toàn bộ cài đặt.",
      "ok"
    );
  }

  function detectBackupFormat(data, wrapper) {
    var w = wrapper && typeof wrapper === "object" ? wrapper : {};
    var d = data && typeof data === "object" ? data : {};
    var wrapperVer =
      typeof w.version === "number" && w.version > 0 ? Math.round(w.version) : 0;
    var schemaVer =
      typeof d.schemaVersion === "number" && d.schemaVersion > 0
        ? Math.round(d.schemaVersion)
        : 0;
    var hasDays = d.days && typeof d.days === "object";
    var hasMonthExpenses = false;
    Object.keys(d.months || {}).forEach(function (mk) {
      var m = d.months[mk];
      if (m && Array.isArray(m.expenses) && m.expenses.length) hasMonthExpenses = true;
    });
    if ((schemaVer >= DATA_SCHEMA_VERSION || wrapperVer >= DATA_SCHEMA_VERSION) && hasDays) {
      return { kind: "v3", wrapperVer: wrapperVer, schemaVer: schemaVer };
    }
    if (hasMonthExpenses || wrapperVer === 2 || schemaVer < DATA_SCHEMA_VERSION) {
      return { kind: "v2", wrapperVer: wrapperVer, schemaVer: schemaVer };
    }
    if (schemaVer >= DATA_SCHEMA_VERSION && !hasDays) {
      return { kind: "v3-incomplete", wrapperVer: wrapperVer, schemaVer: schemaVer };
    }
    return { kind: "v3", wrapperVer: wrapperVer, schemaVer: schemaVer };
  }

  function readImportBackupData(parsed) {
    var src = parsed && typeof parsed === "object" ? parsed : null;
    if (!src) throw new Error("File JSON không hợp lệ.");
    var hasWrapper = !!(src.data && typeof src.data === "object");
    var data = hasWrapper ? src.data : src;
    if (!data.months || typeof data.months !== "object") {
      throw new Error("File không có dữ liệu tháng hợp lệ.");
    }
    var fmt = detectBackupFormat(data, hasWrapper ? src : null);
    if (fmt.kind === "v3-incomplete") {
      throw new Error(
        "File backup v3 không hợp lệ (thiếu mục days). Hãy export lại từ app mới hoặc dùng file backup v2."
      );
    }
    var normalized = coercePayloadToV3(data);
    var liveExpenseCount = 0;
    Object.keys(normalized.days || {}).forEach(function (dk) {
      var shard = normalized.days[dk];
      if (!shard || !Array.isArray(shard.expenses)) return;
      shard.expenses.forEach(function (e) {
        if (!isRowDeleted(e)) liveExpenseCount += 1;
      });
    });
    if (liveExpenseCount === 0 && fmt.kind === "v2") {
      throw new Error("File backup v2 không có khoản chi nào sau khi chuyển đổi.");
    }
    normalized._importMeta = {
      format: fmt.kind,
      expenseCount: liveExpenseCount,
      monthCount: Object.keys(normalized.months || {}).length,
      dayCount: Object.keys(normalized.days || {}).length,
    };
    return normalized;
  }

  function replaceAppDataFromImport(nextData) {
    var normalized = coercePayloadToV3(nextData);
    var importedTheme = normalizeThemeMode(
      normalized && normalized.settings && normalized.settings.themeMode
    );
    migrationPending = false;
    activeMonthKey = null;
    state = null;
    expenseListFilter = "all";
    expenseListFilterDayNum = null;
    expenseListDayGridExpanded = false;
    applyNormalizedAppData(normalized);
    app.dataUpdatedAt = nowTs();
    app.configDataUpdatedAt = nowTs();
    app.configNeedSync = true;
    Object.keys(app.days || {}).forEach(function (dk) {
      markDayDirty(dk);
    });
    Object.keys(app.months || {}).forEach(function (mk) {
      markMonthMetaDirty(mk);
    });
    app.settings.themeMode = importedTheme;
    try {
      localStorage.removeItem(STORAGE_V1);
      localStorage.removeItem(STORAGE_V2);
      localStorage.setItem(STORAGE_V3, JSON.stringify(getAppPayload()));
    } catch (e) {
      throw new Error("Không thể ghi dữ liệu vào localStorage.");
    }
    applyThemeSettings();
    lastSyncedPayload = "";
    refreshAllCategorySelects();
    renderThemeModeOptions();
    renderFixedTemplatesList();
    renderSettingsCategoriesList();
    renderSettingsNewCategoryIconPicker();
    renderSettingsJarsList();
    renderExportMonthPicker();
    refreshSettingsDefaultLimitDisplay();
    showSettingsView();
    return exportableMonthKeys()[0] || currentMonthKey();
  }

  function runDataMigration() {
    var result = { ok: false, message: "", report: null, warnings: [] };
    try {
      var raw = localStorage.getItem(STORAGE_V2);
      if (!raw) {
        throw new Error("Không tìm thấy dữ liệu cũ (family-budget-v2) trên máy.");
      }
      var parsed = JSON.parse(raw);
      var migrated = migratePayloadV2ToV3(parsed);
      localStorage.setItem(STORAGE_V3, JSON.stringify(migrated.data));
      migrationPending = false;
      applyNormalizedAppData(migrated.data);
      migrateAllMonthsIncomeUserSet();
      ensureAppCategories();
      ensureSpendingJarsNormalized();
      normalizeAllFixedTemplates();
      applyThemeSettings();
      result.ok = true;
      result.report = migrated.report;
      result.warnings = migrated.report.warnings || [];
      result.message =
        "Đã chuyển " +
        migrated.report.expenseCount +
        " khoản chi → " +
        migrated.report.dayCount +
        " ngày, " +
        migrated.report.monthCount +
        " tháng.";
    } catch (e) {
      result.message = e && e.message ? e.message : "Migrate thất bại.";
    }
    return result;
  }

  function setMigrationModalStatus(text, kind) {
    if (!elMigrationStatus) return;
    if (!text) {
      elMigrationStatus.textContent = "";
      elMigrationStatus.hidden = true;
      elMigrationStatus.classList.remove("is-error", "is-ok");
      return;
    }
    elMigrationStatus.textContent = text;
    elMigrationStatus.hidden = false;
    elMigrationStatus.classList.toggle("is-error", kind === "error");
    elMigrationStatus.classList.toggle("is-ok", kind === "ok");
  }

  function showMigrationModal() {
    if (!elMigrationDialog) return;
    document.body.classList.add("migration-blocking");
    elMigrationDialog.hidden = false;
    elMigrationDialog.setAttribute("aria-hidden", "false");
    setMigrationModalStatus(
      "App đã đổi cấu trúc lưu trữ (theo ngày). Bấm «Migrate data» để chuyển dữ liệu cũ — không mất khoản chi.",
      ""
    );
  }

  function hideMigrationModal() {
    if (!elMigrationDialog) return;
    elMigrationDialog.hidden = true;
    elMigrationDialog.setAttribute("aria-hidden", "true");
    document.body.classList.remove("migration-blocking");
    setMigrationModalStatus("", "");
  }

  async function finishAppBootstrap(initialKey) {
    renderAuthUi();
    syncCreditCardFeatureVisibility();
    openMonth(initialKey, { skipUrl: true, sync: false, skipPersist: true });
    await initSupabaseSync(initialKey);
  }

  async function wipeAllAppData() {
    if (
      !confirm(
        "Xóa TOÀN BỘ dữ liệu chi tiêu, hạn mức, danh mục, hũ và khoản cố định trên máy này?\n\nHành động không thể hoàn tác. Nên export backup trước."
      )
    ) {
      return;
    }
    if (!confirm("Xác nhận lần cuối: bạn chắc chắn muốn xóa hết dữ liệu?")) {
      return;
    }
    migrationPending = false;
    var preservedTheme = normalizeThemeMode(
      app && app.settings && app.settings.themeMode ? app.settings.themeMode : "dark"
    );
    var empty = emptyV3AppData();
    empty.settings.themeMode = preservedTheme;
    applyNormalizedAppData(empty);
    app.configDataUpdatedAt = nowTs();
    app.configNeedSync = true;
    activeMonthKey = null;
    state = null;
    lastSyncedPayload = "";
    try {
      localStorage.removeItem(STORAGE_V1);
      localStorage.removeItem(STORAGE_V2);
      localStorage.setItem(STORAGE_V3, JSON.stringify(getAppPayload()));
      localStorage.removeItem(STORAGE_PENDING_CLOUD_PUSH);
    } catch (e) {
      setSettingsDataStatus("Không xóa được dữ liệu local.", "error");
      return;
    }
    applyThemeSettings();
    refreshAllCategorySelects();
    renderThemeModeOptions();
    renderFixedTemplatesList();
    renderSettingsCategoriesList();
    renderSettingsJarsList();
    renderExportMonthPicker();
    refreshSettingsDefaultLimitDisplay();
    openMonth(currentMonthKey(), { skipUrl: true, sync: false });
    if (supabaseEnabled && supabaseClient) {
      try {
        await syncToSupabaseNow({ forceLocal: true });
        setSettingsDataStatus("Đã xóa toàn bộ dữ liệu trên máy và cloud.", "ok");
      } catch (syncErr) {
        console.warn("wipe cloud:", syncErr);
        setSettingsDataStatus(
          "Đã xóa local. Không ghi được cloud — bấm «Đồng bộ cloud» khi có mạng.",
          "error"
        );
      }
    } else {
      setSettingsDataStatus("Đã xóa toàn bộ dữ liệu trên máy này.", "ok");
    }
    renderAllViews();
  }

  async function importDataFile(file) {
    if (!file) return;
    setSettingsDataStatus("", "");
    var text = await file.text();
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("File không phải JSON hợp lệ.");
    }
    var nextData = readImportBackupData(parsed);
    if (
      !confirm(
        "Import file này sẽ ghi đè toàn bộ dữ liệu tracking và cài đặt app đang lưu trên máy. Tiếp tục?"
      )
    ) {
      return;
    }
    var importMeta = nextData._importMeta || {};
    delete nextData._importMeta;
    var importMonthKey = replaceAppDataFromImport(nextData);
    var importDetail =
      importMeta.format === "v2"
        ? " (file v2 → " +
          (importMeta.expenseCount || 0) +
          " khoản / " +
          (importMeta.dayCount || 0) +
          " ngày)"
        : " (" +
          (importMeta.expenseCount || 0) +
          " khoản / " +
          (importMeta.dayCount || 0) +
          " ngày)";
    if (supabaseEnabled && supabaseClient) {
      lastSyncedPayload = "";
      try {
        while (syncInFlight) {
          await new Promise(function (r) {
            setTimeout(r, 40);
          });
        }
        await syncToSupabaseNow({ forceLocal: true, skipFlush: true });
        while (syncInFlight || syncPending) {
          await new Promise(function (r) {
            setTimeout(r, 40);
          });
        }
        setSettingsDataStatus(
          "Đã import" + importDetail + " và ghi đè cloud bằng file backup này.",
          "ok"
        );
      } catch (syncErr) {
        console.warn("import cloud sync:", syncErr);
        markPendingCloudPush();
        setSettingsDataStatus(
          "Đã import local" +
            importDetail +
            ". Không ghi được cloud — đăng nhập lại hoặc bấm «Đồng bộ cloud».",
          "error"
        );
      }
    } else {
      markPendingCloudPush();
      setSettingsDataStatus(
        "Đã import local" +
          importDetail +
          ". Đăng nhập cloud — app sẽ tự ghi đè cloud bằng file vừa import.",
        "ok"
      );
    }
    openMonth(importMonthKey, { sync: false });
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
  var elExpenseNameSuggestions = document.getElementById("expense-name-suggestions");
  var elAmount = document.getElementById("expense-amount");
  var elExpensePreview = document.getElementById("expense-amount-preview");
  var elForm = document.getElementById("expense-form");
  var elExpenseDate = document.getElementById("expense-date");
  var elExpenseTime = document.getElementById("expense-time");
  var elExpenseFixed = document.getElementById("expense-fixed");
  var elExpenseList = document.getElementById("expense-list");
  var elEmpty = document.getElementById("empty-state");
  var elExpenseFilterAll = document.getElementById("expense-filter-all");
  var elExpenseFilterFixed = document.getElementById("expense-filter-fixed");
  var elExpenseFilterFlex = document.getElementById("expense-filter-flex");
  var elExpenseListDayGrid = document.getElementById("expense-list-filter-day-grid");
  var elExpenseListDayFilterToggle = document.getElementById("expense-list-day-filter-toggle");
  var elExpenseListClearDay = document.getElementById("expense-list-clear-day");
  var elExpenseDayPickerDialog = document.getElementById("expense-day-picker-dialog");
  var elExpenseDayPickerBackdrop = document.getElementById("expense-day-picker-backdrop");
  var elExpenseDayPickerClose = document.getElementById("expense-day-picker-close");
  var elExpenseDayPickerDone = document.getElementById("expense-day-picker-done");
  var elReportModeJars = document.getElementById("report-mode-jars");
  var elReportModeDaily = document.getElementById("report-mode-daily");
  var elReportPieView = document.getElementById("report-pie-view");
  var elReportDailyView = document.getElementById("report-daily-view");
  var elReportDailyRangeMonth = document.getElementById("report-daily-range-month");
  var elReportDailyRange7Days = document.getElementById("report-daily-range-7days");
  var elReportDailyEmpty = document.getElementById("report-daily-empty");
  var elReportDailyScroll = document.getElementById("report-daily-scroll");
  var elReportDailyBars = document.getElementById("report-daily-bars");
  var elReportDailyDetail = document.getElementById("report-daily-detail");
  var elReportDailyDetailHeading = document.getElementById("report-daily-detail-heading");
  var elReportDailyDetailEmptyDay = document.getElementById("report-daily-detail-empty-day");
  var elReportDailyDetailList = document.getElementById("report-daily-detail-list");
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
  var elPieSliceLabels = document.getElementById("expense-pie-slice-labels");
  var elPieCenter = document.getElementById("expense-pie-center");
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
  var elSettingsDefaultLimitField = document.querySelector(".settings-default-limit-field");
  var elSettingsDefaultLimitView = document.getElementById("settings-default-limit-view");
  var elSettingsDefaultLimitDisplay = document.getElementById("settings-default-limit-display");
  var elSettingsDefaultLimitEditRow = document.getElementById("settings-default-limit-edit-row");
  var elSettingsDefaultLimitEditHint = document.getElementById("settings-default-limit-edit-hint");
  var elBtnSettingsDefaultLimitEdit = document.getElementById("btn-settings-default-limit-edit");
  var elBtnSettingsDefaultLimitSave = document.getElementById("btn-settings-default-limit-save");
  var elBtnSettingsDefaultLimitCancel = document.getElementById("btn-settings-default-limit-cancel");
  var settingsDefaultLimitBeforeEdit = 0;
  var elSettingsCreditCardEnabled = document.getElementById("settings-credit-card-enabled");
  var elSettingsCreditCardFields = document.getElementById("settings-credit-card-fields");
  var elSettingsCreditCardStatementDay = document.getElementById(
    "settings-credit-card-statement-day"
  );
  var elSettingsCreditCardDueDisplay = document.getElementById("settings-credit-card-due-display");
  var elExpenseCreditCardField = document.getElementById("expense-credit-card-field");
  var elExpenseCreditCard = document.getElementById("expense-credit-card");
  var elEditExpenseCreditCardField = document.getElementById("edit-expense-credit-card-field");
  var elEditExpenseCreditCard = document.getElementById("edit-expense-credit-card");
  var elCcReportCard = document.getElementById("cc-report-card");
  var elCcCycleOverview = document.getElementById("cc-cycle-overview");
  var elCcCategoryCycleCurrent = document.getElementById("cc-category-cycle-current");
  var elCcCategoryCyclePrevious = document.getElementById("cc-category-cycle-previous");
  var elCcCategoryEmpty = document.getElementById("cc-category-empty");
  var elCcCategoryBody = document.getElementById("cc-category-body");
  var elCcCategoryPieSlices = document.getElementById("cc-category-pie-slices");
  var elCcCategoryPieLabels = document.getElementById("cc-category-pie-labels");
  var elCcCategoryPieCenter = document.getElementById("cc-category-pie-center");
  var elCcCategoryLegend = document.getElementById("cc-category-legend");
  var elCcCategoryPieTitle = document.getElementById("cc-category-pie-title");
  var elCcTrendEmpty = document.getElementById("cc-trend-empty");
  var elCcTrendSvg = document.getElementById("cc-trend-svg");
  var elCcTimelineLargeOnly = document.getElementById("cc-timeline-large-only");
  var elCcTimelineEmpty = document.getElementById("cc-timeline-empty");
  var elCcTimelineList = document.getElementById("cc-timeline-list");
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
  var elSettingsExportMonths = document.getElementById("settings-export-months");
  var elBtnExportDataToggleAll = document.getElementById("btn-export-data-toggle-all");
  var elBtnExportData = document.getElementById("btn-export-data");
  var elBtnImportData = document.getElementById("btn-import-data");
  var elSettingsImportFile = document.getElementById("settings-import-file");
  var elSettingsDataStatus = document.getElementById("settings-data-status");
  var elBtnDeleteAllData = document.getElementById("btn-delete-all-data");
  var elMigrationDialog = document.getElementById("migration-dialog");
  var elMigrationBackdrop = document.getElementById("migration-backdrop");
  var elBtnMigrationRun = document.getElementById("btn-migration-run");
  var elMigrationStatus = document.getElementById("migration-status");
  var elSettingsCategoriesList = document.getElementById("settings-categories-list");
  var elSettingsAddCategoryPanel = document.getElementById("settings-add-category-panel");
  var elBtnSettingsShowAddCategory = document.getElementById("btn-settings-show-add-category");
  var elBtnSettingsCancelAddCategory = document.getElementById("btn-settings-cancel-add-category");
  var elSettingsAddCategoryForm = document.getElementById("settings-add-category-form");
  var elSettingsNewCategoryLabel = document.getElementById("settings-new-category-label");
  var elSettingsNewCategoryIcons = document.getElementById("settings-new-category-icons");
  var elSettingsNewCategoryIconId = document.getElementById("settings-new-category-icon-id");
  var elSettingsNewCategoryJar = document.getElementById("settings-new-category-jar");
  var elSettingsNewCategoryJarPicker = document.getElementById(
    "settings-new-category-jar-picker"
  );
  var elEditCategoryDialog = document.getElementById("edit-category-dialog");
  var elEditCategoryBackdrop = document.getElementById("edit-category-backdrop");
  var elEditCategoryLabelInput = document.getElementById("edit-category-label-input");
  var elEditCategoryIcons = document.getElementById("edit-category-icons");
  var elEditCategoryIconId = document.getElementById("edit-category-icon-id");
  var elEditCategoryJar = document.getElementById("edit-category-jar");
  var elEditCategoryJarPicker = document.getElementById("edit-category-jar-picker");
  var elEditCategorySave = document.getElementById("edit-category-save");
  var elEditCategoryCancel = document.getElementById("edit-category-cancel");
  var elEditCategoryDelete = document.getElementById("edit-category-delete");

  var elPieSvg = document.getElementById("expense-pie-svg");
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
  var elEditJarDelete = document.getElementById("edit-jar-delete");

  var elEditFixedDialog = document.getElementById("edit-fixed-template-dialog");
  var elEditFixedBackdrop = document.getElementById("edit-fixed-template-backdrop");
  var elEditFixedTitle = document.getElementById("edit-fixed-template-title");
  var elEditFixedCategory = document.getElementById("edit-fixed-template-category");
  var elEditFixedName = document.getElementById("edit-fixed-template-name");
  var elEditFixedAmount = document.getElementById("edit-fixed-template-amount");
  var elEditFixedAmountPreview = document.getElementById("edit-fixed-template-amount-preview");
  var elEditFixedSave = document.getElementById("edit-fixed-template-save");
  var elEditFixedCancel = document.getElementById("edit-fixed-template-cancel");
  var elEditFixedDelete = document.getElementById("edit-fixed-template-delete");

  var elFixedTemplatesList = document.getElementById("fixed-templates-list");

  var elEditDialog = document.getElementById("edit-expense-dialog");
  var elEditBackdrop = document.getElementById("edit-expense-backdrop");
  var elEditDesc = document.getElementById("edit-expense-desc");
  var elEditExpenseCategory = document.getElementById("edit-expense-category");
  var elEditExpenseName = document.getElementById("edit-expense-name");
  var elEditExpenseNameSuggestions = document.getElementById(
    "edit-expense-name-suggestions"
  );
  var expenseNameSuggestCtxAdd = {
    input: elName,
    list: elExpenseNameSuggestions,
    category: elCategory,
    hideTimer: null,
  };
  var expenseNameSuggestCtxEdit = {
    input: elEditExpenseName,
    list: elEditExpenseNameSuggestions,
    category: elEditExpenseCategory,
    hideTimer: null,
  };
  var elEditAmount = document.getElementById("edit-expense-amount");
  var elEditAmountPreview = document.getElementById("edit-expense-amount-preview");
  var elEditExpenseDate = document.getElementById("edit-expense-date");
  var elEditExpenseTime = document.getElementById("edit-expense-time");
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
  var reportMode = "jars";
  var creditReportCategoryCycle = "current";
  var creditReportLargeOnly = false;
  var CC_LARGE_EXPENSE_THRESHOLD = 1000000;
  var reportDailyRange = "month";
  var reportDailyNeedsAutoScroll = true;
  /** Ngày đang chọn trên biểu đồ theo ngày (YYYY-MM-DD), null = không chọn. */
  var reportDailySelectedDayKey = null;
  /** Hũ đang mở rộng trong danh sách báo cáo (id hũ hoặc CONSOLIDATED_JAR_ID). */
  var reportJarExpandedIds = {};
  /** Danh mục đang mở trong hũ báo cáo: key = jarKey + "\\x1f" + categoryId */
  var reportJarCatExpandedKeys = {};

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

  function updateModalOpenBodyLock() {
    var open =
      (elExpenseDayPickerDialog && !elExpenseDayPickerDialog.hidden) ||
      (elAuthDialog && !elAuthDialog.hidden) ||
      (elEditDialog && !elEditDialog.hidden) ||
      (elEditFixedDialog && !elEditFixedDialog.hidden) ||
      (elEditCategoryDialog && !elEditCategoryDialog.hidden) ||
      (elEditJarDialog && !elEditJarDialog.hidden);
    document.body.classList.toggle("modal-open", !!open);
  }

  function closeExpenseDayPicker() {
    if (!expenseListDayGridExpanded) return;
    expenseListDayGridExpanded = false;
    syncExpenseDayGridPanelUi();
  }

  function openAuthDialog() {
    if (!elAuthDialog) return;
    closeExpenseDayPicker();
    setAuthError("");
    if (elAuthPassword) elAuthPassword.value = "";
    if (elAuthEmail && !elAuthEmail.value && supabaseUserEmail) elAuthEmail.value = supabaseUserEmail;
    elAuthDialog.hidden = false;
    elAuthDialog.setAttribute("aria-hidden", "false");
    updateModalOpenBodyLock();
    setTimeout(function () {
      if (elAuthEmail) elAuthEmail.focus();
    }, 0);
  }

  function closeAuthDialog() {
    if (!elAuthDialog) return;
    elAuthDialog.hidden = true;
    elAuthDialog.setAttribute("aria-hidden", "true");
    setAuthError("");
    updateModalOpenBodyLock();
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

  /** Di chuyển phần tử trong mảng (thứ tự hiển thị giống kéo-thả vào dòng đích). */
  function reorderArrayMove(arr, fromIndex, toIndex) {
    if (!arr || fromIndex === toIndex) return false;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= arr.length ||
      toIndex >= arr.length
    ) {
      return false;
    }
    var item = arr.splice(fromIndex, 1)[0];
    var insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    arr.splice(insertAt, 0, item);
    return true;
  }

  /** Đổi thứ tự các khoản cố định (chỉ hàng chưa xóa), giữ nguyên chỗ các bản ghi đã xóa (tombstone). */
  function reorderVisibleFixedTemplates(fromVis, toVis) {
    if (fromVis === toVis) return false;
    var vis = [];
    var i;
    for (i = 0; i < app.fixedTemplates.length; i++) {
      if (!isRowDeleted(app.fixedTemplates[i])) vis.push(app.fixedTemplates[i]);
    }
    if (
      fromVis < 0 ||
      toVis < 0 ||
      fromVis >= vis.length ||
      toVis >= vis.length
    ) {
      return false;
    }
    var moved = vis.splice(fromVis, 1)[0];
    var insertAt = fromVis < toVis ? toVis - 1 : toVis;
    vis.splice(insertAt, 0, moved);
    var v = 0;
    for (i = 0; i < app.fixedTemplates.length; i++) {
      if (!isRowDeleted(app.fixedTemplates[i])) {
        app.fixedTemplates[i] = vis[v++];
      }
    }
    return true;
  }

  function iconDragGripSvg() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "settings-drag-grip-svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", "currentColor");
    g.setAttribute("stroke-width", "2.5");
    g.setAttribute("stroke-linecap", "round");
    var l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l1.setAttribute("x1", "5");
    l1.setAttribute("y1", "9");
    l1.setAttribute("x2", "19");
    l1.setAttribute("y2", "9");
    var l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l2.setAttribute("x1", "5");
    l2.setAttribute("y1", "15");
    l2.setAttribute("x2", "19");
    l2.setAttribute("y2", "15");
    g.appendChild(l1);
    g.appendChild(l2);
    svg.appendChild(g);
    return svg;
  }

  var settingsPointerDrag = null;

  function settingsPointerDragDetachGlobals() {
    document.removeEventListener("pointermove", settingsPointerDragOnMove);
    document.removeEventListener("pointerup", settingsPointerDragOnEnd);
    document.removeEventListener("pointercancel", settingsPointerDragOnEnd);
  }

  function settingsPointerDragOnMove(ev) {
    if (!settingsPointerDrag || ev.pointerId !== settingsPointerDrag.pointerId) return;
    ev.preventDefault();
    var ul = settingsPointerDrag.ul;
    var hit = document.elementFromPoint(ev.clientX, ev.clientY);
    var row = hit && hit.closest ? hit.closest("[data-drag-index]") : null;
    ul.querySelectorAll(".is-drag-drop-target").forEach(function (el) {
      el.classList.remove("is-drag-drop-target");
    });
    if (row && ul.contains(row) && row !== settingsPointerDrag.row) {
      row.classList.add("is-drag-drop-target");
    }
  }

  function settingsPointerDragOnEnd(ev) {
    if (!settingsPointerDrag || ev.pointerId !== settingsPointerDrag.pointerId) return;
    var sess = settingsPointerDrag;
    settingsPointerDrag = null;
    settingsPointerDragDetachGlobals();
    try {
      if (sess.handle && sess.pointerId != null) {
        sess.handle.releasePointerCapture(sess.pointerId);
      }
    } catch (eRel) {}

    sess.row.classList.remove("is-dragging-source");
    sess.ul.querySelectorAll(".is-drag-drop-target").forEach(function (el) {
      el.classList.remove("is-drag-drop-target");
    });
    document.body.classList.remove("settings-pointer-dragging");

    if (ev.type === "pointercancel") return;

    var hit = document.elementFromPoint(ev.clientX, ev.clientY);
    var row = hit && hit.closest ? hit.closest("[data-drag-index]") : null;
    var toIdx =
      row && sess.ul.contains(row)
        ? parseInt(row.getAttribute("data-drag-index"), 10)
        : NaN;
    if (!isNaN(toIdx) && toIdx !== sess.fromIdx) {
      sess.onReorder(sess.fromIdx, toIdx);
    }
  }

  /**
   * Cầm kéo chỉ từ handle (div); dùng Pointer Events để chạy trên mobile / Safari (HTML5 drag hay lỗi với nút).
   */
  function attachDragHandleToRow(li, dragIndex, ul, onReorder, listLength) {
    li.setAttribute("data-drag-index", String(dragIndex));
    var handle = document.createElement("div");
    handle.className = "settings-drag-handle";
    handle.setAttribute("role", "button");
    handle.setAttribute("tabindex", "0");
    handle.setAttribute(
      "aria-label",
      listLength > 1 ? "Giữ và kéo để đổi thứ tự" : "Chỉ có một mục — không đổi thứ tự được"
    );
    handle.appendChild(iconDragGripSvg());
    var canDrag = listLength > 1;
    if (!canDrag) {
      handle.classList.add("settings-drag-handle-static");
      handle.removeAttribute("tabindex");
      handle.setAttribute("aria-disabled", "true");
    }
    handle.addEventListener("pointerdown", function (ev) {
      if (!canDrag || ev.button !== 0) return;
      if (settingsPointerDrag) return;
      ev.preventDefault();
      settingsPointerDrag = {
        ul: ul,
        fromIdx: dragIndex,
        onReorder: onReorder,
        pointerId: ev.pointerId,
        row: li,
        handle: handle,
      };
      document.addEventListener("pointermove", settingsPointerDragOnMove, { passive: false });
      document.addEventListener("pointerup", settingsPointerDragOnEnd);
      document.addEventListener("pointercancel", settingsPointerDragOnEnd);
      li.classList.add("is-dragging-source");
      document.body.classList.add("settings-pointer-dragging");
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch (eCap) {}
    });
    return handle;
  }

  function afterFixedTemplatesReordered() {
    saveAppData({ configDirty: true });
    renderFixedTemplatesList();
  }

  function afterCategoriesReordered() {
    saveAppData({ configDirty: true });
    renderSettingsCategoriesList();
    renderNewJarCategoryCheckboxes();
    refreshAllCategorySelects();
    if (editingJarId) {
      var ej = (app.spendingJars || []).filter(function (x) {
        return x.id === editingJarId;
      })[0];
      if (ej && elEditJarCategories) {
        renderJarCategoryCheckboxes(elEditJarCategories, "jar-cat-edit", ej.categoryIds || []);
      }
    }
    if (activeMonthKey && state) persistAndRender();
  }

  function afterJarsReordered() {
    saveAppData({ configDirty: true });
    renderSettingsJarsList();
    if (activeMonthKey && state) persistAndRender();
  }

  function renderSettingsJarsList() {
    if (!elSettingsJarsList) return;
    ensureSpendingJarsNormalized();
    elSettingsJarsList.innerHTML = "";
    var jarsLen = (app.spendingJars || []).length;
    app.spendingJars.forEach(function (j, jIdx) {
      var li = document.createElement("li");
      li.className = "settings-jar-row";

      var handleJar = attachDragHandleToRow(
        li,
        jIdx,
        elSettingsJarsList,
        function (from, to) {
          if (!reorderArrayMove(app.spendingJars, from, to)) return;
          afterJarsReordered();
        },
        jarsLen
      );

      var pic = document.createElement("div");
      pic.className = "settings-jar-pig-wrap";
      pic.appendChild(piggyBankUseSvg(j.color, 44));

      var mid = document.createElement("div");
      mid.className = "settings-jar-mid";
      var titleRow = document.createElement("div");
      titleRow.className = "settings-jar-title-row";
      var title = document.createElement("span");
      title.className = "settings-jar-title";
      title.textContent = j.label;
      titleRow.appendChild(title);
      var meta = document.createElement("span");
      meta.className = "settings-jar-meta";
      var limText =
        j.limitAmount > 0
          ? "Hạn mức " + formatMoneyVNDShort(j.limitAmount)
          : "Chưa đặt hạn mức";
      var nCat = (j.categoryIds || []).length;
      meta.textContent = limText + " · " + nCat + " danh mục";
      mid.appendChild(titleRow);
      mid.appendChild(meta);

      var actions = document.createElement("div");
      actions.className = "settings-jar-actions";
      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn-icon btn-icon-muted settings-jar-edit-btn";
      btnEdit.setAttribute("aria-label", "Sửa hũ");
      var pencilIco = iconPencilSvg();
      pencilIco.setAttribute("width", "17");
      pencilIco.setAttribute("height", "17");
      btnEdit.appendChild(pencilIco);
      btnEdit.addEventListener("click", function () {
        openEditJarDialog(j.id);
      });

      actions.appendChild(btnEdit);

      li.appendChild(handleJar);
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
    if (elSettingsNewCategoryIconId) elSettingsNewCategoryIconId.value = "food";
    renderSettingsNewCategoryIconPicker();
    renderCategoryJarPicker(
      elSettingsNewCategoryJarPicker,
      elSettingsNewCategoryJar,
      ""
    );
  }

  function setSettingsAddCategoryPanelOpen(open) {
    if (elSettingsAddCategoryPanel) {
      elSettingsAddCategoryPanel.hidden = !open;
      if (open) elSettingsAddCategoryPanel.removeAttribute("aria-hidden");
      else elSettingsAddCategoryPanel.setAttribute("aria-hidden", "true");
    }
    if (elBtnSettingsShowAddCategory) elBtnSettingsShowAddCategory.hidden = !!open;
    if (open) {
      renderCategoryJarPicker(
        elSettingsNewCategoryJarPicker,
        elSettingsNewCategoryJar,
        ""
      );
    } else {
      resetSettingsAddCategoryForm();
    }
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

  function reportJarCatExpandKey(jarKey, categoryId) {
    return jarKey + "\x1f" + categoryId;
  }

  function getMonthExpensesForCategory(categoryId) {
    if (!state || !Array.isArray(state.expenses) || !categoryId) return [];
    return state.expenses
      .filter(function (e) {
        return !isRowDeleted(e) && e.category === categoryId;
      })
      .sort(function (a, b) {
        var at = expenseDateTs(a);
        var bt = expenseDateTs(b);
        if (at !== bt) return bt - at;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
  }

  function reportJarExpenseGroupKey(displayName) {
    return String(displayName || "")
      .trim()
      .toLocaleLowerCase("vi");
  }

  /** Gộp khoản chi cùng tên (không phân biệt hoa thường) cho báo cáo hũ. */
  function groupReportJarExpensesForDisplay(expenses) {
    var map = {};
    var order = [];
    expenses.forEach(function (e) {
      var name = expenseDisplayName(e);
      var key = reportJarExpenseGroupKey(name);
      if (!key) key = "\x00";
      if (!map[key]) {
        map[key] = {
          displayName: name,
          amount: 0,
          hasFixed: false,
          needsReview: false,
        };
        order.push(key);
      }
      var g = map[key];
      g.amount += Number(e.amount) || 0;
      if (isFixedExpenseRow(e)) g.hasFixed = true;
      if (isFixedExpenseNeedsMonthReview(e)) g.needsReview = true;
    });
    return order.map(function (k) {
      return map[k];
    });
  }

  function appendReportJarCategoryRow(childList, jarKey, row, jarSpent) {
    var catExpandKey = reportJarCatExpandKey(jarKey, row.id);
    var catItem = document.createElement("li");
    catItem.className = "report-jar-cat-item";

    var catDetails = document.createElement("details");
    catDetails.className = "report-jar-cat-details";
    if (reportJarCatExpandedKeys[catExpandKey]) catDetails.open = true;
    catDetails.addEventListener("toggle", function () {
      if (catDetails.open) reportJarCatExpandedKeys[catExpandKey] = true;
      else delete reportJarCatExpandedKeys[catExpandKey];
    });

    var catSummary = document.createElement("summary");
    catSummary.className =
      "report-jar-cat-summary" + (row.amount <= 0 ? " is-zero" : "");

    var left = document.createElement("span");
    left.className = "report-jar-cat-left";
    var sym = document.createElement("span");
    sym.className = "report-jar-cat-sym";
    sym.textContent = row.sym;
    sym.setAttribute("aria-hidden", "true");
    var lab = document.createElement("span");
    lab.className = "report-jar-cat-label";
    lab.textContent = row.label;
    left.appendChild(sym);
    left.appendChild(lab);

    var right = document.createElement("span");
    right.className = "report-jar-cat-amt";
    if (row.amount > 0) {
      var pctJar = jarSpent > 0 ? Math.round((row.amount / jarSpent) * 100) : 0;
      right.textContent =
        formatMoneyVNDShort(row.amount) +
        (pctJar > 0 ? " · " + pctJar + "%" : "");
    } else {
      right.textContent = "—";
    }

    catSummary.appendChild(left);
    catSummary.appendChild(right);

    var catPanel = document.createElement("div");
    catPanel.className = "report-jar-cat-children";
    var expList = document.createElement("ul");
    expList.className = "report-jar-expense-list";

    var expenses = getMonthExpensesForCategory(row.id);
    if (!expenses.length) {
      var emptyExp = document.createElement("li");
      emptyExp.className = "report-jar-expense-empty";
      emptyExp.textContent = "Chưa có khoản chi trong tháng";
      expList.appendChild(emptyExp);
    } else {
      groupReportJarExpensesForDisplay(expenses).forEach(function (row) {
        var expLi = document.createElement("li");
        expLi.className = "report-jar-expense-row";

        var expLeft = document.createElement("span");
        expLeft.className = "report-jar-expense-left";

        var expName = document.createElement("span");
        expName.className = "report-jar-expense-name";
        expName.textContent = row.displayName;
        expLeft.appendChild(expName);

        if (row.hasFixed) {
          var fixedTag = document.createElement("span");
          fixedTag.className = "report-jar-expense-fixed-tag";
          fixedTag.textContent = "CĐ";
          fixedTag.setAttribute("aria-label", "Cố định");
          fixedTag.title = "Cố định";
          expLeft.appendChild(fixedTag);
        }
        if (row.needsReview) {
          var reviewMark = document.createElement("span");
          reviewMark.className = "expense-fixed-review-mark";
          reviewMark.textContent = "*";
          reviewMark.setAttribute("aria-label", "Chưa chỉnh cho tháng này");
          expLeft.appendChild(reviewMark);
        }

        var expAmt = document.createElement("span");
        expAmt.className = "report-jar-expense-amt";
        expAmt.textContent = formatMoneyListShort(row.amount);

        expLi.appendChild(expLeft);
        expLi.appendChild(expAmt);
        expList.appendChild(expLi);
      });
    }

    catPanel.appendChild(expList);
    catDetails.appendChild(catSummary);
    catDetails.appendChild(catPanel);
    catItem.appendChild(catDetails);
    childList.appendChild(catItem);
  }

  function renderReportJarsProgress() {
    if (!elPieLegend) return;
    ensureSpendingJarsNormalized();
    var jars = app.spendingJars || [];
    var unclaimedIds = getUnclaimedCategoryIds();
    var hasJars = jars.length > 0 || unclaimedIds.length > 0;
    var showProgress = hasJars && reportMode === "jars" && !!state;
    elPieLegend.innerHTML = "";
    if (!showProgress) return;

    var byCat = totalsByCategory();

    function appendReportJarItem(jarKey, label, color, limitAmount, spent, categoryIds, extraClass) {
      var li = document.createElement("li");
      li.className = "report-jar-item" + (extraClass ? " " + extraClass : "");

      var details = document.createElement("details");
      details.className = "report-jar-details";
      if (reportJarExpandedIds[jarKey]) details.open = true;
      details.addEventListener("toggle", function () {
        if (details.open) reportJarExpandedIds[jarKey] = true;
        else delete reportJarExpandedIds[jarKey];
      });

      var summary = document.createElement("summary");
      summary.className = "report-jar-summary";

      var summaryMain = document.createElement("div");
      summaryMain.className = "report-jar-summary-main";

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
        if (spent > limitAmount) amt.classList.add("is-over");
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
        if (spent > limitAmount) {
          fill.classList.add("is-over");
        } else {
          fill.style.background = color;
        }
      } else {
        fill.style.width = spent > 0 ? "100%" : "0%";
        fill.classList.add("is-neutral");
        if (spent > 0) fill.style.background = color;
      }
      bar.appendChild(fill);
      barWrap.appendChild(bar);

      body.appendChild(h);
      body.appendChild(barWrap);
      summaryMain.appendChild(pic);
      summaryMain.appendChild(body);
      summary.appendChild(summaryMain);

      var panel = document.createElement("div");
      panel.className = "report-jar-children";
      var childList = document.createElement("ul");
      childList.className = "report-jar-cat-list";

      if (!categoryIds.length) {
        var emptyLi = document.createElement("li");
        emptyLi.className = "report-jar-cat-empty";
        emptyLi.textContent = "Chưa gắn danh mục";
        childList.appendChild(emptyLi);
      } else {
        var catRows = categoryIds.map(function (cid) {
          return {
            id: cid,
            label: getCategoryLabel(cid),
            sym: getCategoryIconSym(cid),
            amount: byCat[cid] || 0,
          };
        });
        catRows.sort(function (a, b) {
          return b.amount - a.amount || a.label.localeCompare(b.label, "vi");
        });
        var hasSpending = false;
        catRows.forEach(function (row) {
          if (row.amount > 0) hasSpending = true;
          appendReportJarCategoryRow(childList, jarKey, row, spent);
        });
        if (!hasSpending) {
          var noneLi = document.createElement("li");
          noneLi.className = "report-jar-cat-empty";
          noneLi.textContent = "Chưa có chi trong các danh mục này";
          childList.insertBefore(noneLi, childList.firstChild);
        }
      }

      panel.appendChild(childList);
      details.appendChild(summary);
      details.appendChild(panel);
      li.appendChild(details);
      elPieLegend.appendChild(li);
    }

    var jarRows = jars.map(function (j) {
      return {
        key: j.id,
        label: j.label,
        color: j.color,
        limitAmount: j.limitAmount,
        spent: computeJarSpentForMonth(activeMonthKey, j),
        categoryIds: j.categoryIds || [],
        extraClass: "",
      };
    });
    if (unclaimedIds.length > 0) {
      jarRows.push({
        key: CONSOLIDATED_JAR_ID,
        label: CONSOLIDATED_JAR_LABEL,
        color: CONSOLIDATED_JAR_COLOR,
        limitAmount: 0,
        spent: computeSpentForCategories(activeMonthKey, unclaimedIds),
        categoryIds: unclaimedIds,
        extraClass: "report-jar-item-consolidated",
      });
    }
    jarRows.sort(function (a, b) {
      if (a.key === CONSOLIDATED_JAR_ID) return 1;
      if (b.key === CONSOLIDATED_JAR_ID) return -1;
      return b.spent - a.spent || a.label.localeCompare(b.label, "vi");
    });
    jarRows.forEach(function (row) {
      appendReportJarItem(
        row.key,
        row.label,
        row.color,
        row.limitAmount,
        row.spent,
        row.categoryIds,
        row.extraClass
      );
    });
  }

  function refreshSettingsDefaultLimitDisplay() {
    if (!elSettingsDefaultLimitDisplay) return;
    var v = getDefaultMonthlyLimit();
    var unset = !v || v <= 0;
    elSettingsDefaultLimitDisplay.textContent = unset
      ? "Chưa đặt mặc định"
      : formatMoneyVNDShort(v);
    elSettingsDefaultLimitDisplay.title = unset ? "" : formatMoneyVND(v);
    elSettingsDefaultLimitDisplay.classList.toggle("is-unset", unset);
  }

  function isSettingsDefaultLimitEditOpen() {
    return elSettingsDefaultLimitEditRow && !elSettingsDefaultLimitEditRow.hidden;
  }

  function closeSettingsDefaultLimitEdit() {
    if (!elSettingsDefaultLimitEditRow || !elSettingsDefaultLimitView) return;
    elSettingsDefaultLimitEditRow.hidden = true;
    elSettingsDefaultLimitView.hidden = false;
    if (elSettingsDefaultLimitEditHint) elSettingsDefaultLimitEditHint.hidden = true;
    if (elSettingsDefaultLimitField) elSettingsDefaultLimitField.classList.remove("is-editing");
    if (elBtnSettingsDefaultLimitEdit) {
      elBtnSettingsDefaultLimitEdit.setAttribute("aria-expanded", "false");
    }
  }

  function cancelSettingsDefaultLimitEdit() {
    if (!isSettingsDefaultLimitEditOpen()) return;
    closeSettingsDefaultLimitEdit();
    refreshSettingsDefaultLimitDisplay();
  }

  function openSettingsDefaultLimitEdit() {
    if (!elSettingsDefaultLimitEditRow || !elSettingsDefaultLimitView) return;
    if (isSettingsDefaultLimitEditOpen()) return;
    settingsDefaultLimitBeforeEdit = getDefaultMonthlyLimit();
    if (elSettingsDefaultLimit) {
      elSettingsDefaultLimit.value = formatAsNganDisplay(settingsDefaultLimitBeforeEdit);
      updateAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
    }
    elSettingsDefaultLimitView.hidden = true;
    elSettingsDefaultLimitEditRow.hidden = false;
    if (elSettingsDefaultLimitEditHint) elSettingsDefaultLimitEditHint.hidden = false;
    if (elSettingsDefaultLimitField) elSettingsDefaultLimitField.classList.add("is-editing");
    if (elBtnSettingsDefaultLimitEdit) {
      elBtnSettingsDefaultLimitEdit.setAttribute("aria-expanded", "true");
    }
    setTimeout(function () {
      if (elSettingsDefaultLimit) {
        elSettingsDefaultLimit.focus();
        elSettingsDefaultLimit.select();
      }
    }, 0);
  }

  function saveSettingsDefaultLimitEdit() {
    if (!elSettingsDefaultLimit || !isSettingsDefaultLimitEditOpen()) return;
    app.settings.defaultLimit = parseMoneyToVND(elSettingsDefaultLimit.value);
    elSettingsDefaultLimit.value = formatAsNganDisplay(app.settings.defaultLimit);
    updateAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
    saveAppData({ configDirty: true });
    refreshSettingsDefaultLimitDisplay();
    closeSettingsDefaultLimitEdit();
  }

  function openEditJarDialog(jarId) {
    var j = app.spendingJars.filter(function (x) {
      return x.id === jarId;
    })[0];
    if (!j || !elEditJarDialog) return;
    closeExpenseDayPicker();
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
    updateModalOpenBodyLock();
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
    updateModalOpenBodyLock();
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
    saveAppData({ configDirty: true });
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
      return false;
    }
    var next = app.spendingJars.filter(function (j) {
      return j.id !== jarId;
    });
    if (next.length === app.spendingJars.length) return false;
    app.spendingJars = next;
    saveAppData({ configDirty: true });
    renderSettingsJarsList();
    renderNewJarCategoryCheckboxes();
    if (activeMonthKey && state) persistAndRender();
    return true;
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
    if (!elSettingsNewCategoryIcons || !elSettingsNewCategoryIconId) return;
    var current = elSettingsNewCategoryIconId.value || "food";
    renderIconPicker(elSettingsNewCategoryIcons, elSettingsNewCategoryIconId, current);
  }

  function renderSettingsCategoriesList() {
    if (!elSettingsCategoriesList) return;
    elSettingsCategoriesList.innerHTML = "";
    var catLen = (app.categories || []).length;
    app.categories.forEach(function (c, cIdx) {
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

      var handleCat = attachDragHandleToRow(
        li,
        cIdx,
        elSettingsCategoriesList,
        function (from, to) {
          if (!reorderArrayMove(app.categories, from, to)) return;
          afterCategoriesReordered();
        },
        catLen
      );

      var actions = document.createElement("div");
      actions.className = "settings-category-actions";

      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn-icon btn-icon-muted settings-category-edit-btn";
      btnEdit.setAttribute("aria-label", "Sửa danh mục");
      btnEdit.appendChild(iconPencilSvg());
      btnEdit.addEventListener("click", function () {
        openEditCategoryDialog(c.id);
      });

      actions.appendChild(btnEdit);
      li.appendChild(handleCat);
      li.appendChild(sym);
      li.appendChild(mid);
      li.appendChild(actions);
      elSettingsCategoriesList.appendChild(li);
    });
  }

  function deleteCategoryFromSettings(id) {
    if (app.categories.length <= 1) {
      window.alert("Cần giữ ít nhất một danh mục.");
      return false;
    }
    if (!confirm("Xóa danh mục này? Mọi khoản chi và khoản cố định đang dùng danh mục này sẽ chuyển sang danh mục khác.")) {
      return false;
    }
    var rest = app.categories.filter(function (c) {
      return c.id !== id;
    });
    var toId = rest[0] ? rest[0].id : getFirstCategoryId();
    reassignCategoryEverywhere(id, toId);
    remapCategoryInJars(id, toId);
    app.categories = rest;
    saveAppData({ configDirty: true });
    refreshAllCategorySelects();
    renderSettingsCategoriesList();
    if (activeMonthKey && state) {
      state.expenses = state.expenses.map(normalizeExpenseRow);
      syncFixedIntoMonth(state, activeMonthKey);
      persistAndRender();
    } else {
      renderFixedTemplatesList();
    }
    return true;
  }

  function closeEditCategoryDialog() {
    editingCategoryId = null;
    if (elEditCategoryDialog) {
      elEditCategoryDialog.hidden = true;
      elEditCategoryDialog.setAttribute("aria-hidden", "true");
    }
    updateModalOpenBodyLock();
  }

  function openEditCategoryDialog(catId) {
    var c = findCategory(catId);
    if (!c || !elEditCategoryDialog) return;
    closeExpenseDayPicker();
    closeEditJarDialog();
    editingCategoryId = catId;
    if (elEditCategoryLabelInput) elEditCategoryLabelInput.value = c.label;
    renderIconPicker(elEditCategoryIcons, elEditCategoryIconId, c.iconId);
    renderCategoryJarPicker(
      elEditCategoryJarPicker,
      elEditCategoryJar,
      findJarIdForCategory(catId)
    );
    elEditCategoryDialog.hidden = false;
    elEditCategoryDialog.setAttribute("aria-hidden", "false");
    updateModalOpenBodyLock();
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
    setCategoryJarAssignment(
      editingCategoryId,
      readCategoryJarPickerValue(elEditCategoryJar, elEditCategoryJarPicker)
    );
    saveAppData({ configDirty: true });
    closeEditCategoryDialog();
    renderSettingsCategoriesList();
    renderSettingsJarsList();
    renderNewJarCategoryCheckboxes();
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
    var createdAt =
      typeof row.createdAt === "number" && row.createdAt > 0
        ? Math.round(row.createdAt)
        : expenseCreatedAt(row) || updatedAt;
    var o = {
      id: row.id || uid(),
      category: cat,
      name: typeof row.name === "string" ? row.name.trim() : "",
      amount: typeof row.amount === "number" && row.amount >= 0 ? Math.round(row.amount) : 0,
      createdAt: createdAt,
      updatedAt: updatedAt,
    };
    if (typeof row.dateTs === "number" && row.dateTs > 0) {
      o.dateTs = Math.round(row.dateTs);
    }
    if (row.templateId) o.templateId = row.templateId;
    if (row.monthEdited) o.monthEdited = true;
    if (typeof row.deletedAt === "number" && row.deletedAt > 0) {
      o.deletedAt = Math.round(row.deletedAt);
    }
    if (row.isCreditCard) o.isCreditCard = true;
    return o;
  }

  /** Ảnh chụp tháng đang mở trên UI (trước await cloud) — tránh mất khoản vừa nhập khi bấm đồng bộ. */
  function pinActiveMonthSnapshot() {
    if (!activeMonthKey || !state) return null;
    return {
      key: activeMonthKey,
      income: typeof state.income === "number" ? state.income : 0,
      incomeUserSet: !!state.incomeUserSet,
      expenses: (state.expenses || []).map(normalizeExpenseRow),
    };
  }

  /**
   * Gộp chi phí tháng đang mở từ UI (`pin`) vào payload đã merge.
   * Không xóa các ngày chỉ có trên cloud — chỉ overlay từng ngày có trong pin.
   */
  function mergePinnedActiveMonth(payload, pin) {
    if (!pin || !pin.key) return payload;
    var out = coercePayloadToV3(payload || {});
    var cur = out.months[pin.key] || {};
    var ts = nowTs();
    var curIncome = typeof cur.income === "number" ? cur.income : 0;
    var pinIncome = typeof pin.income === "number" ? pin.income : 0;
    var mergedIncomeMeta = mergeMonthIncomeMeta(cur, {
      income: pinIncome,
      incomeUserSet: !!pin.incomeUserSet,
      dataUpdatedAt: ts,
    });
    out.months[pin.key] = {
      income: mergedIncomeMeta.income,
      incomeUserSet: mergedIncomeMeta.incomeUserSet,
      dataUpdatedAt: Math.max(cur.dataUpdatedAt || 0, ts),
      needSync: true,
    };
    var prefix = pin.key + "-";
    var byDay = {};
    (pin.expenses || []).forEach(function (e) {
      var row = normalizeExpenseRow(e);
      var dk = expenseDayKeyFromRow(row);
      if (!dk || dk.indexOf(prefix) !== 0) dk = pin.key + "-01";
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(row);
    });
    Object.keys(byDay).forEach(function (dk) {
      var existingShard = out.days[dk] || { expenses: [], dataUpdatedAt: 0 };
      out.days[dk] = {
        expenses: dedupeFixedExpensesInList(
          mergeRowsById(
            existingShard.expenses || [],
            byDay[dk],
            function (ex) {
              return ex && ex.id;
            },
            expenseUpdatedAt
          ).map(normalizeExpenseRow)
        ),
        dataUpdatedAt: Math.max(existingShard.dataUpdatedAt || 0, ts),
        needSync: true,
      };
    });
    return out;
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
      var hasLive = m.expenses.some(function (e) {
        return e.templateId === t.id && !isRowDeleted(e);
      });
      var hasTombstone = m.expenses.some(function (e) {
        return e.templateId === t.id && isRowDeleted(e);
      });
      if (!hasLive && !hasTombstone) {
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
    forEachExpenseInApp(function (e, dk) {
      if (isRowDeleted(e)) return;
      if (e.templateId === t.id) {
        e.category = t.category;
        e.name = typeof t.name === "string" ? t.name.trim() : "";
        e.amount =
          typeof t.amount === "number" && t.amount >= 0 ? Math.round(t.amount) : 0;
        e.updatedAt = nowTs();
        markDayDirty(dk);
      }
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

  function donutSlicePath(cx, cy, rOuter, rInner, a0, a1) {
    var xo0 = cx + rOuter * Math.cos(a0);
    var yo0 = cy + rOuter * Math.sin(a0);
    var xo1 = cx + rOuter * Math.cos(a1);
    var yo1 = cy + rOuter * Math.sin(a1);
    var xi0 = cx + rInner * Math.cos(a0);
    var yi0 = cy + rInner * Math.sin(a0);
    var xi1 = cx + rInner * Math.cos(a1);
    var yi1 = cy + rInner * Math.sin(a1);
    var large = a1 - a0 > Math.PI ? 1 : 0;
    return (
      "M " +
      xo0 +
      " " +
      yo0 +
      " A " +
      rOuter +
      " " +
      rOuter +
      " 0 " +
      large +
      " 1 " +
      xo1 +
      " " +
      yo1 +
      " L " +
      xi1 +
      " " +
      yi1 +
      " A " +
      rInner +
      " " +
      rInner +
      " 0 " +
      large +
      " 0 " +
      xi0 +
      " " +
      yi0 +
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
  function renderPieChartFromSegments(segments, accessibleTitle, onSegmentClick, skipLegend) {
    if (!elPieBody || !elPieSlices || !elPieLegend) return;

    function clearDonutLayers() {
      elPieSlices.innerHTML = "";
      if (elPieSliceLabels) elPieSliceLabels.innerHTML = "";
      if (elPieCenter) elPieCenter.innerHTML = "";
    }

    var total = segments.reduce(function (s, x) {
      return s + x.amount;
    }, 0);

    if (total <= 0 || !segments.length) {
      elPieEmpty.hidden = false;
      elPieBody.hidden = true;
      clearDonutLayers();
      elPieLegend.innerHTML = "";
      if (elPieTitle) elPieTitle.textContent = accessibleTitle || "Biểu đồ";
      return;
    }

    elPieEmpty.hidden = true;
    elPieBody.hidden = false;

    var cx = 0;
    var cy = 0;
    var rOuter = 100;
    var rInner = 58;
    var rLabel = (rOuter + rInner) / 2;
    var strokeW = 2.5;
    clearDonutLayers();

    function attachSegInteraction(g, seg) {
      if (!onSegmentClick) return;
      g.classList.add("pie-donut-seg-interactive");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.addEventListener("click", function () {
        onSegmentClick(seg);
      });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onSegmentClick(seg);
        }
      });
    }

    function appendPctLabel(am, pctStr) {
      if (!elPieSliceLabels || !pctStr) return;
      var tx = cx + rLabel * Math.cos(am);
      var ty = cy + rLabel * Math.sin(am);
      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "pie-donut-pct");
      t.setAttribute("x", tx.toFixed(2));
      t.setAttribute("y", ty.toFixed(2));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.textContent = pctStr;
      elPieSliceLabels.appendChild(t);
    }

    if (segments.length === 1) {
      var seg0 = segments[0];
      var aEnd = -Math.PI / 2 + 2 * Math.PI * 0.999995;
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", donutSlicePath(cx, cy, rOuter, rInner, -Math.PI / 2, aEnd));
      path.setAttribute("fill", sliceFillAt(0, seg0));
      path.setAttribute("class", "pie-donut-slice");
      path.setAttribute("stroke-width", String(strokeW));
      var g0 = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g0.appendChild(path);
      attachSegInteraction(g0, seg0);
      elPieSlices.appendChild(g0);
      appendPctLabel(0, "100%");
    } else {
      var start = -Math.PI / 2;
      segments.forEach(function (seg, i) {
        var frac = seg.amount / total;
        var a0 = start;
        var a1 = start + frac * 2 * Math.PI;
        start = a1;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", donutSlicePath(cx, cy, rOuter, rInner, a0, a1));
        path.setAttribute("fill", sliceFillAt(i, seg));
        path.setAttribute("class", "pie-donut-slice");
        path.setAttribute("stroke-width", String(strokeW));
        var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.appendChild(path);
        attachSegInteraction(g, seg);
        elPieSlices.appendChild(g);
        var span = a1 - a0;
        var pctNum = total > 0 ? (seg.amount / total) * 100 : 0;
        var pctInt = Math.round(pctNum);
        var pctStr =
          pctInt < 1 && seg.amount > 0
            ? "<1%"
            : pctInt + "%";
        if (span >= 0.2) {
          appendPctLabel((a0 + a1) / 2, pctStr);
        }
      });
    }

    if (elPieCenter) {
      var sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sub.setAttribute("class", "pie-donut-center-sub");
      sub.setAttribute("x", "0");
      sub.setAttribute("y", "-10");
      sub.setAttribute("text-anchor", "middle");
      sub.textContent = "Tổng chi";
      var tot = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tot.setAttribute("class", "pie-donut-center-total");
      tot.setAttribute("x", "0");
      tot.setAttribute("y", "16");
      tot.setAttribute("text-anchor", "middle");
      tot.textContent = formatMoneyVNDShort(total);
      tot.setAttribute("title", formatMoneyVND(total));
      elPieCenter.appendChild(sub);
      elPieCenter.appendChild(tot);
    }

    if (!skipLegend) {
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
    }

    if (elPieTitle) {
      var parts = segments.map(function (s) {
        return s.label + " " + Math.round((s.amount / total) * 100) + "%";
      });
      elPieTitle.textContent = accessibleTitle + ": " + parts.join(", ");
    }
  }

  function renderJarPieChart() {
    if (!elPieBody || !elPieSlices || !elPieLegend || !state) return;
    ensureSpendingJarsNormalized();
    var jars = app.spendingJars || [];
    var unclaimed = getUnclaimedCategoryIds();
    var hasJars = jars.length > 0 || unclaimed.length > 0;

    var segments = [];
    jars.forEach(function (j) {
      var spent = computeJarSpentForMonth(activeMonthKey, j);
      if (spent > 0) {
        segments.push({
          id: j.id,
          label: j.label,
          amount: spent,
          fill: j.color,
        });
      }
    });
    if (unclaimed.length) {
      var cSpent = computeSpentForCategories(activeMonthKey, unclaimed);
      if (cSpent > 0) {
        segments.push({
          id: CONSOLIDATED_JAR_ID,
          label: CONSOLIDATED_JAR_LABEL,
          amount: cSpent,
          fill: CONSOLIDATED_JAR_COLOR,
        });
      }
    }
    segments.sort(function (a, b) {
      if (a.id === CONSOLIDATED_JAR_ID) return 1;
      if (b.id === CONSOLIDATED_JAR_ID) return -1;
      return b.amount - a.amount || a.label.localeCompare(b.label, "vi");
    });

    if (!hasJars) {
      if (elPieSvg) elPieSvg.hidden = false;
      renderPieChartFromSegments([], "Chi tiêu theo hũ", null, true);
      return;
    }

    if (segments.length > 0) {
      if (elPieSvg) elPieSvg.hidden = false;
      renderPieChartFromSegments(segments, "Chi tiêu theo hũ", null, true);
    } else {
      elPieEmpty.hidden = true;
      elPieBody.hidden = false;
      elPieSlices.innerHTML = "";
      if (elPieSliceLabels) elPieSliceLabels.innerHTML = "";
      if (elPieCenter) elPieCenter.innerHTML = "";
      if (elPieTitle) elPieTitle.textContent = "Chi tiêu theo hũ";
      if (elPieSvg) elPieSvg.hidden = true;
    }
    renderReportJarsProgress();
  }

  function renderPieChart() {
    if (!elPieBody || !elPieSlices || !elPieLegend || !state) return;
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

  function dayKeyFromTs(ts) {
    if (typeof ts !== "number" || ts <= 0) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function dayLabelFromKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!m) return key || "";
    return m[3] + "/" + m[2];
  }

  /** Chỉ số ngày (01…31), dùng nhãn trục biểu đồ theo ngày. */
  function dayOfMonthOnlyLabelFromKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!m) return key || "";
    return m[3];
  }

  function dateFromDayKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    var out = new Date(y, mo - 1, d);
    if (
      out.getFullYear() !== y ||
      out.getMonth() !== mo - 1 ||
      out.getDate() !== d
    ) {
      return null;
    }
    return out;
  }

  function dayKeyShift(baseKey, deltaDays) {
    var d = dateFromDayKey(baseKey);
    if (!d) return "";
    d.setDate(d.getDate() + deltaDays);
    return dayKeyFromTs(d.getTime());
  }

  function sumExpensesByDay() {
    var map = {};
    if (!state || !Array.isArray(state.expenses)) return map;
    state.expenses.forEach(function (e) {
      if (isRowDeleted(e)) return;
      var key = dayKeyFromTs(expenseDateTs(e));
      if (!key) return;
      if (!map[key]) map[key] = 0;
      map[key] += typeof e.amount === "number" && e.amount > 0 ? e.amount : 0;
    });
    return map;
  }

  function monthDayKeys(monthKey) {
    var p = parseMonthKeyParts(monthKey);
    if (!p) return [];
    var days = new Date(p.year, p.month, 0).getDate();
    var out = [];
    var i;
    for (i = 1; i <= days; i++) {
      out.push(
        p.year +
          "-" +
          String(p.month).padStart(2, "0") +
          "-" +
          String(i).padStart(2, "0")
      );
    }
    return out;
  }

  /** Ngày trong biểu đồ “Tháng này”: không hiển thị ngày sau hôm nay; tháng quá khứ vẫn đủ ngày trong tháng. */
  function monthDayKeysForDailyChart(monthKey) {
    var all = monthDayKeys(monthKey);
    if (!all.length) return [];
    var cur = currentMonthKey();
    if (monthKey < cur) return all;
    if (monthKey > cur) return [];
    var todayKey = dayKeyFromTs(nowTs());
    return all.filter(function (k) {
      return k <= todayKey;
    });
  }

  function recentDayKeysFromAnchor(anchorKey, count) {
    var out = [];
    var i;
    for (i = count - 1; i >= 0; i--) {
      out.push(dayKeyShift(anchorKey, -i));
    }
    return out;
  }

  function renderReportDailyRangeButtons() {
    var map = [
      { key: "month", el: elReportDailyRangeMonth },
      { key: "7days", el: elReportDailyRange7Days },
    ];
    map.forEach(function (x) {
      if (!x.el) return;
      var active = reportDailyRange === x.key;
      x.el.classList.toggle("is-active", active);
      x.el.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function toggleReportDailyDaySelection(dayKey) {
    if (!dayKey || typeof dayKey !== "string") return;
    if (reportDailySelectedDayKey === dayKey) reportDailySelectedDayKey = null;
    else reportDailySelectedDayKey = dayKey;
    syncReportDailySelectionUI();
  }

  function expensesForReportDayKey(dayKey) {
    if (!state || !dayKey || !Array.isArray(state.expenses)) return [];
    var rows = [];
    state.expenses.forEach(function (e) {
      if (isRowDeleted(e)) return;
      if (dayKeyFromTs(expenseDateTs(e)) !== dayKey) return;
      rows.push(e);
    });
    rows.sort(function (a, b) {
      var at = expenseDateTs(a);
      var bt = expenseDateTs(b);
      if (at !== bt) return bt - at;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
    return rows;
  }

  function renderReportDailyDetailPanel() {
    if (
      !elReportDailyDetail ||
      !elReportDailyDetailHeading ||
      !elReportDailyDetailList
    ) {
      return;
    }
    if (!reportDailySelectedDayKey) {
      elReportDailyDetail.hidden = true;
      elReportDailyDetailList.innerHTML = "";
      if (elReportDailyDetailEmptyDay) elReportDailyDetailEmptyDay.hidden = true;
      return;
    }
    elReportDailyDetail.hidden = false;
    var items = expensesForReportDayKey(reportDailySelectedDayKey);
    elReportDailyDetailHeading.textContent =
      "Ngày " + dayLabelFromKey(reportDailySelectedDayKey);
    elReportDailyDetailList.innerHTML = "";
    if (!items.length) {
      if (elReportDailyDetailEmptyDay) {
        elReportDailyDetailEmptyDay.hidden = false;
        elReportDailyDetailEmptyDay.textContent =
          "Không có khoản chi ghi nhận cho ngày này.";
      }
      return;
    }
    if (elReportDailyDetailEmptyDay) elReportDailyDetailEmptyDay.hidden = true;
    var sum = items.reduce(function (s, e) {
      return s + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
    items.forEach(function (e) {
      elReportDailyDetailList.appendChild(createExpenseListRowElement(e, true));
    });
    var totalLi = document.createElement("li");
    totalLi.className = "expense-total-row";
    totalLi.innerHTML =
      '<span class="expense-total-label"></span><span class="expense-total-amount"></span>';
    totalLi.querySelector(".expense-total-label").textContent =
      "Tổng chi (" + items.length + " khoản)";
    totalLi.querySelector(".expense-total-amount").textContent = formatMoneyVND(sum);
    elReportDailyDetailList.appendChild(totalLi);
  }

  function syncReportDailySelectionUI() {
    if (!elReportDailyBars) return;
    var cols = elReportDailyBars.querySelectorAll(".report-day-col");
    var i;
    for (i = 0; i < cols.length; i++) {
      var col = cols[i];
      var dk = col.dataset.dayKey || "";
      var sel = !!reportDailySelectedDayKey && dk === reportDailySelectedDayKey;
      col.classList.toggle("is-selected", sel);
      col.setAttribute("aria-pressed", sel ? "true" : "false");
    }
    renderReportDailyDetailPanel();
  }

  function renderDailyReportChart() {
    if (!elReportDailyBars || !elReportDailyScroll || !elReportDailyEmpty) return;
    var oldCols = elReportDailyBars.querySelectorAll(".report-day-col");
    var ci;
    for (ci = 0; ci < oldCols.length; ci++) oldCols[ci].remove();
    var byDay = sumExpensesByDay();
    var keys = [];
    if (reportDailyRange === "7days") {
      var maxDayKey = dayKeyFromTs(nowTs());
      keys = recentDayKeysFromAnchor(maxDayKey, 7);
    } else {
      keys = monthDayKeysForDailyChart(activeMonthKey);
    }
    if (!keys.length) {
      elReportDailyScroll.hidden = true;
      elReportDailyEmpty.hidden = false;
      reportDailySelectedDayKey = null;
      renderReportDailyDetailPanel();
      return;
    }
    var keySet = {};
    keys.forEach(function (k) {
      keySet[k] = true;
    });
    if (reportDailySelectedDayKey && !keySet[reportDailySelectedDayKey]) {
      reportDailySelectedDayKey = null;
    }
    var maxAmount = keys.reduce(function (max, key) {
      return Math.max(max, byDay[key] || 0);
    }, 0);
    keys.forEach(function (key) {
      var amount = byDay[key] || 0;
      var col = document.createElement("div");
      col.className = "report-day-col";
      col.dataset.dayKey = key;
      col.tabIndex = 0;
      col.setAttribute("role", "button");
      col.setAttribute(
        "aria-label",
        "Ngày " + dayLabelFromKey(key) + ", chi " + formatMoneyVND(amount)
      );
      col.addEventListener("click", function () {
        toggleReportDailyDaySelection(key);
      });
      col.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        toggleReportDailyDaySelection(key);
      });

      var barWrap = document.createElement("div");
      barWrap.className = "report-day-bar-wrap";

      var track = document.createElement("div");
      track.className = "report-day-bar-track";

      var amountEl = document.createElement("span");
      amountEl.className = "report-day-bar-value";
      amountEl.textContent = amount > 0 ? formatMoneyListShort(amount) : "0";
      amountEl.title = dayLabelFromKey(key) + ": " + formatMoneyVND(amount);

      var bar = document.createElement("div");
      bar.className = "report-day-bar";
      var h = maxAmount > 0 ? Math.max(2, Math.round((amount / maxAmount) * 100)) : 2;
      bar.style.height = h + "%";
      bar.title = dayLabelFromKey(key) + ": " + formatMoneyVND(amount);

      track.appendChild(amountEl);
      track.appendChild(bar);
      barWrap.appendChild(track);

      var label = document.createElement("span");
      label.className = "report-day-label";
      label.textContent = dayLabelFromKey(key);

      col.appendChild(barWrap);
      col.appendChild(label);
      elReportDailyBars.appendChild(col);
    });
    syncReportDailySelectionUI();
    elReportDailyEmpty.hidden = false;
    if (Object.keys(byDay).some(function (k) { return keys.indexOf(k) !== -1 && byDay[k] > 0; })) {
      elReportDailyEmpty.hidden = true;
    } else {
      elReportDailyEmpty.hidden = false;
      elReportDailyEmpty.textContent = "Chưa có khoản chi trong khoảng thời gian này.";
    }
    elReportDailyScroll.hidden = false;
    if (reportDailyNeedsAutoScroll) {
      requestAnimationFrame(function () {
        elReportDailyScroll.scrollLeft = elReportDailyScroll.scrollWidth;
      });
      reportDailyNeedsAutoScroll = false;
    }
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
    var delTs = nowTs();
    t.deletedAt = delTs;
    t.updatedAt = delTs;
    saveAppData({ configDirty: true, immediateSync: true });
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
        : "Chưa có khoản cố định — bật “Cố định hàng tháng” khi thêm chi.";
      empty.style.color = "var(--muted)";
      empty.style.fontSize = "0.8125rem";
      ul.appendChild(empty);
      return;
    }
    var visLen = visibleTemplates.length;
    visibleTemplates.forEach(function (t, visIdx) {
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

      var line = document.createElement("div");
      line.className = "fixed-template-row-line";

      if (showEdit) {
        var titleHead = document.createElement("div");
        titleHead.className = "fixed-template-row-title-head";
        var handleFx = attachDragHandleToRow(
          li,
          visIdx,
          ul,
          function (from, to) {
            if (!reorderVisibleFixedTemplates(from, to)) return;
            afterFixedTemplatesReordered();
          },
          visLen
        );
        titleHead.appendChild(handleFx);
        titleHead.appendChild(title);
        line.appendChild(titleHead);
      } else {
        line.appendChild(title);
      }
      line.appendChild(sub);
      mid.appendChild(line);

      if (showEdit) {
        var actions = document.createElement("div");
        actions.className = "fixed-template-row-actions";
        var btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn-icon btn-icon-muted settings-fixed-edit-btn";
        btnEdit.setAttribute("aria-label", "Sửa khoản cố định");
        btnEdit.appendChild(iconPencilSvg());
        btnEdit.addEventListener("click", function () {
          openEditFixedTemplateDialog(t.id);
        });
        actions.appendChild(btnEdit);
        li.appendChild(mid);
        li.appendChild(actions);
      } else {
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
        li.appendChild(mid);
        li.appendChild(btnDel);
      }
      ul.appendChild(li);
    });
  }

  function renderFixedTemplatesList() {
    renderFixedTemplatesInto(elFixedTemplatesList, false);
    if (elSettingsFixedList && !elSettingsFixedList.closest("[hidden]")) {
      renderFixedTemplatesInto(elSettingsFixedList, true);
    }
  }

  function expenseListFilterResolvedDayKey() {
    if (expenseListFilterDayNum == null || !activeMonthKey) return null;
    var p = parseMonthKeyParts(activeMonthKey);
    if (!p) return null;
    var dim = new Date(p.year, p.month, 0).getDate();
    var dom = expenseListFilterDayNum;
    if (dom < 1 || dom > dim) return null;
    return (
      p.year +
      "-" +
      String(p.month).padStart(2, "0") +
      "-" +
      String(dom).padStart(2, "0")
    );
  }

  function alignExpenseListDayFilterFromDayKey(dayKey) {
    if (!dayKey || !activeMonthKey) return;
    if (dayKey.indexOf(activeMonthKey + "-") !== 0) return;
    var rest = dayKey.slice(activeMonthKey.length + 1);
    var dn = parseInt(rest, 10);
    if (!isNaN(dn) && dn >= 1) expenseListFilterDayNum = dn;
  }

  function syncExpenseDayGridPanelUi() {
    if (elExpenseDayPickerDialog) {
      elExpenseDayPickerDialog.hidden = !expenseListDayGridExpanded;
      elExpenseDayPickerDialog.setAttribute(
        "aria-hidden",
        expenseListDayGridExpanded ? "false" : "true"
      );
      updateModalOpenBodyLock();
    }
    if (elExpenseListDayFilterToggle) {
      elExpenseListDayFilterToggle.setAttribute(
        "aria-expanded",
        expenseListDayGridExpanded ? "true" : "false"
      );
      if (expenseListFilterDayNum !== null) {
        elExpenseListDayFilterToggle.textContent =
          "Ngày " + expenseListFilterDayNum;
      } else {
        elExpenseListDayFilterToggle.textContent = "Ngày";
      }
    }
  }

  function renderExpenseListDayGrid() {
    if (!elExpenseListDayGrid) return;
    var p = parseMonthKeyParts(activeMonthKey);
    var dim = p ? new Date(p.year, p.month, 0).getDate() : 31;
    if (
      expenseListFilterDayNum !== null &&
      (expenseListFilterDayNum < 1 || expenseListFilterDayNum > dim)
    ) {
      expenseListFilterDayNum = null;
    }
    var seal = (activeMonthKey || "") + ":" + dim;
    if (expenseListDayGridSeal !== seal) {
      expenseListDayGridSeal = seal;
      elExpenseListDayGrid.innerHTML = "";
      var d;
      for (d = 1; d <= dim; d++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "expense-day-grid-btn";
        btn.dataset.dayNum = String(d);
        btn.textContent = String(d);
        btn.setAttribute("aria-label", "Chỉ hiện khoản chi ngày " + d);
        elExpenseListDayGrid.appendChild(btn);
      }
    }
    var sel = expenseListFilterDayNum;
    var buttons = elExpenseListDayGrid.querySelectorAll(".expense-day-grid-btn");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var dn = parseInt(b.dataset.dayNum, 10);
      var on = sel !== null && !isNaN(dn) && dn === sel;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function syncExpenseDayFilterControls() {
    renderExpenseListDayGrid();
    syncExpenseDayGridPanelUi();
    if (elExpenseListClearDay) {
      elExpenseListClearDay.disabled = expenseListFilterDayNum == null;
    }
  }

  function setExpenseListDayNumFilter(dayNumOrNull) {
    if (dayNumOrNull === null || dayNumOrNull === undefined || dayNumOrNull === "") {
      expenseListFilterDayNum = null;
    } else {
      var n = parseInt(String(dayNumOrNull), 10);
      if (isNaN(n) || n < 1) {
        expenseListFilterDayNum = null;
      } else {
        var p = parseMonthKeyParts(activeMonthKey);
        var dim = p ? new Date(p.year, p.month, 0).getDate() : 31;
        expenseListFilterDayNum = n <= dim ? n : null;
      }
    }
    expenseListDayGridExpanded = false;
    renderExpenseList();
  }

  function createExpenseListRowElement(e, readOnly) {
    var li = document.createElement("li");
    li.className = readOnly ? "expense-row expense-row-readonly" : "expense-row";
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
    var nameSpan = document.createElement("span");
    nameSpan.className = "expense-row-line-name";
    nameSpan.textContent = namePart;
    line.appendChild(nameSpan);
    if (isFixedExpenseNeedsMonthReview(e)) {
      var reviewMark = document.createElement("span");
      reviewMark.className = "expense-fixed-review-mark";
      reviewMark.textContent = "*";
      reviewMark.setAttribute("aria-label", "Chưa chỉnh cho tháng này");
      line.appendChild(reviewMark);
    }
    line.title =
      getCategoryLabel(e.category) +
      (e.name ? " · " + e.name : "") +
      (isFixedExpenseNeedsMonthReview(e) ? " · Chưa chỉnh cho tháng này" : "");
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

    var main = document.createElement("div");
    main.className = "expense-swipe-main";
    main.appendChild(ico);
    main.appendChild(mid);
    main.appendChild(amt);

    if (readOnly) {
      li.appendChild(main);
      return li;
    }

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
    main.appendChild(actions);

    var track = document.createElement("div");
    track.className = "expense-swipe-track";

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
    return li;
  }

  function renderExpenseList() {
    elExpenseList.innerHTML = "";
    if (!state) return;
    syncExpenseDayFilterControls();
    var rows = getVisibleExpenses();
    var totalRecords = rows.length;
    var typeMatchCount = countExpensesMatchingTypeFilter();
    var hasRows = totalRecords > 0;
    elEmpty.hidden = hasRows;
    if (!hasRows) {
      if (typeMatchCount === 0 && expenseListFilter === "all") {
        elEmpty.textContent = "Chưa có khoản chi. Thêm ở trên.";
      } else if (typeMatchCount === 0) {
        elEmpty.textContent = "Không có khoản chi phù hợp bộ lọc.";
      } else if (expenseListFilterResolvedDayKey()) {
        elEmpty.textContent =
          "Không có khoản chi trong ngày đã chọn. Đổi ngày hoặc bấm × để bỏ lọc.";
      } else {
        elEmpty.textContent = "Không có khoản chi phù hợp bộ lọc.";
      }
    }
    renderExpenseFilterButtons();

    rows.forEach(function (e) {
      elExpenseList.appendChild(createExpenseListRowElement(e));
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

  function isFixedExpenseNeedsMonthReview(e) {
    return isFixedExpenseRow(e) && !e.monthEdited;
  }

  function expenseDisplayName(e) {
    if (!e) return "";
    if (typeof e.name === "string" && e.name.trim()) return e.name.trim();
    return getCategoryLabel(e.category);
  }

  function expenseMatchesTypeFilter(e) {
    if (!e || isRowDeleted(e)) return false;
    if (expenseListFilter === "fixed") return isFixedExpenseRow(e);
    if (expenseListFilter === "flex") return !isFixedExpenseRow(e);
    return true;
  }

  function countExpensesMatchingTypeFilter() {
    if (!state || !Array.isArray(state.expenses)) return 0;
    var n = 0;
    state.expenses.forEach(function (e) {
      if (expenseMatchesTypeFilter(e)) n++;
    });
    return n;
  }

  function getVisibleExpenses() {
    if (!state || !Array.isArray(state.expenses)) return [];
    var rows = state.expenses.filter(expenseMatchesTypeFilter);
    var dk = expenseListFilterResolvedDayKey();
    if (dk) {
      rows = rows.filter(function (e) {
        return dayKeyFromTs(expenseDateTs(e)) === dk;
      });
    }
    rows.sort(function (a, b) {
      var at = expenseDateTs(a);
      var bt = expenseDateTs(b);
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

  function expenseDateTs(e) {
    if (e && typeof e.dateTs === "number" && e.dateTs > 0) {
      return Math.round(e.dateTs);
    }
    return expenseCreatedAt(e);
  }

  var EXPENSE_NAME_SUGGEST_MS = 30 * 24 * 60 * 60 * 1000;

  function getExpenseNameSuggestionsForCategory(categoryId) {
    if (!categoryId || !categoryIdExists(categoryId)) return [];
    var cutoff = nowTs() - EXPENSE_NAME_SUGGEST_MS;
    var counts = {};
    forEachExpenseInApp(function (e) {
      if (isRowDeleted(e)) return;
      if (e.category !== categoryId) return;
      if (expenseDateTs(e) < cutoff) return;
      var name = typeof e.name === "string" ? e.name.trim() : "";
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (name) {
        return { name: name, count: counts[name] };
      })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, "vi");
      })
      .map(function (x) {
        return x.name;
      });
  }

  function hideExpenseNameSuggestions(ctx) {
    if (!ctx) return;
    if (ctx.hideTimer) {
      clearTimeout(ctx.hideTimer);
      ctx.hideTimer = null;
    }
    if (!ctx.list) return;
    ctx.list.hidden = true;
    ctx.list.innerHTML = "";
    if (ctx.input) ctx.input.setAttribute("aria-expanded", "false");
  }

  function hideAllExpenseNameSuggestions() {
    hideExpenseNameSuggestions(expenseNameSuggestCtxAdd);
    hideExpenseNameSuggestions(expenseNameSuggestCtxEdit);
  }

  function renderExpenseNameSuggestions(ctx) {
    if (!ctx || !ctx.list || !ctx.input) return;
    var cat = ctx.category ? ctx.category.value : "";
    var names = getExpenseNameSuggestionsForCategory(cat);
    ctx.list.innerHTML = "";
    if (!names.length) {
      hideExpenseNameSuggestions(ctx);
      return;
    }
    names.forEach(function (name) {
      var li = document.createElement("li");
      li.className = "expense-name-suggestion-item";
      li.setAttribute("role", "presentation");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "expense-name-suggestion-btn";
      btn.setAttribute("role", "option");
      btn.textContent = name;
      btn.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        ctx.input.value = name;
        hideExpenseNameSuggestions(ctx);
        ctx.input.focus();
      });
      li.appendChild(btn);
      ctx.list.appendChild(li);
    });
    ctx.list.hidden = false;
    ctx.input.setAttribute("aria-expanded", "true");
  }

  function showExpenseNameSuggestions(ctx) {
    if (!ctx) return;
    if (ctx.hideTimer) {
      clearTimeout(ctx.hideTimer);
      ctx.hideTimer = null;
    }
    renderExpenseNameSuggestions(ctx);
  }

  function scheduleHideExpenseNameSuggestions(ctx) {
    if (!ctx) return;
    if (ctx.hideTimer) clearTimeout(ctx.hideTimer);
    ctx.hideTimer = setTimeout(function () {
      hideExpenseNameSuggestions(ctx);
    }, 140);
  }

  function bindExpenseNameSuggestions(ctx) {
    if (!ctx || !ctx.input) return;
    ctx.input.addEventListener("focus", function () {
      hideExpenseNameSuggestions(
        ctx === expenseNameSuggestCtxAdd
          ? expenseNameSuggestCtxEdit
          : expenseNameSuggestCtxAdd
      );
      showExpenseNameSuggestions(ctx);
    });
    ctx.input.addEventListener("blur", function () {
      scheduleHideExpenseNameSuggestions(ctx);
    });
    if (ctx.category) {
      ctx.category.addEventListener("change", function () {
        if (document.activeElement === ctx.input) {
          renderExpenseNameSuggestions(ctx);
        }
      });
    }
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateInputValueFromTs(ts) {
    if (typeof ts !== "number" || ts <= 0) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatTimeInputValueFromTs(ts) {
    if (typeof ts !== "number" || ts <= 0) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /** Ghép ngày (YYYY-MM-DD) + giờ (HH:mm); nếu không có giờ hợp lệ thì lấy phần giờ từ fallbackTs. */
  function parseDateTimeInputsToTs(dateStr, timeStr, fallbackTs) {
    var dateOnly = parseDateInputToDate(dateStr);
    if (!dateOnly) return 0;
    var h = 12;
    var mi = 0;
    var s = 0;
    var ms = 0;
    var fbTs = typeof fallbackTs === "number" && fallbackTs > 0 ? fallbackTs : nowTs();
    var fb = new Date(fbTs);
    if (!isNaN(fb.getTime())) {
      h = fb.getHours();
      mi = fb.getMinutes();
      s = fb.getSeconds();
      ms = fb.getMilliseconds();
    }
    var tRaw = typeof timeStr === "string" ? timeStr.trim() : "";
    if (tRaw) {
      var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(tRaw);
      if (m) {
        var hh = parseInt(m[1], 10);
        var mm = parseInt(m[2], 10);
        var ss = m[3] ? parseInt(m[3], 10) : 0;
        if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60 && ss >= 0 && ss < 60) {
          h = hh;
          mi = mm;
          s = ss;
          ms = 0;
        }
      }
    }
    return new Date(
      dateOnly.getFullYear(),
      dateOnly.getMonth(),
      dateOnly.getDate(),
      h,
      mi,
      s,
      ms
    ).getTime();
  }

  function parseDateInputToDate(dateStr) {
    if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    var parts = dateStr.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    var out = new Date(y, m - 1, d);
    if (
      out.getFullYear() !== y ||
      out.getMonth() !== m - 1 ||
      out.getDate() !== d
    ) {
      return null;
    }
    return out;
  }

  function resetAddExpenseDateInput() {
    var n = nowTs();
    if (elExpenseDate) elExpenseDate.value = formatDateInputValueFromTs(n);
    if (elExpenseTime) elExpenseTime.value = formatTimeInputValueFromTs(n);
  }

  function formatExpenseInputDate(e) {
    var ts = expenseDateTs(e);
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

  function syncCreditCardFeatureVisibility() {
    var on = isCreditCardFeatureEnabled();
    if (elCcReportCard) elCcReportCard.hidden = !on;
    if (elExpenseCreditCardField) elExpenseCreditCardField.hidden = !on;
    if (elEditExpenseCreditCardField) elEditExpenseCreditCardField.hidden = !on;
    if (elSettingsCreditCardFields) elSettingsCreditCardFields.hidden = !on;
    if (!on && elExpenseCreditCard) elExpenseCreditCard.checked = false;
  }

  function populateCreditCardStatementDaySelect() {
    if (!elSettingsCreditCardStatementDay) return;
    if (elSettingsCreditCardStatementDay.options.length >= 31) return;
    elSettingsCreditCardStatementDay.innerHTML = "";
    var i;
    for (i = 1; i <= 31; i++) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = "Ngày " + (i < 10 ? "0" : "") + i;
      elSettingsCreditCardStatementDay.appendChild(opt);
    }
  }

  function updateSettingsCreditCardDueDisplay() {
    if (!elSettingsCreditCardDueDisplay) return;
    var cc = getCreditCardSettings();
    if (!cc.enabled) {
      elSettingsCreditCardDueDisplay.textContent = "—";
      return;
    }
    var cycles = computeCreditCardCycles(new Date(), cc.statementDay);
    var dueKey = cycles.previous && cycles.previous.dueKey ? cycles.previous.dueKey : "";
    elSettingsCreditCardDueDisplay.textContent = dueKey
      ? formatDayKeyViLong(dueKey)
      : "—";
  }

  function renderSettingsCreditCard() {
    populateCreditCardStatementDaySelect();
    var cc = getCreditCardSettings();
    if (elSettingsCreditCardEnabled) elSettingsCreditCardEnabled.checked = cc.enabled;
    if (elSettingsCreditCardStatementDay) {
      elSettingsCreditCardStatementDay.value = String(cc.statementDay);
    }
    updateSettingsCreditCardDueDisplay();
    syncCreditCardFeatureVisibility();
  }

  function saveSettingsCreditCardFromUi() {
    if (!app.settings) app.settings = defaultSettings();
    var cc = normalizeCreditCardSettings(app.settings.creditCard);
    cc.enabled = !!(elSettingsCreditCardEnabled && elSettingsCreditCardEnabled.checked);
    if (elSettingsCreditCardStatementDay) {
      cc.statementDay = parseInt(elSettingsCreditCardStatementDay.value, 10) || 1;
    }
    app.settings.creditCard = normalizeCreditCardSettings(cc);
    updateSettingsCreditCardDueDisplay();
    syncCreditCardFeatureVisibility();
    saveAppData({ configDirty: true });
    renderCreditCardReport();
  }

  function renderDonutChartToTarget(target, segments, accessibleTitle) {
    if (!target || !target.body || !target.slices || !target.legend) return;
    var elEmpty = target.empty;
    var elBody = target.body;
    var elSlices = target.slices;
    var elSliceLabels = target.sliceLabels;
    var elCenter = target.center;
    var elLegend = target.legend;
    var elTitle = target.title;

    function clearDonutLayers() {
      elSlices.innerHTML = "";
      if (elSliceLabels) elSliceLabels.innerHTML = "";
      if (elCenter) elCenter.innerHTML = "";
    }

    var total = segments.reduce(function (s, x) {
      return s + x.amount;
    }, 0);

    if (total <= 0 || !segments.length) {
      if (elEmpty) elEmpty.hidden = false;
      elBody.hidden = true;
      clearDonutLayers();
      elLegend.innerHTML = "";
      if (elTitle) elTitle.textContent = accessibleTitle || "Biểu đồ";
      return;
    }

    if (elEmpty) elEmpty.hidden = true;
    elBody.hidden = false;

    var cx = 0;
    var cy = 0;
    var rOuter = 100;
    var rInner = 58;
    var rLabel = (rOuter + rInner) / 2;
    var strokeW = 2.5;
    clearDonutLayers();

    function appendPctLabel(am, pctStr) {
      if (!elSliceLabels || !pctStr) return;
      var tx = cx + rLabel * Math.cos(am);
      var ty = cy + rLabel * Math.sin(am);
      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "pie-donut-pct");
      t.setAttribute("x", tx.toFixed(2));
      t.setAttribute("y", ty.toFixed(2));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.textContent = pctStr;
      elSliceLabels.appendChild(t);
    }

    if (segments.length === 1) {
      var seg0 = segments[0];
      var aEnd = -Math.PI / 2 + 2 * Math.PI * 0.999995;
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", donutSlicePath(cx, cy, rOuter, rInner, -Math.PI / 2, aEnd));
      path.setAttribute("fill", sliceFillAt(0, seg0));
      path.setAttribute("class", "pie-donut-slice");
      path.setAttribute("stroke-width", String(strokeW));
      elSlices.appendChild(path);
      appendPctLabel(0, "100%");
    } else {
      var start = -Math.PI / 2;
      segments.forEach(function (seg, i) {
        var frac = seg.amount / total;
        var a0 = start;
        var a1 = start + frac * 2 * Math.PI;
        start = a1;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", donutSlicePath(cx, cy, rOuter, rInner, a0, a1));
        path.setAttribute("fill", sliceFillAt(i, seg));
        path.setAttribute("class", "pie-donut-slice");
        path.setAttribute("stroke-width", String(strokeW));
        elSlices.appendChild(path);
        var span = a1 - a0;
        var pctInt = Math.round((seg.amount / total) * 100);
        if (span >= 0.2 && pctInt > 0) appendPctLabel((a0 + a1) / 2, pctInt + "%");
      });
    }

    if (elCenter) {
      var sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sub.setAttribute("class", "pie-donut-center-sub");
      sub.setAttribute("x", "0");
      sub.setAttribute("y", "-10");
      sub.setAttribute("text-anchor", "middle");
      sub.textContent = "Tổng chi";
      var tot = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tot.setAttribute("class", "pie-donut-center-total");
      tot.setAttribute("x", "0");
      tot.setAttribute("y", "16");
      tot.setAttribute("text-anchor", "middle");
      tot.textContent = formatMoneyVNDShort(total);
      elCenter.appendChild(sub);
      elCenter.appendChild(tot);
    }

    elLegend.innerHTML = "";
    segments.forEach(function (seg, i) {
      var pct = total > 0 ? Math.round((seg.amount / total) * 1000) / 10 : 0;
      var li = document.createElement("li");
      li.className = "pie-legend-item";
      var dot = document.createElement("span");
      dot.className = "pie-legend-dot";
      dot.style.background = sliceFillAt(i, seg);
      var text = document.createElement("span");
      text.className = "pie-legend-text";
      text.innerHTML =
        '<span class="pie-legend-label"></span><span class="pie-legend-meta"></span>';
      text.querySelector(".pie-legend-label").textContent = seg.label;
      text.querySelector(".pie-legend-meta").textContent =
        formatMoneyVND(seg.amount) + " · " + pct + "%";
      li.appendChild(dot);
      li.appendChild(text);
      elLegend.appendChild(li);
    });

    if (elTitle) elTitle.textContent = accessibleTitle || "Biểu đồ";
  }

  function creditCategorySegmentsForRange(startKey, endKey) {
    var rows = getCreditCardExpensesInRange(startKey, endKey);
    var map = {};
    var order = [];
    rows.forEach(function (e) {
      var cat = e.category;
      if (!map[cat]) {
        map[cat] = 0;
        order.push(cat);
      }
      map[cat] += e.amount;
    });
    return order
      .map(function (catId, i) {
        return {
          id: catId,
          label: getCategoryLabel(catId),
          amount: map[catId],
          fill: PIE_COLORS[i % PIE_COLORS.length],
        };
      })
      .filter(function (s) {
        return s.amount > 0;
      })
      .sort(function (a, b) {
        return b.amount - a.amount;
      });
  }

  function renderCreditCardCategoryChart(cycles) {
    var range =
      creditReportCategoryCycle === "previous" ? cycles.previous : cycles.current;
    var segments = creditCategorySegmentsForRange(range.startKey, range.endKey);
    renderDonutChartToTarget(
      {
        empty: elCcCategoryEmpty,
        body: elCcCategoryBody,
        slices: elCcCategoryPieSlices,
        sliceLabels: elCcCategoryPieLabels,
        center: elCcCategoryPieCenter,
        legend: elCcCategoryLegend,
        title: elCcCategoryPieTitle,
      },
      segments,
      "Credit card theo danh mục"
    );
    if (elCcCategoryCycleCurrent) {
      elCcCategoryCycleCurrent.classList.toggle(
        "is-active",
        creditReportCategoryCycle === "current"
      );
      elCcCategoryCycleCurrent.setAttribute(
        "aria-pressed",
        creditReportCategoryCycle === "current" ? "true" : "false"
      );
    }
    if (elCcCategoryCyclePrevious) {
      elCcCategoryCyclePrevious.classList.toggle(
        "is-active",
        creditReportCategoryCycle === "previous"
      );
      elCcCategoryCyclePrevious.setAttribute(
        "aria-pressed",
        creditReportCategoryCycle === "previous" ? "true" : "false"
      );
    }
  }

  function dayKeysFromTo(startKey, endKey) {
    var out = [];
    var k = startKey;
    var guard = 0;
    while (k && k <= endKey && guard < 400) {
      out.push(k);
      if (k === endKey) break;
      k = dayKeyShift(k, 1);
      guard += 1;
    }
    return out;
  }

  function renderCreditCardTrendChart(cycles) {
    if (!elCcTrendSvg || !elCcTrendEmpty) return;
    var cur = cycles.current;
    var keys = dayKeysFromTo(cur.startKey, cur.endKey);
    if (!keys.length) {
      elCcTrendEmpty.hidden = false;
      elCcTrendSvg.hidden = true;
      elCcTrendSvg.innerHTML = "";
      return;
    }
    var byDay = {};
    getCreditCardExpensesInRange(cur.startKey, cur.endKey).forEach(function (e) {
      var dk = dayKeyFromTs(expenseDateTs(e));
      if (!dk) return;
      byDay[dk] = (byDay[dk] || 0) + e.amount;
    });
    var cumulative = 0;
    var points = [];
    keys.forEach(function (dk) {
      cumulative += byDay[dk] || 0;
      points.push({ y: cumulative, key: dk });
    });
    if (cumulative <= 0) {
      elCcTrendEmpty.hidden = false;
      elCcTrendSvg.hidden = true;
      elCcTrendSvg.innerHTML = "";
      return;
    }
    elCcTrendEmpty.hidden = true;
    elCcTrendSvg.hidden = false;
    var w = 320;
    var h = 120;
    var padL = 8;
    var padR = 8;
    var padT = 10;
    var padB = 22;
    var maxY = cumulative;
    var n = Math.max(1, points.length - 1);
    var coords = points.map(function (p, i) {
      var x = padL + (i / n) * (w - padL - padR);
      var y = padT + (1 - p.y / maxY) * (h - padT - padB);
      return { x: x, y: y, key: p.key };
    });
    var poly = coords
      .map(function (c) {
        return c.x.toFixed(1) + "," + c.y.toFixed(1);
      })
      .join(" ");
    var svg =
      '<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="' +
      poly +
      '"/>';
    coords.forEach(function (c, idx) {
      if (idx === 0 || idx === coords.length - 1 || coords.length <= 8) {
        svg +=
          '<circle cx="' +
          c.x.toFixed(1) +
          '" cy="' +
          c.y.toFixed(1) +
          '" r="3" fill="var(--accent)"/>';
      }
    });
    if (coords.length) {
      var last = coords[coords.length - 1];
      var first = coords[0];
      svg +=
        '<text x="' +
        first.x.toFixed(1) +
        '" y="' +
        (h - 4) +
        '" class="cc-trend-axis-label" text-anchor="start">' +
        dayLabelFromKey(first.key) +
        "</text>";
      svg +=
        '<text x="' +
        last.x.toFixed(1) +
        '" y="' +
        (h - 4) +
        '" class="cc-trend-axis-label" text-anchor="end">' +
        dayLabelFromKey(last.key) +
        "</text>";
    }
    elCcTrendSvg.innerHTML = svg;
  }

  function renderCreditCardTimeline(cycles) {
    if (!elCcTimelineList || !elCcTimelineEmpty) return;
    var rows = getCreditCardExpensesInRange(cycles.current.startKey, cycles.current.endKey);
    if (creditReportLargeOnly) {
      rows = rows.filter(function (e) {
        return (e.amount || 0) > CC_LARGE_EXPENSE_THRESHOLD;
      });
    }
    elCcTimelineList.innerHTML = "";
    if (!rows.length) {
      elCcTimelineEmpty.hidden = false;
      elCcTimelineList.hidden = true;
      return;
    }
    elCcTimelineEmpty.hidden = true;
    elCcTimelineList.hidden = false;
    rows.forEach(function (e) {
      elCcTimelineList.appendChild(createExpenseListRowElement(e, true));
    });
  }

  function renderCreditCardCycleOverview(cycles) {
    if (!elCcCycleOverview) return;
    elCcCycleOverview.innerHTML = "";
    var prevTotal = sumExpenseRowsAmount(
      getCreditCardExpensesInRange(cycles.previous.startKey, cycles.previous.endKey)
    );
    var curTotal = sumExpenseRowsAmount(
      getCreditCardExpensesInRange(cycles.current.startKey, cycles.current.endKey)
    );
    var paid = isCreditCardCyclePaid(cycles.previous.cycleKey);
    var daysLeft = daysUntilDayKey(cycles.previous.dueKey, new Date());

    function makeBlock(title, bodyHtml) {
      var block = document.createElement("div");
      block.className = "cc-cycle-block";
      var h = document.createElement("h3");
      h.className = "cc-cycle-block-title";
      h.textContent = title;
      block.appendChild(h);
      var body = document.createElement("div");
      body.className = "cc-cycle-block-body";
      body.innerHTML = bodyHtml;
      block.appendChild(body);
      return block;
    }

    var prevHtml =
      '<p class="cc-cycle-range">' +
      formatDayKeyViLong(cycles.previous.startKey) +
      " – " +
      formatDayKeyViLong(cycles.previous.endKey) +
      '</p><p class="cc-cycle-amount">' +
      formatMoneyVND(prevTotal) +
      "</p>";
    if (paid) {
      prevHtml += '<p class="cc-cycle-status cc-cycle-status-paid">Đã thanh toán</p>';
    } else {
      var daysText =
        daysLeft < 0
          ? "Quá hạn " + Math.abs(daysLeft) + " ngày"
          : daysLeft === 0
          ? "Hôm nay"
          : "Còn " + daysLeft + " ngày";
      prevHtml +=
        '<p class="cc-cycle-due">Hạn thanh toán: <strong>' +
        formatDayKeyViLong(cycles.previous.dueKey) +
        "</strong> — " +
        daysText +
        "</p>";
      if (prevTotal > 0) {
        prevHtml +=
          '<button type="button" class="btn btn-primary btn-sm cc-cycle-pay-btn" data-cycle-key="' +
          cycles.previous.cycleKey +
          '">Đã thanh toán</button>';
      }
    }
    elCcCycleOverview.appendChild(makeBlock("Kỳ trước (đã chốt)", prevHtml));

    var curHtml =
      '<p class="cc-cycle-range">' +
      formatDayKeyViLong(cycles.current.startKey) +
      " – " +
      formatDayKeyViLong(cycles.current.endKey) +
      '</p><p class="cc-cycle-amount cc-cycle-amount-current">Tổng chi tiêu tạm tính: <strong>' +
      formatMoneyVND(curTotal) +
      "</strong></p>";
    elCcCycleOverview.appendChild(
      makeBlock("Kỳ hiện tại (đang tiêu dùng)", curHtml)
    );

    elCcCycleOverview.querySelectorAll(".cc-cycle-pay-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-cycle-key");
        if (!key) return;
        markCreditCardCyclePaid(key);
        renderCreditCardReport();
      });
    });
  }

  function renderCreditCardReport() {
    if (!isCreditCardFeatureEnabled()) {
      syncCreditCardFeatureVisibility();
      return;
    }
    syncCreditCardFeatureVisibility();
    var cc = getCreditCardSettings();
    var cycles = computeCreditCardCycles(new Date(), cc.statementDay);
    renderCreditCardCycleOverview(cycles);
    renderCreditCardCategoryChart(cycles);
    renderCreditCardTrendChart(cycles);
    renderCreditCardTimeline(cycles);
  }

  function renderReportModeButtons() {
    var map = [
      { key: "jars", el: elReportModeJars },
      { key: "daily", el: elReportModeDaily },
    ];
    map.forEach(function (x) {
      if (!x.el) return;
      var active = reportMode === x.key;
      x.el.classList.toggle("is-active", active);
      x.el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (elReportPieView)
      elReportPieView.hidden = reportMode !== "jars";
    if (elReportDailyView) {
      elReportDailyView.hidden = reportMode !== "daily";
    }
    renderReportDailyRangeButtons();
    renderReportJarsProgress();
  }

  function setReportMode(next) {
    if (next !== "jars" && next !== "daily") return;
    if (next !== "daily") reportDailySelectedDayKey = null;
    if (next === "daily") reportDailyNeedsAutoScroll = true;
    reportMode = next;
    renderReportModeButtons();
    if (reportMode === "daily") {
      renderDailyReportChart();
    } else {
      renderPieChart();
    }
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

  function applyCloudMergedPayload(merged) {
    applyNormalizedAppData(merged);
    saveAppDataToLocal();
    applyThemeSettings();
    refreshAllCategorySelects();
    refreshMonthUiAfterCloudMerge();
    lastSyncedPayload = wirePayloadSignature(getAppPayloadForSync());
  }

  function refreshMonthUiAfterCloudMerge() {
    rebindActiveMonthState({ skipFlush: true });
    if (state && activeMonthKey) {
      state.expenses = state.expenses.map(normalizeExpenseRow);
      syncFixedIntoMonth(state, activeMonthKey);
    }
    renderSummary();
    renderExpenseList();
    renderReportModeButtons();
    if (reportMode === "daily") {
      renderDailyReportChart();
    } else {
      renderPieChart();
    }
    renderFixedTemplatesList();
    renderReportJarsProgress();
    renderCreditCardReport();
    if (elSideMenu && !elSideMenu.hidden) {
      renderSideMenuList();
    }
    if (elViewSettings && !elViewSettings.hidden) {
      renderSettingsCategoriesList();
      renderSettingsJarsList();
      renderExportMonthPicker();
      renderSettingsCreditCard();
    }
  }

  function renderAllViews() {
    renderSummary();
    renderExpenseList();
    renderReportModeButtons();
    if (reportMode === "daily") {
      renderDailyReportChart();
    } else {
      renderPieChart();
    }
    renderFixedTemplatesList();
    renderReportJarsProgress();
    renderCreditCardReport();
    if (elSideMenu && !elSideMenu.hidden) {
      renderSideMenuList();
    }
    if (elViewSettings && !elViewSettings.hidden) {
      renderSettingsCategoriesList();
      renderSettingsJarsList();
      renderExportMonthPicker();
    }
  }

  function persistAndRender(opts) {
    if (!activeMonthKey || !state) return;
    saveAppData(opts);
    renderAllViews();
  }

  async function persistAndRenderAsync(opts) {
    if (!activeMonthKey || !state) return;
    await saveAppDataAsync(opts);
    renderAllViews();
  }

  function removeExpense(id) {
    if (!state) return;
    var e = state.expenses.find(function (x) {
      return x.id === id;
    });
    if (!e) return;
    var delTs = nowTs();
    e.deletedAt = delTs;
    e.updatedAt = delTs;
    persistAndRender({ immediateSync: true });
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
    var delTs = nowTs();
    var prefix = key + "-";
    Object.keys(app.days || {}).forEach(function (dk) {
      if (dk.indexOf(prefix) === 0) delete app.days[dk];
    });
    app.months[key] = {
      deletedAt: delTs,
      income: 0,
      incomeUserSet: false,
      dataUpdatedAt: delTs,
      needSync: true,
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
      var spent = m ? totalExpensesForMonthKey(k) : 0;
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
    closeExpenseDayPicker();
    closeEditExpenseDialog();
    closeEditFixedTemplateDialog();
    closeEditCategoryDialog();
    closeEditJarDialog();
    closeSettingsDefaultLimitEdit();
    refreshSettingsDefaultLimitDisplay();
    renderThemeModeOptions();
    renderFixedTemplatesList();
    renderSettingsCategoriesList();
    renderSettingsNewCategoryIconPicker();
    renderSettingsJarsList();
    renderExportMonthPicker();
    renderSettingsCreditCard();
    setSettingsDataStatus("", "");
    setSettingsAddJarPanelOpen(false);
    setSettingsAddCategoryPanelOpen(false);
    setSettingsAddFixedPanelOpen(false);
    showSettingsView();
    setTimeout(function () {
      if (elBtnCloseSettings) elBtnCloseSettings.focus();
    }, 0);
  }

  function closeSettings() {
    cancelSettingsDefaultLimitEdit();
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
    if (activeMonthKey && state) flushActiveMonthIntoApp();
    ensureMonth(key);
    state = buildMonthState(key);
    state.expenses = state.expenses.map(normalizeExpenseRow);
    if (!state.incomeUserSet) {
      state.income = getDefaultMonthlyLimit();
    }
    syncFixedIntoMonth(state, key);
    activeMonthKey = key;
    reportJarExpandedIds = {};
    reportJarCatExpandedKeys = {};
    reportDailyRange = "month";
    reportDailyNeedsAutoScroll = true;
    expenseListFilterDayNum = null;
    expenseListDayGridSeal = "";
    expenseListDayGridExpanded = false;
    reportDailySelectedDayKey = null;

    elMonthScreenTitle.textContent = formatMonthKeyVi(key);

    setIncomeFieldFromState();
    updateAmountPreview(elAmount, elExpensePreview);
    resetAddExpenseDateInput();

    if (opts.skipPersist) {
      renderAllViews();
    } else {
      persistAndRender(opts.sync === false ? { sync: false } : undefined);
    }

    if (!opts.fromPop && !opts.skipUrl) {
      syncUrlToMonth(key);
    }
  }

  function flushIncomeFromField() {
    if (!activeMonthKey || !state || !elIncome) return;
    if (!isLimitEditOpen()) return;
    applyLimitEditAndClose(false);
  }

  /** Ghi state → localStorage trước khi đóng tab / ẩn trang (offline hoặc đang sync). */
  function persistBeforePageExit() {
    flushIncomeFromField();
    if (migrationPending || isApplyingCloudSnapshot) return;
    if (activeMonthKey && state) persistLocalNow();
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

  window.addEventListener("pagehide", persistBeforePageExit);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") persistBeforePageExit();
  });

  bindExpenseNameSuggestions(expenseNameSuggestCtxAdd);
  bindExpenseNameSuggestions(expenseNameSuggestCtxEdit);

  elForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!state) return;
    void submitAddExpenseForm();
  });

  async function submitAddExpenseForm() {
    if (!state) return;
    var amount = parseMoneyToVND(elAmount.value);
    if (amount <= 0) {
      elAmount.focus();
      return;
    }
    var nameTrim = elName.value.trim();
    var cat = elCategory.value;
    var isFixed = elExpenseFixed && elExpenseFixed.checked;
    var dateTs =
      elExpenseDate && elExpenseDate.value
        ? parseDateTimeInputsToTs(
            elExpenseDate.value,
            elExpenseTime ? elExpenseTime.value : "",
            nowTs()
          )
        : 0;
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
    var rowTs = nowTs();
    var row = {
      id: uid(),
      category: cat,
      name: nameTrim,
      amount: amount,
      createdAt: rowTs,
      updatedAt: rowTs,
    };
    if (dateTs > 0) row.dateTs = dateTs;
    if (templateId) {
      row.templateId = templateId;
      row.monthEdited = true;
    }
    if (elExpenseCreditCard && elExpenseCreditCard.checked) row.isCreditCard = true;
    state.expenses.push(row);
    touchLocalData();
    var rowDayKey = dayKeyFromTs(expenseDateTs(row));
    alignExpenseListDayFilterFromDayKey(rowDayKey);
    elName.value = "";
    hideAllExpenseNameSuggestions();
    elAmount.value = "";
    updateAmountPreview(elAmount, elExpensePreview);
    resetAddExpenseDateInput();
    if (elExpenseFixed) elExpenseFixed.checked = false;
    if (elExpenseCreditCard) elExpenseCreditCard.checked = false;
    persistLocalNow();
    await persistAndRenderAsync({
      immediateSync: true,
      sync: supabaseEnabled,
    });
    scrollAndHighlightExpenseRow(row.id);
  }

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
  if (elExpenseListDayFilterToggle) {
    elExpenseListDayFilterToggle.addEventListener("click", function () {
      expenseListDayGridExpanded = !expenseListDayGridExpanded;
      syncExpenseDayFilterControls();
    });
  }
  if (elExpenseListDayGrid && !elExpenseListDayGrid._dayGridDelegation) {
    elExpenseListDayGrid._dayGridDelegation = true;
    elExpenseListDayGrid.addEventListener("click", function (ev) {
      var t = ev.target.closest(".expense-day-grid-btn");
      if (!t || !elExpenseListDayGrid.contains(t)) return;
      var dn = parseInt(t.dataset.dayNum, 10);
      if (isNaN(dn)) return;
      if (expenseListFilterDayNum === dn) setExpenseListDayNumFilter(null);
      else setExpenseListDayNumFilter(dn);
    });
  }
  if (elExpenseListClearDay) {
    elExpenseListClearDay.addEventListener("click", function () {
      setExpenseListDayNumFilter(null);
    });
  }
  if (elExpenseDayPickerBackdrop) {
    elExpenseDayPickerBackdrop.addEventListener("click", closeExpenseDayPicker);
  }
  if (elExpenseDayPickerClose) {
    elExpenseDayPickerClose.addEventListener("click", closeExpenseDayPicker);
  }
  if (elExpenseDayPickerDone) {
    elExpenseDayPickerDone.addEventListener("click", closeExpenseDayPicker);
  }
  if (elReportModeJars) {
    elReportModeJars.addEventListener("click", function () {
      setReportMode("jars");
    });
  }
  if (elReportModeDaily) {
    elReportModeDaily.addEventListener("click", function () {
      setReportMode("daily");
    });
  }
  if (elReportDailyRangeMonth) {
    elReportDailyRangeMonth.addEventListener("click", function () {
      if (reportDailyRange === "month") return;
      reportDailyRange = "month";
      reportDailyNeedsAutoScroll = true;
      renderReportModeButtons();
      renderDailyReportChart();
    });
  }
  if (elReportDailyRange7Days) {
    elReportDailyRange7Days.addEventListener("click", function () {
      if (reportDailyRange === "7days") return;
      reportDailyRange = "7days";
      reportDailyNeedsAutoScroll = true;
      renderReportModeButtons();
      renderDailyReportChart();
    });
  }
  elBtnOpenMenu.addEventListener("click", openSideMenu);
  elBtnCloseMenu.addEventListener("click", closeSideMenu);
  elSideMenuBackdrop.addEventListener("click", closeSideMenu);

  elBtnOpenSettings.addEventListener("click", openSettings);
  elBtnCloseSettings.addEventListener("click", closeSettings);

  if (elBtnSettingsDefaultLimitEdit) {
    elBtnSettingsDefaultLimitEdit.addEventListener("click", openSettingsDefaultLimitEdit);
  }
  if (elBtnSettingsDefaultLimitSave) {
    elBtnSettingsDefaultLimitSave.addEventListener("click", saveSettingsDefaultLimitEdit);
  }
  if (elBtnSettingsDefaultLimitCancel) {
    elBtnSettingsDefaultLimitCancel.addEventListener("click", cancelSettingsDefaultLimitEdit);
  }
  if (elSettingsDefaultLimit) {
    elSettingsDefaultLimit.addEventListener("keydown", function (ev) {
      if (!isSettingsDefaultLimitEditOpen()) return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        saveSettingsDefaultLimitEdit();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        cancelSettingsDefaultLimitEdit();
      }
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

  if (elSettingsCreditCardEnabled) {
    elSettingsCreditCardEnabled.addEventListener("change", saveSettingsCreditCardFromUi);
  }
  if (elSettingsCreditCardStatementDay) {
    elSettingsCreditCardStatementDay.addEventListener("change", saveSettingsCreditCardFromUi);
  }
  if (elCcCategoryCycleCurrent) {
    elCcCategoryCycleCurrent.addEventListener("click", function () {
      creditReportCategoryCycle = "current";
      renderCreditCardReport();
    });
  }
  if (elCcCategoryCyclePrevious) {
    elCcCategoryCyclePrevious.addEventListener("click", function () {
      creditReportCategoryCycle = "previous";
      renderCreditCardReport();
    });
  }
  if (elCcTimelineLargeOnly) {
    elCcTimelineLargeOnly.addEventListener("change", function () {
      creditReportLargeOnly = !!elCcTimelineLargeOnly.checked;
      renderCreditCardReport();
    });
  }

  if (elBtnExportDataToggleAll) {
    elBtnExportDataToggleAll.addEventListener("click", function () {
      if (!elSettingsExportMonths) return;
      var inputs = elSettingsExportMonths.querySelectorAll(
        'input[type="checkbox"][data-month-key]'
      );
      var checked = elSettingsExportMonths.querySelectorAll(
        'input[type="checkbox"][data-month-key]:checked'
      );
      var nextChecked = !(inputs.length > 0 && checked.length === inputs.length);
      var i;
      for (i = 0; i < inputs.length; i++) {
        inputs[i].checked = nextChecked;
      }
      syncExportToggleAllLabel();
    });
  }

  if (elBtnExportData) {
    elBtnExportData.addEventListener("click", exportSelectedData);
  }

  if (elBtnImportData && elSettingsImportFile) {
    elBtnImportData.addEventListener("click", function () {
      elSettingsImportFile.value = "";
      elSettingsImportFile.click();
    });
    elSettingsImportFile.addEventListener("change", function () {
      var file = elSettingsImportFile.files && elSettingsImportFile.files[0];
      if (!file) return;
      importDataFile(file).catch(function (err) {
        setSettingsDataStatus(
          err && err.message ? err.message : "Import dữ liệu thất bại.",
          "error"
        );
      });
    });
  }

  if (elBtnDeleteAllData) {
    elBtnDeleteAllData.addEventListener("click", function () {
      void wipeAllAppData();
    });
  }

  if (elBtnMigrationRun) {
    elBtnMigrationRun.addEventListener("click", function () {
      elBtnMigrationRun.disabled = true;
      setMigrationModalStatus("Đang chuyển dữ liệu...", "");
      setTimeout(function () {
        var res = runDataMigration();
        if (res.ok) {
          var msg = res.message;
          if (res.warnings && res.warnings.length) {
            msg += " Cảnh báo: " + res.warnings.slice(0, 3).join(" ");
            if (res.warnings.length > 3) msg += " (+" + (res.warnings.length - 3) + " nữa)";
          }
          setMigrationModalStatus(msg, "ok");
          hideMigrationModal();
          var bootKey = currentMonthKey();
          void finishAppBootstrap(bootKey);
          renderExportMonthPicker();
          renderAllViews();
          if (supabaseEnabled && supabaseClient) {
            void syncToSupabaseNow({ forceLocal: true });
          }
        } else {
          setMigrationModalStatus(res.message, "error");
          elBtnMigrationRun.disabled = false;
        }
      }, 0);
    });
  }
  if (elMigrationBackdrop) {
    elMigrationBackdrop.addEventListener("click", function (ev) {
      ev.preventDefault();
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
      var iconId = elSettingsNewCategoryIconId ? elSettingsNewCategoryIconId.value : "food";
      var newCat = normalizeCategoryRow({ id: catUid(), label: lab, iconId: iconId });
      app.categories.push(newCat);
      setCategoryJarAssignment(
        newCat.id,
        readCategoryJarPickerValue(elSettingsNewCategoryJar, elSettingsNewCategoryJarPicker)
      );
      saveAppData({ configDirty: true });
      renderSettingsCategoriesList();
      renderSettingsJarsList();
      renderNewJarCategoryCheckboxes();
      refreshAllCategorySelects();
      if (activeMonthKey && state) persistAndRender();
      setSettingsAddCategoryPanelOpen(false);
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
      saveAppData({ configDirty: true });
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
  if (elEditJarDelete) {
    elEditJarDelete.addEventListener("click", function () {
      if (!editingJarId) return;
      if (deleteJarFromSettings(editingJarId)) closeEditJarDialog();
    });
  }
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
  if (elEditCategoryDelete) {
    elEditCategoryDelete.addEventListener("click", function () {
      if (!editingCategoryId) return;
      if (deleteCategoryFromSettings(editingCategoryId)) closeEditCategoryDialog();
    });
  }
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
    saveAppData({ configDirty: true });
    if (state) syncFixedIntoMonth(state, activeMonthKey);
    renderFixedTemplatesList();
    if (activeMonthKey && state) persistAndRender();
    setSettingsAddFixedPanelOpen(false);
  });

  elEditFixedSave.addEventListener("click", saveEditFixedTemplateDialog);
  elEditFixedCancel.addEventListener("click", closeEditFixedTemplateDialog);
  elEditFixedBackdrop.addEventListener("click", closeEditFixedTemplateDialog);
  if (elEditFixedDelete) {
    elEditFixedDelete.addEventListener("click", function () {
      if (!editingFixedTemplateId) return;
      if (
        !confirm(
          "Xóa khoản cố định này? Các tháng sau sẽ không tự thêm nữa. Dòng trong các tháng giữ nguyên — bạn có thể xóa tay trong danh sách chi."
        )
      ) {
        return;
      }
      removeFixedTemplateById(editingFixedTemplateId);
      closeEditFixedTemplateDialog();
    });
  }
  elEditFixedAmount.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      saveEditFixedTemplateDialog();
    }
  });

  function openEditExpenseDialog(expenseId) {
    if (!state || !elEditDialog) return;
    cancelLimitEdit();
    closeExpenseDayPicker();
    closeEditFixedTemplateDialog();
    closeEditCategoryDialog();
    closeEditJarDialog();
    hideAllExpenseNameSuggestions();
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
    var tsForEdit = expenseDateTs(e);
    if (elEditExpenseDate) {
      elEditExpenseDate.value = formatDateInputValueFromTs(tsForEdit);
    }
    if (elEditExpenseTime) {
      elEditExpenseTime.value = formatTimeInputValueFromTs(tsForEdit);
    }
    if (elEditExpenseFixed) {
      elEditExpenseFixed.checked = !!e.templateId;
      // Không cho tạo mới khoản cố định từ tháng quá khứ.
      // Nếu khoản đã là cố định (có templateId) thì vẫn cho xem trạng thái.
      elEditExpenseFixed.disabled = isPastMonth && !e.templateId;
      elEditExpenseFixed.title = elEditExpenseFixed.disabled
        ? "Chỉ bật cố định ở tháng hiện tại hoặc tương lai."
        : "";
    }
    if (elEditExpenseCreditCard) {
      elEditExpenseCreditCard.checked = !!e.isCreditCard;
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
    updateModalOpenBodyLock();
    setTimeout(function () {
      elEditAmount.focus();
      elEditAmount.select();
    }, 0);
  }

  function closeEditExpenseDialog() {
    editingExpenseId = null;
    hideExpenseNameSuggestions(expenseNameSuggestCtxEdit);
    if (elEditDialog) {
      elEditDialog.hidden = true;
      elEditDialog.setAttribute("aria-hidden", "true");
    }
    updateModalOpenBodyLock();
  }

  function closeEditFixedTemplateDialog() {
    editingFixedTemplateId = null;
    if (elEditFixedDialog) {
      elEditFixedDialog.hidden = true;
      elEditFixedDialog.setAttribute("aria-hidden", "true");
    }
    updateModalOpenBodyLock();
  }

  function openEditFixedTemplateDialog(templateId) {
    closeEditCategoryDialog();
    closeEditJarDialog();
    closeExpenseDayPicker();
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
    updateModalOpenBodyLock();
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
    closeEditFixedTemplateDialog();
    renderFixedTemplatesList();
    if (activeMonthKey && state) persistAndRender({ immediateSync: true, configDirty: true });
    else saveAppData({ immediateSync: true, configDirty: true });
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
    if (elEditExpenseDate && elEditExpenseDate.value) {
      var prevTs = expenseDateTs(e) || nowTs();
      var timeVal = elEditExpenseTime ? elEditExpenseTime.value : "";
      var nextDateTs = parseDateTimeInputsToTs(elEditExpenseDate.value, timeVal, prevTs);
      if (nextDateTs > 0) {
        e.dateTs = nextDateTs;
      }
    }
    e.updatedAt = nowTs();
    if (isCreditCardFeatureEnabled()) {
      e.isCreditCard = !!(elEditExpenseCreditCard && elEditExpenseCreditCard.checked);
    } else {
      delete e.isCreditCard;
    }
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
      e.monthEdited = true;
      var t = findFixedTemplate(e.templateId);
      if (t) {
        t.category = cat;
        t.name = nameTrim;
        t.amount = amount;
        t.updatedAt = nowTs();
      }
    }
    closeEditExpenseDialog();
    persistAndRender({ immediateSync: true });
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      if (isLimitEditOpen()) {
        ev.preventDefault();
        cancelLimitEdit();
        return;
      }
      if (isSettingsDefaultLimitEditOpen()) {
        ev.preventDefault();
        cancelSettingsDefaultLimitEdit();
        return;
      }
      if (elExpenseDayPickerDialog && !elExpenseDayPickerDialog.hidden) {
        ev.preventDefault();
        closeExpenseDayPicker();
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
  closeSettingsDefaultLimitEdit();
  refreshSettingsDefaultLimitDisplay();
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

  if (migrationPending) {
    showMigrationModal();
  } else {
    void finishAppBootstrap(initialKey);
  }

  document.addEventListener("visibilitychange", function () {
    if (!supabaseEnabled || !supabaseClient) return;
    if (document.visibilityState === "hidden") {
      if (cloudSyncTimer) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
      }
      void syncToSupabaseNow();
    } else if (document.visibilityState === "visible") {
      if (cloudSyncTimer) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
      }
      resumeCloudSyncFromBackground();
    }
  });
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) resumeCloudSyncFromBackground();
  });
  window.addEventListener("pagehide", function () {
    persistBeforePageExit();
    if (supabaseEnabled && supabaseClient) {
      if (cloudSyncTimer) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
      }
      void syncToSupabaseNow();
    }
  });
})();
