import { MONTHS } from '../config.js';

// Dates are kept as "YYYY-MM-DD" text everywhere, so time zones never shift a birthday
export class Dates {
  static today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  static parse(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }

  static ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // "15th day of May, 2018", as written on the certificate
  static long(iso) {
    const p = Dates.parse(iso);
    return p ? `${Dates.ordinal(p.d)} day of ${MONTHS[p.m - 1]}, ${p.y}` : '';
  }

  // "May 15, 2018"
  static short(iso) {
    const p = Dates.parse(iso);
    return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : '';
  }

  // A database timestamp in the laptop's local time
  static stamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  // "just now", "5 min ago", "3 hours ago", "2 days ago", then the date
  static relative(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    const min = Math.round((Date.now() - d) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return d.toLocaleDateString([], { dateStyle: 'medium' });
  }

  static age(birth, ref) {
    const b = Dates.parse(birth), r = Dates.parse(ref);
    if (!b || !r) return '';
    let a = r.y - b.y;
    if (r.m < b.m || (r.m === b.m && r.d < b.d)) a--;
    return a >= 0 ? a : '';
  }

  // Turns imported values (Excel dates, 5/15/2018, 2018-5-15) into YYYY-MM-DD
  static normalize(v) {
    if (v === undefined || v === null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);   // month/day/year
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const d = new Date(s);
    return isNaN(d) ? s : Dates.normalize(d);
  }
}
