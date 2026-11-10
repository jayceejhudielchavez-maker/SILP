import { Page } from './Page.js';
import { $, esc, num } from '../utils/helpers.js';
import { Files } from '../utils/Files.js';
import { CommunionRecord } from '../models/CommunionRecord.js';
import { CertificateTemplate, CORE_IMAGES, PLACEHOLDERS, FONT_LIST } from '../certificate/CertificateTemplate.js';
import { CertificateRenderer } from '../certificate/CertificateRenderer.js';

const SAMPLE = new CommunionRecord({
  Id: 'sample', CtrlNo: '2026-0001', Year: '2026', FirstName: 'Juan', MiddleName: 'Santos', LastName: 'Dela Cruz',
  Gender: 'Male', Birthdate: '2018-05-15', Birthplace: 'Cuenca, Batangas', FatherName: 'Jose Dela Cruz', MotherName: 'Maria Santos',
  DateBaptized: '2018-06-10', ChurchBaptized: 'San Isidro Labrador Parish', BaptismMinister: 'Rev. Fr. Baptism Minister',
  DateCommunion: '2026-05-15', CommunionMinister: 'Rev. Fr. Communion Minister',
});

const TABS = [['item', 'Item'], ['page', 'Page'], ['pics', 'Pictures'], ['help', 'Placeholders']];
const BORDER_STYLES = ['none', 'solid', 'double', 'dashed', 'dotted', 'groove', 'ridge', 'inset', 'outset'];
const cssColor = (c, fallback) => /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : fallback;

// Admin: visual certificate editor. Changes stay in a draft until "Save template".
export class TemplatePage extends Page {
  constructor(app) {
    super(app, 'Template', { adminOnly: true });
    this.draft = null;            // CertificateTemplate being edited
    this.images = {};             // pictures in the draft
    this.dirtyImages = new Set(); // pictures changed since the last save
    this.dirty = false;
    this.selected = null;         // id of the selected item
    this.tab = 'item';
    this.showing = 'sample';      // 'raw', 'sample', or a record id
    this.scale = 1;
    this.saving = false;
    this.savedAt = 0;

    document.addEventListener('keydown', e => this.#onKey(e));
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => { if (this.#isOpen) this.drawCanvas(); }, 150);
    });
  }

  get #isOpen() { return this.app.currentPage === this; }

  // Our own saves also arrive as live updates; ignore them for a few seconds
  get ignoresTemplatePulse() { return this.saving || Date.now() - this.savedAt < 5000; }

  startDraft() {
    this.draft = this.app.template.clone();
    this.images = Object.assign({}, this.app.images);
    this.dirtyImages = new Set();
    this.dirty = false;
    this.selected = null;
  }

  canLeave() {
    return !this.dirty || confirm('You have unsaved template changes. Leave without saving?');
  }

  leave() {
    this.draft = null;   // drop the unsaved draft
  }

  templateChanged() {
    this.startDraft();
    this.render();
  }

  // ----- drawing

  render() {
    if (!this.draft) this.startDraft();
    const recs = [...this.app.records].sort((a, b) => String(b.CtrlNo).localeCompare(String(a.CtrlNo))).slice(0, 300);
    this.view.innerHTML = `
      <div class="card row" style="margin-bottom:12px">
        <button class="btn o s" data-action="addText">+ Text</button>
        <button class="btn o s" data-action="addPicture">+ Picture</button>
        <button class="btn o s" data-action="duplicate">Duplicate</button>
        <button class="btn o s" data-action="remove">Delete</button>
        <span class="mu">Show:</span>
        <select style="max-width:260px" data-role="show">
          <option value="raw" ${this.showing === 'raw' ? 'selected' : ''}>Placeholders ({NAME}…)</option>
          <option value="sample" ${this.showing === 'sample' ? 'selected' : ''}>Sample data</option>
          ${recs.map(r => `<option value="${esc(r.Id)}" ${this.showing === r.Id ? 'selected' : ''}>${esc(r.CtrlNo)} · ${esc(r.sortName)}</option>`).join('')}
        </select>
        <span class="sp"></span>
        <span data-role="state" class="mu"></span>
        <button class="btn o s" data-action="preview">Preview</button>
        <button class="btn o s" data-action="reset">Reset to default</button>
        <button class="btn s" data-action="save">Save template</button>
      </div>
      <div class="tpl">
        <div class="stage" data-role="stage"></div>
        <div class="card side">
          <div class="tabs">${TABS.map(([k, l]) => `<button class="${this.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${l}</button>`).join('')}</div>
          <div data-role="panel"></div>
        </div>
      </div>`;
    this.view.querySelector('[data-role=stage]').addEventListener('pointerdown', e => this.#onPointerDown(e));
    this.app.fonts.ensure(this.draft);
    this.drawCanvas();
    this.drawPanel();
    this.markDirty(this.dirty);
  }

  get #record() {
    if (this.showing === 'raw') return null;
    return this.app.recordById(this.showing) || SAMPLE;
  }

  drawCanvas() {
    const stage = this.view.querySelector('[data-role=stage]');
    if (!stage) return;
    const renderer = new CertificateRenderer(this.draft, this.images, this.app.me.username);
    const html = renderer.render(this.#record, null, { editor: true, selected: this.selected, raw: this.showing === 'raw' });
    this.scale = CertificateRenderer.fit(stage, html);
  }

  markDirty(value = true) {
    this.dirty = value;
    const el = this.view.querySelector('[data-role=state]');
    if (el) el.innerHTML = value ? '<b style="color:var(--warn)">Unsaved changes</b>' : 'Saved';
  }

  #changed() {
    this.markDirty();
    this.drawCanvas();
  }

  #select(id, tab = 'item') {
    this.selected = id;
    this.tab = tab;
    this.render();
  }

  // ----- the side panel

  drawPanel() {
    const panel = this.view.querySelector('[data-role=panel]');
    if (!panel) return;
    if (this.tab === 'page') panel.innerHTML = this.#pagePanel();
    else if (this.tab === 'pics') panel.innerHTML = this.#picturesPanel();
    else if (this.tab === 'help') panel.innerHTML = this.#helpPanel();
    else panel.innerHTML = this.#itemPanel();
  }

  #pagePanel() {
    const st = this.draft.settings;
    return `
      <label>Parish Priest name ({PRIEST})</label><input data-s="priestName" value="${esc(st.priestName)}">
      <label>Page colour</label><input type="color" data-s="pageColor" value="${esc(cssColor(st.pageColor, '#ffffff'))}">
      <label>Border style</label><select data-s="borderStyle">${BORDER_STYLES.map(s => `<option ${st.borderStyle === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <div class="grid g3">
        <div><label>Width (px)</label><input type="number" data-s="borderWidth" value="${esc(st.borderWidth)}"></div>
        <div><label>Distance from edge</label><input type="number" data-s="borderInset" value="${esc(st.borderInset)}"></div>
        <div><label>Colour</label><input type="color" data-s="borderColor" value="${esc(cssColor(st.borderColor, '#000000'))}"></div>
      </div>
      <label>Google Fonts to load (comma separated)</label><input data-s="googleFonts" value="${esc(st.googleFonts)}">
      <small>Any font name works if it is installed on the laptop. Fonts listed here are downloaded from Google Fonts so every laptop looks the same.</small>`;
  }

  #picturesPanel() {
    return Object.entries(CORE_IMAGES).map(([key, label]) => `
      <div class="row" style="margin-bottom:12px">
        ${this.images[key] ? `<img class="thumb" src="${this.images[key]}" alt="">` : '<div class="thumb ph">none</div>'}
        <div class="sp"><b>${label}</b><br>
          <button class="btn s o" data-action="upload" data-key="${key}">Upload</button>
          ${this.images[key] ? `<button class="btn s g" data-action="removeImage" data-key="${key}">Remove</button>` : ''}</div>
      </div>`).join('') +
      '<small>The Archdiocese and parish logos from the parish\'s certificate design are built in; uploading a picture replaces them, ' +
      'and Remove goes back to the built-in one. Use a PNG with a transparent background for the signature. ' +
      'Pictures are resized to at most 1000 px and stored in the database.</small>';
  }

  #helpPanel() {
    return `<p class="mu">Type these in any text item. They fill in from the record when printing.</p>
      <table>${PLACEHOLDERS.map(([k, d]) => `<tr><td class="mono">${k}</td><td><small>${d}</small></td></tr>`).join('')}</table>
      <p class="mu">Tips: drag items to move them, drag the blue corner to resize, use the arrow keys to nudge (Shift moves 10 px), Delete removes the selected item.</p>`;
  }

  #itemPanel() {
    const it = this.selected && this.draft.item(this.selected);
    if (!it) return '<p class="mu">Click an item on the certificate to edit it, or add a new text or picture.</p>';
    const numIn = (k, step = 1) => `<input type="number" step="${step}" data-k="${k}" value="${esc(it[k])}">`;
    const position = `<div class="grid g2">
        <div><label>X (from left)</label>${numIn('x')}</div><div><label>Y (from top)</label>${numIn('y')}</div>
        <div><label>Width</label>${numIn('w')}</div>${it.type === 'image' ? `<div><label>Height</label>${numIn('h')}</div>` : ''}
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn s o" data-action="center">Center horizontally</button>
        <button class="btn s o" data-action="layer" data-dir="1">Bring to front</button>
        <button class="btn s o" data-action="layer" data-dir="-1">Send to back</button>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn s o" data-action="duplicate">Duplicate</button>
        <button class="btn s d" data-action="remove">Delete</button></div>`;

    if (it.type === 'image') {
      const own = !(it.img in CORE_IMAGES);
      return `<label>Picture</label><select data-k="img">
          ${Object.entries(CORE_IMAGES).map(([k, l]) => `<option value="${k}" ${it.img === k ? 'selected' : ''}>${l}</option>`).join('')}
          ${own ? `<option value="${esc(it.img)}" selected>This item's own picture</option>` : ''}</select>
        <div class="row" style="margin-top:8px"><button class="btn s o" data-action="upload" data-key="${esc(it.img)}">Upload / replace picture</button>
          ${own ? '' : '<button class="btn s o" data-action="ownPicture">Use a different picture here</button>'}</div>
        ${position}`;
    }
    return `<label>Text (placeholders allowed)</label><textarea rows="3" data-k="text">${esc(it.text)}</textarea>
      <label>Font (any font name)</label><input data-k="font" list="fontList" value="${esc(it.font)}">
      <datalist id="fontList">${FONT_LIST.map(f => `<option value="${f}">`).join('')}</datalist>
      <div class="grid g3">
        <div><label>Size (pt)</label>${numIn('size', 0.5)}</div>
        <div><label>Line height</label>${numIn('lh', 0.05)}</div>
        <div><label>Colour</label><input type="color" data-k="color" value="${esc(cssColor(it.color, '#000000'))}"></div>
      </div>
      <label>Alignment</label><select data-k="align">${['left', 'center', 'right', 'justify'].map(a => `<option ${it.align === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <div style="margin-top:10px">${[['bold', 'Bold'], ['italic', 'Italic'], ['underline', 'Underline'], ['caps', 'ALL CAPS'], ['fit', 'Shrink long text to one line']]
        .map(([k, l]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${it[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      ${position}`;
  }

  // ----- events

  actions() {
    return {
      tab: el => { this.tab = el.dataset.tab; this.render(); },
      addText: () => { this.markDirty(); this.#select(this.draft.addText().id); },
      addPicture: () => this.#addPicture(),
      duplicate: () => this.#duplicate(),
      remove: () => this.#remove(),
      center: () => { this.draft.center(this.selected); this.#changed(); this.drawPanel(); },
      layer: el => { this.draft.moveLayer(this.selected, Number(el.dataset.dir)); this.#changed(); },
      upload: el => this.#upload(el.dataset.key),
      removeImage: el => { delete this.images[el.dataset.key]; this.dirtyImages.add(el.dataset.key); this.#changed(); this.drawPanel(); },
      ownPicture: () => { const it = this.draft.item(this.selected); it.img = 'pic_' + Math.random().toString(36).slice(2, 10); return this.#upload(it.img); },
      preview: () => this.#preview(),
      reset: () => this.#reset(),
      save: btn => this.app.busy(btn, () => this.#save()),
    };
  }

  onInput(e) {
    this.#applyField(e.target);
  }

  onChange(e) {
    const t = e.target;
    if (t.dataset.role === 'show') { this.showing = t.value; this.drawCanvas(); return; }
    if (t.type === 'checkbox' || t.tagName === 'SELECT') this.#applyField(t);
    if (t.dataset.k === 'img') this.drawPanel();
    if (t.dataset.s === 'googleFonts') { this.app.fonts.ensure(this.draft); setTimeout(() => this.drawCanvas(), 800); }
  }

  // Panel fields: data-s = page setting, data-k = property of the selected item
  #applyField(t) {
    if (t.dataset.s) {
      const k = t.dataset.s;
      this.draft.settings[k] = /borderWidth|borderInset/.test(k) ? num(t.value) : t.value;
    } else if (t.dataset.k) {
      const it = this.draft.item(this.selected);
      if (!it) return;
      it[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? num(t.value) : t.value;
    } else {
      return;
    }
    this.#changed();
  }

  // Drag an item to move it; drag the blue corner to resize it
  #onPointerDown(e) {
    const el = e.target.closest('[data-id]');
    if (!el) {
      if (this.selected) { this.selected = null; this.drawCanvas(); this.drawPanel(); }
      return;
    }
    e.preventDefault();
    const it = this.draft.item(el.dataset.id);
    const resizing = !!e.target.dataset.h;
    if (this.selected !== it.id) this.#select(it.id);
    const node = this.view.querySelector(`[data-role=stage] [data-id="${it.id}"]`);
    const start = { x: e.clientX, y: e.clientY, ix: it.x, iy: it.y, w: it.w, h: it.h };

    const move = ev => {
      const dx = (ev.clientX - start.x) / this.scale, dy = (ev.clientY - start.y) / this.scale;
      if (resizing) {
        it.w = Math.max(20, Math.round(start.w + dx));
        node.style.width = it.w + 'px';
        if (it.type === 'image') { it.h = Math.max(20, Math.round(start.h + dy)); node.style.height = it.h + 'px'; }
      } else {
        it.x = Math.round(start.ix + dx);
        it.y = Math.round(start.iy + dy);
        node.style.left = it.x + 'px';
        node.style.top = it.y + 'px';
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (it.x !== start.ix || it.y !== start.iy || it.w !== start.w || it.h !== start.h) { this.markDirty(); this.drawPanel(); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Arrow keys nudge the selected item (Shift = 10 px); Delete removes it
  #onKey(e) {
    if (!this.#isOpen || !this.selected || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || this.app.modal.isOpen) return;
    const it = this.draft.item(this.selected);
    if (!it) return;
    const step = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      it.x += moves[e.key][0];
      it.y += moves[e.key][1];
      this.#changed();
      this.drawPanel();
    } else if (e.key === 'Delete') {
      this.#remove();
    }
  }

  // ----- actions

  async #addPicture() {
    const file = await Files.pick('image/*');
    if (!file) return;
    const it = this.draft.addImage('pic_' + Math.random().toString(36).slice(2, 10));
    this.images[it.img] = await Files.readImage(file);
    this.dirtyImages.add(it.img);
    this.markDirty();
    this.#select(it.id);
  }

  async #upload(key) {
    const file = await Files.pick('image/*');
    if (!file) return;
    this.images[key] = await Files.readImage(file);
    this.dirtyImages.add(key);
    this.#changed();
    this.drawPanel();
  }

  #duplicate() {
    if (!this.selected) return this.app.toast.show('Select an item first', true);
    const copy = this.draft.duplicate(this.selected);
    this.markDirty();
    this.#select(copy.id);
  }

  #remove() {
    if (!this.selected) return this.app.toast.show('Select an item first', true);
    this.draft.remove(this.selected);
    this.selected = null;
    this.markDirty();
    this.render();
  }

  #preview() {
    const r = this.#record || SAMPLE;
    this.app.modal.open(`<div class="row"><h3 class="sp">Preview · ${esc(r.CtrlNo)} ${esc(r.fullName)}</h3>
      <button class="btn o" data-action="close">Close</button></div><div class="stage" id="pvStage"></div>`, {}, true);
    CertificateRenderer.fit($('pvStage'), new CertificateRenderer(this.draft, this.images, this.app.me.username).render(r, null));
  }

  async #reset() {
    const ok = await this.app.modal.confirm('Reset to the default layout?',
      'The editor goes back to the original certificate layout. Your uploaded logos and signature stay. Nothing changes for other laptops until you press <b>Save template</b>.', 'Reset');
    if (!ok) return;
    this.draft = CertificateTemplate.createDefault();
    this.selected = null;
    this.markDirty();
    this.render();
  }

  async #save() {
    this.saving = true;
    try {
      const used = this.draft.usedImageKeys();
      for (const key of this.dirtyImages) {
        if (!(key in CORE_IMAGES) && !used.has(key)) continue;   // picture of a deleted item, nothing to upload
        await this.app.db.saveImage(key, this.images[key] || '');
      }
      await this.app.db.saveTemplate(this.draft);
      this.app.setTemplate(this.draft.clone(), Object.assign({}, this.images));
      this.dirtyImages = new Set();
      this.markDirty(false);
      this.app.toast.show('Template saved. All laptops will use it.');
    } finally {
      this.saving = false;
      this.savedAt = Date.now();
    }
  }
}
