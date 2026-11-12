import { Page } from './Page.js';
import { $, esc, num } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { CommunionRecord } from '../models/CommunionRecord.js';
import { RecordFilter } from '../models/RecordFilter.js';
import { ExcelEncoder, TEMPLATE_URL } from '../services/ExcelEncoding.js';

const FORM_KEYS = ['Year', 'LastName', 'FirstName', 'MiddleName', 'Suffix', 'Birthdate', 'Birthplace', 'Gender', 'School',
  'FatherName', 'MotherName', 'DateBaptized', 'ChurchBaptized', 'BaptismMinister', 'DateCommunion', 'CommunionMinister'];

// New Entry: add a communicant, or edit one (its Control No. never changes)
export class EntryPage extends Page {
  constructor(app) {
    super(app, 'New Entry');
    this.editing = null;   // the CommunionRecord being edited, or null for a new one
    this.excel = new ExcelEncoder(app);
  }

  edit(record) {
    this.editing = record.clone();
    this.app.go(this.name);
  }

  render() {
    const r = this.editing || CommunionRecord.blank();
    const editing = !!this.editing;
    const input = (k, label, type = 'text', extra = '') =>
      `<div><label for="f_${k}">${label}</label><input id="f_${k}" data-field="${k}" type="${type}" value="${esc(r[k])}" ${extra}></div>`;
    const minister = 'placeholder="e.g. Rev. Fr. Juan Dela Cruz"';   // printed as "By the Rev. Fr. Juan Dela Cruz"

    this.view.innerHTML = `
      <div id="formNote"></div>
      ${editing ? '' : `<div class="card" style="margin-bottom:12px">
        <div class="row"><b>Encode many at once from Excel</b>
          <span class="mu">Fill in the template, then upload it. Each row becomes a new record with its own Control No.</span></div>
        <div class="row" style="margin-top:8px">
          <a class="btn o" href="${TEMPLATE_URL}" download>Download Excel template</a>
          <button class="btn" data-action="uploadExcel">Upload filled Excel…</button>
        </div></div>`}
      ${editing ? `<div class="note" style="margin-bottom:12px">Editing <b class="mono">${esc(r.CtrlNo)}</b>. The Control No. and year stay the same.
        <button class="btn s o" data-action="clear">Cancel editing</button></div>` : ''}
      <div class="card">
        <div class="grid g4">
          <div><label for="f_Year">Year</label>
            <select id="f_Year" data-field="Year" ${editing ? 'disabled title="The year of a saved record cannot change"' : ''}>
              ${EntryPage.#years(r.Year).map(y => `<option ${y === r.Year ? 'selected' : ''}>${y}</option>`).join('')}
            </select></div>
          <div><label>Control No.</label><input readonly value="${editing ? esc(r.CtrlNo) : ''}" placeholder="${editing ? '' : 'Automatic'}">
            <small id="ctrlHint"></small></div>
        </div>
        <h3 style="margin-top:18px">Personal details</h3>
        <div class="grid g4">
          ${input('LastName', 'Last Name *')}${input('FirstName', 'First Name *')}${input('MiddleName', 'Middle Name')}${input('Suffix', 'Suffix (Jr., III)')}
          ${input('Birthdate', 'Birthdate', 'date')}
          ${input('Birthplace', 'Birthplace')}
          <div><label>Age</label><input id="f_Age" readonly><small>At First Communion</small></div>
          <div><label for="f_Gender">Gender *</label><select id="f_Gender" data-field="Gender">
            ${['', 'Male', 'Female'].map(g => `<option value="${g}" ${r.Gender === g ? 'selected' : ''}>${g || 'Select…'}</option>`).join('')}</select></div>
        </div>
        <div class="grid g2">${input('FatherName', "Father's Name")}${input('MotherName', "Mother's Name")}</div>
        <div class="grid g2"><div>
          <label for="f_School">School</label>
          <input id="f_School" data-field="School" list="schoolList" value="${esc(r.School)}" placeholder="Start typing to pick a school already used">
          <datalist id="schoolList">${RecordFilter.schools(this.app.records).filter(s => s !== CommunionRecord.NO_SCHOOL)
            .map(s => `<option value="${esc(s)}">`).join('')}</datalist>
          <small>For sorting and the waybill only. It is not printed on the certificate.</small>
        </div></div>
        <h3 style="margin-top:18px">Baptism</h3>
        <div class="grid g3">${input('DateBaptized', 'Date Baptized', 'date')}${input('ChurchBaptized', 'Church Baptized')}${input('BaptismMinister', 'Minister', 'text', minister)}</div>
        <h3 style="margin-top:18px">First Holy Communion</h3>
        <div class="grid g3">${input('DateCommunion', 'Date Received Communion', 'date')}${input('CommunionMinister', 'Minister', 'text', minister)}</div>
        <div class="actions">
          <button class="btn o" data-action="clear">Clear</button>
          <button class="btn o" data-action="saveAndCertificate">Save and Certificate</button>
          <button class="btn" data-action="save">Save</button>
        </div>
      </div>`;
    this.#updateAge();
    this.#updateCtrlHint();
  }

  // Next year down to 1950 (for old records being encoded), newest first; keeps an older year if editing one
  static #years(current) {
    const top = new Date().getFullYear() + 1;
    const list = [];
    for (let y = top; y >= 1950; y--) list.push(String(y));
    if (current && !list.includes(current)) list.push(current);
    return list;
  }

  actions() {
    return {
      save: btn => this.#save(btn, false),
      saveAndCertificate: btn => this.#save(btn, true),
      clear: () => this.clear(),
      uploadExcel: btn => this.app.busy(btn, () => this.excel.start()),
    };
  }

  onInput(e) {
    const field = e.target.dataset.field;
    if (field === 'Birthdate' || field === 'DateCommunion') this.#updateAge();
    if (field === 'Year') this.#updateCtrlHint();
  }

  clear() {
    this.editing = null;
    this.render();
  }

  // Warn if someone else changed the record being edited
  recordsChanged() {
    if (!this.editing || !this.editing.Id) return;
    const now = this.app.recordById(this.editing.Id);
    const note = $('formNote');
    if (!note || (now && now.UpdatedAt === this.editing.UpdatedAt)) return;
    note.innerHTML = `<div class="note bad">${now
      ? `This record was just changed by <b>${esc(now.UpdatedBy)}</b> on another laptop. Saving now will be blocked; open it again from Records to see the latest version.`
      : 'This record was deleted on another laptop.'}</div>`;
  }

  #readForm() {
    const r = this.editing ? this.editing.clone() : CommunionRecord.blank();
    for (const k of FORM_KEYS) r[k] = $('f_' + k).value.trim();
    r.School = RecordFilter.matchSchool(r.School, this.app.records);
    return r;
  }

  #updateAge() {
    const age = Dates.age($('f_Birthdate').value, $('f_DateCommunion').value || Dates.today());
    $('f_Age').value = age === '' ? '' : age;
  }

  #updateCtrlHint() {
    if (this.editing) return;
    const year = $('f_Year').value.trim();
    const max = this.app.records.filter(r => r.Year === year).reduce((m, r) => Math.max(m, num(r.Seq)), 0);
    const next = /^\d{4}$/.test(year) ? `${year}-${String(max + 1).padStart(4, '0')}` : '—';
    $('ctrlHint').textContent = `Given when saved (next is about ${next})`;
  }

  #save(btn, thenCertificate) {
    const record = this.#readForm();
    const problem = record.validate();
    if (problem) return this.app.toast.show(problem, true);
    return this.app.busy(btn, async () => {
      const wasEditing = !record.isNew;
      const saved = await this.app.db.saveRecord(record, wasEditing ? this.editing.UpdatedAt : '');
      this.app.upsertRecord(saved);
      this.app.toast.show(`Saved ${saved.CtrlNo} · ${saved.fullName}`);
      this.editing = null;
      if (thenCertificate) this.app.openCertificate(saved.Id);
      else if (wasEditing) this.app.go('Records');
      else this.render();
    });
  }
}
