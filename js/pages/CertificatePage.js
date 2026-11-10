import { Page } from './Page.js';
import { esc, AppError } from '../utils/helpers.js';
import { Files } from '../utils/Files.js';
import { CertificateRenderer } from '../certificate/CertificateRenderer.js';
import { Printer } from '../certificate/Printer.js';

// Pick a record, preview its certificate, and print or download it
export class CertificatePage extends Page {
  constructor(app) {
    super(app, 'Certificate');
    this.recordId = '';
    this.query = '';
  }

  open(id) {
    this.recordId = id;
    this.app.go(this.name);
  }

  get record() { return this.app.recordById(this.recordId); }

  render() {
    this.view.innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div class="row">
          <input style="max-width:260px" placeholder="Find name or Control No." value="${esc(this.query)}" data-role="find">
          <select data-role="pick" style="max-width:420px"></select>
          <span class="sp"></span>
          <button class="btn" data-action="issue" data-format="Print">Print</button>
          <button class="btn o" data-action="issue" data-format="PDF">Download PDF</button>
          <button class="btn o" data-action="issue" data-format="HTML">Download HTML</button>
        </div>
        <p class="mu" style="margin:8px 0 0">Each print or download gets a Document No. recorded under your name in the Document Log.
          Print on short bond paper (8.5 × 11 in), scale 100%, margins none.</p>
      </div>
      <div class="stage" data-role="stage"></div>`;
    this.drawList();
    this.drawPreview();
  }

  actions() {
    return {
      issue: btn => this.app.busy(btn, () => this.issue(btn.dataset.format)),
    };
  }

  onInput(e) {
    if (e.target.dataset.role === 'find') {
      this.query = e.target.value;
      this.drawList();
    }
  }

  onChange(e) {
    if (e.target.dataset.role === 'pick') {
      this.recordId = e.target.value;
      this.drawPreview();
    }
  }

  recordsChanged() {
    this.drawList();
    this.drawPreview();
  }

  templateChanged() {
    this.drawPreview();
  }

  drawList() {
    const select = this.view.querySelector('[data-role=pick]');
    if (!select) return;
    const q = this.query.trim().toLowerCase();
    const list = [...this.app.records]
      .sort((a, b) => String(b.CtrlNo).localeCompare(String(a.CtrlNo)))
      .filter(r => !q || `${r.CtrlNo} ${r.fullName}`.toLowerCase().includes(q) || r.Id === this.recordId);
    if (!this.record && list.length) this.recordId = list[0].Id;
    select.innerHTML = list.map(r => `<option value="${esc(r.Id)}" ${r.Id === this.recordId ? 'selected' : ''}>${esc(r.CtrlNo)} · ${esc(r.sortName)}</option>`).join('')
      || '<option value="">No records</option>';
  }

  drawPreview() {
    const stage = this.view.querySelector('[data-role=stage]');
    if (!stage) return;
    const r = this.record;
    if (!r) { stage.innerHTML = '<div class="card">No record selected. Add one under New Entry.</div>'; return; }
    CertificateRenderer.fit(stage, this.app.renderer().render(r, null));
  }

  // Logs a Document No., then prints or downloads the certificate with that number on it
  async issue(format) {
    const r = this.record;
    if (!r) throw new AppError('Choose a record first.');
    const doc = await this.app.db.logDocument({ type: `Certificate (${format})`, ctrl: r.CtrlNo, name: r.fullName });
    const renderer = this.app.renderer();
    const page = renderer.render(r, doc);
    const fileName = `Certificate ${r.CtrlNo} ${r.LastName}`.replace(/[\\/:*?"<>|]/g, '');
    if (format === 'Print') Printer.print(page, 'size: 8.5in 11in; margin: 0', true);
    else if (format === 'PDF') await Printer.pdf(page, fileName + '.pdf');
    else Files.download(new Blob([renderer.standalone(page, fileName)], { type: 'text/html' }), fileName + '.html');
    this.app.toast.show(`${doc.docNo} · ${format} ready`);
  }
}
