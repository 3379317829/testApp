/* ============================================================
 * 掌上猪科 · 学生自主发布
 * 对应题目要求 5：支持学生自主发布活动/招募，且发布内容进入产品的正常使用流程
 * 同时落地「信息质量机制」：自动识别可疑内容并打风险标记，而不是直接放行或一刀切删除
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.ZHUKE_DATA;
  var store = global.ZHUKE.store;
  var ui = global.ZHUKE.ui;

  /* ---------- 可疑内容检测 ---------- */
  var HIGH = [
    { re: /(日结|刷单|垫付|先交[钱费]|押金|保证金)/, why: '写了“日结”“刷单”“垫付”“押金”这类词' },
    { re: /(私人微信|加我微信|加微信|私聊转账)/, why: '让人加私人微信、私下转账' }
  ];
  var MID = [
    { re: /(优惠|折扣|返现|促销|购买链接|下单)/, why: '带着商家优惠、引导下单' },
    { re: /(https?:\/\/|扫码|二维码)/, why: '带着外部链接或者二维码' }
  ];

  function detectRisk(text) {
    var hits = [];
    for (var i = 0; i < HIGH.length; i++) if (HIGH[i].re.test(text)) hits.push(HIGH[i].why);
    if (hits.length) {
      return {
        level: 'high', type: '疑似风险信息',
        reason: hits.join('；') + '。先别转钱，也别把身份证、银行卡、验证码给出去，最好找官方渠道问一句。'
      };
    }
    for (var j = 0; j < MID.length; j++) {
      if (MID[j].re.test(text)) {
        return {
          level: 'medium', type: '疑似推广内容',
          reason: MID[j].why + '，跟校园活动关系不大，自己掂量着来。'
        };
      }
    }
    return null;
  }

  /* ---------- 表单里的发布物 → 引擎可识别的信息条目 ---------- */
  function toItem(post) {
    var missing = [];
    if (!post.times || !post.times.length) missing.push('什么时间没说');
    if (!post.place || post.place.status !== 'known') missing.push('在哪儿没说');
    if (!post.capacity || post.capacity.status !== 'known') missing.push('招多少人没说');
    if (!post.fee || post.fee.status !== 'known') missing.push('要不要花钱没说');
    missing.push('学生自己发的，没人审过');

    return {
      id: post.no || '我',
      title: post.title,
      source: 'student',
      category: post.category || 'sports',
      raw: post.desc || post.title,
      times: post.times || [{ kind: 'unknown', label: '活动时间', at: null, text: '没写' }],
      place: post.place || { status: 'unknown' },
      audience: post.audience || { text: '谁都能来', grades: ['大一', '大二', '大三', '大四'] },
      requirement: post.requirement || '没写',
      fee: post.fee || { status: 'unknown' },
      capacity: post.capacity || { status: 'unknown' },
      signup: post.signup || { required: true, text: '按发布说明联系发起人' },
      missing: missing,
      risk: post.risk || null,
      related: [],
      tags: ['学生自发', '我发布的'],
      mine: true,
      postId: post.id
    };
  }

  /* ---------- 视图 ---------- */
  function formHtml() {
    var catOptions = Object.keys(DATA.categories).map(function (k) {
      return '<option value="' + k + '">' + ui.esc(DATA.categories[k]) + '</option>';
    }).join('');

    return '' +
      '<p class="form-hint" style="margin-bottom:12px">' +
      '自己攒的局、组队、约球、找搭子，都能发在这儿。发完就出现在发现页，别人看得到。' +
      '内容里要是出现"日结""加微信"这类字眼，会挂个提醒，但真假还得自己留神。</p>' +

      '<div class="field-row"><label>起个标题 *</label>' +
      '<input id="pTitle" type="text" maxlength="40" placeholder="例：周末羽毛球约球（缺 2 人）"></div>' +

      '<div class="field-row"><label>类型</label><select id="pCat">' + catOptions + '</select></div>' +

      '<div class="field-row"><label>什么时候</label>' +
      '<input id="pTime" type="datetime-local">' +
      '<label class="switch" style="margin-top:6px;font-size:12.5px;color:var(--muted)">' +
      '<input type="checkbox" id="pTimeUnknown"> 时间还没定 / 待确认</label></div>' +

      '<div class="field-row"><label>在哪儿</label>' +
      '<input id="pPlace" type="text" maxlength="30" placeholder="例：体育馆 3 号场（未定可留空）"></div>' +

      '<div class="field-row"><label>谁可以来</label>' +
      '<input id="pWho" type="text" maxlength="30" value="面向全校学生"></div>' +

      '<div class="field-row"><label>再补充点</label>' +
      '<textarea id="pDesc" maxlength="200" placeholder="人数、费用、报名方式、需要准备什么……"></textarea></div>' +

      '<div class="field-row"><label>怎么报名 / 怎么联系你</label>' +
      '<input id="pSignup" type="text" maxlength="40" placeholder="例：进群填表 / 评论区留言"></div>' +

      '<div class="form-actions">' +
      '<button class="btn primary" id="pSubmit" type="button">发出去</button>' +
      '<button class="btn ghost" id="pClear" type="button">清空</button></div>' +
      '<div class="form-hint" id="pPreview"></div>';
  }

  function readForm() {
    var title = document.getElementById('pTitle').value.trim();
    var desc = document.getElementById('pDesc').value.trim();
    var signupText = document.getElementById('pSignup').value.trim();
    var placeText = document.getElementById('pPlace').value.trim();
    var who = document.getElementById('pWho').value.trim();
    var unknownTime = document.getElementById('pTimeUnknown').checked;
    var timeVal = document.getElementById('pTime').value;

    var times = [];
    var timeText = '时间待定';
    if (!unknownTime && timeVal) {
      var iso = new Date(timeVal).toISOString();
      var d = new Date(timeVal);
      timeText = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      times = [{ kind: 'start', label: '活动开始', at: iso, text: timeText }];
    } else if (unknownTime) {
      times = [{ kind: 'start', label: '活动开始', at: null, text: '时间待定（发起人未确认）', approximate: true }];
    }

    return {
      title: title,
      category: document.getElementById('pCat').value,
      desc: desc,
      times: times,
      timeText: timeText,
      place: placeText ? { status: 'known', text: placeText } : { status: 'pending', text: '待确认' },
      audience: { text: who || '谁都能来', grades: ['大一', '大二', '大三', '大四'] },
      requirement: desc || '见补充说明',
      signup: { required: true, text: signupText || '按补充说明联系发起人', unsure: true },
      risk: detectRisk([title, desc, signupText, placeText].join(' '))
    };
  }

  function nextNo() {
    var mineCount = store.myPosts().length;
    return '我' + (mineCount + 1);
  }

  function render() {
    var body = document.getElementById('publishBody');
    if (!body) return;
    body.innerHTML = formHtml();
    bindForm();
  }

  function bindForm() {
    var unknown = document.getElementById('pTimeUnknown');
    var timeInput = document.getElementById('pTime');
    unknown.addEventListener('change', function () {
      timeInput.disabled = unknown.checked;
      if (unknown.checked) timeInput.value = '';
      preview();
    });

    ['pTitle', 'pDesc', 'pSignup', 'pPlace'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', preview);
    });

    document.getElementById('pSubmit').addEventListener('click', submit);
    document.getElementById('pClear').addEventListener('click', function () {
      render();
      ui.toast('清空了');
    });
    preview();
  }

  function preview() {
    var f = readForm();
    if (!f.title) { document.getElementById('pPreview').textContent = ''; return; }
    var risk = f.risk;
    document.getElementById('pPreview').innerHTML = risk
      ? '<span class="badge risk">' + ui.esc(risk.type) + '</span> <span style="color:var(--warn)">' + ui.esc(risk.reason) + '</span>'
      : '<span class="badge t-muted">没看出什么可疑的</span> 发出去会带上“学生自己发的”标记。';
  }

  function submit() {
    var f = readForm();
    if (!f.title) { ui.toast('标题还没写'); return; }
    if (!f.desc) { ui.toast('补两句说明吧，别人才好判断'); return; }

    f.no = nextNo();
    var post = store.addPost(f);
    DATA.items.unshift(toItem(post));       /* 进入正常使用流程：发现页立即可见 */

    global.ZHUKE.render();
    if (global.ZHUKE.mine) global.ZHUKE.mine.render();

    ui.closeSheets();
    document.querySelector('.tab[data-view="discover"]').click();
    ui.toast(f.risk ? '发出去了，风险提醒也挂上了' : '发好了，去发现页能看到');
  }

  global.ZHUKE.publish = {
    render: render,
    init: function () {
      /* 已存在的本机发布在启动时一并加载，保证刷新后仍在列表里 */
      var posts = store.myPosts();
      posts.slice().reverse().forEach(function (p) {
        var item = toItem(p);
        var exists = DATA.items.some(function (i) { return i.postId === p.id; });
        if (!exists) DATA.items.unshift(item);
      });
      render();
    },
    detectRisk: detectRisk,
    toItem: toItem
  };
})(window);
