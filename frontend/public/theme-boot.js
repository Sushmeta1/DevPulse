// Applies the saved theme before first paint so there is never a flash of the wrong one.
// Lives in its own file because the Content-Security-Policy forbids inline scripts.
(function () {
  var t = 'system';
  try { t = localStorage.getItem('devpulse.theme') || 'system'; } catch (e) { /* storage blocked: fall back to the system theme */ }
  var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
