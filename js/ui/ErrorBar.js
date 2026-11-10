// Red bar across the top for unexpected errors, so problems never show as a blank page
export class ErrorBar {
  constructor(element, textElement, closeButton) {
    this.el = element;
    this.text = textElement;
    closeButton.addEventListener('click', () => this.hide());
  }

  show(message) {
    this.text.textContent = message;
    this.el.classList.add('on');
  }

  hide() {
    this.el.classList.remove('on');
  }

  // Catch errors nobody else handled
  watchWindow() {
    window.addEventListener('error', e => this.show('Something went wrong: ' + (e.message || 'unknown error')));
    window.addEventListener('unhandledrejection', e => {
      if (!(e.reason && e.reason.silent)) this.show((e.reason && e.reason.message) || String(e.reason));
    });
  }
}
