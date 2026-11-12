import { $, esc } from '../utils/helpers.js';
import { PARISH, PARISH_PLACE } from '../config.js';
import { Theme } from './Theme.js';

// The screens before the app opens: sign in, first-time setup, choose a new password
export class AuthView {
  constructor(app) {
    this.app = app;
  }

  get #root() { return $('app'); }

  #card(inner, actions) {
    this.#root.innerHTML = `<div class="auth">${Theme.button()}<div class="card">
      <img class="auth-logo" src="img/parish-logo.png" alt="Parish logo">
      <div class="mu" style="font-size:12px;text-align:center">Archdiocese of Lipa</div>
      <b style="display:block;margin-bottom:12px;text-align:center">${PARISH} · ${PARISH_PLACE}</b>
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
      <div class="auth-alt">
        <span class="mu">No account yet?</span>
        <button class="btn o s" data-action="request">Request an account</button>
      </div>
      <p class="mu" style="font-size:12px">Forgot your password? Ask the Admin to reset it.</p>`,
    { login: submit, enter: submit, request: () => this.showRequest() });
    setTimeout(() => $('lu') && $('lu').focus(), 50);
  }

  // Anyone can ask; the Admin approves (or rejects) it under Users
  showRequest() {
    const submit = () => {
      if ($('rp1').value !== $('rp2').value) return this.#error('rerr', 'The two passwords do not match.');
      this.#attempt($('rbtn'), 'rerr', () => this.app.requestAccount($('rn').value, $('ru').value, $('rp1').value));
    };
    this.#card(`<h2>Request an account</h2>
      <p>Fill this in and the parish Admin will approve it. You can sign in once it is approved.</p>
      <label>Full name (first and last name)</label><input id="rn" autocomplete="name" placeholder="e.g. Maria Santos">
      <label>Username (3–30 letters or numbers, no spaces)</label><input id="ru" autocomplete="username" placeholder="e.g. maria.santos">
      <label>Password (at least 8 characters, no spaces)</label><input id="rp1" type="password" autocomplete="new-password">
      <label>Confirm password</label><input id="rp2" type="password" autocomplete="new-password">
      <div id="rerr"></div>
      <div class="actions"><button class="btn o" data-action="back">Back to sign in</button>
        <button class="btn" id="rbtn" data-action="send">Send request</button></div>`,
    { send: submit, enter: submit, back: () => this.showLogin() });
    setTimeout(() => $('rn') && $('rn').focus(), 50);
  }

  showSetup() {
    const submit = () => {
      if ($('sp').value !== $('sp2').value) return this.#error('serr', 'The two passwords do not match.');
      this.#attempt($('sbtn'), 'serr', () => this.app.createFirstAdmin($('sn').value, $('su').value, $('sp').value));
    };
    this.#card(`<h2>First-time setup</h2>
      <p>Create the <b>Admin</b> account. The Admin can manage users, edit the certificate template, delete records and restore backups.</p>
      <label>Full name (shown on waybills as "Released By")</label><input id="sn" autocomplete="name" placeholder="e.g. Juan Dela Cruz">
      <label>Admin username</label><input id="su" value="admin" autocomplete="username">
      <label>Password (at least 8 characters, no spaces)</label><input id="sp" type="password" autocomplete="new-password">
      <label>Confirm password</label><input id="sp2" type="password" autocomplete="new-password">
      <div id="serr"></div>
      <div class="actions"><button class="btn" id="sbtn" data-action="create">Create Admin account</button></div>`,
    { create: submit, enter: submit });
  }

  // Accounts made before full names were required: type it once to get in
  showFullName(username) {
    const submit = () => this.#attempt($('nbtn'), 'nerr', () => this.app.setMyFullName($('nn').value));
    this.#card(`<h2>Your full name</h2>
      <p>Before continuing, type your full name for the account <b>${esc(username)}</b>.
        It is printed on waybills and release slips as <b>"Released By"</b>, so use your real first and last name.</p>
      <label>Full name</label><input id="nn" autocomplete="name" placeholder="e.g. Maria Santos">
      <div id="nerr"></div>
      <div class="actions"><button class="btn o" data-action="cancel">Sign out</button>
        <button class="btn" id="nbtn" data-action="save">Continue</button></div>`,
    { save: submit, enter: submit, cancel: () => this.app.logout() });
    setTimeout(() => $('nn') && $('nn').focus(), 50);
  }

  showForcedPassword() {
    const submit = () => {
      if ($('fp').value !== $('fp2').value) return this.#error('ferr', 'The two passwords do not match.');
      this.#attempt($('fbtn'), 'ferr', () => this.app.setNewPassword($('fp').value));
    };
    this.#card(`<h2>Choose a new password</h2>
      <p>Your password was set by the Admin. Choose your own before continuing.</p>
      <label>New password (at least 8 characters, no spaces)</label><input id="fp" type="password" autocomplete="new-password">
      <label>Confirm new password</label><input id="fp2" type="password" autocomplete="new-password">
      <div id="ferr"></div>
      <div class="actions"><button class="btn o" data-action="cancel">Cancel</button>
        <button class="btn" id="fbtn" data-action="save">Save password</button></div>`,
    { save: submit, enter: submit, cancel: () => this.app.logout() });
  }
}
