/* Sir'Earth Class — รับแจ้งเตือนในมือถือ (Firebase Cloud Messaging · data message) */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {}; try { var j = e.data.json(); d = j.data || j.notification || j; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || "Sir'Earth Class", {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-96.png', tag: d.tag || undefined, data: { link: d.link || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var u = (e.notification.data && e.notification.data.link) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) if ('focus' in ws[i]) return ws[i].focus();
    return self.clients.openWindow(u);
  }));
});
