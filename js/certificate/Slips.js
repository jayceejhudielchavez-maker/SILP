import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { PARISH, PARISH_PLACE } from '../config.js';

const STYLE = 'font:13px/1.45 Georgia,"Times New Roman",serif;color:#111';
const CELL = 'padding:6px 8px;border:1px solid #888;text-align:left;vertical-align:top';

// Paper that goes with the certificates, like the waybills in ReliefSys:
//   batchWaybill: one sheet per print run listing every certificate, signed when they are handed over
//   releaseSlips: a small slip per certificate (two per page, cut along the dashed line)
export class Slips {
  static #header(title, docNo) {
    return `<div style="text-align:center;font-size:12px">ARCHDIOCESE OF LIPA<br>
        <b style="font-size:14px">${PARISH.toUpperCase()}</b><br>${PARISH_PLACE.toUpperCase()}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;border-bottom:2px solid #111;padding-bottom:6px">
        <b style="font-size:18px">${title}</b><span style="font:700 20px Consolas,monospace">${esc(docNo)}</span></div>`;
  }

  static #signatures(labels) {
    return `<div style="display:grid;grid-template-columns:repeat(${labels.length},1fr);gap:28px;margin-top:46px">
      ${labels.map(l => `<div style="border-top:1px solid #111;padding-top:4px;font-size:12px">${l}</div>`).join('')}</div>`;
  }

  // batch: the batch DocEntry; entries: the certificate DocEntries in print order
  static batchWaybill(batch, entries) {
    const rows = entries.map((d, i) => `<tr>
        <td style="${CELL};width:34px">${i + 1}</td>
        <td style="${CELL};font-family:Consolas,monospace">${esc(d.docNo)}</td>
        <td style="${CELL};font-family:Consolas,monospace">${esc(d.ctrl)}</td>
        <td style="${CELL}">${esc(d.name)}</td>
        <td style="${CELL};width:150px"></td>
        <td style="${CELL};width:80px"></td></tr>`).join('');
    return `<div style="${STYLE}">
      ${Slips.#header('Certificate Release Waybill', batch.docNo)}
      <table style="width:100%;margin-top:10px;font-size:13px"><tr>
        <td><b>Certificates:</b> ${entries.length}</td><td><b>Prepared by:</b> ${esc(batch.by)}</td>
        <td><b>Date:</b> ${esc(Dates.stamp(batch.at))}</td><td><b>Type:</b> ${esc(batch.type)}</td></tr></table>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px">
        <tr><th style="${CELL}">#</th><th style="${CELL}">Document No.</th><th style="${CELL}">Ctrl No.</th>
          <th style="${CELL}">Name of communicant</th><th style="${CELL}">Received by (signature)</th><th style="${CELL}">Date</th></tr>
        ${rows}
      </table>
      ${Slips.#signatures([`Prepared by: ${esc(batch.by)}`, 'Checked / released by', 'Received by'])}
    </div>`;
  }

  static #slip(d) {
    const rows = [['Certificate', 'First Holy Communion'], ['Control No.', d.ctrl], ['Name', d.name],
      ['Printed as', d.type.replace(/^Certificate \((.*)\)$/, '$1')], ['Prepared by', d.by], ['Date and time', Dates.stamp(d.at)],
      ['Batch', d.detail.replace(/^Batch /, '')]].filter(([, v]) => v);
    return `<div style="${STYLE};height:4.7in;overflow:hidden">
      ${Slips.#header('Certificate Release Slip', d.docNo)}
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        ${rows.map(([k, v]) => `<tr><td style="${CELL};width:30%"><b>${k}</b></td><td style="${CELL}">${esc(v)}</td></tr>`).join('')}
      </table>
      ${Slips.#signatures([`Released by: ${esc(d.by)}`, 'Received by (parent / guardian) · date'])}
    </div>`;
  }

  // Two slips per sheet with a cut line between them; returns one HTML page per sheet
  static releaseSlips(entries) {
    const pages = [];
    for (let i = 0; i < entries.length; i += 2) {
      const pair = entries.slice(i, i + 2).map(d => Slips.#slip(d));
      pages.push(pair.join('<div style="border-top:1px dashed #777;margin:0.25in 0;text-align:center;font:10px sans-serif;color:#777">✂ cut here</div>'));
    }
    return pages;
  }

  // For other logged documents (exports, backups, deletions)
  static documentSlip(d) {
    const rows = [['Document', d.type], ['Control No.', d.ctrl], ['Name', d.name], ['Details', d.detail],
      ['Prepared by', d.by], ['Date and time', Dates.stamp(d.at)]].filter(([, v]) => v);
    return `<div style="${STYLE}">
      ${Slips.#header('Document Release Slip', d.docNo)}
      <table style="width:100%;border-collapse:collapse;margin-top:14px">
        ${rows.map(([k, v]) => `<tr><td style="${CELL};width:30%"><b>${k}</b></td><td style="${CELL}">${esc(v)}</td></tr>`).join('')}
      </table>
      ${Slips.#signatures([`Prepared by: ${esc(d.by)}`, 'Released to / received by (name, signature, date)'])}
    </div>`;
  }
}
