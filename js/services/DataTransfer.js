import { esc, AppError } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { Files } from '../utils/Files.js';
import { Libraries } from '../utils/Libraries.js';
import { PARISH, PARISH_PLACE } from '../config.js';
import { CommunionRecord } from '../models/CommunionRecord.js';
import { CertificateTemplate } from '../certificate/CertificateTemplate.js';
import { Spreadsheet } from './ExcelEncoding.js';

// Downloads. Each one is written to the Document Log first, so it is known who exported what.
export class Exporter {
  constructor(app) {
    this.app = app;
  }

  #log(type, count) {
    return this.app.db.logDocument({ type, detail: `${count} record(s)` });
  }

  #fileName(ext) {
    return `First Communion ${Dates.today()}.${ext}`;
  }

  async excel(list) {
    await Libraries.load('xlsx');
    const doc = await this.#log('Export Excel', list.length);
    const XLSX = window.XLSX;
    const book = XLSX.utils.book_new();
    const headers = CommunionRecord.FIELDS.map(([, label]) => label);
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(list.map(r => r.exportRow()), { header: headers }), 'Communicants');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      [`${PARISH}, ${PARISH_PLACE}`], ['First Holy Communion records'],
      ['Document No.', doc.docNo], ['Prepared by', doc.byName], ['Date', Dates.stamp(doc.at)], ['Records', list.length],
    ]), 'Info');
    XLSX.writeFile(book, this.#fileName('xlsx'));
    this.app.toast.show(`Excel downloaded · ${doc.docNo}`);
  }

  async csv(list) {
    const doc = await this.#log('Export CSV', list.length);
    const cell = v => {
      let s = String(v === undefined || v === null ? '' : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;   // stops spreadsheet formula injection
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = CommunionRecord.FIELDS.map(([, label]) => label);
    const lines = [headers.map(cell).join(','), ...list.map(r => { const row = r.exportRow(); return headers.map(h => cell(row[h])).join(','); })];
    Files.download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), this.#fileName('csv'));
    this.app.toast.show(`CSV downloaded · ${doc.docNo}`);
  }

  async pdf(list) {
    await Libraries.load('jspdf', 'autotable');
    const doc = await this.#log('Export PDF', list.length);
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'legal' });
    pdf.setFontSize(13);
    pdf.text(`${PARISH} · ${PARISH_PLACE}`, 36, 34);
    pdf.setFontSize(9);
    pdf.text(`First Holy Communion records · ${list.length} record(s) · ${doc.docNo} · prepared by ${doc.byName} · ${Dates.stamp(doc.at)}`, 36, 50);
    const cols = [['CtrlNo', 'Ctrl No.'], ['Name', 'Name'], ['School', 'School'], ['Gender', 'Gender'], ['Birthdate', 'Birthdate'], ['Age', 'Age'],
      ['Birthplace', 'Birthplace'], ['FatherName', 'Father'], ['MotherName', 'Mother'], ['DateBaptized', 'Baptized'],
      ['ChurchBaptized', 'Church'], ['BaptismMinister', 'Bapt. Minister'], ['DateCommunion', 'Communion'],
      ['CommunionMinister', 'Comm. Minister'], ['UpdatedBy', 'Updated by']];
    pdf.autoTable({
      startY: 62, head: [cols.map(c => c[1])], styles: { fontSize: 7, cellPadding: 3 }, headStyles: { fillColor: [30, 91, 64] },   // the app's dark green
      body: list.map(r => cols.map(([k]) => k === 'Name' ? r.sortName : k === 'Age' ? String(r.age) : (r[k] || ''))),
    });
    pdf.save(this.#fileName('pdf'));
    this.app.toast.show(`PDF downloaded · ${doc.docNo}`);
  }

  // Everything: all records, the template and its pictures
  async backup() {
    const records = this.app.records;
    const doc = await this.#log('JSON backup', records.length);
    const data = { app: 'FirstCommunionRecords', version: 1, exportedAt: doc.at, exportedBy: doc.byName, docNo: doc.docNo,
      records, template: this.app.template.toJSON(), images: this.app.images };
    Files.download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `First Communion backup ${Dates.today()}.json`);
    this.app.toast.show(`Backup downloaded · ${doc.docNo}`);
  }
}

// Restore / import from Excel or a JSON backup (Admin)
export class Importer {
  constructor(app) {
    this.app = app;
  }

  // Reads the chosen file into records (and template + pictures for JSON backups)
  static async read(file) {
    let rows = [], template = null, images = null;
    if (/\.json$/i.test(file.name)) {
      let json;
      try { json = JSON.parse(await file.text()); } catch (e) { throw new AppError('That JSON file could not be read: ' + e.message); }
      rows = Array.isArray(json) ? json : (json.records || []);
      template = json.template || null;
      images = json.images || null;
    } else {
      rows = await Spreadsheet.readRows(file);   // finds the header row, so the encoding template works here too
    }
    const records = rows.map(r => CommunionRecord.fromImport(r)).filter(r => r.LastName || r.FirstName);
    if (!records.length) {
      throw new AppError('No records were found in that file. The first row must have column names like "Last Name" and "First Name".');
    }
    return { records, template, images };
  }

  async start() {
    const file = await Files.pick('.xlsx,.xls,.csv,.json');
    if (!file) return;
    const data = await Importer.read(file);
    this.app.modal.open(`<h3>Import ${data.records.length} record(s)</h3>
      <p class="mu">From <b>${esc(file.name)}</b></p>
      <label><input type="radio" name="imode" value="merge" checked> <b>Merge</b>: add new records and update ones with the same Control No.</label>
      <label><input type="radio" name="imode" value="replace"> <b>Replace all</b>: the database becomes exactly this file</label>
      ${data.template ? '<label class="chk" style="margin-top:12px"><input type="checkbox" id="itpl" checked> Also restore the certificate template and pictures</label>' : ''}
      <div class="note" style="margin-top:12px">Before anything changes, a full backup of the current records is saved in the database. You can restore it from the Database page.</div>
      <div class="actions"><button class="btn o" data-action="close">Cancel</button><button class="btn d" data-action="run">Import now</button></div>`, {
      run: btn => this.app.busy(btn, () => this.#run(data)),
    });
  }

  async #run({ records, template, images }) {
    const mode = document.querySelector('input[name=imode]:checked').value;
    const withTemplate = !!(template && document.getElementById('itpl') && document.getElementById('itpl').checked);
    const res = await this.app.db.restoreRecords(records, mode);
    if (withTemplate) {
      for (const [key, data] of Object.entries(images || {})) await this.app.db.saveImage(key, data);
      await this.app.db.saveTemplate(new CertificateTemplate(template));
      await this.app.loadTemplate();
    }
    await this.app.reloadRecords();
    this.app.modal.open(`<h3>Import finished</h3>
      <p><b>${res.added}</b> added · <b>${res.updated}</b> updated · <b>${res.skipped}</b> skipped${withTemplate ? ' · template restored' : ''}</p>
      <p class="mu">The previous data was saved as <b>backup #${esc(res.backup_id)}</b> (Database page).</p>
      ${res.errors.length ? `<div class="note bad">${res.errors.map(esc).join('<br>')}</div>` : ''}
      <div class="actions"><button class="btn" data-action="done">Done</button></div>`, {
      done: () => { this.app.modal.close(); this.app.go('Database'); },
    });
  }
}
