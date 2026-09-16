(function () {
  "use strict";

  var DATA = (typeof WELFARE_DATA !== "undefined") ? WELFARE_DATA : { categories: [], items: [] };
  var ITEMS = DATA.items || [];
  var CATEGORIES = DATA.categories || [];

  var TOTAL = ITEMS.length;
  var ALLOW_COUNT = ITEMS.filter(function (i) { return i.allow; }).length;
  var DENY_COUNT = TOTAL - ALLOW_COUNT;

  var POPULAR_TERMS = ["스타벅스", "이마트", "주유소", "헬스장", "노래방", "PC방", "안마", "보험", "택시", "약국"];

  // ---------- Utilities ----------
  function norm(s) {
    return (s || "")
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "")
      .trim();
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // subsequence fuzzy match: every char of query appears in order within target
  function isSubsequence(query, target) {
    var qi = 0;
    for (var ti = 0; ti < target.length && qi < query.length; ti++) {
      if (target[ti] === query[qi]) qi++;
    }
    return qi === query.length;
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    var idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      "<mark>" + escapeHtml(text.slice(idx, idx + query.length)) + "</mark>" +
      escapeHtml(text.slice(idx + query.length))
    );
  }

  // ---------- Scoring / Search ----------
  function scoreItem(item, q, qNorm) {
    var nameNorm = norm(item.name);
    var codeNorm = norm(item.code);
    var catNorm = norm(item.category);
    var kwNormList = (item.keywords || []).map(norm);

    if (codeNorm === qNorm) return 100;
    if (nameNorm === qNorm) return 98;

    var kwExact = kwNormList.indexOf(qNorm) !== -1;
    if (kwExact) return 95;

    if (nameNorm.indexOf(qNorm) === 0) return 88;

    var kwStarts = kwNormList.some(function (k) { return k.indexOf(qNorm) === 0; });
    if (kwStarts) return 82;

    if (nameNorm.indexOf(qNorm) !== -1) return 74;

    var kwIncludes = kwNormList.some(function (k) { return k.indexOf(qNorm) !== -1; });
    if (kwIncludes) return 68;

    if (codeNorm.indexOf(qNorm) !== -1) return 55;

    if (catNorm.indexOf(qNorm) !== -1) return 35;

    if (qNorm.length >= 2 && isSubsequence(qNorm, nameNorm)) return 25;

    var kwFuzzy = kwNormList.some(function (k) { return qNorm.length >= 2 && isSubsequence(qNorm, k); });
    if (kwFuzzy) return 20;

    return 0;
  }

  function search(query) {
    var qNorm = norm(query);
    if (!qNorm) return [];
    var results = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var s = scoreItem(ITEMS[i], query, qNorm);
      if (s > 0) results.push({ item: ITEMS[i], score: s });
    }
    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.allow !== b.item.allow) return a.item.allow ? -1 : 1;
      return a.item.name.localeCompare(b.item.name, "ko");
    });
    return results.map(function (r) { return r.item; });
  }

  // ---------- State ----------
  var state = {
    query: "",
    allow: "all", // "all" | "true" | "false"
    category: "all"
  };

  // ---------- Render: search results ----------
  var resultListEl = document.getElementById("resultList");
  var resultMetaEl = document.getElementById("resultMeta");
  var emptyStateEl = document.getElementById("emptyState");

  function applyFilters(list) {
    return list.filter(function (item) {
      if (state.allow !== "all" && String(item.allow) !== state.allow) return false;
      if (state.category !== "all" && item.category !== state.category) return false;
      return true;
    });
  }

  function statusIconSvg(allow) {
    if (allow) {
      return '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.42 6.29 6.29-6.3 6.3 1.41 1.41 6.3-6.3 6.29 6.3 1.42-1.41-6.3-6.3 6.3-6.29z"/></svg>';
  }

  function renderResultCard(item, query) {
    var allowClass = item.allow ? "allow" : "deny";
    var noteFlag = item.note
      ? '<span class="rc-note-flag" title="' + escapeHtml(item.note) + '">OCR 확인필요</span>'
      : "";
    var kwMatch = "";
    if (query && item.keywords && item.keywords.length) {
      var qn = norm(query);
      var matched = item.keywords.find(function (k) { return norm(k).indexOf(qn) !== -1; });
      if (matched && norm(item.name).indexOf(qn) === -1) {
        kwMatch = '<span class="rc-kw">· "' + escapeHtml(matched) + '" 관련</span>';
      }
    }

    return (
      '<div class="result-card is-' + allowClass + '">' +
        '<div class="rc-status ' + allowClass + '">' +
          statusIconSvg(item.allow) +
          '<span>' + (item.allow ? "허용" : "비허용") + '</span>' +
        '</div>' +
        '<div class="rc-body">' +
          '<div class="rc-top">' +
            '<span class="rc-name">' + highlight(item.name, query) + '</span>' +
            noteFlag +
          '</div>' +
          '<div class="rc-meta">' +
            '<span class="rc-code">' + escapeHtml(item.code) + '</span>' +
            '<span class="rc-cat">' + escapeHtml(item.category) + '</span>' +
            kwMatch +
          '</div>' +
        '</div>' +
        '<div class="rc-badge ' + allowClass + '">' + (item.allow ? "사용 가능" : "사용 불가") + '</div>' +
      '</div>'
    );
  }

  function renderResults() {
    var query = state.query.trim();
    var list;

    if (!query) {
      list = ITEMS.slice();
      list.sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
    } else {
      list = search(query);
    }

    list = applyFilters(list);

    var showList = query ? list : (state.allow !== "all" || state.category !== "all" ? list : []);

    if (!query && state.allow === "all" && state.category === "all") {
      resultMetaEl.innerHTML =
        '전체 <b>' + TOTAL + '</b>개 업종 · <span class="m-allow">허용 ' + ALLOW_COUNT + '</span> · ' +
        '<span class="m-deny">비허용 ' + DENY_COUNT + '</span> · 검색어를 입력하거나 필터를 선택하세요';
      resultListEl.innerHTML = "";
      emptyStateEl.hidden = true;
      return;
    }

    if (showList.length === 0) {
      resultListEl.innerHTML = "";
      resultMetaEl.textContent = "";
      emptyStateEl.hidden = false;
      return;
    }

    emptyStateEl.hidden = true;
    resultMetaEl.innerHTML = '검색결과 <b>' + showList.length + '</b>건';
    resultListEl.innerHTML = showList
      .slice(0, 60)
      .map(function (item) { return renderResultCard(item, query); })
      .join("");
  }

  // ---------- Search input wiring ----------
  var searchInput = document.getElementById("searchInput");
  var clearBtn = document.getElementById("clearBtn");
  var debounceTimer = null;

  searchInput.addEventListener("input", function () {
    state.query = searchInput.value;
    clearBtn.hidden = state.query.length === 0;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderResults, 80);
  });

  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    state.query = "";
    clearBtn.hidden = true;
    searchInput.focus();
    renderResults();
  });

  // ---------- Popular chips ----------
  var chipRow = document.getElementById("suggestChips");
  POPULAR_TERMS.forEach(function (term) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = term;
    btn.addEventListener("click", function () {
      searchInput.value = term;
      state.query = term;
      clearBtn.hidden = false;
      renderResults();
      searchInput.focus();
    });
    chipRow.appendChild(btn);
  });

  // ---------- Allow filter segmented control ----------
  var allowFilterEl = document.getElementById("allowFilter");
  allowFilterEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn");
    if (!btn) return;
    allowFilterEl.querySelectorAll(".seg-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    state.allow = btn.dataset.allow;
    renderResults();
  });

  // ---------- Category filter ----------
  var categoryFilterEl = document.getElementById("categoryFilter");
  CATEGORIES.forEach(function (cat) {
    var opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilterEl.appendChild(opt);
  });
  categoryFilterEl.addEventListener("change", function () {
    state.category = categoryFilterEl.value;
    renderResults();
  });

  // ---------- Browse view (accordion by category) ----------
  var browseListEl = document.getElementById("browseList");

  function renderBrowse() {
    var html = CATEGORIES.map(function (cat, idx) {
      var catItems = ITEMS.filter(function (i) { return i.category === cat; });
      var allowN = catItems.filter(function (i) { return i.allow; }).length;
      var denyN = catItems.length - allowN;
      var itemsHtml = catItems
        .map(function (item) {
          return (
            '<div class="mini-item ' + (item.allow ? "" : "deny") + '">' +
              '<span class="mini-dot"></span>' +
              '<span class="mini-name">' + escapeHtml(item.name) + '</span>' +
              '<span class="mini-code">' + escapeHtml(item.code) + '</span>' +
            '</div>'
          );
        })
        .join("");

      return (
        '<div class="cat-group' + (idx === 0 ? " open" : "") + '">' +
          '<button class="cat-head" type="button">' +
            '<span class="cat-title">' + escapeHtml(cat) + '</span>' +
            '<span class="cat-count">' + catItems.length + '개</span>' +
            '<span class="cat-stats"><span class="s-allow">허용 ' + allowN + '</span>' +
            (denyN > 0 ? '<span class="s-deny">· 비허용 ' + denyN + '</span>' : '') + '</span>' +
            '<svg class="cat-chevron" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>' +
          '</button>' +
          '<div class="cat-body">' + itemsHtml + '</div>' +
        '</div>'
      );
    }).join("");

    browseListEl.innerHTML = html;

    browseListEl.querySelectorAll(".cat-head").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.closest(".cat-group").classList.toggle("open");
      });
    });
  }

  // ---------- View switching ----------
  var navButtons = document.querySelectorAll(".nav-btn");
  var views = {
    search: document.getElementById("view-search"),
    browse: document.getElementById("view-browse"),
    guide: document.getElementById("view-guide")
  };

  navButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      navButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var target = btn.dataset.view;
      Object.keys(views).forEach(function (key) {
        views[key].hidden = key !== target;
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ---------- Theme toggle ----------
  var themeToggle = document.getElementById("themeToggle");
  var root = document.documentElement;

  function applyStoredTheme() {
    var stored = null;
    try { stored = localStorage.getItem("welfare-theme"); } catch (e) {}
    if (stored === "light" || stored === "dark") {
      root.setAttribute("data-theme", stored);
    }
  }

  themeToggle.addEventListener("click", function () {
    var current = root.getAttribute("data-theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = current ? current === "dark" : prefersDark;
    var next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("welfare-theme", next); } catch (e) {}
  });

  // ---------- Init ----------
  applyStoredTheme();
  renderBrowse();
  renderResults();
})();
