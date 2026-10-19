/* HERMES · interfaz. Toda la lógica de progreso vive en engine.js; aquí solo se pinta y se escucha. */
(function () {
'use strict';
const E = window.HermesEngine.build(window.HERMES_LEVELS);
const { LEVELS, UNITS, BADGES } = E;
const ICON = window.HERMES_ICONS;
const I = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const today = () => E.dayOf(new Date());

/* ── Guardado: navegador siempre; cuenta de claude.ai cuando la página se abre como artifact ── */
const LS_KEY = 'hermes-progress-v1';
let S = E.fresh();
let docRef = null, saveTimer = null, lastSaved = '';
function loadLocal() { try { const r = localStorage.getItem(LS_KEY); if (r) S = E.sanitize(JSON.parse(r)); } catch { /* sin almacenamiento */ } }
function persist() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* modo privado */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!docRef) return;
    const body = JSON.stringify(S);
    if (body === lastSaved) return;
    try { await docRef.set(JSON.parse(body)); lastSaved = body; setSync(true); } catch { setSync(false); }
  }, 1200);
}
function setSync(account) {
  const el = $('c-sync');
  el.innerHTML = account ? `${I('cloud')}<span>en tu cuenta</span>` : `${I('cloud-off')}<span>este navegador</span>`;
  el.title = account ? 'Tu progreso se guarda en tu cuenta y te sigue entre dispositivos' : 'Tu progreso se guarda solo en este navegador';
}
async function connect() {
  try {
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') return;
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    docRef = db.doc(`data/users/${id}/progress`);
    const snap = await docRef.get();
    if (snap.exists) {
      const remote = E.sanitize(snap.data());
      if (remote.updatedAt > S.updatedAt) { S = remote; try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* */ } renderHome(); }
      else persist();
    } else if (S.updatedAt) persist();
    lastSaved = JSON.stringify(S);
    setSync(true);
  } catch { setSync(false); }
}

/* ── Audio: voces en inglés del propio dispositivo ── */
const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
function pickVoice() {
  if (!tts) return;
  const vs = tts.getVoices().filter((v) => /^en(-|_)/i.test(v.lang));
  voice = vs.find((v) => /en-GB/i.test(v.lang) && /natural|premium|enhanced|google/i.test(v.name)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /en-US/i.test(v.lang)) || vs[0] || null;
}
if (tts) { pickVoice(); tts.addEventListener && tts.addEventListener('voiceschanged', pickVoice); }
const canSpeak = () => !!tts;
function say(text, slow) {
  if (!tts) return;
  try { tts.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = voice ? voice.lang : 'en-GB'; if (voice) u.voice = voice; u.rate = slow ? 0.7 : 0.95; tts.speak(u); } catch { /* */ }
}
const hush = () => { if (tts) try { tts.cancel(); } catch { /* */ } };

/* ── Vistas ── */
const VIEWS = ['home', 'lesson', 'done', 'badges'];
function show(v) {
  VIEWS.forEach((x) => { const el = $('v-' + x); el.hidden = x !== v; if (x === v) { el.classList.remove('view-in'); void el.offsetWidth; el.classList.add('view-in'); } });
  if (v !== 'lesson') hideSheet();
  scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
}
let viewLevel = null;
function renderChips() { $('c-xp').textContent = S.xp; $('c-streak').textContent = E.liveStreak(S, today()); }
const flagHtml = (st, long) => `<span class="flag ${st.user ? 'got-user' : ''}">${I(st.user ? 'check' : 'flag')}user${long ? ' flag' : ''}</span><span class="flag ${st.root ? 'got-root' : ''}">${I(st.root ? 'crown' : 'flag')}root${long ? ' flag' : ''}</span>`;
function renderHome() {
  renderChips();
  const open = E.maxOpenLevel(S);
  if (viewLevel === null || viewLevel > open) viewLevel = open;
  const L = LEVELS[open];
  const doneUnits = UNITS.filter((u) => E.unitState(S, u.id).user).length;
  const nu = E.nextUnit(S);
  $('h-level-k').textContent = `Nivel ${L.id} · ${L.name}`;
  $('continue-t').textContent = doneUnits ? 'Continuar' : 'Empezar';
  $('continue').setAttribute('aria-label', `${doneUnits ? 'Continuar' : 'Empezar'} con «${nu.es}»`);
  $('h-home').textContent = doneUnits ? `Siguiente máquina: ${nu.es}.` : 'Hola, operador. Tu primera máquina te espera.';
  $('h-sub').textContent = `${doneUnits} de ${UNITS.length} máquinas con user flag · ${UNITS.filter((u) => E.unitState(S, u.id).root).length} con root flag.`;
  // Ruta de niveles
  const route = $('route');
  route.querySelectorAll('.st').forEach((n) => n.remove());
  LEVELS.forEach((Lv, li) => {
    const done = E.levelDone(S, li), locked = li > open;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st press ' + (done ? 'done' : locked ? 'locked' : 'open');
    b.setAttribute('aria-pressed', li === viewLevel ? 'true' : 'false');
    b.setAttribute('aria-label', `Nivel ${Lv.id}, ${Lv.name}${locked ? ', bloqueado' : done ? ', superado' : ''}`);
    b.innerHTML = `<span class="dot">${locked ? I('lock') : done ? I('check') : Lv.id}</span><span>${Lv.id}<br>${esc(Lv.name)}</span>`;
    b.addEventListener('click', () => { viewLevel = li; renderHome(); });
    route.appendChild(b);
  });
  route.style.setProperty('--p', Math.min(1, open / (LEVELS.length - 1)));
  // Meta diaria
  const dxp = S.daily.day === today() ? S.daily.xp : 0;
  $('goal-bar').style.setProperty('--v', Math.min(1, dxp / E.DAILY_GOAL));
  $('goal-t').textContent = `${Math.min(dxp, 999)} / ${E.DAILY_GOAL} XP`;
  // Máquinas del nivel elegido
  const VL = LEVELS[viewLevel], locked = viewLevel > open;
  $('units-h').textContent = `Máquinas del nivel ${VL.id}`;
  $('units-p').textContent = locked ? 'Consigue todas las user flags del nivel anterior o haz la prueba de nivel.' : `${VL.units.filter((u) => E.unitState(S, u.id).user).length} de ${VL.units.length} con user flag`;
  const box = $('units'); box.innerHTML = '';
  VL.units.forEach((u, ui) => {
    const st = E.unitState(S, u.id);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'unit press'; b.disabled = locked; b.dataset.unit = u.id;
    b.innerHTML = `<div class="u-top"><span class="u-id">${VL.id}-${ui + 1}</span><span class="diff" aria-hidden="true">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= VL.diff ? 'on' : ''}"></i>`).join('')}</span></div>
      <div><h3>${esc(u.es)}</h3><div class="u-en">${esc(u.en)} · ${u.items.length} expresiones</div></div>
      <div class="flags">${flagHtml(st)}${st.best ? `<span class="u-best">mejor: ${st.best} %</span>` : ''}</div>`;
    b.setAttribute('aria-label', `${u.es}, dificultad ${VL.diff} de 5. ${st.user ? 'User flag conseguida' : 'Sin user flag'}. ${st.root ? 'Root flag conseguida' : 'Sin root flag'}.${locked ? ' Bloqueada.' : ''}`);
    b.addEventListener('click', () => startUnit(u.id));
    box.appendChild(b);
  });
  // Repaso
  const due = E.dueItems(S, today()).length;
  $('rev-t').textContent = due ? `Repasar ${Math.min(due, 12)} expresiones` : 'Nada pendiente';
  $('review').disabled = !due;
  $('rev-p').textContent = due ? `Tienes ${due} expresiones listas para repasar hoy.` : (Object.keys(S.items).length ? 'Todo al día. Vuelve mañana.' : 'Las expresiones que aprendas volverán justo antes de que se te olviden.');
  // Insignias
  $('bd-count').textContent = `${Object.keys(S.badges).length}/${BADGES.length}`;
  const mini = $('badge-mini'); mini.innerHTML = '';
  [...BADGES].sort((a, b) => (S.badges[b.id] ? 1 : 0) - (S.badges[a.id] ? 1 : 0)).slice(0, 8).forEach((bd) => {
    const d = document.createElement('div'); d.className = 'bd' + (S.badges[bd.id] ? ' got' : ''); d.title = bd.t;
    d.innerHTML = I(bd.icon) + `<span class="sr">${esc(bd.t)}${S.badges[bd.id] ? ' (conseguida)' : ''}</span>`;
    mini.appendChild(d);
  });
}
function renderBadges() {
  $('b-p').textContent = `${Object.keys(S.badges).length} de ${BADGES.length} conseguidas`;
  const list = $('badge-list'); list.innerHTML = '';
  BADGES.forEach((bd) => {
    const got = S.badges[bd.id];
    const c = document.createElement('div'); c.className = 'card badge';
    c.innerHTML = `<div class="bd${got ? ' got' : ''}">${I(got ? bd.icon : 'lock')}</div><div><b>${esc(bd.t)}</b><span>${esc(bd.d)}</span>${got ? `<small>Conseguida el ${got.split('-').reverse().join('/')}</small>` : ''}</div>`;
    list.appendChild(c);
  });
}

/* ── Lección ── */
let L = null;
const startUnit = (unitId) => beginSession({ mode: 'unit', unit: UNITS.find((u) => u.id === unitId), queue: E.lessonPlan(unitId, { canSpeak: canSpeak() }) });
function beginSession(o) {
  hush();
  L = { results: [], ...o, i: 0, total: o.queue.length, ok: 0, firstWrong: new Set(), xp: 0, combo: 0, start: Date.now(), answered: false };
  show('lesson'); renderEx();
}
function setProgress() {
  const v = Math.min(1, L.ok / L.total);
  $('l-bar').style.setProperty('--v', v);
  $('l-prog').setAttribute('aria-valuenow', Math.round(v * 100));
  $('combo').textContent = L.combo >= 3 ? `×${L.combo}` : '';
}
const KIND = { meaning: '¿Qué significa?', reverse: '¿Cómo se dice en inglés?', listen: 'Escucha y elige lo que oyes', gap: 'Completa la frase', build: 'Traduce ordenando las palabras', type: 'Escríbelo en inglés' };
function renderEx() {
  setProgress();
  const ex = L.queue[L.i];
  const { item, type } = ex;
  L.answered = false;
  const box = $('ex');
  box.dataset.type = type;
  const speakBtn = (text, big) => (canSpeak() ? `<button class="speak press${big ? ' big-sp' : ''}" type="button" data-say="${esc(text)}" aria-label="Escuchar">${I('volume-2')}</button>` : '');
  const slowBtn = (text) => (canSpeak() ? `<button class="speak slow press" type="button" data-say="${esc(text)}" data-slow="1" aria-label="Escuchar despacio">${I('turtle')}</button>` : '');
  let html = `<div class="ex-k">${KIND[type]}${L.mode === 'placement' ? ` · ${LEVELS[ex.li].id}` : ''}</div>`;
  if (type === 'meaning') html += `<div class="prompt"><span class="big" lang="en">${esc(item.en)}</span>${speakBtn(item.en)}</div>`;
  if (type === 'reverse' || type === 'type') html += `<div class="prompt"><span class="big">${esc(item.es)}</span></div>`;
  if (type === 'listen') html += `<div class="prompt">${speakBtn(item.en, true)}${slowBtn(item.en)}</div>`;
  if (type === 'gap') { const g = E.gapOf(item); html += `<div class="prompt"><span class="sent" lang="en">${esc(g.before)}<span class="blank"><span class="sr">hueco</span>&nbsp;&nbsp;&nbsp;</span>${esc(g.after)}</span></div><div class="hint">${esc(item.exEs)}</div>`; }
  const opts = E.optionsFor(ex);
  if (opts) html += `<div class="opts" role="group" aria-label="Opciones">${opts.map((o, k) => `<button class="opt press" type="button" data-v="${esc(o)}"${type === 'meaning' ? '' : ' lang="en"'}><span class="key" aria-hidden="true">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  if (type === 'build') html += `<div class="prompt"><span class="sent">${esc(item.exEs)}</span></div><div class="tray" id="tray" role="group" aria-label="Tu frase" aria-live="polite"></div><div class="bank" id="bank" lang="en">${E.tilesFor(ex).map((w, k) => `<button class="tile press" type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><div class="ex-actions"><button class="btn primary press" id="check" type="button" disabled>Comprobar</button></div>`;
  if (type === 'type') html += `<input class="type-in" id="typein" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="en" placeholder="Escribe en inglés…" aria-label="Tu respuesta en inglés"><div class="ex-actions"><button class="btn primary press" id="check" type="button" disabled>Comprobar</button></div>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => say(b.dataset.say, !!b.dataset.slow)));
  box.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => answer(b.dataset.v, b)));
  if (type === 'listen') setTimeout(() => say(item.en), 250);
  if (type === 'build') {
    const tray = $('tray'), check = $('check');
    const upd = () => { check.disabled = !tray.children.length; };
    $('bank').querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => {
      if (L.answered || t.disabled) return;
      t.disabled = true;
      const c = document.createElement('button'); c.type = 'button'; c.className = 'tile press'; c.textContent = t.textContent;
      c.addEventListener('click', () => { if (L.answered) return; c.remove(); t.disabled = false; upd(); });
      tray.appendChild(c); upd();
    }));
    check.addEventListener('click', () => answer([...tray.children].map((c) => c.textContent).join(' ')));
  }
  if (type === 'type') {
    const inp = $('typein'), check = $('check');
    inp.addEventListener('input', () => { check.disabled = !inp.value.trim(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim() && !L.answered) { e.preventDefault(); answer(inp.value); } });
    check.addEventListener('click', () => answer(inp.value));
    setTimeout(() => inp.focus(), 60);
  } else {
    const f = box.querySelector('.opt, .tile, .speak');
    if (f) f.focus({ preventScroll: true });
  }
}
function answer(value, btn) {
  if (L.answered) return;
  L.answered = true;
  const ex = L.queue[L.i];
  const ok = E.isCorrect(ex, value);
  const first = !ex.retried;
  const t = today();
  $('ex').querySelectorAll('.opt').forEach((b) => { b.disabled = true; if (E.norm(b.dataset.v) === E.norm(ex.correct)) b.classList.add('right'); });
  if (btn && !ok) btn.classList.add('wrong');
  if (ex.type === 'gap') { const bl = $('ex').querySelector('.blank'); bl.textContent = E.gapOf(ex.item).word; bl.classList.add(ok ? 'filled-ok' : 'filled-ko'); }
  if (L.mode === 'placement') L.results.push({ li: ex.li, ok });
  if (ok) {
    L.ok++; L.combo++;
    if (L.mode !== 'placement') { const g = E.xpFor(L.combo); L.xp += g; xpPop(g, btn || $('check')); if (first) E.srs(S, ex.item.key, true, t); }
    if (ex.type === 'listen') S.stats.listen++;
    if (ex.type === 'build') S.stats.build++;
    if (ex.type === 'type') S.stats.type++;
  } else {
    L.combo = 0;
    if (first) L.firstWrong.add(L.i);
    if (L.mode !== 'placement') { E.srs(S, ex.item.key, false, t); L.queue.push({ ...ex, retried: true }); }
  }
  if (!ok || ex.type !== 'listen') say(ex.type === 'build' ? ex.item.exEn : ex.item.en);
  setProgress();
  showSheet(ok, ex);
}
function xpPop(n, anchor) {
  if (reduce.matches || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const p = document.createElement('div'); p.className = 'xp-pop'; p.setAttribute('aria-hidden', 'true'); p.textContent = `+${n} XP`;
  p.style.left = (r.left + r.width / 2 - 30) + 'px'; p.style.top = (r.top - 10) + 'px';
  document.body.appendChild(p); setTimeout(() => p.remove(), 950);
}
const PRAISE = ['¡Bien!', '¡Exacto!', '¡Perfecto!', '¡Eso es!'];
function showSheet(ok, ex) {
  const s = $('sheet');
  s.className = 'sheet show ' + (ok ? 'ok' : 'ko');
  $('s-verdict').innerHTML = ok ? `${I('check')}${PRAISE[L.i % PRAISE.length]}` : `${I('x')}Casi`;
  $('s-detail').innerHTML = (ok ? '' : `Respuesta: <b lang="${ex.type === 'meaning' ? 'es' : 'en'}">${esc(ex.correct)}</b><br>`) + `<span lang="en">${esc(ex.item.exEn)}</span> — ${esc(ex.item.exEs)}`;
  $('s-next').focus({ preventScroll: true });
}
const hideSheet = () => { $('sheet').className = 'sheet'; };
function next() {
  hideSheet();
  L.i++;
  if (L.mode === 'placement') {
    const lvl = L.queue[L.i - 1].li;
    const res = L.results.filter((r) => r.li === lvl);
    if ((res.length === 2 && res.some((r) => !r.ok)) || L.i >= L.queue.length) return finishPlacement();
  }
  if (L.i >= L.queue.length) return finish();
  renderEx();
}
const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
const badgesHtml = (list) => list.filter(Boolean).map((b) => `<div class="nb">${I(b.icon)}<div><b>Nueva insignia: ${esc(b.t)}</b><span>${esc(b.d)}</span></div></div>`).join('');
function finish() {
  const t = today();
  const firstTry = L.total - [...L.firstWrong].filter((i) => i < L.total).length;
  const acc = Math.round((firstTry / L.total) * 100);
  let res = { newUser: false, newRoot: false, bonus: 0 };
  if (L.mode === 'unit') res = E.scoreUnit(S, L.unit.id, acc);
  L.xp += res.bonus;
  E.grantXp(S, L.xp, t);
  E.touchStreak(S, t);
  S.stats.lessons++;
  const nb = E.award(S, t, L.mode === 'review' ? ['review'] : []);
  persist();
  $('d-xp').textContent = '+' + L.xp;
  $('d-acc').textContent = acc + ' %';
  $('d-time').textContent = clock(Math.round((Date.now() - L.start) / 1000));
  if (L.mode === 'unit') {
    const st = E.unitState(S, L.unit.id);
    $('d-h').textContent = res.newRoot ? 'Root flag conseguida' : res.newUser ? 'User flag conseguida' : acc >= E.USER_FLAG ? 'Máquina repasada' : 'Casi: vuelve a intentarlo';
    $('d-p').textContent = acc >= E.USER_FLAG ? `«${L.unit.es}» · ${L.unit.en}${acc < 100 ? `. Hazla sin fallos para la root flag (+${E.XP_ROOT} XP).` : ''}` : `Necesitas un ${E.USER_FLAG} % de acierto a la primera para la user flag.`;
    $('d-flags').innerHTML = flagHtml(st, true);
  } else {
    $('d-h').textContent = 'Repaso completado';
    $('d-p').textContent = 'Las expresiones acertadas vuelven más tarde; las falladas, mañana.';
    $('d-flags').innerHTML = '';
  }
  $('d-badges').innerHTML = badgesHtml(nb);
  const nu = E.nextUnit(S);
  $('d-next').hidden = L.mode !== 'unit';
  $('d-next').onclick = () => startUnit(nu.id);
  show('done'); renderChips();
}
function finishPlacement() {
  const t = today();
  const { reached, open } = E.placementLevel(L.results);
  S.unlocked = Math.max(S.unlocked || 0, open);
  const nb = E.award(S, t, ['placement']);
  persist();
  $('d-xp').textContent = '+0';
  $('d-acc').textContent = Math.round((L.results.filter((r) => r.ok).length / L.results.length) * 100) + ' %';
  $('d-time').textContent = clock(Math.round((Date.now() - L.start) / 1000));
  $('d-h').textContent = `Tu punto de partida: ${LEVELS[open].id}`;
  $('d-p').textContent = reached ? `Dominas hasta ${LEVELS[reached - 1].id}. Hemos abierto el nivel ${LEVELS[open].id} · ${LEVELS[open].name}.` : 'Empezamos desde A0. En unas pocas lecciones notarás el avance.';
  $('d-flags').innerHTML = '';
  $('d-badges').innerHTML = badgesHtml(nb);
  viewLevel = open;
  $('d-next').hidden = false;
  $('d-next').onclick = () => startUnit(LEVELS[open].units[0].id);
  show('done'); renderChips();
}

/* ── Eventos ── */
const home = () => { hush(); renderHome(); show('home'); };
$('s-next').addEventListener('click', next);
$('quit').addEventListener('click', home);
$('go-home').addEventListener('click', home);
$('d-home').addEventListener('click', home);
$('b-back').addEventListener('click', home);
$('continue').addEventListener('click', () => startUnit(E.nextUnit(S).id));
$('review').addEventListener('click', () => { const d = E.dueItems(S, today()); if (d.length) beginSession({ mode: 'review', queue: E.reviewPlan(d, { canSpeak: canSpeak() }) }); });
$('placement').addEventListener('click', () => beginSession({ mode: 'placement', queue: E.placementPlan() }));
$('all-badges').addEventListener('click', () => { renderBadges(); show('badges'); });
document.addEventListener('keydown', (e) => {
  if ($('v-lesson').hidden || !L) return;
  if ($('sheet').classList.contains('show')) { if (e.key === 'Enter' && document.activeElement !== $('s-next')) { e.preventDefault(); next(); } return; }
  if (/^[1-4]$/.test(e.key) && document.activeElement && document.activeElement.id !== 'typein') { const b = $('ex').querySelectorAll('.opt')[+e.key - 1]; if (b && !b.disabled) b.click(); }
});
addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* */ } } });

/* Tema */
const themeBtn = $('theme');
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : sysDark.matches);
try { const t = localStorage.getItem('hermes-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch { /* */ }
const themeUI = () => { themeBtn.innerHTML = I(isDark() ? 'sun' : 'moon'); themeBtn.setAttribute('aria-label', isDark() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'); };
themeBtn.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('hermes-theme', t); } catch { /* */ } themeUI(); });
if (sysDark.addEventListener) sysDark.addEventListener('change', themeUI);

/* Gancho solo para las pruebas automáticas (?test): expone el ejercicio en curso y el estado. */
if (/[?&]test\b/.test(location.search)) window.__HERMES__ = { E, current: () => (L ? L.queue[L.i] : null), state: () => S };

/* Arranque */
loadLocal();
themeUI();
setSync(false);
renderHome();
connect();
})();
