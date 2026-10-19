/* HERMES · motor: lógica pura, sin DOM. La usa la interfaz y la prueban tests/engine.test.js.
 * Todo lo que depende de la fecha o del azar recibe el reloj (`now`) o el generador (`rng`) como parámetro. */
(function (root) {
'use strict';

const BOXES = [0, 1, 3, 7, 14, 30]; // días hasta el siguiente repaso según la caja (Leitner)
const USER_FLAG = 70;               // % de acierto a la primera para la user flag
const DAILY_GOAL = 50;              // XP de la meta diaria
const XP_OK = 10, XP_COMBO = 2, XP_ROOT = 20;

function build(LEVELS) {
  const UNITS = LEVELS.flatMap((L, li) => L.units.map((u, ui) => ({ ...u, level: L.id, li, ui })));
  const ITEMS = UNITS.flatMap((u) => u.items.map((it, k) => ({ key: `${u.id}:${k}`, en: it[0], es: it[1], exEn: it[2], exEs: it[3], unit: u.id, level: u.level })));
  const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((x) => [x.key, x]));
  const BADGES = [
    { id: 'first-flag', icon: 'flag', t: 'Primera flag', d: 'Consigue tu primera user flag.' },
    { id: 'perfect', icon: 'target', t: 'Sin fallos', d: 'Termina una lección sin fallar ninguna.' },
    { id: 'streak-3', icon: 'flame', t: 'Racha de 3 días', d: 'Practica tres días seguidos.' },
    { id: 'streak-7', icon: 'flame', t: 'Racha de 7 días', d: 'Una semana entera sin parar.' },
    { id: 'streak-30', icon: 'flame', t: 'Racha de 30 días', d: 'Un mes seguido. Esto ya es hábito.' },
    { id: 'xp-500', icon: 'zap', t: '500 XP', d: 'Suma 500 puntos de experiencia.' },
    { id: 'xp-2000', icon: 'zap', t: '2000 XP', d: 'Suma 2000 puntos de experiencia.' },
    { id: 'ear', icon: 'headphones', t: 'Oído fino', d: 'Acierta 25 ejercicios de escucha.' },
    { id: 'builder', icon: 'blocks', t: 'Constructor de frases', d: 'Ordena bien 25 frases.' },
    { id: 'typist', icon: 'keyboard', t: 'Teclado bilingüe', d: 'Escribe bien 25 respuestas.' },
    { id: 'vocab-50', icon: 'book-open', t: '50 expresiones dominadas', d: 'Lleva 50 expresiones a la caja 4 del repaso.' },
    { id: 'review', icon: 'refresh-cw', t: 'Repaso al día', d: 'Completa una sesión de repaso.' },
    { id: 'placement', icon: 'gauge', t: 'Nivel medido', d: 'Haz la prueba de nivel.' },
    { id: 'pentester', icon: 'shield-check', t: 'Pentester bilingüe', d: 'Root flag en «El informe» y en «Hablar con el cliente».' },
    { id: 'root-level', icon: 'crown', t: 'Root total', d: 'Todas las root flags de un nivel.' },
    ...LEVELS.map((L) => ({ id: 'level-' + L.id, icon: 'graduation-cap', t: 'Nivel ' + L.id + ' superado', d: 'User flag en todas las máquinas de «' + L.name + '».' })),
  ];

  /* ── Fechas (día local, AAAA-MM-DD) ── */
  const dayOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dayOf(d); };

  /* ── Estado ── */
  const fresh = () => ({ v: 1, updatedAt: 0, xp: 0, daily: { day: '', xp: 0 }, streak: { count: 0, last: '' }, items: {}, units: {}, badges: {}, unlocked: 0, stats: { listen: 0, build: 0, type: 0, lessons: 0 } });
  /** Acepta lo que venga de almacenamiento o de la cuenta y devuelve un estado válido (lo desconocido se descarta). */
  function sanitize(raw) {
    const s = fresh();
    if (!raw || typeof raw !== 'object') return s;
    const num = (v, max = 1e9) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0);
    const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    s.updatedAt = num(raw.updatedAt, 8.64e15);
    s.xp = num(raw.xp);
    if (raw.daily && isDay(raw.daily.day)) s.daily = { day: raw.daily.day, xp: num(raw.daily.xp) };
    if (raw.streak && isDay(raw.streak.last)) s.streak = { count: num(raw.streak.count, 100000), last: raw.streak.last };
    for (const [k, v] of Object.entries(raw.items || {})) if (ITEM_BY_KEY[k] && v && isDay(v.due)) s.items[k] = { box: Math.min(5, num(v.box)), due: v.due };
    for (const u of UNITS) { const v = raw.units && raw.units[u.id]; if (v && typeof v === 'object') s.units[u.id] = { user: v.user === true, root: v.root === true, best: Math.min(100, num(v.best)) }; }
    for (const b of BADGES) { const v = raw.badges && raw.badges[b.id]; if (isDay(v)) s.badges[b.id] = v; }
    s.unlocked = Math.min(num(raw.unlocked), LEVELS.length - 1);
    for (const k of Object.keys(s.stats)) s.stats[k] = num(raw.stats && raw.stats[k]);
    return s;
  }

  /* ── Progreso ── */
  const unitState = (S, id) => S.units[id] || { user: false, root: false, best: 0 };
  const levelDone = (S, li) => LEVELS[li].units.every((u) => unitState(S, u.id).user);
  function maxOpenLevel(S) {
    let m = S.unlocked || 0;
    for (let i = 0; i < LEVELS.length - 1; i++) if (levelDone(S, i)) m = Math.max(m, i + 1);
    return Math.min(m, LEVELS.length - 1);
  }
  const dueItems = (S, today) => Object.entries(S.items).filter(([k, v]) => ITEM_BY_KEY[k] && v.due <= today).map(([k]) => k);
  function nextUnit(S) {
    const open = maxOpenLevel(S);
    for (let li = 0; li <= open; li++) for (const u of LEVELS[li].units) if (!unitState(S, u.id).user) return UNITS.find((x) => x.id === u.id);
    for (let li = 0; li <= open; li++) for (const u of LEVELS[li].units) if (!unitState(S, u.id).root) return UNITS.find((x) => x.id === u.id);
    return UNITS.find((x) => x.id === LEVELS[open].units[0].id);
  }
  function grantXp(S, n, today) {
    S.xp += n;
    if (S.daily.day !== today) S.daily = { day: today, xp: 0 };
    S.daily.xp += n;
  }
  function touchStreak(S, today) {
    if (S.streak.last === today) return;
    S.streak.count = S.streak.last === addDays(today, -1) ? S.streak.count + 1 : 1;
    S.streak.last = today;
  }
  /** Racha visible: se pierde si ayer no se practicó. */
  const liveStreak = (S, today) => (S.streak.last === today || S.streak.last === addDays(today, -1) ? S.streak.count : 0);
  function srs(S, key, ok, today) {
    const it = S.items[key] || { box: 0, due: today };
    it.box = ok ? Math.min(5, it.box + 1) : 1;
    it.due = addDays(today, BOXES[it.box]);
    S.items[key] = it;
  }
  /** Resultado de una lección: actualiza la unidad y devuelve qué flags se han conseguido. */
  function scoreUnit(S, unitId, accuracy) {
    const before = unitState(S, unitId);
    const st = { ...before };
    if (accuracy >= USER_FLAG) st.user = true;
    if (accuracy === 100) st.root = true;
    st.best = Math.max(st.best || 0, accuracy);
    S.units[unitId] = st;
    return { newUser: st.user && !before.user, newRoot: st.root && !before.root, bonus: accuracy === 100 ? XP_ROOT : 0 };
  }
  /** Concede las insignias que se cumplen y devuelve las nuevas. */
  function award(S, today, extra = []) {
    const got = [];
    const give = (id) => { if (!S.badges[id]) { S.badges[id] = today; got.push(BADGES.find((b) => b.id === id)); } };
    const flags = Object.values(S.units);
    if (flags.some((f) => f.user)) give('first-flag');
    if (flags.some((f) => f.root)) give('perfect');
    if (S.streak.count >= 3) give('streak-3');
    if (S.streak.count >= 7) give('streak-7');
    if (S.streak.count >= 30) give('streak-30');
    if (S.xp >= 500) give('xp-500');
    if (S.xp >= 2000) give('xp-2000');
    if (S.stats.listen >= 25) give('ear');
    if (S.stats.build >= 25) give('builder');
    if (S.stats.type >= 25) give('typist');
    if (Object.values(S.items).filter((i) => i.box >= 4).length >= 50) give('vocab-50');
    if (unitState(S, 'b2-1').root && unitState(S, 'b2-2').root) give('pentester');
    LEVELS.forEach((L, li) => {
      if (levelDone(S, li)) give('level-' + L.id);
      if (L.units.every((u) => unitState(S, u.id).root)) give('root-level');
    });
    extra.forEach(give);
    return got;
  }
  /** Prueba de nivel: se supera un nivel acertando sus dos preguntas; se para en el primero que falla. */
  function placementLevel(results) {
    let reached = 0;
    for (let li = 0; li < LEVELS.length; li++) {
      const r = results.filter((x) => x.li === li);
      if (r.length === 2 && r.every((x) => x.ok)) reached = li + 1; else break;
    }
    return { reached, open: Math.min(reached, LEVELS.length - 1) };
  }

  /* ── Texto ── */
  const norm = (s) => String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function gapOf(item) {
    const m = item.exEn.match(new RegExp(`(^|[^A-Za-z'])(${reEsc(item.en)})(?=$|[^A-Za-z'])`, 'i'));
    if (!m) return null;
    const start = m.index + m[1].length;
    return { before: item.exEn.slice(0, start), word: m[2], after: item.exEn.slice(start + m[2].length) };
  }

  /* ── Ejercicios ── */
  function shuffle(a, rng = Math.random) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function distractors(item, field, n = 3, rng = Math.random) {
    const out = [], seen = new Set([norm(item[field])]);
    for (const x of shuffle(ITEMS.filter((x) => x.key !== item.key && x.level === item.level), rng)) {
      const v = norm(x[field]);
      if (!seen.has(v)) { seen.add(v); out.push(x[field]); }
      if (out.length === n) break;
    }
    return out;
  }
  /** Ajusta el tipo si el ítem no lo admite (sin audio, sin hueco, frase larga…). */
  function makeEx(item, type, canSpeak = true) {
    if (type === 'listen' && !canSpeak) type = 'meaning';
    if (type === 'gap' && !gapOf(item)) type = 'reverse';
    if (type === 'build' && item.exEn.split(' ').length > 9) type = 'gap';
    if (type === 'type' && item.en.split(' ').length > 3) type = 'reverse';
    const correct = { meaning: item.es, build: item.exEn }[type] ?? item.en;
    return { item, type, correct };
  }
  function lessonPlan(unitId, { rng = Math.random, canSpeak = true } = {}) {
    const items = shuffle(ITEMS.filter((x) => x.unit === unitId), rng);
    const types = ['meaning', 'listen', 'reverse', 'gap', 'build', 'meaning', 'type', 'gap', 'build', 'reverse'];
    return types.map((t, i) => makeEx(items[i % items.length], t, canSpeak));
  }
  function reviewPlan(keys, { rng = Math.random, canSpeak = true } = {}) {
    const types = ['reverse', 'gap', 'listen', 'type', 'build', 'meaning'];
    return shuffle(keys, rng).slice(0, 12).map((k, i) => makeEx(ITEM_BY_KEY[k], types[i % types.length], canSpeak));
  }
  function placementPlan({ rng = Math.random } = {}) {
    return LEVELS.flatMap((L, li) => shuffle(ITEMS.filter((x) => x.level === L.id), rng).slice(0, 2).map((it) => ({ ...makeEx(it, li < 2 ? 'meaning' : 'gap'), li })));
  }
  /** Opciones de un ejercicio de elección (la correcta y tres distractores del mismo nivel). */
  function optionsFor(ex, rng = Math.random) {
    if (ex.type === 'meaning') return shuffle([ex.item.es, ...distractors(ex.item, 'es', 3, rng)], rng);
    if (['reverse', 'listen', 'gap'].includes(ex.type)) return shuffle([ex.item.en, ...distractors(ex.item, 'en', 3, rng)], rng);
    return null;
  }
  /** Fichas para ordenar: las palabras de la frase más dos señuelos de otras frases del nivel. */
  function tilesFor(ex, rng = Math.random) {
    const words = ex.item.exEn.split(' ');
    const extra = shuffle(ITEMS.filter((x) => x.level === ex.item.level && x.key !== ex.item.key).flatMap((x) => x.exEn.split(' ')), rng).filter((w) => !words.includes(w)).slice(0, 2);
    return shuffle([...words, ...extra], rng);
  }
  const isCorrect = (ex, value) => norm(value) === norm(ex.correct);
  const xpFor = (combo) => XP_OK + (combo >= 3 ? XP_COMBO : 0);

  return { LEVELS, UNITS, ITEMS, ITEM_BY_KEY, BADGES, BOXES, USER_FLAG, DAILY_GOAL, XP_ROOT,
    dayOf, addDays, fresh, sanitize, unitState, levelDone, maxOpenLevel, dueItems, nextUnit, grantXp, touchStreak, liveStreak,
    srs, scoreUnit, award, placementLevel, norm, gapOf, shuffle, distractors, makeEx, lessonPlan, reviewPlan, placementPlan, optionsFor, tilesFor, isCorrect, xpFor };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { build };
else root.HermesEngine = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
