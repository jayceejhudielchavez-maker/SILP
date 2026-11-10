import { SUPABASE_URL, SUPABASE_KEY, EMAIL_DOMAIN } from './config.js';
import { $, esc } from './utils/helpers.js';
import { Database } from './services/Database.js';
import { AuthService } from './services/AuthService.js';
import { LiveSync } from './services/LiveSync.js';
import { RecordFilter } from './models/RecordFilter.js';
import { CertificateTemplate, DefaultImages } from './certificate/CertificateTemplate.js';
import { CertificateRenderer } from './certificate/CertificateRenderer.js';
import { FontLoader } from './certificate/FontLoader.js';
import { Slips } from './certificate/Slips.js';
import { Toast } from './ui/Toast.js';
import { Modal } from './ui/Modal.js';
import { ErrorBar } from './ui/ErrorBar.js';
import { AuthView } from './ui/AuthView.js';
import { Theme } from './ui/Theme.js';
import { PasswordReveal } from './ui/PasswordReveal.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { EntryPage } from './pages/EntryPage.js';
import { RecordsPage } from './pages/RecordsPage.js';
import { DatabasePage } from './pages/DatabasePage.js';
import { CertificatePage } from './pages/CertificatePage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { TemplatePage } from './pages/TemplatePage.js';
import { UsersPage } from './pages/UsersPage.js';

// The application: signs people in, keeps the shared data (records, template, who is signed in),
// and switches between pages. Each page is its own class in js/pages/.
export class App {
  constructor() {
    this.toast = new Toast($('toast'));
    this.errors = new ErrorBar($('errbar'), $('errtext'), $('errclose'));
    this.modal = new Modal($('modal'), e => this.fail(e));
    this.authView = new AuthView(this);
    this.fonts = new FontLoader();
    this.filter = new RecordFilter();

    this.db = null;
    this.auth = null;
    this.live = null;

    this.me = null;            // { username, role }
    this.records = [];         // CommunionRecord[]
    this.template = CertificateTemplate.createDefault();
    this.images = {};          // certificate pictures by key
    this.currentPage = null;

    // Sidebar order
    this.pages = new Map([DashboardPage, EntryPage, RecordsPage, DatabasePage, CertificatePage, DocumentsPage, TemplatePage, UsersPage]
      .map(PageClass => { const page = new PageClass(this); return [page.name, page]; }));

    this.errors.watchWindow();
    Theme.install();
    PasswordReveal.install(document.body);
  }

  get isAdmin() { return !!this.me && this.me.role === 'Admin'; }

  // ----- signing in

  async start() {
    try {
      this.db = new Database(SUPABASE_URL, SUPABASE_KEY);
      this.db.onSessionEnded = () => this.sessionExpired();
      this.auth = new AuthService(this.db, EMAIL_DOMAIN);
      this.auth.onSignedOut(() => { if (this.me) this.sessionExpired(); });

      if (await this.auth.hasSession()) {
        try {
          return await this.enter();
        } catch (e) {
          if (e.silent) return;
          await this.auth.signOut();
          return this.authView.showLogin(e.message);
        }
      }
      if (await this.db.needsSetup()) this.authView.showSetup();
      else this.authView.showLogin();
    } catch (e) {
      this.authView.fatal(e.message);
    }
  }

  // After signing in: choose a new password first if the Admin set a temporary one
  async enter() {
    const me = await this.auth.profile();
    if (me.pending) {
      await this.auth.signOut();
      return this.authView.showLogin(`Your account "${me.username}" is waiting for the Admin's approval. Try again once they approve it.`);
    }
    if (me.mustChange) return this.authView.showForcedPassword();
    if (!me.fullName) return this.authView.showFullName(me.username);   // required: it goes on waybills
    await this.boot(me);
  }

  async setMyFullName(fullName) {
    await this.auth.setMyFullName(fullName);
    await this.enter();
  }

  async requestAccount(fullName, username, password) {
    const u = await this.auth.requestAccount(fullName, username, password);
    this.authView.showLogin(`Request sent for "${u}". Ask the Admin to approve it under Users, then sign in with that username and password.`);
  }

  async signIn(username, password) {
    await this.auth.signIn(username, password);
    try {
      await this.enter();
    } catch (e) {
      if (!this.me) await this.auth.signOut();
      throw e;
    }
  }

  async createFirstAdmin(fullName, username, password) {
    await this.boot(await this.auth.createFirstAdmin(fullName, username, password));
  }

  async setNewPassword(password) {
    await this.auth.setNewPassword(password);
    await this.enter();
  }

  async boot(me) {
    this.me = me;
    this.records = await this.db.loadRecords();
    await this.loadTemplate();
    this.renderShell();
    this.go('Dashboard', true);
    this.startLive();
  }

  sessionExpired() {
    this.stopLive();
    this.me = null;
    this.modal.close();
    this.authView.showLogin('Your session ended. Please sign in again.');
  }

  async logout() {
    if (this.currentPage && !this.currentPage.canLeave()) return;
    this.stopLive();
    if (this.currentPage) this.currentPage.leave();
    this.currentPage = null;
    this.me = null;
    await this.auth.signOut();
    this.authView.showLogin();
  }

  changePasswordDialog() {
    this.modal.open(`<h3>Change my password</h3>
      <label>Current password</label><input id="cp0" type="password" autocomplete="current-password">
      <label>New password (at least 8 characters, no spaces)</label><input id="cp1" type="password" autocomplete="new-password">
      <label>Confirm new password</label><input id="cp2" type="password" autocomplete="new-password">
      <div class="actions"><button class="btn o" data-action="close">Cancel</button><button class="btn" data-action="save">Save</button></div>`, {
      save: btn => {
        if ($('cp1').value !== $('cp2').value) return this.toast.show('The two new passwords do not match', true);
        return this.busy(btn, async () => {
          await this.auth.changePassword(this.me.username, $('cp0').value, $('cp1').value);
          this.modal.close();
          this.toast.show('Password changed');
        });
      },
    });
  }

  // ----- layout and navigation

  renderShell() {
    const root = $('app');
    root.innerHTML = `<div class="shell">
      <aside>
        <div class="brand"><img src="img/parish-logo.png" alt="">
          <div><b>First Holy Communion</b><span>San Isidro Labrador · Cuenca</span></div></div>
        <nav id="nav"></nav>
        <div class="me">Signed in as <b>${esc(this.me.fullName)}</b><br><small style="color:var(--sb-mu)">${esc(this.me.username)}</small>
          <span class="tag">${esc(this.me.role)}</span>
          ${Theme.button()}
          <button class="btn s" data-shell="password">Change password</button>
          <button class="btn s" data-shell="logout">Sign out</button></div>
      </aside>
      <main><div class="top"><h1 id="ptitle"></h1><span class="sp"></span><span id="live" class="live">● Live</span></div><div id="view"></div></main>
    </div>`;
    root.onkeydown = null;
    root.onclick = e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) return this.go(nav.dataset.nav);
      const shell = e.target.closest('[data-shell]');
      if (shell) return shell.dataset.shell === 'logout' ? this.logout() : this.changePasswordDialog();
    };
  }

  renderNav() {
    $('nav').innerHTML = [...this.pages.values()]
      .filter(p => !p.adminOnly || this.isAdmin)
      .map(p => `<a class="${p === this.currentPage ? 'on' : ''}" data-nav="${p.name}">${p.name}</a>`).join('');
  }

  go(name, force = false) {
    const next = this.pages.get(name);
    if (!next) return;
    if (next.adminOnly && !this.isAdmin) return this.toast.show('Only the Admin can open that page.', true);
    const prev = this.currentPage;
    if (!force && prev && prev !== next && !prev.canLeave()) return;
    if (prev && prev !== next) prev.leave();
    this.currentPage = next;
    this.renderNav();
    $('ptitle').textContent = next.name;
    this.modal.close();
    next.show();
    window.scrollTo(0, 0);
  }

  // ----- shared data

  recordById(id) {
    return this.records.find(r => r.Id === id) || null;
  }

  upsertRecord(record) {
    const i = this.records.findIndex(r => r.Id === record.Id);
    if (i >= 0) this.records[i] = record; else this.records.push(record);
  }

  async reloadRecords() {
    if (!this.me) return;
    this.records = await this.db.loadRecords();
    if (this.currentPage) this.currentPage.recordsChanged();
  }

  editRecord(id) {
    const r = this.recordById(id);
    if (!r) return this.toast.show('Record not found. It may have been deleted.', true);
    this.pages.get('New Entry').edit(r);
  }

  openCertificate(id) {
    this.pages.get('Certificate').open(id);
  }

  async deleteRecord(id) {
    const r = this.recordById(id);
    if (!r) return;
    const ok = await this.modal.confirm('Delete this record?',
      `<b class="mono">${esc(r.CtrlNo)}</b> · ${esc(r.fullName)}<br><br>This removes it from the database for everyone. ` +
      'The deletion is written to the Document Log. Its Control No. will not be reused.', 'Delete record', true);
    if (!ok) return;
    await this.db.deleteRecord(id);
    this.records = this.records.filter(x => x.Id !== id);
    this.toast.show(`Deleted ${r.CtrlNo}`);
    if (this.currentPage) this.currentPage.recordsChanged();
  }

  // Built-in logos first, then anything uploaded in Template → Pictures replaces them
  async loadTemplate() {
    const [t, defaults] = await Promise.all([this.db.loadTemplate(), DefaultImages.load()]);
    this.setTemplate(new CertificateTemplate(t.data), Object.assign({}, defaults, t.images));
  }

  setTemplate(template, images) {
    this.template = template;
    this.images = images || {};
    this.fonts.ensure(template);
    Slips.logo = this.images.parishLogo || '';   // waybills and slips show the parish logo
  }

  renderer() {
    return new CertificateRenderer(this.template, this.images, this.me ? this.me.fullName : '');
  }

  // ----- live updates

  startLive() {
    this.stopLive();
    this.live = new LiveSync(this.db.client, {
      onRecords: () => this.reloadRecords().catch(e => this.fail(e)),
      onTemplate: () => this.#templateChanged().catch(e => this.fail(e)),
      onStatus: ok => this.#setLive(ok),
    });
    this.live.start();
  }

  stopLive() {
    if (this.live) this.live.stop();
    this.live = null;
  }

  async #templateChanged() {
    const editor = this.pages.get('Template');
    if (editor.ignoresTemplatePulse) return;
    if (this.currentPage === editor && editor.dirty) {
      return this.toast.show('Someone saved the template on another laptop. Saving yours will replace theirs.', true);
    }
    await this.loadTemplate();
    if (this.currentPage) this.currentPage.templateChanged();
  }

  #setLive(ok) {
    const el = $('live');
    if (!el) return;
    el.className = 'live' + (ok ? '' : ' off');
    el.textContent = ok ? '● Live' : '● Reconnecting…';
  }

  // ----- feedback

  fail(e) {
    if (e && !e.silent) this.toast.show((e && e.message) || String(e), true);
  }

  // Runs a slow action with its button disabled; errors become a red message
  async busy(button, fn) {
    const label = button && button.textContent;
    if (button) { button.disabled = true; button.textContent = 'Please wait…'; }
    try {
      return await fn();
    } catch (e) {
      this.fail(e);
    } finally {
      if (button) { button.disabled = false; button.textContent = label; }
    }
  }
}
