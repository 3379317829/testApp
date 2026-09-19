/* ============================================================
 * 掌上猪科 · 我的
 * 对应题目要求 6：重要操作结果在刷新/重开后保留（收藏、报名、我的发布全部走 localStorage）
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.ZHUKE_DATA;
  var E = global.ZHUKE.engine;
  var store = global.ZHUKE.store;
  var ui = global.ZHUKE.ui;

  var tab = 'fav';

  function byId(id) {
    return DATA.items.filter(function (i) { return i.id === id; })[0] || null;
  }

  function countdownHtml() {
    var now = Date.now();
    var soon = store.favorites()
      .map(byId).filter(Boolean)
      .map(function (i) { return { i: i, st: E.statusOf(i, now) }; })
      .filter(function (x) { return x.st.nextAt && x.st.nextAt - now <= 3 * 86400000 && x.st.nextAt > now; })
      .sort(function (a, b) { return a.st.nextAt - b.st.nextAt; });

    if (!soon.length) return '';
    return '<div class="callout warn" style="margin-bottom:12px"><b>⏰ 收藏的活动即将截止：</b><br>' +
      soon.map(function (x) {
        return '· ' + ui.esc(x.i.title) + ' —— ' + ui.esc(x.st.detail || '');
      }).join('<br>') + '</div>';
  }

  function miniHtml(id, title, sub, opts) {
    opts = opts || {};
    return '<div class="mini">' +
      (id ? '<span class="card-no">' + ui.esc(id) + '</span>' : '') +
      '<div class="mini-main" ' + (opts.goto ? 'data-goto="' + ui.esc(opts.goto) + '" style="cursor:pointer"' : '') + '>' +
        '<div class="mini-title">' + ui.esc(title) + '</div>' +
        '<div class="mini-sub">' + ui.esc(sub) + '</div>' +
      '</div>' +
      (opts.del ? '<button class="mini-del" data-del="' + ui.esc(opts.del) + '" title="移除">✕</button>' : '') +
      '</div>';
  }

  function favList() {
    var ids = store.favorites();
    if (!ids.length) return '<div class="empty"><span>⭐</span>暂无收藏记录。可在发现页点击卡片右上角的 ☆ 进行收藏。</div>';
    return '<div class="mini-list">' + ids.map(function (id) {
      var it = byId(id);
      if (!it) return '';
      var st = E.statusOf(it, Date.now());
      return miniHtml(id, it.title, st.label + '｜' + (st.detail || ''), { goto: id, del: id });
    }).join('') + '</div>';
  }

  function joinList() {
    var rows = store.joinedList();
    if (!rows.length) return '<div class="empty"><span>📝</span>暂无报名记录。可在活动详情页点击「报名 / 登记意向」。</div>';
    return '<div class="mini-list">' + rows.map(function (r) {
      var it = byId(r.id);
      var title = it ? it.title : r.id;
      var sub = it ? (E.statusOf(it, Date.now()).detail || '') : '已记录';
      var tag = (it && it.signup && it.signup.unsure) ? '还要等对方确认' : '记下了';
      return miniHtml(it ? it.id : '', title, tag + '｜' + sub, { goto: it ? it.id : '' });
    }).join('') + '</div>';
  }

  function mineList() {
    var acc = global.ZHUKE.account.current();
    var posts = store.myPosts().filter(function (p) { return acc && p.ownerId === acc.id; });
    if (!posts.length) return '<div class="empty"><span>📣</span>暂无发布记录。可在「发布」页提交活动或招募信息。</div>';
    return '<div class="mini-list">' + posts.map(function (p) {
      var risk = p.risk ? ' · ' + p.risk.type : '';
      return miniHtml('', p.title, '我发布的｜' + (p.timeText || '时间待定') + risk, { del: p.id });
    }).join('') + '</div>';
  }

  function accountBlock() {
    var A = global.ZHUKE.account;
    var acc = A.current();
    if (!acc) return '';
    var verify = A.verifyStatusOf(acc);
    var verified = A.isVerified();
    var idText = acc.studentId ? A.maskStudentId(acc.studentId) : '未绑定';

    return '<div class="callout ' + (verified ? 'info' : 'warn') + '" style="margin-bottom:12px">' +
      '<b>' + ui.esc(verified ? acc.realName : '未实名账号') + '</b> · ' +
      '<span class="badge t-' + verify.tone + '">' + ui.esc(verify.label) + '</span> · ' +
      '学号 ' + ui.esc(idText) + ' · ' +
      ui.esc((A.ROLES[acc.role] || A.ROLES.student).label) +
      '<br><span style="opacity:.9">' + (verified
        ? '发布的内容会显示实名信息；账号由后台统一管理。'
        : '未实名账号不能发布活动，也不能报名或登记参加活动。') + '</span>' +
      (verified ? ''
        : '<br><button class="link-btn" id="mineVerify" type="button" ' +
          'style="text-decoration:underline;color:inherit;margin-top:4px">去实名认证</button>') +
      '</div>';
  }

  function render() {
    var body = document.getElementById('mineBody');
    if (!body) return;
    var p = store.profile();
    var html = '';

    html += accountBlock();

    html += '<div class="callout info" style="margin-bottom:12px">' +
      '<b>你的情况：</b>' + ui.esc(p.grade) + ' · ' + ui.esc(p.level) + ' · 每周可投入 ' + ui.esc(String(p.hours)) + ' 小时' +
      '<br><span style="opacity:.85">发现页那个「只看我符合条件的」，就是照这个筛的。<button class="link-btn" id="editProfile" type="button" style="color:inherit;text-decoration:underline">修改</button></span>' +
      '</div>';

    html += countdownHtml();

    var acc = global.ZHUKE.account.current();
    var myPostCount = acc ? store.myPosts().filter(function (x) { return x.ownerId === acc.id; }).length : 0;
    var counts = { fav: store.favorites().length, join: store.joinedList().length, post: myPostCount };
    html += '<div class="seg">' +
      '<button data-tab="fav" class="' + (tab === 'fav' ? 'is-active' : '') + '">收藏 ' + counts.fav + '</button>' +
      '<button data-tab="join" class="' + (tab === 'join' ? 'is-active' : '') + '">我报名的 ' + counts.join + '</button>' +
      '<button data-tab="post" class="' + (tab === 'post' ? 'is-active' : '') + '">我发布的 ' + counts.post + '</button>' +
      '</div>';

    html += tab === 'fav' ? favList() : (tab === 'join' ? joinList() : mineList());

    html += serviceBlock();

    body.innerHTML = html;
  }

  /** 相关服务：同系列的校园应用入口 */
  function serviceBlock() {
    return '<div class="svc-card">' +
      '<div class="svc-main">' +
      '<div class="svc-title">掌上珠科 · 课表水电</div>' +
      '<div class="svc-desc">同系列校园服务：查看课表、查询宿舍水电余量</div>' +
      '</div>' +
      '<a class="btn small primary svc-go" href="https://bbf5dbd30efa49a5902be69c13a65b55.app.workbuddy.link/"' +
      ' target="_blank" rel="noopener">前往</a>' +
      '</div>';
  }

  /* 事件委托：只绑定一次（#mineBody 元素本身不会被替换） */
  function bindOnce() {
    var body = document.getElementById('mineBody');
    if (!body || body.dataset.bound) return;
    body.dataset.bound = '1';
    body.addEventListener('click', function (ev) {
      var seg = ev.target.closest('[data-tab]');
      if (seg) { tab = seg.dataset.tab; render(); return; }

      if (ev.target.closest('#mineVerify')) {
        ui.openVerify();
        return;
      }
      if (ev.target.closest('#editProfile')) {
        ui.openProfile();
        return;
      }
      var del = ev.target.closest('[data-del]');
      if (del) {
        var id = del.dataset.del;
        if (tab === 'post') {
          store.removePost(id);
          ui.toast('已删除该发布');
        } else {
          store.setJoin(id, null);
          store.toggleFavorite(id);
          ui.toast('已移除');
        }
        render();
        global.ZHUKE.render();
        return;
      }
      var go = ev.target.closest('[data-goto]');
      if (go && go.dataset.goto && global.ZHUKE.detail) global.ZHUKE.detail.open(go.dataset.goto);
    });
  }

  global.ZHUKE.mine = {
    render: render,
    init: function () { bindOnce(); render(); },
    byId: byId
  };
})(window);
