(function () {
  'use strict';
  const key = 'scivill.theme';
  let theme = 'dark';
  try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark') theme = saved; } catch {}
  const icons = {
    light: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.6 14A8.7 8.7 0 0110 3.4 8.8 8.8 0 1020.6 14Z"/></svg>'
  };
  function apply(next, save) {
    theme = next;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f5f7fa' : '#0a1118';
    const button = document.getElementById('theme-toggle');
    if (button) {
      const label = theme === 'light' ? '블랙 모드로 변경' : '화이트 모드로 변경';
      button.innerHTML = icons[theme] + '<span>' + (theme === 'light' ? '화이트' : '블랙') + '</span>';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(theme === 'light'));
      button.title = label;
    }
    if (save) { try { localStorage.setItem(key, theme); } catch {} }
  }
  apply(theme, false);
  function init() {
    apply(theme, false);
    document.getElementById('theme-toggle')?.addEventListener('click', function () { apply(theme === 'dark' ? 'light' : 'dark', true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
  window.addEventListener('storage', function (event) { if (event.key === key && ['light','dark'].includes(event.newValue)) apply(event.newValue, false); });
})();
