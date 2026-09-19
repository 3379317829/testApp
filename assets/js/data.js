/* ============================================================
 * 掌上猪科 · 数据层
 * 来源：珠海科技学院计算机协会软件部 2026 年秋季纳新第二轮考核题目
 *       「四、校园活动与机会信息」表格（均为模拟信息，不代表学校真实通知）
 *
 * 编码原则（对应题面 P031–P033）：
 *   1. 只写材料里有的；材料没给的字段一律 status:'unknown'，界面显示"未提供"，绝不编造。
 *   2. 同一活动的多条通知用 related 关联，旧信息标 supersededBy，由界面提示"已变更"。
 *   3. 时间一律用完整 ISO 字符串，状态实时计算，不写死"已截止"。
 * ============================================================ */
(function (global) {
  'use strict';

  /* 来源分级：level 越大越权威，用于可信度评分 */
  var SOURCES = {
    college: { key: 'college', label: '学院发布', level: 3, desc: '学院官方渠道发布' },
    school: { key: 'school', label: '校级 / 协会', level: 3, desc: '校级部门或学生组织发布' },
    unknown: { key: 'unknown', label: '未标注主办方', level: 2, desc: '材料未写明发布方' },
    student: { key: 'student', label: '学生个人发布', level: 1, desc: '学生自主发布，未经审核' }
  };

  var CATEGORIES = {
    training: '训练营 / 集训',
    lecture: '讲座 / 分享会',
    recruit: '招募 / 组队',
    contest: '比赛 / 挑战赛',
    study: '学习小组 / 工作坊',
    volunteer: '志愿服务',
    sports: '文体 / 社交',
    resource: '学习资源'
  };

  /* 状态类别由 engine 计算；这里只描述每条信息的客观事实 */
  var ITEMS = [
    {
      id: '01',
      title: '“蓝桥杯”程序设计校内训练营',
      source: 'unknown',
      category: 'training',
      raw: '9月24日22:00报名截止；原计划9月20日起每周六19:00训练；面向全校学生；零基础可参加',
      times: [
        { kind: 'deadline', label: '报名截止', at: '2026-09-24T22:00', text: '9月24日 22:00' },
        { kind: 'start', label: '首次训练（原计划）', at: '2026-09-20T19:00', text: '9月20日起每周六 19:00', supersededBy: '09' }
      ],
      place: { status: 'unknown', text: '原通知未提供活动地点' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '零基础可参加',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '需报名' },
      missing: ['主办方未标注', '费用信息未提供', '招募人数未提供', '原通知未提供活动地点'],
      risk: null,
      related: ['09'],
      tags: ['零基础友好', '新生可参加']
    },
    {
      id: '02',
      title: 'AI应用入门公开课',
      source: 'unknown',
      category: 'lecture',
      raw: '9月19日19:00；计算机学院教学楼；面向全校学生；无需报名；预计90分钟',
      times: [
        { kind: 'start', label: '开课', at: '2026-09-19T19:00', text: '今天 19:00' },
        { kind: 'end', label: '预计结束', at: '2026-09-19T20:30', text: '约 90 分钟' }
      ],
      place: { status: 'known', text: '计算机学院教学楼（具体教室未提供）' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '无需报名',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: false, text: '无需报名' },
      missing: ['主办方未标注', '具体教室未提供'],
      risk: null,
      related: [],
      tags: ['今天', '入门课', '免报名']
    },
    {
      id: '03',
      title: '大学生创新创业项目团队招募',
      source: 'unknown',
      category: 'recruit',
      raw: '招募开发、设计、材料成员；每周需稳定投入4小时以上；9月22日18:00截止；需提交简短自我介绍',
      times: [
        { kind: 'deadline', label: '报名截止', at: '2026-09-22T18:00', text: '9月22日 18:00' }
      ],
      place: { status: 'unknown' },
      audience: { text: '招募开发 / 设计 / 材料成员（年级未限制）', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '每周需稳定投入 4 小时以上；需提交简短自我介绍',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown', text: '见 20 号补充说明：开发方向名额已满' },
      signup: { required: true, text: '需提交简短自我介绍' },
      missing: ['主办方未标注', '活动地点未提供', '线下面谈安排未提供'],
      risk: null,
      related: ['20'],
      tags: ['需投入时间']
    },
    {
      id: '04',
      title: '数学建模竞赛经验分享会',
      source: 'unknown',
      category: 'lecture',
      raw: '直播时间为9月18日19:30；不限专业；直播已结束，活动方预计9月20日上传回放',
      times: [
        { kind: 'end', label: '直播（已结束）', at: '2026-09-18T19:30', text: '9月18日 19:30（已结束）' },
        { kind: 'replay', label: '回放预计上线', at: '2026-09-20T00:00', text: '预计 9月20日上传回放', approximate: true }
      ],
      place: { status: 'known', text: '线上直播' },
      audience: { text: '不限专业', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '不限专业',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: false, text: '直播已结束，无需报名' },
      missing: ['主办方未标注', '回放观看地址未提供', '回放上线时间为预计'],
      risk: null,
      related: [],
      tags: ['已结束', '可等回放']
    },
    {
      id: '05',
      title: '校园公益志愿服务活动',
      source: 'unknown',
      category: 'volunteer',
      raw: '活动时间9月27日8:30—17:00；9月20日12:00报名截止；预计服务8小时；需提前到场签到',
      times: [
        { kind: 'deadline', label: '报名截止', at: '2026-09-20T12:00', text: '9月20日 12:00' },
        { kind: 'start', label: '活动开始', at: '2026-09-27T08:30', text: '9月27日 08:30' },
        { kind: 'end', label: '活动结束', at: '2026-09-27T17:00', text: '9月27日 17:00' }
      ],
      place: { status: 'known', text: '校区内（具体集合点未提供）' },
      audience: { text: '未限制（面向在校学生）', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '需提前到场签到；预计服务 8 小时',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '需报名，9月20日12:00截止' },
      missing: ['主办方未标注', '集合地点未提供', '招募人数未提供'],
      risk: null,
      related: [],
      tags: ['报名即将截止', '预计服务 8 小时']
    },
    {
      id: '06',
      title: 'Web开发零基础学习小组',
      source: 'unknown',
      category: 'study',
      raw: '9月23日起每周三19:30开展，共6周；面向零基础学生；限30人；报名时间未注明，满员即止',
      times: [
        { kind: 'start', label: '开班', at: '2026-09-23T19:30', text: '9月23日起每周三 19:30', approximate: false },
        { kind: 'end', label: '结课（共6周）', at: '2026-10-28T21:00', text: '共 6 周', approximate: true }
      ],
      place: { status: 'unknown' },
      audience: { text: '面向零基础学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '零基础可参加',
      fee: { status: 'unknown' },
      capacity: { status: 'known', text: '限 30 人' },
      signup: { required: true, text: '报名时间未注明，满员即止', unsure: true },
      missing: ['主办方未标注', '报名截止时间未注明，满员即止', '活动地点未提供'],
      risk: null,
      related: [],
      tags: ['零基础友好', '名额有限']
    },
    {
      id: '07',
      title: 'AI创新应用挑战赛',
      source: 'unknown',
      category: 'contest',
      raw: '2—4人组队；9月21日18:00前完成校内意向登记；10月20日提交作品；意向登记不等同于最终作品提交',
      times: [
        { kind: 'deadline', label: '校内意向登记截止', at: '2026-09-21T18:00', text: '9月21日 18:00' },
        { kind: 'deadline', label: '最终作品提交', at: '2026-10-20T23:59', text: '10月20日' }
      ],
      place: { status: 'unknown' },
      audience: { text: '2—4 人组队参加', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '2—4 人组队；注意「意向登记」不等同于最终作品提交，两步都要做',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '先校内意向登记，后提交作品（两个不同节点）' },
      missing: ['主办方未标注', '赛事地点与线上参与方式未提供', '费用信息未提供'],
      risk: null,
      related: [],
      tags: ['两个截止时间', '需组队']
    },
    {
      id: '08',
      title: '校园软件项目组招募',
      source: 'unknown',
      category: 'recruit',
      raw: '开发校园实用工具；面向大一、大二学生；希望成员了解Git基本操作；每周预计投入5小时；长期招募，满员即止',
      times: [
        { kind: 'longterm', label: '招募状态', at: null, text: '长期招募，满员即止' }
      ],
      place: { status: 'unknown' },
      audience: { text: '面向大一、大二学生', grades: ['大一', '大二'] },
      requirement: '希望成员了解 Git 基本操作；每周预计投入 5 小时',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown', text: '满员即止' },
      signup: { required: true, text: '长期招募，无明确截止时间' },
      missing: ['主办方未标注', '报名方式未提供', '报名截止时间未提供'],
      risk: null,
      related: [],
      tags: ['仅大一大二', '需 Git 基础', '长期']
    },
    {
      id: '09',
      title: '程序设计训练营补充通知',
      source: 'school',
      category: 'training',
      raw: '因场地调整，首次训练改为9月21日19:30，地点改至实验楼A402；已报名同学无需重复提交；报名截止时间不变',
      times: [
        { kind: 'start', label: '首次训练（变更后）', at: '2026-09-21T19:30', text: '9月21日 19:30' }
      ],
      place: { status: 'known', text: '实验楼 A402' },
      audience: { text: '同 01 号：面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '已报名同学无需重复提交',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: false, text: '已报名者无需重复提交' },
      missing: ['费用信息未提供', '招募人数未提供'],
      risk: null,
      related: ['01'],
      isUpdate: true,
      tags: ['变更通知', '以本条为准']
    },
    {
      id: '10',
      title: '前端开发经验交流会',
      source: 'unknown',
      category: 'lecture',
      raw: '9月19日15:00—16:30；线下A201并同步线上直播；无需报名',
      times: [
        { kind: 'start', label: '开始', at: '2026-09-19T15:00', text: '今天 15:00' },
        { kind: 'end', label: '结束', at: '2026-09-19T16:30', text: '今天 16:30' }
      ],
      place: { status: 'known', text: 'A201（同步线上直播）' },
      audience: { text: '未限制（面向在校学生）', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '无需报名',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: false, text: '无需报名' },
      missing: ['主办方未标注', '线上直播入口未提供'],
      risk: null,
      related: [],
      tags: ['今天', '免报名', '线上同步']
    },
    {
      id: '11',
      title: '大学生科研入门分享会',
      source: 'unknown',
      category: 'lecture',
      raw: '9月21日19:00—20:30；介绍论文检索、学生科研项目和导师联系方法；面向全校学生',
      times: [
        { kind: 'start', label: '开始', at: '2026-09-21T19:00', text: '9月21日 19:00' },
        { kind: 'end', label: '结束', at: '2026-09-21T20:30', text: '9月21日 20:30' }
      ],
      place: { status: 'unknown' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '材料未写明参加条件',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: null, text: '报名方式未提供' },
      missing: ['主办方未标注', '活动地点未提供', '报名要求未提供'],
      risk: null,
      related: [],
      tags: []
    },
    {
      id: '12',
      title: '全国高校计算机能力挑战赛',
      source: 'unknown',
      category: 'contest',
      raw: '面向本科生；10月5日23:59报名截止；个人参赛；具体费用信息未提供',
      times: [
        { kind: 'deadline', label: '报名截止', at: '2026-10-05T23:59', text: '10月5日 23:59' }
      ],
      place: { status: 'unknown' },
      audience: { text: '面向本科生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '个人参赛',
      fee: { status: 'unknown', text: '材料未提供费用信息' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '需报名' },
      missing: ['主办方未标注', '费用信息未提供，请以官方渠道为准', '赛程 / 比赛形式未提供'],
      risk: null,
      related: [],
      tags: ['个人参赛']
    },
    {
      id: '13',
      title: '科研助理招募',
      source: 'unknown',
      category: 'recruit',
      raw: '协助数据整理和实验工作；仅限大二及以上学生；每周预计投入6小时；9月21日截止报名',
      times: [
        { kind: 'deadline', label: '报名截止', at: '2026-09-21T23:59', text: '9月21日（具体时刻未提供）' }
      ],
      place: { status: 'unknown' },
      audience: { text: '仅限大二及以上学生', grades: ['大二', '大三', '大四'], exclusive: true },
      requirement: '每周预计投入 6 小时；协助数据整理与实验工作',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '需报名' },
      missing: ['主办方未标注', '报名截止具体时刻未提供', '工作地点未提供', '补贴信息未提供'],
      risk: null,
      related: [],
      tags: ['限大二及以上', '需投入时间']
    },
    {
      id: '14',
      title: 'Git与GitHub零基础工作坊',
      source: 'unknown',
      category: 'study',
      raw: '9月21日19:00—20:30；主要面向大一新生；限40人；需提前预约，提交报名表不代表最终录取，以审核通知为准',
      times: [
        { kind: 'start', label: '开始', at: '2026-09-21T19:00', text: '9月21日 19:00' },
        { kind: 'end', label: '结束', at: '2026-09-21T20:30', text: '9月21日 20:30' }
      ],
      place: { status: 'unknown' },
      audience: { text: '主要面向大一新生', grades: ['大一'] },
      requirement: '零基础可参加；**提交报名表不代表录取，需等待审核通知**',
      fee: { status: 'unknown' },
      capacity: { status: 'known', text: '限 40 人' },
      signup: { required: true, text: '需提前预约；提交报名表 ≠ 录取，以审核通知为准', unsure: true },
      missing: ['主办方未标注', '预约截止时间未提供', '活动地点未提供'],
      risk: null,
      related: [],
      tags: ['新生优先', '零基础友好', '名额有限', '需审核']
    },
    {
      id: '15',
      title: 'AI应用创意挑战',
      source: 'unknown',
      category: 'contest',
      raw: '9月23日23:59前提交创意方案；9月30日前提交最终作品；允许个人或团队参加；进入展示环节后可再组队',
      times: [
        { kind: 'deadline', label: '创意方案截止', at: '2026-09-23T23:59', text: '9月23日 23:59' },
        { kind: 'deadline', label: '最终作品截止', at: '2026-09-30T23:59', text: '9月30日' }
      ],
      place: { status: 'unknown' },
      audience: { text: '个人或团队均可参加', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '先提交创意方案，再提交最终作品；进入展示环节后可再组队',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '两阶段提交（创意方案 → 最终作品）' },
      missing: ['主办方未标注', '作品提交渠道未提供', '评审标准未提供'],
      risk: null,
      related: [],
      tags: ['两个截止时间', '可个人可组队']
    },
    {
      id: '16',
      title: '校园摄影志愿者招募',
      source: 'unknown',
      category: 'volunteer',
      raw: '长期招募；参与校内大型活动摄影；具体报名截止时间未注明；有摄影设备者优先但不作硬性要求',
      times: [
        { kind: 'longterm', label: '招募状态', at: null, text: '长期招募' }
      ],
      place: { status: 'unknown' },
      audience: { text: '未限制（面向在校学生）', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '有摄影设备者优先，但不作硬性要求',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '长期招募，截止时间未注明' },
      missing: ['主办方未标注', '报名截止时间未注明', '报名方式未提供'],
      risk: null,
      related: [],
      tags: ['长期']
    },
    {
      id: '17',
      title: 'Python程序设计学习资料合集',
      source: 'unknown',
      category: 'resource',
      raw: '包含课程、练习和项目案例；资料长期开放；当前网盘提取信息有效至9月22日，后续将统一更新',
      times: [
        { kind: 'deadline', label: '当前网盘提取信息有效期至', at: '2026-09-22T23:59', text: '有效至 9月22日' },
        { kind: 'longterm', label: '资料本身', at: null, text: '长期开放，后续统一更新' }
      ],
      place: { status: 'known', text: '线上网盘（链接未提供）' },
      audience: { text: '未限制（面向在校学生）', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '材料未写明参加条件',
      fee: { status: 'known', text: '材料未提及收费' },
      capacity: { status: 'unknown' },
      signup: { required: false, text: '无需报名' },
      missing: ['发布方未标注', '网盘链接未提供，提取信息可能失效'],
      risk: null,
      related: [],
      tags: ['长期开放', '网盘信息有时效']
    },
    {
      id: '18',
      title: '网络安全兴趣交流小组',
      source: 'unknown',
      category: 'study',
      raw: '首次交流时间为9月19日19:30；之后每两周开展一次；面向CTF、Web安全等方向感兴趣的学生；不限基础',
      times: [
        { kind: 'start', label: '首次交流', at: '2026-09-19T19:30', text: '今天 19:30' },
        { kind: 'longterm', label: '后续频率', at: null, text: '之后每两周一次' }
      ],
      place: { status: 'unknown' },
      audience: { text: '面向对 CTF、Web 安全等方向感兴趣的学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '不限基础',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: null, text: '报名方式未提供' },
      missing: ['主办方未标注', '交流地点未提供', '线上参与方式未提供'],
      risk: null,
      related: [],
      tags: ['今天', '零基础友好', '长期']
    },
    {
      id: '19',
      title: '学生创新项目路演观摩',
      source: 'unknown',
      category: 'lecture',
      raw: '活动时间9月20日14:30；原报名截止时间为9月18日22:00；活动方说明如现场仍有余位，可接受候补入场',
      times: [
        { kind: 'deadline', label: '报名截止（已过）', at: '2026-09-18T22:00', text: '9月18日 22:00（已过）' },
        { kind: 'start', label: '活动开始', at: '2026-09-20T14:30', text: '9月20日 14:30' }
      ],
      place: { status: 'unknown' },
      audience: { text: '未限制（面向在校学生）', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '报名已截止，但**现场若仍有余位可接受候补入场**',
      fee: { status: 'unknown' },
      capacity: { status: 'known', text: '名额有限，现场可能有余位' },
      signup: { required: true, text: '正式报名已截止，可到现场尝试候补', unsure: true },
      missing: ['主办方未标注', '活动地点未提供', '候补结果需现场确认'],
      risk: null,
      related: [],
      tags: ['可现场候补']
    },
    {
      id: '20',
      title: '创新创业项目团队补充说明',
      source: 'unknown',
      category: 'recruit',
      raw: '开发方向名额已满，现主要补充设计与材料成员；9月22日18:00截止；此前已投递者无需重复提交',
      times: [
        { kind: 'deadline', label: '报名截止', at: '2026-09-22T18:00', text: '9月22日 18:00' }
      ],
      place: { status: 'unknown' },
      audience: { text: '现主要补充设计与材料成员（开发方向名额已满）', grades: ['大一', '大二', '大三', '大四'], exclusive: true },
      requirement: '开发方向已满，仅缺设计与材料；已投递者无需重复提交',
      fee: { status: 'unknown' },
      capacity: { status: 'known', text: '开发方向名额已满' },
      signup: { required: true, text: '仅设计与材料方向可报名' },
      missing: ['发布方未标注', '活动地点未提供'],
      risk: null,
      related: ['03'],
      isUpdate: true,
      tags: ['变更通知', '以本条为准', '仅缺设计/材料']
    },
    {
      id: '21',
      title: '计算机学院AI产品设计分享会',
      source: 'college',
      category: 'lecture',
      raw: '计算机学院发布；9月20日19:00；明德楼B203；面向全校学生；无需报名，座位有限',
      times: [
        { kind: 'start', label: '开始', at: '2026-09-20T19:00', text: '9月20日 19:00' }
      ],
      place: { status: 'known', text: '明德楼 B203' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '无需报名，座位有限',
      fee: { status: 'unknown' },
      capacity: { status: 'known', text: '座位有限' },
      signup: { required: false, text: '无需报名，先到先得' },
      missing: ['结束时间未提供'],
      risk: null,
      related: [],
      tags: ['学院官方', '免报名']
    },
    {
      id: '22',
      title: '学生发起｜周末羽毛球约球',
      source: 'student',
      category: 'sports',
      raw: '学生个人发布；9月20日16:00；计划6—8人；费用AA；场地待最终确认',
      times: [
        { kind: 'start', label: '计划开球', at: '2026-09-20T16:00', text: '9月20日 16:00' }
      ],
      place: { status: 'pending', text: '场地待最终确认' },
      audience: { text: '计划 6—8 人', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '费用 AA',
      fee: { status: 'known', text: '费用 AA（具体金额未提供）' },
      capacity: { status: 'known', text: '计划 6—8 人' },
      signup: { required: true, text: '需联系发起人（联系方式未提供）' },
      missing: ['场地待最终确认', '联系方式未提供', '具体费用未提供'],
      risk: null,
      related: [],
      tags: ['学生自发', '信息待确认']
    },
    {
      id: '23',
      title: '学生发起｜AI工具交流搭子招募',
      source: 'student',
      category: 'sports',
      raw: '学生个人发布；拟于9月21日晚开展；欢迎零基础；报名后拉群；具体活动地点未确定',
      times: [
        { kind: 'start', label: '拟开展时间', at: '2026-09-21T19:00', text: '拟于 9月21日晚（具体时间未确定）', approximate: true }
      ],
      place: { status: 'pending', text: '具体活动地点未确定' },
      audience: { text: '欢迎零基础', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '欢迎零基础；报名后拉群',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '报名后拉群（报名入口未提供）' },
      missing: ['具体时间未确定', '活动地点未确定', '报名方式未提供'],
      risk: null,
      related: [],
      tags: ['学生自发', '零基础友好', '信息待确认']
    },
    {
      id: '24',
      title: '学生发起｜“校园兼职福利分享”（小心）',
      source: 'student',
      category: 'recruit',
      raw: '学生个人发布；称“零门槛、日结”，要求添加私人微信获取详情；未提供主办方、地点和完整内容',
      times: [
        { kind: 'unknown', label: '活动时间', at: null, text: '未提供' }
      ],
      place: { status: 'unknown' },
      audience: { text: '未提供', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '未提供',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: true, text: '要求添加私人微信获取详情' },
      missing: ['主办方未标注', '活动时间未提供', '活动地点未提供', '完整内容未提供'],
      risk: {
        level: 'high',
        type: '疑似风险信息',
        reason: '该信息以“零门槛、日结”为宣传点，要求添加私人微信获取详情，未提供主办方、活动地点及具体内容，存在兼职诈骗与个人信息泄露风险。请勿先行转账，或提供身份证、银行卡、验证码等敏感信息。'
      },
      related: [],
      tags: ['高风险提示', '建议核实']
    },
    {
      id: '25',
      title: '学生发起｜数码新品体验交流',
      source: 'student',
      category: 'resource',
      raw: '学生个人发布；标题为技术交流，正文主要介绍某商家优惠及购买链接；活动时间、活动地点未提供',
      times: [
        { kind: 'unknown', label: '活动时间', at: null, text: '未注明' }
      ],
      place: { status: 'unknown' },
      audience: { text: '未提供', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '未提供',
      fee: { status: 'unknown' },
      capacity: { status: 'unknown' },
      signup: { required: false, text: '未注明' },
      missing: ['活动时间未提供', '活动地点未提供', '主办方未标注'],
      risk: {
        level: 'medium',
        type: '疑似推广内容',
        reason: '标题为技术交流，正文主要为某商家优惠及购买链接，与校园活动关联较弱，疑似商业推广。请在点击链接与付款前自行核实。'
      },
      related: [],
      tags: ['疑似推广', '建议核实']
    },
    {
      id: '26',
      title: '外国语学院校园语言角',
      source: 'college',
      category: 'sports',
      raw: '外国语学院发布；9月21日15:00；面向全校学生；自由交流；场地容量有限，无需提前报名',
      times: [
        { kind: 'start', label: '开始', at: '2026-09-21T15:00', text: '9月21日 15:00' }
      ],
      place: { status: 'known', text: '外国语学院场地（具体位置未提供）' },
      audience: { text: '面向全校学生', grades: ['大一', '大二', '大三', '大四'] },
      requirement: '自由交流，无需提前报名',
      fee: { status: 'unknown' },
      capacity: { status: 'known', text: '场地容量有限' },
      signup: { required: false, text: '无需提前报名，容量有限' },
      missing: ['具体场地位置未提供', '结束时间未提供'],
      risk: null,
      related: [],
      tags: ['学院官方', '免报名']
    }
  ];

  global.ZHUKE_DATA = {
    meta: {
      appName: '掌上猪科',
      examDate: '2026-09-19',
      examTitle: '计算机协会软件部 2026 年秋季纳新第二轮考核 · AI Agent 产品实战',
      dataNote: '以下信息来自考核题目所给的模拟材料，不代表珠海科技学院真实通知。',
      collectedAt: '2026-09-19'
    },
    sources: SOURCES,
    categories: CATEGORIES,
    items: ITEMS
  };
})(window);
