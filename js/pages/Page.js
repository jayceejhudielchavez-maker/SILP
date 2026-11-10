import { $ } from '../utils/helpers.js';

// Base class for every page in the sidebar.
// A page draws itself into #view in show(), and lists its buttons in actions():
//   <button data-action="save" data-id="...">  →  actions().save(button, event)
export class Page {
  constructor(app, name, { adminOnly = false } = {}) {
    this.app = app;
    this.name = name;
    this.adminOnly = adminOnly;
  }

  get view() { return $('view'); }

  // Called by App.go(). Subclasses draw in render(); events are wired up here.
  show() {
    this.render();
    const view = this.view;
    const actions = this.actions();
    view.onclick = e => {
      const el = e.target.closest('[data-action]');
      if (!el || !view.contains(el) || !actions[el.dataset.action]) return;
      this.#safely(() => actions[el.dataset.action](el, e));
    };
    view.oninput = e => this.#safely(() => this.onInput(e));
    view.onchange = e => this.#safely(() => this.onChange(e));
  }

  #safely(fn) {
    Promise.resolve().then(fn).catch(err => this.app.fail(err));
  }

  // ----- for subclasses to override

  render() {}
  actions() { return {}; }
  onInput() {}
  onChange() {}
  recordsChanged() {}                // records were reloaded (another laptop saved)
  templateChanged() {}               // the certificate template was reloaded
  canLeave() { return true; }        // return false to stop navigation (unsaved changes)
  leave() {}                         // called when navigating away
}
