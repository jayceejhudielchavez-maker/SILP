import { Page } from './Page.js';
import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';

// Search and manage records: certificate, edit, delete (Admin)
export class RecordsPage extends Page {
  constructor(app, name = 'Records') {
    super(app, name);
  }

  get filter() { return this.app.filter; }

  render() {
    this.view.innerHTML = `${this.filter.html(this.app.records)}<div class="card tw" data-role="table"></div>`;
    this.drawTable();
  }

  onInput(e) {
    if (this.filter.update(e)) this.drawTable();
  }

  onChange(e) {
    if (this.filter.update(e)) this.drawTable();
  }

  recordsChanged() {
    this.drawTable();
  }

  actions() {
    return {
      certificate: el => this.app.openCertificate(el.dataset.id),
      edit: el => this.app.editRecord(el.dataset.id),
      delete: el => this.app.deleteRecord(el.dataset.id),
      sortBy: el => {
        this.filter.sortBy(el.dataset.key);
        this.filter.syncControls(this.view);
        this.drawTable();
      },
    };
  }

  drawTable() {
    const table = this.view.querySelector('[data-role=table]');
    if (!table) return;
    const list = this.filter.apply(this.app.records);
    this.view.querySelector('[data-role=count]').textContent = `${list.length} of ${this.app.records.length} records`;
    table.innerHTML = this.tableHtml(list);
  }

  tableHtml(list) {
    const admin = this.app.isAdmin;
    const f = this.filter;
    return `<table><tr>${f.th('CtrlNo', 'Ctrl No.')}${f.th('LastName', 'Name')}${f.th('School', 'School')}${f.th('Gender', 'Gender')}
        ${f.th('Birthdate', 'Birthdate')}${f.th('DateCommunion', 'First Communion')}${f.th('UpdatedAt', 'Last updated')}<th></th></tr>
      ${list.map(r => `<tr>
        <td class="mono">${esc(r.CtrlNo)}</td><td>${esc(r.sortName)}</td><td>${r.School ? esc(r.School) : '<span class="mu">—</span>'}</td><td>${esc(r.Gender)}</td>
        <td>${esc(Dates.short(r.Birthdate))}</td><td>${esc(Dates.short(r.DateCommunion))}</td>
        <td><small>${esc(Dates.stamp(r.UpdatedAt))}<br>by ${esc(r.UpdatedBy)}</small></td>
        <td style="white-space:nowrap">
          <button class="btn s" data-action="certificate" data-id="${esc(r.Id)}">Certificate</button>
          <button class="btn s o" data-action="edit" data-id="${esc(r.Id)}">Edit</button>
          ${admin ? `<button class="btn s g" data-action="delete" data-id="${esc(r.Id)}">Delete</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="8" class="mu">No matching records.</td></tr>'}</table>`;
  }
}
