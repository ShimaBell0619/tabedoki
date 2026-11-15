/* Push-only worker: no fetch interception, offline cache, or asset precaching. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* Use defaults. */ }
  event.waitUntil(self.registration.showNotification(
    typeof data.title === 'string' ? data.title : 'たべどき',
    { body: typeof data.body === 'string' ? data.body : '食品を登録しましょう。',
      icon: '/icons/cooking-pot.svg', badge: '/icons/cooking-pot.svg',
      tag: data.kind === 'register' ? 'tabedoki-register' : 'tabedoki-reminder',
      data: { kind: 'register' } },
  ));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = list.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'TABEDOKI_REGISTER_FROM_NOTIFICATION' });
    } else {
      await self.clients.openWindow('/?reminder=register');
    }
  })());
});
