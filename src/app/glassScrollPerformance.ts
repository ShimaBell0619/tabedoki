// Keep costly fixed SVG backdrop filters idle while the page moves underneath them.
// This avoids a React rerender and retains full refraction at rest.
let idleTimer: number | undefined;

const markScrolling = () => {
  if (window.innerWidth > 760) return;
  const root = document.documentElement;
  if (root.dataset.glassScrolling !== 'true') root.dataset.glassScrolling = 'true';
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    delete root.dataset.glassScrolling;
    idleTimer = undefined;
  }, 240);
};

window.addEventListener('touchmove', markScrolling, { passive: true });
window.addEventListener('wheel', markScrolling, { passive: true });
window.addEventListener('scroll', markScrolling, { passive: true, capture: true });
