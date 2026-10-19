/* LemonByte · motor: lógica pura, sin DOM. La usa la interfaz y la prueban tests/engine.test.js.
 * Todo lo que depende de la fecha, la hora o el azar lo recibe como parámetro (`today`, `hour`, `rng`). */
(function (root) {
'use strict';

const BOXES = [0, 1, 3, 7, 14, 30];  // días hasta el siguiente repaso según la caja (Leitner)
const USER_FLAG = 70;                // % de acierto a la primera para la user flag
const BOSS_GATE = 0.75;              // fracción de labs del nivel con user flag para abrir el jefe final
const DAILY_GOAL = 50;               // XP de la meta diaria
const XP_OK = 10, XP_COMBO = 2, XP_ROOT = 20, XP_ROOT_BOSS = 50;
const HISTORY_DAYS = 120;

/** Dificultad dentro de cada nivel: el primer tercio es fácil, el segundo medio, el resto difícil; el jefe, insane. */
const TIERS = {
  facil: { t: 'Fácil', d: 'Para entrar en calor' },
  media: { t: 'Media', d: 'Frases más largas' },
  dificil: { t: 'Difícil', d: 'Vocabulario de trabajo' },
  insane: { t: 'Insane', d: 'Jefe final: todo el nivel mezclado' },
};
/** Tipo de laboratorio: decide qué ejercicios predominan. */
const KINDS = {
  mixto: { t: 'Mixto', icon: 'shuffle', d: 'De todo un poco', plan: ['meaning', 'listen', 'reverse', 'gap', 'build', 'meaning', 'type', 'gap', 'build', 'reverse'] },
  oido: { t: 'Oído', icon: 'headphones', d: 'Sobre todo escuchar', plan: ['listen', 'meaning', 'listen', 'gap', 'listen', 'type', 'listen', 'reverse', 'listen', 'gap'] },
  frases: { t: 'Frases', icon: 'blocks', d: 'Sobre todo ordenar frases', plan: ['build', 'gap', 'build', 'meaning', 'build', 'reverse', 'build', 'gap', 'build', 'type'] },
  escritura: { t: 'Escritura', icon: 'keyboard', d: 'Sobre todo escribir', plan: ['type', 'reverse', 'type', 'gap', 'type', 'meaning', 'type', 'build', 'type', 'reverse'] },
  jefe: { t: 'Jefe final', icon: 'skull', d: '12 retos de todo el nivel', plan: ['gap', 'type', 'build', 'listen', 'reverse', 'gap', 'build', 'type', 'listen', 'reverse', 'gap', 'build'] },
};
const KIND_CYCLE = ['mixto', 'oido', 'frases', 'escritura'];

function build(LEVELS) {
  /* ── Labs: los del contenido más un jefe final por nivel ── */
  const UNITS = [];
  LEVELS.forEach((L, li) => {
    const n = L.units.length;
    L.units.forEach((u, ui) => {
      const tier = ui < Math.ceil(n / 3) ? 'facil' : ui < Math.ceil((2 * n) / 3) ? 'media' : 'dificil';
      UNITS.push({ ...u, level: L.id, li, ui, tier, kind: u.kind || KIND_CYCLE[ui % KIND_CYCLE.length], boss: false });
    });
    UNITS.push({ id: `${L.id.toLowerCase()}-jefe`, es: `Jefe final ${L.id}`, en: `${L.name}: final boss`, items: [], level: L.id, li, ui: n, tier: 'insane', kind: 'jefe', boss: true });
  });
  const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));
  const ITEMS = UNITS.flatMap((u) => u.items.map((it, k) => ({ key: `${u.id}:${k}`, en: it[0], es: it[1], exEn: it[2], exEs: it[3], unit: u.id, level: u.level })));
  const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((x) => [x.key, x]));
  const unitsOf = (li) => UNITS.filter((u) => u.li === li);
  const contentOf = (li) => UNITS.filter((u) => u.li === li && !u.boss);
  const bossOf = (li) => UNITS.find((u) => u.li === li && u.boss);

  const BADGES = [
    { id: 'first-flag', icon: 'flag', t: 'Primera flag', d: 'Consigue tu primera user flag.' },
    { id: 'perfect', icon: 'target', t: 'Sin fallos', d: 'Termina un lab sin fallar ninguna.' },
    { id: 'labs-10', icon: 'flask-conical', t: '10 labs', d: 'User flag en 10 laboratorios.' },
    { id: 'labs-50', icon: 'flask-conical', t: '50 labs', d: 'User flag en 50 laboratorios.' },
    { id: 'labs-100', icon: 'citrus', t: 'Exprimido entero', d: 'User flag en los 100 laboratorios.' },
    { id: 'boss', icon: 'skull', t: 'Jefe derrotado', d: 'Supera tu primer jefe final.' },
    { id: 'root-level', icon: 'crown', t: 'Root total', d: 'Todas las root flags de un nivel, jefe incluido.' },
    { id: 'streak-3', icon: 'flame', t: 'Racha de 3 días', d: 'Practica tres días seguidos.' },
    { id: 'streak-7', icon: 'flame', t: 'Racha de 7 días', d: 'Una semana entera sin parar.' },
    { id: 'streak-30', icon: 'flame', t: 'Racha de 30 días', d: 'Un mes seguido. Esto ya es hábito.' },
    { id: 'xp-500', icon: 'zap', t: '500 XP', d: 'Suma 500 puntos de experiencia.' },
    { id: 'xp-2000', icon: 'zap', t: '2000 XP', d: 'Suma 2000 puntos de experiencia.' },
    { id: 'combo-10', icon: 'rocket', t: 'Imparable', d: 'Encadena 10 aciertos seguidos.' },
    { id: 'triple', icon: 'layers', t: 'Triplete', d: 'Termina 3 labs en un mismo día.' },
    { id: 'early', icon: 'sunrise', t: 'Madrugador', d: 'Termina un lab antes de las 8:00.' },
    { id: 'night', icon: 'moon-star', t: 'Noctámbulo', d: 'Termina un lab después de las 23:00.' },
    { id: 'ear', icon: 'headphones', t: 'Oído fino', d: 'Acierta 25 ejercicios de escucha.' },
    { id: 'builder', icon: 'blocks', t: 'Constructor de frases', d: 'Ordena bien 25 frases.' },
    { id: 'typist', icon: 'keyboard', t: 'Teclado bilingüe', d: 'Escribe bien 25 respuestas.' },
    { id: 'vocab-50', icon: 'book-open', t: '50 expresiones dominadas', d: 'Lleva 50 expresiones a la caja 4 del repaso.' },
    { id: 'review', icon: 'refresh-cw', t: 'Repaso al día', d: 'Completa una sesión de repaso.' },
    { id: 'placement', icon: 'gauge', t: 'Nivel medido', d: 'Haz la prueba de nivel.' },
    { id: 'pentester', icon: 'shield-check', t: 'Pentester bilingüe', d: 'Root flag en «El informe», «Hablar con el cliente» y «Redactar hallazgos».' },
    ...LEVELS.map((L) => ({ id: 'level-' + L.id, icon: 'graduation-cap', t: 'Nivel ' + L.id + ' superado', d: 'Derrota al jefe final de «' + L.name + '».' })),
  ];

  /* ── Fechas (día local, AAAA-MM-DD) ── */
  const dayOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dayOf(d); };
  const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  /* ── Estado ── */
  const fresh = () => ({ v: 2, updatedAt: 0, xp: 0, daily: { day: '', xp: 0, labs: 0 }, streak: { count: 0, last: '' }, history: {}, items: {}, units: {}, badges: {}, unlocked: 0, stats: { listen: 0, build: 0, type: 0, lessons: 0, bestCombo: 0 } });
  /** Acepta lo que venga del almacenamiento o de la cuenta y devuelve un estado válido (lo desconocido se descarta). */
  function sanitize(raw) {
    const s = fresh();
    if (!raw || typeof raw !== 'object') return s;
    const num = (v, max = 1e9) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0);
    s.updatedAt = num(raw.updatedAt, 8.64e15);
    s.xp = num(raw.xp);
    if (raw.daily && isDay(raw.daily.day)) s.daily = { day: raw.daily.day, xp: num(raw.daily.xp), labs: num(raw.daily.labs, 1000) };
    if (raw.streak && isDay(raw.streak.last)) s.streak = { count: num(raw.streak.count, 100000), last: raw.streak.last };
    const days = Object.keys(raw.history && typeof raw.history === 'object' ? raw.history : {}).filter(isDay).sort().slice(-HISTORY_DAYS);
    for (const d of days) s.history[d] = num(raw.history[d], 100000);
    for (const [k, v] of Object.entries(raw.items || {})) if (ITEM_BY_KEY[k] && v && isDay(v.due)) s.items[k] = { box: Math.min(5, num(v.box)), due: v.due };
    for (const u of UNITS) { const v = raw.units && raw.units[u.id]; if (v && typeof v === 'object') s.units[u.id] = { user: v.user === true, root: v.root === true, best: Math.min(100, num(v.best)) }; }
    for (const b of BADGES) { const v = raw.badges && raw.badges[b.id]; if (isDay(v)) s.badges[b.id] = v; }
    s.unlocked = Math.min(num(raw.unlocked), LEVELS.length - 1);
    for (const k of Object.keys(s.stats)) s.stats[k] = num(raw.stats && raw.stats[k]);
    return s;
  }

  /* ── Progreso y desbloqueo ── */
  const unitState = (S, id) => S.units[id] || { user: false, root: false, best: 0 };
  const userCount = (S, list) => list.filter((u) => unitState(S, u.id).user).length;
  /** Nivel superado: jefe final con user flag. */
  const levelDone = (S, li) => unitState(S, bossOf(li).id).user;
  const bossNeed = (li) => Math.ceil(contentOf(li).length * BOSS_GATE);
  const bossOpen = (S, li) => userCount(S, contentOf(li)) >= bossNeed(li);
  function maxOpenLevel(S) {
    let m = S.unlocked || 0;
    for (let i = 0; i < LEVELS.length - 1; i++) if (levelDone(S, i)) m = Math.max(m, i + 1);
    return Math.min(m, LEVELS.length - 1);
  }
  /** Un lab se puede jugar si su nivel está abierto y, si es el jefe, si se ha ganado el acceso. */
  const canPlay = (S, u) => u.li <= maxOpenLevel(S) && (!u.boss || bossOpen(S, u.li) || u.li < maxOpenLevel(S));
  const dueItems = (S, today) => Object.entries(S.items).filter(([k, v]) => ITEM_BY_KEY[k] && v.due <= today).map(([k]) => k);
  function nextUnit(S) {
    const open = maxOpenLevel(S);
    for (let li = 0; li <= open; li++) {
      const c = contentOf(li).find((u) => !unitState(S, u.id).user);
      if (c && !levelDone(S, li)) return c;
      const b = bossOf(li);
      if (!unitState(S, b.id).user && canPlay(S, b)) return b;
    }
    for (let li = 0; li <= open; li++) { const r = unitsOf(li).find((u) => !unitState(S, u.id).root && canPlay(S, u)); if (r) return r; }
    return contentOf(open)[0];
  }
  function grantXp(S, n, today) {
    S.xp += n;
    if (S.daily.day !== today) S.daily = { day: today, xp: 0, labs: 0 };
    S.daily.xp += n;
    S.history[today] = (S.history[today] || 0) + n;
    const keep = Object.keys(S.history).sort().slice(-HISTORY_DAYS);
    for (const d of Object.keys(S.history)) if (!keep.includes(d)) delete S.history[d];
  }
  function touchStreak(S, today) {
    if (S.streak.last === today) return;
    S.streak.count = S.streak.last === addDays(today, -1) ? S.streak.count + 1 : 1;
    S.streak.last = today;
  }
  const liveStreak = (S, today) => (S.streak.last === today || S.streak.last === addDays(today, -1) ? S.streak.count : 0);
  /** XP de los últimos `n` días, del más antiguo al de hoy. */
  const lastDays = (S, today, n = 14) => Array.from({ length: n }, (_, i) => { const d = addDays(today, i - n + 1); return { day: d, xp: S.history[d] || 0 }; });
  function srs(S, key, ok, today) {
    const it = S.items[key] || { box: 0, due: today };
    it.box = ok ? Math.min(5, it.box + 1) : 1;
    it.due = addDays(today, BOXES[it.box]);
    S.items[key] = it;
  }
  /** Cajas del repaso: cuántas expresiones hay en cada una (0 = sin ver). */
  function boxCounts(S) {
    const c = [0, 0, 0, 0, 0, 0];
    for (const it of ITEMS) c[S.items[it.key] ? S.items[it.key].box : 0]++;
    return c;
  }
  /** Resultado de un lab: actualiza su estado y devuelve qué flags se han conseguido y la bonificación. */
  function scoreUnit(S, unitId, accuracy) {
    const u = UNIT_BY_ID[unitId];
    const before = unitState(S, unitId);
    const st = { ...before };
    if (accuracy >= USER_FLAG) st.user = true;
    if (accuracy === 100) st.root = true;
    st.best = Math.max(st.best || 0, accuracy);
    S.units[unitId] = st;
    return { newUser: st.user && !before.user, newRoot: st.root && !before.root, bonus: accuracy === 100 ? (u && u.boss ? XP_ROOT_BOSS : XP_ROOT) : 0 };
  }
  /** Concede las insignias que se cumplen y devuelve las nuevas. `ctx`: hora del día y mejor combo de la sesión. */
  function award(S, today, extra = [], ctx = {}) {
    const got = [];
    const give = (id) => { if (!S.badges[id]) { S.badges[id] = today; got.push(BADGES.find((b) => b.id === id)); } };
    const flags = Object.values(S.units);
    const users = UNITS.filter((u) => unitState(S, u.id).user).length;
    if (flags.some((f) => f.user)) give('first-flag');
    if (flags.some((f) => f.root)) give('perfect');
    if (users >= 10) give('labs-10');
    if (users >= 50) give('labs-50');
    if (users >= UNITS.length) give('labs-100');
    if (UNITS.some((u) => u.boss && unitState(S, u.id).user)) give('boss');
    if (S.streak.count >= 3) give('streak-3');
    if (S.streak.count >= 7) give('streak-7');
    if (S.streak.count >= 30) give('streak-30');
    if (S.xp >= 500) give('xp-500');
    if (S.xp >= 2000) give('xp-2000');
    if (S.stats.bestCombo >= 10) give('combo-10');
    if (S.daily.day === today && S.daily.labs >= 3) give('triple');
    if (Number.isInteger(ctx.hour) && ctx.hour < 8) give('early');
    if (Number.isInteger(ctx.hour) && ctx.hour >= 23) give('night');
    if (S.stats.listen >= 25) give('ear');
    if (S.stats.build >= 25) give('builder');
    if (S.stats.type >= 25) give('typist');
    if (Object.values(S.items).filter((i) => i.box >= 4).length >= 50) give('vocab-50');
    if (['b2-1', 'b2-2', 'b2-17'].every((id) => unitState(S, id).root)) give('pentester');
    LEVELS.forEach((L, li) => {
      if (levelDone(S, li)) give('level-' + L.id);
      if (unitsOf(li).every((u) => unitState(S, u.id).root)) give('root-level');
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

  /* ── Texto y búsqueda ── */
  const norm = (s) => String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function gapOf(item) {
    const m = item.exEn.match(new RegExp(`(^|[^A-Za-z'])(${reEsc(item.en)})(?=$|[^A-Za-z'])`, 'i'));
    if (!m) return null;
    const start = m.index + m[1].length;
    return { before: item.exEn.slice(0, start), word: m[2], after: item.exEn.slice(start + m[2].length) };
  }
  /** Búsqueda sin acentos en labs (nombre en español e inglés) y expresiones (inglés y español). */
  function search(q, limit = 8) {
    const t = fold(q);
    if (t.length < 2) return { units: [], items: [] };
    const score = (s) => { const f = fold(s); return f.startsWith(t) ? 2 : f.includes(t) ? 1 : 0; };
    const units = UNITS.map((u) => ({ u, s: Math.max(score(u.es), score(u.en)) })).filter((x) => x.s).sort((a, b) => b.s - a.s || a.u.li - b.u.li).slice(0, limit).map((x) => x.u);
    const items = ITEMS.map((it) => ({ it, s: Math.max(score(it.en), score(it.es)) })).filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.it);
    return { units, items };
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
    const u = UNIT_BY_ID[unitId];
    const pool = u.boss ? shuffle(ITEMS.filter((x) => x.level === u.level), rng) : shuffle(ITEMS.filter((x) => x.unit === unitId), rng);
    return KINDS[u.kind].plan.map((t, i) => makeEx(pool[i % pool.length], t, canSpeak));
  }
  function reviewPlan(keys, { rng = Math.random, canSpeak = true } = {}) {
    const types = ['reverse', 'gap', 'listen', 'type', 'build', 'meaning'];
    return shuffle(keys, rng).slice(0, 12).map((k, i) => makeEx(ITEM_BY_KEY[k], types[i % types.length], canSpeak));
  }
  function placementPlan({ rng = Math.random } = {}) {
    return LEVELS.flatMap((L, li) => shuffle(ITEMS.filter((x) => x.level === L.id), rng).slice(0, 2).map((it) => ({ ...makeEx(it, li < 2 ? 'meaning' : 'gap'), li })));
  }
  function optionsFor(ex, rng = Math.random) {
    if (ex.type === 'meaning') return shuffle([ex.item.es, ...distractors(ex.item, 'es', 3, rng)], rng);
    if (['reverse', 'listen', 'gap'].includes(ex.type)) return shuffle([ex.item.en, ...distractors(ex.item, 'en', 3, rng)], rng);
    return null;
  }
  function tilesFor(ex, rng = Math.random) {
    const words = ex.item.exEn.split(' ');
    const extra = shuffle(ITEMS.filter((x) => x.level === ex.item.level && x.key !== ex.item.key).flatMap((x) => x.exEn.split(' ')), rng).filter((w) => !words.includes(w)).slice(0, 2);
    return shuffle([...words, ...extra], rng);
  }
  const isCorrect = (ex, value) => norm(value) === norm(ex.correct);
  const xpFor = (combo) => XP_OK + (combo >= 3 ? XP_COMBO : 0);

  return { LEVELS, UNITS, UNIT_BY_ID, ITEMS, ITEM_BY_KEY, BADGES, TIERS, KINDS, BOXES, USER_FLAG, BOSS_GATE, DAILY_GOAL, XP_OK, XP_COMBO, XP_ROOT, XP_ROOT_BOSS,
    dayOf, addDays, fresh, sanitize, unitState, unitsOf, contentOf, bossOf, bossNeed, bossOpen, canPlay, levelDone, maxOpenLevel, dueItems, nextUnit,
    grantXp, touchStreak, liveStreak, lastDays, srs, boxCounts, scoreUnit, award, placementLevel,
    norm, fold, gapOf, search, shuffle, distractors, makeEx, lessonPlan, reviewPlan, placementPlan, optionsFor, tilesFor, isCorrect, xpFor };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { build };
else root.LemonByteEngine = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
