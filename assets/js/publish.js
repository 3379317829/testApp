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
    { re: /(日结|刷单|垫付|先交[钱费]|押金|保证金)/, why: '包含“日结”“刷单”“垫付”“押金”等特征词' },
    { re: /(私人微信|加我微信|加微信|私聊转账)/, why: '要求添加私人微信或私下转账' }
  ];
  var MID = [
    { re: /(优惠|折扣|返现|促销|购买链接|下单)/, why: '包含商家优惠或购买引导' },
    { re: /(https?:\/\/|扫码|二维码)/, why: '包含外部链接或二维码' }
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
    if (!post.times || !post.times.length) missing.push('活动时间未提供');
    if (!post.place || post.place.status !== 'known') missing.push('活动地点未提供');
    if (!post.capacity || post.capacity.status !== 'known') missing.push('招募人数未提供');
    if (!post.fee || post.fee.status !== 'known') missing.push('费用信息未提供');
    missing.push('学生自己发的，没人审过');

    return {
      id: post.no || '我',
      title: post.title,
      source: 'student',
      category: post.category || 'sports',
      raw: post.desc || post.title,
      times: post.times || [{ kind: 'unknown', label: '活动时间', at: null, text: '未提供' }],
      place: post.place || { status: 'unknown' },
      audience: post.audience || { text: '谁都能来', grades: ['大一', '大二', '大三', '大四'] },
      requirement: post.requirement || '未提供',
      fee: post.fee || { status: 'unknown' },
      capacity: post.capacity || { status: 'unknown' },
      signup: post.signup || { required: true, text: '按发布说明联系发起人' },
      missing: missing,
      risk: post.risk || null,
      related: [],
      tags: ['学生自发'].concat(post.authorName ? ['实名发布'] : []),
      authorLabel: post.authorName ? global.ZHUKE.account.maskName(post.authorName) : '',
      authorStudentId: post.authorStudentId || '',
      mine: true,
      postId: post.id
    };
  }

  /* ---------- 视图 ---------- */
  function formHtml() {
    var catOptions = Object.keys(DATA.categories).map(function (k) {
      return '<option value="' + k + '">' + ui.esc(DATA.categories[k]) + '</option>';
    }).join('');

    var acc = global.ZHUKE.account.current();
    var who = acc ? (acc.realName + ' · 学号 ' + global.ZHUKE.account.maskStudentId(acc.studentId)) : '未登录';

    return '' +
      '<p class="form-hint" style="margin-bottom:12px">' +
      '可发布同学自发的活动、组队与招募信息，发布后即进入发现页展示。' +
      '系统会对含「日结」「加微信」等特征字眼的内容附加风险提示，但不对信息真实性作担保，请自行核实。</p>' +

      '<div class="callout danger" style="margin-bottom:14px">' +
      '<b>发布提醒（实名制）：</b>本平台账号已绑定学号并完成实名登记，' +
      '发布内容会显示你的实名信息与学号标识，需对内容负责。' +
      '请勿发布违规、虚假、诈骗、诱导交易或与校园无关的推广内容；' +
      '一经发现，平台将立即封禁发布账号并下架相关内容，情节严重的将移送学校相关部门处理。' +
      '</div>' +

      '<div class="form-hint" style="margin-bottom:12px">当前发布账号：<b>' + ui.esc(who) + '</b></div>' +

      '<div class="field-row"><label>活动标题 *</label>' +
      '<input id="pTitle" type="text" maxlength="40" placeholder="例：周末羽毛球约球（缺 2 人）"></div>' +

      '<div class="field-row"><label>类型</label><select id="pCat">' + catOptions + '</select></div>' +

      '<div class="field-row"><label>活动时间</label>' +
      '<input id="pTime" type="datetime-local">' +
      '<label class="switch" style="margin-top:6px;font-size:12.5px;color:var(--muted)">' +
      '<input type="checkbox" id="pTimeUnknown"> 时间待定 / 待确认</label></div>' +

      '<div class="field-row"><label>活动地点</label>' +
      '<input id="pPlace" type="text" maxlength="30" placeholder="例：体育馆 3 号场（未定可留空）"></div>' +

      '<div class="field-row"><label>面向对象</label>' +
      '<input id="pWho" type="text" maxlength="30" value="面向全校学生"></div>' +

      '<div class="field-row"><label>补充说明</label>' +
      '<textarea id="pDesc" maxlength="200" placeholder="人数、费用、报名方式、需要准备什么……"></textarea></div>' +

      '<div class="field-row"><label>报名方式 / 联系方式</label>' +
      '<input id="pSignup" type="text" maxlength="40" placeholder="例：进群填表 / 评论区留言"></div>' +

      '<label class="agree-row" id="pAgreeRow">' +
      '<input type="checkbox" id="pAgree">' +
      '<span class="agree-text">我已阅读并知悉上述提醒，承诺发布内容真实、合规，' +
      '并对发布内容负责。未实名账号需先完成实名认证才能发布。</span>' +
      '</label>' +

      '<div class="form-actions">' +
      '<button class="btn primary" id="pSubmit" type="button" disabled style="opacity:.55">发布</button>' +
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
    var A = global.ZHUKE.account;

    /* 未实名账号：不展示发布表单，改为实名认证引导 */
    if (A.current() && !A.isVerified()) {
      body.innerHTML =
        '<div class="callout warn" style="margin-bottom:14px">' +
        '<b>当前账号未完成实名认证，暂不能发布内容。</b>' +
        '发布活动与招募信息前需通过学校统一身份认证完成实名核验（使用学号与「我的珠科」APP 密码），' +
        '以保证信息来源可追溯。认证通过后即可发布。</div>' +
        '<div class="form-actions"><button class="btn primary" id="goVerify" type="button">去实名认证</button></div>';
      var go = document.getElementById('goVerify');
      if (go) go.addEventListener('click', function () { ui.openVerify(); });
      return;
    }

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

    /* 实名制承诺：未勾选不允许发布 */
    var agree = document.getElementById('pAgree');
    var submitBtn = document.getElementById('pSubmit');
    agree.addEventListener('change', function () {
      submitBtn.disabled = !agree.checked;
      submitBtn.style.opacity = agree.checked ? '' : '.55';
      preview();
    });

    submitBtn.addEventListener('click', submit);
    document.getElementById('pClear').addEventListener('click', function () {
      render();
      ui.toast('表单已清空');
    });
    preview();
  }

  function preview() {
    var f = readForm();
    var agree = document.getElementById('pAgree');
    var box = document.getElementById('pPreview');
    if (!f.title && !(agree && agree.checked)) { box.textContent = ''; return; }
    var agreed = agree && agree.checked;
    var out = '';
    if (f.risk) {
      out += '<span class="badge risk">' + ui.esc(f.risk.type) + '</span> <span style="color:var(--warn)">' + ui.esc(f.risk.reason) + '</span><br>';
    } else if (f.title) {
      out += '<span class="badge t-muted">未发现明显风险特征</span> ';
    }
    if (f.title) out += '发布后将标注「学生个人发布」并展示实名信息。';
    if (!agreed) out += '<br><span style="color:var(--warn)">请先勾选上方承诺后发布。</span>';
    box.innerHTML = out;
  }

  function submit() {
    var acc = global.ZHUKE.account.current();
    if (!acc) { ui.toast('请先登录后再发布'); return; }
    if (!global.ZHUKE.account.isVerified()) {
      ui.toast('未实名账号不能发布，请先完成实名认证');
      ui.openVerify();
      return;
    }
    var agree = document.getElementById('pAgree');
    if (!agree || !agree.checked) { ui.toast('请先勾选实名发布承诺'); return; }

    var f = readForm();
    if (!f.title) { ui.toast('请填写标题'); return; }
    if (!f.desc) { ui.toast('请补充活动说明'); return; }

    /* 内容归属实名账号 */
    f.ownerId = acc.id;
    f.authorName = acc.realName;
    f.authorStudentId = acc.studentId;

    f.no = nextNo();
    var post = store.addPost(f);
    DATA.items.unshift(toItem(post));       /* 进入正常使用流程：发现页立即可见 */

    ui.setPage(1);                          /* 新内容在列表首屏，回到第 1 页 */
    global.ZHUKE.render();
    if (global.ZHUKE.mine) global.ZHUKE.mine.render();
    if (global.ZHUKE.admin) global.ZHUKE.admin.render();

    document.querySelector('.tab[data-view="discover"]').click();
    ui.toast(f.risk ? '发布成功，已标注风险提示' : '发布成功，已同步至发现页');
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
