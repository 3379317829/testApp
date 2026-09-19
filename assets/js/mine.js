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
    return '<div class="callout warn" style="margin-bottom:12px"><b>⏰ 你收藏的活动中，这些快到点了：</b><br>' +
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
    if (!ids.length) return '<div class="empty"><span>⭐</span>还没有收藏。在发现页点卡片右上角 ☆ 就能收藏，刷新后依然在。</div>';
    return '<div class="mini-list">' + ids.map(function (id) {
      var it = byId(id);
      if (!it) return '';
      var st = E.statusOf(it, Date.now());
      return miniHtml(id, it.title, st.label + '｜' + (st.detail || ''), { goto: id, del: id });
    }).join('') + '</div>';
  }

  function joinList() {
    var rows = store.joinedList();
    if (!rows.length) return '<div class="empty"><span>📝</span>还没有报名或登记记录。打开活动详情点「我要报名 / 登记意向」试试。</div>';
    return '<div class="mini-list">' + rows.map(function (r) {
      var it = byId(r.id);
      var title = it ? it.title : r.id;
      var sub = it ? (E.statusOf(it, Date.now()).detail || '') : '已记录';
      var tag = (it && it.signup && it.signup.unsure) ? '待审核 / 待确认' : '已记录';
      return miniHtml(it ? it.id : '', title, tag + '｜' + sub, { goto: it ? it.id : '' });
    }).join('') + '</div>';
  }

  function mineList() {
    var posts = store.myPosts();
    if (!posts.length) return '<div class="empty"><span>📣</span>你还没有发布过内容。去「发布」页发一条试试，发布后会进入发现页列表。</div>';
    return '<div class="mini-list">' + posts.map(function (p) {
      var risk = p.risk ? ' · ' + p.risk.type : '';
      return miniHtml('', p.title, '我发布的｜' + (p.timeText || '时间待定') + risk, { del: p.id });
    }).join('') + '</div>';
  }

  function render() {
    var body = document.getElementById('mineBody');
    if (!body) return;
    var p = store.profile();
    var html = '';

    html += '<div class="callout info" style="margin-bottom:12px">' +
      '<b>我的情况：</b>' + ui.esc(p.grade) + ' · ' + ui.esc(p.level) + ' · 每周可投入 ' + ui.esc(String(p.hours)) + ' 小时' +
      '<br><span style="opacity:.85">发现页的"只看我符合条件的"会按这个判断。<button class="link-btn" id="editProfile" type="button" style="color:inherit;text-decoration:underline">修改</button></span>' +
      '</div>';

    html += countdownHtml();

    var counts = { fav: store.favorites().length, join: store.joinedList().length, post: store.myPosts().length };
    html += '<div class="seg">' +
      '<button data-tab="fav" class="' + (tab === 'fav' ? 'is-active' : '') + '">收藏 ' + counts.fav + '</button>' +
      '<button data-tab="join" class="' + (tab === 'join' ? 'is-active' : '') + '">我报名的 ' + counts.join + '</button>' +
      '<button data-tab="post" class="' + (tab === 'post' ? 'is-active' : '') + '">我发布的 ' + counts.post + '</button>' +
      '</div>';

    html += tab === 'fav' ? favList() : (tab === 'join' ? joinList() : mineList());

    body.innerHTML = html;
  }

  /* 事件委托：只绑定一次（#mineBody 元素本身不会被替换） */
  function bindOnce() {
    var body = document.getElementById('mineBody');
    if (!body || body.dataset.bound) return;
    body.dataset.bound = '1';
    body.addEventListener('click', function (ev) {
      var seg = ev.target.closest('[data-tab]');
      if (seg) { tab = seg.dataset.tab; render(); return; }

      if (ev.target.closest('#editProfile')) {
        document.getElementById('profileBtn').click();
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
