import { $, esc } from '../utils/helpers.js';
import { PARISH, PARISH_PLACE } from '../config.js';

// The screens before the app opens: sign in, first-time setup, choose a new password
export class AuthView {
  constructor(app) {
    this.app = app;
  }

  get #root() { return $('app'); }

  #card(inner, actions) {
    this.#root.innerHTML = `<div class="auth"><div class="card">
      <div class="mu" style="font-size:12px">Archdiocese of Lipa</div>
      <b style="display:block;margin-bottom:12px">${PARISH} · ${PARISH_PLACE}</b>
      ${inner}</div></div>`;
    // Clicks and the Enter key call the matching action
    this.#root.onclick = e => {
      const btn = e.target.closest('[data-action]');
      if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn);
    };
    this.#root.onkeydown = e => { if (e.key === 'Enter' && actions.enter) actions.enter(); };
  }

  #error(id, message) {
    $(id).innerHTML = `<div class="note bad" style="margin-top:10px">${esc(message)}</div>`;
  }

  // Runs an async step with the button disabled; shows any error under the form
  async #attempt(button, errorId, fn) {
    if (button) button.disabled = true;
    try {
      await fn();
    } catch (e) {
      if (!e.silent) this.#error(errorId, e.message);
    } finally {
      if (button && button.isConnected) button.disabled = false;
    }
  }

  fatal(message) {
    this.#card(`<h2>Cannot open the app</h2><div class="note bad">${esc(message)}</div>
      <p class="mu">If this keeps happening, ask the Admin to check the Supabase settings and the Render site (see the README).</p>
      <div class="actions"><button class="btn" data-action="reload">Try again</button></div>`,
    { reload: () => location.reload() });
  }

  showLogin(message) {
    const submit = () => {
      const username = $('lu').value.trim(), password = $('lp').value;
      if (!username || !password) return this.#error('lerr', 'Enter your username and password.');
      this.#attempt($('lbtn'), 'lerr', () => this.app.signIn(username, password));
    };
    this.#card(`<h2>Sign in</h2>
      <p class="mu">First Holy Communion records</p>
      ${message ? `<div class="note">${esc(message)}</div>` : ''}
      <label>Username</label><input id="lu" autocomplete="username">
      <label>Password</label><input id="lp" type="password" autocomplete="current-password">
      <div id="lerr"></div>
      <div class="actions"><button class="btn" id="lbtn" data-action="login">Sign in</button></div>
      <p class="mu" style="font-size:12px">Forgot your password? Ask the Admin to reset it.</p>`,
    { login: submit, enter: submit });
    setTimeout(() => $('lu') && $('lu').focus(), 50);
  }

  showSetup() {
    const submit = () => {
      if ($('sp').value !== $('sp2').value) return this.#error('serr', 'The two passwords do not match.');
      this.#attempt($('sbtn'), 'serr', () => this.app.createFirstAdmin($('su').value, $('sp').value));
    };
    this.#card(`<h2>First-time setup</h2>
      <p>Create the <b>Admin</b> account. The Admin can manage users, edit the certificate template, delete records and restore backups.</p>
      <label>Admin username</label><input id="su" value="admin" autocomplete="username">
      <label>Password (at least 8 characters)</label><input id="sp" type="password" autocomplete="new-password">
      <label>Confirm password</label><input id="sp2" type="password" autocomplete="new-password">
      <div id="serr"></div>
      <div class="actions"><button class="btn" id="sbtn" data-action="create">Create Admin account</button></div>`,
    { create: submit, enter: submit });
  }

  showForcedPassword() {
    const submit = () => {
      if ($('fp').value !== $('fp2').value) return this.#error('ferr', 'The two passwords do not match.');
      this.#attempt($('fbtn'), 'ferr', () => this.app.setNewPassword($('fp').value));
    };
    this.#card(`<h2>Choose a new password</h2>
      <p>Your password was set by the Admin. Choose your own before continuing.</p>
      <label>New password (at least 8 characters)</label><input id="fp" type="password" autocomplete="new-password">
      <label>Confirm new password</label><input id="fp2" type="password" autocomplete="new-password">
      <div id="ferr"></div>
      <div class="actions"><button class="btn o" data-action="cancel">Cancel</button>
        <button class="btn" id="fbtn" data-action="save">Save password</button></div>`,
    { save: submit, enter: submit, cancel: () => this.app.logout() });
  }
}
