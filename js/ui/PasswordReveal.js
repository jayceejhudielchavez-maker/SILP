const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Adds a show/hide (eye) button to every password box, including ones drawn later
// (sign-in, first-time setup, new password, change password).
export class PasswordReveal {
  static install(root = document.body) {
    PasswordReveal.#enhance(root);
    new MutationObserver(changes => {
      for (const change of changes) {
        for (const node of change.addedNodes) if (node.nodeType === 1) PasswordReveal.#enhance(node);
      }
    }).observe(root, { childList: true, subtree: true });
  }

  static #enhance(node) {
    const inputs = node.matches('input[type=password]') ? [node] : node.querySelectorAll('input[type=password]');
    inputs.forEach(input => PasswordReveal.#wrap(input));
  }

  static #wrap(input) {
    if (input.dataset.reveal) return;   // already has a button
    input.dataset.reveal = '1';
    const box = document.createElement('span');
    box.className = 'pw';
    input.parentNode.insertBefore(box, input);
    box.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-btn';
    const set = shown => {
      input.type = shown ? 'text' : 'password';
      button.innerHTML = shown ? EYE_OFF : EYE;
      button.title = shown ? 'Hide password' : 'Show password';
      button.setAttribute('aria-label', button.title);
    };
    set(false);
    button.addEventListener('click', () => { set(input.type === 'password'); input.focus(); });
    box.appendChild(button);
  }
}
