import { esc } from '../utils/helpers.js';

// Search text + year, shared by the Records and Database pages
export class RecordFilter {
  constructor() {
    this.query = '';
    this.year = '';
  }

  apply(records) {
    return records
      .filter(r => r.matches(this.query, this.year))
      .sort((a, b) => String(b.CtrlNo).localeCompare(String(a.CtrlNo)));
  }

  static years(records) {
    return [...new Set(records.map(r => r.Year))].sort().reverse();
  }

  // The search box and year dropdown; inputs are marked data-filter so pages can react
  html(records) {
    return `<div class="row" style="margin-bottom:12px">
      <input style="max-width:320px" placeholder="Search name or Control No." value="${esc(this.query)}" data-filter="query">
      <select style="max-width:160px" data-filter="year">
        <option value="">All years</option>
        ${RecordFilter.years(records).map(y => `<option ${this.year === y ? 'selected' : ''}>${esc(y)}</option>`).join('')}
      </select>
      <span class="sp"></span><span data-role="count" class="mu"></span></div>`;
  }

  // Returns true if the event changed the filter
  update(event) {
    const key = event.target.dataset && event.target.dataset.filter;
    if (!key) return false;
    this[key] = event.target.value;
    return true;
  }
}
