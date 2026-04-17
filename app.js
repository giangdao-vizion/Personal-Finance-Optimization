(function () {
  "use strict";

  var STORAGE_V1 = "family-budget-v1";
  var STORAGE_V2 = "family-budget-v2";
  var MENU_MONTH_SPAN = 60;

  var CATEGORIES = [
    { id: "an-uong", label: "Ăn uống", icon: "🍜" },
    { id: "thoi-trang", label: "Thời trang", icon: "👔" },
    { id: "giai-tri", label: "Giải trí", icon: "🎮" },
    { id: "con-nhim", label: "Nhím", icon: "🦔" },
    { id: "con-hy", label: "Hy", icon: "🌸" },
    { id: "sinh-hoat", label: "Sinh hoạt", icon: "💡" },
    { id: "di-lai", label: "Đi lại / Giao thông", icon: "🚗" },
    { id: "suc-khoe", label: "Sức khỏe", icon: "💊" },
    { id: "nha-cua", label: "Nhà cửa / Tiện ích", icon: "🏠" },
    { id: "hoc-tap", label: "Học tập / Phát triển", icon: "📚" },
    { id: "tiet-kiem", label: "Tiết kiệm", icon: "💰" },
    { id: "dau-tu", label: "Đầu tư", icon: "📈" },
    { id: "tra-no", label: "Trả nợ", icon: "📉" },
    { id: "khac", label: "Khác", icon: "📌" },
  ];

  var categoryMap = {};
  var categoryIconMap = {};
  CATEGORIES.forEach(function (c) {
    categoryMap[c.id] = c.label;
    categoryIconMap[c.id] = c.icon;
  });

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
    return [
      {
        id: "ft-default-tiet-kiem",
        category: "tiet-kiem",
        name: "",
        amount: 20000000,
      },
    ];
  }

  function defaultSettings() {
    return { defaultLimit: 0 };
  }

  function normalizeSettings(s) {
    var out = s && typeof s === "object" ? s : {};
    var lim = out.defaultLimit;
    out.defaultLimit =
      typeof lim === "number" && !isNaN(lim) ? Math.max(0, Math.round(lim)) : 0;
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
        return {
          months: months,
          fixedTemplates: fixedTemplates,
          settings: settings,
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
            })
          );
        } catch (e3) {}
      }
    } catch (e2) {}
    return {
      months: months,
      fixedTemplates: defaultFixedTemplates(),
      settings: defaultSettings(),
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
        })
      );
    } catch (e) {}
  }

  var app = loadAppData();
  if (!Array.isArray(app.fixedTemplates)) app.fixedTemplates = defaultFixedTemplates();
  if (!app.settings || typeof app.settings !== "object") app.settings = defaultSettings();
  app.settings = normalizeSettings(app.settings);

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
  var activeMonthKey = null;
  var state = null;
  var editingExpenseId = null;
  var editingFixedTemplateId = null;
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
  var elSumIncome = document.getElementById("sum-income");
  var elSumExpenses = document.getElementById("sum-expenses");
  var elSumBalance = document.getElementById("sum-balance");
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
  var elSettingsFixedList = document.getElementById("settings-fixed-templates-list");
  var elSettingsAddFixedForm = document.getElementById("settings-add-fixed-form");
  var elSettingsAddFixedCategory = document.getElementById("settings-add-fixed-category");
  var elSettingsAddFixedName = document.getElementById("settings-add-fixed-name");
  var elSettingsAddFixedAmount = document.getElementById("settings-add-fixed-amount");
  var elSettingsAddFixedAmountPreview = document.getElementById("settings-add-fixed-amount-preview");

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
  var elEditAmount = document.getElementById("edit-expense-amount");
  var elEditAmountPreview = document.getElementById("edit-expense-amount-preview");
  var elEditTemplateNote = document.getElementById("edit-expense-template-note");
  var elEditSave = document.getElementById("edit-expense-save");
  var elEditCancel = document.getElementById("edit-expense-cancel");

  function fillCategorySelect(el) {
    if (!el) return;
    el.innerHTML = "";
    CATEGORIES.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.icon + "  " + c.label;
      el.appendChild(opt);
    });
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
    var o = {
      id: row.id || uid(),
      category: cat && categoryMap[cat] ? cat : "khac",
      name: typeof row.name === "string" ? row.name.trim() : "",
      amount: typeof row.amount === "number" && row.amount >= 0 ? Math.round(row.amount) : 0,
    };
    if (row.templateId) o.templateId = row.templateId;
    return o;
  }

  function syncFixedIntoMonth(m) {
    if (!Array.isArray(app.fixedTemplates)) return;
    app.fixedTemplates.forEach(function (t) {
      if (!t || !t.id || !categoryMap[t.category]) return;
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
    CATEGORIES.forEach(function (c) {
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
    CATEGORIES.forEach(function (c) {
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
  }

  function renderBreakdown() {
    elBreakdown.innerHTML = "";
    if (!state) return;
    var byCat = totalsByCategory();
    CATEGORIES.forEach(function (c) {
      var amt = byCat[c.id] || 0;
      if (amt === 0) return;
      var li = document.createElement("li");
      li.className = "breakdown-item";
      var icon = document.createElement("span");
      icon.className = "breakdown-icon";
      icon.textContent = c.icon;
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
      var catLabel = categoryMap[t.category] || t.category;
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
    var hasRows = state.expenses.length > 0;
    elEmpty.hidden = hasRows;

    state.expenses.forEach(function (e) {
      var li = document.createElement("li");
      li.className = "expense-row";
      li.dataset.id = e.id;

      var ico = document.createElement("span");
      ico.className = "expense-cat-ico";
      ico.textContent = categoryIconMap[e.category] || "📌";
      ico.title = categoryMap[e.category] || e.category;

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
      var namePart = e.name
        ? e.name
        : categoryMap[e.category] || e.category;
      line.textContent = namePart;
      line.title = categoryMap[e.category] + (e.name ? " · " + e.name : "");
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
  }

  function persistAndRender() {
    if (!activeMonthKey || !state) return;
    saveAppData();
    renderSummary();
    renderBreakdown();
    renderExpenseList();
    renderPieChart();
    renderFixedTemplatesList();
    if (elSideMenu && !elSideMenu.hidden) {
      renderSideMenuList();
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
    if (elSettingsDefaultLimit) {
      elSettingsDefaultLimit.value = formatAsNganDisplay(getDefaultMonthlyLimit());
      updateAmountPreview(elSettingsDefaultLimit, elSettingsDefaultLimitPreview);
    }
    renderFixedTemplatesList();
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
    elAmount.focus();
  });

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

  elSettingsAddFixedForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var amount = parseMoneyToVND(elSettingsAddFixedAmount.value);
    if (amount <= 0) {
      elSettingsAddFixedAmount.focus();
      return;
    }
    var cat = elSettingsAddFixedCategory.value;
    if (!categoryMap[cat]) return;
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
    var e = state.expenses.find(function (x) {
      return x.id === expenseId;
    });
    if (!e) return;
    editingExpenseId = expenseId;
    var cat = categoryMap[e.category] || e.category;
    var line = e.name ? e.name + " · " + cat : cat;
    elEditDesc.textContent = line;
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
    if (!elEditFixedDialog || elEditFixedDialog.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  function closeEditFixedTemplateDialog() {
    editingFixedTemplateId = null;
    if (elEditFixedDialog) {
      elEditFixedDialog.hidden = true;
      elEditFixedDialog.setAttribute("aria-hidden", "true");
    }
    if (!elEditDialog || elEditDialog.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  function openEditFixedTemplateDialog(templateId) {
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
    if (!categoryMap[cat]) return;
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
    var amount = parseMoneyToVND(elEditAmount.value);
    if (amount <= 0) {
      elEditAmount.focus();
      return;
    }
    e.amount = amount;
    if (e.templateId) {
      var t = findFixedTemplate(e.templateId);
      if (t) t.amount = amount;
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
