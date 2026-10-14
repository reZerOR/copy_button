// Apply the cached appearance before the stylesheet paints. Extension storage
// keeps the preference consistent across the popup, library, help, and picker.
(() => {
  const root = document.documentElement;
  const api = globalThis.BC_API;
  const normalize = value => value === 'dark' ? 'dark' : 'light';
  function apply(value) {
    const theme = normalize(value);
    root.dataset.theme = theme;
    try { localStorage.setItem('button-copy-appearance', theme); } catch { /* Standalone previews may have no storage. */ }
    document.querySelectorAll('[data-theme-switch]').forEach(button => {
      const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      button.setAttribute('aria-label', label);
      button.title = label;
      const text = button.querySelector('[data-theme-label]');
      if (text) text.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    });
  }
  let cached = 'light';
  try { cached = localStorage.getItem('button-copy-appearance'); } catch { /* Use the default. */ }
  apply(cached);
  const stored = api?.storage?.local.get('appearance');
  stored?.then(data => { if (data.appearance) apply(data.appearance); }).catch(() => {});
  api?.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.appearance) apply(changes.appearance.newValue);
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    document.querySelectorAll('[data-theme-switch]').forEach(button => {
      button.addEventListener('click', async () => {
        const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        apply(theme);
        try { await api?.storage?.local.set({ appearance: theme }); }
        catch { /* The local cache still retains the choice. */ }
      });
    });
  });
})();
