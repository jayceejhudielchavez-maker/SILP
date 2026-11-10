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

  // First and last name, e.g. "Maria Santos". Shown on waybills under "Released By".
  static checkFullName(fullName) {
    const n = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!/^\S+( \S+)+$/.test(n) || n.length < 5) throw new AppError('Please type the full name (first name and last name).');
    if (n.length > 100) throw new AppError('The full name is too long.');
    return n;
  }

  // At least 8 characters and no spaces anywhere ("        " or "jas pass" are refused)
  static checkPassword(password, what = 'Password') {
    const p = String(password || '');
    if (/\s/.test(p)) throw new AppError(`${what} cannot contain spaces.`);
    if (p.length < 8) throw new AppError(`${what} must be at least 8 characters.`);
    return p;
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
    const p = await this.db.run(this.db.client.from('profiles')
      .select('username,role,must_change,status,full_name').eq('id', data.user.id).maybeSingle());
    if (!p) throw new AppError('This account has no access. Use "Request an account" on the sign-in page, or ask the Admin to add you under Users.');
    return { username: p.username, role: p.role, mustChange: p.must_change, pending: p.status === 'Pending',
      fullName: (p.full_name || '').trim() };
  }

  // Accounts without a full name are asked for one right after signing in
  async setMyFullName(fullName) {
    await this.db.rpc('set_my_full_name', { p_name: AuthService.checkFullName(fullName) });
  }

  // "Request an account" on the sign-in page. The account waits as Pending until an Admin approves it.
  async requestAccount(fullName, username, password) {
    const u = AuthService.checkUsername(username);
    AuthService.checkPassword(password);
    const name = AuthService.checkFullName(fullName);
    const { data, error } = await this.#auth.signUp({
      email: this.email(u), password, options: { data: { username: u, full_name: name, request: true } },
    });
    if (error) {
      throw new AppError(/registered|exists/i.test(error.message) ? `The username "${u}" is already taken. Choose another.` : 'Could not send the request: ' + error.message);
    }
    if (!data.session) {
      throw new AppError('Supabase wants email confirmation. The Admin must turn OFF "Confirm email" in Supabase (see README).');
    }
    await this.signOut();   // nothing to do until it is approved
    return u;
  }

  // First-time setup: the first account ever made becomes the Admin (decided in the database)
  async createFirstAdmin(fullName, username, password) {
    const name = AuthService.checkFullName(fullName);
    const u = AuthService.checkUsername(username);
    AuthService.checkPassword(password);
    const { data, error } = await this.#auth.signUp({ email: this.email(u), password, options: { data: { username: u, full_name: name } } });
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
  async createUser(fullName, username, password, role) {
    const name = AuthService.checkFullName(fullName);
    const u = AuthService.checkUsername(username);
    AuthService.checkPassword(password, 'The temporary password');
    await this.db.inviteUser(u, role, name);
    const temp = window.supabase.createClient(this.db.url, this.db.key,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'fhc-new-user' } });
    const { data, error } = await temp.auth.signUp({ email: this.email(u), password, options: { data: { username: u, full_name: name } } });
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
