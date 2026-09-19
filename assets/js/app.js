/* ============================================================
 * 掌上猪科 · 应用外壳
 * 负责：状态管理、顶栏与概览、快捷筛选、搜索、列表渲染、个人设置、视图切换
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.ZHUKE_DATA;
  var E = global.ZHUKE.engine;
  var store = global.ZHUKE.store;
  var A = global.ZHUKE.account;

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
  var closeTimer = null;

  function openSheet(which) {
    var map = { detail: '#sheet', profile: '#profileSheet', account: '#accountSheet', verify: '#verifySheet' };
    var sheet = $(map[which] || '#sheet');
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    ['#sheet', '#profileSheet', '#accountSheet', '#verifySheet'].forEach(function (sel) {
      var el = $(sel);
      el.classList.remove('is-closing');
      if (el !== sheet) el.hidden = true;
    });
    sheet.hidden = false;
    $('#sheetMask').hidden = false;
    document.body.classList.add('no-scroll');
  }

  /** 关闭弹层：先播放收起动画，再真正移除；遮罩与滚动锁同步复位 */
  function closeSheets() {
    var open = ['#sheet', '#profileSheet', '#accountSheet', '#verifySheet'].map(function (sel) { return $(sel); })
      .filter(function (el) { return el && !el.hidden; });
    $('#sheetMask').hidden = true;
    document.body.classList.remove('no-scroll');
    if (!open.length) return;

    open.forEach(function (el) { el.classList.add('is-closing'); });
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      open.forEach(function (el) {
        el.hidden = true;
        el.classList.remove('is-closing');
      });
      closeTimer = null;
    }, 170);
  }

  /* ---------------- 视图切换 ---------------- */
  function setView(view) {
    S.view = view;
    $$('.tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === view); });
    $('#minePanel').classList.toggle('hidden', view !== 'mine');
    $('#publishPanel').classList.toggle('hidden', view !== 'publish');
    $('#adminPanel').classList.toggle('hidden', view !== 'admin');

    /* 发现页的模块在非发现视图下隐藏，避免重复长列表 */
    var discoverBlocks = ['#dataNotice', '#stats', '.panel[aria-label="筛选"]', '#list'];
    discoverBlocks.forEach(function (sel) {
      var node = $(sel);
      if (node) node.classList.toggle('hidden', view !== 'discover');
    });

    if (view === 'mine' && global.ZHUKE.mine) global.ZHUKE.mine.render();
    if (view === 'publish' && global.ZHUKE.publish) global.ZHUKE.publish.render();
    if (view === 'admin' && global.ZHUKE.admin) global.ZHUKE.admin.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 顶栏：账号 ---------------- */
  var GRADES = E.GRADE_ORDER;
  var LEVELS = ['零基础', '有基础'];
  var HOURS = [2, 4, 6, 8, 10];

  /** 顶栏右侧显示当前账号：已实名显示姓名与学号，未实名显示待认证 */
  function renderUserChip() {
    var acc = A.current();
    var el = $('#userLabel');
    if (!el) return;
    if (!acc) { el.textContent = '未登录'; return; }
    if (!A.isVerified()) { el.textContent = '未实名 · 待认证'; return; }
    el.textContent = acc.role === 'admin'
      ? (acc.realName + ' · 管理员')
      : (acc.realName + ' · ' + A.maskStudentId(acc.studentId));
  }

  /** 账号弹层：身份信息、实名状态、去后台、退出登录 */
  function renderAccountSheet() {
    var acc = A.current();
    var body = $('#accountBody');
    if (!acc) return;
    var role = A.ROLES[acc.role] || A.ROLES.student;
    var status = A.STATUS[acc.status] || A.STATUS.active;
    var verify = A.verifyStatusOf(acc);
    var verified = A.isVerified();
    var myPosts = A.postsOf(acc.id).length;
    var p = store.profile();

    var html = '';
    html += '<h2 class="detail-title">我的账号</h2>';
    html += '<div class="detail-badges">' +
      '<span class="badge src lv' + (acc.role === 'admin' ? 3 : 1) + '">' + esc(role.label) + '</span>' +
      '<span class="badge t-' + status.tone + '">' + esc(status.label) + '</span>' +
      '<span class="badge t-' + verify.tone + '">' + esc(verify.label) + '</span>' +
      '</div>';

    html += '<dl style="margin:12px 0 0">' +
      kvRow('姓名', verified ? (acc.realName + '（已实名）') : '未实名') +
      kvRow('学号', verified ? acc.studentId : (acc.studentId ? A.maskStudentId(acc.studentId) + '（待认证）' : '未绑定')) +
      kvRow('用户名', acc.username) +
      kvRow('实名状态', verify.label) +
      kvRow('我发布的', myPosts + ' 条') +
      kvRow('我的情况', p.grade + ' · ' + p.level + ' · 每周 ' + p.hours + ' 小时') +
      '</dl>';

    if (verified) {
      html += '<div class="callout info" style="margin-top:12px">账号已完成实名认证，' +
        '发布的内容会显示发布者实名信息，便于同学判断信息来源。</div>';
    } else {
      html += '<div class="callout warn" style="margin-top:12px">' +
        '<b>该账号尚未完成实名认证。</b>未实名账号不能发布活动，也不能报名或登记参加活动。' +
        '请先提交真实姓名与学号完成认证。</div>';
    }

    if (acc.status === 'banned') {
      html += '<div class="callout danger" style="margin-top:10px">该账号已被封禁：' +
        esc(acc.banReason || '违反平台规范') + '</div>';
    }

    html += '<div class="actions">' +
      (verified ? '' : '<button class="btn primary" id="acctVerify" type="button">去实名认证</button>') +
      '<button class="btn ghost" id="acctProfile" type="button">修改我的情况</button>' +
      (acc.role === 'admin' ? '<button class="btn primary" id="acctAdmin" type="button">进入后台</button>' : '') +
      '<button class="btn" id="acctLogout" type="button">退出登录</button>' +
      '</div>';

    body.innerHTML = html;

    var verifyBtn = $('#acctVerify');
    if (verifyBtn) verifyBtn.addEventListener('click', openVerify);
    $('#acctProfile').addEventListener('click', function () {
      renderProfileSheet();
      openSheet('profile');
    });
    var adminBtn = $('#acctAdmin');
    if (adminBtn) {
      adminBtn.addEventListener('click', function () {
        closeSheets();
        setView('admin');
      });
    }
    $('#acctLogout').addEventListener('click', function () {
      A.logout();
      closeSheets();
      renderUserChip();
      showLogin();
      toast('已退出登录');
    });
  }

  /* ---------------- 实名认证 ---------------- */
  /** 未实名账号的实名认证页：提交真实姓名与学号 */
  function renderVerifySheet() {
    var acc = A.current();
    var body = $('#verifyBody');
    if (!acc) return;

    if (A.isVerified()) {
      body.innerHTML = '<h2 class="detail-title">实名认证</h2>' +
        '<div class="callout info" style="margin-top:12px">该账号已完成实名认证：' +
        esc(acc.realName) + ' · 学号 ' + esc(acc.studentId) + '</div>';
      return;
    }

    var html = '';
    html += '<h2 class="detail-title">实名认证</h2>';
    html += '<p class="form-hint" style="margin-bottom:14px">' +
      '完成实名认证后才能发布活动、报名或登记参加活动。认证信息仅用于平台身份核对，学号一人一号。</p>';

    html += '<div class="callout warn" style="margin-bottom:14px">' +
      '请填写与学籍一致的姓名和学号。提交虚假信息将导致账号被封禁，并按平台规范处理。</div>';

    html += '<div class="field-row"><label for="vfName">真实姓名 *</label>' +
      '<input id="vfName" type="text" maxlength="10" placeholder="2—10 位中文姓名"></div>';
    html += '<div class="field-row"><label for="vfSid">学号 *</label>' +
      '<input id="vfSid" type="text" maxlength="14" value="' + esc(acc.studentId || '') + '" placeholder="6—14 位数字"></div>';
    html += '<p class="login-err" id="vfErr" hidden></p>';
    html += '<div class="form-actions">' +
      '<button class="btn primary" id="vfSubmit" type="button">提交认证</button>' +
      '<button class="btn ghost" id="vfCancel" type="button">暂不认证</button></div>';

    body.innerHTML = html;

    $('#vfSubmit').addEventListener('click', function () {
      var err = $('#vfErr');
      var res = A.verify({
        realName: $('#vfName').value,
        studentId: $('#vfSid').value
      });
      if (!res.ok) {
        err.innerHTML = res.errors.map(function (e) { return '· ' + esc(e); }).join('<br>');
        err.hidden = false;
        return;
      }
      err.hidden = true;
      closeSheets();
      renderUserChip();
      startApp();
      if (global.ZHUKE.mine) global.ZHUKE.mine.render();
      if (global.ZHUKE.admin) global.ZHUKE.admin.render();
      toast('实名认证完成，现在可以发布和参加活动了');
    });
    $('#vfCancel').addEventListener('click', closeSheets);
  }

  function openVerify() {
    renderVerifySheet();
    openSheet('verify');
  }

  function kvRow(label, value) {
    return '<div class="kv"><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  /* ---------------- 登录门禁 ---------------- */
  function showLogin() {
    document.body.classList.add('login-mode');
    var lv = $('#loginView');
    lv.hidden = false;
    $('#loginErr').hidden = true;
    var u = $('#loginUser');
    if (u) u.focus();
  }

  function hideLogin() {
    document.body.classList.remove('login-mode');
    $('#loginView').hidden = true;
  }

  function doLogin(username, password) {
    var res = A.login(username, password);
    var err = $('#loginErr');
    if (!res.ok) {
      err.textContent = res.message;
      err.hidden = false;
      return false;
    }
    err.hidden = true;
    $('#loginPass').value = '';
    hideLogin();
    startApp();
    toast('欢迎回来，' + res.account.realName);
    return true;
  }

  /** 登录后初始化应用（含管理员入口） */
  function startApp() {
    renderUserChip();
    renderStats();
    renderSelects();
    renderQuick();
    render();
    var isAdmin = A.isAdmin();
    $('#tabAdmin').classList.toggle('hidden', !isAdmin);
    if (S.view === 'admin' && !isAdmin) setView('discover');
    if (global.ZHUKE.mine) global.ZHUKE.mine.render();
    if (global.ZHUKE.publish) global.ZHUKE.publish.render();
    if (global.ZHUKE.admin && isAdmin) global.ZHUKE.admin.render();
  }

  function bindLogin() {
    $('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      doLogin($('#loginUser').value, $('#loginPass').value);
    });

    $$('#loginView .demo-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var map = {
          admin: { u: 'admin', p: 'admin123' },
          student: { u: 'zhuke', p: '123456' },
          newbie: { u: 'newbie', p: '123456' }
        };
        var pick = map[btn.dataset.fill] || map.student;
        $('#loginUser').value = pick.u;
        $('#loginPass').value = pick.p;
        $('#loginErr').hidden = true;
        $('#loginSubmit').focus();
      });
    });
  }

  function renderProfileSheet() {
    var p = store.profile();
    var html = '';
    html += '<h2 class="detail-title">设置我的情况</h2>';
    html += '<p class="form-hint" style="margin-bottom:14px">用于「只看我能参加的」资格筛选。</p>';

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
        renderUserChip();
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
      toast('已按最新情况重新判断资格');
    });
    $('#profileReset').addEventListener('click', function () {
      if (!window.confirm('将清空本机收藏、报名记录、发布内容与个人设置，是否继续？')) return;
      store.reset();
      renderUserChip();
      render();
      if (global.ZHUKE.mine) global.ZHUKE.mine.render();
      toast('数据已清空');
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
    if (it.authorLabel) tags += '<span class="tag">实名：' + esc(it.authorLabel) + '</span>';

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
      : '<div class="empty"><span>🫥</span>没有符合条件的信息，请调整筛选条件或搜索关键词。</div>';

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
      toast('筛选条件已重置');
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
      renderAccountSheet();
      openSheet('account');
    });
    $('#profileClose').addEventListener('click', closeSheets);
    $('#accountClose').addEventListener('click', closeSheets);
    $('#verifyClose').addEventListener('click', closeSheets);
    $('#sheetClose').addEventListener('click', closeSheets);
    $('#sheetMask').addEventListener('click', closeSheets);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeSheets();
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!DATA || !E || !store || !A) {
      document.body.innerHTML = '<p style="padding:24px">数据或引擎加载失败，请刷新页面。</p>';
      return;
    }
    var d = new Date(S.now);
    $('#nowLabel').textContent = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    A.ensureSeed();
    bindEvents();
    bindLogin();

    if (global.ZHUKE.mine) global.ZHUKE.mine.init();
    if (global.ZHUKE.publish) global.ZHUKE.publish.init();

    /* 未登录先走登录页；登录成功后再初始化应用主体 */
    if (!A.current()) {
      showLogin();
    } else {
      hideLogin();
      startApp();
      maybeOnboard();
    }

    if (global.console) {
      var cur = A.current();
      console.log('%c掌上猪科 已启动', 'color:#ff6b4a;font-weight:700',
        '｜数据 ' + DATA.items.length + ' 条｜当前时间 ' + d.toLocaleString('zh-CN') +
        '｜登录账号 ' + (cur ? cur.username + '(' + cur.role + ')' : '未登录'));
    }
  }

  /** 首次使用引导设置「我的情况」，用于资格判断 */
  function maybeOnboard() {
    if (store.isOnboarded()) return;
    setTimeout(function () {
      renderProfileSheet();
      openSheet('profile');
    }, 600);
  }

  global.ZHUKE = global.ZHUKE || {};
  global.ZHUKE.ui = {
    $: $, $$: $$, esc: esc, toast: toast,
    openSheet: openSheet, closeSheets: closeSheets,
    trustBarHtml: trustBarHtml, cardHtml: cardHtml,
    state: S, setView: setView,
    openProfile: function () { renderProfileSheet(); openSheet('profile'); },
    openVerify: openVerify,
    renderUserChip: renderUserChip,
    startApp: startApp
  };
  global.ZHUKE.render = render;
  global.ZHUKE.boot = boot;
})(window);
