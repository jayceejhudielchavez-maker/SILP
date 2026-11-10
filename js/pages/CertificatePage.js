import { Page } from './Page.js';
import { esc, AppError } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { Files } from '../utils/Files.js';
import { RecordFilter } from '../models/RecordFilter.js';
import { CertificateRenderer } from '../certificate/CertificateRenderer.js';
import { Printer, CERTIFICATE_PAGE, SLIP_PAGE } from '../certificate/Printer.js';
import { Slips } from '../certificate/Slips.js';

// Choose who to print (one or many), preview, then print or download.
// Every certificate gets its own Document No.; a batch also gets a waybill listing them all.
export class CertificatePage extends Page {
  constructor(app) {
    super(app, 'Certificate');
    this.filter = new RecordFilter();
    this.selected = new Set();   // ids ticked for printing
    this.focusId = '';           // the record shown in the preview
  }

  // From Records / New Entry: open with this record ticked and shown
  open(id) {
    this.focusId = id;
    this.selected.add(id);
    this.app.go(this.name);
  }

  get focused() { return this.app.recordById(this.focusId); }

  // Ticked records still in the database, in Control No. order (the order they print)
  get selectedRecords() {
    return this.app.records
      .filter(r => this.selected.has(r.Id))
      .sort((a, b) => String(a.CtrlNo).localeCompare(String(b.CtrlNo)));
  }

  render() {
    this.view.innerHTML = `
      <div class="certs">
        <div class="card">
          <div class="row"><b>Choose who to print</b><span class="sp"></span><span class="count" data-role="selected"></span></div>
          <div style="margin-top:10px">${this.filter.html(this.app.records)}</div>
          <div class="row">
            <button class="btn s o" data-action="selectShown">Select all shown</button>
            <button class="btn s o" data-action="selectNone">Clear selection</button>
          </div>
          <div class="pick"><table data-role="list"></table></div>
          <div class="row" style="margin-top:12px">
            <button class="btn" data-action="batch" data-format="Print">Print selected</button>
            <button class="btn o" data-action="batch" data-format="PDF">PDF of selected</button>
          </div>
          <p class="mu" style="margin:10px 0 0">Each certificate gets its own Document No. under your name. A batch also gets a
            <b>waybill</b> listing every certificate, ready to sign when they are handed over.
            Print on short bond (8.5 × 11 in), scale 100%, margins none.</p>
        </div>
        <div>
          <div class="card row" style="margin-bottom:12px">
            <span data-role="focusName" class="mu">Click a name to preview</span><span class="sp"></span>
            <button class="btn s" data-action="single" data-format="Print">Print this one</button>
            <button class="btn s o" data-action="single" data-format="PDF">PDF</button>
            <button class="btn s o" data-action="single" data-format="HTML">HTML</button>
          </div>
          <div class="stage" data-role="stage"></div>
        </div>
      </div>`;
    this.drawList();
    this.drawPreview();
  }

  actions() {
    return {
      focus: (el, e) => {
        if (e.target.matches('input')) return;   // the tick box is handled in onChange
        this.focusId = el.dataset.id;
        this.drawList();
        this.drawPreview();
      },
      selectShown: () => { this.#shown().forEach(r => this.selected.add(r.Id)); this.drawList(); },
      selectNone: () => { this.selected.clear(); this.drawList(); },
      batch: btn => this.app.busy(btn, () => this.issueBatch(btn.dataset.format)),
      single: btn => this.app.busy(btn, () => this.issueOne(btn.dataset.format)),
    };
  }

  onInput(e) {
    if (this.filter.update(e)) this.drawList();
  }

  onChange(e) {
    if (this.filter.update(e)) return this.drawList();
    if (e.target.dataset.role === 'tick') {
      const id = e.target.dataset.id;
      if (e.target.checked) this.selected.add(id); else this.selected.delete(id);
      this.drawList();
    }
  }

  recordsChanged() {
    this.drawList();
    this.drawPreview();
  }

  templateChanged() {
    this.drawPreview();
  }

  #shown() {
    return this.filter.apply(this.app.records);
  }

  drawList() {
    const table = this.view.querySelector('[data-role=list]');
    if (!table) return;
    const list = this.#shown();
    if (!this.focused && list.length) this.focusId = list[0].Id;
    // Forget ticks for records deleted on another laptop
    for (const id of this.selected) if (!this.app.recordById(id)) this.selected.delete(id);

    table.innerHTML = list.map(r => `<tr data-action="focus" data-id="${esc(r.Id)}"
        class="${this.selected.has(r.Id) ? 'on' : ''} ${r.Id === this.focusId ? 'focus' : ''}">
        <td style="width:30px"><input type="checkbox" data-role="tick" data-id="${esc(r.Id)}" ${this.selected.has(r.Id) ? 'checked' : ''}></td>
        <td class="mono">${esc(r.CtrlNo)}</td><td>${esc(r.sortName)}</td><td><small>${esc(Dates.short(r.DateCommunion))}</small></td></tr>`).join('')
      || '<tr><td class="mu">No matching records.</td></tr>';
    this.view.querySelector('[data-role=count]').textContent = `${list.length} shown`;
    this.view.querySelector('[data-role=selected]').textContent = `${this.selected.size} selected`;
  }

  drawPreview() {
    const stage = this.view.querySelector('[data-role=stage]');
    if (!stage) return;
    const r = this.focused;
    const label = this.view.querySelector('[data-role=focusName]');
    if (!r) {
      stage.innerHTML = '<div class="card">No record selected. Add one under New Entry.</div>';
      label.textContent = 'Click a name to preview';
      return;
    }
    label.innerHTML = `<b class="mono">${esc(r.CtrlNo)}</b> · ${esc(r.fullName)}`;
    CertificateRenderer.fit(stage, this.app.renderer().render(r, null));
  }

  // ----- issuing

  async issueBatch(format) {
    const records = this.selectedRecords;
    if (!records.length) throw new AppError('Tick at least one name in the list first.');
    const { batch, items } = await this.app.db.logCertificateBatch(format, records);
    const renderer = this.app.renderer();
    const pages = records.map((r, i) => renderer.render(r, items[i]));
    if (format === 'Print') {
      await Printer.print(pages, CERTIFICATE_PAGE, true);
    } else {
      await Printer.pdf(pages, `Certificates ${batch.docNo}.pdf`,
        (done, total) => this.app.toast.show(`Making PDF… ${done} of ${total}`));
    }
    this.#issued(batch, items);
  }

  async issueOne(format) {
    const r = this.focused;
    if (!r) throw new AppError('Choose a record first.');
    const doc = await this.app.db.logDocument({ type: `Certificate (${format})`, ctrl: r.CtrlNo, name: r.fullName });
    const renderer = this.app.renderer();
    const page = renderer.render(r, doc);
    const fileName = `Certificate ${r.CtrlNo} ${r.LastName}`.replace(/[\\/:*?"<>|]/g, '');
    if (format === 'Print') await Printer.print([page], CERTIFICATE_PAGE, true);
    else if (format === 'PDF') await Printer.pdf([page], fileName + '.pdf');
    else {
      const [ready] = await Printer.prepare([page]);
      Files.download(new Blob([renderer.standalone(ready, fileName)], { type: 'text/html' }), fileName + '.html');
    }
    this.#issued(null, [doc]);
  }

  // After printing: offer the waybill and release slips for exactly what was just issued
  #issued(batch, items) {
    const count = items.length;
    this.app.modal.open(`<h3>${batch ? `Batch ${esc(batch.docNo)} · ` : ''}${count} certificate${count === 1 ? '' : 's'} issued</h3>
      <p>${batch ? `Each certificate has its own Document No. (${esc(items[0].docNo)}${count > 1 ? ` to ${esc(items[count - 1].docNo)}` : ''}).
        Print the <b>waybill</b> to go with the batch, and a <b>release slip</b> for each family if you use them.`
        : `Document No. <b>${esc(items[0].docNo)}</b>. Print a <b>release slip</b> to go with it if you use them.`}</p>
      <p class="mu">You can reprint these any time from the Documents page.</p>
      <div class="actions">
        <button class="btn o" data-action="close">Done</button>
        <button class="btn o" data-action="slips">Release slip${count === 1 ? '' : `s (${count})`}</button>
        ${batch ? '<button class="btn" data-action="waybill">Print waybill</button>' : ''}
      </div>`, {
      waybill: () => Printer.print([Slips.batchWaybill(batch, items)], SLIP_PAGE),
      slips: () => Printer.print(Slips.releaseSlips(items), SLIP_PAGE),
    });
  }
}
