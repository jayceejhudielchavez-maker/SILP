import { Page } from './Page.js';
import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { PARISH } from '../config.js';
import { Printer } from '../certificate/Printer.js';

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
    return { slip: el => this.printSlip(el.dataset.doc) };
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
        <td>${esc(d.by)}</td><td>${esc(Dates.stamp(d.at))}</td>
        <td><button class="btn s o" data-action="slip" data-doc="${esc(d.docNo)}">Print slip</button></td></tr>`).join('')
        || '<tr><td colspan="7" class="mu">Nothing logged yet.</td></tr>'}</table>`;
  }

  printSlip(docNo) {
    const d = this.docs.find(x => x.docNo === docNo);
    if (!d) return;
    const rows = [['Document', d.type], ['Control No.', d.ctrl], ['Name', d.name], ['Details', d.detail],
      ['Prepared by', d.by], ['Date and time', Dates.stamp(d.at)]].filter(([, v]) => v);
    const html = `<div style="font:14px/1.5 Georgia,serif;color:#111;padding:8px">
      <div style="text-align:center">Archdiocese of Lipa<br><b>${PARISH.toUpperCase()}</b><br>Cuenca, Batangas</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;border-bottom:2px solid #111;padding-bottom:6px">
        <b style="font-size:20px">Document Release Slip</b><span style="font:700 22px Consolas,monospace">${esc(d.docNo)}</span></div>
      <table style="width:100%;border-collapse:collapse;margin-top:14px">
        ${rows.map(([k, v]) => `<tr><td style="padding:6px;border:1px solid #999;width:30%"><b>${k}</b></td><td style="padding:6px;border:1px solid #999">${esc(v)}</td></tr>`).join('')}
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:70px">
        <div style="border-top:1px solid #111;padding-top:4px">Prepared by: ${esc(d.by)} (signature)</div>
        <div style="border-top:1px solid #111;padding-top:4px">Released to / received by (name, signature, date)</div>
      </div></div>`;
    Printer.print(html, 'size: 8.5in 11in; margin: 0.6in', false);
  }
}
