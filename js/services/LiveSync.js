// Live updates, the same way as ReliefSys: every change in the database inserts a row in
// app_pulse, and Supabase Realtime tells every open laptop within about a second.
export class LiveSync {
  #channel = null;
  #timers = {};
  #wasOffline = false;

  constructor(client, { onRecords, onTemplate, onStatus }) {
    this.client = client;
    this.onRecords = onRecords;
    this.onTemplate = onTemplate;
    this.onStatus = onStatus;
  }

  start() {
    this.stop();
    this.#channel = this.client.channel('pulse')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_pulse' }, ev => {
        if (ev.new && ev.new.kind === 'template') this.#later('template', this.onTemplate);
        else this.#later('records', this.onRecords);
      })
      .subscribe(status => {
        const ok = status === 'SUBSCRIBED';
        this.onStatus(ok);
        if (ok && this.#wasOffline) this.onRecords();   // catch up on anything missed while offline
        this.#wasOffline = !ok;
      });
  }

  stop() {
    if (this.#channel) this.client.removeChannel(this.#channel);
    this.#channel = null;
  }

  // One reload for a burst of changes
  #later(key, fn) {
    clearTimeout(this.#timers[key]);
    this.#timers[key] = setTimeout(fn, 600);
  }
}
