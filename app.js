(function () {
  "use strict";

  var STORAGE_KEY = "family-budget-v1";

  var CATEGORIES = [
    { id: "an-uong", label: "Ăn uống" },
    { id: "thoi-trang", label: "Thời trang" },
    { id: "giai-tri", label: "Giải trí" },
    { id: "con-nhim", label: "Nhím" },
    { id: "con-hy", label: "Hy" },
    { id: "sinh-hoat", label: "Sinh hoạt" },
    { id: "di-lai", label: "Đi lại / Giao thông" },
    { id: "suc-khoe", label: "Sức khỏe" },
    { id: "nha-cua", label: "Nhà cửa / Tiện ích" },
    { id: "hoc-tap", label: "Học tập / Phát triển" },
    { id: "tiet-kiem", label: "Tiết kiệm" },
    { id: "dau-tu", label: "Đầu tư" },
    { id: "tra-no", label: "Trả nợ" },
    { id: "khac", label: "Khác" },
  ];

  var categoryMap = {};
  CATEGORIES.forEach(function (c) {
    categoryMap[c.id] = c.label;
  });

  var MONEY_UNITS = {
    trieu: 1000000,
    "tram-nghin": 100000,
  };

  var PLACEHOLDER_BY_UNIT = {
    trieu: "Ví dụ: 25 hoặc 1,5",
    "tram-nghin": "Ví dụ: 250 (= 25 triệu)",
  };

  function parseMoneyInput(str) {
    if (str == null || String(str).trim() === "") return 0;
    var cleaned = String(str)
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");
    var n = parseFloat(cleaned);
    return isNaN(n) ? 0 : Math.round(n);
  }

  /** Hệ số nhập (triệu / trăm ngàn): cho phép 2,5 hoặc 2.5 — không dùng dấu . phân cách hàng nghìn. */
  function parseCoefficientForScaledUnit(str) {
    if (str == null || String(str).trim() === "") return 0;
    var s = String(str).trim().replace(/\s/g, "").replace(",", ".");
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseMoneyToVND(str, unitKey) {
    var s = String(str || "").trim();
    if (!s) return 0;
    if (looksLikeFormattedVND(s)) return parseMoneyInput(s);
    var mult = MONEY_UNITS[unitKey];
    if (mult == null) mult = MONEY_UNITS.trieu;
    var coef = parseCoefficientForScaledUnit(s);
    return Math.round(coef * mult);
  }

  /** Hiển thị lại ô thu nhập theo hệ số triệu sau khi lưu. */
  function formatAsTrieuCoefficient(vnd) {
    if (!vnd || vnd <= 0) return "";
    var t = vnd / 1000000;
    var rounded = Math.round(t * 1000) / 1000;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
    return rounded.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }

  /** Tránh nhầm "1.500.000" (VNĐ) khi đã chọn Triệu — parseFloat chỉ đọc được 1.5. */
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

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { income: 0, expenses: [] };
      var data = JSON.parse(raw);
      return {
        income: typeof data.income === "number" ? data.income : parseMoneyInput(data.income),
        expenses: Array.isArray(data.expenses) ? data.expenses : [],
      };
    } catch (e) {
      return { income: 0, expenses: [] };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ income: state.income, expenses: state.expenses })
      );
    } catch (e) {
      /* ignore quota */
    }
  }

  var state = loadState();

  var elIncome = document.getElementById("monthly-income");
  var elIncomePreview = document.getElementById("income-amount-preview");
  var elIncomeUnitSlider = document.getElementById("income-unit-slider");
  var elCategory = document.getElementById("expense-category");
  var elName = document.getElementById("expense-name");
  var elAmount = document.getElementById("expense-amount");
  var elExpensePreview = document.getElementById("expense-amount-preview");
  var elExpenseUnitSlider = document.getElementById("expense-unit-slider");
  var elForm = document.getElementById("expense-form");
  var elTbody = document.getElementById("expense-tbody");
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
      opt.textContent = c.label;
      elCategory.appendChild(opt);
    });
  }

  function getRadioGroupValue(name) {
    var el = document.querySelector(
      'input[type="radio"][name="' + name + '"]:checked'
    );
    return el && el.value ? el.value : "trieu";
  }

  function setIncomeUnitTrieu() {
    var r = document.getElementById("income-unit-trieu");
    if (r) r.checked = true;
  }

  function syncAmountPlaceholder(inputEl, unitKey) {
    var ph = PLACEHOLDER_BY_UNIT[unitKey] || PLACEHOLDER_BY_UNIT.trieu;
    inputEl.placeholder = ph;
  }

  function formatPreviewPlainVND(vnd) {
    if (!vnd || vnd <= 0) return "";
    return vnd.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " \u20ab";
  }

  function updateAmountPreview(inputEl, previewEl, radioName) {
    if (!previewEl) return;
    var vnd = parseMoneyToVND(inputEl.value, getRadioGroupValue(radioName));
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

  function bindAmountPreview(inputEl, previewEl, radioName) {
    if (!inputEl || !previewEl) return;
    function tick() {
      updateAmountPreview(inputEl, previewEl, radioName);
    }
    inputEl.addEventListener("input", tick);
    inputEl.addEventListener("focus", tick);
    tick();
  }

  function bindUnitSlider(container, inputEl, previewEl, radioName) {
    if (!container) return;
    var radios = container.querySelectorAll('input[type="radio"]');
    function currentUnit() {
      var n = radios[0] && radios[0].name;
      return n ? getRadioGroupValue(n) : "trieu";
    }
    var name = radioName || (radios[0] && radios[0].name) || "";
    function onChange() {
      if (looksLikeFormattedVND(inputEl.value)) inputEl.value = "";
      syncAmountPlaceholder(inputEl, currentUnit());
      if (previewEl && name) updateAmountPreview(inputEl, previewEl, name);
    }
    radios.forEach(function (r) {
      r.addEventListener("change", onChange);
    });
    syncAmountPlaceholder(inputEl, currentUnit());
    if (previewEl && name) updateAmountPreview(inputEl, previewEl, name);
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

  state.expenses = state.expenses.map(normalizeExpenseRow);

  function totalExpenses() {
    return state.expenses.reduce(function (s, e) {
      return s + e.amount;
    }, 0);
  }

  function totalsByCategory() {
    var map = {};
    CATEGORIES.forEach(function (c) {
      map[c.id] = 0;
    });
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
    if (!elPieBody || !elPieSlices || !elPieLegend) return;
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
        "<span class=\"pie-legend-label\"></span>" +
        "<span class=\"pie-legend-meta\"></span>";
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
      elPieTitle.textContent =
        "Chi tiêu theo danh mục: " + parts.join(", ");
    }
  }

  function renderSummary() {
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
    var byCat = totalsByCategory();
    elBreakdown.innerHTML = "";
    CATEGORIES.forEach(function (c) {
      var amt = byCat[c.id] || 0;
      if (amt === 0) return;
      var li = document.createElement("li");
      li.className = "breakdown-item";
      li.innerHTML =
        '<span class="label"></span><span class="amount"></span>';
      li.querySelector(".label").textContent = c.label;
      li.querySelector(".amount").textContent = formatMoneyVND(amt);
      elBreakdown.appendChild(li);
    });
    if (!elBreakdown.children.length) {
      var empty = document.createElement("li");
      empty.className = "breakdown-item";
      empty.style.border = "none";
      empty.style.color = "var(--muted)";
      empty.textContent = "Chưa có chi theo danh mục.";
      elBreakdown.appendChild(empty);
    }
  }

  function renderTable() {
    elTbody.innerHTML = "";
    var hasRows = state.expenses.length > 0;
    elEmpty.hidden = hasRows;

    state.expenses.forEach(function (e) {
      var tr = document.createElement("tr");
      tr.dataset.id = e.id;

      var tdCat = document.createElement("td");
      tdCat.setAttribute("data-label", "Danh mục");
      var badge = document.createElement("span");
      badge.className = "cat-badge";
      badge.textContent = categoryMap[e.category] || e.category;
      tdCat.appendChild(badge);

      var tdName = document.createElement("td");
      tdName.setAttribute("data-label", "Tên");
      tdName.className = "expense-name-cell" + (e.name ? " has-name" : "");
      tdName.textContent = e.name || "—";
      tdName.title = e.name || "";

      var tdAmt = document.createElement("td");
      tdAmt.setAttribute("data-label", "Số tiền");
      tdAmt.className = "num";
      tdAmt.textContent = formatMoneyVND(e.amount);

      var tdAct = document.createElement("td");
      tdAct.className = "actions";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-danger";
      btn.textContent = "Xóa";
      btn.setAttribute("aria-label", "Xóa khoản chi");
      btn.addEventListener("click", function () {
        removeExpense(e.id);
      });
      tdAct.appendChild(btn);

      tr.appendChild(tdCat);
      tr.appendChild(tdName);
      tr.appendChild(tdAmt);
      tr.appendChild(tdAct);
      elTbody.appendChild(tr);
    });
  }

  function persistAndRender() {
    saveState(state);
    renderSummary();
    renderBreakdown();
    renderTable();
    renderPieChart();
  }

  function removeExpense(id) {
    state.expenses = state.expenses.filter(function (e) {
      return e.id !== id;
    });
    persistAndRender();
  }

  elIncome.value = formatAsTrieuCoefficient(state.income);

  elIncome.addEventListener("blur", function () {
    state.income = parseMoneyToVND(
      elIncome.value,
      getRadioGroupValue("income-unit")
    );
    elIncome.value = formatAsTrieuCoefficient(state.income);
    setIncomeUnitTrieu();
    syncAmountPlaceholder(elIncome, "trieu");
    updateAmountPreview(elIncome, elIncomePreview, "income-unit");
    persistAndRender();
  });

  elIncome.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      elIncome.blur();
    }
  });

  function flushIncomeFromField() {
    var v = parseMoneyToVND(
      elIncome.value,
      getRadioGroupValue("income-unit")
    );
    if (v !== state.income) {
      state.income = v;
      elIncome.value = formatAsTrieuCoefficient(state.income);
      setIncomeUnitTrieu();
      syncAmountPlaceholder(elIncome, "trieu");
      updateAmountPreview(elIncome, elIncomePreview, "income-unit");
      saveState(state);
    }
  }

  window.addEventListener("pagehide", flushIncomeFromField);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushIncomeFromField();
  });

  elForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var amount = parseMoneyToVND(
      elAmount.value,
      getRadioGroupValue("expense-unit")
    );
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
    updateAmountPreview(elAmount, elExpensePreview, "expense-unit");
    persistAndRender();
    elAmount.focus();
  });

  elBtnClear.addEventListener("click", function () {
    if (!state.expenses.length) return;
    if (confirm("Xóa hết các khoản chi trong bảng? Thu nhập tháng giữ nguyên.")) {
      state.expenses = [];
      persistAndRender();
    }
  });

  fillCategorySelect();
  bindUnitSlider(elIncomeUnitSlider, elIncome, elIncomePreview, "income-unit");
  bindUnitSlider(elExpenseUnitSlider, elAmount, elExpensePreview, "expense-unit");
  bindAmountPreview(elIncome, elIncomePreview, "income-unit");
  bindAmountPreview(elAmount, elExpensePreview, "expense-unit");
  persistAndRender();
})();
