/* Sir'Earth Class — เชื่อมหน้าเว็บกับ Firebase (ข้อมูล) + Google Apps Script (ไฟล์ใน Drive) แทน google.script.run */
(function () {
  if (window.SE_FB) return;
  var API = 'https://script.google.com/macros/s/AKfycbytfA0FUcixIlzJ1Im3ISGQLjE7mZeY4mZ1fmxa9yZS_lrHb2ngDJsx0nSvH0JGhAb-cg/exec';
  var CFG = { apiKey: 'AIzaSyCSGxk3LxnkbXgHyXxGxXlcrC9TJEJwKCM', authDomain: 'sirearth-class.firebaseapp.com', projectId: 'sirearth-class',
              messagingSenderId: '991820377436', appId: '1:991820377436:web:0efa36ba2dfa6e1c466599' };
  var TEACHER = 'sattrawood@sopit.ac.th', STU = 'stu.sirearth.app', SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var isAdmin = /admin/i.test(location.pathname);
  var FB = window.SE_FB = { on: true, admin: isAdmin };
  var boot = null, coreP = null, auth = null, db = null;

  function load(src) {
    return new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('โหลดไม่สำเร็จ ตรวจอินเทอร์เน็ต')); };
      document.head.appendChild(s);
    });
  }
  /** โหลด Firebase เมื่อจำเป็นครั้งแรก (หลังหน้าเว็บแสดงแล้ว) */
  function fb() {
    if (boot) return boot;
    boot = load(SDK + 'firebase-app-compat.js').then(function () {
      return Promise.all([load(SDK + 'firebase-auth-compat.js'), load(SDK + 'firebase-firestore-compat.js')]);
    }).then(function () {
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG);
      auth = app.auth(); db = app.firestore();
      var p = Promise.resolve();
      if (isAdmin) p = db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
      else p = auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function () {});
      return p.then(function () { return new Promise(function (ok) { var u = auth.onAuthStateChanged(function () { u(); ok(); }); }); });
    });
    return boot;
  }
  /** โค้ดระบบ (core) โหลดจาก Apps Script แล้วเก็บไว้ในเครื่อง — ครั้งต่อไปเปิดทันที แล้วอัปเดตเบื้องหลัง */
  function runCode(txt) { var s = document.createElement('script'); s.text = txt; document.head.appendChild(s); }
  function coreCode() {
    var cached = null; try { cached = localStorage.getItem('se_core'); } catch (e) {}
    var fresh = remote('getCore', [], null).then(function (txt) { try { localStorage.setItem('se_core', txt); } catch (e) {} return txt; });
    if (cached) { fresh.catch(function () {}); return Promise.resolve(cached); }
    return fresh;
  }
  function core() {
    if (coreP) return coreP;
    coreP = Promise.all([fb(), window.SE_CORE_FACTORY ? null : coreCode()]).then(function (a) {
      if (a[1] && !window.SE_CORE_FACTORY) runCode(a[1]);
      var c = window.SE_CORE || (window.SE_CORE = window.SE_CORE_FACTORY());
      return c.start(db).then(function () { return c; });
    });
    coreP.catch(function () { coreP = null; });
    return coreP;
  }
  function isTeacher(u) { return !!(u && String(u.email).toLowerCase() === TEACHER && u.emailVerified); }
  function sess() { return new Error('SESSION: หมดเวลาเข้าสู่ระบบ กรุณาเข้าใหม่'); }

  function remote(fn, args, tokPos) {
    var u = auth && auth.currentUser;
    var tk = (tokPos != null && u) ? u.getIdToken() : Promise.resolve(null);
    return tk.then(function (t) {
      if (tokPos != null) { if (!t) throw sess(); args = args.slice(); args[tokPos] = t; }
      var tries = 0;
      return (function go() {
        return fetch(API, { method: 'POST', body: JSON.stringify({ fn: fn, args: args, be: 'fs' }) }).then(function (r) { return r.json(); })
          .catch(function (e) { if (tries++ < 1 && /^get/.test(fn)) return new Promise(function (ok) { setTimeout(ok, 800); }).then(go); throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่'); });
      })();
    }).then(function (j) {
      if (!j.ok) throw new Error(j.e);
      if (j.w && window.SE_CORE) return window.SE_CORE.applyRemote(j.w).then(function () { return j.r; });
      return j.r;
    });
  }

  /* ----- นักเรียน ----- */
  function studentLogin(rawId, rawPin) {
    var id = String(rawId || '').replace(/\s/g, ''), pin = String(rawPin || '').replace(/\s/g, '');
    if (!/^\d{4,6}$/.test(id)) return Promise.resolve({ ok: false, msg: 'กรุณากรอกเลขประจำตัวนักเรียนเป็นตัวเลข' });
    if (!pin) return Promise.resolve({ ok: false, msg: 'กรุณากรอก PIN' });
    return fb().then(function () { return db.collection('pub').doc('main').get().catch(function () { return null; }); }).then(function (p) {
      if (p && p.exists && p.data().open === false) return { ok: false, msg: 'ระบบปิดชั่วคราว' };
      return auth.signInWithEmailAndPassword(id + '@' + STU, 'se-' + pin).then(function () {
        return db.collection('v').doc(id).get();
      }).then(function (v) {
        if (!v.exists) return { ok: false, msg: 'ยังไม่มีข้อมูลของเลขประจำตัวนี้ กรุณาติดต่อครู' };
        return { ok: true, tok: 'fb', data: JSON.parse(v.data().j) };
      }).catch(function (e) {
        var c = e && e.code || '';
        if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return { ok: false, msg: 'เลขประจำตัวหรือ PIN ไม่ถูกต้อง' };
        if (/too-many-requests/.test(c)) return { ok: false, msg: 'กรอก PIN ผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่' };
        if (/network/.test(c)) return { ok: false, msg: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' };
        throw e;
      });
    });
  }

  /* ----- ครู ----- */
  function teacherData() { return core().then(function (c) { return { ok: true, token: 'fb', data: c.run('adminData', []).r }; }); }
  function teacherLogin() {
    return fb().then(function () {
      if (isTeacher(auth.currentUser)) return null;
      var pv = new firebase.auth.GoogleAuthProvider(); pv.setCustomParameters({ login_hint: TEACHER, prompt: 'select_account' });
      return auth.signInWithPopup(pv);
    }).then(function () {
      if (!isTeacher(auth.currentUser)) { var em = auth.currentUser && auth.currentUser.email; return auth.signOut().then(function () { return { ok: false, msg: 'บัญชี ' + (em || '') + ' ไม่ใช่บัญชีครูของระบบนี้' }; }); }
      return teacherData();
    }).catch(function (e) {
      var c = e && e.code || '';
      if (/popup-closed|cancelled-popup/.test(c)) return { ok: false, msg: 'ยกเลิกการเข้าสู่ระบบ' };
      if (/popup-blocked/.test(c)) return { ok: false, msg: 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาตป๊อปอัปแล้วลองใหม่' };
      throw e;
    });
  }

  FB.whenTeacher = function (cb) { fb().then(function () { if (isTeacher(auth.currentUser)) cb(); }); };
  FB.signOut = function () { if (window.SE_CORE) window.SE_CORE.stop(); coreP = null; return fb().then(function () { return auth.signOut(); }); };
  FB.user = function () { return auth && auth.currentUser; };
  /** ปุ่มรีเฟรช: มีหน้าเว็บ/โค้ดระบบเวอร์ชันใหม่ไหม (ถ้ามี เก็บไว้แล้วให้หน้าเว็บโหลดใหม่) */
  FB.checkUpdate = function (page) {
    var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, put = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var a = remote('getPage', [page], null).then(function (h) { var o = get('gb_page_' + page); if (!h || h === o) return false; put('gb_page_' + page, h); return !!o; });
    var b = !isAdmin ? false : remote('getCore', [], null).then(function (t) { var o = get('se_core'); if (!t || t === o) return false; put('se_core', t); return !!o; });
    return Promise.all([a, b]).then(function (r) { return r[0] || r[1]; }, function () { return false; });
  };
  /** นักเรียน: อ่านหน้าของตัวเองใหม่ (ยังเข้าสู่ระบบอยู่ในแท็บนี้) */
  function studentResume() {
    return fb().then(function () {
      var u = auth.currentUser, m = u && String(u.email).match(/^(\d{4,6})@stu[.]sirearth[.]app$/i);
      if (!m) return { ok: false };
      return db.collection('v').doc(m[1]).get().then(function (v) { return v.exists ? { ok: true, tok: 'fb', data: JSON.parse(v.data().j) } : { ok: false }; });
    });
  }

  /** จัดเส้นทางคำสั่ง: ในเครื่อง (Firestore) หรือ Apps Script */
  function dispatch(fn, args) {
    if (fn === 'getPage') return remote(fn, args, null);
    if (fn === 'getInfo') return fb().then(function () { return db.collection('pub').doc('main').get(); }).then(function (d) { return d.exists ? d.data() : null; });
    if (fn === 'login') return studentLogin(args[0], args[1]);
    if (fn === 'stuResume') return studentResume();
    if (fn === 'submitWork') return fb().then(function () { return remote(fn, args, 0); });
    if (fn === 'adminLogin') return teacherLogin();
    if (fn === 'adminResume') return fb().then(function () { if (!isTeacher(auth.currentUser)) throw sess(); return teacherData(); });
    if (fn === 'adminChangePassword') return Promise.reject(new Error('ตอนนี้เข้าสู่ระบบด้วยบัญชี Google แล้ว ไม่ต้องใช้รหัสผ่าน'));
    return core().then(function (c) {
      if (!isTeacher(auth.currentUser)) throw sess();
      if (c.remote(fn, args) || !c.fns[fn]) return remote(fn, args, 0);
      var out = c.run(fn, args);
      return out.save.then(function () { return out.r; });
    });
  }
  function runner(h) {
    return new Proxy({}, { get: function (t, k) {
      if (k === 'withSuccessHandler') return function (f) { return runner({ s: f, f: h.f }); };
      if (k === 'withFailureHandler') return function (f) { return runner({ s: h.s, f: f }); };
      return function () {
        var args = [].slice.call(arguments);
        Promise.resolve().then(function () { return dispatch(k, args); })
          .then(function (r) { if (h.s) h.s(r); }, function (e) { console.error(k, e); if (h.f) h.f(e instanceof Error ? e : new Error(String(e))); });
      };
    } });
  }
  window.google = { script: { run: runner({}) } };
})();
