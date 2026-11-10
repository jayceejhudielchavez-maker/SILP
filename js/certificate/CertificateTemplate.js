import { PAGE_W } from '../config.js';
import { clone, uid } from '../utils/helpers.js';

export const CORE_IMAGES = { parishLogo: 'Parish logo', archLogo: 'Archdiocese logo', signature: "Parish Priest's signature" };

export const PLACEHOLDERS = [
  ['{NAME}', 'Full name (First Middle Last Suffix)'], ['{PARENTS}', '"Father and Mother"'], ['{FATHER}', "Father's name"],
  ['{MOTHER}', "Mother's name"], ['{BORN}', 'Birthdate as "15th day of May, 2018"'], ['{BIRTHPLACE}', 'Birthplace'],
  ['{HISHER}', 'his / her (from gender)'], ['{HESHE}', 'he / she'], ['{RECEIVED}', 'Communion date as "15th day of May, 2026"'],
  ['{MINISTER}', 'Communion minister'], ['{PRIEST}', 'Parish Priest name (Page tab)'], ['{CTRL}', 'Control No.'],
  ['{BAPTIZED}', 'Baptism date (long form)'], ['{CHURCH}', 'Church baptized'], ['{BAPTISM_MINISTER}', 'Baptism minister'],
  ['{AGE}', 'Age at First Communion'], ['{YEAR}', 'Year'], ['{DOCNO}', 'Document No. of this printing'],
  ['{PREPARED_BY}', 'User who printed it'], ['{TODAY}', "Today's date"],
];

export const FONT_LIST = ['EB Garamond', 'Cinzel', 'Great Vibes', 'Georgia', 'Times New Roman', 'Garamond', 'Book Antiqua',
  'Palatino Linotype', 'Old English Text MT', 'Monotype Corsiva', 'Arial', 'Calibri', 'Cambria', 'Trajan Pro'];

const TEXT_DEFAULTS = { type: 'text', x: 50, w: 716, font: 'EB Garamond', size: 16, color: '#1f1a17',
  bold: false, italic: false, underline: false, caps: false, align: 'center', lh: 1.25 };

// The certificate layout: page settings plus a list of text and picture items
export class CertificateTemplate {
  constructor(data) {
    const base = CertificateTemplate.defaults();
    const d = data && typeof data === 'object' ? clone(data) : base;
    this.version = 1;
    this.settings = Object.assign({}, base.settings, d.settings || {});
    this.items = (Array.isArray(d.items) ? d.items : base.items).map(it => Object.assign({}, it, { id: it.id || uid() }));
  }

  static text(text, y, extra = {}) {
    return Object.assign({ id: uid() }, TEXT_DEFAULTS, { text, y }, extra);
  }

  static image(img, x, y, w, h) {
    return { id: uid(), type: 'image', img, x, y, w, h };
  }

  // The layout from the requirements; Reset to default returns here
  static defaults() {
    const T = CertificateTemplate.text;
    return {
      version: 1,
      settings: { pageColor: '#fffdf7', borderStyle: 'double', borderWidth: 7, borderColor: '#8a6d1d', borderInset: 26,
        priestName: 'Rev. Fr. (Parish Priest Name)', googleFonts: 'Cinzel, EB Garamond, Great Vibes' },
      items: [
        CertificateTemplate.image('parishLogo', 70, 58, 110, 110),
        CertificateTemplate.image('archLogo', 636, 58, 110, 110),
        T('Archdiocese of Lipa', 66, { x: 188, w: 440, size: 13, italic: true }),
        T('PARISH AND ARCHDIOCESAN SHRINE OF SAN ISIDRO LABRADOR', 90, { x: 188, w: 440, size: 14, bold: true, font: 'Cinzel' }),
        T('Cuenca, Batangas', 140, { x: 188, w: 440, size: 13 }),
        T('CERTIFICATE OF FIRST HOLY COMMUNION', 230, { size: 24, bold: true, font: 'Cinzel', color: '#7a1f2b' }),
        T('This is to certify that', 312, { italic: true }),
        T('{NAME}', 350, { size: 26, bold: true, caps: true }),
        T('child of {PARENTS}', 410),
        T('Born on the {BORN}', 442),
        T('has received {HISHER}', 500),
        T('First Holy Communion', 530, { size: 34, font: 'Great Vibes', color: '#7a1f2b' }),
        T('on the {RECEIVED}', 596),
        T('by {MINISTER}', 628),
        CertificateTemplate.image('signature', 498, 760, 240, 80),
        T('{PRIEST}', 842, { x: 448, w: 340, size: 15, bold: true, caps: true }),
        T('Parish Priest', 866, { x: 448, w: 340, size: 13, italic: true }),
        T('Ctrl No. {CTRL}', 966, { x: 70, w: 320, size: 12, align: 'left' }),
        T('{DOCNO} · prepared by {PREPARED_BY}', 970, { x: 426, w: 320, size: 8, align: 'right', color: '#8a8178', font: 'Arial' }),
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
