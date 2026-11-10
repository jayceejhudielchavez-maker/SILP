// Dialog box. Buttons inside it use data-action="name"; open() takes the matching handlers.
//   modal.open(`... <button data-action="save">Save</button>`, { save: btn => ... })
// data-action="close" always closes it.
export class Modal {
  #handlers = {};
  #pending = null;   // resolve function of an open confirm()

  constructor(element, onError) {
    this.el = element;
    this.onError = onError;
    element.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !element.contains(btn)) return;
      const handler = this.#handlers[btn.dataset.action];
      if (handler) Promise.resolve(handler(btn, e)).catch(err => this.onError(err));
    });
  }

  get isOpen() {
    return this.el.classList.contains('on');
  }

  open(html, handlers = {}, wide = false) {
    this.#settle(false);
    this.#handlers = Object.assign({ close: () => this.close() }, handlers);
    this.el.innerHTML = `<div class="card${wide ? ' wide' : ''}">${html}</div>`;
    this.el.classList.add('on');
  }

  close() {
    this.#settle(false);
    this.el.classList.remove('on');
    this.el.innerHTML = '';
    this.#handlers = {};
  }

  // Resolves true for OK, false for Cancel (or if the dialog is replaced)
  confirm(title, message, okLabel = 'OK', danger = false) {
    return new Promise(resolve => {
      this.open(`<h3>${title}</h3><p>${message}</p><div class="actions">
          <button class="btn o" data-action="no">Cancel</button>
          <button class="btn${danger ? ' d' : ''}" data-action="yes">${okLabel}</button></div>`, {
        yes: () => { this.#pending = null; this.close(); resolve(true); },
        no: () => this.close(),
      });
      this.#pending = resolve;
    });
  }

  #settle(value) {
    const resolve = this.#pending;
    this.#pending = null;
    if (resolve) resolve(value);
  }
}
