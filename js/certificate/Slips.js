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

  // All on one row to save paper:
  // Released By: <encoder's name, centered>   Received By: ____________   Date: ______
  static #signatures(releasedBy) {
    const field = (label, value, width) => `<div style="display:grid;grid-template-columns:auto ${width};gap:6px;align-items:end">
        <b style="padding-bottom:17px;white-space:nowrap">${label}</b>
        <div style="min-width:0"><div style="${LINE};text-align:center">${value}</div><div style="${CAPTION}">${label === 'Date:' ? '&nbsp;' : 'Name and Signature'}</div></div>
      </div>`;
    return `<div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr auto;gap:14px;align-items:end;font-size:13px">
      ${field('Released By:', esc(releasedBy), '1fr')}
      ${field('Received By:', '', '1fr')}
      ${field('Date:', '', '90px')}
    </div>`;
  }

  // Looks up a child's school by Control No. (set by App). Used for batches logged before
  // schools were kept in the Document Log.
  static schoolOf = () => '';

  // batch: the batch DocEntry; entries: the certificate DocEntries in print order.
  // Grouped by school (A→Z, "no school" last) with a count per school, so the staff can see
  // how many from each school received communion and who they are.
  static batchWaybill(batch, entries) {
    const NONE = '(No school recorded)';
    const groups = new Map();
    for (const d of entries) {
      const school = d.school || Slips.schoolOf(d.ctrl) || NONE;
      if (!groups.has(school)) groups.set(school, []);
      groups.get(school).push(d);
    }
    const order = [...groups.keys()].sort((a, b) => (a === NONE) - (b === NONE) || a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const summary = order.map(s => `<tr><td style="${CELL}">${esc(s)}</td>
        <td style="${CELL};text-align:center;width:90px">${groups.get(s).length}</td></tr>`).join('');

    let n = 0;
    const rows = order.map(s => `<tr><td colspan="4" style="${CELL};background:#eee;font-weight:700">
          ${esc(s)} <span style="font-weight:400">· ${groups.get(s).length}</span></td></tr>` +
      groups.get(s).map(d => `<tr>
        <td style="${CELL};width:34px">${++n}</td>
        <td style="${CELL};font-family:Consolas,monospace">${esc(d.docNo)}</td>
        <td style="${CELL};font-family:Consolas,monospace">${esc(d.ctrl)}</td>
        <td style="${CELL}">${esc(d.name)}</td></tr>`).join('')).join('');

    return `<div style="${STYLE}">
      ${Slips.#header('Certificate Release Waybill', batch.docNo)}
      <table style="width:100%;margin-top:10px;font-size:13px"><tr>
        <td><b>Certificates:</b> ${entries.length}</td><td><b>Schools:</b> ${order.length}</td>
        <td><b>Encoded by:</b> ${esc(batch.byName)}</td><td><b>Date:</b> ${esc(Dates.stamp(batch.at))}</td></tr></table>
      <table style="width:60%;border-collapse:collapse;margin-top:10px;font-size:12px">
        <tr><th style="${CELL}">School</th><th style="${CELL};text-align:center">Communicants</th></tr>
        ${summary}
        <tr><td style="${CELL};font-weight:700">Total</td><td style="${CELL};text-align:center;font-weight:700">${entries.length}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px">
        <tr><th style="${CELL}">#</th><th style="${CELL}">Document No.</th><th style="${CELL}">Ctrl No.</th>
          <th style="${CELL}">Name of communicant</th></tr>
        ${rows}
      </table>
      ${Slips.#signatures(batch.byName)}
    </div>`;
  }

  static #slip(d) {
    const rows = [['Certificate', 'First Communion'], ['Control No.', d.ctrl], ['Name', d.name],
      ['School', d.school || Slips.schoolOf(d.ctrl)],   // staff paper only; never on the certificate
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
