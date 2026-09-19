/* ============================================================
 * 掌上猪科 · 应用外壳
 * 负责：状态管理、顶栏与概览、快捷筛选、搜索、列表渲染、个人设置、视图切换
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.ZHUKE_DATA;
  var E = global.ZHUKE.engine;
  var store = global.ZHUKE.store;

  /* ---------------- 全局应用状态 ---------------- */
  var S = {
    now: Date.now(),
    view: 'discover',
    filters: { q: '', cat: '', src: '', quick: '', fit: false },
    list: []
  };

  /* ---------------- DOM 小工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1900);
  }

  /* ---------------- 弹层控制 ---------------- */
  function openSheet(which) {
    var map = { detail: '#sheet', profile: '#profileSheet' };
    var sheet = $(map[which] || '#sheet');
    sheet.hidden = false;
    $('#sheetMask').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeSheets() {
    $('#sheet').hidden = true;
    $('#profileSheet').hidden = true;
    $('#sheetMask').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ---------------- 视图切换 ---------------- */
  function setView(view) {
    S.view = view;
    $$('.tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === view); });
    $('#minePanel').classList.toggle('hidden', view !== 'mine');
    $('#publishPanel').classList.toggle('hidden', view !== 'publish');

    /* 发现页的模块在非发现视图下隐藏，避免重复长列表 */
    var discoverBlocks = ['#dataNotice', '#stats', '.panel[aria-label="筛选"]', '#list'];
    discoverBlocks.forEach(function (sel) {
      var node = $(sel);
      if (node) node.classList.toggle('hidden', view !== 'discover');
    });

    if (view === 'mine' && global.ZHUKE.mine) global.ZHUKE.mine.render();
    if (view === 'publish' && global.ZHUKE.publish) global.ZHUKE.publish.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 顶栏：个人情况 ---------------- */
  var GRADES = E.GRADE_ORDER;
  var LEVELS = ['零基础', '有基础'];
  var HOURS = [2, 4, 6, 8, 10];

  function renderProfileSummary() {
    var p = store.profile();
    $('#profileSummary').textContent = p.grade + ' · ' + p.level + ' · 每周 ' + p.hours + 'h';
  }

  function renderProfileSheet() {
    var p = store.profile();
    var html = '';
    html += '<h2 class="detail-title">设置我的情况</h2>';
    html += '<p class="form-hint" style="margin-bottom:14px">用来筛哪些活动你够条件。只存在你这台设备上，不会传出去。</p>';

    html += '<div class="field-row"><label>我的年级</label><div class="pill-row" id="pickGrade">';
    GRADES.forEach(function (g) {
      html += '<button type="button" class="chip' + (p.grade === g ? ' is-active' : '') + '" data-v="' + g + '">' + g + '</button>';
    });
    html += '</div></div>';

    html += '<div class="field-row"><label>我的基础</label><div class="pill-row" id="pickLevel">';
    LEVELS.forEach(function (l) {
      html += '<button type="button" class="chip' + (p.level === l ? ' is-active' : '') + '" data-v="' + l + '">' + l + '</button>';
    });
    html += '</div></div>';

    html += '<div class="field-row"><label>每周可稳定投入</label><div class="pill-row" id="pickHours">';
    HOURS.forEach(function (h) {
      html += '<button type="button" class="chip' + (Number(p.hours) === h ? ' is-active' : '') + '" data-v="' + h + '">' + h + ' 小时</button>';
    });
    html += '</div></div>';

    html += '<div class="form-actions"><button class="btn primary" id="profileDone" type="button">完成</button>' +
            '<button class="btn ghost" id="profileReset" type="button">清掉这些数据</button></div>';

    $('#profileBody').innerHTML = html;

    function bind(sel, key, cast) {
      var box = $(sel);
      if (!box) return;
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-v]');
        if (!b) return;
        $$('button', box).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var patch = {};
        patch[key] = cast ? cast(b.dataset.v) : b.dataset.v;
        store.setProfile(patch);
        renderProfileSummary();
        render();
        if (global.ZHUKE.detail && global.ZHUKE.detail.isOpen()) global.ZHUKE.detail.refresh();
      });
    }
    bind('#pickGrade', 'grade');
    bind('#pickLevel', 'level');
    bind('#pickHours', 'hours', Number);

    $('#profileDone').addEventListener('click', function () {
      store.setOnboarded();
      closeSheets();
      toast('好，按新情况重新算了一遍');
    });
    $('#profileReset').addEventListener('click', function () {
      if (!window.confirm('收藏、报名记录、你发过的内容、还有这些设置都会删掉，确定吗？')) return;
      store.reset();
      renderProfileSummary();
      render();
      if (global.ZHUKE.mine) global.ZHUKE.mine.render();
      toast('都清掉了');
    });
  }

  /* ---------------- 概览卡 ---------------- */
  function renderStats() {
    var s = E.statsOf(DATA.items, S.now);
    var cards = [
      { k: 'is-live', n: s.live, t: '正在进行' },
      { k: 'is-today', n: s.today, t: '今天开始' },
      { k: 'is-soon', n: s.soon, t: '即将截止' },
      { k: 'is-risk', n: s.risk, t: '需留意' }
    ];
    $('#stats').innerHTML = cards.map(function (c) {
      return '<div class="stat ' + c.k + '"><b>' + c.n + '</b><span>' + c.t + '</span></div>';
    }).join('');
  }

  /* ---------------- 快捷筛选 ---------------- */
  var QUICKS = [
    { k: '', t: '全部' },
    { k: 'today', t: '今天能做' },
    { k: 'soon', t: '即将截止' },
    { k: 'week', t: '七天内' },
    { k: 'zero', t: '零基础友好' },
    { k: 'newbie', t: '新生可参加' },
    { k: 'trust', t: '信息较可靠' },
    { k: 'stock', t: '学生自发' }
  ];

  function renderQuick() {
    $('#quickbar').innerHTML = QUICKS.map(function (q) {
      var n = q.k ? E.filter(DATA.items, { quick: q.k }, S.now).length : DATA.items.length;
      return '<button type="button" class="chip' + (S.filters.quick === q.k ? ' is-active' : '') +
        '" data-q="' + q.k + '">' + q.t + '<span class="chip-n">' + n + '</span></button>';
    }).join('');
  }

  function renderSelects() {
    var cat = $('#cat'), src = $('#src');
    if (!cat.dataset.ready) {
      var catHtml = '<option value="">全部分类</option>';
      Object.keys(DATA.categories).forEach(function (k) {
        catHtml += '<option value="' + k + '">' + esc(DATA.categories[k]) + '</option>';
      });
      cat.innerHTML = catHtml;
      var srcHtml = '<option value="">全部来源</option>';
      Object.keys(DATA.sources).forEach(function (k) {
        srcHtml += '<option value="' + k + '">' + esc(DATA.sources[k].label) + '</option>';
      });
      src.innerHTML = srcHtml;
      cat.dataset.ready = '1';
    }
    cat.value = S.filters.cat;
    src.value = S.filters.src;
  }

  /* ---------------- 列表渲染 ---------------- */
  function trustBarHtml(t) {
    var cls = t.level === 'high' ? '' : ('lv-' + t.level);
    return '<div class="trust">' +
      '<span>信息可信度 <b>' + t.score + '</b>/100 · ' + t.label + '</span>' +
      '<span class="trust-bar"><i class="' + cls + '" style="width:' + t.score + '%"></i></span>' +
      '</div>';
  }

  function cardHtml(it) {
    var st = it.status, sc = it.trust, src = it.sourceInfo;
    var fav = store.isFavorite(it.id);
    var cls = 'card';
    if (it.risk && it.risk.level === 'high') cls += ' is-risk-high';
    else if (it.risk && it.risk.level === 'medium') cls += ' is-risk-medium';
    if (it.isUpdate) cls += ' is-update';

    var badges = '<span class="badge t-' + st.tone + '">' + esc(st.label) + '</span>';
    if (it.isUpdate) badges += '<span class="badge update">变更通知</span>';
    badges += '<span class="badge src lv' + src.level + '">' + esc(src.label) + '</span>';
    badges += '<span class="badge t-muted">' + esc(it.categoryLabel) + '</span>';
    if (it.risk) badges += '<span class="badge risk">' + esc(it.risk.type) + '</span>';
    if (it.eligibility && it.eligibility.ok === 'no') badges += '<span class="badge warn">你不符合</span>';

    var tags = (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');

    return '<article class="' + cls + '" data-id="' + it.id + '" tabindex="0" role="button" aria-label="' + esc(it.title) + '">' +
      '<div class="card-top">' +
        '<span class="card-no">' + it.id + '</span>' +
        '<h3 class="card-title">' + esc(it.title) + '</h3>' +
        '<button class="card-fav' + (fav ? ' is-on' : '') + '" data-fav="' + it.id + '" title="收藏" aria-label="收藏">' +
          (fav ? '★' : '☆') + '</button>' +
      '</div>' +
      '<div class="card-meta">' + badges + '</div>' +
      '<div class="card-time"><b>' + esc(st.label) + '</b><span>' + esc(st.detail || '') + '</span></div>' +
      '<div class="card-summary">' + esc(it.raw) + '</div>' +
      (tags ? '<div class="card-tags">' + tags + '</div>' : '') +
      trustBarHtml(sc) +
    '</article>';
  }

  function render() {
    var profile = store.profile();
    var filtered = E.filter(DATA.items, {
      q: S.filters.q, cat: S.filters.cat, src: S.filters.src,
      quick: S.filters.quick, fit: S.filters.fit, profile: profile
    }, S.now);
    var decorated = E.sort(filtered, S.now).map(function (i) {
      return E.decorate(i, S.now, profile, DATA.items);
    });
    S.list = decorated;

    $('#resultCount').textContent = '共 ' + decorated.length + ' 条';
    $('#list').innerHTML = decorated.length
      ? decorated.map(cardHtml).join('')
      : '<div class="empty"><span>🫥</span>没有符合条件的，换个条件或者清掉搜索词试试。</div>';

    var mineCount = store.favorites().length + store.joinedList().length + store.myPosts().length;
    $('#mineDot').classList.toggle('is-on', mineCount > 0);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    $('#quickbar').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-q]');
      if (!b) return;
      S.filters.quick = b.dataset.q;
      renderQuick();
      render();
    });

    $('#q').addEventListener('input', function (ev) {
      S.filters.q = ev.target.value;
      render();
    });

    $('#cat').addEventListener('change', function (ev) { S.filters.cat = ev.target.value; render(); });
    $('#src').addEventListener('change', function (ev) { S.filters.src = ev.target.value; render(); });

    $('#fitOnly').addEventListener('change', function (ev) {
      S.filters.fit = ev.target.checked;
      render();
    });

    $('#resetFilter').addEventListener('click', function () {
      S.filters = { q: '', cat: '', src: '', quick: '', fit: false };
      $('#q').value = '';
      $('#fitOnly').checked = false;
      renderSelects();
      renderQuick();
      render();
      toast('筛选清空了');
    });

    $('#list').addEventListener('click', function (ev) {
      var favBtn = ev.target.closest('[data-fav]');
      if (favBtn) {
        ev.stopPropagation();
        var on = store.toggleFavorite(favBtn.dataset.fav);
        toast(on ? '已收藏' : '已取消收藏');
        render();
        if (global.ZHUKE.mine) global.ZHUKE.mine.render();
        return;
      }
      var card = ev.target.closest('.card');
      if (card && global.ZHUKE.detail) global.ZHUKE.detail.open(card.dataset.id);
    });

    $('#list').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var card = ev.target.closest('.card');
      if (card && global.ZHUKE.detail) {
        ev.preventDefault();
        global.ZHUKE.detail.open(card.dataset.id);
      }
    });

    $('#tabbar').addEventListener('click', function (ev) {
      var b = ev.target.closest('.tab');
      if (b) setView(b.dataset.view);
    });

    $('#profileBtn').addEventListener('click', function () {
      renderProfileSheet();
      openSheet('profile');
    });
    $('#profileClose').addEventListener('click', closeSheets);
    $('#sheetClose').addEventListener('click', closeSheets);
    $('#sheetMask').addEventListener('click', closeSheets);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeSheets();
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!DATA || !E || !store) {
      document.body.innerHTML = '<p style="padding:24px">数据或引擎加载失败，请刷新页面。</p>';
      return;
    }
    var d = new Date(S.now);
    $('#nowLabel').textContent = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    renderProfileSummary();
    renderStats();
    renderSelects();
    renderQuick();
    render();
    bindEvents();

    /* 首次访问提示设置个人情况（影响资格判断） */
    if (!store.isOnboarded()) {
      setTimeout(function () {
        renderProfileSheet();
        openSheet('profile');
      }, 600);
    }

    if (global.ZHUKE.mine) global.ZHUKE.mine.init();
    if (global.ZHUKE.publish) global.ZHUKE.publish.init();

    if (global.console) {
      console.log('%c掌上猪科 已启动', 'color:#ff6b4a;font-weight:700',
        '｜数据 ' + DATA.items.length + ' 条｜当前时间 ' + d.toLocaleString('zh-CN'));
    }
  }

  global.ZHUKE = global.ZHUKE || {};
  global.ZHUKE.ui = {
    $: $, $$: $$, esc: esc, toast: toast,
    openSheet: openSheet, closeSheets: closeSheets,
    trustBarHtml: trustBarHtml, cardHtml: cardHtml,
    state: S, setView: setView
  };
  global.ZHUKE.render = render;
  global.ZHUKE.boot = boot;
})(window);
