/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const NF = d => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const nf = (v, d = 2) => NF(d).format(v);
const money = (v, cur, sign) => {
  const r = Math.round(v * 100) / 100;
  const sg = r < 0 ? '−' : (sign && r > 0 ? '+' : '');
  return sg + nf(Math.abs(r)) + (cur ? ' ' + cur : '');
};
const short = v => {
  const a = Math.abs(v), sg = v < 0 ? '−' : (v > 0 ? '+' : '');
  if (a >= 10000) return sg + Math.round(a / 1000) + 'k';
  if (a >= 1000) return sg + (a / 1000).toFixed(1) + 'k';
  return sg + Math.round(a);
};
const cls = v => v > 0 ? 'gain' : v < 0 ? 'loss' : '';
const fmtDate = t => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t || ''); return m ? `${+m[3]} ${MON_S[+m[2] - 1]} ${m[1]}, ${m[4]}:${m[5]}` : (t || ''); };
const fmtDay = k => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(k); return `${+m[3]} ${MON_S[+m[2] - 1]} ${m[1]}`; };
const dayKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const weekdayIdx = k => { const [y, m, d] = k.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; };
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const num = v => { const x = parseNum(v); return Number.isFinite(x) ? x : null; };
const accType = a => a && a.type === 'real' ? 'real' : 'demo';
const CURRENCIES = ['USD', 'PLN', 'EUR'];
const symTag = sy => `<span class="sym" style="--sc:hsl(${[200, 215, 235, 255, 275, 295, 315, 45][[...String(sy)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 8, 3)]} 75% 70%)">${esc(sy)}</span>`;
const curTag = a => `<span class="tag cur">${esc(a.currency)}</span>`;
const typeTag = a => `<span class="tag ${accType(a)}">${accType(a) === 'real' ? 'Real' : 'Demo'}</span>`;

/*PARSER-START*/
function parseNum(s) {
  if (s == null) return NaN;
  s = String(s).replace(/[ \s]/g, '').replace(/−/g, '-');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else s = s.replace(',', '.');
  return parseFloat(s);
}
function parseTV(text) {
  const trades = [], notes = { open: 0, unknown: 0 };
  const re = /^\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/gm;
  const heads = []; let m;
  while ((m = re.exec(text))) heads.push({ i: m.index, d: m[1], t: m[2], end: m.index + m[0].length });
  heads.forEach((h, k) => {
    const chunk = text.slice(h.end, k + 1 < heads.length ? heads[k + 1].i : text.length);
    const act = /(Close|Open)\s+(long|short)\s+position\s+for\s+symbol\s+(\S+?)\s+at\s+price\s+(\d+(?:[.,]\d+)?)\s+for\s+(\d+(?:[.,]\d+)?)\s+units?/i.exec(chunk);
    if (!act) { notes.unknown++; return; }
    if (/^open$/i.test(act[1])) { notes.open++; return; }
    const first = chunk.split(/\r?\n/)[0];
    let nums = first.split('\t').map(s => s.trim()).filter(Boolean);
    if (nums.length < 2) nums = first.match(/-?\d{1,3}(?:[  ]\d{3})*(?:[.,]\d+)?/g) || [];
    const balBefore = nums.length >= 2 ? parseNum(nums[0]) : NaN;
    const balAfter = nums.length >= 2 ? parseNum(nums[1]) : NaN;
    let pnl = NaN;
    if (nums.length >= 3) pnl = parseNum(nums[2]);
    if (!Number.isFinite(pnl)) {
      const pm = /^\s*([+\-−]\s?\d[\d\s .,]*)\s*$/m.exec(chunk);
      if (pm) pnl = parseNum(pm[1]);
    }
    if (!Number.isFinite(pnl) && Number.isFinite(balBefore) && Number.isFinite(balAfter)) pnl = Math.round((balAfter - balBefore) * 100) / 100;
    const avg = /Position AVG Price was\s+(\d+(?:[.,]\d+)?)/i.exec(chunk);
    const cur = /currency:\s*([A-Z]{3})/i.exec(chunk) || /^\s*([A-Z]{3})\s*$/m.exec(chunk);
    const sym = act[3].includes(':') ? act[3].split(':').pop() : act[3];
    trades.push({
      time: `${h.d}T${h.t}`, symbol: sym.toUpperCase(), side: act[2].toLowerCase(),
      qty: parseNum(act[5]), entry: avg ? parseNum(avg[1]) : null, exit: parseNum(act[4]),
      pnl: Number.isFinite(pnl) ? pnl : null,
      balBefore: Number.isFinite(balBefore) ? balBefore : null, balAfter: Number.isFinite(balAfter) ? balAfter : null,
      cur: cur ? cur[1].toUpperCase() : ''
    });
  });
  return { trades, notes };
}
/*PARSER-END*/

const calcPnl = (side, entry, exit, qty) => Math.round((side === 'short' ? entry - exit : exit - entry) * qty * 100) / 100;

/* ---------- state ---------- */
const KEY = 'dziennik-tradow-v1';
const S = { accounts: [], trades: [], activeId: 'all', view: 'overview', month: { y: new Date().getFullYear(), m: new Date().getMonth() }, day: null,
  loaded: false, f: { sym: '', side: [], res: [] }, confirm: null, monthSet: false, period: 'all', stab: 'perf', shown: false, display: null, rates: { PLN: 3.87, EUR: 0.891 } };
let store = { mode: 'local' };
let M = null; /* modal state */

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3600); }
let q = Promise.resolve();
const queue = fn => { q = q.then(fn).catch(e => toast('Could not save: ' + ((e && (e.message || e.code)) || 'error'))); return q; };

function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify({ accounts: S.accounts, trades: S.trades, rates: S.rates, display: S.display })); } catch (e) {} }
function loadLocal() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) { S.accounts = d.accounts || []; S.trades = d.trades || []; if (d.rates) S.rates = { ...S.rates, ...d.rates }; if (d.display) S.display = d.display; } } catch (e) {}
  try { const a = localStorage.getItem(KEY + '-active'); if (a) S.activeId = a; } catch (e) {}
}
const sbErr = r => { if (r && r.error) throw r.error; return r; };
function persistAccounts() {
  if (store.mode === 'sb') return queue(async () => sbErr(await store.c.from('profiles').upsert({ user_id: store.uid, data: { v: 1, accounts: S.accounts, rates: S.rates, display: S.display || null }, updated_at: new Date().toISOString() })));
  return store.mode === 'db' ? queue(() => store.profile.set({ v: 1, accounts: S.accounts, rates: S.rates, display: S.display || null })) : (saveLocal(), Promise.resolve());
}
function persistTrade(t) {
  if (store.mode === 'sb') return queue(async () => sbErr(await store.c.from('trades').upsert({ user_id: store.uid, id: t.id, data: t, updated_at: new Date().toISOString() })));
  return store.mode === 'db' ? queue(() => store.col.doc(t.id).set(t)) : (saveLocal(), Promise.resolve());
}
function persistDelete(id) {
  if (store.mode === 'sb') return queue(async () => sbErr(await store.c.from('trades').delete().eq('user_id', store.uid).eq('id', id)));
  return store.mode === 'db' ? queue(() => store.col.doc(id).delete()) : (saveLocal(), Promise.resolve());
}
/* ---------- Supabase accounts + database (optional, see config.js) ---------- */
const CFG = window.TJ_CONFIG || {};
function sbConfigured() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/YOUR[_-]/i.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY) && window.supabase && window.supabase.createClient); }
function sbUrl() {
  let u = String(CFG.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
  if (/^(eyJ|sb_)/.test(u)) throw new Error('config.js: in SUPABASE_URL you pasted a key. Put the Project URL there (https://xxxx.supabase.co) and the key in SUPABASE_ANON_KEY.');
  if (/^[a-z0-9]{15,25}$/i.test(u)) u = 'https://' + u.toLowerCase() + '.supabase.co';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return x.origin; } catch (e) { throw new Error('config.js: SUPABASE_URL is not a valid address. It should look like https://abcdefgh.supabase.co (Project Settings -> API -> Project URL).'); }
}
async function sbInit() {
  const c = window.supabase.createClient(sbUrl(), String(CFG.SUPABASE_ANON_KEY).trim().replace(/^['"]|['"]$/g, ''));
  store = { mode: 'sb', c, uid: null, email: '', nick: '', ch: null };
  S.auth = { mode: 'signin', msg: '', err: false, busy: false, email: '', nick: '' };
  S.loaded = true;
  c.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_OUT') sbSession(null); else if (session) sbSession(session); });
  const { data } = await c.auth.getSession();
  await sbSession(data && data.session);
}
async function sbSession(session) {
  if (!session) { sbUnlisten(); store.uid = null; store.email = ''; store.nick = ''; S.needNick = false; S.accounts = []; S.trades = []; S.shown = false; render(); return; }
  if (store.uid === session.user.id) return;
  store.uid = session.user.id; store.email = session.user.email || '';
  await sbLoad(true); sbListen();
}
async function sbLoad(first) {
  const c = store.c, uid = store.uid;
  const [p, t, nk] = await Promise.all([c.from('profiles').select('data').eq('user_id', uid).maybeSingle(), c.from('trades').select('data').eq('user_id', uid).limit(20000), c.from('nicknames').select('nick').eq('user_id', uid).maybeSingle()]);
  if (uid !== store.uid) return;
  if (p.error || t.error) { toast('Could not load data: ' + ((p.error || t.error).message || 'error')); if (first) { S.loaded = true; render(); } return; }
  const d = (p.data && p.data.data) || {}, rows = t.data || [];
  const emptyCloud = !p.data && !rows.length;
  store.nick = (nk && nk.data && nk.data.nick) || ''; S.needNick = !store.nick && !(nk && nk.error && !/relation|does not exist|schema cache/i.test(nk.error.message || ''));
  if (nk && nk.error) { S.needNick = false; }
  S.accounts = (d.accounts || []).map(a => ({ ...a }));
  if (d.rates) S.rates = { ...S.rates, ...d.rates };
  if (d.display) S.display = d.display;
  S.trades = rows.map(r => ({ ...r.data }));
  if (first) { try { const a = localStorage.getItem(KEY + '-active'); if (a) S.activeId = a; } catch (e) {} }
  S.loaded = true;
  if (first && emptyCloud) await sbOfferMigrate();
  afterLoad();
  if (!first) { const ae = document.activeElement; if (M || (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !ae.classList.contains('native-hide'))) return; }
  render(first ? undefined : false);
}
async function sbOfferMigrate() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!d || !(d.accounts || []).length) return;
  if (!confirm(`Your account is empty, but this browser has ${d.accounts.length} account(s) and ${(d.trades || []).length} trade(s) saved locally.\n\nUpload them to your account now?`)) return;
  S.accounts = d.accounts; S.trades = d.trades || []; if (d.rates) S.rates = { ...S.rates, ...d.rates }; if (d.display) S.display = d.display;
  await persistAccounts();
  for (let i = 0; i < S.trades.length; i += 200) {
    const part = S.trades.slice(i, i + 200).map(t => ({ user_id: store.uid, id: t.id, data: t, updated_at: new Date().toISOString() }));
    try { sbErr(await store.c.from('trades').upsert(part)); } catch (e) { toast('Upload failed: ' + (e.message || 'error')); return; }
  }
  toast('Local data uploaded to your account');
}
function sbListen() {
  sbUnlisten();
  let h; const go = () => { clearTimeout(h); h = setTimeout(() => sbLoad(false), 500); };
  const f = 'user_id=eq.' + store.uid;
  try { store.ch = store.c.channel('tj-' + store.uid).on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: f }, go).on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: f }, go).subscribe(); } catch (e) {}
}
function sbUnlisten() { try { if (store.ch) store.c.removeChannel(store.ch); } catch (e) {} if (store) store.ch = null; }
document.addEventListener('visibilitychange', () => { if (!document.hidden && store.mode === 'sb' && store.uid) sbLoad(false); });
const NICK_RE = /^[A-Za-z0-9_.-]{3,20}$/;
function authHTML() {
  const a = S.auth, up = a.mode === 'signup';
  return `<div class="authwrap"><form id="auth-form" class="panel authbox"><small class="muted">Trading journal</small><h1>${up ? 'Create account' : 'Sign in'}</h1>
  <p class="muted" style="margin:0">Your trades are saved in your own account and sync between all your devices.</p>
  ${up ? `<label class="f">Nickname<input type="text" name="nick" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_.\-]{3,20}" autocomplete="username" value="${esc(a.nick || '')}" placeholder="3-20 characters: letters, digits, _ . -"></label>
  <label class="f">E-mail<input type="email" name="email" required autocomplete="email" value="${esc(a.email || '')}"></label>`
  : `<label class="f">E-mail or nickname<input type="text" name="login" required autocomplete="username" value="${esc(a.email || '')}"></label>`}
  <label class="f">Password<input type="password" name="password" required minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}"></label>
  ${a.msg ? `<p class="authmsg${a.err ? ' err' : ''}" role="status">${esc(a.msg)}</p>` : ''}
  <button class="btn primary" type="submit"${a.busy ? ' disabled' : ''}>${a.busy ? 'Please wait…' : up ? 'Create account' : 'Sign in'}</button>
  <p class="muted authsw">${up ? 'Already have an account?' : 'No account yet?'} <button type="button" class="linkbtn" data-act="auth-switch">${up ? 'Sign in' : 'Create one'}</button></p></form></div>`;
}
function nickHTML() {
  const a = S.auth;
  return `<div class="authwrap"><form id="nick-form" class="panel authbox"><small class="muted">Signed in as ${esc(store.email)}</small><h1>Choose a nickname</h1>
  <p class="muted" style="margin:0">You can use it instead of your e-mail to sign in, and it is shown in the top bar. It cannot be changed later.</p>
  <label class="f">Nickname<input type="text" name="nick" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_.\-]{3,20}" autocomplete="off" value="${esc(a.nick || '')}" placeholder="3-20 characters: letters, digits, _ . -"></label>
  ${a.msg ? `<p class="authmsg${a.err ? ' err' : ''}" role="status">${esc(a.msg)}</p>` : ''}
  <button class="btn primary" type="submit"${a.busy ? ' disabled' : ''}>${a.busy ? 'Please wait…' : 'Save nickname'}</button>
  <p class="muted authsw"><button type="button" class="linkbtn" data-act="logout">Sign out</button></p></form></div>`;
}
document.addEventListener('submit', async e => {
  const id = e.target.id;
  if (id !== 'auth-form' && id !== 'nick-form') return;
  e.preventDefault();
  const fd = new FormData(e.target), g = k => String(fd.get(k) || '').trim(), password = String(fd.get('password') || ''), a = S.auth, c = store.c;
  if (id === 'nick-form') {
    const nick = g('nick'); a.nick = nick;
    if (!NICK_RE.test(nick)) { a.msg = 'Nickname: 3-20 characters, only letters, digits, _ . -'; a.err = true; render(); return; }
    a.busy = true; a.msg = ''; a.err = false; render();
    const r = await c.from('nicknames').insert({ user_id: store.uid, nick });
    a.busy = false;
    if (r.error) { a.msg = /duplicate|unique/i.test(r.error.message || '') ? 'This nickname is already taken.' : (r.error.message || 'Could not save the nickname'); a.err = true; render(); return; }
    store.nick = nick; S.needNick = false; a.msg = ''; render(); return;
  }
  a.busy = true; a.msg = ''; a.err = false; render();
  try {
    if (a.mode === 'signup') {
      const nick = g('nick'), email = g('email'); a.nick = nick; a.email = email;
      if (!NICK_RE.test(nick)) throw new Error('Nickname: 3-20 characters, only letters, digits, _ . -');
      const av = await c.rpc('nick_available', { n: nick });
      if (av.error) throw new Error('Database is not set up for nicknames yet. Run supabase.sql again in Supabase.');
      if (av.data === false) throw new Error('This nickname is already taken.');
      const r = await c.auth.signUp({ email, password, options: { data: { nickname: nick } } }); if (r.error) throw r.error;
      if (!r.data || !r.data.session) { a.msg = 'Account created. Check your e-mail, click the confirmation link, then sign in with your nickname or e-mail.'; a.mode = 'signin'; a.email = nick; }
    } else {
      let email = g('login'); a.email = email;
      if (!email.includes('@')) {
        const r0 = await c.rpc('email_for_nick', { n: email });
        if (r0.error || !r0.data) throw new Error('Invalid login credentials');
        email = r0.data;
      }
      const r = await c.auth.signInWithPassword({ email, password }); if (r.error) throw r.error;
    }
  } catch (err) { a.msg = (err && err.message) || 'Something went wrong'; a.err = true; }
  a.busy = false; if (!store.uid) render();
});
function rememberActive() { try { localStorage.setItem(KEY + '-active', S.activeId); } catch (e) {} }

async function initStore() {
  if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/YOUR[_-]/i.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY) && !(window.supabase && window.supabase.createClient)) toast('Database library did not load (blocked or offline), so accounts are off. Reload the page.');
  if (sbConfigured()) { try { await sbInit(); return; } catch (e) { toast('Could not connect to the database: ' + (e.message || e)); } }
  const wt = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  try {
    if (window.claude && window.claude.use) {
      const [db, user] = await Promise.all([wt(claude.use('db'), 6000), wt(claude.use('user'), 6000)]);
      if (db && user) {
        const id = await wt(user.id(), 4000);
        if (id) {
          const profile = db.doc('data/users/' + id + '/profile');
          const col = profile.collection('trades');
          store = { mode: 'db', profile, col };
          let gotP = false, gotT = false;
          const ready = () => { if (gotP && gotT) { S.loaded = true; afterLoad(); render(); } };
          profile.onSnapshot(s => { const d = s.exists ? (s.data() || {}) : {}; S.accounts = (d.accounts || []).map(a => ({ ...a })); if (d.rates) S.rates = { ...S.rates, ...d.rates }; if (d.display) S.display = d.display; gotP = true; ready(); }, () => {});
          col.limit(1000).onSnapshot(s => { S.trades = s.docs.map(d => ({ ...d.data() })); gotT = true; ready(); }, () => {});
          try { const a = localStorage.getItem(KEY + '-active'); if (a) S.activeId = a; } catch (e) {}
          return;
        }
      }
    }
  } catch (e) {}
  store = { mode: 'local' };
  loadLocal();
  S.loaded = true; afterLoad(); render();
}
function afterLoad() {
  if (!S.monthSet && S.trades.length) {
    normalizeScope();
    const sc = scopeTrades();
    if (sc.length && !sc.some(t => t.time.startsWith(`${S.month.y}-${pad(S.month.m + 1)}`))) {
      const last = [...sc].sort((a, b) => a.time < b.time ? 1 : -1)[0];
      S.month = { y: +last.time.slice(0, 4), m: +last.time.slice(5, 7) - 1 };
    }
    S.monthSet = true;
  }
}

/* ---------- scope ---------- */
const accById = id => S.accounts.find(a => a.id === id);
function normalizeScope() {
  if (S.accounts.length === 1) { S.activeId = S.accounts[0].id; return; }
  if (S.activeId === 'demo' || S.activeId === 'real') { if (!S.accounts.some(a => accType(a) === S.activeId)) S.activeId = 'all'; return; }
  if (S.activeId !== 'all' && !accById(S.activeId)) S.activeId = 'all';
}
function scopeAccounts() {
  if (S.activeId === 'all') return S.accounts;
  if (S.activeId === 'demo' || S.activeId === 'real') return S.accounts.filter(a => accType(a) === S.activeId);
  return S.accounts.filter(a => a.id === S.activeId);
}
const dispCur = () => CURRENCIES.includes(S.display) ? S.display : (S.accounts[0] && CURRENCIES.includes(S.accounts[0].currency) ? S.accounts[0].currency : 'USD');
const rateOf = c => c === 'USD' ? 1 : (Number(S.rates[c]) > 0 ? Number(S.rates[c]) : null);
function fx(from) { const to = dispCur(); if (!from || from === to) return 1; const a = rateOf(from), b = rateOf(to); return a && b ? b / a : 1; }
function conv(t) { const a = accById(t.accountId), f = fx(a && a.currency); return f === 1 ? t : { ...t, pnl: Math.round(t.pnl * f * 100) / 100 }; }
function scopeTrades() { const ids = new Set(scopeAccounts().map(a => a.id)); return S.trades.filter(t => ids.has(t.accountId)).map(conv); }
const sumCap = accs => accs.reduce((s, a) => s + (Number(a.capital) || 0) * fx(a.currency), 0);
const scopeStart = () => sumCap(scopeAccounts());
const curOf = accs => { const c = [...new Set(accs.map(a => a.currency))]; return c.length === 1 ? c[0] : ''; };
const scopeCur = () => dispCur();
function scopeTitle() {
  if (S.activeId === 'all') return S.accounts.length === 1 ? S.accounts[0].name : 'All accounts';
  if (S.activeId === 'demo') return 'All demo accounts';
  if (S.activeId === 'real') return 'All real accounts';
  return (accById(S.activeId) || {}).name || '';
}

/* ---------- stats ---------- */
function computeStats(trades, start) {
  const ts = [...trades].sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  const sum = a => a.reduce((s, t) => s + t.pnl, 0);
  const wins = ts.filter(t => t.pnl > 0), losses = ts.filter(t => t.pnl < 0);
  const gp = sum(wins), gl = -sum(losses), net = gp - gl;
  let eq = start, peak = start, mdd = 0, mddPct = 0, ws = 0, ls = 0, mw = 0, ml = 0;
  const curve = [start], ddv = [0];
  ts.forEach(t => {
    eq += t.pnl; curve.push(eq);
    if (eq > peak) peak = eq;
    const dd = peak - eq; ddv.push(-dd);
    if (dd > mdd) { mdd = dd; mddPct = peak > 0 ? dd / peak * 100 : 0; }
    if (t.pnl > 0) { ws++; ls = 0; mw = Math.max(mw, ws); } else if (t.pnl < 0) { ls++; ws = 0; ml = Math.max(ml, ls); } else { ws = 0; ls = 0; }
  });
  const days = {};
  ts.forEach(t => { const k = t.time.slice(0, 10); const d = days[k] || (days[k] = { pnl: 0, n: 0 }); d.pnl += t.pnl; d.n++; });
  const dv = Object.entries(days);
  const group = fn => { const o = {}; ts.forEach(t => { const k = fn(t); const g = o[k] || (o[k] = { n: 0, w: 0, pnl: 0 }); g.n++; g.pnl += t.pnl; if (t.pnl > 0) g.w++; }); return o; };
  const n = ts.length;
  return {
    n, net, gp, gl, start, end: eq, curve, ts, ddv, ret: start > 0 ? net / start * 100 : null,
    winRate: n ? wins.length / n * 100 : 0, wins: wins.length, losses: losses.length,
    pf: gl === 0 ? (gp > 0 ? Infinity : 0) : gp / gl,
    avgWin: wins.length ? gp / wins.length : 0, avgLoss: losses.length ? gl / losses.length : 0,
    payoff: losses.length && wins.length ? (gp / wins.length) / (gl / losses.length) : null,
    expect: n ? net / n : 0,
    best: n ? Math.max(...ts.map(t => t.pnl)) : 0, worst: n ? Math.min(...ts.map(t => t.pnl)) : 0,
    mdd, mddPct, mw, ml,
    dayN: dv.length, dayWin: dv.filter(d => d[1].pnl > 0).length,
    bestDay: dv.length ? dv.reduce((a, b) => b[1].pnl > a[1].pnl ? b : a) : null,
    worstDay: dv.length ? dv.reduce((a, b) => b[1].pnl < a[1].pnl ? b : a) : null,
    perDay: dv.length ? net / dv.length : 0,
    bySide: group(t => t.side), bySym: group(t => t.symbol), byWd: group(t => weekdayIdx(t.time.slice(0, 10))), days
  };
}
function summarize(accs) {
  const ids = new Set(accs.map(a => a.id)), ts = S.trades.filter(t => ids.has(t.accountId)).map(conv);
  const gp = ts.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0), gl = -ts.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0);
  const start = sumCap(accs), net = gp - gl, wins = ts.filter(t => t.pnl > 0).length;
  return { n: ts.length, gp, gl, net, start, end: start + net, ret: start > 0 ? net / start * 100 : null, winRate: ts.length ? wins / ts.length * 100 : 0, cur: dispCur() };
}

/* ---------- charts ---------- */
const CH = {};
const PERIODS = [['all', 'All time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year']];
function periodStart(p) {
  const d = new Date(), k = x => dayKey(x.getFullYear(), x.getMonth(), x.getDate());
  if (p === 'today') return k(d);
  if (p === 'week') { const x = new Date(d); x.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return k(x); }
  if (p === 'month') return dayKey(d.getFullYear(), d.getMonth(), 1);
  if (p === '30') { const x = new Date(d); x.setDate(d.getDate() - 29); return k(x); }
  if (p === 'year') return dayKey(d.getFullYear(), 0, 1);
  return '0000-00-00';
}
function lineSVG(o, w) {
  const { vals, base, xl, h = 230, neg = false } = o, pl = 64, pr = 16, pt = 14, pb = 26, n = vals.length;
  let min = Math.min(...vals, base), max = Math.max(...vals, base);
  if (max === min) { const d = Math.abs(max) * 0.01 || 1; min -= d; max += d; }
  const rough = (max - min) / 4, mag = Math.pow(10, Math.floor(Math.log10(rough))), nm = rough / mag;
  const step = (nm < 1.5 ? 1 : nm < 3 ? 2 : nm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const X = i => n === 1 ? pl + (w - pl - pr) / 2 : pl + i / (n - 1) * (w - pl - pr);
  const Y = v => pt + (hi - v) / (hi - lo) * (h - pt - pb);
  let g = '';
  for (let v = lo; v <= hi + step / 2; v += step) {
    g += `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${pl - 8}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(step < 1 ? 2 : 0).replace('-', '−')}</text>`;
  }
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const areaTo = neg ? Y(base) : Y(lo);
  const area = `M${X(0)},${areaTo} L${pts.join(' L')} L${X(n - 1)},${areaTo} Z`;
  const k = Math.max(2, Math.min(n, Math.floor((w - pl - pr) / 78)));
  const idxs = [...new Set(Array.from({ length: k }, (_, j) => Math.round(j * (n - 1) / Math.max(1, k - 1))))];
  const xs = idxs.map((i, j) => `<text class="ax" x="${X(i)}" y="${h - 6}" text-anchor="${n === 1 ? 'middle' : j === 0 ? 'start' : j === idxs.length - 1 ? 'end' : 'middle'}">${esc(xl[i])}</text>`).join('');
  const svg = `<svg class="chart${neg ? ' neg' : ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(o.label || 'Line chart')}">
    ${g}<line class="base" x1="${pl}" x2="${w - pr}" y1="${Y(base)}" y2="${Y(base)}"/>
    <path class="ar" d="${area}"/><polyline class="ln" pathLength="1" points="${pts.join(' ')}"/>
    <circle class="dot" cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="4.5"/>
    <line class="hovl" y1="${pt}" y2="${h - pb}" style="display:none"/><circle class="hov" r="5" style="display:none"/>${xs}</svg>`;
  return { svg, geo: { pl, pr, w, h, n, xs: vals.map((_, i) => X(i)), ys: vals.map(Y) } };
}
function barsSVG(items, w, o = {}) {
  const h = o.h || 190, pl = 48, pr = 12, pt = 14, pb = 24, fmt = o.fmt || (v => short(v).replace('+', ''));
  const n = items.length, vs = items.map(i => i.v);
  const top = Math.max(...vs, 0), bot = Math.min(...vs, 0), rng = (top - bot) || 1;
  const Y = v => pt + (top - v) / rng * (h - pt - pb);
  const bw = (w - pl - pr) / n, gap = Math.min(4, bw * 0.2);
  const every = Math.ceil(n / Math.max(2, Math.floor((w - pl - pr) / 54)));
  let g = `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(top)}" y2="${Y(top)}"/><text class="ax" x="${pl - 6}" y="${Y(top) + 4}" text-anchor="end">${fmt(top)}</text>`;
  if (bot < 0) g += `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(bot)}" y2="${Y(bot)}"/><text class="ax" x="${pl - 6}" y="${Y(bot) + 4}" text-anchor="end">${fmt(bot)}</text>`;
  g += `<line class="base" x1="${pl}" x2="${w - pr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  if (top > 0) g += `<text class="ax" x="${pl - 6}" y="${Y(0) + 4}" text-anchor="end">0</text>`;
  const bars = items.map((it, i) => {
    const bwu = Math.min(bw - gap, 44), x = pl + i * bw + (bw - bwu) / 2, y0 = Y(Math.max(it.v, 0)), y1 = Y(Math.min(it.v, 0)), c = it.c || (it.v < 0 ? 'l' : 'g');
    return `<rect class="b${c}" x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${Math.max(1, bwu).toFixed(1)}" height="${Math.max(1, y1 - y0).toFixed(1)}" rx="1.5"><title>${esc(it.tip || '')}</title></rect>`;
  }).join('');
  const xl = items.map((it, i) => i % every === 0 ? `<text class="ax" x="${(pl + i * bw + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(it.label)}</text>` : '').join('');
  return { svg: `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(o.label || 'Bar chart')}">${g}<g class="bars">${bars}</g>${xl}</svg>` };
}
function bindHover(el, g, tips) {
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), dot = svg.querySelector('.hov'), ln = svg.querySelector('.hovl');
  const move = e => {
    const r = svg.getBoundingClientRect(), sc = r.width / g.w, x = (e.clientX - r.left) / sc;
    let i = g.n === 1 ? 0 : Math.round((x - g.pl) / (g.w - g.pl - g.pr) * (g.n - 1));
    i = Math.max(0, Math.min(g.n - 1, i));
    const cx = g.xs[i], cy = g.ys[i];
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.style.display = '';
    ln.setAttribute('x1', cx); ln.setAttribute('x2', cx); ln.style.display = '';
    tip.innerHTML = tips[i] || ''; tip.hidden = false;
    tip.style.left = Math.max(80, Math.min(r.width - 80, cx * sc)) + 'px'; tip.style.top = (cy * sc) + 'px';
  };
  const out = () => { dot.style.display = 'none'; ln.style.display = 'none'; tip.hidden = true; };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', out);
}
function drawCharts(anim, only) {
  Object.entries(CH).forEach(([id, c]) => {
    if (only && !only.includes(id)) return;
    const el = document.getElementById(id); if (!el) return;
    const w = Math.max(280, Math.round(el.clientWidth) || 600), r = c.draw(w);
    el.innerHTML = r.svg + (r.geo ? '<div class="tip" hidden></div>' : '');
    const svg = el.querySelector('svg'); if (anim) svg.classList.add('anim');
    if (r.geo && c.tips) bindHover(el, r.geo, c.tips);
    el.dataset.w = w;
  });
}

/* ---------- views ---------- */
function render(anim) {
  const app = $('#app');
  if (store.mode === 'sb' && !store.uid) { app.innerHTML = authHTML(); $('#overlay').hidden = true; return; }
  if (store.mode === 'sb' && S.needNick) { app.innerHTML = nickHTML(); $('#overlay').hidden = true; return; }
  if (!S.loaded) return;
  if (anim === undefined) anim = !S.shown;
  S.shown = true;
  normalizeScope();
  const y = window.scrollY;
  Object.keys(CH).forEach(k => { if (k !== 'dchart') delete CH[k]; });
  if (!S.accounts.length) { app.innerHTML = headerHTML() + onboardingHTML(); return; }
  const trades = scopeTrades(), start = scopeStart(), cur = scopeCur();
  const st = computeStats(trades, start);
  const tabs = [['overview', 'Overview'], ['calendar', 'Calendar'], ['stats', 'Statistics'], ['journal', 'Journal'], ['groups', 'Demo vs Real']];
  const body = S.view === 'overview' ? overviewHTML(st, cur) : S.view === 'calendar' ? calendarHTML(trades, cur) : S.view === 'journal' ? journalHTML(trades, cur) : S.view === 'stats' ? statsHTML(trades, cur, start) : S.view === 'accounts' ? accountsHTML() : groupsHTML();
  app.innerHTML = headerHTML() +
    `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="tab" data-tab="${k}" aria-selected="${S.view === k}">${l}</button>`).join('')}</div>` +
    (S.view === 'groups' || S.view === 'accounts' ? '' : capHTML(st, cur)) +
    `<div class="view stack${anim ? ' enter' : ''}">${body}</div>` +
    `<p class="foot">${store.mode === 'sb' ? 'Synced to your account (' + esc(store.nick || store.email) + '). Only you can see this data.' : store.mode === 'db' ? 'Data is saved privately to your Claude account and is visible only to you.' : 'Data is stored in this browser only. Make a backup in Accounts (Export). Cloud accounts are off: see README.md.'}${convNote()}</p>`;
  drawCharts(anim);
  if (!anim) window.scrollTo(0, y);
}
const dispSeg = () => { const d = dispCur(); return `<div class="seg" role="radiogroup" aria-label="Display currency">${CURRENCIES.map(c => `<button type="button" role="radio" aria-checked="${c === d}" class="${c === d ? 'on' : ''}" data-act="disp" data-val="${c}">${c}</button>`).join('')}</div>`; };
const convNote = () => { const d = dispCur(); return S.accounts.some(a => a.currency !== d) ? ` Amounts in other currencies are converted to ${d} with the rates in Accounts (1 USD = ${nf(S.rates.PLN, 4)} PLN, 1 USD = ${nf(S.rates.EUR, 4)} EUR).` : ''; };
const ICON = {
  chev: '<svg class="ico" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
  check: '<svg class="ico" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>',
  wallet: '<svg class="ico" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9.5" rx="2.2"/><path d="M2 6.8h12M10.6 9.9h1.2"/></svg>'
};
function scopeControl() {
  if (S.accounts.length === 1) return `<div class="dd-btn static"><i class="dd-dot ${accType(S.accounts[0])}"></i><span class="dd-label">${esc(S.accounts[0].name)}</span></div>`;
  const nd = S.accounts.filter(a => accType(a) === 'demo').length, nr = S.accounts.length - nd, cur = S.activeId, single = accById(cur);
  const curDot = cur === 'demo' ? 'demo' : cur === 'real' ? 'real' : single ? accType(single) : 'all';
  const lab = cur === 'demo' ? 'All demo accounts' : cur === 'real' ? 'All real accounts' : single ? single.name : 'All accounts';
  const item = (v, label, dot, sub) => `<button type="button" role="option" class="dd-item${cur === v ? ' sel' : ''}" aria-selected="${cur === v}" data-act="scope" data-val="${esc(v)}"><i class="dd-dot ${dot}"></i><span class="dd-name">${esc(label)}</span><span class="dd-sub">${sub}</span><span class="dd-check">${cur === v ? ICON.check : ''}</span></button>`;
  return `<div class="acc-dd"><button type="button" class="dd-btn" data-act="dd-toggle" aria-haspopup="listbox" aria-expanded="false" aria-label="Choose account"><i class="dd-dot ${curDot}"></i><span class="dd-label">${esc(lab)}</span>${ICON.chev}</button>
    <div class="dd-menu" role="listbox" hidden><div class="dd-group">Combined view</div>${item('all', 'All accounts', 'all', S.accounts.length)}${nd ? item('demo', 'All demo accounts', 'demo', nd) : ''}${nr ? item('real', 'All real accounts', 'real', nr) : ''}
    <div class="dd-group">Single account</div>${S.accounts.map(a => item(a.id, a.name, accType(a), accType(a) === 'real' ? 'Real' : 'Demo')).join('')}</div></div>`;
}
function headerHTML() {
  const single = S.accounts.length ? accById(S.activeId) : null;
  return `<div class="top"><div class="brand"><small>Trading journal</small><h1>${esc(scopeTitle())} ${single ? typeTag(single) : ''}</h1></div>
  <div class="controls">${S.accounts.length ? `${dispSeg()}<button class="btn icon${S.view === 'accounts' ? ' on' : ''}" data-act="accounts">${ICON.wallet}Accounts</button>${scopeControl()}<button class="btn primary" data-act="add-trade">+ Add trade</button>` : ''}${store.mode === 'sb' && store.uid ? `<span class="who" title="${esc(store.email)}"><i>${esc((store.nick || store.email || '?').slice(0, 1).toUpperCase())}</i><span>${esc(store.nick || store.email)}</span></span><button class="btn" data-act="logout">Sign out</button>` : ''}</div></div>`;
}
function capHTML(st, cur) {
  const accs = scopeAccounts();
  return `<div class="cap"><div><div class="k">Starting capital</div><div class="v">${money(st.start, cur)}</div><div class="s">${accs.length} ${accs.length === 1 ? 'account' : 'accounts'}</div></div>
  <div><div class="k">Current capital</div><div class="v big">${money(st.end, cur)}</div></div>
  <div><div class="k">Net P&amp;L</div><div class="v ${cls(st.net)}">${money(st.net, cur, true)}</div><div class="s ${cls(st.net)}">${st.ret == null ? '' : (st.ret > 0 ? '+' : st.ret < 0 ? '−' : '') + nf(Math.abs(st.ret)) + '%'}</div></div>
  <div><div class="k">Trades</div><div class="v">${st.n}</div><div class="s">${st.wins} wins / ${st.losses} losses</div></div></div>`;
}
function onboardingHTML() {
  return `<div class="panel empty"><h2>Start with your first account</h2><p>Give it a name, a type and a starting capital. Then paste an entry from your TradingView history and the journal reads the date, symbol, direction, prices, size and result for you.</p>
  <div class="accrow" style="width:100%;max-width:640px;text-align:left">
  <label class="f">Name<input id="ob-name" value="Account 1" maxlength="40"></label>
  <label class="f">Starting capital<input id="ob-cap" inputmode="decimal" value="10000"></label>
  <label class="f">Currency<select id="ob-cur">${CURRENCIES.map(c => `<option>${c}</option>`).join('')}</select></label>
  <label class="f">Type<select id="ob-type"><option value="demo">Demo</option><option value="real">Real</option></select></label>
  <button class="btn primary" data-act="ob-create">Create</button></div></div>`;
}
function emptyTradesHTML() {
  return `<div class="panel empty"><h2>No trades in this view yet</h2><p>Paste a closed position from your TradingView history or enter a trade by hand. Statistics, the calendar and the equity curve fill in right away.</p><button class="btn primary" data-act="add-trade">+ Add your first trade</button></div>`;
}
function dl(rows) { return `<dl class="dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`; }
function overviewHTML(stAll, cur) {
  if (!stAll.n) return emptyTradesHTML();
  const m = (v, s) => `<span class="${cls(v)}">${money(v, cur, s)}</span>`;
  const all = scopeTrades();
  const ps0 = periodStart(S.period), before = all.filter(t => t.time.slice(0, 10) < ps0).reduce((a, t) => a + t.pnl, 0), ts0 = all.filter(t => t.time.slice(0, 10) >= ps0);
  const sel = `<div class="filters" style="margin:0"><select class="inline" data-change="period" aria-label="Period">${PERIODS.map(([k, l]) => `<option value="${k}"${S.period === k ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="muted" style="align-self:center">${ts0.length} trade${ts0.length === 1 ? '' : 's'} in this period</span></div>`;
  const per = p => { const ps = periodStart(p), ts = all.filter(t => t.time.slice(0, 10) >= ps); return { n: ts.length, pnl: ts.reduce((s, t) => s + t.pnl, 0) }; };
  const tile = (label, p) => { const r = per(p); return `<div${r.n && r.pnl ? ` class="tint" style="--tc:var(${r.pnl > 0 ? '--gain' : '--loss'})"` : ''}><div class="k">${label}</div><div class="v ${cls(r.pnl)}">${r.n ? money(r.pnl, cur, true) : '–'}</div><div class="s">${r.n} trade${r.n === 1 ? '' : 's'}</div></div>`; };
  const tiles = `<div class="kpis solid">${tile('All time', 'all')}${tile('Today', 'today')}${tile('This week', 'week')}${tile('This month', 'month')}${tile('This year', 'year')}</div>`;
  if (!ts0.length) return tiles + sel + `<div class="panel empty"><h2>No trades in this period</h2><p>Choose a longer period to see the chart and statistics.</p></div>`;
  const st = computeStats(ts0, stAll.start + before), pf = st.pf === Infinity ? '∞' : nf(st.pf);
  CH.eq = {
    draw: w => lineSVG({ vals: st.curve, base: st.start, xl: st.curve.map((_, i) => i ? '#' + i : 'start'), label: 'Equity after each trade' }, w),
    tips: [`<b>Start</b><br>${money(st.start, cur)}`, ...st.ts.map((t, i) => `<b>#${i + 1} · ${fmtDate(t.time)}</b><br>${esc(t.symbol)} ${t.side} <span class="${cls(t.pnl)}">${money(t.pnl, cur, true)}</span><br>Equity ${money(st.curve[i + 1], cur)}`)]
  };
  const recent = [...ts0].sort((a, b) => a.time < b.time ? 1 : -1).slice(0, 6);
  return `${tiles}${sel}
  <div class="panel"><h2>Equity after each trade</h2><div id="eq" class="chartbox"></div></div>
  <div class="panel"><div class="cols">
    <div><h3>Performance</h3>${dl([['Win rate', nf(st.winRate, 1) + '%'], ['Profit factor', pf], ['Expectancy per trade', m(st.expect, true)], ['Average win', m(st.avgWin, true)], ['Average loss', m(-st.avgLoss, true)], ['Payoff ratio (win / loss)', st.payoff == null ? '–' : nf(st.payoff)]])}</div>
    <div><h3>Range</h3>${dl([['Gross profit', m(st.gp, true)], ['Gross loss', m(-st.gl, true)], ['Best trade', m(st.best, true)], ['Worst trade', m(st.worst, true)], ['Best day', st.bestDay ? `${m(st.bestDay[1].pnl, true)} <span class="muted">${fmtDay(st.bestDay[0])}</span>` : '–'], ['Worst day', st.worstDay ? `${m(st.worstDay[1].pnl, true)} <span class="muted">${fmtDay(st.worstDay[0])}</span>` : '–']])}</div>
    <div><h3>Risk and streaks</h3>${dl([['Max drawdown', `<span class="loss">${money(-st.mdd, cur)}</span> <span class="muted">(${nf(st.mddPct, 1)}%)</span>`], ['Longest win streak', st.mw], ['Longest loss streak', st.ml], ['Trading days', st.dayN], ['Winning days', `${st.dayWin} (${nf(st.dayN ? st.dayWin / st.dayN * 100 : 0, 0)}%)`], ['Average per day', m(st.perDay, true)]])}</div>
  </div></div>
  <div class="panel"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">Recent trades</h2><button class="btn sm" data-act="tab" data-tab="journal">View all</button></div>${tradeTable(recent, cur, true)}</div>`;
}
function groupPanel(type) {
  const label = type === 'real' ? 'Real accounts' : 'Demo accounts';
  const accs = S.accounts.filter(a => accType(a) === type);
  if (!accs.length) return `<div class="panel empty"><h2>${label}</h2><p>No ${type} accounts yet. Add one in Accounts and choose the type ${type === 'real' ? 'Real' : 'Demo'}.</p><button class="btn" data-act="accounts">Manage accounts</button></div>`;
  const sm = summarize(accs), cur = sm.cur;
  const rows = accs.map(a => { const s = summarize([a]); return `<tr><td>${esc(a.name)}</td><td class="r">${money(s.start, cur)}</td><td class="r">${money(s.end, cur)}</td>
    <td class="r gain">${money(s.gp, cur, true)}</td><td class="r loss">${money(-s.gl, cur, true)}</td><td class="r ${cls(s.net)}">${money(s.net, cur, true)}</td><td class="r">${s.n}</td>
    <td><button class="btn sm" data-act="pick-account" data-id="${a.id}">Open</button></td></tr>`; }).join('');
  return `<div class="panel"><div class="grp"><h2><span class="tag ${type}">${type === 'real' ? 'Real' : 'Demo'}</span> ${label} <span class="muted" style="font-family:var(--body);font-weight:400;font-size:14px">${accs.length}</span></h2>
  <button class="btn sm" data-act="pick-group" data-id="${type}">Open all ${type}</button></div>
  <div class="kpis"><div><div class="k">Net P&amp;L</div><div class="v ${cls(sm.net)}">${money(sm.net, cur, true)}</div></div>
  <div><div class="k">Total profit</div><div class="v gain">${money(sm.gp, cur, true)}</div></div>
  <div><div class="k">Total loss</div><div class="v loss">${money(-sm.gl, cur, true)}</div></div>
  <div><div class="k">Return</div><div class="v ${cls(sm.net)}">${sm.ret == null ? '–' : (sm.ret > 0 ? '+' : sm.ret < 0 ? '−' : '') + nf(Math.abs(sm.ret)) + '%'}</div></div>
  <div><div class="k">Win rate</div><div class="v">${nf(sm.winRate, 1)}%</div></div>
  <div><div class="k">Capital now</div><div class="v">${money(sm.end, cur)}</div></div></div>
  <div class="scroll"><table><thead><tr><th>Account</th><th class="r">Start</th><th class="r">Current</th><th class="r">Profit</th><th class="r">Loss</th><th class="r">Net</th><th class="r">Trades</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  ${cur === '' ? '<p class="hint" style="margin:10px 0 0">These accounts use different currencies, so group totals add the raw numbers.</p>' : ''}</div>`;
}
function groupsHTML() { return groupPanel('demo') + groupPanel('real'); }
function calendarHTML(trades, cur) {
  const { y, m } = S.month;
  const first = new Date(y, m, 1), off = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const days = {};
  trades.forEach(t => { if (t.time.startsWith(`${y}-${pad(m + 1)}`)) { const k = t.time.slice(0, 10); const d = days[k] || (days[k] = { pnl: 0, n: 0 }); d.pnl += t.pnl; d.n++; } });
  const dv = Object.values(days);
  const maxAbs = Math.max(1, ...dv.map(d => Math.abs(d.pnl)));
  const mp = dv.reduce((s, d) => s + d.pnl, 0), mn = dv.reduce((s, d) => s + d.n, 0), mw = dv.filter(d => d.pnl > 0).length, ml = dv.filter(d => d.pnl < 0).length;
  const t0 = new Date(); const today = dayKey(t0.getFullYear(), t0.getMonth(), t0.getDate());
  const weeks = Math.ceil((off + dim) / 7);
  let cells = WD.map(d => `<div class="wh">${d}</div>`).join('');
  for (let w = 0; w < weeks; w++) {
    let wp = 0, wn = 0;
    for (let c = 0; c < 7; c++) {
      const d = w * 7 + c - off + 1;
      if (d < 1 || d > dim) { cells += '<div class="blank"></div>'; continue; }
      const k = dayKey(y, m, d), g = days[k];
      if (g) { wp += g.pnl; wn += g.n; }
      const bg = g && g.pnl !== 0 ? ` style="--tc:var(${g.pnl > 0 ? '--gain' : '--loss'});--ti:${(0.16 + 0.34 * Math.abs(g.pnl) / maxAbs).toFixed(2)}"` : '';
      cells += `<button class="day${S.day === k ? ' sel' : ''}${k === today ? ' today' : ''}${g ? ' has' : ''}" data-act="day" data-day="${k}"${bg} aria-label="${fmtDay(k)}${g ? ', P&L ' + money(g.pnl, cur, true) + ', ' + g.n + ' trades' : ''}"><span class="d">${d}</span>${g ? `<span class="p ${cls(g.pnl)}">${short(g.pnl)}</span><span class="n">${g.n} ${g.n === 1 ? 'trade' : 'trades'}</span>` : '<span></span>'}</button>`;
    }
  }
  return `<div class="panel"><div class="calhead"><div class="row"><button class="btn sm" data-act="prev-month" aria-label="Previous month">‹</button><h2>${MONTHS[m]} ${y}</h2><button class="btn sm" data-act="next-month" aria-label="Next month">›</button><button class="btn sm ghost" data-act="this-month">Today</button></div>
  <div class="calsum"><span>P&amp;L <b class="${cls(mp)}">${money(mp, cur, true)}</b></span><span>Trades <b>${mn}</b></span><span>Green days <b>${mw}</b></span><span>Red days <b>${ml}</b></span></div></div>
  <div class="calwrap"><div class="cal">${cells}</div></div><p class="hint" style="margin:10px 0 0">Click a day to see its trades, chart and statistics.</p></div>`;
}
function tradeTable(ts, cur, showAcc, timeOnly) {
  const multi = S.accounts.length > 1;
  return `<div class="scroll"><table><thead><tr><th>${timeOnly ? 'Time' : 'Date'}</th>${multi && showAcc ? '<th>Account</th>' : ''}<th>Symbol</th><th>Side</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">Size</th><th class="r">P&amp;L</th><th>Note</th><th></th></tr></thead><tbody>
  ${ts.map(t => { const a = accById(t.accountId), c = cur || (a ? a.currency : '');
    return `<tr><td class="m">${timeOnly ? t.time.slice(11, 16) : fmtDate(t.time)}</td>${multi && showAcc ? `<td>${esc(a ? a.name : '?')} ${a ? typeTag(a) : ''}</td>` : ''}<td class="m">${symTag(t.symbol)}</td><td><span class="tag ${t.side === 'long' ? 'long' : 'short'}">${t.side === 'long' ? 'Long' : 'Short'}</span></td>
    <td class="r">${t.entry == null ? '–' : nf(t.entry, 2)}</td><td class="r">${t.exit == null ? '–' : nf(t.exit, 2)}</td><td class="r">${t.qty == null ? '–' : nf(t.qty, 4)}</td><td class="r ${cls(t.pnl)}">${money(t.pnl, c, true)}</td>
    <td class="note">${esc(t.note || '')}</td><td style="white-space:nowrap"><button class="btn sm" data-act="edit-trade" data-id="${t.id}">Edit</button>
    <button class="btn sm danger" data-act="del-trade" data-id="${t.id}">${S.confirm === t.id ? 'Really delete?' : 'Delete'}</button></td></tr>`; }).join('')}</tbody></table></div>`;
}
function journalHTML(trades, cur) {
  if (!trades.length) return emptyTradesHTML();
  const f = S.f, syms = [...new Set(trades.map(t => t.symbol))].sort();
  let ts = trades.filter(t => (!f.sym || t.symbol === f.sym) && (f.side.length !== 1 || f.side[0] === t.side) && (f.res.length !== 1 || f.res[0] === (t.pnl > 0 ? 'w' : t.pnl < 0 ? 'l' : 'b')));
  ts = [...ts].sort((a, b) => a.time < b.time ? 1 : -1);
  const tot = ts.reduce((s, t) => s + t.pnl, 0);
  return `<div class="panel"><div class="filters"><select class="inline" data-change="f-sym" aria-label="Symbol"><option value="">All symbols</option>${syms.map(s => `<option${f.sym === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
  <div class="chips" role="group" aria-label="Direction"><button type="button" class="chip c-long${f.side.includes('long') ? ' on' : ''}" data-act="f-toggle" data-k="side" data-v="long" aria-pressed="${f.side.includes('long')}">Long</button><button type="button" class="chip c-short${f.side.includes('short') ? ' on' : ''}" data-act="f-toggle" data-k="side" data-v="short" aria-pressed="${f.side.includes('short')}">Short</button></div>
  <div class="chips" role="group" aria-label="Result"><button type="button" class="chip c-win${f.res.includes('w') ? ' on' : ''}" data-act="f-toggle" data-k="res" data-v="w" aria-pressed="${f.res.includes('w')}">Wins</button><button type="button" class="chip c-loss${f.res.includes('l') ? ' on' : ''}" data-act="f-toggle" data-k="res" data-v="l" aria-pressed="${f.res.includes('l')}">Losses</button></div>
  <span class="muted" style="align-self:center">${ts.length} of ${trades.length} · total <b class="${cls(tot)}" style="font-family:var(--mono);font-weight:500">${money(tot, cur, true)}</b></span></div>
  ${ts.length ? tradeTable(ts, cur, true) : '<p class="muted">No trade matches the filters.</p>'}</div>`;
}

/* ---------- modals ---------- */
function openOverlay(html) {
  const o = $('#overlay'), was = o.hidden;
  o.innerHTML = html; o.hidden = false; document.body.style.overflow = 'hidden';
  if (was) { o.classList.remove('enter'); void o.offsetWidth; o.classList.add('enter'); o.scrollTop = 0; }
}
function closeOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; o.classList.remove('enter'); M = null; delete CH.dchart; document.body.style.overflow = ''; }

/* ---------- grouping helpers ---------- */
function groupBy(ts, fn) {
  const o = {};
  ts.forEach(t => {
    const k = fn(t), g = o[k] || (o[k] = { n: 0, w: 0, net: 0, gp: 0, gl: 0, best: -Infinity, worst: Infinity });
    g.n++; g.net += t.pnl; if (t.pnl > 0) { g.w++; g.gp += t.pnl; } else if (t.pnl < 0) g.gl -= t.pnl;
    g.best = Math.max(g.best, t.pnl); g.worst = Math.min(g.worst, t.pnl);
  });
  return o;
}
const pfOf = g => g.gl === 0 ? (g.gp > 0 ? '∞' : '–') : nf(g.gp / g.gl);
function groupTable(o, cur, label, order, lab) {
  const rows = Object.entries(o).sort(order || ((a, b) => b[1].net - a[1].net));
  return `<div class="scroll"><table><thead><tr><th>${label}</th><th class="r">Trades</th><th class="r">Win rate</th><th class="r">Net</th><th class="r">Avg</th><th class="r">Best</th><th class="r">Worst</th><th class="r">PF</th></tr></thead><tbody>
  ${rows.map(([k, g]) => `<tr><td class="m">${esc(lab ? lab(k) : k)}</td><td class="r">${g.n}</td><td class="r">${nf(g.w / g.n * 100, 0)}%</td><td class="r ${cls(g.net)}">${money(g.net, cur, true)}</td><td class="r ${cls(g.net)}">${money(g.net / g.n, cur, true)}</td><td class="r ${cls(g.best)}">${money(g.best, cur, true)}</td><td class="r ${cls(g.worst)}">${money(g.worst, cur, true)}</td><td class="r">${pfOf(g)}</td></tr>`).join('')}</tbody></table></div>`;
}
function hbars(entries) {
  const mx = Math.max(1, ...entries.map(e => Math.abs(e[1] || 0)));
  return entries.map(([l, v]) => v == null ? `<div class="wd"><span class="muted">${l}</span><div class="trk"></div><b class="muted">–</b></div>`
    : `<div class="wd"><span>${l}</span><div class="trk"><i class="bar ${v < 0 ? 'l' : ''}" style="${v < 0 ? 'right' : 'left'}:50%;width:${(Math.abs(v) / mx * 50).toFixed(1)}%"></i></div><b class="${cls(v)}">${short(v)}</b></div>`).join('');
}
function histItems(ts, cur) {
  const v = ts.map(t => t.pnl), mn = Math.min(...v), mx = Math.max(...v);
  if (mn === mx) return [{ label: short(mn).replace('+', ''), v: v.length, c: mn >= 0 ? 'g' : 'l', tip: `${v.length} trades at ${money(mn, cur)}` }];
  const nb = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(v.length)))), bw = (mx - mn) / nb;
  const bins = Array.from({ length: nb }, (_, i) => ({ lo: mn + i * bw, hi: mn + (i + 1) * bw, v: 0 }));
  v.forEach(x => { bins[Math.min(nb - 1, Math.floor((x - mn) / bw))].v++; });
  return bins.map(b => ({ label: short((b.lo + b.hi) / 2).replace('+', ''), v: b.v, c: (b.lo + b.hi) / 2 >= 0 ? 'g' : 'l', tip: `${money(b.lo, cur)} to ${money(b.hi, cur)}: ${b.v} trade${b.v === 1 ? '' : 's'}` }));
}

/* ---------- statistics tab ---------- */

function donutHTML(segs, big, sub) {
  const tot = segs.reduce((a, x) => a + x.v, 0) || 1, R = 56, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = segs.filter(x => x.v > 0).map(x => {
    const len = x.v / tot * C, gap = segs.filter(y => y.v > 0).length > 1 ? 3 : 0;
    const a = `<circle class="seg" cx="80" cy="80" r="${R}" stroke="${x.color}" stroke-dasharray="${Math.max(0, len - gap).toFixed(2)} ${(C - Math.max(0, len - gap)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 80 80)"><title>${esc(x.label)}: ${x.v} (${nf(x.v / tot * 100, 0)}%)</title></circle>`;
    off += len; return a;
  }).join('');
  return `<div class="donut"><svg viewBox="0 0 160 160" role="img" aria-label="${esc(sub)}"><circle class="seg" cx="80" cy="80" r="${R}" stroke="var(--line)" opacity=".5"/>${arcs}<text class="dbig" x="80" y="82" text-anchor="middle">${esc(big)}</text><text class="dsub" x="80" y="100" text-anchor="middle">${esc(sub)}</text></svg>
  <ul class="lg">${segs.map(x => `<li><i style="background:${x.color}"></i><span>${esc(x.label)}</span><b>${x.v} <span class="muted">· ${nf(x.v / tot * 100, 0)}%</span></b></li>`).join('')}</ul></div>`;
}
function scatterSVG(ts, w, cur) {
  const h = 220, pl = 52, pr = 14, pt = 14, pb = 26, n = ts.length, vs = ts.map(t => t.pnl);
  const top = Math.max(...vs, 0), bot = Math.min(...vs, 0), rng = (top - bot) || 1, mx = Math.max(...vs.map(Math.abs), 1);
  const Y = v => pt + (top - v) / rng * (h - pt - pb), X = i => n === 1 ? pl + (w - pl - pr) / 2 : pl + i / (n - 1) * (w - pl - pr);
  let g = `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(top)}" y2="${Y(top)}"/><text class="ax" x="${pl - 6}" y="${Y(top) + 4}" text-anchor="end">${short(top).replace('+', '')}</text>`;
  if (bot < 0) g += `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(bot)}" y2="${Y(bot)}"/><text class="ax" x="${pl - 6}" y="${Y(bot) + 4}" text-anchor="end">${short(bot)}</text>`;
  g += `<line class="base" x1="${pl}" x2="${w - pr}" y1="${Y(0)}" y2="${Y(0)}"/><text class="ax" x="${pl - 6}" y="${Y(0) + 4}" text-anchor="end">0</text>`;
  const dots = ts.map((t, i) => `<circle class="${t.pnl < 0 ? 'sl' : 'sg'}" cx="${X(i).toFixed(1)}" cy="${Y(t.pnl).toFixed(1)}" r="${(3.5 + 6 * Math.abs(t.pnl) / mx).toFixed(1)}"><title>${esc(fmtDate(t.time))} · ${esc(t.symbol)} ${t.side} · ${money(t.pnl, cur, true)}</title></circle>`).join('');
  const xl = `<text class="ax" x="${pl}" y="${h - 6}" text-anchor="start">${esc(fmtDate(ts[0].time))}</text><text class="ax" x="${w - pr}" y="${h - 6}" text-anchor="end">${esc(fmtDate(ts[n - 1].time))}</text>`;
  return { svg: `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Every trade, result over time">${g}<g class="dots">${dots}</g>${xl}</svg>` };
}
function heatHTML(ts, cur) {
  const grp = groupBy(ts, t => weekdayIdx(t.time.slice(0, 10)) + '|' + t.time.slice(11, 13));
  const hrs = ts.map(t => +t.time.slice(11, 13)), lo = Math.min(...hrs), hi = Math.max(lo + 3, Math.max(...hrs));
  const cols = hi - lo + 1, mx = Math.max(1, ...Object.values(grp).map(g => Math.abs(g.net)));
  let h = `<div class="heat" style="--cols:${cols}"><span></span>` + Array.from({ length: cols }, (_, i) => `<span class="hh">${String(lo + i).padStart(2, '0')}</span>`).join('');
  WD.forEach((d, wi) => {
    h += `<span class="hh hl">${d}</span>`;
    for (let c = 0; c < cols; c++) {
      const g = grp[wi + '|' + String(lo + c).padStart(2, '0')];
      if (!g) { h += '<span class="hc"></span>'; continue; }
      const tc = g.net >= 0 ? '--gain' : '--loss', a = 16 + 64 * Math.abs(g.net) / mx;
      h += `<span class="hc on" style="background:color-mix(in srgb, var(${tc}) ${a.toFixed(0)}%, transparent)" title="${d} ${String(lo + c).padStart(2, '0')}:00 · ${money(g.net, cur, true)} · ${g.n} trade${g.n === 1 ? '' : 's'}">${short(g.net)}</span>`;
    }
  });
  return h + '</div>';
}
function splitRow(label, a, b, cur) {
  const t = a + b; if (!t) return '';
  return `<div class="pr"><div class="pl"><span>${label}</span><span><b class="gain">${money(a, cur)}</b> <span class="muted">vs</span> <b class="loss">${money(-b, cur)}</b></span></div><div class="split"><i class="g" style="width:${(a / t * 100).toFixed(1)}%"></i><i class="l" style="width:${(b / t * 100).toFixed(1)}%"></i></div></div>`;
}
function statsHTML(all, cur, start0) {
  const ps = periodStart(S.period);
  const before = all.filter(t => t.time.slice(0, 10) < ps).reduce((s, t) => s + t.pnl, 0);
  const ts0 = all.filter(t => t.time.slice(0, 10) >= ps);
  const sel = `<div class="filters" style="margin:0"><select class="inline" data-change="period" aria-label="Period">${PERIODS.map(([k, l]) => `<option value="${k}"${S.period === k ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="muted" style="align-self:center">${ts0.length} trade${ts0.length === 1 ? '' : 's'} in this period</span></div>`;
  if (!ts0.length) return sel + `<div class="panel empty"><h2>No trades in this period</h2><p>Choose a longer period, or add trades to see the statistics.</p></div>`;
  const st = computeStats(ts0, start0 + before);
  const m = (v, s) => `<span class="${cls(v)}">${money(v, cur, s)}</span>`;
  const pf = st.pf === Infinity ? '∞' : nf(st.pf);
  const dayItems = Object.entries(st.days).sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-60).map(([k, d]) => ({ label: `${+k.slice(8)} ${MON_S[+k.slice(5, 7) - 1]}`, v: d.pnl, tip: `${fmtDay(k)} · ${money(d.pnl, cur, true)} · ${d.n} trade${d.n === 1 ? '' : 's'}` }));
  CH.dbars = { draw: w => barsSVG(dayItems, w, { label: 'Daily P&L' }) };
  CH.ddc = {
    draw: w => lineSVG({ vals: st.ddv, base: 0, neg: true, xl: st.ddv.map((_, i) => i ? '#' + i : 'start'), label: 'Drawdown after each trade' }, w),
    tips: st.ddv.map((v, i) => i ? `<b>#${i} · ${fmtDate(st.ts[i - 1].time)}</b><br>Drawdown <span class="loss">${money(v, cur)}</span>` : '<b>Start</b>')
  };
  CH.hist = { draw: w => barsSVG(histItems(st.ts, cur), w, { fmt: v => String(Math.round(v)), label: 'Distribution of trade results' }) };
  CH.scat = { draw: w => scatterSVG(st.ts, w, cur) };
  const W = Math.min(10, st.ts.length), rollV = [], rollT = [];
  st.ts.forEach((t, i) => { const win = st.ts.slice(Math.max(0, i - W + 1), i + 1), r = win.filter(x => x.pnl > 0).length / win.length * 100; rollV.push(r); rollT.push(`<b>#${i + 1} · ${fmtDate(t.time)}</b><br>Win rate (last ${win.length}) <b>${nf(r, 0)}%</b>`); });
  CH.roll = { draw: w => lineSVG({ vals: rollV, base: 50, xl: rollV.map((_, i) => '#' + (i + 1)), label: 'Rolling win rate' }, w), tips: rollT };
  const side = groupBy(st.ts, t => t.side), sym = groupBy(st.ts, t => t.symbol), mon = groupBy(st.ts, t => t.time.slice(0, 7));
  const wd = groupBy(st.ts, t => weekdayIdx(t.time.slice(0, 10))), hr = groupBy(st.ts, t => t.time.slice(11, 13));
  const avgPerDay = st.dayN ? st.n / st.dayN : 0;
  const be = st.n - st.wins - st.losses;
  const outcome = donutHTML([{ label: 'Wins', v: st.wins, color: 'var(--gain)' }, { label: 'Losses', v: st.losses, color: 'var(--loss)' }, ...(be ? [{ label: 'Break-even', v: be, color: 'var(--muted)' }] : [])], nf(st.winRate, 0) + '%', 'win rate');
  const palette = ['var(--sky)', 'var(--violet)', 'var(--pink)', '#818cf8', '#fbbf24', '#8a8f9c'];
  const symTop = Object.entries(sym).sort((a, b) => b[1].n - a[1].n);
  const symSegs = symTop.slice(0, 5).map(([k, g], i) => ({ label: k, v: g.n, color: palette[i] })); const rest = symTop.slice(5).reduce((a, [, g]) => a + g.n, 0); if (rest) symSegs.push({ label: 'Other', v: rest, color: palette[5] });
  const lsDon = donutHTML([{ label: 'Long', v: (side.long || { n: 0 }).n, color: 'var(--gain)' }, { label: 'Short', v: (side.short || { n: 0 }).n, color: 'var(--loss)' }], String(st.n), 'trades');
  const symDon = donutHTML(symSegs, String(symTop.length), symTop.length === 1 ? 'symbol' : 'symbols');
  const stabs = [['perf', 'Performance'], ['risk', 'Risk'], ['when', 'When'], ['brk', 'Breakdown'], ['sum', 'Summary']];
  const stab = stabs.some(x => x[0] === S.stab) ? S.stab : 'perf';
  const parts = {
    perf: `  <div class="panel"><h2>Daily P&amp;L</h2><div id="dbars" class="chartbox"></div></div>
  <div class="cols2"><div class="panel"><h2>Wins vs losses</h2>${outcome}</div>
  <div class="panel"><h2>Every trade</h2><div id="scat" class="chartbox"></div></div></div>`,
    risk: `  <div class="cols2"><div class="panel"><h2>Drawdown</h2><div id="ddc" class="chartbox"></div></div>
  <div class="panel"><h2>Distribution of trade results</h2><div id="hist" class="chartbox"></div></div></div>
  <div class="cols2"><div class="panel"><h2>Rolling win rate <span class="muted" style="font-weight:400;font-size:13px">(last ${W} trades)</span></h2><div id="roll" class="chartbox"></div></div>
  <div class="panel"><h2>Profit vs loss</h2><div class="pay">${splitRow('Gross profit vs gross loss', st.gp, st.gl, cur)}${splitRow('Average win vs average loss', st.avgWin, st.avgLoss, cur)}${splitRow('Best vs worst trade', Math.max(0, st.best), Math.abs(Math.min(0, st.worst)), cur)}</div></div></div>`,
    when: `  <div class="panel"><h2>When you make and lose money</h2><p class="hint" style="margin:-6px 0 12px">Net result by weekday and hour of day (close time). Blue = profit, orange = loss.</p>${heatHTML(st.ts, cur)}</div>
  <div class="panel"><h2>By weekday</h2>${hbars(WD.map((d, i) => [d, wd[i] ? wd[i].net : null]))}</div>`,
    brk: `  <div class="cols2"><div class="panel"><h2>Long vs short</h2>${lsDon}</div><div class="panel"><h2>Trades by symbol</h2>${symDon}</div></div>
  <div class="panel"><h2>By symbol</h2>${groupTable(sym, cur, 'Symbol')}</div>
  <div class="panel"><h2>Long vs short in detail</h2>${groupTable(side, cur, 'Side', null, k => k === 'long' ? 'Long' : 'Short')}</div>
  <div class="panel"><h2>By month</h2>${groupTable(mon, cur, 'Month', (a, b) => a[0] < b[0] ? 1 : -1, k => `${MON_S[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`)}</div>`,
    sum: `  <div class="panel"><div class="cols">
    <div><h3>Trades</h3>${dl([['Total trades', st.n], ['Wins / losses', `${st.wins} / ${st.losses}`], ['Average win', m(st.avgWin, true)], ['Average loss', m(-st.avgLoss, true)], ['Largest win', m(st.best, true)], ['Largest loss', m(st.worst, true)]])}</div>
    <div><h3>Days</h3>${dl([['Trading days', st.dayN], ['Winning days', `${st.dayWin} (${nf(st.dayN ? st.dayWin / st.dayN * 100 : 0, 0)}%)`], ['Trades per day', nf(avgPerDay, 1)], ['Average per day', m(st.perDay, true)], ['Best day', st.bestDay ? `${m(st.bestDay[1].pnl, true)} <span class="muted">${fmtDay(st.bestDay[0])}</span>` : '–'], ['Worst day', st.worstDay ? `${m(st.worstDay[1].pnl, true)} <span class="muted">${fmtDay(st.worstDay[0])}</span>` : '–']])}</div>
    <div><h3>Streaks and risk</h3>${dl([['Longest win streak', st.mw], ['Longest loss streak', st.ml], ['Max drawdown', `<span class="loss">${money(-st.mdd, cur)}</span>`], ['Max drawdown %', `<span class="loss">${nf(st.mddPct, 1)}%</span>`], ['Gross profit', m(st.gp, true)], ['Gross loss', m(-st.gl, true)]])}</div>
  </div></div>`
  };
  return `${sel}
  <div class="kpis solid"><div><div class="k">Net P&amp;L</div><div class="v ${cls(st.net)}">${money(st.net, cur, true)}</div></div>
  <div><div class="k">Win rate</div><div class="v">${nf(st.winRate, 1)}%</div></div>
  <div><div class="k">Profit factor</div><div class="v">${pf}</div></div>
  <div><div class="k">Expectancy</div><div class="v ${cls(st.expect)}">${money(st.expect, cur, true)}</div></div>
  <div><div class="k">Avg win / loss</div><div class="v">${st.payoff == null ? '–' : nf(st.payoff)}</div></div>
  <div><div class="k">Max drawdown</div><div class="v loss">${money(-st.mdd, cur)}</div></div></div>
  <div class="subtabs" role="tablist">${stabs.map(([k, l]) => `<button role="tab" data-act="stab" data-val="${k}" aria-selected="${stab === k}">${l}</button>`).join('')}</div>
  <div class="stack stabview">${parts[stab]}</div>`;
}

/* ---------- day details ---------- */
function openDay(k) { S.day = k; M = { kind: 'day', day: k }; renderDay(); }
function renderDay() {
  const k = M.day, cur = scopeCur(), all = scopeTrades();
  const ts = all.filter(t => t.time.startsWith(k)).sort((a, b) => a.time < b.time ? -1 : 1);
  const days = [...new Set(all.map(t => t.time.slice(0, 10)))].sort();
  const prev = days.filter(d => d < k).pop(), next = days.find(d => d > k);
  const [yy, mo, dd] = k.split('-').map(Number);
  const title = new Date(yy, mo - 1, dd).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let body;
  delete CH.dchart;
  if (!ts.length) body = `<div class="empty"><p>No trades on this day.</p><button class="btn primary" data-act="add-trade" data-date="${k}">+ Add trade</button></div>`;
  else {
    const st = computeStats(ts, 0), sy = groupBy(ts, t => t.symbol);
    const bestSym = Object.entries(sy).sort((a, b) => b[1].net - a[1].net)[0];
    const kc = (l, v, c) => `<div class="kc"><div class="k">${l}</div><div class="v ${c || ''}">${v}</div></div>`;
    let run = 0;
    const cum = st.ts.map(t => run += t.pnl);
    CH.dchart = {
      draw: w => lineSVG({ vals: [0, ...cum], base: 0, xl: ['Start', ...st.ts.map(t => t.time.slice(11, 16))], label: 'Cumulative result during the day', h: 210 }, w),
      tips: ['<b>Start of day</b>', ...st.ts.map((t, i) => `<b>${t.time.slice(11, 16)} · ${esc(t.symbol)} ${t.side}</b><br>Trade <span class="${cls(t.pnl)}">${money(t.pnl, cur, true)}</span><br>Day total <span class="${cls(cum[i])}">${money(cum[i], cur, true)}</span>`)]
    };
    body = `<div class="kcards">${kc('Day P&amp;L', money(st.net, cur, true), cls(st.net))}${kc('Trades', st.n)}${kc('Win rate', nf(st.winRate, 0) + '%')}${kc('Wins / losses', `${st.wins} / ${st.losses}`)}
      ${kc('Profit factor', st.pf === Infinity ? '∞' : nf(st.pf))}${kc('Best trade', money(st.best, cur, true), cls(st.best))}${kc('Worst trade', money(st.worst, cur, true), cls(st.worst))}${kc('Best symbol', `${esc(bestSym[0])} <span class="${cls(bestSym[1].net)}">${money(bestSym[1].net, cur, true)}</span>`)}</div>
      <section><h3>Day progress (cumulative)</h3><div id="dchart" class="chartbox"></div></section>
      <section><h3>By symbol</h3>${groupTable(sy, cur, 'Symbol')}</section>
      <section><div class="row between" style="margin-bottom:6px"><h3 style="margin:0">Trades of the day</h3><button class="btn sm" data-act="add-trade" data-date="${k}">+ Add trade</button></div>${tradeTable(ts, cur, true, true)}</section>`;
  }
  openOverlay(`<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="md"><header class="dayhead"><div><h2 id="md">${title}</h2><span class="hint">Day details</span></div>
    <div class="row"><button class="btn sm" data-act="day-nav" data-day="${prev || ''}"${prev ? '' : ' disabled'}>← Previous</button><button class="btn sm" data-act="day-nav" data-day="${next || ''}"${next ? '' : ' disabled'}>Next →</button><button class="btn sm" data-act="close" aria-label="Close">✕</button></div></header>${body}</div>`);
  if (ts.length) drawCharts(true, ['dchart']);
}
const refresh = () => { render(); if (M && M.kind === 'day') renderDay(); };
function closeModal() {
  const wasDay = M && M.kind === 'day', back = M && M.kind === 'trade' ? M.back : null;
  closeOverlay();
  if (back) openDay(back); else if (wasDay) render();
}

function openTradeModal(editId, date) {
  const t = editId ? S.trades.find(x => x.id === editId) : null;
  const sc = scopeAccounts();
  const defAcc = t ? t.accountId : (S.activeId !== 'all' && sc.length === 1 ? sc[0].id : (sc[0] || S.accounts[0] || {}).id);
  const back = M && M.kind === 'day' ? M.day : null;
  M = { kind: 'trade', editId, staged: [], touched: !!t, back };
  const v = t || { time: date ? date + 'T12:00:00' : nowLocal(), symbol: '', side: 'long', qty: '', entry: '', exit: '', pnl: '', note: '' };
  const val = x => x == null ? '' : x;
  openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><header><h2 id="mt">${t ? 'Edit trade' : 'Add trade'}</h2><button class="btn sm" data-act="close">Close</button></header>
  <label class="f">Account<select id="f-acc">${S.accounts.map(a => `<option value="${a.id}"${a.id === defAcc ? ' selected' : ''}>${esc(a.name)} · ${accType(a) === 'real' ? 'Real' : 'Demo'} · ${esc(a.currency)}</option>`).join('')}</select></label>
  ${t ? '' : `<label class="f">Paste from TradingView<textarea id="f-paste" placeholder="2026-03-12 10:15:30&#9;10,000.00&#9;10,120.50&#10;+120.50&#10;USD&#10;Close long position for symbol CRYPTO:ETHUSD at price 3500.00 for 0.5 units. Position AVG Price was 3259.00, currency: USD, rate: 1.000000, point value: 1.000000" spellcheck="false"></textarea></label><div id="f-msg" class="hint">Paste one entry or several at once. The fields below fill in on their own.</div><div id="f-staged"></div>`}
  <div id="f-form" class="stack" style="gap:12px">
  <label class="f">Date and time<input id="f-time" type="datetime-local" step="1" value="${esc(v.time)}"></label>
  <div class="grid2"><label class="f">Symbol<input id="f-symbol" value="${esc(v.symbol)}" placeholder="BTCUSD" autocapitalize="characters"></label>
  <label class="f">Direction<select id="f-side"><option value="long"${v.side === 'long' ? ' selected' : ''}>Long</option><option value="short"${v.side === 'short' ? ' selected' : ''}>Short</option></select></label></div>
  <div class="grid2"><label class="f">Entry price<input id="f-entry" inputmode="decimal" value="${esc(val(v.entry))}"></label><label class="f">Exit price<input id="f-exit" inputmode="decimal" value="${esc(val(v.exit))}"></label>
  <label class="f">Size (units)<input id="f-qty" inputmode="decimal" value="${esc(val(v.qty))}"></label><label class="f">Result (P&amp;L)<input id="f-pnl" inputmode="decimal" value="${esc(val(v.pnl))}"></label></div>
  <label class="f">Note<textarea id="f-note" style="font-family:var(--body);font-size:15px;min-height:64px" placeholder="Setup, emotions, lessons">${esc(t ? t.note || '' : '')}</textarea></label>
  </div>
  <label class="check" id="f-cap-wrap" hidden><input type="checkbox" id="f-setcap"><span>This is the first trade on this account. Set the starting capital from the balance before the trade.</span></label>
  <div id="f-err" class="hint err"></div>
  <div class="row end" id="f-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save-trade">${t ? 'Save changes' : 'Save trade'}</button></div></div>`);
  const first = $('#f-paste') || $('#f-symbol'); if (first) first.focus();
  updateCapCheck();
}
function updateCapCheck() {
  const w = $('#f-cap-wrap'); if (!w || !M) return;
  const acc = $('#f-acc').value;
  w.hidden = !(M.bal != null && !M.editId && !S.trades.some(t => t.accountId === acc));
}
const setForm = v => { $('#f-form').hidden = !v; $('#f-actions').hidden = !v; };
function onPaste() {
  const txt = $('#f-paste').value, msg = $('#f-msg'), box = $('#f-staged');
  M.staged = []; M.bal = null; M.one = null; box.innerHTML = '';
  if (!txt.trim()) { msg.className = 'hint'; msg.textContent = 'Paste one entry or several at once. The fields below fill in on their own.'; setForm(true); updateCapCheck(); return; }
  const { trades, notes } = parseTV(txt);
  const extra = (notes.open ? ` Skipped ${notes.open} opening entr${notes.open === 1 ? 'y' : 'ies'} (no result yet).` : '') + (notes.unknown ? ` ${notes.unknown} entr${notes.unknown === 1 ? 'y was' : 'ies were'} not recognized.` : '');
  if (!trades.length) { msg.className = 'hint err'; msg.textContent = 'No closed position recognized.' + extra; setForm(true); updateCapCheck(); return; }
  const oldest = [...trades].sort((a, b) => a.time < b.time ? -1 : 1)[0];
  M.bal = oldest.balBefore;
  if (trades.length === 1) {
    const t = trades[0];
    $('#f-time').value = t.time; $('#f-symbol').value = t.symbol; $('#f-side').value = t.side;
    $('#f-entry').value = t.entry ?? ''; $('#f-exit').value = t.exit ?? ''; $('#f-qty').value = t.qty ?? ''; $('#f-pnl').value = t.pnl ?? '';
    M.touched = true; M.one = t; setForm(true);
    msg.className = 'hint ok'; msg.textContent = `Recognized a closed ${t.side} on ${t.symbol}. Check the fields and save.` + extra;
  } else {
    M.staged = trades; setForm(false);
    msg.className = 'hint ok'; msg.textContent = `Recognized ${trades.length} trades.` + extra;
    box.innerHTML = `<div class="scroll"><table><thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th class="r">P&amp;L</th></tr></thead><tbody>${[...trades].sort((a, b) => a.time < b.time ? -1 : 1).map(t => `<tr><td class="m">${fmtDate(t.time)}</td><td class="m">${symTag(t.symbol)}</td><td>${t.side === 'long' ? 'Long' : 'Short'}</td><td class="r ${cls(t.pnl)}">${t.pnl == null ? '–' : money(t.pnl, '', true)}</td></tr>`).join('')}</tbody></table></div>
    <div class="row end" style="margin-top:8px"><button class="btn primary" data-act="save-all">Add all (${trades.length})</button></div>`;
  }
  updateCapCheck();
}
function readForm() {
  const g = id => $('#' + id).value;
  const side = g('f-side'), entry = num(g('f-entry')), exit = num(g('f-exit')), qty = num(g('f-qty'));
  let pnl = num(g('f-pnl'));
  if (pnl == null && entry != null && exit != null && qty != null) pnl = calcPnl(side, entry, exit, qty);
  return { accountId: g('f-acc'), time: g('f-time').length === 16 ? g('f-time') + ':00' : g('f-time'), symbol: g('f-symbol').trim().toUpperCase(), side, entry, exit, qty, pnl, note: g('f-note').trim() };
}
const isDup = (t, ignore) => S.trades.some(x => x.id !== ignore && x.accountId === t.accountId && x.time === t.time && x.symbol === t.symbol && Math.abs(x.pnl - t.pnl) < 0.005);
function afterAdd(time) { S.month = { y: +time.slice(0, 4), m: +time.slice(5, 7) - 1 }; S.day = time.slice(0, 10); }
async function saveTrade() {
  const t = readForm(), err = $('#f-err');
  if (!t.accountId) { err.textContent = 'Choose an account.'; return; }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t.time)) { err.textContent = 'Enter a date and time.'; return; }
  if (!t.symbol) { err.textContent = 'Enter a symbol.'; return; }
  if (t.pnl == null) { err.textContent = 'Enter the result, or entry and exit prices with the size.'; return; }
  if (isDup(t, M.editId)) { err.textContent = 'This trade is already in the journal.'; return; }
  const one = M.one || {}, wasEdit = !!M.editId;
  let obj;
  if (wasEdit) { const old = S.trades.find(x => x.id === M.editId); obj = { ...old, ...t }; S.trades = S.trades.map(x => x.id === obj.id ? obj : x); }
  else {
    obj = { id: uid(), ...t, balBefore: one.balBefore ?? null, balAfter: one.balAfter ?? null };
    if ($('#f-setcap') && !$('#f-cap-wrap').hidden && $('#f-setcap').checked && M.bal != null) { const a = accById(t.accountId); a.capital = M.bal; await persistAccounts(); }
    S.trades = [...S.trades, obj];
  }
  const back = M.back; persistTrade(obj); afterAdd(obj.time); closeOverlay(); render(); if (back) openDay(obj.time.slice(0, 10)); toast(wasEdit ? 'Changes saved' : 'Trade added');
}
async function saveAll() {
  const acc = $('#f-acc').value; if (!acc) { $('#f-err').textContent = 'Choose an account.'; return; }
  const staged = M.staged.filter(t => t.pnl != null), bal = M.bal;
  if ($('#f-setcap') && !$('#f-cap-wrap').hidden && $('#f-setcap').checked && bal != null) { accById(acc).capital = bal; await persistAccounts(); }
  let added = 0, dup = 0, last = null;
  for (const p of staged) {
    const t = { id: uid(), accountId: acc, time: p.time, symbol: p.symbol, side: p.side, entry: p.entry, exit: p.exit, qty: p.qty, pnl: p.pnl, note: '', balBefore: p.balBefore, balAfter: p.balAfter };
    if (isDup(t)) { dup++; continue; }
    S.trades = [...S.trades, t]; persistTrade(t); added++; if (!last || t.time > last) last = t.time;
  }
  if (last) afterAdd(last);
  const back = M.back; closeOverlay(); render(); if (back && last) openDay(last.slice(0, 10)); toast(`Added ${added}${dup ? `, skipped ${dup} duplicate${dup === 1 ? '' : 's'}` : ''}`);
}

/* ---------- accounts tab ---------- */
const seg = (id, opts, val) => `<div class="seg" role="radiogroup"><input type="hidden" id="${id}" value="${esc(val)}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === val}" class="${v === val ? 'on' : ''}" data-act="seg" data-target="${id}" data-val="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
function accountsHTML() {
  const cards = S.accounts.map(a => {
    const s = summarize([a]);
    return `<div class="acard"><div class="ahead"><div style="min-width:0"><h3 class="aname">${esc(a.name)}</h3><div class="row" style="gap:6px">${typeTag(a)}${curTag(a)}</div></div>
    <div class="row" style="gap:6px"><button class="btn sm" data-act="pick-account" data-id="${a.id}">Open</button><button class="btn sm" data-act="acc-edit" data-id="${a.id}">Edit</button></div></div>
    <div class="astats"><div><div class="k">Current capital</div><div class="v big">${money(s.end, dispCur())}</div></div>
    <div><div class="k">Net P&amp;L</div><div class="v ${cls(s.net)}">${money(s.net, dispCur(), true)}</div></div>
    <div><div class="k">Starting capital</div><div class="v">${money(s.start, dispCur())}</div></div>
    <div><div class="k">Trades</div><div class="v">${s.n}</div></div></div></div>`;
  }).join('');
  return `<div class="row between"><div><h2 style="margin:0;font-size:20px">Accounts</h2><span class="hint">${S.accounts.length} account${S.accounts.length === 1 ? '' : 's'}. Amounts are shown in ${dispCur()}. Each account keeps its own type, currency and starting capital.</span></div><button class="btn primary" data-act="acc-new">+ New account</button></div>
  <div class="agrid">${cards}</div>
  <div class="panel"><h3 style="margin:0 0 2px">Exchange rates</h3><span class="hint">Used to show the whole page in one currency. Set them to today's rates whenever you like. Your saved amounts never change.</span>
  <div class="rates"><label class="f">1 USD in PLN<input data-rate="PLN" inputmode="decimal" value="${esc(S.rates.PLN)}"></label><label class="f">1 USD in EUR<input data-rate="EUR" inputmode="decimal" value="${esc(S.rates.EUR)}"></label>
  <div class="fld"><span>1 EUR in PLN</span><div class="rv">${nf(S.rates.PLN / S.rates.EUR, 4)}</div></div></div></div>
  <div class="panel"><div class="row between"><div><h3 style="margin:0 0 2px">Backup</h3><span class="hint">Save everything to a file, for example into your OneDrive folder, or load a saved file back.</span></div>
  <div class="row"><button class="btn" data-act="export">Export to file</button><label class="btn" style="display:inline-flex;align-items:center">Import from file<input type="file" id="imp" accept=".json,application/json" hidden></label></div></div></div>`;
}
function openAccountForm(id) {
  const a = id ? accById(id) : null;
  M = { kind: 'acc', id, confirm: false };
  const type = a ? accType(a) : 'demo', cur = a ? a.currency : 'USD', curs = CURRENCIES.includes(cur) ? CURRENCIES : [...CURRENCIES, cur];
  openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mf"><header><h2 id="mf">${a ? 'Edit account' : 'New account'}</h2><button class="btn sm" data-act="close">Close</button></header>
  <label class="f">Name<input id="af-name" value="${esc(a ? a.name : '')}" maxlength="40" placeholder="e.g. Prop firm challenge"></label>
  <div class="fld"><span>Type</span>${seg('af-type', [['demo', 'Demo'], ['real', 'Real']], type)}</div>
  <div class="fld"><span>Currency</span>${seg('af-cur', curs.map(c => [c, c]), cur)}</div>
  <label class="f">Starting capital<input id="af-cap" inputmode="decimal" value="${a ? esc(a.capital) : '10000'}"></label>
  <p class="hint" style="margin:0">Starting capital is the balance before your first trade. Current capital is that plus all results.</p>
  <div id="af-err" class="hint err"></div>
  <div class="row between">${a ? `<button class="btn danger" data-act="acc-del" data-id="${a.id}">Delete account</button>` : '<span></span>'}<div class="row"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="acc-save">Save</button></div></div></div>`);
  $('#af-name').focus();
}
function saveAccountForm() {
  const name = $('#af-name').value.trim(), cap = num($('#af-cap').value), type = $('#af-type').value, cur = $('#af-cur').value, err = $('#af-err');
  if (!name) { err.textContent = 'Enter an account name.'; return; }
  if (cap == null || cap < 0) { err.textContent = 'Starting capital must be a number.'; return; }
  if (M.id) { const a = accById(M.id); a.name = name; a.capital = cap; a.type = type; a.currency = cur; }
  else { const a = { id: uid(), name, capital: cap, type, currency: cur }; S.accounts = [...S.accounts, a]; if (S.accounts.length === 1) S.activeId = a.id; }
  persistAccounts(); closeOverlay(); render(); toast('Account saved');
}
function addAccount(name, capRaw, cur, type) {
  const cap = num(capRaw);
  if (!name.trim()) return 'Enter an account name.';
  if (cap == null || cap < 0) return 'Starting capital must be a number.';
  const a = { id: uid(), name: name.trim(), capital: cap, currency: (cur.trim() || 'USD').toUpperCase(), type: type === 'real' ? 'real' : 'demo' };
  S.accounts = [...S.accounts, a]; if (S.accounts.length === 1) S.activeId = a.id;
  persistAccounts(); return null;
}
async function exportData() {
  try {
    const d = window.claude && claude.use ? await claude.use('downloads') : null;
    if (!d) {
      const blob = new Blob([JSON.stringify({ accounts: S.accounts, trades: S.trades, rates: S.rates }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `trading-journal-${nowLocal().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return;
    }
    await d.save({ filename: `trading-journal-${nowLocal().slice(0, 10)}.json`, data: JSON.stringify({ accounts: S.accounts, trades: S.trades, rates: S.rates }, null, 1) });
  } catch (e) { if (!e || e.code !== 'user_declined') toast('Could not save the file.'); }
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text());
    const accs = (d.accounts || []).filter(a => a && a.id && !accById(a.id)), trs = (d.trades || []).filter(t => t && t.id && !S.trades.some(x => x.id === t.id));
    S.accounts = [...S.accounts, ...accs]; if (accs.length) await persistAccounts();
    trs.forEach(t => { S.trades = [...S.trades, t]; persistTrade(t); });
    closeOverlay(); render(); toast(`Imported ${accs.length} accounts, ${trs.length} trades`);
  } catch (e) { toast('Could not read the file.'); }
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (!e.target.closest('.acc-dd')) closeDD();
  const el = e.target.closest('[data-act]'); if (!el) { if (e.target.id === 'overlay') closeModal(); return; }
  const a = el.dataset.act;
  if (a === 'tab') { S.view = el.dataset.tab; render(true); }
  else if (a === 'add-trade') { if (!S.accounts.length) return; openTradeModal(null, el.dataset.date); }
  else if (a === 'edit-trade') openTradeModal(el.dataset.id);
  else if (a === 'del-trade') {
    const id = el.dataset.id;
    if (S.confirm === id) { S.trades = S.trades.filter(t => t.id !== id); S.confirm = null; persistDelete(id); refresh(); toast('Trade deleted'); }
    else { S.confirm = id; refresh(); clearTimeout(S.ct); S.ct = setTimeout(() => { S.confirm = null; refresh(); }, 4000); }
  }
  else if (a === 'close') closeModal();
  else if (a === 'save-trade') saveTrade();
  else if (a === 'save-all') saveAll();
  else if (a === 'stab') { S.stab = el.dataset.val; render(true); }
  else if (a === 'sel-pick') {
    const w = el.closest('.sdd'), sel = w && w.querySelector('select'); if (!sel) return;
    closeDD();
    if (sel.selectedIndex !== +el.dataset.i) { sel.selectedIndex = +el.dataset.i; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    syncSelects();
  }
  else if (a === 'f-toggle') { const arr = S.f[el.dataset.k], v = el.dataset.v, i = arr.indexOf(v); if (i < 0) arr.push(v); else arr.splice(i, 1); render(); }
  else if (a === 'day') openDay(el.dataset.day);
  else if (a === 'day-nav') { if (el.dataset.day) openDay(el.dataset.day); }
  else if (a === 'prev-month') { S.month = S.month.m === 0 ? { y: S.month.y - 1, m: 11 } : { y: S.month.y, m: S.month.m - 1 }; S.day = null; render(true); }
  else if (a === 'next-month') { S.month = S.month.m === 11 ? { y: S.month.y + 1, m: 0 } : { y: S.month.y, m: S.month.m + 1 }; S.day = null; render(true); }
  else if (a === 'this-month') { const d = new Date(); S.month = { y: d.getFullYear(), m: d.getMonth() }; S.day = null; render(true); }
  else if (a === 'dd-toggle') { const menu = el.parentElement.querySelector('.dd-menu'), open = menu.hidden; menu.hidden = !open; el.setAttribute('aria-expanded', String(open)); if (open) { const t = menu.querySelector('.sel') || menu.querySelector('.dd-item'); if (t) t.focus(); } }
  else if (a === 'scope') { S.activeId = el.dataset.val; S.day = null; rememberActive(); render(); }
  else if (a === 'accounts') { S.view = 'accounts'; render(true); window.scrollTo(0, 0); }
  else if (a === 'disp') { if (S.display !== el.dataset.val) { S.display = el.dataset.val; persistAccounts(); render(); } }
  else if (a === 'pick-account' || a === 'pick-group') { S.activeId = el.dataset.id; S.view = 'overview'; S.day = null; rememberActive(); render(); window.scrollTo(0, 0); }
  else if (a === 'logout') { if (store.c) store.c.auth.signOut(); }
  else if (a === 'auth-switch') { S.auth.mode = S.auth.mode === 'signup' ? 'signin' : 'signup'; S.auth.msg = ''; S.auth.err = false; render(); }
  else if (a === 'ob-create') { const err = addAccount($('#ob-name').value, $('#ob-cap').value, $('#ob-cur').value, $('#ob-type').value); if (err) toast(err); else { rememberActive(); render(); } }
  else if (a === 'acc-new') openAccountForm(null);
  else if (a === 'acc-edit') openAccountForm(el.dataset.id);
  else if (a === 'acc-save') saveAccountForm();
  else if (a === 'seg') { $('#' + el.dataset.target).value = el.dataset.val; el.parentElement.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === el); b.setAttribute('aria-checked', b === el); }); }
  else if (a === 'acc-del') {
    const id = el.dataset.id, n = S.trades.filter(t => t.accountId === id).length;
    if (!M.confirm) { M.confirm = true; el.textContent = `Really delete account and ${n} trade${n === 1 ? '' : 's'}?`; return; }
    S.trades.filter(t => t.accountId === id).forEach(t => persistDelete(t.id));
    S.trades = S.trades.filter(t => t.accountId !== id); S.accounts = S.accounts.filter(x => x.id !== id);
    persistAccounts(); closeOverlay(); render(); toast('Account deleted');
  }
  else if (a === 'export') exportData();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'imp' && t.files[0]) { importData(t.files[0]); return; }
  if (t.dataset.change === 'account') { S.activeId = t.value; S.day = null; rememberActive(); render(); return; }
  if (t.dataset.change === 'period') { S.period = t.value; render(true); return; }
  if (t.dataset.change === 'f-sym') { S.f.sym = t.value; render(); return; }
  if (t.id === 'f-acc') updateCapCheck();
  if (t.id === 'f-side' && M && !M.touched) { const en = num($('#f-entry').value), ex = num($('#f-exit').value), qt = num($('#f-qty').value); if (en != null && ex != null && qt != null) $('#f-pnl').value = calcPnl(t.value, en, ex, qt); }
  if (t.dataset.rate) { const v = num(t.value); if (v != null && v > 0) { S.rates[t.dataset.rate] = v; persistAccounts(); } render(); return; }
  const row = t.closest('[data-acc]');
  if (row && t.dataset.field) {
    const a = accById(row.dataset.acc); if (!a) return;
    if (t.dataset.field === 'capital') { const v = num(t.value); if (v == null || v < 0) { t.value = a.capital; return; } a.capital = v; }
    else if (t.dataset.field === 'currency') a.currency = (t.value.trim() || 'USD').toUpperCase();
    else if (t.dataset.field === 'type') a.type = t.value === 'real' ? 'real' : 'demo';
    else a.name = t.value.trim() || a.name;
    persistAccounts(); render();
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'f-paste') onPaste();
  else if (t.id === 'f-pnl') M.touched = !!t.value.trim();
  else if (['f-entry', 'f-exit', 'f-qty'].includes(t.id) && M && !M.touched) {
    const en = num($('#f-entry').value), ex = num($('#f-exit').value), qt = num($('#f-qty').value);
    if (en != null && ex != null && qt != null) $('#f-pnl').value = calcPnl($('#f-side').value, en, ex, qt);
  }
});
function closeDD() { document.querySelectorAll('.dd-menu').forEach(m => { m.hidden = true; const b = m.parentElement.querySelector('.dd-btn'); if (b) b.setAttribute('aria-expanded', 'false'); }); }
document.addEventListener('keydown', e => {
  const menu = document.querySelector('.dd-menu:not([hidden])');
  if (menu) {
    if (e.key === 'Escape') { closeDD(); const b = menu.parentElement.querySelector('.dd-btn'); if (b) b.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const it = [...menu.querySelectorAll('.dd-item')], i = it.indexOf(document.activeElement); it[e.key === 'ArrowDown' ? Math.min(it.length - 1, i + 1) : Math.max(0, i - 1)].focus(); return; }
  }
  if ($('#overlay').hidden) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key === 'Enter' && M && M.kind === 'acc' && e.target.tagName === 'INPUT') { saveAccountForm(); return; }
  if (M && M.kind === 'day' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '')) {
    const days = [...new Set(scopeTrades().map(t => t.time.slice(0, 10)))].sort();
    if (e.key === 'ArrowLeft') { const p = days.filter(d => d < M.day).pop(); if (p) openDay(p); }
    if (e.key === 'ArrowRight') { const n = days.find(d => d > M.day); if (n) openDay(n); }
  }
});
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawCharts(false), 150); });

/* ---------- custom dropdowns replacing native selects ---------- */
function selMenuHTML(sel) {
  return [...sel.options].map((o, i) => `<button type="button" role="option" class="dd-item${i === sel.selectedIndex ? ' sel' : ''}" aria-selected="${i === sel.selectedIndex}" data-act="sel-pick" data-i="${i}"><span class="dd-name">${esc(o.textContent)}</span><span class="dd-check">${i === sel.selectedIndex ? ICON.check : ''}</span></button>`).join('');
}
function enhanceSelects() {
  document.querySelectorAll('select:not([data-enh])').forEach(sel => {
    if (sel.multiple) return;
    sel.dataset.enh = '1';
    const w = document.createElement('div');
    w.className = 'acc-dd sdd' + (sel.classList.contains('inline') ? ' inline' : '');
    const lab = sel.getAttribute('aria-label') || 'Choose';
    w.innerHTML = `<button type="button" class="dd-btn" data-act="dd-toggle" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(lab)}"><span class="dd-label"></span>${ICON.chev}</button><div class="dd-menu" role="listbox" hidden></div>`;
    sel.parentNode.insertBefore(w, sel); w.appendChild(sel);
    sel.classList.add('native-hide'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
  });
  syncSelects();
}
function syncSelects() {
  document.querySelectorAll('.sdd > select').forEach(sel => {
    const w = sel.parentElement, l = w.querySelector('.dd-label'), m = w.querySelector('.dd-menu');
    const t = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
    if (l.textContent !== t) l.textContent = t;
    const key = [...sel.options].map(o => o.textContent).join('\u0001') + '|' + sel.selectedIndex;
    if (m.dataset.key !== key) { m.dataset.key = key; m.innerHTML = selMenuHTML(sel); }
    w.classList.toggle('dis', sel.disabled);
  });
}
new MutationObserver(() => { enhanceSelects(); }).observe(document.body, { childList: true, subtree: true });

initStore();
