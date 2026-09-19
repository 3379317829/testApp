/* ============================================================
 * 掌上猪科 · 状态引擎
 * 职责：
 *   1. 状态判定：以「当前时间」实时计算每条信息的真实状态，不写死任何状态文案
 *   2. 排序与筛选：按紧迫度排序，支持快速筛选 / 分类 / 来源 / 搜索
 *   3. 可信度评分（自主设计功能 A）：来源层级 + 字段完整度 + 可疑特征
 *   4. 资格适配（自主设计功能 B）：把隐含门槛变成「符合 / 不符合 / 待确认」
 *   5. 变更合并（自主设计功能 C）：识别同一活动的原通知与补充通知
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.ZHUKE_DATA;
  var DAY = 86400000;

  /* 状态定义：label 是给用户看的，tone 决定徽章配色 */
  var STATUS = {
    ongoing: { key: 'ongoing', label: '正在进行', tone: 'live', rank: 0 },
    today: { key: 'today', label: '今天开始', tone: 'today', rank: 1 },
    soon: { key: 'soon', label: '即将截止', tone: 'urgent', rank: 2 },
    open: { key: 'open', label: '还在报名', tone: 'open', rank: 3 },
    waitlist: { key: 'waitlist', label: '报名截止，可候补', tone: 'soft', rank: 4 },
    upcoming: { key: 'upcoming', label: '即将开始', tone: 'open', rank: 5 },
    longterm: { key: 'longterm', label: '长期有效', tone: 'soft', rank: 6 },
    replay: { key: 'replay', label: '已结束 · 待回放', tone: 'soft', rank: 7 },
    unknown: { key: 'unknown', label: '没写时间', tone: 'muted', rank: 8 },
    closed: { key: 'closed', label: '报名已截止', tone: 'muted', rank: 9 },
    ended: { key: 'ended', label: '已结束', tone: 'muted', rank: 10 }
  };

  var GRADE_ORDER = ['大一', '大二', '大三', '大四'];

  /* ---------------- 基础工具 ---------------- */

  function parse(iso) {
    if (!iso) return null;
    var t = new Date(iso).getTime();
    return isNaN(t) ? null : t;
  }

  function sameDay(a, b) {
    var x = new Date(a), y = new Date(b);
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmt(iso) {
    var t = parse(iso);
    if (t === null) return '';
    var d = new Date(t);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 人类可读的相对时间：还有 3 小时 20 分 / 已过 2 天 */
  function humanGap(ms) {
    var abs = Math.abs(ms);
    var days = Math.floor(abs / DAY);
    var hours = Math.floor((abs % DAY) / 3600000);
    var mins = Math.round((abs % 3600000) / 60000);
    var out;
    if (days > 0) out = days + ' 天' + (hours > 0 ? ' ' + hours + ' 小时' : '');
    else if (hours > 0) out = hours + ' 小时' + (mins > 0 ? ' ' + mins + ' 分' : '');
    else out = Math.max(mins, 1) + ' 分钟';
    return (ms >= 0 ? '还有 ' : '已过 ') + out;
  }

  /* ---------------- 时间归类 ---------------- */

  function collect(item) {
    var out = { deadlines: [], starts: [], ends: [], replays: [], longterm: null, unknownTime: false };
    (item.times || []).forEach(function (t) {
      var at = parse(t.at);
      if (t.kind === 'longterm') { out.longterm = t; return; }
      if (t.kind === 'unknown' || at === null) { out.unknownTime = true; return; }
      if (t.kind === 'deadline') out.deadlines.push({ at: at, t: t });
      else if (t.kind === 'start') out.starts.push({ at: at, t: t });
      else if (t.kind === 'end') out.ends.push({ at: at, t: t });
      else if (t.kind === 'replay') out.replays.push({ at: at, t: t });
    });
    out.deadlines.sort(function (a, b) { return a.at - b.at; });
    out.starts.sort(function (a, b) { return a.at - b.at; });
    out.ends.sort(function (a, b) { return a.at - b.at; });
    out.replays.sort(function (a, b) { return a.at - b.at; });
    return out;
  }

  /** 状态判定：优先级 进行中 > 今天 > 截止紧迫度 > 待定/长期/已结束 */
  function statusOf(item, now) {
    now = now || Date.now();
    var c = collect(item);

    /* 1) 正在进行：开始时间已到，结束时间未到（没有结束时间则假定持续 4 小时） */
    for (var i = 0; i < c.starts.length; i++) {
      var s = c.starts[i].at;
      var end = c.ends.length ? c.ends[c.ends.length - 1].at : s + 4 * 3600000;
      if (s <= now && now <= end) {
        return Object.assign({}, STATUS.ongoing, {
          detail: '正在进行，' + (c.ends.length ? '预计 ' + fmt(c.ends[c.ends.length - 1].t.at) + ' 结束' : '没说几点结束')
        });
      }
    }

    /* 2) 今天开始（尚未到点） */
    for (var j = 0; j < c.starts.length; j++) {
      if (sameDay(c.starts[j].at, now) && c.starts[j].at > now) {
        return Object.assign({}, STATUS.today, {
          detail: fmt(c.starts[j].t.at) + ' 开始 · ' + humanGap(c.starts[j].at - now),
          nextAt: c.starts[j].at
        });
      }
    }

    /* 3) 报名 / 有效期类截止时间 */
    var futureDl = c.deadlines.filter(function (d) { return d.at > now; });
    if (futureDl.length) {
      var d0 = futureDl[0];
      var gap = d0.at - now;
      var base = gap <= DAY ? STATUS.soon : STATUS.open;
      return Object.assign({}, base, {
        detail: d0.t.label + '｜' + fmt(d0.t.at) + ' · ' + humanGap(gap),
        nextAt: d0.at
      });
    }

    /* 4) 截止时间已过：判断是否还有机会 */
    if (c.deadlines.length) {
      var futureStart = c.starts.filter(function (s) { return s.at > now; })[0];
      if (item.signup && item.signup.unsure && futureStart) {
        return Object.assign({}, STATUS.waitlist, {
          detail: '报名 ' + fmt(c.deadlines[0].t.at) + ' 就截止了，' + (item.requirement.indexOf('候补') > -1 ? '但可以到现场碰碰运气' : '后面有新通知再看')
        });
      }
      if (futureStart) {
        return Object.assign({}, STATUS.closed, {
          detail: '报名关了，活动 ' + fmt(futureStart.t.at) + ' 才开始'
        });
      }
      return Object.assign({}, STATUS.ended, { detail: '报名和活动都结束了' });
    }

    /* 5) 无截止时间 */
    var futureS = c.starts.filter(function (s) { return s.at > now; })[0];
    if (futureS) {
      return Object.assign({}, STATUS.upcoming, {
        detail: fmt(futureS.t.at) + ' 开始 · ' + humanGap(futureS.at - now),
        nextAt: futureS.at
      });
    }

    /* 6) 回放：活动已结束但回放未上线 */
    var futureR = c.replays.filter(function (r) { return r.at > now; })[0];
    if (futureR) {
      return Object.assign({}, STATUS.replay, {
        detail: futureR.t.text + '（预计，以活动方通知为准）',
        nextAt: futureR.at
      });
    }

    /* 7) 长期有效 */
    if (c.longterm) {
      return Object.assign({}, STATUS.longterm, { detail: c.longterm.text });
    }

    /* 8) 时间未提供 */
    if (c.unknownTime || !c.starts.length) {
      return Object.assign({}, STATUS.unknown, { detail: '材料里没写时间，具体得问发布方' });
    }

    return Object.assign({}, STATUS.ended, { detail: '活动已经结束了' });
  }

  /* ---------------- 可信度评分（自主设计功能 A） ---------------- */

  var FIELD_LABEL = {
    time: '时间',
    place: '地点',
    audience: '适用对象',
    signup: '报名方式',
    fee: '费用',
    capacity: '名额',
    source: '发布方'
  };

  function scoreOf(item) {
    var src = DATA.sources[item.source] || DATA.sources.unknown;
    var base = src.level >= 3 ? 50 : (src.level === 2 ? 42 : 20);

    var checks = {
      time: (item.times || []).some(function (t) { return !!t.at; }),
      place: item.place && item.place.status === 'known',
      audience: !!(item.audience && item.audience.text && item.audience.text !== '未提供'),
      signup: !!(item.signup && item.signup.text && item.signup.required !== null),
      fee: !!(item.fee && item.fee.status === 'known'),
      capacity: !!(item.capacity && item.capacity.status === 'known'),
      source: item.source && item.source !== 'unknown'
    };

    var points = 0;
    var lack = [];
    Object.keys(checks).forEach(function (k) {
      if (checks[k]) points += 7.15;
      else lack.push(FIELD_LABEL[k]);
    });

    var score = Math.round(base + Math.min(points, 50));
    score -= Math.min((item.missing || []).length * 2, 8);

    if (item.risk && item.risk.level === 'high') score -= 25;
    else if (item.risk && item.risk.level === 'medium') score -= 12;

    score = Math.max(5, Math.min(100, score));

    var level, label;
    if (score >= 85) { level = 'high'; label = '写得挺全'; }
    else if (score >= 60) { level = 'mid'; label = '信息还算全'; }
    else if (score >= 40) { level = 'low'; label = '信息有点少'; }
    else { level = 'risk'; label = '先别太当真'; }

    /* 待确认项：场地待定、报名待审核、时间模糊等 */
    var pending = [];
    if (item.place && item.place.status === 'pending') pending.push('地点还没定下来');
    if (item.signup && item.signup.unsure) pending.push('报名之后还要等审核通知');
    (item.times || []).forEach(function (t) { if (t.approximate) pending.push('时间说得比较含糊'); });

    return {
      score: score,
      level: level,
      label: label,
      lack: lack,
      pending: pending,
      source: src
    };
  }

  /* ---------------- 资格适配（自主设计功能 B） ---------------- */

  function eligibilityOf(item, profile) {
    var reasons = [];
    var ok = 'yes';
    var grades = (item.audience && item.audience.grades) || [];
    var grade = profile.grade || '大一';

    if (grades.length && grades.indexOf(grade) === -1) {
      ok = 'no';
      reasons.push('材料写明面向 ' + grades.join(' / ') + '，你是' + grade);
    } else if (grades.length && grades.length < 4) {
      if (ok !== 'no') ok = 'maybe';
      reasons.push('面向 ' + grades.join(' / '));
    }

    var req = (item.requirement || '') + ' ' + ((item.audience && item.audience.text) || '');
    if (/Git/i.test(req) && profile.level === '零基础') {
      if (ok !== 'no') ok = 'maybe';
      reasons.push('希望成员了解 Git 基本操作，你是零基础');
    }

    var m = req.match(/每周[^0-9]{0,6}(\d+)\s*小时/);
    if (m) {
      var need = parseInt(m[1], 10);
      if (need > (profile.hours || 0)) {
        if (ok !== 'no') ok = 'maybe';
        reasons.push('需要每周投入约 ' + need + ' 小时，你填的是 ' + profile.hours + ' 小时');
      } else {
        reasons.push('每周投入要求 ' + need + ' 小时，你可以满足');
      }
    }

    if (item.capacity && /限|有限|满员/.test(item.capacity.text || '') && ok === 'yes') {
      ok = 'maybe';
      reasons.push(item.capacity.text);
    }

    var label = ok === 'yes' ? '符合条件' : (ok === 'no' ? '你不符合' : '需进一步确认');
    return { ok: ok, label: label, reasons: reasons };
  }

  /* ---------------- 关联通知合并（自主设计功能 C） ---------------- */

  /** 找出与 item 关联的其它条目（双向），并汇总"已变更"的点 */
  function relatedOf(item, all) {
    var ids = (item.related || []).slice();
    all.forEach(function (o) {
      if (o.id !== item.id && (o.related || []).indexOf(item.id) > -1 && ids.indexOf(o.id) === -1) ids.push(o.id);
    });
    var list = ids.map(function (id) {
      return all.filter(function (o) { return o.id === id; })[0];
    }).filter(Boolean);

    /* 变更点：把被 supersededBy 指向的原始时间，与更新通知里的新时间做对照 */
    var changes = [];
    list.forEach(function (o) {
      if (!o.isUpdate) return;
      var oldTimes = (item.times || []).filter(function (t) { return t.supersededBy === o.id; });
      var newTimes = (o.times || []).filter(function (t) { return !!t.at; });
      if (oldTimes.length && newTimes.length) {
        changes.push({
          field: '时间',
          from: oldTimes[0].text,
          to: newTimes[0].text,
          updateId: o.id,
          reason: o.raw
        });
      }
      var oldPlace = (item.place && item.place.status === 'known') ? item.place.text : null;
      if (o.place && o.place.status === 'known' && oldPlace !== o.place.text) {
        changes.push({ field: '地点', from: oldPlace || '原来的通知里没说', to: o.place.text, updateId: o.id });
      }
      if (o.capacity && /满/.test(o.capacity.text || '')) {
        changes.push({ field: '名额', from: '原通知未限制', to: o.capacity.text, updateId: o.id });
      }
    });
    return { list: list, changes: changes };
  }

  /* ---------------- 筛选 / 搜索 / 排序 ---------------- */

  function quickMatch(item, quick, now) {
    var st = statusOf(item, now);
    var sc = scoreOf(item);
    switch (quick) {
      case 'today':
        return st.key === 'today' || st.key === 'ongoing';
      case 'soon':
        return st.key === 'soon';
      case 'week':
        return !!st.nextAt && st.nextAt - now <= 7 * DAY;
      case 'zero':
        return (item.tags || []).indexOf('零基础友好') > -1 || /零基础/.test(item.requirement || '');
      case 'newbie':
        return (item.tags || []).some(function (t) { return t === '新生可参加' || t === '新生优先'; }) ||
               ((item.audience && item.audience.grades || []).indexOf('大一') > -1);
      case 'trust':
        return sc.score >= 60 && (!item.risk);
      case 'stock':
        return item.source === 'student';
      default:
        return true;
    }
  }

  function filter(list, opt, now) {
    opt = opt || {};
    now = now || Date.now();
    var q = (opt.q || '').trim().toLowerCase();
    return list.filter(function (item) {
      if (opt.cat && item.category !== opt.cat) return false;
      if (opt.src && item.source !== opt.src) return false;
      if (opt.quick && !quickMatch(item, opt.quick, now)) return false;
      if (opt.fit && opt.profile && eligibilityOf(item, opt.profile).ok === 'no') return false;
      if (q) {
        var hay = [item.title, item.raw, (item.tags || []).join(' '), item.requirement || ''].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function sort(list, now) {
    now = now || Date.now();
    return list.slice().sort(function (a, b) {
      var sa = statusOf(a, now), sb = statusOf(b, now);
      if (sa.rank !== sb.rank) return sa.rank - sb.rank;
      var na = sa.nextAt || Infinity, nb = sb.nextAt || Infinity;
      if (na !== nb) return na - nb;
      return a.id.localeCompare(b.id);
    });
  }

  function decorate(item, now, profile, all) {
    var st = statusOf(item, now);
    var sc = scoreOf(item);
    return Object.assign({}, item, {
      status: st,
      trust: sc,
      eligibility: profile ? eligibilityOf(item, profile) : null,
      relatedInfo: all ? relatedOf(item, all) : { list: [], changes: [] },
      sourceInfo: DATA.sources[item.source] || DATA.sources.unknown,
      categoryLabel: DATA.categories[item.category] || item.category
    });
  }

  function statsOf(list, now) {
    now = now || Date.now();
    var s = { total: list.length, live: 0, today: 0, soon: 0, waitlist: 0, risk: 0 };
    list.forEach(function (i) {
      var k = statusOf(i, now).key;
      if (k === 'ongoing') s.live++;
      if (k === 'today') s.today++;
      if (k === 'soon') s.soon++;
      if (k === 'waitlist') s.waitlist++;
      if (i.risk) s.risk++;
    });
    return s;
  }

  var engine = {
    STATUS: STATUS,
    parse: parse,
    fmt: fmt,
    humanGap: humanGap,
    statusOf: statusOf,
    scoreOf: scoreOf,
    eligibilityOf: eligibilityOf,
    relatedOf: relatedOf,
    filter: filter,
    sort: sort,
    decorate: decorate,
    statsOf: statsOf,
    quickMatch: quickMatch,
    GRADE_ORDER: GRADE_ORDER,

    /** 全量诊断：列出 26 条的状态与评分，用于自检与 README 说明 */
    audit: function (now) {
      now = now || Date.now();
      return DATA.items.map(function (i) {
        var st = statusOf(i, now), sc = scoreOf(i);
        return [i.id, i.title, st.label, st.detail || '', sc.score + '分/' + sc.label,
          (i.missing || []).length + '项缺失', i.risk ? '风险:' + i.risk.type : ''].join(' | ');
      });
    }
  };

  global.ZHUKE = global.ZHUKE || {};
  global.ZHUKE.engine = engine;
})(window);
