// Light / Dark / Auto, the same switch as ReliefSys. Auto follows the device setting.
// The choice is saved in this browser only; index.html applies it before the page draws.
const LABELS = { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' };
const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

export class Theme {
  static get current() {
    return document.documentElement.dataset.theme || 'auto';
  }

  static set(theme) {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) { /* private browsing: not saved */ }
    document.querySelectorAll('[data-theme-toggle]').forEach(b => { b.textContent = LABELS[theme]; });
  }

  static cycle() {
    Theme.set(NEXT[Theme.current]);
  }

  // The button to put in a page; any number of them work
  static button(extraClass = '') {
    return `<button class="btn o s theme-btn ${extraClass}" data-theme-toggle title="Switch between light, dark and your device's setting">${LABELS[Theme.current]}</button>`;
  }

  // One listener for every theme button, wherever it is drawn
  static install() {
    document.addEventListener('click', e => { if (e.target.closest('[data-theme-toggle]')) Theme.cycle(); });
  }
}
