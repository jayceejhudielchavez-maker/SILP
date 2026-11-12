import { Page } from './Page.js';
import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { Printer, SLIP_PAGE } from '../certificate/Printer.js';
import { Slips } from '../certificate/Slips.js';

// Document Log, like the ReliefSys waybills: every certificate, export, backup, restore and
// deletion with its number and who made it. Each can be printed as a release slip.
export class DocumentsPage extends Page {
  constructor(app) {
    super(app, 'Documents');
    this.docs = [];
    this.query = '';
  }

  render() {
    this.view.innerHTML = `
      <div class="row" style="margin-bottom:12px">
        <input style="max-width:320px" placeholder="Search Doc No., name, user…" value="${esc(this.query)}" data-role="find">
        <span class="sp"></span><span class="mu">Every certificate, export, backup, restore and deletion is numbered here with who did it.</span>
      </div>
      <div class="card tw" data-role="table">Loading…</div>`;
    this.load();
  }

  async load() {
    try {
      this.docs = await this.app.db.loadDocuments();
      this.drawTable();
    } catch (e) {
      const t = this.view.querySelector('[data-role=table]');
      if (t) t.innerHTML = `<div class="note bad">${esc(e.message)}</div>`;
    }
  }

  actions() {
    return {
      slip: el => this.printSlip(el.dataset.doc),
      waybill: el => this.printWaybill(el.dataset.doc),
    };
  }

  onInput(e) {
    if (e.target.dataset.role !== 'find') return;
    this.query = e.target.value;
    this.drawTable();
  }

  recordsChanged() {
    this.load();   // deletions and restores add log entries
  }

  drawTable() {
    const table = this.view.querySelector('[data-role=table]');
    if (!table) return;
    const list = this.docs.filter(d => d.matches(this.query));
    table.innerHTML = `<table><tr><th>Document No.</th><th>Type</th><th>Record</th><th>Details</th><th>Prepared by</th><th>Date and time</th><th></th></tr>
      ${list.map(d => `<tr><td class="mono">${esc(d.docNo)}</td><td>${esc(d.type)}</td>
        <td>${d.ctrl ? `<span class="mono">${esc(d.ctrl)}</span><br>` : ''}${esc(d.name)}</td><td><small>${esc(d.detail)}</small></td>
        <td>${esc(d.byName)}${d.byName !== d.by ? `<br><small class="mono">${esc(d.by)}</small>` : ''}</td><td>${esc(Dates.stamp(d.at))}</td>
        <td style="white-space:nowrap"><button class="btn s o" data-action="slip" data-doc="${esc(d.docNo)}">${DocumentsPage.#isBatch(d) ? 'Print waybill' : 'Print slip'}</button>
          ${DocumentsPage.#isSingle(d) ? `<button class="btn s o" data-action="waybill" data-doc="${esc(d.docNo)}">Print waybill</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="7" class="mu">Nothing logged yet.</td></tr>'}</table>`;
  }

  static #isBatch(d) {
    return d.type.startsWith('Certificate batch');
  }

  // A certificate printed on its own ("Print this one"), not as part of a batch
  static #isSingle(d) {
    return d.type.startsWith('Certificate (') && !d.detail.startsWith('Batch ');
  }

  printWaybill(docNo) {
    const d = this.docs.find(x => x.docNo === docNo);
    if (d) return Printer.print([Slips.batchWaybill(d, [d])], SLIP_PAGE);
  }

  // Batches reprint their waybill; single certificates their release slip; anything else a document slip
  printSlip(docNo) {
    const d = this.docs.find(x => x.docNo === docNo);
    if (!d) return;
    if (DocumentsPage.#isBatch(d)) {
      const members = this.docs.filter(x => x.detail === `Batch ${d.docNo}`).sort((a, b) => a.id - b.id);
      return Printer.print([Slips.batchWaybill(d, members)], SLIP_PAGE);
    }
    if (d.type.startsWith('Certificate (')) return Printer.print(Slips.releaseSlips([d]), SLIP_PAGE);
    return Printer.print([Slips.documentSlip(d)], SLIP_PAGE);
  }
}
