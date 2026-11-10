// Short message at the bottom of the screen (red for problems)
export class Toast {
  #timer = null;

  constructor(element) {
    this.el = element;
  }

  show(message, bad = false) {
    this.el.textContent = message;
    this.el.className = 'on' + (bad ? ' bad' : '');
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.el.className = ''; }, bad ? 6000 : 3000);
  }
}
