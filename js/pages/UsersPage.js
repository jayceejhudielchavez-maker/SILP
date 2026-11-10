import { Page } from './Page.js';
import { $, esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { AuthService } from '../services/AuthService.js';

// Admin: add staff, reset passwords, change roles, delete users
export class UsersPage extends Page {
  constructor(app) {
    super(app, 'Users', { adminOnly: true });
    this.users = [];
  }

  render() {
    this.view.innerHTML = `<div data-role="pending"></div>
      <div class="grid g2">
      <div class="card tw" data-role="table">Loading…</div>
      <div class="card"><h3>Add a user</h3>
        <label>Full name (first and last name, shown on waybills)</label><input id="nf" autocomplete="off" placeholder="e.g. Maria Santos">
        <label>Username</label><input id="nu" autocomplete="off">
        <label>Temporary password (at least 8 characters, no spaces)</label><input id="np" type="text" autocomplete="off">
        <label>Role</label><select id="nr"><option>Staff</option><option>Admin</option></select>
        <p class="mu"><b>Staff</b> can add, edit, print and export. <b>Admin</b> can also delete records, edit the template, manage users and restore backups.
          New users must change the temporary password when they first sign in.</p>
        <div class="actions"><button class="btn" data-action="add">Add user</button></div>
      </div></div>
      <div data-role="orphans"></div>`;
    this.load();
  }

  actions() {
    return {
      add: btn => this.app.busy(btn, () => this.#add()),
      approve: btn => this.app.busy(btn, () => this.#approve(btn.dataset.user, btn.dataset.role)),
      reject: el => this.#remove(el.dataset.user, true),
      reset: el => this.#resetDialog(el.dataset.user),
      rename: el => this.#renameDialog(el.dataset.user),
      role: el => this.#setRole(el.dataset.user, el.dataset.role),
      remove: el => this.#remove(el.dataset.user),
      removeOrphan: el => this.#removeOrphan(el.dataset.id, el.dataset.email),
    };
  }

  async load() {
    const table = this.view.querySelector('[data-role=table]');
    try {
      this.users = await this.app.db.listUsers();
      const active = this.users.filter(u => !u.pending), pending = this.users.filter(u => u.pending);
      table.innerHTML = `<table><tr><th>Name</th><th>Role</th><th>Created</th><th></th></tr>
        ${active.map(u => this.#row(u)).join('')}</table>`;
      this.#drawPending(pending);
      this.app.db.listOrphans().then(o => this.#drawOrphans(o)).catch(() => {});   // optional: needs update 5
    } catch (e) {
      table.innerHTML = `<div class="note bad">${esc(e.message)}</div>`;
    }
  }

  // Sign-in accounts with no access (an unfinished setup or request). Only shown when there are some.
  #drawOrphans(orphans) {
    const box = this.view.querySelector('[data-role=orphans]');
    if (!box) return;
    box.innerHTML = orphans.length ? `<div class="card" style="margin-top:12px">
      <div class="row"><b>Accounts without access (${orphans.length})</b>
        <span class="mu">Left over from a setup or request that did not finish. They cannot do anything; delete them to free the username.</span></div>
      <table style="margin-top:8px"><tr><th>Username</th><th>Made</th><th></th></tr>
      ${orphans.map(o => `<tr><td class="mono">${esc(o.username)}</td><td><small>${esc(Dates.stamp(o.createdAt))}</small></td>
        <td><button class="btn s d" data-action="removeOrphan" data-id="${esc(o.id)}" data-email="${esc(o.username)}">Delete account</button></td></tr>`).join('')}
      </table></div>` : '';
  }

  async #removeOrphan(id, username) {
    const ok = await this.app.modal.confirm('Delete this account?',
      `The sign-in account <b>${esc(username)}</b> is removed. Nothing else is affected.`, 'Delete account', true);
    if (!ok) return;
    await this.app.db.deleteOrphan(id);
    this.app.toast.show('Account deleted');
    this.load();
  }

  // Requests from "Request an account" on the sign-in page
  #drawPending(pending) {
    const box = this.view.querySelector('[data-role=pending]');
    box.innerHTML = pending.length ? `<div class="card pending">
      <div class="row"><b>Waiting for approval (${pending.length})</b>
        <span class="mu">Asked from the sign-in page. They cannot see anything until you approve them.</span></div>
      <table style="margin-top:8px"><tr><th>Name</th><th>Username</th><th>Asked</th><th></th></tr>
      ${pending.map(u => `<tr><td><b>${esc(u.fullName || '—')}</b></td><td class="mono">${esc(u.username)}</td>
        <td><small>${esc(Dates.stamp(u.createdAt))}</small></td>
        <td style="white-space:nowrap">
          <button class="btn s" data-action="approve" data-user="${esc(u.username)}" data-role="Staff">Approve as Staff</button>
          <button class="btn s o" data-action="approve" data-user="${esc(u.username)}" data-role="Admin">Approve as Admin</button>
          <button class="btn s g" data-action="reject" data-user="${esc(u.username)}">Reject</button>
        </td></tr>`).join('')}</table></div>` : '';
  }

  async #approve(username, role) {
    await this.app.db.approveUser(username, role);
    this.app.toast.show(`${username} approved as ${role}. They can sign in now.`);
    this.load();
  }

  #row(u) {
    const other = u.role === 'Admin' ? 'Staff' : 'Admin';
    const name = esc(u.username);
    return `<tr><td><b>${u.fullName ? esc(u.fullName) : '<span style="color:var(--bad)">No full name yet</span>'}</b>
        <br><small class="mono">${name}</small>${u.mustChange ? '<br><small>must change password</small>' : ''}</td>
      <td><span class="tag${u.role === 'Admin' ? ' a' : ''}">${esc(u.role)}</span></td>
      <td><small>${esc(Dates.stamp(u.createdAt))}<br>by ${esc(u.createdBy)}</small></td>
      <td style="white-space:nowrap">
        <button class="btn s o" data-action="rename" data-user="${name}">Edit name</button>
        ${u.username === this.app.me.username ? '<small class="mu">you</small>' : `
        <button class="btn s o" data-action="reset" data-user="${name}">Reset password</button>
        <button class="btn s o" data-action="role" data-user="${name}" data-role="${other}">Make ${other}</button>
        <button class="btn s d" data-action="remove" data-user="${name}">Delete account</button>`}</td></tr>`;
  }

  async #add() {
    await this.app.auth.createUser($('nf').value, $('nu').value, $('np').value, $('nr').value);
    this.app.toast.show('User added');
    this.render();
  }

  #renameDialog(username) {
    const user = this.users.find(u => u.username === username);
    this.app.modal.open(`<h3>Full name of ${esc(username)}</h3>
      <label>Full name (first and last name)</label><input id="rf" value="${esc(user ? user.fullName : '')}" autocomplete="off">
      <p class="mu">Used on new waybills and release slips. Documents already issued keep the name they were printed with.</p>
      <div class="actions"><button class="btn o" data-action="close">Cancel</button><button class="btn" data-action="save">Save</button></div>`, {
      save: btn => this.app.busy(btn, async () => {
        const name = AuthService.checkFullName($('rf').value);
        await this.app.db.setFullName(username, name);
        if (username === this.app.me.username) this.app.me.fullName = name;
        this.app.modal.close();
        this.app.toast.show('Name saved');
        this.load();
      }),
    });
  }

  #resetDialog(username) {
    this.app.modal.open(`<h3>Reset password for ${esc(username)}</h3>
      <label>New temporary password (at least 8 characters, no spaces)</label><input id="rp" type="text" autocomplete="off">
      <p class="mu">They will be asked to choose their own password at their next sign-in.</p>
      <div class="actions"><button class="btn o" data-action="close">Cancel</button><button class="btn" data-action="reset">Reset</button></div>`, {
      reset: btn => this.app.busy(btn, async () => {
        await this.app.db.resetPassword(username, AuthService.checkPassword($('rp').value, 'The temporary password'));
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

  async #remove(username, isRequest = false) {
    const ok = await this.app.modal.confirm(isRequest ? 'Reject this request?' : 'Delete user?',
      isRequest ? `The request from <b>${esc(username)}</b> is removed. They can ask again later.`
        : `<b>${esc(username)}</b> will no longer be able to sign in. Records they made keep their name.`,
      isRequest ? 'Reject' : 'Delete user', true);
    if (!ok) return;
    await this.app.db.deleteUser(username);
    this.app.toast.show(isRequest ? 'Request rejected' : 'User deleted');
    this.load();
  }
}
