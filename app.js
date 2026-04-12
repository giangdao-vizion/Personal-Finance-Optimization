(function () {
  "use strict";

  var STORAGE_V1 = "family-budget-v1";
  var STORAGE_V2 = "family-budget-v2";

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

  function uid() {
    return "e-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function loadAppData() {
    try {
      var raw = localStorage.getItem(STORAGE_V2);
      if (raw) {
        var d = JSON.parse(raw);
        return {
          months: d.months && typeof d.months === "object" ? d.months : {},
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
            JSON.stringify({ months: months })
          );
        } catch (e3) {}
      }
    } catch (e2) {}
    return { months: months };
  }

  function saveAppData() {
    try {
      localStorage.setItem(
        STORAGE_V2,
        JSON.stringify({ months: app.months })
      );
    } catch (e) {}
  }

  var app = loadAppData();
  var activeMonthKey = null;
  var state = null;
  var selectedYear = new Date().getFullYear();

  function ensureMonth(k) {
    if (!app.months[k]) app.months[k] = { income: 0, expenses: [] };
    if (!Array.isArray(app.months[k].expenses)) app.months[k].expenses = [];
    if (typeof app.months[k].income !== "number") app.months[k].income = 0;
    return app.months[k];
  }

  function monthKeysForYear(y) {
    var prefix = String(y) + "-";
    return Object.keys(app.months)
      .filter(function (k) {
        return k.length === 7 && k.indexOf(prefix) === 0;
      })
      .sort(function (a, b) {
        return b.localeCompare(a);
      });
  }

  function totalExpensesForMonth(m) {
    if (!m || !m.expenses) return 0;
    return m.expenses.reduce(function (s, e) {
      return s + (typeof e.amount === "number" ? e.amount : 0);
    }, 0);
  }

  function aggregateYear(y) {
    var keys = monthKeysForYear(y);
    var inc = 0;
    var exp = 0;
    keys.forEach(function (k) {
      var m = app.months[k];
      inc += m.income || 0;
      exp += totalExpensesForMonth(m);
    });
    return { income: inc, expenses: exp, balance: inc - exp };
  }

  function formatMonthKeyVi(key) {
    var p = key.split("-");
    if (p.length !== 2) return key;
    return "Tháng " + String(parseInt(p[1], 10)) + " · " + p[0];
  }

  var elHome = document.getElementById("screen-home");
  var elMonth = document.getElementById("screen-month");
  var elYearDisplay = document.getElementById("year-display");
  var elYearIncome = document.getElementById("year-sum-income");
  var elYearExpenses = document.getElementById("year-sum-expenses");
  var elYearBalance = document.getElementById("year-sum-balance");
  var elMonthList = document.getElementById("month-list");
  var elMonthListEmpty = document.getElementById("month-list-empty");
  var elNewMonthInput = document.getElementById("new-month-input");
  var elBtnOpenMonth = document.getElementById("btn-open-month");
  var elYearPrev = document.getElementById("year-prev");
  var elYearNext = document.getElementById("year-next");
  var elBtnBack = document.getElementById("btn-back-home");
  var elMonthScreenTitle = document.getElementById("month-screen-title");

  var elIncome = document.getElementById("monthly-income");
  var elIncomePreview = document.getElementById("income-amount-preview");
  var elCategory = document.getElementById("expense-category");
  var elName = document.getElementById("expense-name");
  var elAmount = document.getElementById("expense-amount");
  var elExpensePreview = document.getElementById("expense-amount-preview");
  var elForm = document.getElementById("expense-form");
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

  function fillCategorySelect() {
    elCategory.innerHTML = "";
    CATEGORIES.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.icon + "  " + c.label;
      elCategory.appendChild(opt);
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
    return {
      id: row.id || uid(),
      category: cat && categoryMap[cat] ? cat : "khac",
      name: typeof row.name === "string" ? row.name.trim() : "",
      amount: typeof row.amount === "number" && row.amount >= 0 ? Math.round(row.amount) : 0,
    };
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

    elSumIncome.textContent = formatMoneyVND(income);
    elSumExpenses.textContent = formatMoneyVND(spent);
    elSumBalance.textContent = formatMoneyVND(balance);

    var highlight = elSumBalance.closest(".summary-item");
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
      var line = document.createElement("span");
      line.className = "expense-row-line";
      var namePart = e.name
        ? e.name
        : categoryMap[e.category] || e.category;
      line.textContent = namePart;
      line.title = categoryMap[e.category] + (e.name ? " · " + e.name : "");
      mid.appendChild(line);

      var amt = document.createElement("span");
      amt.className = "expense-row-amt";
      amt.textContent = formatMoneyVND(e.amount);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-icon btn-icon-danger";
      btn.setAttribute("aria-label", "Xóa khoản chi");
      btn.appendChild(iconTrashSvg());
      btn.addEventListener("click", function () {
        removeExpense(e.id);
      });

      li.appendChild(ico);
      li.appendChild(mid);
      li.appendChild(amt);
      li.appendChild(btn);
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
  }

  function removeExpense(id) {
    if (!state) return;
    state.expenses = state.expenses.filter(function (e) {
      return e.id !== id;
    });
    persistAndRender();
  }

  function renderHome() {
    elYearDisplay.textContent = String(selectedYear);
    var y = aggregateYear(selectedYear);
    elYearIncome.textContent = formatMoneyVND(y.income);
    elYearExpenses.textContent = formatMoneyVND(y.expenses);
    elYearBalance.textContent = formatMoneyVND(y.balance);
    var yb = elYearBalance.closest(".summary-item");
    if (yb) yb.classList.toggle("negative", y.balance < 0);

    elMonthList.innerHTML = "";
    var keys = monthKeysForYear(selectedYear);
    elMonthListEmpty.hidden = keys.length > 0;

    keys.forEach(function (k) {
      var m = app.months[k];
      var spent = totalExpensesForMonth(m);
      var inc = m.income || 0;
      var bal = inc - spent;

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "month-row";

      var cal = document.createElement("span");
      cal.className = "month-row-ico";
      cal.setAttribute("aria-hidden", "true");
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "icon-svg icon-svg-muted");
      svg.setAttribute("width", "22");
      svg.setAttribute("height", "22");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#icon-calendar");
      svg.appendChild(use);
      cal.appendChild(svg);

      var txt = document.createElement("span");
      txt.className = "month-row-text";
      var t1 = document.createElement("span");
      t1.className = "month-row-title";
      t1.textContent = formatMonthKeyVi(k);
      var t2 = document.createElement("span");
      t2.className = "month-row-meta";
      t2.textContent =
        "Thu " +
        formatMoneyVND(inc) +
        " · Chi " +
        formatMoneyVND(spent) +
        " · Còn " +
        formatMoneyVND(bal);
      txt.appendChild(t1);
      txt.appendChild(t2);

      var arr = document.createElement("span");
      arr.className = "month-row-chevron";
      arr.setAttribute("aria-hidden", "true");
      var svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg2.setAttribute("class", "icon-svg");
      svg2.setAttribute("width", "18");
      svg2.setAttribute("height", "18");
      var use2 = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use2.setAttribute("href", "#icon-chevron-right");
      svg2.appendChild(use2);
      arr.appendChild(svg2);

      btn.appendChild(cal);
      btn.appendChild(txt);
      btn.appendChild(arr);
      btn.addEventListener("click", function () {
        openMonth(k);
      });

      li.appendChild(btn);
      elMonthList.appendChild(li);
    });
  }

  function openMonth(key) {
    flushIncomeFromField();
    ensureMonth(key);
    state = app.months[key];
    state.expenses = state.expenses.map(normalizeExpenseRow);
    activeMonthKey = key;

    elHome.hidden = true;
    elMonth.hidden = false;
    elMonthScreenTitle.textContent = formatMonthKeyVi(key);

    elIncome.value = formatAsNganDisplay(state.income);
    updateAmountPreview(elIncome, elIncomePreview);
    updateAmountPreview(elAmount, elExpensePreview);

    persistAndRender();
  }

  function goHome() {
    flushIncomeFromField();
    activeMonthKey = null;
    state = null;
    elMonth.hidden = true;
    elHome.hidden = false;
    renderHome();
  }

  function flushIncomeFromField() {
    if (!activeMonthKey || !state || !elIncome) return;
    var v = parseMoneyToVND(elIncome.value);
    if (v !== state.income) {
      state.income = v;
      elIncome.value = formatAsNganDisplay(state.income);
      updateAmountPreview(elIncome, elIncomePreview);
      saveAppData();
    }
  }

  elIncome.addEventListener("blur", function () {
    if (!state) return;
    state.income = parseMoneyToVND(elIncome.value);
    elIncome.value = formatAsNganDisplay(state.income);
    updateAmountPreview(elIncome, elIncomePreview);
    persistAndRender();
    renderHome();
  });

  elIncome.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      elIncome.blur();
    }
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
    state.expenses.push({
      id: uid(),
      category: elCategory.value,
      name: elName.value.trim(),
      amount: amount,
    });
    elName.value = "";
    elAmount.value = "";
    updateAmountPreview(elAmount, elExpensePreview);
    persistAndRender();
    renderHome();
    elAmount.focus();
  });

  elBtnClear.addEventListener("click", function () {
    if (!state || !state.expenses.length) return;
    if (
      confirm(
        "Xóa hết các khoản chi của tháng này? Thu nhập tháng giữ nguyên."
      )
    ) {
      state.expenses = [];
      persistAndRender();
      renderHome();
    }
  });

  elBtnBack.addEventListener("click", goHome);

  elYearPrev.addEventListener("click", function () {
    selectedYear -= 1;
    renderHome();
  });

  elYearNext.addEventListener("click", function () {
    selectedYear += 1;
    renderHome();
  });

  elBtnOpenMonth.addEventListener("click", function () {
    var v = elNewMonthInput && elNewMonthInput.value;
    if (!v || v.length < 7) return;
    openMonth(v);
  });

  fillCategorySelect();
  bindAmountPreview(elIncome, elIncomePreview);
  bindAmountPreview(elAmount, elExpensePreview);

  if (elNewMonthInput) elNewMonthInput.value = currentMonthKey();

  elHome.hidden = false;
  elMonth.hidden = true;
  renderHome();
})();
