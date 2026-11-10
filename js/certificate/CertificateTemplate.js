import { PAGE_W } from '../config.js';
import { clone, uid } from '../utils/helpers.js';

export const CORE_IMAGES = { parishLogo: 'Parish logo', archLogo: 'Archdiocese logo', signature: "Parish Priest's signature",
  emblem: 'Communion drawing (chalice)' };

// Pictures that ship with the app (taken from the parish's certificate design). An uploaded picture replaces them.
export const DEFAULT_IMAGE_FILES = { archLogo: 'img/archdiocese-logo.png', parishLogo: 'img/parish-logo.png',
  emblem: 'img/communion-emblem.png' };

export const PLACEHOLDERS = [
  ['{NAME}', 'Full name (First Middle Last Suffix)'], ['{PARENTS}', '"Father and Mother"'], ['{FATHER}', "Father's name"],
  ['{MOTHER}', "Mother's name"], ['{BORN}', 'Birthdate as "15th day of May, 2018"'], ['{BIRTHPLACE}', 'Birthplace'],
  ['{HISHER}', 'his / her (from gender)'], ['{HESHE}', 'he / she'], ['{RECEIVED}', 'Communion date as "15th day of May, 2026"'],
  ['{MINISTER}', 'Communion minister'], ['{PRIEST}', 'Parish Priest name (Page tab)'], ['{CTRL}', 'Control No.'],
  ['{BAPTIZED}', 'Baptism date (long form)'], ['{CHURCH}', 'Church baptized'], ['{BAPTISM_MINISTER}', 'Baptism minister'],
  ['{AGE}', 'Age at First Communion'], ['{YEAR}', 'Year'], ['{ISSUED}', 'Date issued (the day it is printed)'],
  ['{DOCNO}', 'Document No. of this printing'], ['{PREPARED_BY}', 'Full name of who printed it'], ['{TODAY}', "Today's date"],
];

export const FONT_LIST = ['Merriweather', 'Lora', 'EB Garamond', 'Cinzel', 'Great Vibes', 'Georgia', 'Times New Roman',
  'Garamond', 'Book Antiqua', 'Palatino Linotype', 'Old English Text MT', 'Monotype Corsiva', 'Arial', 'Calibri', 'Cambria'];

const TEXT_DEFAULTS = { type: 'text', x: 50, w: 716, font: 'Lora', size: 14.5, color: '#111111',
  bold: false, italic: false, underline: false, caps: false, fit: false, align: 'center', lh: 1.25 };

// Loads the built-in logos once and keeps them as data URLs, so PDFs and HTML downloads include them
export class DefaultImages {
  static #cache = null;

  static async load() {
    if (!DefaultImages.#cache) {
      DefaultImages.#cache = (async () => {
        const out = {};
        for (const [key, url] of Object.entries(DEFAULT_IMAGE_FILES)) {
          try {
            const blob = await (await fetch(url)).blob();
            out[key] = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) { /* missing file: the certificate just shows no logo */ }
        }
        return out;
      })();
    }
    return DefaultImages.#cache;
  }
}

// The certificate layout: page settings plus a list of text and picture items
export class CertificateTemplate {
  constructor(data) {
    const base = CertificateTemplate.defaults();
    const d = data && typeof data === 'object' ? clone(data) : base;
    this.version = 2;
    this.settings = Object.assign({}, base.settings, d.settings || {});
    this.items = (Array.isArray(d.items) ? d.items : base.items).map(it => Object.assign({}, it, { id: it.id || uid() }));
  }

  static text(text, y, extra = {}) {
    return Object.assign({ id: uid() }, TEXT_DEFAULTS, { text, y }, extra);
  }

  static image(img, x, y, w, h) {
    return { id: uid(), type: 'image', img, x, y, w, h };
  }

  // The parish's certificate design ("First Communion Certificate (1).pdf"); Reset to default returns here.
  // Positions are in pixels on the 816 × 1056 page (8.5 × 11 in).
  static defaults() {
    const T = CertificateTemplate.text;
    const head = { font: 'Merriweather', bold: true, caps: true };
    const italic = { italic: true };
    return {
      version: 3,
      settings: { pageColor: '#ffffff', borderStyle: 'solid', borderWidth: 3, borderColor: '#000000', borderInset: 46,
        priestName: 'Rev. Fr. (Name of the Parish Priest)', googleFonts: 'Merriweather, Lora' },
      items: [
        CertificateTemplate.image('archLogo', 72, 82, 102, 102),
        CertificateTemplate.image('parishLogo', 636, 76, 108, 108),
        T('ARCHDIOCESE OF LIPA', 100, { x: 178, w: 460, size: 9.5, font: 'Merriweather' }),
        T('PARISH AND ARCHDIOCESAN SHRINE OF\nSAN ISIDRO LABRADOR', 114, { x: 178, w: 460, size: 13, lh: 1.15, ...head }),
        T('CUENCA, BATANGAS', 158, { x: 178, w: 460, size: 9.5, font: 'Merriweather' }),
        T('CERTIFICATE OF', 208, { size: 18, ...head }),
        T('FIRST COMMUNION', 238, { size: 24, ...head }),
        T('This is to certify that', 302, { size: 14, ...italic }),
        T('{NAME}', 352, { size: 21, fit: true, ...head }),
        T('Child of {FATHER}', 424, { fit: true, ...italic }),
        T('and {MOTHER}', 460, { fit: true, ...italic }),
        T('Born on the {BORN}', 496, italic),
        T('has received {HISHER}', 540, italic),
        T('First Holy Communion', 576, { size: 32, bold: true, ...italic }),
        T('on the {RECEIVED}', 645, italic),
        T('By the {MINISTER}', 681, { fit: true, ...italic }),
        CertificateTemplate.image('signature', 308, 742, 200, 66),
        // Kept right of the chalice drawing; long names shrink to fit instead of running under it
        T('{PRIEST}', 812, { size: 13, fit: true, x: 244, w: 340, ...head }),
        T('PARISH PRIEST/RECTOR', 834, { size: 9, font: 'Merriweather', x: 244, w: 340 }),
        T('Ctrl No: {CTRL}\nDate Issued: {ISSUED}', 932, { x: 502, w: 250, size: 9.5, bold: true, align: 'left', lh: 1.55 }),
        // Drawn last so its white background covers the corner of the border, as in the parish's design
        CertificateTemplate.image('emblem', 17, 690, 214, 325),
      ],
    };
  }

  static createDefault() {
    return new CertificateTemplate(CertificateTemplate.defaults());
  }

  clone() {
    return new CertificateTemplate(this.toJSON());
  }

  toJSON() {
    return { version: this.version, settings: this.settings, items: this.items };
  }

  // ----- editing

  item(id) {
    return this.items.find(i => i.id === id) || null;
  }

  addText() {
    const it = CertificateTemplate.text('New text', 680, { x: 258, w: 300, size: 14 });
    this.items.push(it);
    return it;
  }

  addImage(key) {
    const it = CertificateTemplate.image(key, 358, 660, 100, 100);
    this.items.push(it);
    return it;
  }

  duplicate(id) {
    const it = this.item(id);
    if (!it) return null;
    const copy = Object.assign(clone(it), { id: uid(), x: it.x + 14, y: it.y + 14 });
    this.items.push(copy);
    return copy;
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
  }

  center(id) {
    const it = this.item(id);
    if (it) it.x = Math.round((PAGE_W - it.w) / 2);
  }

  // dir > 0 brings to front (drawn last), dir < 0 sends to back
  moveLayer(id, dir) {
    const i = this.items.findIndex(x => x.id === id);
    if (i < 0) return;
    const [it] = this.items.splice(i, 1);
    if (dir > 0) this.items.push(it); else this.items.unshift(it);
  }

  usedImageKeys() {
    return new Set(this.items.filter(i => i.type === 'image').map(i => i.img));
  }

  // ----- fonts

  get fontFamilies() {
    return String(this.settings.googleFonts || '').split(',').map(s => s.trim()).filter(s => /^[A-Za-z0-9 ]{2,40}$/.test(s));
  }

  // Two links per font: the plain one always works; the bold/italic one may not exist for every font (harmless if not)
  static fontLinks(families) {
    return families.map(f => {
      const fam = f.replace(/ /g, '+');
      return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam}&display=swap">` +
             `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam}:ital,wght@0,400;0,700;1,400;1,700&display=swap">`;
    }).join('');
  }
}
