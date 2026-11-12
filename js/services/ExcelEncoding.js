import { $, esc, AppError } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { Files } from '../utils/Files.js';
import { Libraries } from '../utils/Libraries.js';
import { CommunionRecord } from '../models/CommunionRecord.js';
import { RecordFilter } from '../models/RecordFilter.js';

// The blank sheet encoders fill in (public/templates/). Its headers are in row 5, under a title.
export const TEMPLATE_URL = 'templates/FirstCommunion-Encoding-Template.xlsx';
const MAX_ROWS = 1000;

// Other names people give the same columns in their own spreadsheets
const ALIASES = {
  'sex': 'gender', 'date of birth': 'birthdate', 'birth date': 'birthdate', 'birthday': 'birthdate',
  'place of birth': 'birthplace', 'father': "father's name", 'mother': "mother's name",
  'date of baptism': 'date baptized', 'baptism date': 'date baptized', 'church of baptism': 'church baptized',
  'date of communion': 'date received communion', 'date of first communion': 'date received communion',
  'communion date': 'date received communion', 'ctrl no.': 'control no.', 'control no': 'control no.',
  'school name': 'school', 'name of school': 'school', 'paaralan': 'school',
};
const DATE_COLUMNS = new Set(['birthdate', 'date baptized', 'date received communion']);

// "Last Name *" → "last name", "Gender * (Male/Female)" → "gender"
const cleanHeader = h => {
  const s = String(h ?? '').replace(/\*/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return ALIASES[s] || s;
};

// The template's gray example row ("e.g." in the No. column) is never saved
const isExample = values => /^(e\.?g\.?|example)$/i.test(String(values['no.'] || '').trim());

// Excel keeps dates as day numbers (25569 = 1970-01-01). Working in UTC keeps the day from shifting.
function excelDate(v) {
  if (typeof v === 'number' && v > 0 && v < 2958466) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return Dates.normalize(v);   // dates typed as text: 05/15/2018, 2018-05-15, May 15, 2018
}

// "2018-13-05" (day and month swapped) is rejected, not saved as a wrong date
function isRealDate(iso) {
  const p = Dates.parse(iso);
  if (!p) return false;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return d.getUTCMonth() === p.m - 1 && d.getUTCDate() === p.d;
}

export class Spreadsheet {
  // Reads the first sheet with a header row containing "Last Name" and "First Name" (it may sit
  // under a title, as in the template). Returns { sheet, rows: [{ row: Excel row number, values }] },
  // where values are keyed by the cleaned header, e.g. values['last name'].
  static async read(file) {
    await Libraries.load('xlsx');
    const XLSX = window.XLSX;
    let book;
    try {
      book = XLSX.read(await file.arrayBuffer(), { cellDates: false });
    } catch (e) {
      throw new AppError('That file could not be opened as a spreadsheet: ' + e.message);
    }
    for (const name of book.SheetNames) {
      const ws = book.Sheets[name];
      if (!ws['!ref']) continue;
      const opts = { header: 1, defval: '', blankrows: true };
      const raw = XLSX.utils.sheet_to_json(ws, { ...opts, raw: true });     // dates as day numbers
      const text = XLSX.utils.sheet_to_json(ws, { ...opts, raw: false });   // everything else as shown in Excel
      const h = raw.slice(0, 30).findIndex(r => {
        const c = r.map(cleanHeader);
        return c.includes('last name') && c.includes('first name');
      });
      if (h < 0) continue;
      const headers = raw[h].map(cleanHeader);
      const top = XLSX.utils.decode_range(ws['!ref']).s.r;   // 0 when the sheet starts at row 1
      const rows = [];
      for (let i = h + 1; i < raw.length; i++) {
        const values = {};
        headers.forEach((key, c) => {
          if (!key) return;
          values[key] = DATE_COLUMNS.has(key) ? excelDate(raw[i][c]) : String(text[i][c] ?? '').trim();
        });
        rows.push({ row: top + i + 1, values });
      }
      return { sheet: name, rows };
    }
    throw new AppError('No header row was found. The file needs column names like "Last Name" and "First Name". ' +
      'Download the Excel template from the New Entry page and type the records there.');
  }

  // For the Admin's restore/import: plain rows, without the template's example row
  static async readRows(file) {
    return (await Spreadsheet.read(file)).rows.filter(r => !isExample(r.values)).map(r => r.values);
  }
}

// New Entry → "Upload filled Excel…": every row becomes a new record with its own Control No.
// Uses the same save_record function as the form, so Staff can do it and nothing is overwritten.
export class ExcelEncoder {
  constructor(app) {
    this.app = app;
  }

  async start() {
    const file = await Files.pick('.xlsx,.xls,.csv');
    if (!file) return;
    const { rows } = await Spreadsheet.read(file);
    const items = this.#check(rows);
    if (!items.length) {
      throw new AppError('The file has no communicants yet. Type them from row 7 of the "Encode Here" sheet, save the file, then upload it again.');
    }
    if (items.length > MAX_ROWS) throw new AppError(`The file has ${items.length} rows. Upload at most ${MAX_ROWS} at a time.`);
    this.#preview(file.name, items);
  }

  // Each row becomes { row, record, status: 'ok' | 'bad' | 'dup', note }
  #check(rows) {
    const key = r => [r.LastName, r.FirstName, r.Birthdate].map(s => String(s).trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
    const existing = new Map(this.app.records.map(r => [key(r), r.CtrlNo]));
    const seen = new Map();
    const items = [];

    for (const { row, values } of rows) {
      if (isExample(values)) continue;
      if (!['last name', 'first name', 'middle name'].some(k => values[k])) continue;   // empty row

      const g = String(values.gender || '').trim().toLowerCase();
      if (g === 'lalaki') values.gender = 'Male';
      if (g === 'babae') values.gender = 'Female';

      const record = CommunionRecord.fromImport(values);
      // Always a new record: the server gives the Control No.
      for (const k of ['Id', 'CtrlNo', 'Seq', 'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt']) record[k] = '';
      // Same spelling as a school already saved, or as an earlier row of this file
      record.School = RecordFilter.matchSchool(record.School, [...this.app.records, ...items.map(i => i.record)]);

      const problems = [];
      if (g && !record.Gender) problems.push(`Gender "${values.gender}" must be Male or Female.`);
      for (const [k, label] of [['Birthdate', 'Birthdate'], ['DateBaptized', 'Date Baptized'], ['DateCommunion', 'Date Received Communion']]) {
        if (record[k] && !isRealDate(record[k])) problems.push(`${label} "${record[k]}" is not a date. Type it like 05/15/2018.`);
      }
      if (!problems.length) {
        const p = record.validate();
        if (p) problems.push(p);
      }

      let status = problems.length ? 'bad' : 'ok';
      let note = problems.join(' ');
      if (status === 'ok') {
        const k = key(record);
        if (existing.has(k)) { status = 'dup'; note = `Already in the system as ${existing.get(k)}.`; }
        else if (seen.has(k)) { status = 'dup'; note = `Same child as row ${seen.get(k)} of this file.`; }
        else seen.set(k, row);
      }
      items.push({ row, record, status, note });
    }
    return items;
  }

  #preview(fileName, items) {
    const count = s => items.filter(i => i.status === s).length;
    const ok = count('ok'), bad = count('bad'), dup = count('dup');
    const label = { ok: 'Ready', bad: 'Fix in Excel', dup: 'Duplicate' };
    const date = iso => Dates.short(iso) || iso;
    const saveLabel = n => `Save ${n} record${n === 1 ? '' : 's'}`;

    this.app.modal.open(`<h3>Upload from Excel</h3>
      <p class="mu">${esc(fileName)} · ${items.length} row(s) with names</p>
      <p><b>${ok}</b> ready to save${dup ? ` · <b>${dup}</b> look like duplicates` : ''}${bad ? ` · <b class="imp-bad">${bad}</b> need fixing` : ''}</p>
      ${bad ? `<div class="note bad" style="margin-bottom:10px">Rows marked <b>Fix in Excel</b> will not be saved. Correct them in the file and upload it again.
        The rows saved this time will then show as duplicates, so nobody is saved twice.</div>` : ''}
      <div class="tw" style="max-height:45vh"><table style="font-size:13px">
        <tr><th>Excel row</th><th>Name</th><th>School</th><th>Gender</th><th>Birthdate</th><th>Communion</th><th>Status</th></tr>
        ${items.map(i => `<tr><td class="mono">${i.row}</td><td>${esc(i.record.sortName)}</td><td>${esc(i.record.School)}</td><td>${esc(i.record.Gender)}</td>
          <td>${esc(date(i.record.Birthdate))}</td><td>${esc(date(i.record.DateCommunion))}</td>
          <td><b class="imp-${i.status}">${label[i.status]}</b>${i.note ? `<br><small>${esc(i.note)}</small>` : ''}</td></tr>`).join('')}
      </table></div>
      ${dup ? '<label class="chk" style="margin-top:10px"><input type="checkbox" id="impDup"> Also save the rows marked Duplicate</label>' : ''}
      <p class="mu" style="font-size:12px;margin-top:10px">Control Nos. are given in the order of the rows in the file.</p>
      <div class="actions"><button class="btn o" data-action="close">Cancel</button>
        <button class="btn" id="impSave" data-action="save">${saveLabel(ok)}</button></div>`, {
      save: () => {
        const withDup = !!($('impDup') && $('impDup').checked);
        const list = items.filter(i => i.status === 'ok' || (withDup && i.status === 'dup'));
        if (!list.length) return this.app.toast.show('Nothing to save. Fix the rows in Excel and upload again.', true);
        return this.#save(fileName, list);
      },
    }, true);
    if ($('impDup')) $('impDup').onchange = e => { $('impSave').textContent = saveLabel(ok + (e.target.checked ? dup : 0)); };
  }

  // One save_record call per row, in file order. A failed row is reported and the rest continue.
  async #save(fileName, list) {
    const saved = [], failed = [];
    this.app.modal.open(`<h3>Saving…</h3><p><b id="impProg">0</b> of ${list.length}</p>
      <div class="note">Please keep this page open until it finishes.</div>`);
    let failsInARow = 0;
    for (const item of list) {
      try {
        const r = await this.app.db.saveRecord(item.record, '');
        saved.push(r);
        this.app.upsertRecord(r);
        failsInARow = 0;
      } catch (e) {
        if (e.silent) throw e;   // the session ended; the app already shows the sign-in screen
        failed.push({ row: item.row, message: e.message });
        if (++failsInARow >= 5) break;   // probably offline: stop instead of failing every row
      }
      if ($('impProg')) $('impProg').textContent = saved.length + failed.length;
    }
    const notTried = list.length - saved.length - failed.length;

    let doc = null, logError = '';
    if (saved.length) {
      try {
        doc = await this.app.db.logDocument({
          type: 'Excel encoding',
          detail: `${saved.length} record(s) from ${fileName} · ${saved[0].CtrlNo} to ${saved[saved.length - 1].CtrlNo}`,
        });
      } catch (e) {
        logError = e.message;
      }
    }
    await this.app.reloadRecords().catch(() => {});

    this.app.modal.open(`<h3>Upload finished</h3>
      <p><b>${saved.length}</b> saved${failed.length ? ` · <b class="imp-bad">${failed.length}</b> not saved` : ''}${notTried ? ` · <b>${notTried}</b> not tried` : ''}</p>
      ${saved.length ? `<p>Control Nos. <b class="mono">${esc(saved[0].CtrlNo)}</b> to <b class="mono">${esc(saved[saved.length - 1].CtrlNo)}</b>
        ${doc ? ` · logged as <b class="mono">${esc(doc.docNo)}</b>` : ''}</p>` : ''}
      ${failed.length ? `<div class="note bad">${failed.map(f => `Row ${f.row}: ${esc(f.message)}`).join('<br>')}</div>` : ''}
      ${notTried ? '<div class="note bad" style="margin-top:8px">Saving stopped after several errors in a row. Check the internet connection, then upload the same file again. Rows already saved will show as duplicates.</div>' : ''}
      ${logError ? `<div class="note bad" style="margin-top:8px">The records were saved, but the Document Log entry failed: ${esc(logError)}</div>` : ''}
      <div class="actions"><button class="btn o" data-action="close">Close</button>
        <button class="btn" data-action="records">See records</button></div>`, {
      records: () => { this.app.modal.close(); this.app.go('Records'); },
    });
  }
}
