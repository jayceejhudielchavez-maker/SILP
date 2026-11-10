import { AppError } from '../utils/helpers.js';
import { CommunionRecord } from '../models/CommunionRecord.js';
import { DocEntry } from '../models/DocEntry.js';

// Every read and write to Supabase goes through this class.
// Writes call the database functions in supabase/schema.sql, which check the user's role themselves.
export class Database {
  #onSessionEnded = () => {};

  constructor(url, key) {
    if (!window.supabase) throw new AppError('The database library could not load. Check the internet connection and reload the page.');
    if (/YOUR-PROJECT-REF|YOUR_KEY/.test(url + key)) {
      throw new AppError('Supabase is not set up yet. Put the Project URL and publishable key in public/js/config.js (see README).');
    }
    this.url = url;
    this.key = key;
    this.client = window.supabase.createClient(url, key);
  }

  set onSessionEnded(fn) { this.#onSessionEnded = fn; }

  // Turns a Supabase error into a message people can act on
  toError(e) {
    if (e instanceof AppError) return e;
    const m = (e && e.message) || String(e);
    if (/JWT|refresh token|not authenticated|Please sign in again/i.test(m)) {
      this.#onSessionEnded();
      return new AppError('Your session ended. Please sign in again.', { silent: true });
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return new AppError('Cannot reach the database. Check the internet connection and try again.');
    return new AppError(m);
  }

  async run(request) {
    let result;
    try { result = await request; } catch (e) { throw this.toError(e); }
    if (result.error) throw this.toError(result.error);
    return result.data;
  }

  rpc(name, args = {}) {
    return this.run(this.client.rpc(name, args));
  }

  // Supabase returns at most 1,000 rows per request, so read in pages
  async #readAll(table, order) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = await this.run(this.client.from(table).select('*').order(order).range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  // ----- records

  needsSetup() { return this.rpc('needs_setup'); }

  async loadRecords() {
    return (await this.#readAll('records', 'ctrl_no')).map(row => CommunionRecord.fromDb(row));
  }

  // New records get their Control No. from the server; edits must start from the latest version
  async saveRecord(record, expectedUpdatedAt) {
    const row = await this.rpc('save_record', { p: record.toDb(), p_expected: expectedUpdatedAt || null });
    return CommunionRecord.fromDb(row);
  }

  deleteRecord(id) { return this.rpc('delete_record', { p_id: id }); }

  restoreRecords(records, mode) {
    return this.rpc('restore_records', { p_rows: records.map(r => r.toDb()), p_mode: mode });
  }

  listBackups() {
    return this.run(this.client.from('backups').select('id,created_at,created_by,note,row_count').order('id', { ascending: false }).limit(50));
  }

  makeBackup(note) { return this.rpc('make_backup', { p_note: note || null }); }
  restoreBackup(id) { return this.rpc('restore_backup', { p_id: id }); }

  // ----- certificate template

  async loadTemplate() {
    const t = await this.run(this.client.from('cert_template').select('data').maybeSingle());
    const images = {};
    (await this.run(this.client.from('cert_images').select('key,data'))).forEach(i => { images[i.key] = i.data; });
    return { data: t ? t.data : null, images };
  }

  saveImage(key, data) { return this.rpc('save_image', { p_key: key, p_data: data || null }); }
  saveTemplate(template) { return this.rpc('save_template', { p_data: template.toJSON() }); }

  // ----- document log

  async logDocument({ type, ctrl = null, name = null, detail = null }) {
    return new DocEntry(await this.rpc('log_doc', { p_type: type, p_ctrl: ctrl, p_name: name, p_detail: detail }));
  }

  // Many certificates at once: one Document No. per certificate, plus one for the batch (its waybill)
  async logCertificateBatch(format, records) {
    const res = await this.rpc('log_certificate_batch', {
      p_format: format,
      p_items: records.map(r => ({ ctrl: r.CtrlNo, name: r.fullName })),
    });
    return { batch: new DocEntry(res.batch), items: res.items.map(row => new DocEntry(row)) };
  }

  async loadDocuments() {
    const rows = await this.run(this.client.from('documents').select('*').order('id', { ascending: false }).limit(1000));
    return rows.map(r => new DocEntry(r));
  }

  // ----- users (Admin)

  async listUsers() {
    const rows = await this.run(this.client.from('profiles').select('username,role,must_change,created_by,created_at').order('username'));
    return rows.map(u => ({ username: u.username, role: u.role, mustChange: u.must_change, createdBy: u.created_by || '', createdAt: u.created_at }));
  }

  inviteUser(username, role) { return this.rpc('admin_invite', { p_username: username, p_role: role }); }
  cancelInvite(username) { return this.rpc('admin_cancel_invite', { p_username: username }); }
  resetPassword(username, temp) { return this.rpc('admin_reset_password', { p_username: username, p_temp: temp }); }
  setRole(username, role) { return this.rpc('admin_set_role', { p_username: username, p_role: role }); }
  deleteUser(username) { return this.rpc('admin_delete_user', { p_username: username }); }
  passwordChanged() { return this.rpc('password_changed'); }
}
