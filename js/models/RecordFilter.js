import { esc } from '../utils/helpers.js';
import { CommunionRecord } from './CommunionRecord.js';

// Every attribute a list can be sorted by: [key, label]
const SORTS = [
  ['CtrlNo', 'Control No.'], ['LastName', 'Last Name'], ['FirstName', 'First Name'], ['MiddleName', 'Middle Name'],
  ['Suffix', 'Suffix'], ['School', 'School'], ['Gender', 'Gender'], ['Birthdate', 'Birthdate'], ['Age', 'Age'],
  ['Birthplace', 'Birthplace'], ['FatherName', "Father's Name"], ['MotherName', "Mother's Name"],
  ['DateBaptized', 'Date Baptized'], ['ChurchBaptized', 'Church Baptized'], ['BaptismMinister', 'Baptism Minister'],
  ['DateCommunion', 'Date Received Communion'], ['CommunionMinister', 'Communion Minister'], ['Year', 'Year'],
  ['CreatedBy', 'Created By'], ['CreatedAt', 'Created At'], ['UpdatedBy', 'Updated By'], ['UpdatedAt', 'Last Updated'],
];
const NUMERIC = new Set(['Age', 'Year']);
const text = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

// Search text + year + school + sort order, shared by the Records, Database and Certificate pages
export class RecordFilter {
  constructor() {
    this.query = '';
    this.year = '';
    this.school = '';
    this.sort = 'CtrlNo';
    this.dir = 'desc';   // newest Control No. first, as before
  }

  static value(r, key) {
    if (key === 'Age') return r.age;
    if (key === 'LastName') return r.sortName;   // Last, First Middle
    if (key === 'CtrlNo') return `${r.Year}-${String(r.Seq).padStart(6, '0')}`;   // 2026-0010 after 2026-0009, any length
    return r[key];
  }

  // Blanks always go last; ties fall back to the name, then the Control No.
  static compare(a, b, key, dir) {
    const va = RecordFilter.value(a, key), vb = RecordFilter.value(b, key);
    const ea = va === '' || va === null || va === undefined, eb = vb === '' || vb === null || vb === undefined;
    if (ea !== eb) return ea ? 1 : -1;
    let c = 0;
    if (!ea) c = NUMERIC.has(key) ? Number(va) - Number(vb) : text.compare(String(va), String(vb));
    if (dir === 'desc') c = -c;
    return c || text.compare(a.sortName, b.sortName) || String(a.CtrlNo).localeCompare(String(b.CtrlNo));
  }

  apply(records) {
    return records
      .filter(r => r.matches(this.query, this.year, this.school))
      .sort((a, b) => RecordFilter.compare(a, b, this.sort, this.dir));
  }

  // From a clicked column header: same column flips the direction, a new one starts A→Z
  sortBy(key) {
    if (this.sort === key) this.dir = this.dir === 'asc' ? 'desc' : 'asc';
    else { this.sort = key; this.dir = 'asc'; }
  }

  static years(records) {
    return [...new Set(records.map(r => r.Year))].sort().reverse();
  }

  // Schools as typed, A→Z, with "(No school recorded)" last
  static schools(records) {
    const names = [...new Set(records.map(r => r.School).filter(Boolean))].sort(text.compare);
    return records.some(r => !r.School) ? [...names, CommunionRecord.NO_SCHOOL] : names;
  }

  // "cuenca  central school" → "Cuenca Central School" if that spelling is already used, so the
  // same school is never split into two groups on the waybill
  static matchSchool(name, records) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    const found = records.find(r => r.School && text.compare(r.School, clean) === 0);
    return found ? found.School : clean;
  }

  // The search box and dropdowns; inputs are marked data-filter so pages can react
  html(records) {
    const opt = (value, label, current) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`;
    return `<div class="row" style="margin-bottom:12px">
      <input style="max-width:280px" placeholder="Search name, school or Control No." value="${esc(this.query)}" data-filter="query">
      <select style="max-width:140px" data-filter="year">
        ${opt('', 'All years', this.year)}${RecordFilter.years(records).map(y => opt(y, y, this.year)).join('')}
      </select>
      <select style="max-width:240px" data-filter="school">
        ${opt('', 'All schools', this.school)}${RecordFilter.schools(records).map(s => opt(s, s, this.school)).join('')}
      </select>
      <span class="row" style="gap:6px"><span class="mu" style="font-size:13px">Sort by</span>
        <select style="max-width:200px" data-filter="sort">${SORTS.map(([k, l]) => opt(k, l, this.sort)).join('')}</select>
        <select style="max-width:150px" data-filter="dir">${opt('asc', 'A → Z, 1 → 9', this.dir)}${opt('desc', 'Z → A, 9 → 1', this.dir)}</select></span>
      <span class="sp"></span><span data-role="count" class="mu"></span></div>`;
  }

  // A sortable column header: <th data-action="sortBy" data-key="School">School ▲</th>
  th(key, label) {
    const arrow = this.sort === key ? (this.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable" data-action="sortBy" data-key="${esc(key)}" title="Sort by ${esc(label)}">${esc(label)}${arrow}</th>`;
  }

  // After a header click, show the new order in the dropdowns too
  syncControls(root) {
    const set = (k, v) => { const el = root.querySelector(`[data-filter=${k}]`); if (el) el.value = v; };
    set('sort', this.sort);
    set('dir', this.dir);
  }

  // Returns true if the event changed the filter
  update(event) {
    const key = event.target.dataset && event.target.dataset.filter;
    if (!key) return false;
    this[key] = event.target.value;
    return true;
  }
}
