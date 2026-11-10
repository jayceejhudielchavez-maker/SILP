import { PAGE_W, PAGE_H } from '../config.js';
import { esc, num } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { CertificateTemplate, CORE_IMAGES } from './CertificateTemplate.js';

const cssColor = (c, fallback) => /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : fallback;
const cssFont = f => `"${String(f || '').replace(/["';<>{}\\]/g, '').trim() || 'Georgia'}", Georgia, serif`;
const ALIGNS = ['left', 'center', 'right', 'justify'];

// Turns a template + record into the certificate page. One renderer is used for the editor,
// the preview, printing, the PDF and the HTML download, so they always match.
export class CertificateRenderer {
  constructor(template, images, preparedBy = '') {
    this.template = template;
    this.images = images;
    this.preparedBy = preparedBy;
  }

  // What each {PLACEHOLDER} becomes for this record
  values(r, doc) {
    return {
      NAME: r.fullName, FIRST: r.FirstName, MIDDLE: r.MiddleName, LAST: r.LastName, SUFFIX: r.Suffix,
      FATHER: r.FatherName, MOTHER: r.MotherName, PARENTS: r.parents,
      BORN: Dates.long(r.Birthdate), BIRTHPLACE: r.Birthplace, AGE: String(r.age),
      HISHER: r.hisHer, HESHE: r.heShe,
      RECEIVED: Dates.long(r.DateCommunion), MINISTER: r.CommunionMinister,
      BAPTIZED: Dates.long(r.DateBaptized), CHURCH: r.ChurchBaptized, BAPTISM_MINISTER: r.BaptismMinister,
      PRIEST: this.template.settings.priestName, CTRL: r.CtrlNo, YEAR: r.Year,
      ISSUED: Dates.short(doc && doc.at ? Dates.normalize(new Date(doc.at)) : Dates.today()),   // local date, not UTC
      DOCNO: doc ? doc.docNo : 'DOC-00000', PREPARED_BY: doc ? doc.by : this.preparedBy, TODAY: Dates.short(Dates.today()),
    };
  }

  static fill(text, vals) {
    return String(text || '').replace(/\{([A-Z_]+)\}/g, (m, k) => k in vals ? (vals[k] || '') : m);
  }

  // options: editor (adds drag handles), selected (item id), raw (show {PLACEHOLDERS})
  render(record, doc, { editor = false, selected = null, raw = false } = {}) {
    const st = this.template.settings;
    const vals = record && !raw ? this.values(record, doc) : null;
    const inset = num(st.borderInset, 24), bw = num(st.borderWidth, 0);
    let h = `<div class="cert-page" style="position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:${cssColor(st.pageColor, '#ffffff')};` +
            `overflow:hidden;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact">`;
    if (st.borderStyle && st.borderStyle !== 'none' && bw > 0) {
      h += `<div style="position:absolute;left:${inset}px;top:${inset}px;right:${inset}px;bottom:${inset}px;` +
           `border:${bw}px ${esc(st.borderStyle)} ${cssColor(st.borderColor, '#000')};pointer-events:none"></div>`;
    }
    for (const it of this.template.items) h += this.#item(it, vals, editor, selected === it.id);
    return h + '</div>';
  }

  #item(it, vals, editor, isSelected) {
    const pos = `position:absolute;left:${num(it.x)}px;top:${num(it.y)}px;width:${num(it.w, 100)}px;box-sizing:border-box;`;
    const attrs = editor ? ` data-id="${esc(it.id)}" class="ti${isSelected ? ' sel' : ''}"` : '';
    const handle = isSelected ? '<span class="hdl" data-h="1"></span>' : '';

    if (it.type === 'image') {
      const src = this.images[it.img];
      const box = `${pos}height:${num(it.h, 100)}px`;
      if (src) return `<div${attrs} style="${box}"><img src="${src}" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain;display:block">${handle}</div>`;
      if (editor) return `<div${attrs} style="${box}"><div class="ph">${esc(CORE_IMAGES[it.img] || 'Picture')}<br>(upload a picture)</div>${handle}</div>`;
      return '';
    }

    const text = vals ? CertificateRenderer.fill(it.text, vals) : it.text;
    const align = ALIGNS.includes(it.align) ? it.align : 'center';
    const size = num(it.size, 14);
    // "Shrink to fit" items stay on one line; shrinkToFit() makes long names smaller instead of wrapping
    const fit = it.fit ? ` data-fit="${size}"` : '';
    const wrap = it.fit ? 'white-space:nowrap' : 'white-space:pre-wrap;overflow-wrap:break-word';
    return `<div${attrs}${fit} style="${pos}font-family:${esc(cssFont(it.font))};font-size:${size}pt;color:${cssColor(it.color, '#000')};` +
      `font-weight:${it.bold ? 700 : 400};font-style:${it.italic ? 'italic' : 'normal'};text-decoration:${it.underline ? 'underline' : 'none'};` +
      `text-transform:${it.caps ? 'uppercase' : 'none'};text-align:${align};line-height:${num(it.lh, 1.25)};${wrap}">` +
      `${esc(text)}${handle}</div>`;
  }

  // Makes every "shrink to fit" text small enough to fit its width. Needs the page on screen (laid out).
  static shrinkToFit(root) {
    root.querySelectorAll('[data-fit]').forEach(el => {
      let size = Number(el.dataset.fit);
      el.style.fontSize = size + 'pt';
      while (el.scrollWidth > el.clientWidth + 1 && size > 7) {
        size -= 0.5;
        el.style.fontSize = size + 'pt';
      }
    });
  }

  // A complete .html file that opens and prints on its own
  standalone(page, title) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${CertificateTemplate.fontLinks(this.template.fontFamilies)}
<style>@page{size:8.5in 11in;margin:0}html,body{margin:0;padding:0}body{background:#777}
.wrap{width:8.5in;margin:24px auto;box-shadow:0 2px 14px rgba(0,0,0,.45)}
@media print{body{background:none}.wrap{margin:0;box-shadow:none}}</style></head>
<body><div class="wrap">${page}</div></body></html>`;
  }

  // Shows a page scaled down to fit a container; returns the scale used
  static fit(container, pageHtml) {
    const w = Math.max(200, container.clientWidth - 28);
    const k = Math.min(1, w / PAGE_W);
    container.innerHTML = `<div style="width:${PAGE_W * k}px;height:${PAGE_H * k}px;margin:0 auto">
      <div class="scaler" style="width:${PAGE_W}px;height:${PAGE_H}px;transform:scale(${k})">${pageHtml}</div></div>`;
    CertificateRenderer.shrinkToFit(container);
    document.fonts.ready.then(() => CertificateRenderer.shrinkToFit(container));   // again once web fonts arrive
    return k;
  }
}
