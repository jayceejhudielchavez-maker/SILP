import { Page } from './Page.js';
import { esc } from '../utils/helpers.js';
import { Dates } from '../utils/Dates.js';

export class DashboardPage extends Page {
  constructor(app) {
    super(app, 'Dashboard');
  }

  render() {
    const R = this.app.records;
    const male = R.filter(r => r.Gender === 'Male').length;
    const female = R.filter(r => r.Gender === 'Female').length;
    const byYear = {};
    R.forEach(r => { byYear[r.Year] = (byYear[r.Year] || 0) + 1; });
    const thisYear = String(new Date().getFullYear());
    const recent = [...R].sort((a, b) => String(b.UpdatedAt).localeCompare(String(a.UpdatedAt))).slice(0, 8);

    this.view.innerHTML = `
      <div class="grid g4">
        ${DashboardPage.stat('Total communicants', R.length)}
        ${DashboardPage.stat('Male', male)}
        ${DashboardPage.stat('Female', female)}
        ${DashboardPage.stat(`This year (${thisYear})`, byYear[thisYear] || 0)}
      </div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><b>Communicants per year</b>${DashboardPage.chart(byYear)}</div>
        <div class="card"><b>Recently updated</b>
          <table style="margin-top:8px"><tr><th>Ctrl No.</th><th>Name</th><th>Updated</th></tr>
          ${recent.map(r => `<tr><td class="mono">${esc(r.CtrlNo)}</td><td>${esc(r.sortName)}</td>
            <td><small>${esc(Dates.stamp(r.UpdatedAt))}<br>by ${esc(r.UpdatedBy)}</small></td></tr>`).join('')
            || '<tr><td colspan="3" class="mu">No records yet. Use New Entry to add the first communicant.</td></tr>'}
          </table></div>
      </div>`;
  }

  recordsChanged() {
    this.render();
  }

  static stat(label, value) {
    return `<div class="card"><div class="mu">${label}</div><div class="stat">${value}</div></div>`;
  }

  // Bar chart drawn as SVG (no chart library needed)
  static chart(byYear) {
    const years = Object.keys(byYear).sort();
    if (!years.length) return '<p class="mu">No records yet.</p>';
    const max = Math.max(...years.map(y => byYear[y])), H = 200;
    const bw = Math.min(56, Math.floor(560 / years.length) - 10);
    const W = Math.max(years.length * (bw + 12) + 20, 200);
    const bars = years.map((y, i) => {
      const h = Math.max(2, Math.round(byYear[y] / max * (H - 30))), x = 10 + i * (bw + 12);
      // Colours come from the theme (style="fill:var(...)" so they change in dark mode)
      return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h}" rx="4" style="fill:var(--chart)"/>
        <text x="${x + bw / 2}" y="${H - h - 6}" text-anchor="middle" font-size="12" style="fill:var(--chart-ink)">${byYear[y]}</text>
        <text x="${x + bw / 2}" y="${H + 16}" text-anchor="middle" font-size="12" style="fill:var(--mu)">${esc(y)}</text>`;
    }).join('');
    return `<div style="overflow-x:auto"><svg width="${W}" height="${H + 24}" style="margin-top:10px">
      <line x1="0" y1="${H}" x2="${W}" y2="${H}" style="stroke:var(--line)"/>${bars}</svg></div>`;
  }
}
