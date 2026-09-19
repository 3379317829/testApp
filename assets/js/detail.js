/* ============================================================
 * 掌上猪科 · 详情视图
 * 落地三件事：
 *   1. 字段结构化 —— 材料没给的显式写"未提供"，不编造（对应题面 P032）
 *   2. 关联通知合并与变更提示（自主设计功能 C）
 *   3. 风险提示与资格判定（自主设计功能 A / B 的界面呈现）
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.ZHUKE_DATA;
  var E = global.ZHUKE.engine;
  var store = global.ZHUKE.store;
  var ui = global.ZHUKE.ui;

  var currentId = null;

  function findItem(id) {
    return DATA.items.filter(function (i) { return i.id === id; })[0] || null;
  }

  function timesHtml(item) {
    var rows = (item.times || []).map(function (t) {
      var val;
      if (t.kind === 'unknown' || !t.at) {
        val = '<span class="miss">' + ui.esc(t.text || '未提供') + '</span>';
      } else {
        val = ui.esc(t.label + '：' + t.text);
        if (t.approximate) val += ' <span class="miss">（预计 / 待确认）</span>';
        if (t.supersededBy) val += ' <span class="miss">（已被 ' + t.supersededBy + ' 号通知变更）</span>';
      }
      return '<div class="kv"><dt>' + (t.kind === 'deadline' ? '截止' : '时间') + '</dt><dd>' + val + '</dd></div>';
    }).join('');
    return rows || '<div class="kv"><dt>时间</dt><dd class="miss">材料未提供</dd></div>';
  }

  function kv(label, value, isMissing) {
    return '<div class="kv"><dt>' + label + '</dt><dd' + (isMissing ? ' class="miss"' : '') + '>' +
      (isMissing ? ui.esc(value) + '' : ui.esc(value)) + '</dd></div>';
  }

  function changesHtml(relatedInfo) {
    if (!relatedInfo.changes.length) return '';
    var lines = relatedInfo.changes.map(function (c) {
      return '<div class="chg-line"><span class="field">' + ui.esc(c.field) + '</span>' +
        '<del>' + ui.esc(c.from) + '</del><span>→</span><ins>' + ui.esc(c.to) + '</ins>' +
        '<span style="color:var(--muted)">（见 ' + ui.esc(c.updateId) + ' 号通知）</span></div>';
    }).join('');
    return '<div class="block"><h3>🔄 已变更 <span class="hint">同一条活动的新旧通知合并</span></h3>' +
      '<div class="callout chg"><b>以最新通知为准，旧时间已失效：</b>' + lines + '</div></div>';
  }

  function relatedHtml(relatedInfo) {
    if (!relatedInfo.list.length) return '';
    var list = relatedInfo.list.map(function (o) {
      return '<div class="mini" data-goto="' + o.id + '" style="cursor:pointer">' +
        '<span class="card-no">' + o.id + '</span>' +
        '<div class="mini-main"><div class="mini-title">' + ui.esc(o.title) + '</div>' +
        '<div class="mini-sub">' + ui.esc(o.raw.slice(0, 42)) + '…</div></div>' +
        '<span style="color:var(--muted)">›</span></div>';
    }).join('');
    return '<div class="block"><h3>🔗 相关通知 <span class="hint">点击查看</span></h3>' +
      '<div class="mini-list">' + list + '</div></div>';
  }

  function render(id) {
    var item = findItem(id);
    if (!item) return;
    currentId = id;
    var now = Date.now();
    var profile = store.profile();
    var it = E.decorate(item, now, profile, DATA.items);
    var st = it.status, sc = it.trust, src = it.sourceInfo;
    var rel = it.relatedInfo;
    var isFav = store.isFavorite(id);
    var join = store.joinState(id);

    var html = '';

    html += '<h2 class="detail-title">' + it.id + ' · ' + ui.esc(it.title) + '</h2>';
    html += '<div class="detail-badges">' +
      '<span class="badge t-' + st.tone + '">' + ui.esc(st.label) + '</span>' +
      '<span class="badge src lv' + src.level + '">' + ui.esc(src.label) + '</span>' +
      '<span class="badge t-muted">' + ui.esc(it.categoryLabel) + '</span>' +
      (it.isUpdate ? '<span class="badge update">补充 / 变更通知</span>' : '') +
      (it.risk ? '<span class="badge risk">' + ui.esc(it.risk.type) + '</span>' : '') +
      '</div>';

    /* 状态解释 —— 把"为什么是这个状态"讲清楚 */
    html += '<div class="callout info" style="margin-bottom:12px">' +
      '<b>当前状态：' + ui.esc(st.label) + '</b><br>' + ui.esc(st.detail || '') + '</div>';

    /* 关键信息结构化 */
    html += '<dl style="margin:0">';
    html += timesHtml(item);
    html += kv('地点', (item.place && item.place.status === 'known') ? item.place.text :
      ((item.place && item.place.status === 'pending') ? item.place.text + '（待确认）' : '材料未提供'),
      !(item.place && item.place.status === 'known'));
    html += kv('适用对象', (item.audience && item.audience.text) || '未提供', !(item.audience && item.audience.text && item.audience.text !== '未提供'));
    html += kv('参加条件', item.requirement || '未提供', !item.requirement);
    html += kv('报名方式', (item.signup && item.signup.text) || '未提供', !(item.signup && item.signup.text));
    html += kv('费用', (item.fee && item.fee.status === 'known') ? (item.fee.text || '材料未提及收费') : '材料未提供',
      !(item.fee && item.fee.status === 'known'));
    html += kv('名额', (item.capacity && item.capacity.status === 'known') ? item.capacity.text : '材料未提供',
      !(item.capacity && item.capacity.status === 'known'));
    html += kv('发布来源', src.label + '（' + src.desc + '）');
    html += '</dl>';

    /* 材料原文 —— 可追溯，不加工 */
    html += '<div class="block"><h3>📄 材料原文 <span class="hint">原样呈现，未做改写</span></h3>' +
      '<div class="callout muted">' + ui.esc(item.raw) + '</div></div>';

    /* 变更 */
    html += changesHtml(rel);

    /* 缺失字段 */
    if (item.missing && item.missing.length) {
      html += '<div class="block"><h3>⚠️ 材料未提供的字段 <span class="hint">不编造，请以官方通知为准</span></h3>' +
        '<div class="callout warn">' +
        item.missing.map(function (m) { return '· ' + ui.esc(m); }).join('<br>') +
        '</div></div>';
    }

    /* 风险提示 */
    if (item.risk) {
      html += '<div class="block"><h3>🚨 ' + ui.esc(item.risk.type) +
        ' <span class="hint">信息质量提示</span></h3>' +
        '<div class="callout ' + (item.risk.level === 'high' ? 'danger' : 'warn') + '">' +
        '<b>' + ui.esc(item.risk.reason) + '</b></div></div>';
    }

    /* 待确认 */
    if (sc.pending.length) {
      html += '<div class="block"><h3>⏳ 待确认</h3><div class="callout muted">' +
        sc.pending.map(function (p) { return '· ' + ui.esc(p); }).join('<br>') + '</div></div>';
    }

    /* 资格判定（自主设计功能 B） */
    if (it.eligibility) {
      var eg = it.eligibility;
      var tone = eg.ok === 'yes' ? 'info' : (eg.ok === 'no' ? 'danger' : 'warn');
      html += '<div class="block"><h3>🙋 我能不能参加？ <span class="hint">按 ' + ui.esc(profile.grade) + ' / ' +
        ui.esc(profile.level) + ' / 每周 ' + ui.esc(String(profile.hours)) + ' 小时判断</span></h3>' +
        '<div class="callout ' + tone + '"><b>' + ui.esc(eg.label) + '</b>' +
        (eg.reasons.length ? '<br>' + eg.reasons.map(function (r) { return '· ' + ui.esc(r); }).join('<br>') : '') +
        '</div></div>';
    }

    /* 可信度（自主设计功能 A） */
    html += '<div class="block"><h3>🔍 信息可信度</h3>' +
      ui.trustBarHtml(sc) +
      (sc.lack.length ? '<div class="callout warn" style="margin-top:8px">缺失字段：' + ui.esc(sc.lack.join('、')) + '</div>' : '') +
      '<div class="form-hint">评分 = 来源层级（学院/校级/未标注/学生）+ 字段完整度 − 可疑特征扣分。</div></div>';

    html += relatedHtml(rel);

    /* 操作区 */
    html += '<div class="actions">';
    html += '<button class="btn ' + (isFav ? 'is-on' : 'ghost') + '" id="dFav" type="button">' +
      (isFav ? '★ 已收藏' : '☆ 收藏') + '</button>';
    if (join === 'signed') {
      html += '<button class="btn is-on" id="dJoin" type="button">✓ 已报名 / 已登记</button>';
    } else {
      var needAudit = item.signup && item.signup.unsure;
      var closed = st.key === 'closed' || st.key === 'ended';
      var label = closed ? '本次活动已结束' : (needAudit ? '登记意向（需等待确认）' : '我要报名 / 登记意向');
      html += '<button class="btn primary" id="dJoin" type="button"' + (closed ? ' disabled style="opacity:.5"' : '') + '>' + label + '</button>';
    }
    html += '</div>';
    html += '<div class="form-hint" style="margin-top:8px">本作品不提供真实报名通道：点击后仅在本机记录你的意向，用于演示"操作结果刷新后保留"。</div>';

    var body = document.getElementById('sheetBody');
    body.innerHTML = html;
    body.scrollTop = 0;

    /* 事件 */
    var favBtn = document.getElementById('dFav');
    if (favBtn) {
      favBtn.addEventListener('click', function () {
        var on = store.toggleFavorite(id);
        ui.toast(on ? '已收藏' : '已取消收藏');
        render(id);
        global.ZHUKE.render();
        if (global.ZHUKE.mine) global.ZHUKE.mine.render();
      });
    }
    var joinBtn = document.getElementById('dJoin');
    if (joinBtn && !joinBtn.disabled) {
      joinBtn.addEventListener('click', function () {
        if (join === 'signed') {
          store.setJoin(id, null);
          ui.toast('已取消报名记录');
        } else {
          store.setJoin(id, 'signed');
          ui.toast('已在你的「我的」里记录（刷新后仍在）');
        }
        render(id);
        if (global.ZHUKE.mine) global.ZHUKE.mine.render();
      });
    }
    /* 事件：只绑定一次委托（sheetBody 元素本身不会被替换） */
  }

  /* 相关通知跳转：模块级一次性委托 */
  document.getElementById('sheetBody').addEventListener('click', function (ev) {
    var go = ev.target.closest('[data-goto]');
    if (go) render(go.dataset.goto);
  });

  global.ZHUKE.detail = {
    open: function (id) {
      ui.openSheet('detail');
      render(id);
    },
    render: render,
    refresh: function () { if (currentId) render(currentId); },
    isOpen: function () { return currentId !== null && !document.getElementById('sheet').hidden; }
  };
})(window);
