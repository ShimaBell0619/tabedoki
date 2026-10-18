(() => {
  let preference;
  try { preference = localStorage.getItem('tabedoki-theme'); } catch { /* System setting remains the default. */ }
  const dark = preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0E1115' : '#354F70');
})();
