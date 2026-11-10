import { RecordsPage } from './RecordsPage.js';
import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { CommunionRecord } from '../models/CommunionRecord.js';
import { Exporter, Importer } from '../services/DataTransfer.js';

// Every field in one table, downloads, and (Admin) backups, import and restore.
// Extends RecordsPage: same search/year filter and delete button, different table.
export class DatabasePage extends RecordsPage {
  constructor(app) {
    super(app, 'Database');
    this.exporter = new Exporter(app);
    this.importer = new Importer(app);
    this.backups = [];
  }

  render() {
    const admin = this.app.isAdmin;
    this.view.innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div class="row"><b>Download</b><span class="mu">Excel, PDF and CSV use the search and year filter below. The JSON backup always has everything.</span></div>
        <div class="row" style="margin-top:8px">
          <button class="btn o" data-action="xlsx">Excel (.xlsx)</button>
          <button class="btn o" data-action="pdf">PDF</button>
          <button class="btn o" data-action="csv">CSV</button>
          <button class="btn" data-action="json">JSON backup</button>
        </div>
        ${admin ? `<div class="row" style="margin-top:14px"><b>Restore / import</b>
          <span class="mu">From an Excel file or a JSON backup. A full backup of the current data is saved in the database first.</span></div>
          <div class="row" style="margin-top:8px"><button class="btn o" data-action="import">Choose file…</button></div>` : ''}
      </div>
      ${admin ? `<div class="card" style="margin-bottom:12px">
        <div class="row"><b>Backups in the database</b><span class="mu">Made automatically before every import, or on request.</span><span class="sp"></span>
          <button class="btn s o" data-action="backupNow">Back up now</button></div>
        <div data-role="backups" style="margin-top:8px">Loading…</div></div>` : ''}
      ${this.filter.html(this.app.records)}
      <div class="card tw" data-role="table"></div>`;
    this.drawTable();
    if (admin) this.drawBackups();
  }

  actions() {
    const filtered = () => this.filter.apply(this.app.records);
    return Object.assign(super.actions(), {
      xlsx: btn => this.app.busy(btn, () => this.exporter.excel(filtered())),
      pdf: btn => this.app.busy(btn, () => this.exporter.pdf(filtered())),
      csv: btn => this.app.busy(btn, () => this.exporter.csv(filtered())),
      json: btn => this.app.busy(btn, () => this.exporter.backup()),
      import: btn => this.app.busy(btn, () => this.importer.start()),
      backupNow: btn => this.app.busy(btn, () => this.#backupNow()),
      restoreBackup: el => this.#restoreBackup(Number(el.dataset.id)),
    });
  }

  tableHtml(list) {
    const admin = this.app.isAdmin;
    const cell = (r, k) => k === 'Age' ? r.age : /At$/.test(k) ? Dates.stamp(r[k]) : r[k];
    return `<table style="font-size:13px;white-space:nowrap">
      <tr>${CommunionRecord.FIELDS.map(([, l]) => `<th>${l}</th>`).join('')}${admin ? '<th></th>' : ''}</tr>
      ${list.map(r => `<tr>${CommunionRecord.FIELDS.map(([k]) => `<td>${esc(cell(r, k))}</td>`).join('')}
        ${admin ? `<td><button class="btn s g" data-action="delete" data-id="${esc(r.Id)}">Delete</button></td>` : ''}</tr>`).join('')
        || `<tr><td colspan="${CommunionRecord.FIELDS.length}" class="mu">No matching records.</td></tr>`}</table>`;
  }

  async drawBackups() {
    const box = this.view.querySelector('[data-role=backups]');
    if (!box) return;
    try {
      this.backups = await this.app.db.listBackups();
      box.innerHTML = this.backups.length ? `<div class="tw" style="max-height:220px"><table>
        <tr><th>Backup</th><th>Records</th><th>Note</th><th>Made</th><th></th></tr>
        ${this.backups.map(b => `<tr><td class="mono">#${b.id}</td><td>${b.row_count}</td><td>${esc(b.note)}</td>
          <td><small>${esc(Dates.stamp(b.created_at))} by ${esc(b.created_by)}</small></td>
          <td><button class="btn s o" data-action="restoreBackup" data-id="${b.id}">Restore</button></td></tr>`).join('')}</table></div>`
        : '<p class="mu">No backups yet.</p>';
    } catch (e) {
      box.innerHTML = `<div class="note bad">${esc(e.message)}</div>`;
    }
  }

  async #backupNow() {
    const id = await this.app.db.makeBackup();
    this.app.toast.show(`Backup #${id} saved`);
    this.drawBackups();
  }

  async #restoreBackup(id) {
    const b = this.backups.find(x => x.id === id);
    if (!b) return;
    const ok = await this.app.modal.confirm(`Restore backup #${id}?`,
      `The records become exactly what they were on <b>${esc(Dates.stamp(b.created_at))}</b> (${b.row_count} records). Records added since then disappear.
       The current data is backed up first, so this can be undone.`, 'Restore', true);
    if (!ok) return;
    const res = await this.app.db.restoreBackup(id);
    await this.app.reloadRecords();
    this.app.toast.show(`Backup #${id} restored · current data kept as backup #${res.backup_id}`);
    this.render();
  }
}
