import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { PARISH, PARISH_PLACE } from '../config.js';

const STYLE = 'font:13px/1.45 Georgia,"Times New Roman",serif;color:#111';
const CELL = 'padding:6px 8px;border:1px solid #888;text-align:left;vertical-align:top';
const LINE = 'border-bottom:1px solid #111;min-height:22px;padding:0 4px 2px;font-weight:700;text-transform:uppercase';
const CAPTION = 'font-size:11px;color:#444;text-align:center;margin-top:2px';

// Paper that goes with the certificates, like the waybills in ReliefSys:
//   batchWaybill: one sheet per print run listing every certificate, signed when they are handed over
//   releaseSlips: a small slip per certificate (two per page, cut along the dashed line)
// The person who encoded/printed them appears by full name under "Released By".
export class Slips {
  static logo = '';   // parish logo (data URL), set by App when the template loads

  static #header(title, docNo) {
    const logo = Slips.logo
      ? `<img src="${Slips.logo}" alt="" style="width:64px;height:64px;object-fit:contain;flex:none">` : '';
    return `<div style="display:flex;align-items:center;gap:14px;justify-content:center">
        ${logo}
        <div style="text-align:center;font-size:11.5px;line-height:1.35">ARCHDIOCESE OF LIPA<br>
          <b style="font-size:14px">${PARISH.toUpperCase()}</b><br>${PARISH_PLACE.toUpperCase()}</div>
        ${logo ? '<div style="width:64px;flex:none"></div>' : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;border-bottom:2px solid #111;padding-bottom:6px">
        <b style="font-size:18px">${title}</b><span style="font:700 18px Consolas,monospace">${esc(docNo)}</span></div>`;
  }

  // Released By: <full name of the encoder>
  // Received By: ____________ (Name and Signature)   Date: ________
  static #signatures(releasedBy) {
    return `<div style="margin-top:34px;display:grid;grid-template-columns:auto 1fr;gap:26px 10px;align-items:end;font-size:13px">
      <b>Released By:</b>
      <div style="max-width:330px"><div style="${LINE}">${esc(releasedBy)}</div><div style="${CAPTION}">Name and Signature</div></div>
      <b>Received By:</b>
      <div style="display:grid;grid-template-columns:minmax(0,330px) auto 160px;gap:10px;align-items:end">
        <div><div style="${LINE}"></div><div style="${CAPTION}">Name and Signature</div></div>
        <b>Date:</b>
        <div><div style="${LINE}"></div><div style="${CAPTION}">&nbsp;</div></div>
      </div>
    </div>`;
  }

  // batch: the batch DocEntry; entries: the certificate DocEntries in print order
  static batchWaybill(batch, entries) {
    const rows = entries.map((d, i) => `<tr>
        <td style="${CELL};width:34px">${i + 1}</td>
        <td style="${CELL};font-family:Consolas,monospace">${esc(d.docNo)}</td>
        <td style="${CELL};font-family:Consolas,monospace">${esc(d.ctrl)}</td>
        <td style="${CELL}">${esc(d.name)}</td></tr>`).join('');
    return `<div style="${STYLE}">
      ${Slips.#header('Certificate Release Waybill', batch.docNo)}
      <table style="width:100%;margin-top:10px;font-size:13px"><tr>
        <td><b>Certificates:</b> ${entries.length}</td><td><b>Encoded by:</b> ${esc(batch.byName)}</td>
        <td><b>Date:</b> ${esc(Dates.stamp(batch.at))}</td></tr></table>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px">
        <tr><th style="${CELL}">#</th><th style="${CELL}">Document No.</th><th style="${CELL}">Ctrl No.</th>
          <th style="${CELL}">Name of communicant</th></tr>
        ${rows}
      </table>
      ${Slips.#signatures(batch.byName)}
    </div>`;
  }

  static #slip(d) {
    const rows = [['Certificate', 'First Communion'], ['Control No.', d.ctrl], ['Name', d.name],
      ['Printed as', d.type.replace(/^Certificate \((.*)\)$/, '$1')], ['Encoded by', d.byName], ['Date and time', Dates.stamp(d.at)],
      ['Batch', d.detail.replace(/^Batch /, '')]].filter(([, v]) => v);
    return `<div style="${STYLE};height:4.75in;overflow:hidden">
      ${Slips.#header('Certificate Release Slip', d.docNo)}
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        ${rows.map(([k, v]) => `<tr><td style="${CELL};width:30%"><b>${k}</b></td><td style="${CELL}">${esc(v)}</td></tr>`).join('')}
      </table>
      ${Slips.#signatures(d.byName)}
    </div>`;
  }

  // Two slips per sheet with a cut line between them; returns one HTML page per sheet
  static releaseSlips(entries) {
    const pages = [];
    for (let i = 0; i < entries.length; i += 2) {
      const pair = entries.slice(i, i + 2).map(d => Slips.#slip(d));
      pages.push(pair.join('<div style="border-top:1px dashed #777;margin:0.2in 0;text-align:center;font:10px sans-serif;color:#777">✂ cut here</div>'));
    }
    return pages;
  }

  // For other logged documents (exports, backups, deletions)
  static documentSlip(d) {
    const rows = [['Document', d.type], ['Control No.', d.ctrl], ['Name', d.name], ['Details', d.detail],
      ['Encoded by', d.byName], ['Date and time', Dates.stamp(d.at)]].filter(([, v]) => v);
    return `<div style="${STYLE}">
      ${Slips.#header('Document Release Slip', d.docNo)}
      <table style="width:100%;border-collapse:collapse;margin-top:14px">
        ${rows.map(([k, v]) => `<tr><td style="${CELL};width:30%"><b>${k}</b></td><td style="${CELL}">${esc(v)}</td></tr>`).join('')}
      </table>
      ${Slips.#signatures(d.byName)}
    </div>`;
  }
}
