// One line in the Document Log, like a ReliefSys waybill: what was issued, for whom, by whom, when
export class DocEntry {
  static number(id) {
    return 'DOC-' + String(id).padStart(5, '0');
  }

  constructor(row) {
    this.id = row.id;
    this.docNo = DocEntry.number(row.id);
    this.type = row.type;
    this.ctrl = row.ctrl_no || '';
    this.name = row.name || '';
    this.detail = row.detail || '';
    this.by = row.by_user;
    this.at = row.at;
  }

  matches(query) {
    const q = (query || '').trim().toLowerCase();
    return !q || `${this.docNo} ${this.type} ${this.ctrl} ${this.name} ${this.by} ${this.detail}`.toLowerCase().includes(q);
  }
}
