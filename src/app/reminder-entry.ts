/** Queue early worker messages until AuthGate finishes loading the application. */
let pending = false;
let initialized = false;
const listeners = new Set<() => void>();

export function initializeReminderEntry() {
  if (initialized || !('serviceWorker' in navigator)) return;
  initialized = true;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'TABEDOKI_REGISTER_FROM_NOTIFICATION') return;
    pending = true;
    for (const listener of listeners) listener();
  });
}
export function consumeReminderEntry() {
  if (!pending) return false;
  pending = false;
  return true;
}
export function subscribeReminderEntry(listener: () => void) {
  listeners.add(listener);
  if (pending) listener();
  return () => { listeners.delete(listener); };
}
