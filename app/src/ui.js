/* LemonByte · interfaz. La lógica de progreso vive en engine.js; aquí se pinta, se escucha y se suena. */
(function () {
'use strict';
const E = window.LemonByteEngine.build(window.LEMONBYTE_LEVELS);
const { LEVELS, UNITS, BADGES, TIERS, KINDS } = E;
const ICON = window.LEMONBYTE_ICONS;
const I = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const today = () => E.dayOf(new Date());
const pref = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };
const SECRET = new Set(['early', 'night', 'triple', 'combo-10']);

/* ═══ Guardado: navegador siempre; cuenta de claude.ai cuando se abre como artifact ═══ */
const LS_KEY = 'lemonbyte-progress-v1';
let S = E.fresh();
let docRef = null, saveTimer = null, lastSaved = '';
function loadLocal() {
  try {
    const r = localStorage.getItem(LS_KEY) || localStorage.getItem('hermes-progress-v1'); // migra la 0.1
    if (r) S = E.sanitize(JSON.parse(r));
  } catch { /* sin almacenamiento */ }
}
function persist() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* modo privado */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!docRef) return;
    const body = JSON.stringify(S);
    if (body === lastSaved) return;
    try { await docRef.set(JSON.parse(body)); lastSaved = body; setSync(true); } catch { setSync(false); }
  }, 1200);
}
function setSync(account) {
  const el = $('c-sync');
  el.innerHTML = account ? `${I('cloud')}<span>Progreso en tu cuenta</span>` : `${I('cloud-off')}<span>Progreso en este navegador</span>`;
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
      if (remote.updatedAt > S.updatedAt) { S = remote; try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* */ } render(); }
      else persist();
    } else if (S.updatedAt) persist();
    lastSaved = JSON.stringify(S);
    setSync(true);
  } catch { setSync(false); }
}

/* ═══ Sonido: sintetizado con Web Audio, sin ficheros ni red ═══ */
const Sound = (() => {
  let ctx = null, on = pref.get('lemonbyte-sound', '1') === '1';
  const ac = () => { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(freq, at, dur, type = 'sine', vol = 0.12) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const play = (notes) => { if (!on) return; try { notes.forEach((n) => tone(...n)); } catch { /* sin audio */ } };
  return {
    get on() { return on; },
    set(v) { on = v; pref.set('lemonbyte-sound', v ? '1' : '0'); },
    ok: () => play([[880, 0, 0.12, 'sine', 0.1], [1318.5, 0.08, 0.2, 'sine', 0.1]]),                 // dos notas que suben: acierto
    ko: () => play([[233, 0, 0.16, 'triangle', 0.13], [174.6, 0.11, 0.24, 'triangle', 0.12]]),        // dos notas que bajan: fallo
    flag: () => play([[523.3, 0, 0.14], [659.3, 0.09, 0.14], [784, 0.18, 0.3]]),                      // arpegio: user flag
    root: () => play([[523.3, 0, 0.12], [659.3, 0.08, 0.12], [784, 0.16, 0.12], [1046.5, 0.24, 0.42], [1568, 0.36, 0.3, 'sine', 0.05]]), // arpegio largo con brillo: root flag
    badge: () => play([[1318.5, 0, 0.1, 'sine', 0.07], [1760, 0.07, 0.22, 'sine', 0.07]]),
  };
})();

/* ═══ Voz: inglés con las voces del propio dispositivo ═══ */
const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
function pickVoice() {
  if (!tts) return;
  const vs = tts.getVoices().filter((v) => /^en(-|_)/i.test(v.lang));
  voice = vs.find((v) => /en-GB/i.test(v.lang) && /natural|premium|enhanced|google/i.test(v.name)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /en-US/i.test(v.lang)) || vs[0] || null;
}
if (tts) { pickVoice(); if (tts.addEventListener) tts.addEventListener('voiceschanged', pickVoice); }
const canSpeak = () => !!tts;
function say(text, slow) {
  if (!tts) return;
  try { tts.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = voice ? voice.lang : 'en-GB'; if (voice) u.voice = voice; u.rate = slow ? 0.7 : 0.95; tts.speak(u); } catch { /* */ }
}
const hush = () => { if (tts) try { tts.cancel(); } catch { /* */ } };

/* ═══ Avisos ═══ */
function toast(html, kind) {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.innerHTML = html;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4000);
}

/* ═══ Barra inferior: iconos animados (AnimateIcons) ═══
 * Se animan una vez al pasar el puntero, al tocar y cuando la pestaña pasa a estar activa; nunca en bucle.
 * Con movimiento reducido no se animan (isAnimated false y sin startAnimation). */
const tabMotion = matchMedia('(prefers-reduced-motion: reduce)');
let tabActive = null;
function playTabIcon(el) {
  if (el === tabActive) return;
  tabActive = el;
  if (el && el._ai && !tabMotion.matches) el._ai.startAnimation();
}
(function animateTabIcons() {
  const AI = window.LemonAnimateIcons;
  if (!AI) return;
  document.querySelectorAll('.bottom [data-ai]').forEach((el) => {
    const def = AI.icons[el.dataset.ai], old = el.querySelector('svg.ico');
    if (!def || !old) return;
    const ico = AI.createIcon(def, { size: 21, isAnimated: false });
    ico.classList.add('ico', 'ai');
    ico.setAttribute('aria-hidden', 'true');
    ico.setAttribute('focusable', 'false');
    old.replaceWith(ico);
    el._ai = ico;
    const play = () => { if (!tabMotion.matches) ico.startAnimation(); };
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') play(); });
    el.addEventListener('pointerdown', play);
  });
})();

/* ═══ Navegación ═══ */
const VIEWS = ['home', 'labs', 'progress', 'badges', 'lesson', 'done'];
const HASH = { home: 'inicio', labs: 'labs', progress: 'progreso', badges: 'insignias' };
const TITLE = { home: 'Inicio', labs: 'Laboratorios', progress: 'Progreso', badges: 'Insignias', lesson: 'Laboratorio', done: 'Resultado' };
let view = 'home', viewLevel = null;
function show(v, { focus = true } = {}) {
  view = v;
  VIEWS.forEach((x) => { $('v-' + x).hidden = x !== v; });
  if (v !== 'lesson') hideSheet();
  document.querySelectorAll('[data-go]').forEach((a) => { if (a.tagName === 'A') { if (a.dataset.go === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } });
  document.title = `${TITLE[v]} · LemonByte`;
  playTabIcon(document.querySelector('.bottom [aria-current="page"]'));
  moveNavPill();
  scrollTo({ top: 0, behavior: 'auto' });
  if (focus) { const h = $('v-' + v).querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
}
function moveNavPill() {
  const a = document.querySelector('.nav a[aria-current="page"]');
  const pill = document.querySelector('.nav-pill');
  pill.style.opacity = a ? '1' : '0';
  if (a) pill.style.setProperty('--y', a.offsetTop + 'px');
}
function go(target) {
  closeMore();
  if (target === 'review') return startReview();
  if (target === 'placement') return startPlacement();
  if (HASH[target] && location.hash !== '#' + HASH[target]) history.replaceState(null, '', '#' + HASH[target]);
  render(target);
  show(target);
}
function render(v = view) {
  renderChrome();
  if (v === 'home') renderHome();
  if (v === 'labs') renderLabs();
  if (v === 'progress') renderProgress();
  if (v === 'badges') renderBadges();
}

/* ═══ Elementos comunes ═══ */
const tierTag = (t) => `<span class="tier-tag" data-t="${t}">${TIERS[t].t}</span>`;
const kindTag = (k) => `<span class="kind-tag">${I(KINDS[k].icon)}${KINDS[k].t}</span>`;
const flagHtml = (st, long) => `<span class="flag ${st.user ? 'got-user' : ''}">${I(st.user ? 'check' : 'flag')}user${long ? ' flag' : ''}</span><span class="flag ${st.root ? 'got-root' : ''}">${I(st.root ? 'crown' : 'flag')}root${long ? ' flag' : ''}</span>`;
function renderChrome() {
  $('c-xp').textContent = S.xp;
  $('c-streak').textContent = E.liveStreak(S, today());
  const open = E.maxOpenLevel(S), L = LEVELS[open];
  const units = E.unitsOf(open);
  $('lp-k').textContent = L.id;
  $('lp-name').textContent = L.name;
  $('lp-sub').textContent = `${units.filter((u) => E.unitState(S, u.id).user).length} de ${units.length} labs`;
  $('n-labs').textContent = UNITS.filter((u) => E.unitState(S, u.id).user).length + '/100';
  const due = E.dueItems(S, today()).length;
  $('n-due').hidden = !due; $('n-due').textContent = due;
  $('n-badges').textContent = Object.keys(S.badges).length;
}
function matrixHtml(interactive) {
  const open = E.maxOpenLevel(S);
  return LEVELS.map((L, li) => `<div class="mx-row"><b>${L.id}</b><div class="mx-cells">${E.unitsOf(li).map((u) => {
    const st = E.unitState(S, u.id), cls = `cell${u.boss ? ' boss' : ''}${st.root ? ' root' : st.user ? ' user' : ''}${li > open ? ' locked' : ''}`;
    const label = `${u.es}: ${st.root ? 'root flag' : st.user ? 'user flag' : 'pendiente'}`;
    return interactive && E.canPlay(S, u) ? `<button type="button" class="${cls}" data-unit="${u.id}" title="${esc(label)}" aria-label="${esc(label)}"></button>` : `<span class="${cls}" title="${esc(label)}"></span>`;
  }).join('')}</div></div>`).join('');
}

/* ═══ Inicio ═══ */
function renderHome() {
  const open = E.maxOpenLevel(S), L = LEVELS[open];
  const users = UNITS.filter((u) => E.unitState(S, u.id).user).length, roots = UNITS.filter((u) => E.unitState(S, u.id).root).length;
  const nu = E.nextUnit(S);
  $('home-k').textContent = `Nivel ${L.id} · ${L.name}`;
  $('h-home').textContent = users ? `Siguiente: ${nu.es}.` : 'Exprime tu inglés.';
  $('home-lede').textContent = users ? `${users} de 100 laboratorios con user flag y ${roots} con root flag. Sigue así.` : 'Cien laboratorios del A0 al C1. Cada uno tiene su user flag y su root flag.';
  $('continue-t').textContent = users ? 'Continuar' : 'Empezar';
  $('continue').setAttribute('aria-label', `${users ? 'Continuar' : 'Empezar'} con «${nu.es}»`);
  $('nc-tier').outerHTML = `<span class="tier-tag" id="nc-tier" data-t="${nu.tier}">${TIERS[nu.tier].t}</span>`;
  $('nc-kind').innerHTML = `${I(KINDS[nu.kind].icon)}${KINDS[nu.kind].t}`;
  $('nc-title').textContent = nu.es;
  $('nc-en').textContent = nu.boss ? `${nu.en} · ${KINDS.jefe.d}` : `${nu.en} · ${nu.items.length} expresiones`;
  $('nc-words').innerHTML = nu.boss ? '' : nu.items.slice(0, 5).map((it) => `<span>${esc(it[0])}</span>`).join('');
  const dxp = S.daily.day === today() ? S.daily.xp : 0;
  $('goal-bar').style.setProperty('--v', Math.min(1, dxp / E.DAILY_GOAL));
  $('goal-t').textContent = dxp >= E.DAILY_GOAL ? `${dxp} XP · meta cumplida` : `${dxp} / ${E.DAILY_GOAL} XP`;
  const days = E.lastDays(S, today(), 7), max = Math.max(E.DAILY_GOAL, ...days.map((d) => d.xp));
  const wd = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  $('week').innerHTML = days.map((d, i) => `<div><i class="${d.xp ? 'on' : ''}${i === 6 ? ' today' : ''}" style="--h:${(d.xp / max).toFixed(3)}" title="${d.day}: ${d.xp} XP"></i><span>${wd[new Date(d.day + 'T12:00:00').getDay()]}</span></div>`).join('');
  $('week').setAttribute('aria-label', 'XP de los últimos 7 días: ' + days.map((d) => d.xp).join(', '));
  const due = E.dueItems(S, today()).length;
  $('rev-t').textContent = due ? `Repasar ${Math.min(due, 12)} expresiones` : 'Nada pendiente';
  $('review').disabled = !due;
  $('rev-p').textContent = due ? `Tienes ${due} expresiones listas para repasar hoy.` : (Object.keys(S.items).length ? 'Todo al día. Vuelve mañana.' : 'Las expresiones que aprendas volverán justo antes de que se te olviden.');
  $('mx-sum').textContent = `${users} user · ${roots} root`;
  $('matrix-home').innerHTML = matrixHtml(false);
  $('matrix-home').setAttribute('aria-label', `Mapa de los 100 laboratorios: ${users} con user flag y ${roots} con root flag`);
}

/* ═══ Laboratorios ═══ */
function renderLabs() {
  const open = E.maxOpenLevel(S);
  if (viewLevel === null || viewLevel > open) viewLevel = open;
  const L = LEVELS[viewLevel], li = viewLevel, locked = li > open;
  $('labs-k').textContent = `Laboratorios · ${L.id}`;
  $('h-labs').textContent = L.name;
  $('labs-lede').textContent = locked ? 'Nivel bloqueado: derrota al jefe final del nivel anterior o haz la prueba de nivel.' : `Juega los labs en el orden que quieras. Con ${E.bossNeed(li)} de ${E.contentOf(li).length} superados se abre el jefe final.`;
  $('route').innerHTML = LEVELS.map((Lv, i) => {
    const units = E.unitsOf(i), got = units.filter((u) => E.unitState(S, u.id).user).length;
    const st = E.levelDone(S, i) ? 'done' : i > open ? 'locked' : 'open';
    return `<button type="button" role="tab" class="st press ${st}" data-level="${i}" aria-selected="${i === li}" tabindex="${i === li ? 0 : -1}" aria-label="Nivel ${Lv.id}, ${Lv.name}: ${got} de ${units.length}${st === 'locked' ? ', bloqueado' : st === 'done' ? ', superado' : ''}">
      <span class="st-id">${Lv.id}${st === 'locked' ? I('lock') : st === 'done' ? I('check') : ''}</span><span class="st-n">${esc(Lv.name)}</span><span class="st-bar"><i style="--v:${(got / units.length).toFixed(3)}"></i></span></button>`;
  }).join('');
  const groups = ['facil', 'media', 'dificil', 'insane'].map((t) => ({ t, units: E.unitsOf(li).filter((u) => u.tier === t) }));
  $('phases').innerHTML = groups.map(({ t, units }, gi) => `<section class="phase" aria-labelledby="ph-${t}">
    <div class="phase-h">${tierTag(t)}<h2 id="ph-${t}">${t === 'insane' ? 'Jefe final' : `Fase ${gi + 1}`}</h2><small>${TIERS[t].d}</small></div>
    <div class="labs">${units.map((u) => labCard(u, locked)).join('')}</div></section>`).join('');
}
function labCard(u, levelLocked) {
  const st = E.unitState(S, u.id), playable = !levelLocked && E.canPlay(S, u);
  if (u.boss) {
    const need = E.bossNeed(u.li), have = E.contentOf(u.li).filter((x) => E.unitState(S, x.id).user).length;
    return `<button type="button" class="lab boss press" data-unit="${u.id}"${playable ? '' : ' disabled'} aria-label="${esc(u.es)}. ${playable ? 'Disponible' : `Bloqueado: ${have} de ${need} labs`}. ${st.user ? 'User flag conseguida.' : ''} ${st.root ? 'Root flag conseguida.' : ''}">
      <span class="boss-ico">${I('skull')}</span>
      <span><span class="lab-id">${u.level} · INSANE</span><h3>${esc(u.es)}</h3><span class="gate">${playable ? KINDS.jefe.d : `Se abre con ${need} labs superados · llevas ${have}`}</span></span>
      <span class="flags">${flagHtml(st)}</span></button>`;
  }
  return `<button type="button" class="lab press" data-unit="${u.id}"${playable ? '' : ' disabled'} aria-label="${esc(u.es)}, ${TIERS[u.tier].t}, tipo ${KINDS[u.kind].t}. ${st.user ? 'User flag conseguida' : 'Sin user flag'}. ${st.root ? 'Root flag conseguida' : 'Sin root flag'}.${playable ? '' : ' Bloqueado.'}">
    <span class="lab-top"><span class="lab-id">${u.level}-${String(u.ui + 1).padStart(2, '0')}</span>${kindTag(u.kind)}</span>
    <span><h3>${esc(u.es)}</h3><span class="lab-en" lang="en">${esc(u.en)}</span></span>
    <span class="flags">${flagHtml(st)}${st.best ? `<span class="best">${st.best} %</span>` : ''}</span></button>`;
}

/* ═══ Progreso ═══ */
function renderProgress() {
  const users = UNITS.filter((u) => E.unitState(S, u.id).user).length, roots = UNITS.filter((u) => E.unitState(S, u.id).root).length;
  const boxes = E.boxCounts(S), learned = E.ITEMS.length - boxes[0];
  $('kpis').innerHTML = [
    ['XP total', S.xp, 'zest'], ['Labs con user flag', `${users}/100`], ['Root flags', roots], ['Expresiones vistas', `${learned}/${E.ITEMS.length}`],
  ].map(([k, v, c]) => `<div class="card kpi ${c || ''}"><span>${k}</span><b>${v}</b></div>`).join('');
  $('matrix-full').innerHTML = matrixHtml(true);
  const days = E.lastDays(S, today(), 14), max = Math.max(E.DAILY_GOAL, ...days.map((d) => d.xp));
  $('bars14').innerHTML = days.map((d, i) => `<div><i class="${d.xp ? 'on' : ''}${i === 13 && d.xp ? ' today' : ''}" style="--h:${(d.xp / max).toFixed(3)}" title="${d.day}: ${d.xp} XP"></i><span>${d.day.slice(8)}</span></div>`).join('');
  $('bars14').setAttribute('role', 'img');
  $('bars14').setAttribute('aria-label', 'XP de los últimos 14 días: ' + days.map((d) => d.xp).join(', '));
  const names = ['Sin ver', 'Caja 1 · mañana', 'Caja 2 · 3 días', 'Caja 3 · 7 días', 'Caja 4 · 14 días', 'Caja 5 · 30 días'];
  const top = Math.max(1, ...boxes);
  $('boxes').innerHTML = boxes.map((n, i) => `<div class="box-row"><span>${names[i]}</span><span class="box-track"><i style="--v:${(n / top).toFixed(3)}"></i></span><b>${n}</b></div>`).join('');
}

/* ═══ Insignias ═══ */
function renderBadges() {
  const got = Object.keys(S.badges).length;
  $('b-p').textContent = `${got} de ${BADGES.length} conseguidas. Algunas son evidentes; otras, sorpresa.`;
  $('badge-list').innerHTML = BADGES.map((bd) => {
    const when = S.badges[bd.id], hide = SECRET.has(bd.id) && !when;
    return `<div class="card badge${hide ? ' secret' : ''}"><div class="bd${when ? ' got' : ''}">${I(when ? bd.icon : hide ? 'sparkles' : 'lock')}</div><div><b>${hide ? 'Insignia secreta' : esc(bd.t)}</b><span>${hide ? 'Sigue practicando para descubrirla.' : esc(bd.d)}</span>${when ? `<small>Conseguida el ${when.split('-').reverse().join('/')}</small>` : ''}</div></div>`;
  }).join('');
}

/* ═══ Lección ═══ */
let L = null;
function startUnit(unitId) {
  const u = E.UNIT_BY_ID[unitId];
  if (!u || !E.canPlay(S, u)) return;
  beginSession({ mode: 'unit', unit: u, queue: E.lessonPlan(unitId, { canSpeak: canSpeak() }) });
}
function startReview() { const d = E.dueItems(S, today()); if (!d.length) { toast(`${I('check')}Nada que repasar hoy`); return; } beginSession({ mode: 'review', queue: E.reviewPlan(d, { canSpeak: canSpeak() }) }); }
function startPlacement() { beginSession({ mode: 'placement', queue: E.placementPlan() }); }
function beginSession(o) {
  hush(); closeDialogs();
  L = { results: [], ...o, i: 0, total: o.queue.length, ok: 0, firstWrong: new Set(), xp: 0, combo: 0, best: 0, start: Date.now(), answered: false };
  const tier = o.unit ? o.unit.tier : o.mode === 'review' ? 'media' : 'facil';
  $('l-tier').outerHTML = `<span class="tier-tag" id="l-tier" data-t="${tier}">${o.unit ? TIERS[tier].t : o.mode === 'review' ? 'Repaso' : 'Prueba'}</span>`;
  $('l-name').textContent = o.unit ? o.unit.es : o.mode === 'review' ? 'Repaso espaciado' : 'Prueba de nivel';
  show('lesson', { focus: false });
  renderEx();
}
function setProgress() {
  const v = Math.min(1, L.ok / L.total);
  $('l-bar').style.setProperty('--v', v);
  $('l-prog').setAttribute('aria-valuenow', Math.round(v * 100));
  $('combo').textContent = L.combo >= 3 ? `×${L.combo}` : '';
}
const KIND_TXT = { meaning: '¿Qué significa?', reverse: '¿Cómo se dice en inglés?', listen: 'Escucha y elige lo que oyes', gap: 'Completa la frase', build: 'Traduce ordenando las palabras', type: 'Escríbelo en inglés' };
function renderEx() {
  setProgress();
  const ex = L.queue[L.i];
  const { item, type } = ex;
  L.answered = false;
  const box = $('ex');
  box.dataset.type = type;
  const speakBtn = (text, big) => (canSpeak() ? `<button class="speak press${big ? ' big-sp' : ''}" type="button" data-say="${esc(text)}" aria-label="Escuchar">${I('volume-2')}</button>` : '');
  const slowBtn = (text) => (canSpeak() ? `<button class="speak slow press" type="button" data-say="${esc(text)}" data-slow="1" aria-label="Escuchar despacio">${I('turtle')}</button>` : '');
  let html = `<div class="ex-k">${KIND_TXT[type]}${L.mode === 'placement' ? ` · ${LEVELS[ex.li].id}` : ''}</div>`;
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
    Sound.ok();
    L.ok++; L.combo++; L.best = Math.max(L.best, L.combo);
    if (L.mode !== 'placement') { const g = E.xpFor(L.combo); L.xp += g; xpPop(g, btn || $('check')); if (first) E.srs(S, ex.item.key, true, t); }
    if (ex.type === 'listen') S.stats.listen++;
    if (ex.type === 'build') S.stats.build++;
    if (ex.type === 'type') S.stats.type++;
  } else {
    Sound.ko();
    L.combo = 0;
    if (first) L.firstWrong.add(L.i);
    if (L.mode !== 'placement') { E.srs(S, ex.item.key, false, t); L.queue.push({ ...ex, retried: true }); }
  }
  if (!ok || ex.type !== 'listen') setTimeout(() => say(ex.type === 'build' ? ex.item.exEn : ex.item.en), 260);
  setProgress();
  showSheet(ok, ex);
}
function xpPop(n, anchor) {
  if (reduce.matches || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const p = document.createElement('div'); p.className = 'xp-pop'; p.setAttribute('aria-hidden', 'true'); p.textContent = `+${n} XP`;
  p.style.left = (r.left + r.width / 2 - 34) + 'px'; p.style.top = (r.top - 8) + 'px';
  document.body.appendChild(p); setTimeout(() => p.remove(), 950);
}
const PRAISE = ['¡Bien!', '¡Exacto!', '¡Perfecto!', '¡Eso es!', '¡Exprimido!'];
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
  S.stats.bestCombo = Math.max(S.stats.bestCombo, L.best);
  if (L.mode === 'unit') S.daily.labs++;
  const nb = E.award(S, t, L.mode === 'review' ? ['review'] : [], { hour: new Date().getHours() });
  persist();
  $('d-xp').textContent = '+' + L.xp;
  $('d-acc').textContent = acc + ' %';
  $('d-time').textContent = clock(Math.round((Date.now() - L.start) / 1000));
  const trophy = $('trophy');
  if (L.mode === 'unit') {
    const st = E.unitState(S, L.unit.id), boss = L.unit.boss;
    const won = acc >= E.USER_FLAG;
    trophy.className = 'trophy' + (won ? '' : ' meh');
    trophy.innerHTML = I(boss && won ? 'skull' : won ? 'trophy' : 'refresh-cw');
    $('d-h').textContent = res.newRoot ? 'Root flag conseguida' : res.newUser ? (boss ? 'Jefe derrotado' : 'User flag conseguida') : won ? 'Laboratorio repasado' : 'Casi: vuelve a intentarlo';
    $('d-p').textContent = won ? `«${L.unit.es}» · ${L.unit.en}${acc < 100 ? `. Hazlo sin fallos para la root flag (+${boss ? E.XP_ROOT_BOSS : E.XP_ROOT} XP).` : ''}` : `Necesitas un ${E.USER_FLAG} % de acierto a la primera para la user flag.`;
    $('d-flags').innerHTML = flagHtml(st, true);
    if (res.newRoot) Sound.root(); else if (res.newUser) Sound.flag();
  } else {
    trophy.className = 'trophy'; trophy.innerHTML = I('refresh-cw');
    $('d-h').textContent = 'Repaso completado';
    $('d-p').textContent = 'Las expresiones acertadas vuelven más tarde; las falladas, mañana.';
    $('d-flags').innerHTML = '';
    Sound.flag();
  }
  if (nb.length) setTimeout(Sound.badge, 700);
  $('d-badges').innerHTML = badgesHtml(nb);
  const nu = E.nextUnit(S);
  $('d-next').hidden = L.mode !== 'unit';
  $('d-next').onclick = () => startUnit(nu.id);
  renderChrome();
  show('done');
}
function finishPlacement() {
  const t = today();
  const { reached, open } = E.placementLevel(L.results);
  S.unlocked = Math.max(S.unlocked || 0, open);
  const nb = E.award(S, t, ['placement'], { hour: new Date().getHours() });
  persist();
  $('trophy').className = 'trophy'; $('trophy').innerHTML = I('gauge');
  $('d-xp').textContent = '+0';
  $('d-acc').textContent = Math.round((L.results.filter((r) => r.ok).length / L.results.length) * 100) + ' %';
  $('d-time').textContent = clock(Math.round((Date.now() - L.start) / 1000));
  $('d-h').textContent = `Tu punto de partida: ${LEVELS[open].id}`;
  $('d-p').textContent = reached ? `Dominas hasta ${LEVELS[reached - 1].id}. Hemos abierto el nivel ${LEVELS[open].id} · ${LEVELS[open].name}.` : 'Empezamos desde A0. En unas pocas lecciones notarás el avance.';
  $('d-flags').innerHTML = '';
  $('d-badges').innerHTML = badgesHtml(nb);
  Sound.flag();
  viewLevel = open;
  $('d-next').hidden = false;
  $('d-next').onclick = () => startUnit(E.contentOf(open)[0].id);
  renderChrome();
  show('done');
}

/* ═══ Diálogos: foco atrapado, Escape y foco devuelto ═══ */
let lastFocus = null;
function openDialog(id) {
  closeMore();
  lastFocus = document.activeElement;
  const w = $(id); w.hidden = false;
  const first = w.querySelector('#s-input') || w.querySelector('[role="tab"][aria-selected="true"]') || w.querySelector('button');
  if (first) first.focus(); // en el mismo instante: una tecla pulsada justo al abrir no se pierde
}
function closeDialog(id) { const w = $(id); if (w.hidden) return; w.hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
function closeDialogs() { ['search-dlg', 'help-dlg'].forEach((id) => { $(id).hidden = true; }); }
document.querySelectorAll('.dlg-wrap').forEach((w) => {
  w.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDialog(w.id); });
  w.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDialog(w.id); return; }
    if (e.key !== 'Tab') return;
    const f = [...w.querySelectorAll('button:not([disabled]),[href],input,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
});

/* Búsqueda */
let sSel = 0, sList = [];
function renderSearch() {
  const q = $('s-input').value;
  const r = E.search(q);
  sList = [];
  let html = '';
  if (q.trim().length < 2) {
    const quick = [['home', 'house', 'Inicio'], ['labs', 'flask-conical', 'Laboratorios'], ['review', 'refresh-cw', 'Repaso'], ['progress', 'chart-column', 'Progreso'], ['badges', 'award', 'Insignias'], ['placement', 'gauge', 'Prueba de nivel']];
    html += '<div class="s-group">Ir a</div>' + quick.map(([g, ic, t]) => { sList.push({ go: g }); return `<button type="button" class="s-item" role="option" id="sr-${sList.length - 1}">${I(ic)}<span><b>${t}</b></span></button>`; }).join('');
  } else {
    if (r.units.length) html += '<div class="s-group">Laboratorios</div>' + r.units.map((u) => { sList.push({ unit: u.id }); const ok = E.canPlay(S, u); return `<button type="button" class="s-item" role="option" id="sr-${sList.length - 1}">${I(u.boss ? 'skull' : 'flask-conical')}<span><b>${esc(u.es)}</b><small>${u.level} · ${TIERS[u.tier].t} · ${ok ? esc(u.en) : 'bloqueado'}</small></span></button>`; }).join('');
    if (r.items.length) html += '<div class="s-group">Expresiones</div>' + r.items.map((it) => { sList.push({ unit: it.unit, item: it }); const u = E.UNIT_BY_ID[it.unit]; return `<button type="button" class="s-item" role="option" id="sr-${sList.length - 1}">${I('book-open')}<span><b lang="en">${esc(it.en)}</b><small>${esc(it.es)} · ${u.level} · ${esc(u.es)}</small></span></button>`; }).join('');
    if (!sList.length) html = `<div class="s-empty">Nada para «${esc(q)}». Prueba en inglés o en español.</div>`;
  }
  $('s-results').innerHTML = html;
  sSel = 0; markSel();
  $('s-results').querySelectorAll('.s-item').forEach((b, i) => { b.addEventListener('click', () => pickSearch(i)); b.addEventListener('mousemove', () => { sSel = i; markSel(); }); });
}
function markSel() {
  $('s-results').querySelectorAll('.s-item').forEach((b, i) => b.setAttribute('aria-selected', i === sSel ? 'true' : 'false'));
  $('s-input').setAttribute('aria-activedescendant', sList.length ? 'sr-' + sSel : '');
  const el = $('sr-' + sSel); if (el) el.scrollIntoView({ block: 'nearest' });
}
function pickSearch(i) {
  const r = sList[i]; if (!r) return;
  closeDialog('search-dlg');
  if (r.go) return go(r.go);
  const u = E.UNIT_BY_ID[r.unit];
  if (r.item) say(r.item.en);
  viewLevel = u.li; go('labs');
  setTimeout(() => { const b = document.querySelector(`.lab[data-unit="${u.id}"]`); if (b) { b.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' }); b.focus({ preventScroll: true }); } }, 60);
}
$('s-input').addEventListener('input', renderSearch);
$('s-input').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sSel = Math.min(sList.length - 1, sSel + 1); markSel(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); sSel = Math.max(0, sSel - 1); markSel(); }
  if (e.key === 'Enter') { e.preventDefault(); pickSearch(sSel); }
});
function openSearch() { $('s-input').value = ''; renderSearch(); openDialog('search-dlg'); }

/* Ayuda: el método se genera desde las constantes del motor */
const ECO = [
  ['LemonByte', 'Este laboratorio de inglés', null, 'https://github.com/heindall92/lemonbyte', true],
  ['Rosetta Multinorma', '15 normas y leyes sobre 152 controles', 'https://heindall92.github.io/rosetta_multinorma/', 'https://github.com/heindall92/rosetta_multinorma'],
  ['CTEM-Nexus', 'Exposición y rutas de ataque', 'https://heindall92.github.io/ctem-nexus/', 'https://github.com/heindall92/ctem-nexus'],
  ['KAIROS', 'Continuidad: BIA, BCP y DRP', 'https://heindall92.github.io/kairos/dist/index.html', 'https://github.com/heindall92/kairos'],
  ['ENS Compliance Studio', 'Las 73 medidas del ENS', 'https://heindall92.github.io/grc_ens_compliance_studio/app/dist/ens-compliance-studio.html', 'https://github.com/heindall92/grc_ens_compliance_studio'],
  ['ENS AD Auditor', 'Active Directory frente al ENS', 'https://heindall92.github.io/ens_ad-auditor/', 'https://github.com/heindall92/ens_ad-auditor'],
  ['ARGOS', 'Laboratorio de auditoría GRC', 'https://heindall92.github.io/argos-grc/', 'https://github.com/heindall92/argos-grc'],
  ['MCP-Shield', 'Configuraciones MCP de asistentes de IA', 'https://heindall92.github.io/mcp-shield/', 'https://github.com/heindall92/mcp-shield'],
  ['Norvik', 'Gobernanza de seguridad (escritorio)', null, 'https://github.com/heindall92/Norvik_Gobernanza'],
];
function fillHelp() {
  document.querySelectorAll('[data-const="USER_FLAG"]').forEach((e) => { e.textContent = E.USER_FLAG; });
  document.querySelectorAll('[data-const="BOSS_GATE"]').forEach((e) => { e.textContent = Math.round(E.BOSS_GATE * 100); });
  $('hp-metodo').innerHTML = `<h3>Cómo se calcula todo</h3>
    <div class="formula">
      <div><span>Acierto a la primera</span><b>${E.XP_OK} XP</b></div>
      <div><span>Combo (desde el tercer acierto seguido)</span><b>+${E.XP_COMBO} XP</b></div>
      <div><span>Root flag en un lab</span><b>+${E.XP_ROOT} XP</b></div>
      <div><span>Root flag en un jefe final</span><b>+${E.XP_ROOT_BOSS} XP</b></div>
      <div><span>User flag</span><b>≥ ${E.USER_FLAG} % a la primera</b></div>
      <div><span>Jefe final disponible</span><b>${Math.round(E.BOSS_GATE * 100)} % de los labs del nivel</b></div>
      <div><span>Meta diaria</span><b>${E.DAILY_GOAL} XP</b></div>
    </div>
    <h3>Repaso espaciado</h3>
    <p>Cada expresión vive en una caja. Si la aciertas a la primera sube de caja; si fallas, vuelve a la primera. La caja decide cuándo vuelve:</p>
    <div class="formula">${E.BOXES.slice(1).map((d, i) => `<div><span>Caja ${i + 1}</span><b>${d === 1 ? 'mañana' : `en ${d} días`}</b></div>`).join('')}</div>
    <p class="note">${I('info')}Lo fallado durante un lab se repite al final del mismo lab, pero ya no cuenta para el acierto a la primera.</p>`;
  $('hp-labs').innerHTML = `<h3>Fases por dificultad</h3>
    <div class="tier-list">${Object.entries(TIERS).map(([k, v]) => `<div>${tierTag(k)}<span>${v.d}</span></div>`).join('')}</div>
    <h3>Tipos de laboratorio</h3>
    <div class="tier-list">${Object.entries(KINDS).map(([k, v]) => `<div>${kindTag(k)}<span>${v.d}</span></div>`).join('')}</div>
    <h3>Los seis niveles</h3>
    <div class="formula">${LEVELS.map((Lv, li) => `<div><span>${Lv.id} · ${esc(Lv.name)}</span><b>${E.unitsOf(li).length} labs</b></div>`).join('')}</div>
    <p class="note">${I('flask-conical')}En total, ${UNITS.length} laboratorios y ${E.ITEMS.length} expresiones con su frase de ejemplo. Desde el B1, inglés de IT, ciberseguridad y GRC.</p>`;
  $('eco').innerHTML = ECO.map(([n, d, app, code, self]) => `<div class="eco-item${self ? ' self' : ''}"><div><b>${n}</b><small>${d}</small></div>${app ? `<a href="${app}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}<a href="${code}" target="_blank" rel="noopener noreferrer">Código</a></div>`).join('');
}
const HELP_TABS = ['guia', 'metodo', 'labs', 'atajos', 'glosario', 'acerca'];
function helpTab(name, focus) {
  HELP_TABS.forEach((t) => {
    const on = t === name, b = $('ht-' + t);
    b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('hp-' + t).hidden = !on;
    if (on && focus) b.focus();
  });
}
HELP_TABS.forEach((t, i) => {
  const b = $('ht-' + t);
  b.addEventListener('click', () => helpTab(t));
  b.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); helpTab(HELP_TABS[(i + d + HELP_TABS.length) % HELP_TABS.length], true); }
  });
});
function openHelp(tab = 'guia') { helpTab(tab); openDialog('help-dlg'); }
$('copy-mail').addEventListener('click', async () => {
  const mail = $('mail').textContent;
  let ok = false;
  try { await navigator.clipboard.writeText(mail); ok = true; } catch {
    const r = document.createRange(); r.selectNodeContents($('mail')); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    try { ok = document.execCommand('copy'); } catch { /* */ }
  }
  toast(`${I(ok ? 'check' : 'mail')}${ok ? 'Correo copiado' : 'Correo seleccionado: pulsa Ctrl+C'}`);
});

/* ═══ Lateral, tema, acento y sonido ═══ */
const app = $('app');
const narrow = () => matchMedia('(max-width:1100px)').matches;
function sideState() {
  const open = narrow() ? app.classList.contains('expanded') : !app.classList.contains('collapsed');
  $('toggle-side').setAttribute('aria-expanded', open);
  $('toggle-side').setAttribute('aria-label', open ? 'Contraer la barra lateral' : 'Abrir la barra lateral');
  setTimeout(moveNavPill, 360);
}
function toggleSide() {
  if (narrow()) app.classList.toggle('expanded'); else { app.classList.toggle('collapsed'); pref.set('lemonbyte-side', app.classList.contains('collapsed') ? 'c' : 'o'); }
  sideState();
}
if (pref.get('lemonbyte-side', 'o') === 'c') app.classList.add('collapsed');
$('toggle-side').addEventListener('click', toggleSide);

const themeBtn = $('theme');
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : sysDark.matches);
{ const t = pref.get('lemonbyte-theme', ''); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; }
const themeUI = () => { themeBtn.setAttribute('aria-checked', isDark()); };
/* El tema cambia con un solo fundido: la clase .theme-anim da a todos los elementos la misma transición de
   color durante el cambio y se quita al acabar. Sin View Transitions: no congelan la barra de cristal ni
   duplican la bola del interruptor. */
let themeTimer = 0;
function switchTheme(apply) {
  const root = document.documentElement;
  clearTimeout(themeTimer);
  root.classList.add('theme-anim');
  apply();
  themeUI();
  themeTimer = setTimeout(() => root.classList.remove('theme-anim'), 420); // después de los .35 s más largos
}
themeBtn.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; themeBtn.setAttribute('aria-checked', t === 'dark'); switchTheme(() => { document.documentElement.dataset.theme = t; pref.set('lemonbyte-theme', t); }); });
if (sysDark.addEventListener) sysDark.addEventListener('change', () => switchTheme(() => {}));

const ACCENTS = [['azul', 'Azul eléctrico', '#3f7bff'], ['rosa', 'Rosa', '#e3478f'], ['solar', 'Solar', '#e79a12'], ['glaciar', 'Glaciar', '#1fb8cc'], ['orquidea', 'Orquídea', '#8a68ff'], ['verde', 'Verde bosque', '#3d9152'], ['rojo', 'Rojo', '#e04848']];
// La misma paleta en el lateral (escritorio) y en el menú «Más» (móvil, donde no hay lateral)
const accDots = ACCENTS.map(([id, n, c]) => `<button type="button" class="press" data-acc="${id}" title="${n}" aria-label="${n}" aria-pressed="false" style="background:${c}"></button>`).join('');
$('acc-dots').innerHTML = accDots;
$('acc-dots-m').innerHTML = accDots;
function setAccent(a) {
  if (a === 'azul') delete document.documentElement.dataset.accent; else document.documentElement.dataset.accent = a;
  document.querySelectorAll('[data-acc]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.acc === a));
  pref.set('lemonbyte-accent', a);
}
['acc-dots', 'acc-dots-m'].forEach((id) => $(id).addEventListener('click', (e) => { const b = e.target.closest('[data-acc]'); if (b) setAccent(b.dataset.acc); }));
{ const a = pref.get('lemonbyte-accent', 'azul'); setAccent(ACCENTS.some((x) => x[0] === a) ? a : 'azul'); }

const soundBtn = $('sound');
const soundUI = () => { soundBtn.setAttribute('aria-pressed', Sound.on); soundBtn.setAttribute('aria-label', Sound.on ? 'Sonido activado' : 'Sonido desactivado'); soundBtn.innerHTML = I(Sound.on ? 'volume-2' : 'volume-x'); };
soundBtn.addEventListener('click', () => { Sound.set(!Sound.on); soundUI(); if (Sound.on) Sound.ok(); toast(`${I(Sound.on ? 'volume-2' : 'volume-x')}${Sound.on ? 'Sonidos activados' : 'Sonidos desactivados'}`); });

/* Menú «Más» (móvil) */
const moreBtn = $('more-btn'), morePop = $('more-pop');
function closeMore() { if (!morePop.hidden) { morePop.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); } }
moreBtn.addEventListener('click', () => { const o = morePop.hidden; morePop.hidden = !o; moreBtn.setAttribute('aria-expanded', o); if (o) morePop.querySelector('button').focus(); });
document.addEventListener('pointerdown', (e) => { if (!morePop.hidden && !e.target.closest('#more-pop, #more-btn')) closeMore(); });

/* ═══ Eventos globales ═══ */
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const h = e.target.closest('[data-help]');
  if (h) { closeMore(); openHelp(h.dataset.help); return; }
  const u = e.target.closest('[data-unit]');
  if (u && !u.disabled) { startUnit(u.dataset.unit); return; }
  const st = e.target.closest('#route .st');
  if (st) { viewLevel = +st.dataset.level; renderLabs(); const nb = document.querySelector(`#route .st[data-level="${viewLevel}"]`); if (nb) nb.focus(); }
});
$('route').addEventListener('keydown', (e) => {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  viewLevel = (viewLevel + d + LEVELS.length) % LEVELS.length; renderLabs();
  document.querySelector(`#route .st[data-level="${viewLevel}"]`).focus();
});
$('continue').addEventListener('click', () => startUnit(E.nextUnit(S).id));
$('review').addEventListener('click', startReview);
$('open-search').addEventListener('click', openSearch);
$('open-help').addEventListener('click', () => openHelp());
$('s-next').addEventListener('click', next);
$('quit').addEventListener('click', () => { hush(); go('labs'); });
$('d-home').addEventListener('click', () => { if (L && L.unit) viewLevel = L.unit.li; go('labs'); });
$('kbd-k').textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
document.addEventListener('keydown', (e) => {
  if (closeIntro) { if (e.key === 'Escape') { e.preventDefault(); closeIntro(); } else if (e.key === 'Tab') { e.preventDefault(); $('intro-skip').focus(); } return; }
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('search-dlg').hidden) openSearch(); else closeDialog('search-dlg'); return; }
  if (!$('search-dlg').hidden || !$('help-dlg').hidden) return;
  if (e.key === 'Escape') { closeMore(); if (view === 'lesson') { hush(); go('labs'); } return; }
  if (view === 'lesson' && L) {
    if ($('sheet').classList.contains('show')) { if (e.key === 'Enter' && document.activeElement !== $('s-next')) { e.preventDefault(); next(); } return; }
    if (/^[1-4]$/.test(e.key) && !typing) { const b = $('ex').querySelectorAll('.opt')[+e.key - 1]; if (b && !b.disabled) b.click(); }
    return;
  }
  if (typing) return;
  if (e.key === '?') { e.preventDefault(); openHelp(); }
  if (e.key === '[') { e.preventDefault(); toggleSide(); }
});
addEventListener('resize', () => { moveNavPill(); });
addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* */ } } });
addEventListener('hashchange', () => { const v = Object.keys(HASH).find((k) => '#' + HASH[k] === location.hash); if (v && view !== 'lesson') { render(v); show(v); } });

/* Ondas de la tarjeta «Siguiente laboratorio»: solo se animan cuando se ven. Si la tarjeta sale de pantalla,
   la vista de inicio se oculta (display:none no interseca) o la pestaña pasa a segundo plano, se pausan. */
{
  const rip = $('ripples');
  let onScreen = true;
  const sync = () => { rip.dataset.paused = String(!onScreen || document.hidden); };
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; sync(); }).observe(rip.parentElement);
  document.addEventListener('visibilitychange', sync);
  sync();
}

/* ═══ Intro ═══
   Vídeo de la marca en la primera visita: horizontal en pantallas apaisadas y vertical en el móvil, WebM (VP9)
   con MP4 (H.264) de respaldo. Se salta con el botón, con un clic, con Escape o al terminar. Si el navegador
   no puede reproducirlo, la intro se cierra sola y la app sigue igual. */
let closeIntro = null;
function playIntro() {
  const w = $('intro'), v = $('intro-video'), bar = $('intro-bar');
  const outside = [$('app'), document.querySelector('.skip'), $('toasts'), $('search-dlg'), $('help-dlg')].filter(Boolean);
  const back = document.activeElement;
  w.hidden = false; w.classList.remove('out');
  outside.forEach((el) => { el.inert = true; });
  document.documentElement.classList.add('intro-on');
  try { localStorage.setItem('lemonbyte-intro', '1'); } catch { /* */ }
  const o = matchMedia('(max-aspect-ratio: 1/1)').matches ? 'v' : 'h';
  v.innerHTML = `<source src="intro/lemonbyte-intro-${o}.webm" type="video/webm"><source src="intro/lemonbyte-intro-${o}.mp4" type="video/mp4">`;
  let timer = 0;
  closeIntro = () => {
    if (!closeIntro) return;
    closeIntro = null; clearTimeout(timer);
    w.classList.add('out');
    outside.forEach((el) => { el.inert = false; });
    document.documentElement.classList.remove('intro-on');
    if (back && back !== document.body && document.contains(back)) back.focus({ preventScroll: true });
    setTimeout(() => { if (closeIntro) return; w.hidden = true; v.pause(); v.innerHTML = ''; v.load(); bar.style.setProperty('--p', 0); }, 520);
  };
  v.ontimeupdate = () => bar.style.setProperty('--p', v.duration ? v.currentTime / v.duration : 0);
  v.onended = () => { timer = setTimeout(() => closeIntro && closeIntro(), 700); }; // el logo respira un instante
  v.lastElementChild.onerror = () => closeIntro && closeIntro(); // ningún formato se pudo cargar
  timer = setTimeout(() => closeIntro && closeIntro(), 15000);
  $('intro-skip').focus({ preventScroll: true, focusVisible: false }); // el anillo sale si se navega con teclado
  v.load();
  const p = v.play();
  if (p && p.catch) p.catch(() => closeIntro && closeIntro());
}
$('intro').addEventListener('click', () => closeIntro && closeIntro());
$('replay-intro').addEventListener('click', () => { closeDialog('help-dlg'); playIntro(); });

/* Gancho solo para las pruebas automáticas (?test): ejercicio en curso y estado. */
if (/[?&]test\b/.test(location.search)) window.__LEMONBYTE__ = { E, current: () => (L ? L.queue[L.i] : null), state: () => S, sound: Sound };

/* Arranque */
loadLocal();
themeUI();
soundUI();
setSync(false);
fillHelp();
sideState();
{
  const start = Object.keys(HASH).find((k) => '#' + HASH[k] === location.hash) || 'home';
  if (location.hash === '#repaso' || location.hash === '#prueba') history.replaceState(null, '', '#inicio');
  render(start); show(start, { focus: false });
}
if (!$('intro').hidden) playIntro();
connect();
})();
