/* ============================================================
 * 掌上猪科 · 本地持久化层
 * 对应题目要求 6：重要的用户操作结果在刷新或重新打开后应能够合理保留
 * 存储项：收藏 / 报名记录 / 我的发布 / 个人设置（年级、基础、每周可投入时间）
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'zhuke.v1';

  var DEFAULT_STATE = {
    favorites: [],   // [id]
    joined: {},      // { id: 'signed' | 'waitlist' | 'reviewing' }
    mine: [],        // [自建活动对象]
    profile: {
      grade: '大一',
      level: '零基础',
      hours: 4
    },
    onboarded: false
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function read() {
    var state = clone(DEFAULT_STATE);
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return state;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        Object.keys(state).forEach(function (k) {
          if (saved[k] !== undefined && saved[k] !== null) state[k] = saved[k];
        });
        if (state.profile) {
          Object.keys(DEFAULT_STATE.profile).forEach(function (k) {
            if (state.profile[k] === undefined) state.profile[k] = DEFAULT_STATE.profile[k];
          });
        }
      }
    } catch (e) {
      /* 本地存储不可用时降级为内存态，功能不中断 */
      if (global.console) console.warn('[掌上猪科] 读取本地数据失败，已降级：', e.message);
    }
    return state;
  }

  function write(state) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      if (global.console) console.warn('[掌上猪科] 保存本地数据失败：', e.message);
      return false;
    }
  }

  var STATE = null;

  var store = {
    /** 取全部状态（首次调用时从 localStorage 载入） */
    all: function () {
      if (!STATE) STATE = read();
      return STATE;
    },

    save: function () {
      return write(store.all());
    },

    /* ---------- 收藏 ---------- */
    isFavorite: function (id) {
      return store.all().favorites.indexOf(id) > -1;
    },
    toggleFavorite: function (id) {
      var s = store.all();
      var i = s.favorites.indexOf(id);
      if (i > -1) s.favorites.splice(i, 1);
      else s.favorites.push(id);
      store.save();
      return i === -1;
    },
    favorites: function () {
      return store.all().favorites.slice();
    },

    /* ---------- 报名 / 意向登记 ---------- */
    joinState: function (id) {
      return store.all().joined[id] || null;
    },
    setJoin: function (id, value) {
      var s = store.all();
      if (value) s.joined[id] = value;
      else delete s.joined[id];
      store.save();
    },
    joinedList: function () {
      var j = store.all().joined;
      return Object.keys(j).map(function (id) {
        return { id: id, state: j[id] };
      });
    },

    /* ---------- 我的发布 ---------- */
    myPosts: function () {
      return store.all().mine.slice();
    },
    addPost: function (post) {
      var s = store.all();
      post.id = 'my-' + Date.now().toString(36);
      post.createdAt = new Date().toISOString();
      post.mine = true;
      s.mine.unshift(post);
      store.save();
      return post;
    },
    removePost: function (id) {
      var s = store.all();
      s.mine = s.mine.filter(function (p) { return p.id !== id; });
      store.save();
    },

    /* ---------- 个人设置 ---------- */
    profile: function () {
      return store.all().profile;
    },
    setProfile: function (patch) {
      var s = store.all();
      Object.keys(patch).forEach(function (k) { s.profile[k] = patch[k]; });
      store.save();
      return s.profile;
    },
    setOnboarded: function () {
      var s = store.all();
      s.onboarded = true;
      store.save();
    },
    isOnboarded: function () {
      return !!store.all().onboarded;
    },

    /* ---------- 维护 ---------- */
    exportJSON: function () {
      return JSON.stringify(store.all(), null, 2);
    },
    reset: function () {
      STATE = clone(DEFAULT_STATE);
      write(STATE);
    }
  };

  global.ZHUKE = global.ZHUKE || {};
  global.ZHUKE.store = store;
})(window);
