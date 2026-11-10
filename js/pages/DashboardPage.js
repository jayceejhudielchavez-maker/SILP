import { Page } from './Page.js';
import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';
import { PARISH, PARISH_PLACE } from '../config.js';
import { Motion } from '../ui/Motion.js';

const ICONS = {
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
};
const icon = name => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Home page: parish banner, key numbers, communicants per year, boys and girls, recent changes
export class DashboardPage extends Page {
  constructor(app) {
    super(app, 'Dashboard');
    this.shown = {};   // numbers currently on screen, so live updates count from them instead of from 0
  }

  #stats() {
    const R = this.app.records;
    const year = new Date().getFullYear();
    const byYear = {};
    R.forEach(r => { byYear[r.Year] = (byYear[r.Year] || 0) + 1; });
    const years = Object.keys(byYear).sort();
    return {
      total: R.length,
      male: R.filter(r => r.Gender === 'Male').length,
      female: R.filter(r => r.Gender === 'Female').length,
      thisYear: byYear[year] || 0,
      lastYear: byYear[year - 1] || 0,
      years: years.length,
      firstYear: years[0] || '',
      byYear,
      recent: [...R].sort((a, b) => String(b.UpdatedAt).localeCompare(String(a.UpdatedAt))).slice(0, 6),
    };
  }

  render(animate = true) {
    const s = this.#stats();
    const year = new Date().getFullYear();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const change = s.lastYear ? Math.round((s.thisYear - s.lastYear) / s.lastYear * 100) : null;

    this.view.innerHTML = `
      <section class="hero" data-role="hero">
        <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
        <div class="hero-logo-wrap"><img class="hero-logo" src="img/parish-logo.png" alt="Parish of San Isidro Labrador logo" data-role="logo"></div>
        <div class="hero-text">
          <div class="eyebrow">Archdiocese of Lipa</div>
          <h2>${PARISH}</h2>
          <p>First Holy Communion Records · ${PARISH_PLACE}</p>
        </div>
        <div class="hero-side">
          <div class="greet">${greeting}, <b>${esc(this.app.me.username)}</b></div>
          <div class="date">${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div class="row">
            <button class="btn hero-btn" data-action="newEntry">+ New Entry</button>
            <button class="btn hero-btn ghost" data-action="certificates">Print certificates</button>
          </div>
        </div>
      </section>

      <div class="kpis">
        ${DashboardPage.#kpi('people', 'Total communicants', 'total', `Across ${s.years} year${s.years === 1 ? '' : 's'} of records`)}
        ${DashboardPage.#kpi('calendar', `Communicants in ${year}`, 'thisYear',
          change === null ? 'This year so far' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs ${year - 1}`, change !== null && change < 0)}
        ${DashboardPage.#kpi('award', 'Certificates issued', 'issued', 'Printed or downloaded, from the Document Log')}
        ${DashboardPage.#kpi('history', 'Records since', 'since', s.firstYear ? 'First year on record' : 'No records yet')}
      </div>

      <div class="dash-grid">
        <div class="card panel"><div class="panel-head"><b>Communicants per year</b><span class="mu">All records</span></div>
          ${DashboardPage.#chart(s.byYear)}</div>
        <div class="card panel"><div class="panel-head"><b>Boys and girls</b><span class="mu">${s.total} total</span></div>
          ${DashboardPage.#ring(s.male, s.female)}</div>
      </div>

      <div class="card panel">
        <div class="panel-head"><b>Recently updated</b><button class="btn s o" data-action="records">All records</button></div>
        <ul class="recent">
          ${s.recent.map(r => `<li data-action="edit" data-id="${esc(r.Id)}">
              <span class="avatar">${esc((r.FirstName[0] || '') + (r.LastName[0] || ''))}</span>
              <span class="who"><b>${esc(r.fullName)}</b><small class="mono">${esc(r.CtrlNo)}</small></span>
              <span class="when"><small>${esc(Dates.relative(r.UpdatedAt))}<br>by ${esc(r.UpdatedBy)}</small></span></li>`).join('')
            || '<li class="mu">No records yet. Use New Entry to add the first communicant.</li>'}
        </ul>
      </div>`;

    this.#animate(s, animate);
    this.#loadIssued(animate);
  }

  actions() {
    return {
      newEntry: () => this.app.go('New Entry'),
      certificates: () => this.app.go('Certificate'),
      records: () => this.app.go('Records'),
      edit: el => this.app.editRecord(el.dataset.id),
    };
  }

  // Live update from another laptop: redraw without the entrance animation; numbers glide to their new values
  recordsChanged() {
    this.render(false);
  }

  #number(key, value, delay) {
    const el = this.view.querySelector(`[data-count="${key}"]`);
    if (!el) return;
    const from = this.shown[key] || 0;
    this.shown[key] = value;
    Motion.countUp(el, value, { from, delay, ms: from === value ? 1 : 1200 });
  }

  #animate(s, entrance) {
    const v = this.view;
    if (entrance) {
      this.shown = {};
      Motion.reveal([v.querySelector('.hero')], { distance: 14 });
      Motion.reveal(v.querySelectorAll('.kpi'), { stagger: 90 });
      Motion.reveal(v.querySelectorAll('.panel'), { stagger: 120 });
      Motion.reveal(v.querySelectorAll('.recent li'), { stagger: 60, distance: 10 });
    }
    Motion.float(v.querySelector('[data-role=logo]'));
    Motion.parallax(v.querySelector('[data-role=hero]'), v.querySelector('.hero-logo-wrap'), 14);

    this.#number('total', s.total, entrance ? 250 : 0);
    this.#number('thisYear', s.thisYear, entrance ? 350 : 0);
    const since = v.querySelector('[data-count="since"]');
    if (s.firstYear) {
      Motion.countUp(since, Number(s.firstYear),
        { from: entrance ? Number(s.firstYear) - 20 : Number(s.firstYear), delay: 450, format: String });   // a year: no comma
    }
    else since.textContent = '—';

    // Bars grow from the bottom, one after another
    const bars = [...v.querySelectorAll('.bar')];
    bars.forEach((bar, i) => {
      const h = Number(bar.dataset.h), base = Number(bar.dataset.base);
      const label = bar.nextElementSibling;
      Motion.tween(entrance ? 900 : 1, k => {
        bar.setAttribute('y', base - h * k);
        bar.setAttribute('height', h * k);
        label.setAttribute('y', base - h * k - 6);
        label.style.opacity = k;
      }, entrance ? 300 + i * 80 : 0);
    });

    // The ring sweeps round
    v.querySelectorAll('.arc').forEach((arc, i) => {
      const len = Number(arc.dataset.len), circ = Number(arc.dataset.circ);
      Motion.tween(entrance ? 1300 : 1, k => arc.setAttribute('stroke-dasharray', `${len * k} ${circ}`), entrance ? 400 + i * 250 : 0);
    });
    this.#number('male', s.male, entrance ? 400 : 0);
    this.#number('female', s.female, entrance ? 650 : 0);
  }

  // Certificates issued comes from the Document Log, loaded after the page shows
  async #loadIssued(entrance) {
    try {
      const docs = await this.app.db.loadDocuments();
      if (this.app.currentPage !== this) return;
      const issued = docs.filter(d => d.type.startsWith('Certificate (')).length;
      this.#number('issued', issued, entrance ? 200 : 0);
    } catch (e) {
      const el = this.view.querySelector('[data-count="issued"]');
      if (el) el.textContent = '—';
    }
  }

  static #kpi(iconName, label, key, foot, bad = false) {
    return `<div class="card kpi">
      <div class="kpi-icon">${icon(iconName)}</div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" data-count="${key}">0</div>
      <div class="kpi-foot${bad ? ' down' : ''}">${foot}</div>
    </div>`;
  }

  // Bars start at zero height; #animate grows them
  static #chart(byYear) {
    const years = Object.keys(byYear).sort().slice(-12);
    if (!years.length) return '<p class="mu">No records yet.</p>';
    const max = Math.max(...years.map(y => byYear[y])), H = 200, base = H;
    const bw = Math.min(56, Math.floor(560 / years.length) - 12);
    const W = Math.max(years.length * (bw + 14) + 20, 220);
    const bars = years.map((y, i) => {
      const h = Math.max(3, Math.round(byYear[y] / max * (H - 34))), x = 10 + i * (bw + 14);
      return `<rect class="bar" x="${x}" y="${base}" width="${bw}" height="0" rx="6" data-h="${h}" data-base="${base}"/>
        <text x="${x + bw / 2}" y="${base - 6}" text-anchor="middle" class="bar-num" style="opacity:0">${byYear[y]}</text>
        <text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle" class="bar-year">${esc(y)}</text>`;
    }).join('');
    return `<div style="overflow-x:auto"><svg class="chart" width="${W}" height="${H + 26}">
      <defs><linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--chart)"/><stop offset="1" style="stop-color:var(--chart);stop-opacity:.55"/></linearGradient></defs>
      <line x1="0" y1="${base}" x2="${W}" y2="${base}" class="axis"/>${bars}</svg></div>`;
  }

  // Donut: boys arc then girls arc; #animate sweeps them in
  static #ring(male, female) {
    const total = male + female;
    const r = 70, circ = 2 * Math.PI * r;
    const mLen = total ? circ * male / total : 0, fLen = total ? circ * female / total : 0;
    const fRotate = total ? 360 * male / total : 0;
    return `<div class="ring-wrap">
      <svg width="190" height="190" viewBox="0 0 190 190" class="ring">
        <circle cx="95" cy="95" r="${r}" class="ring-track"/>
        <circle cx="95" cy="95" r="${r}" class="arc arc-m" data-len="${mLen}" data-circ="${circ}" stroke-dasharray="0 ${circ}" transform="rotate(-90 95 95)"/>
        <circle cx="95" cy="95" r="${r}" class="arc arc-f" data-len="${fLen}" data-circ="${circ}" stroke-dasharray="0 ${circ}" transform="rotate(${fRotate - 90} 95 95)"/>
      </svg>
      <div class="legend">
        <div><span class="dot dot-m"></span>Boys <b data-count="male">0</b></div>
        <div><span class="dot dot-f"></span>Girls <b data-count="female">0</b></div>
        ${total < 1 ? '<small class="mu">Gender is shown once records are added.</small>' : ''}
      </div></div>`;
  }
}
