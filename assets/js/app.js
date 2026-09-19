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
    list: [],
    page: 1,            /* 列表当前页码（从 1 开始） */
    lastFilterKey: ''   /* 筛选条件指纹：变化时页码归位到第 1 页 */
  };

  /** 列表每页条数 */
  var PAGE_SIZE = 8;

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

    /* 发现页的模块在非发现视图下隐藏，避免重复长列表；分页栏只服务于发现页列表 */
    var discoverBlocks = ['#dataNotice', '#stats', '.panel[aria-label="筛选"]', '#list', '#pager'];
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

  /* ---------------- 实名认证 / 账号开通 ---------------- */
  var verifyMode = null;   /* null = 已登录账号实名；{ studentId, password } = 未登录时核验开通账号 */

  function openVerify() {
    verifyMode = null;
    renderVerifySheet();
    openSheet('verify');
  }

  /** 尚未开通账号：带上登录页填写的学号与密码，核验通过后直接开通并登录 */
  function openVerifyForSignup(studentId, password) {
    verifyMode = { studentId: studentId, password: password };
    renderVerifySheet();
    openSheet('verify');
  }

  function renderVerifySheet() {
    var body = $('#verifyBody');
    if (!body) return;

    var signup = verifyMode;          /* 开通模式 */
    var acc = A.current();

    if (!signup && !acc) return;
    if (!signup && A.isVerified()) {
      body.innerHTML = '<h2 class="detail-title">实名认证</h2>' +
        '<div class="callout info" style="margin-top:12px">该账号已完成实名认证：' +
        esc(acc.realName) + ' · 学号 ' + esc(acc.studentId) + '</div>';
      return;
    }

    var targetId = signup ? signup.studentId : (acc.studentId || '');
    var actLabel = signup ? '核验并开通账号' : '获取实名信息并绑定';
    var backLabel = signup ? '暂不开通' : '暂不认证';

    var html = '';
    html += '<h2 class="detail-title">' + (signup ? '核验身份并开通账号' : '实名认证') + '</h2>';
    html += '<p class="form-hint" style="margin-bottom:12px">' +
      (signup
        ? '将使用该学号向「我的珠科」发起身份核验，核验通过后自动开通账号并登录，无需另外注册。'
        : '当前账号已通过学号登录。点击下方按钮向「我的珠科」发起身份核验，系统将自动获取姓名并完成绑定，无需手动填写。') +
      '</p>';

    html += '<div class="callout info" style="margin-bottom:14px">' +
      '<b>关于本功能：</b>' + (signup ? '账号开通' : '实名认证') +
      '需调用学校统一身份认证服务（我的珠科APP），由服务端核验身份并返回实名信息。' +
      '<br><span style="opacity:.85">当前版本尚未接入该服务，点击后由本地模拟返回结果，用于演示' +
      (signup ? '开通' : '认证') + '流程；接入后姓名与学号均以服务端返回为准。</span></div>';

    html += '<div class="kv"><dt>核验学号</dt><dd>' + esc(targetId || '未提供') + '</dd></div>';
    html += '<div class="kv"><dt>获取内容</dt><dd>真实姓名、学号</dd></div>';

    html += '<p class="login-err" id="vfErr" hidden></p>';
    html += '<div class="form-actions" style="margin-top:14px">' +
      '<button class="btn primary" id="vfSubmit" type="button">' + actLabel + '</button>' +
      '<button class="btn ghost" id="vfCancel" type="button">' + backLabel + '</button></div>';
    html += '<p class="agree-note">点击「' + actLabel + '」即表示你同意平台通过学校统一身份认证服务' +
      '获取并使用你的姓名、学号信息，用于身份核验与内容归属标识。</p>';

    body.innerHTML = html;

    var btn = $('#vfSubmit');
    var err = $('#vfErr');

    function fail(errors) {
      btn.disabled = false;
      btn.textContent = actLabel;
      err.innerHTML = errors.map(function (e) { return '· ' + esc(e); }).join('<br>');
      err.hidden = false;
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = '正在核验身份…';
      err.hidden = true;

      /* 模拟一次网络往返；接入真实服务后此处改为请求统一身份认证接口 */
      setTimeout(function () {
        var auth = A.fetchIdentity(targetId);
        if (!auth.ok) { fail(auth.errors); return; }

        /* 开通模式：核验通过即创建账号并直接登录 */
        if (signup) {
          var reg = A.registerBySSO({
            studentId: auth.data.studentId,
            password: signup.password,
            name: auth.data.name
          });
          if (!reg.ok) { fail([reg.message]); return; }
          verifyMode = null;
          closeSheets();
          hideLogin();
          startApp();
          toast('账号已开通，欢迎你，' + reg.account.realName);
          return;
        }

        /* 认证模式：把服务端返回的实名信息写入当前账号 */
        var res = A.verify({ realName: auth.data.name, studentId: auth.data.studentId });
        if (!res.ok) { fail(res.errors); return; }

        closeSheets();
        renderUserChip();
        startApp();
        if (global.ZHUKE.mine) global.ZHUKE.mine.render();
        if (global.ZHUKE.admin) global.ZHUKE.admin.render();
        toast('已获取实名信息：' + auth.data.name);
      }, 520);
    });

    $('#vfCancel').addEventListener('click', closeSheets);
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
    toast('欢迎回来，' + (res.account.realName || '同学'));
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

    /* 尚未开通账号：用登录页填写的学号发起核验，通过后自动开通并登录。
       演示环境不校验密码，只要求填写学号即可进入核验。 */
    $('#loginSignup').addEventListener('click', function () {
      var err = $('#loginErr');
      var sid = $('#loginUser').value.trim();

      if (!sid) {
        err.textContent = '请先填写学号，再发起身份核验';
        err.hidden = false;
        $('#loginUser').focus();
        return;
      }
      err.textContent = '';
      err.hidden = true;
      openVerifyForSignup(sid, $('#loginPass').value);
    });

    $$('#loginView .demo-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var map = {
          admin: { u: '00000000', p: 'admin123' },
          student: { u: '20260101', p: '123456' },
          newbie: { u: '20260315', p: '123456' }
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

    /* 只有需要一眼看到的状态与例外标记保留为徽章 */
    var flags = '<span class="badge t-' + st.tone + '">' + esc(st.label) + '</span>';
    if (it.isUpdate) flags += '<span class="badge update">变更通知</span>';
    if (it.risk) flags += '<span class="badge risk">' + esc(it.risk.type) + '</span>';
    if (it.eligibility && it.eligibility.ok === 'no') flags += '<span class="badge warn">不符合条件</span>';

    /* 来源、分类、可信度收进一行小字，不再各占一个徽章 */
    var meta = '<span class="meta-src lv' + src.level + '">' + esc(src.label) + '</span>' +
      '<i class="meta-sep">·</i><span>' + esc(it.categoryLabel) + '</span>' +
      '<i class="meta-sep">·</i><span class="meta-trust lv-' + sc.level + '">可信度 ' + sc.score + '</span>';

    /* 标签只留最相关的两个：实名信息优先，其次材料自带标签 */
    var tagTexts = (it.tags || []).slice();
    if (it.authorLabel) tagTexts.unshift('实名：' + it.authorLabel);
    var tags = tagTexts.slice(0, 2).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');

    /* 详情页保留完整句；卡片上徽章已给出状态，剥掉重复的状态前缀 */
    var when = st.detail || '';
    if (when.indexOf(st.label) === 0) {
      when = when.slice(st.label.length).replace(/^[，,、·\s]+/, '');
    }

    var label = esc(it.title) + '，' + esc(st.label) + (when ? ('，' + esc(when)) : '');

    return '<article class="' + cls + '" data-id="' + it.id + '" tabindex="0" role="button" aria-label="' + label + '">' +
      '<div class="card-top">' +
        '<span class="card-no">' + it.id + '</span>' +
        '<h3 class="card-title">' + esc(it.title) + '</h3>' +
        '<button class="card-fav' + (fav ? ' is-on' : '') + '" data-fav="' + it.id + '" title="收藏" aria-label="收藏">' +
          (fav ? '★' : '☆') + '</button>' +
      '</div>' +
      '<div class="card-when">' + flags + '<span class="when-text">' + esc(when) + '</span></div>' +
      '<div class="card-summary">' + esc(it.raw) + '</div>' +
      '<div class="card-foot">' + meta + (tags ? '<span class="card-tags">' + tags + '</span>' : '') + '</div>' +
    '</article>';
  }

  function filterKey() {
    return [S.filters.q, S.filters.cat, S.filters.src, S.filters.quick, S.filters.fit ? 1 : 0].join('\u0001');
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

    /* 筛选条件变化时页码归位；结果变少时收敛到最后一页 */
    var key = filterKey();
    if (key !== S.lastFilterKey) { S.page = 1; S.lastFilterKey = key; }
    var pages = Math.max(1, Math.ceil(decorated.length / PAGE_SIZE));
    if (S.page > pages) S.page = pages;
    if (S.page < 1) S.page = 1;

    var start = (S.page - 1) * PAGE_SIZE;
    var pageItems = decorated.slice(start, start + PAGE_SIZE);

    $('#resultCount').textContent = '共 ' + decorated.length + ' 条';
    $('#list').innerHTML = pageItems.length
      ? pageItems.map(cardHtml).join('')
      : '<div class="empty"><span>🫥</span>没有符合条件的信息，请调整筛选条件或搜索关键词。</div>';

    renderPager(decorated.length, pages, pageItems.length);

    var mineCount = store.favorites().length + store.joinedList().length + store.myPosts().length;
    $('#mineDot').classList.toggle('is-on', mineCount > 0);
  }

  /** 分页栏：结果多于一页时出现 */
  function renderPager(total, pages, shown) {
    var pager = $('#pager');
    if (!pager) return;
    if (total <= PAGE_SIZE) { pager.hidden = true; pager.innerHTML = ''; return; }
    pager.hidden = false;
    pager.innerHTML =
      '<button class="page-btn" data-page="prev" type="button"' + (S.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
      '<span class="page-info">第 ' + S.page + ' / ' + pages + ' 页 · 本页 ' + shown + ' 条</span>' +
      '<button class="page-btn" data-page="next" type="button"' + (S.page >= pages ? ' disabled' : '') + '>下一页</button>';
  }

  /** 翻页：重绘后把列表顶部对齐到视口上方 */
  function goPage(n) {
    var pages = Math.max(1, Math.ceil(S.list.length / PAGE_SIZE));
    var target = Math.min(Math.max(n, 1), pages);
    if (target === S.page) return;
    S.page = target;
    render();
    var list = $('#list');
    if (list) {
      var top = list.getBoundingClientRect().top + window.scrollY - 66;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    $('#pager').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-page]');
      if (!b || b.disabled) return;
      goPage(b.dataset.page === 'next' ? S.page + 1 : S.page - 1);
    });

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
    startApp: startApp,
    /** 回到列表第 1 页（新增内容后调用） */
    setPage: function (n) { S.page = n || 1; }
  };
  global.ZHUKE.render = render;
  global.ZHUKE.boot = boot;
})(window);
