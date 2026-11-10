import { AppError } from '../utils/helpers.js';

// Sign-in with usernames, the same way ReliefSys does it: each username signs in to
// Supabase Auth as <username>@<EMAIL_DOMAIN>. Passwords are stored by Supabase with bcrypt.
export class AuthService {
  constructor(db, emailDomain) {
    this.db = db;
    this.domain = emailDomain;
  }

  get #auth() { return this.db.client.auth; }

  email(username) {
    return String(username).trim().toLowerCase() + this.domain;
  }

  static checkUsername(username) {
    const u = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new AppError('Username must be 3–30 characters: letters, numbers, dot, dash or underscore.');
    return u;
  }

  static checkPassword(password) {
    if (String(password || '').length < 8) throw new AppError('Password must be at least 8 characters.');
    return password;
  }

  async hasSession() {
    const { data } = await this.#auth.getSession();
    return !!(data && data.session);
  }

  onSignedOut(callback) {
    this.#auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') callback(); });
  }

  async signIn(username, password) {
    const { error } = await this.#auth.signInWithPassword({ email: this.email(username), password });
    if (error) throw new AppError(/invalid login credentials/i.test(error.message) ? 'Wrong username or password.' : 'Cannot sign in: ' + error.message);
  }

  async signOut() {
    await this.#auth.signOut().catch(() => {});
  }

  // The signed-in person's username and role. Accounts the Admin didn't create have no profile.
  async profile() {
    const { data } = await this.#auth.getUser();
    if (!data || !data.user) throw new AppError('Your session ended. Please sign in again.');
    const p = await this.db.run(this.db.client.from('profiles').select('username,role,must_change').eq('id', data.user.id).maybeSingle());
    if (!p) throw new AppError('This account was not created by the Admin, so it has no access. Ask the Admin to add you under Users.');
    return { username: p.username, role: p.role, mustChange: p.must_change };
  }

  // First-time setup: the first account ever made becomes the Admin (decided in the database)
  async createFirstAdmin(username, password) {
    const u = AuthService.checkUsername(username);
    AuthService.checkPassword(password);
    const { data, error } = await this.#auth.signUp({ email: this.email(u), password, options: { data: { username: u } } });
    if (error) throw new AppError('Could not create the account: ' + error.message);
    if (!data.session) {
      throw new AppError('Supabase wants email confirmation. Turn OFF "Confirm email" (see README), delete this user under Authentication → Users, then try again.');
    }
    const me = await this.profile();
    if (me.role !== 'Admin') {
      await this.signOut();
      throw new AppError('Setup was already done by someone else. Ask the Admin for an account.');
    }
    return me;
  }

  // Admin adds a user: the database records the invite, then a throw-away client signs the
  // new account up so the Admin stays signed in
  async createUser(username, password, role) {
    const u = AuthService.checkUsername(username);
    if (String(password || '').length < 8) throw new AppError('The temporary password needs at least 8 characters.');
    await this.db.inviteUser(u, role);
    const temp = window.supabase.createClient(this.db.url, this.db.key,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'fhc-new-user' } });
    const { data, error } = await temp.auth.signUp({ email: this.email(u), password, options: { data: { username: u } } });
    if (error) {
      await this.db.cancelInvite(u).catch(() => {});
      throw new AppError(/registered|exists/i.test(error.message) ? `The username "${u}" is already used.` : 'Could not create the account: ' + error.message);
    }
    if (!data.session) {
      throw new AppError('The account was made, but Supabase wants email confirmation. Turn OFF "Confirm email" (see README), then delete and re-add this user.');
    }
    await temp.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  // After an Admin reset: choose your own password
  async setNewPassword(password) {
    AuthService.checkPassword(password);
    const { error } = await this.#auth.updateUser({ password });
    if (error) throw new AppError(error.message);
    await this.db.passwordChanged();
  }

  async changePassword(username, current, next) {
    AuthService.checkPassword(next);
    const check = await this.#auth.signInWithPassword({ email: this.email(username), password: current });
    if (check.error) throw new AppError('Your current password is wrong.');
    const { error } = await this.#auth.updateUser({ password: next });
    if (error) throw new AppError(error.message);
  }
}
