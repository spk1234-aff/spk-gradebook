/* เชื่อมหน้าเว็บ (GitHub Pages) กับ Google Apps Script — ใช้แทน google.script.run */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbytfA0FUcixIlzJ1Im3ISGQLjE7mZeY4mZ1fmxa9yZS_lrHb2ngDJsx0nSvH0JGhAb-cg/exec';
  function runner(h) {
    return new Proxy({}, { get: function (t, k) {
      if (k === 'withSuccessHandler') return function (f) { return runner({ s: f, f: h.f }); };
      if (k === 'withFailureHandler') return function (f) { return runner({ s: h.s, f: f }); };
      return function () {
        var args = [].slice.call(arguments), tries = 0;
        (function go() {
          fetch(API, { method: 'POST', body: JSON.stringify({ fn: k, args: args }) })   // text/plain → ไม่ต้อง preflight
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j.ok) { if (h.s) h.s(j.r); } else if (h.f) h.f(new Error(j.e)); })
            .catch(function () {
              if (tries++ < 1 && /^(get|admin(Sessions|Scores|Summary|Deleted|Resume))/.test(k)) return setTimeout(go, 800);   // ลองใหม่ 1 ครั้งเฉพาะคำสั่งอ่าน
              if (h.f) h.f(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่'));
            });
        })();
      };
    } });
  }
  window.google = { script: { run: runner({}) } };
})();
