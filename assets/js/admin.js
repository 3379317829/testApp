/* ============================================================
 * 掌上猪科 · 后台管理（仅管理员可见）
 * 能力：
 *   1. 账号总览：账号数、管理员数、封禁数、发布内容数、风险内容数
 *   2. 新增账号：用户名、密码、实名、学号（唯一）、角色
 *   3. 管理账号：封禁 / 解封 / 删除（删除会一并移除该账号发布的内容）
 *   4. 查看账号发布内容，并可下架违规内容
 * 所有破坏性操作均需二次确认（内联确认条，不用浏览器弹窗）
 * ============================================================ */
(function (global) {
  'use strict';

  var store = global.ZHUKE.store;
  var A = global.ZHUKE.account;
  var ui = global.ZHUKE.ui;

  var keyword = '';
  var expanded = null;      /* 当前展开查看发布内容的账号 id */
  var pending = null;       /* 待确认操作 { action: 'ban'|'unban'|'delete', id } */

  function badge(text, tone) {
    return '<span class="badge t-' + tone + '">' + ui.esc(text) + '</span>';
  }

  function statCard(n, label, tone) {
    return '<div class="stat ' + (tone || '') + '"><b>' + n + '</b><span>' + label + '</span></div>';
  }

  function overviewHtml() {
    var s = A.stats();
    return '<div class="stats admin-stats">' +
      statCard(s.total, '账号总数') +
      statCard(s.admins, '管理员') +
      statCard(s.banned, '已封禁', 'is-risk') +
      statCard(s.posts, '发布内容') +
      '</div>' +
      (s.riskyPosts
        ? '<div class="callout warn" style="margin-bottom:12px">当前有 <b>' + s.riskyPosts +
          '</b> 条内容被系统标记为疑似风险或推广，建议核查后处理。</div>'
        : '');
  }

  function createFormHtml() {
    return '' +
      '<div class="admin-block">' +
      '<h3 class="admin-h3">新增账号</h3>' +
      '<p class="form-hint" style="margin-bottom:10px">账号绑定学号并采用实名制：同一学号只能注册一个账号，姓名需与学籍一致。</p>' +
      '<div class="admin-form">' +
      '<div class="field-row"><label>用户名 *</label><input id="nuUser" type="text" maxlength="16" placeholder="3—16 位字母、数字或下划线"></div>' +
      '<div class="field-row"><label>初始密码 *</label><input id="nuPass" type="text" maxlength="20" placeholder="至少 6 位"></div>' +
      '<div class="field-row"><label>真实姓名 *</label><input id="nuName" type="text" maxlength="10" placeholder="2—10 位中文姓名"></div>' +
      '<div class="field-row"><label>学号 *</label><input id="nuSid" type="text" maxlength="14" placeholder="6—14 位数字"></div>' +
      '<div class="field-row"><label>账号角色</label><select id="nuRole">' +
      '<option value="student">学生</option><option value="admin">管理员</option></select></div>' +
      '</div>' +
      '<p class="login-err" id="nuErr" hidden></p>' +
      '<div class="form-actions"><button class="btn primary" id="nuSubmit" type="button">创建账号</button>' +
      '<button class="btn ghost" id="nuReset" type="button">清空</button></div>' +
      '</div>';
  }

  function confirmBarHtml(label, action, id) {
    return '<div class="confirm-bar"><span>' + ui.esc(label) + '</span>' +
      '<button class="btn small primary" data-confirm="' + action + '" data-id="' + id + '" type="button">确认</button>' +
      '<button class="btn small ghost" data-cancel="1" type="button">取消</button></div>';
  }

  function accountRowHtml(acc) {
    var role = A.ROLES[acc.role] || A.ROLES.student;
    var status = A.STATUS[acc.status] || A.STATUS.active;
    var isMe = (A.current() || {}).id === acc.id;
    var posts = A.postsOf(acc.id);
    var html = '';

    html += '<div class="acct' + (acc.status === 'banned' ? ' is-banned' : '') + '">';
    html += '<div class="acct-head">';
    html += '<div class="acct-main">';
    html += '<div class="acct-name">' + ui.esc(acc.realName) +
      (isMe ? '<span class="acct-me">当前登录</span>' : '') + '</div>';
    html += '<div class="acct-sub">@' + ui.esc(acc.username) +
      ' · 学号 ' + ui.esc(acc.studentId) +
      ' · ' + posts.length + ' 条发布</div>';
    html += '<div class="acct-badges">' +
      badge(role.label, acc.role === 'admin' ? 'open' : 'muted') +
      badge(status.label, status.tone) +
      (acc.banReason ? badge(acc.banReason, 'warn') : '') +
      '</div>';
    html += '</div>';

    html += '<div class="acct-actions">';
    html += '<button class="btn small ghost" data-view-posts="' + acc.id + '" type="button">' +
      (expanded === acc.id ? '收起内容' : '查看发布内容') + '</button>';
    if (!isMe) {
      html += acc.status === 'active'
        ? '<button class="btn small" data-ask="ban" data-id="' + acc.id + '" type="button">封禁</button>'
        : '<button class="btn small" data-ask="unban" data-id="' + acc.id + '" type="button">解封</button>';
      html += '<button class="btn small danger-ghost" data-ask="delete" data-id="' + acc.id + '" type="button">删除</button>';
    }
    html += '</div>';
    html += '</div>';

    /* 内联二次确认 */
    if (pending && pending.id === acc.id) {
      var label = pending.action === 'delete'
        ? '删除账号「' + acc.realName + '」及其 ' + posts.length + ' 条发布内容？此操作不可撤销。'
        : (pending.action === 'ban'
          ? '封禁账号「' + acc.realName + '」？封禁后该账号无法登录。'
          : '解封账号「' + acc.realName + '」？');
      html += confirmBarHtml(label, pending.action, acc.id);
    }

    /* 展开：该账号发布的内容 */
    if (expanded === acc.id) {
      html += '<div class="acct-posts">';
      if (!posts.length) {
        html += '<div class="form-hint">该账号还没有发布过内容。</div>';
      } else {
        posts.forEach(function (p) {
          var risk = p.risk ? badge(p.risk.type, p.risk.level === 'high' ? 'urgent' : 'warn') : badge('正常', 'open');
          html += '<div class="acct-post">' +
            '<div class="acct-post-main">' +
            '<div class="mini-title">' + ui.esc(p.title) + '</div>' +
            '<div class="mini-sub">' + ui.esc(p.timeText || '时间待定') + ' · ' +
            ui.esc((p.createdAt || '').slice(0, 10)) + '</div>' +
            '<div class="acct-badges">' + risk + '</div>' +
            '</div>' +
            '<button class="btn small danger-ghost" data-drop="' + ui.esc(p.id) + '" type="button">下架</button>' +
            '</div>';
        });
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function listHtml() {
    var all = A.list().slice().sort(function (a, b) {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    var kw = keyword.trim().toLowerCase();
    var filtered = kw ? all.filter(function (a) {
      return a.username.toLowerCase().indexOf(kw) > -1 ||
        a.realName.indexOf(keyword.trim()) > -1 ||
        a.studentId.indexOf(kw) > -1;
    }) : all;

    var html = '<div class="admin-block">';
    html += '<h3 class="admin-h3">账号管理</h3>';
    html += '<label class="search" style="margin-bottom:10px"><span aria-hidden="true">🔍</span>' +
      '<input id="acctSearch" type="search" placeholder="按用户名、姓名或学号查找" value="' + ui.esc(keyword) + '"></label>';
    html += '<div class="form-hint" style="margin-bottom:8px">共 ' + filtered.length + ' 个账号</div>';
    html += filtered.length ? filtered.map(accountRowHtml).join('')
      : '<div class="empty"><span>🔍</span>没有匹配的账号。</div>';
    html += '</div>';
    return html;
  }

  function render() {
    var body = document.getElementById('adminBody');
    if (!body) return;

    if (!A.isAdmin()) {
      body.innerHTML = '<div class="callout danger">当前账号没有后台管理权限。</div>';
      return;
    }

    body.innerHTML = overviewHtml() + createFormHtml() + listHtml();

    /* 搜索 */
    var search = document.getElementById('acctSearch');
    search.addEventListener('input', function () {
      keyword = search.value;
      render();
      var el = document.getElementById('acctSearch');
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });

    /* 新增账号 */
    document.getElementById('nuSubmit').addEventListener('click', createAccount);
    document.getElementById('nuReset').addEventListener('click', function () {
      ['nuUser', 'nuPass', 'nuName', 'nuSid'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('nuErr').hidden = true;
    });
  }

  function createAccount() {
    var err = document.getElementById('nuErr');
    var payload = {
      username: document.getElementById('nuUser').value,
      password: document.getElementById('nuPass').value,
      realName: document.getElementById('nuName').value,
      studentId: document.getElementById('nuSid').value,
      role: document.getElementById('nuRole').value
    };
    var res = A.create(payload);
    if (!res.ok) {
      err.innerHTML = res.errors.map(function (e) { return '· ' + ui.esc(e); }).join('<br>');
      err.hidden = false;
      return;
    }
    err.hidden = true;
    ui.toast('账号「' + res.account.realName + '」已创建');
    render();
  }

  /* 事件委托：账号行操作（只绑定一次） */
  function bindOnce() {
    var body = document.getElementById('adminBody');
    if (!body || body.dataset.bound) return;
    body.dataset.bound = '1';

    body.addEventListener('click', function (ev) {
      var t = ev.target;

      var view = t.closest('[data-view-posts]');
      if (view) {
        var id = view.dataset.viewPosts;
        expanded = expanded === id ? null : id;
        pending = null;
        render();
        return;
      }

      var ask = t.closest('[data-ask]');
      if (ask) {
        pending = { action: ask.dataset.ask, id: ask.dataset.id };
        render();
        return;
      }

      if (t.closest('[data-cancel]')) {
        pending = null;
        render();
        return;
      }

      var confirmBtn = t.closest('[data-confirm]');
      if (confirmBtn) {
        var action = confirmBtn.dataset.confirm;
        var targetId = confirmBtn.dataset.id;
        var res;
        if (action === 'ban') {
          res = A.setStatus(targetId, 'banned', '发布违规内容');
          if (res.ok) ui.toast('账号已封禁');
        } else if (action === 'unban') {
          res = A.setStatus(targetId, 'active');
          if (res.ok) ui.toast('账号已解封');
        } else if (action === 'delete') {
          res = A.remove(targetId);
          if (res.ok) {
            ui.toast('账号已删除，同时移除 ' + res.removedPosts + ' 条内容');
            if (expanded === targetId) expanded = null;
          }
        }
        if (res && !res.ok) ui.toast(res.message);
        pending = null;
        render();
        global.ZHUKE.render();
        if (global.ZHUKE.mine) global.ZHUKE.mine.render();
        return;
      }

      var drop = t.closest('[data-drop]');
      if (drop) {
        A.removePost(drop.dataset.drop);
        ui.toast('该内容已下架');
        /* 同步从发现页数据中移除 */
        var pid = drop.dataset.drop;
        if (global.ZHUKE_DATA && global.ZHUKE_DATA.items) {
          global.ZHUKE_DATA.items = global.ZHUKE_DATA.items.filter(function (i) {
            return i.postId !== pid;
          });
        }
        render();
        global.ZHUKE.render();
        return;
      }
    });
  }

  global.ZHUKE.admin = {
    render: function () { bindOnce(); render(); },
    init: function () { bindOnce(); }
  };
})(window);
