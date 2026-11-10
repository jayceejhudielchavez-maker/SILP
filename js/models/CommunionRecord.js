import { Dates } from '../utils/Dates.js';

// [page key, database column]. The page uses CamelCase; the database uses snake_case.
const COLUMNS = [
  ['Id', 'id'], ['CtrlNo', 'ctrl_no'], ['Year', 'year'], ['Seq', 'seq'], ['LastName', 'last_name'],
  ['FirstName', 'first_name'], ['MiddleName', 'middle_name'], ['Suffix', 'suffix'], ['Birthdate', 'birthdate'],
  ['Birthplace', 'birthplace'], ['Gender', 'gender'], ['FatherName', 'father_name'], ['MotherName', 'mother_name'],
  ['DateBaptized', 'date_baptized'], ['ChurchBaptized', 'church_baptized'], ['BaptismMinister', 'baptism_minister'],
  ['DateCommunion', 'date_communion'], ['CommunionMinister', 'communion_minister'], ['CreatedBy', 'created_by'],
  ['CreatedAt', 'created_at'], ['UpdatedBy', 'updated_by'], ['UpdatedAt', 'updated_at'],
];
const NULLABLE = new Set(['Id', 'Year', 'Gender', 'Birthdate', 'DateBaptized', 'DateCommunion', 'CreatedAt']);
const DATE_KEYS = ['Birthdate', 'DateBaptized', 'DateCommunion'];

// One First Communicant
export class CommunionRecord {
  // Columns shown in the Database table and in exports, with their labels
  static FIELDS = [
    ['CtrlNo', 'Control No.'], ['Year', 'Year'], ['LastName', 'Last Name'], ['FirstName', 'First Name'],
    ['MiddleName', 'Middle Name'], ['Suffix', 'Suffix'], ['Birthdate', 'Birthdate'], ['Age', 'Age'],
    ['Birthplace', 'Birthplace'], ['Gender', 'Gender'], ['FatherName', "Father's Name"], ['MotherName', "Mother's Name"],
    ['DateBaptized', 'Date Baptized'], ['ChurchBaptized', 'Church Baptized'], ['BaptismMinister', 'Baptism Minister'],
    ['DateCommunion', 'Date Received Communion'], ['CommunionMinister', 'Communion Minister'],
    ['CreatedBy', 'Created By'], ['CreatedAt', 'Created At'], ['UpdatedBy', 'Updated By'], ['UpdatedAt', 'Updated At'],
  ];

  constructor(data = {}) {
    for (const [key] of COLUMNS) this[key] = data[key] === undefined || data[key] === null ? '' : String(data[key]);
  }

  static blank() {
    return new CommunionRecord({ Year: String(new Date().getFullYear()) });
  }

  static fromDb(row) {
    const data = {};
    for (const [key, col] of COLUMNS) data[key] = row[col];
    return new CommunionRecord(data);
  }

  // Row for the database functions. The server decides Seq and Updated By/At itself.
  toDb() {
    const row = {};
    for (const [key, col] of COLUMNS) {
      if (key === 'Seq' || key === 'UpdatedBy' || key === 'UpdatedAt') continue;
      const v = String(this[key] ?? '').trim();
      row[col] = v === '' && NULLABLE.has(key) ? null : v;
    }
    return row;
  }

  clone() {
    return new CommunionRecord(this);
  }

  get isNew() { return !this.Id; }
  get fullName() { return [this.FirstName, this.MiddleName, this.LastName, this.Suffix].filter(Boolean).join(' '); }
  get sortName() { return `${this.LastName}, ${[this.FirstName, this.MiddleName, this.Suffix].filter(Boolean).join(' ')}`; }
  get parents() { return [this.FatherName, this.MotherName].filter(Boolean).join(' and '); }
  get hisHer() { return this.Gender === 'Male' ? 'his' : this.Gender === 'Female' ? 'her' : 'his/her'; }
  get heShe() { return this.Gender === 'Male' ? 'he' : this.Gender === 'Female' ? 'she' : 'he/she'; }

  // Age at First Communion; if that date is empty, age today
  get age() { return Dates.age(this.Birthdate, this.DateCommunion || Dates.today()); }

  matches(query, year) {
    if (year && this.Year !== year) return false;
    const q = (query || '').trim().toLowerCase();
    return !q || `${this.CtrlNo} ${this.fullName} ${this.LastName}`.toLowerCase().includes(q);
  }

  // Returns a problem to show, or '' when the record can be saved
  validate() {
    if (!/^\d{4}$/.test(this.Year)) return 'Year must have 4 digits, for example 2026.';
    if (!this.LastName.trim() || !this.FirstName.trim()) return 'Last Name and First Name are required.';
    if (!this.Gender) return 'Please select the gender (used for "his/her" on the certificate).';
    if (this.Birthdate && this.Birthdate > Dates.today()) return 'Birthdate cannot be in the future.';
    if (this.Birthdate && this.DateCommunion && this.DateCommunion < this.Birthdate) return 'Date of Communion cannot be before the birthdate.';
    if (this.Birthdate && this.DateBaptized && this.DateBaptized < this.Birthdate) return 'Date of Baptism cannot be before the birthdate.';
    return '';
  }

  // { "Control No.": ..., "Last Name": ... } for Excel and CSV
  exportRow() {
    const row = {};
    for (const [key, label] of CommunionRecord.FIELDS) row[label] = key === 'Age' ? this.age : (this[key] || '');
    return row;
  }

  // From an imported Excel row (labels) or JSON backup (keys)
  static fromImport(raw) {
    const lower = {};
    Object.keys(raw).forEach(k => { lower[k.trim().toLowerCase()] = raw[k]; });
    const data = {};
    for (const [key, label] of CommunionRecord.FIELDS) {
      const v = raw[key] !== undefined ? raw[key]
        : lower[label.toLowerCase()] !== undefined ? lower[label.toLowerCase()] : lower[key.toLowerCase()];
      data[key] = v === undefined || v === null ? '' : (v instanceof Date ? v : String(v).trim());
    }
    DATE_KEYS.forEach(k => { data[k] = Dates.normalize(data[k]); });
    if (data.CreatedAt instanceof Date) data.CreatedAt = data.CreatedAt.toISOString();
    const g = String(data.Gender).toLowerCase();
    data.Gender = /^m/.test(g) ? 'Male' : /^f/.test(g) ? 'Female' : '';
    const ctrlYear = /^(\d{4})-/.exec(data.CtrlNo || '');
    data.Year = /^\d{4}$/.test(data.Year) ? data.Year
      : ctrlYear ? ctrlYear[1] : (data.DateCommunion || '').slice(0, 4) || String(new Date().getFullYear());
    return new CommunionRecord(data);
  }
}
