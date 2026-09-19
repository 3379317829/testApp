/* ============================================================
 * 掌上猪科 · 账号体系（本地演示）
 * 规则：
 *   1. 账号绑定学号，采用实名制：每个账号必须有真实姓名与学号，学号唯一
 *   2. 角色分「管理员 / 学生」，管理员可进入后台管理账号与内容
 *   3. 账号状态分「正常 / 已封禁」，封禁后无法登录
 *   4. 所有数据保存在浏览器本地，仅用于功能演示，不做真实身份校验
 * ============================================================ */
(function (global) {
  'use strict';

  var store = global.ZHUKE.store;

  var ROLES = {
    admin: { key: 'admin', label: '管理员' },
    student: { key: 'student', label: '学生' }
  };

  var STATUS = {
    active: { key: 'active', label: '正常', tone: 'open' },
    banned: { key: 'banned', label: '已封禁', tone: 'urgent' }
  };

  /* 实名状态：未实名账号不得发布活动、不得参加活动 */
  var VERIFY = {
    yes: { key: 'yes', label: '已实名', tone: 'open' },
    no: { key: 'no', label: '未实名', tone: 'warn' }
  };

  /* ---------- 演示种子数据 ---------- */
  var SEED_ACCOUNTS = [
    {
      id: 'acc-admin', username: 'admin', password: 'admin123',
      realName: '系统管理员', studentId: '00000000', role: 'admin',
      status: 'active', verified: true, createdAt: '2026-09-19T08:00:00.000Z', seed: true
    },
    {
      id: 'acc-demo', username: 'zhuke', password: '123456',
      realName: '林晓', studentId: '20260101', role: 'student',
      status: 'active', verified: true, createdAt: '2026-09-19T08:00:00.000Z', seed: true
    },
    {
      /* 未实名演示账号：未完成实名认证，不能发布与参加活动 */
      id: 'acc-newbie', username: 'newbie', password: '123456',
      realName: '', studentId: '20260315', role: 'student',
      status: 'active', verified: false, createdAt: '2026-09-19T08:00:00.000Z', seed: true
    }
  ];

  /* 模拟服务端返回的实名信息来源：真实接入后由学校统一身份认证服务返回。
     这里覆盖内置演示账号；其余学号从姓名池中按学号确定性地取一个，保证结果稳定。 */
  var MOCK_IDENTITY = {
    '00000000': '系统管理员',
    '20260101': '林晓',
    '20260315': '周雨桐'
  };
  var MOCK_NAME_POOL = ['林晓', '陈志远', '周雨桐', '黄嘉禾', '苏子墨', '郑一诺', '何思远', '罗嘉言'];

  var SEED_POSTS = [
    {
      id: 'seed-post-1', ownerId: 'acc-demo', mine: true,
      authorName: '林晓', authorStudentId: '20260101',
      title: '周末图书馆自习搭子（缺 2 人）',
      category: 'sports',
      desc: '周六上午 9 点在图书馆三楼中庭集合，一起复习高数，晚上可以一起去食堂。',
      times: [{ kind: 'start', label: '活动开始', at: '2026-09-20T09:00', text: '9月20日 09:00' }],
      timeText: '9月20日 09:00',
      place: { status: 'known', text: '图书馆三楼中庭' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '带上自己的复习资料就行',
      signup: { required: true, text: '在评论区留言', unsure: true },
      risk: null, related: [],
      createdAt: '2026-09-19T08:10:00.000Z'
    },
    {
      id: 'seed-post-2', ownerId: 'acc-demo', mine: true,
      authorName: '林晓', authorStudentId: '20260101',
      title: '代取快递 + 日结兼职，加私人微信详聊',
      category: 'recruit',
      desc: '零门槛日结，一天两百，需要先交 50 元押金，感兴趣加私人微信获取详情。',
      times: [{ kind: 'unknown', label: '活动时间', at: null, text: '未提供' }],
      timeText: '时间待定',
      place: { status: 'unknown' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '见补充说明',
      signup: { required: true, text: '加私人微信', unsure: true },
      risk: {
        level: 'high', type: '疑似风险信息',
        reason: '出现"日结""押金""加私人微信"等特征，存在兼职诈骗风险，请勿先行转账。'
      },
      related: [],
      createdAt: '2026-09-19T08:20:00.000Z'
    }
  ];

  /* ---------- 基础工具 ---------- */
  function uid(prefix) {
    return (prefix || 'acc') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function maskName(name) {
    if (!name) return '未实名';
    if (name.length <= 1) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  }

  function maskStudentId(id) {
    if (!id || id.length < 4) return id || '—';
    return id.slice(0, 4) + '*'.repeat(Math.max(id.length - 8, 0)) + id.slice(-4);
  }

  /** 兼容早期数据：没有 verified 字段的账号，按是否已有真实姓名判定 */
  function normalize(acc) {
    if (acc.verified === undefined) acc.verified = !!acc.realName;
    return acc;
  }

  /* ---------- 账户读写 ---------- */
  function ensureSeed() {
    var s = store.all();
    if (!s.accounts || !s.accounts.length) {
      s.accounts = JSON.parse(JSON.stringify(SEED_ACCOUNTS));
      var existIds = (s.mine || []).map(function (p) { return p.id; });
      SEED_POSTS.forEach(function (p) {
        if (existIds.indexOf(p.id) === -1) s.mine.push(JSON.parse(JSON.stringify(p)));
      });
      store.save();
    }
  }

  function rawAccounts() {
    ensureSeed();
    return store.all().accounts;
  }

  function byId(id) {
    var acc = rawAccounts().filter(function (a) { return a.id === id; })[0] || null;
    return acc ? normalize(acc) : null;
  }

  function byUsername(username) {
    var u = String(username || '').trim().toLowerCase();
    return rawAccounts().filter(function (a) { return a.username.toLowerCase() === u; })[0] || null;
  }

  /** 登录标识：优先按学号匹配，未绑定学号的账号回退到账号名 */
  function byLogin(name) {
    var key = String(name || '').trim();
    if (!key) return null;
    var list = rawAccounts();
    var hit = list.filter(function (a) { return a.studentId && a.studentId === key; })[0];
    if (hit) return hit;
    return list.filter(function (a) { return a.username.toLowerCase() === key.toLowerCase(); })[0] || null;
  }

  function postCount(accountId) {
    return (store.all().mine || []).filter(function (p) { return p.ownerId === accountId; }).length;
  }

  /* ---------- 校验 ---------- */
  function validate(payload, ignoreId) {
    var errors = [];
    var username = String(payload.username || '').trim();
    var realName = String(payload.realName || '').trim();
    var studentId = String(payload.studentId || '').trim();
    var password = String(payload.password || '');

    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) errors.push('用户名需 3—16 位字母、数字或下划线');
    if (!/^[\u4e00-\u9fa5·]{2,10}$/.test(realName)) errors.push('请填写 2—10 位中文真实姓名');
    if (!/^\d{6,14}$/.test(studentId)) errors.push('学号需 6—14 位数字');
    if (password.length < 6) errors.push('密码至少 6 位');

    var dupU = byUsername(username);
    if (dupU && dupU.id !== ignoreId) errors.push('该用户名已被占用');
    var dupS = rawAccounts().filter(function (a) { return a.studentId === studentId && a.id !== ignoreId; })[0];
    if (dupS) errors.push('该学号已注册过账号（实名制下一人一号）');

    return errors;
  }

  /* ---------- 对外接口 ---------- */
  var account = {
    ROLES: ROLES,
    STATUS: STATUS,
    VERIFY: VERIFY,
    ensureSeed: ensureSeed,
    maskName: maskName,
    maskStudentId: maskStudentId,
    validate: validate,
    postCount: postCount,
    byId: byId,
    byUsername: byUsername,

    list: function () {
      return rawAccounts().slice();
    },

    /** 登录：校验用户名、密码与状态 */
    login: function (account, password) {
      var acc = byLogin(account);
      /* 账号不存在与密码错误给同一提示，避免暴露学号是否已注册 */
      if (!acc) return { ok: false, message: '账号或密码错误' };
      if (acc.password !== String(password)) return { ok: false, message: '账号或密码错误' };
      if (acc.status === 'banned') return { ok: false, message: '该账号已被封禁，无法登录' };
      var s = store.all();
      s.session = { accountId: acc.id, at: new Date().toISOString() };
      store.save();
      return { ok: true, account: acc };
    },

    logout: function () {
      var s = store.all();
      s.session = { accountId: null };
      store.save();
    },

    current: function () {
      var s = store.all();
      if (!s.session || !s.session.accountId) return null;
      var acc = byId(s.session.accountId);
      if (!acc || acc.status === 'banned') return null;
      return acc;
    },

    isAdmin: function () {
      var cur = account.current();
      return !!cur && cur.role === 'admin';
    },

    /** 当前账号是否已完成实名认证 */
    isVerified: function () {
      var cur = account.current();
      return !!cur && cur.verified !== false;
    },

    /** 账号的实名状态（用于展示「已实名 / 未实名」） */
    verifyStatusOf: function (acc) {
      return (acc && acc.verified) ? VERIFY.yes : VERIFY.no;
    },

    /** 提交实名认证：未实名账号在此绑定真实姓名与学号，学号需唯一 */
    verify: function (payload) {
      var cur = account.current();
      if (!cur) return { ok: false, errors: ['登录状态已失效，请重新登录'] };
      var realName = String(payload.realName || '').trim();
      var studentId = String(payload.studentId || '').trim();
      var errors = [];
      if (!/^[\u4e00-\u9fa5·]{2,10}$/.test(realName)) errors.push('请填写 2—10 位中文真实姓名');
      if (!/^\d{6,14}$/.test(studentId)) errors.push('学号需 6—14 位数字');
      var dup = rawAccounts().filter(function (a) {
        return a.studentId === studentId && a.id !== cur.id;
      })[0];
      if (dup) errors.push('该学号已被其他账号绑定（实名制下一人一号）');
      if (errors.length) return { ok: false, errors: errors };

      cur.realName = realName;
      cur.studentId = studentId;
      cur.verified = true;
      cur.verifiedAt = new Date().toISOString();
      store.save();
      return { ok: true, account: cur };
    },

    /* ---------- 学校统一身份认证：获取实名信息（当前为本地模拟，保留服务端接口形态） ----------
     * 登录环节已使用学号 +「我的珠科」APP 密码完成，本接口只负责换取实名信息。
     * 正式接入时前端只做一件事：
     *   POST {AUTH_ENDPOINT}/identity  { studentId, password }
     * 由服务端向学校统一身份认证服务核验，返回：
     *   成功 { ok: true, name, studentId }   失败 { ok: false, message }
     * 密码只过一次网络，不在前端留存、不写入本地存储；姓名等实名信息一律以服务端返回为准。
     * 当前版本未接入该服务，以下用本地规则模拟服务端返回结果。
     * ----------------------------------------------------------------------------------- */
    fetchIdentity: function () {
      var cur = account.current();
      if (!cur) return { ok: false, errors: ['登录状态已失效，请重新登录'] };

      var studentId = String(cur.studentId || '').trim();
      if (!/^\d{6,14}$/.test(studentId)) {
        return { ok: false, errors: ['当前账号未绑定有效学号，无法发起身份核验'] };
      }

      var dup = rawAccounts().filter(function (a) {
        return a.studentId === studentId && a.id !== cur.id;
      })[0];
      if (dup) return { ok: false, errors: ['该学号已被其他账号绑定（实名制下一人一号）'] };

      /* ↓↓↓ 模拟服务端返回，接入学校统一身份认证后整段删除 ↓↓↓ */
      var sum = studentId.split('').reduce(function (s, c) { return s + (Number(c) || 0); }, 0);
      var name = MOCK_IDENTITY[studentId] || MOCK_NAME_POOL[sum % MOCK_NAME_POOL.length];
      /* ↑↑↑ 模拟结束 ↑↑↑ */

      return { ok: true, source: 'mock', data: { studentId: studentId, name: name } };
    },

    /** 新增账号（仅管理员可用，界面侧限制入口） */
    create: function (payload) {
      var errors = validate(payload);
      if (errors.length) return { ok: false, errors: errors };
      var acc = {
        id: uid(),
        username: String(payload.username).trim(),
        password: String(payload.password),
        realName: String(payload.realName).trim(),
        studentId: String(payload.studentId).trim(),
        role: payload.role === 'admin' ? 'admin' : 'student',
        status: 'active',
        verified: true,   /* 后台新增账号时已录入真实姓名与学号，视为已实名 */
        createdAt: new Date().toISOString()
      };
      var s = store.all();
      s.accounts.push(acc);
      store.save();
      return { ok: true, account: acc };
    },

    /** 封禁 / 解封 */
    setStatus: function (id, status, reason) {
      var acc = byId(id);
      if (!acc) return { ok: false, message: '账号不存在' };
      if (acc.id === (store.all().session || {}).accountId && status === 'banned') {
        return { ok: false, message: '不能封禁当前登录的账号' };
      }
      acc.status = status;
      acc.banReason = status === 'banned' ? (reason || '违反平台规范') : null;
      acc.statusChangedAt = new Date().toISOString();
      store.save();
      return { ok: true, account: acc };
    },

    /** 删除账号：同时移除该账号发布的全部内容 */
    remove: function (id) {
      var acc = byId(id);
      if (!acc) return { ok: false, message: '账号不存在' };
      if (acc.id === (store.all().session || {}).accountId) {
        return { ok: false, message: '不能删除当前登录的账号' };
      }
      var s = store.all();
      var before = s.mine.length;
      s.accounts = s.accounts.filter(function (a) { return a.id !== id; });
      s.mine = s.mine.filter(function (p) { return p.ownerId !== id; });
      s.favorites = s.favorites; /* 收藏与被删账号无关，保持不变 */
      store.save();
      return { ok: true, removedPosts: before - s.mine.length };
    },

    /** 某个账号发布的内容 */
    postsOf: function (accountId) {
      return (store.all().mine || []).filter(function (p) { return p.ownerId === accountId; });
    },

    /** 管理员下架单条内容 */
    removePost: function (postId) {
      var s = store.all();
      var hit = (s.mine || []).filter(function (p) { return p.id === postId; })[0];
      s.mine = (s.mine || []).filter(function (p) { return p.id !== postId; });
      store.save();
      return !!hit;
    },

    stats: function () {
      var list = rawAccounts();
      var posts = store.all().mine || [];
      return {
        total: list.length,
        admins: list.filter(function (a) { return a.role === 'admin'; }).length,
        banned: list.filter(function (a) { return a.status === 'banned'; }).length,
        posts: posts.length,
        riskyPosts: posts.filter(function (p) { return !!p.risk; }).length
      };
    }
  };

  global.ZHUKE = global.ZHUKE || {};
  global.ZHUKE.account = account;
})(window);
