import { Page } from './Page.js';
import { $, esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';

// Admin: add staff, reset passwords, change roles, delete users
export class UsersPage extends Page {
  constructor(app) {
    super(app, 'Users', { adminOnly: true });
    this.users = [];
  }

  render() {
    this.view.innerHTML = `<div class="grid g2">
      <div class="card tw" data-role="table">Loading…</div>
      <div class="card"><h3>Add a user</h3>
        <label>Username</label><input id="nu" autocomplete="off">
        <label>Temporary password (at least 8 characters)</label><input id="np" type="text" autocomplete="off">
        <label>Role</label><select id="nr"><option>Staff</option><option>Admin</option></select>
        <p class="mu"><b>Staff</b> can add, edit, print and export. <b>Admin</b> can also delete records, edit the template, manage users and restore backups.
          New users must change the temporary password when they first sign in.</p>
        <div class="actions"><button class="btn" data-action="add">Add user</button></div>
      </div></div>`;
    this.load();
  }

  actions() {
    return {
      add: btn => this.app.busy(btn, () => this.#add()),
      reset: el => this.#resetDialog(el.dataset.user),
      role: el => this.#setRole(el.dataset.user, el.dataset.role),
      remove: el => this.#remove(el.dataset.user),
    };
  }

  async load() {
    const table = this.view.querySelector('[data-role=table]');
    try {
      this.users = await this.app.db.listUsers();
      table.innerHTML = `<table><tr><th>Username</th><th>Role</th><th>Created</th><th></th></tr>
        ${this.users.map(u => this.#row(u)).join('')}</table>`;
    } catch (e) {
      table.innerHTML = `<div class="note bad">${esc(e.message)}</div>`;
    }
  }

  #row(u) {
    const other = u.role === 'Admin' ? 'Staff' : 'Admin';
    const name = esc(u.username);
    return `<tr><td><b>${name}</b>${u.mustChange ? '<br><small>must change password</small>' : ''}</td>
      <td><span class="tag${u.role === 'Admin' ? ' a' : ''}">${esc(u.role)}</span></td>
      <td><small>${esc(Dates.stamp(u.createdAt))}<br>by ${esc(u.createdBy)}</small></td>
      <td style="white-space:nowrap">${u.username === this.app.me.username ? '<small class="mu">you</small>' : `
        <button class="btn s o" data-action="reset" data-user="${name}">Reset password</button>
        <button class="btn s o" data-action="role" data-user="${name}" data-role="${other}">Make ${other}</button>
        <button class="btn s g" data-action="remove" data-user="${name}">Delete</button>`}</td></tr>`;
  }

  async #add() {
    await this.app.auth.createUser($('nu').value, $('np').value, $('nr').value);
    this.app.toast.show('User added');
    this.render();
  }

  #resetDialog(username) {
    this.app.modal.open(`<h3>Reset password for ${esc(username)}</h3>
      <label>New temporary password (at least 8 characters)</label><input id="rp" type="text" autocomplete="off">
      <p class="mu">They will be asked to choose their own password at their next sign-in.</p>
      <div class="actions"><button class="btn o" data-action="close">Cancel</button><button class="btn" data-action="reset">Reset</button></div>`, {
      reset: btn => this.app.busy(btn, async () => {
        await this.app.db.resetPassword(username, $('rp').value);
        this.app.modal.close();
        this.app.toast.show('Password reset');
        this.load();
      }),
    });
  }

  async #setRole(username, role) {
    await this.app.db.setRole(username, role);
    this.app.toast.show(`${username} is now ${role}`);
    this.load();
  }

  async #remove(username) {
    const ok = await this.app.modal.confirm('Delete user?',
      `<b>${esc(username)}</b> will no longer be able to sign in. Records they made keep their name.`, 'Delete user', true);
    if (!ok) return;
    await this.app.db.deleteUser(username);
    this.app.toast.show('User deleted');
    this.load();
  }
}
