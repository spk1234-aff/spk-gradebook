/* โหลดหน้าเว็บจาก Google Apps Script (แก้โค้ดที่ Apps Script ที่เดียว) — เปิดครั้งต่อไปแสดงทันทีจากแคช */
(function () {
  var me = document.currentScript, page = me.getAttribute('data-page'), key = 'gbfb_page_' + page, shown = false;
  function fix(h) {
    return h.replace(/https:\/\/script\.google\.com\/[^"'\s<>]*?\/exec\?page=admin/g, 'admin.html')
      .replace(/https:\/\/script\.google\.com\/[^"'\s<>]*?\/exec/g, './')
      .replace(/<head>/i, '<head><script src="api-fb.js"><\/script>');
  }
  function show(h) { shown = true; document.open(); document.write(fix(h)); document.close(); }
  function when(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }
  var cached = null; try { cached = localStorage.getItem(key); } catch (e) {}
  google.script.run.withSuccessHandler(function (h) {
    try { localStorage.setItem(key, h); } catch (e) {}
    if (!shown) when(function () { show(h); });
  }).withFailureHandler(function () {
    if (!shown) when(function () { var el = document.getElementById('ld'); if (el) el.innerHTML = 'โหลดไม่สำเร็จ<br><button onclick="location.reload()">ลองใหม่</button>'; });
  }).getPage(page);
  if (cached) when(function () { show(cached); });
})();
