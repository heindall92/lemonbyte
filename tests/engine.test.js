/* Pruebas del motor y del contenido de HERMES: node --test tests/engine.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS } = require('../app/src/content.js');
const { build } = require('../app/src/engine.js');

const E = build(LEVELS);
const D = '2026-10-19';
// Generador determinista para que las pruebas no dependan del azar
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('contenido: 6 niveles del MCER, 4 unidades por nivel y 8 expresiones por unidad', () => {
  assert.deepEqual(LEVELS.map((L) => L.id), ['A0', 'A1', 'A2', 'B1', 'B2', 'C1']);
  for (const L of LEVELS) {
    assert.equal(L.units.length, 4, L.id);
    for (const u of L.units) assert.equal(u.items.length, 8, u.id);
  }
  assert.equal(E.ITEMS.length, 192);
});

test('contenido: identificadores únicos y cada expresión completa', () => {
  assert.equal(new Set(E.UNITS.map((u) => u.id)).size, 24);
  for (const it of E.ITEMS) {
    for (const f of ['en', 'es', 'exEn', 'exEs']) assert.ok(typeof it[f] === 'string' && it[f].trim(), `${it.key}.${f}`);
    assert.doesNotMatch(it.en + it.exEn, /[<>]/, it.key);
  }
});

test('contenido: no hay dos expresiones con el mismo inglés dentro de un nivel (las opciones serían ambiguas)', () => {
  for (const L of LEVELS) {
    const en = E.ITEMS.filter((x) => x.level === L.id).map((x) => E.norm(x.en));
    assert.equal(new Set(en).size, en.length, L.id);
  }
});

test('contenido: cada ejemplo contiene su expresión como palabra completa (para el ejercicio de hueco)', () => {
  const missing = E.ITEMS.filter((it) => !E.gapOf(it)).map((it) => `${it.key} «${it.en}»`);
  assert.deepEqual(missing, []);
  const g = E.gapOf(E.ITEMS.find((x) => x.en === "o'clock"));
  assert.equal(g.before + g.word + g.after, "It is five o'clock.");
});

test('gapOf no corta dentro de otra palabra', () => {
  assert.equal(E.gapOf({ en: 'one', exEn: 'Someone has one key.' }).before, 'Someone has ');
  assert.equal(E.gapOf({ en: 'ten', exEn: 'Written often.' }), null);
});

test('norm: mayúsculas, apóstrofos tipográficos y puntuación no penalizan', () => {
  assert.equal(E.norm("  I DON’T understand!! "), "i don't understand");
  assert.equal(E.norm('Kind regards, Yoandy'), E.norm('kind regards yoandy'));
});

test('cada tipo de ejercicio tiene su respuesta correcta entre las opciones o las fichas', () => {
  const rng = seeded();
  for (const it of E.ITEMS) {
    for (const t of ['meaning', 'reverse', 'listen', 'gap', 'build', 'type']) {
      const ex = E.makeEx(it, t);
      const opts = E.optionsFor(ex, rng);
      if (opts) {
        assert.equal(opts.length, 4, `${it.key} ${ex.type}`);
        assert.equal(opts.filter((o) => E.isCorrect(ex, o)).length, 1, `${it.key} ${ex.type}: una sola correcta`);
      }
      if (ex.type === 'build') {
        const tiles = E.tilesFor(ex, rng);
        for (const w of it.exEn.split(' ')) assert.ok(tiles.includes(w), `${it.key}: falta «${w}»`);
        assert.ok(E.isCorrect(ex, it.exEn));
      }
    }
  }
});

test('makeEx adapta el ejercicio: sin audio no hay escucha; frases largas no se ordenan; expresiones largas no se escriben', () => {
  const it = E.ITEMS[0];
  assert.equal(E.makeEx(it, 'listen', false).type, 'meaning');
  const long = E.ITEMS.find((x) => x.exEn.split(' ').length > 9);
  if (long) assert.equal(E.makeEx(long, 'build').type, 'gap');
  const phrase = E.ITEMS.find((x) => x.en.split(' ').length > 3);
  assert.equal(E.makeEx(phrase, 'type').type, 'reverse');
});

test('una lección son 10 ejercicios que cubren las 8 expresiones de la unidad', () => {
  const plan = E.lessonPlan('a0-1', { rng: seeded() });
  assert.equal(plan.length, 10);
  assert.equal(new Set(plan.map((x) => x.item.key)).size, 8);
  assert.ok(plan.every((x) => x.item.unit === 'a0-1'));
});

test('flags: user con 70 %, root solo sin fallos y con bonificación', () => {
  const S = E.fresh();
  assert.deepEqual(E.scoreUnit(S, 'a0-1', 60), { newUser: false, newRoot: false, bonus: 0 });
  assert.deepEqual(E.scoreUnit(S, 'a0-1', 70), { newUser: true, newRoot: false, bonus: 0 });
  assert.deepEqual(E.scoreUnit(S, 'a0-1', 100), { newUser: false, newRoot: true, bonus: E.XP_ROOT });
  assert.equal(E.unitState(S, 'a0-1').best, 100);
  E.scoreUnit(S, 'a0-1', 80);
  assert.equal(E.unitState(S, 'a0-1').best, 100, 'el mejor resultado no baja');
});

test('niveles: el siguiente se abre al conseguir todas las user flags del anterior', () => {
  const S = E.fresh();
  assert.equal(E.maxOpenLevel(S), 0);
  LEVELS[0].units.slice(0, 3).forEach((u) => E.scoreUnit(S, u.id, 80));
  assert.equal(E.maxOpenLevel(S), 0);
  E.scoreUnit(S, LEVELS[0].units[3].id, 80);
  assert.equal(E.maxOpenLevel(S), 1);
  assert.equal(E.nextUnit(S).id, 'a1-1');
});

test('repaso espaciado: acertar sube de caja (1, 3, 7, 14, 30 días) y fallar vuelve a la caja 1', () => {
  const S = E.fresh();
  const k = E.ITEMS[0].key;
  const dues = [];
  for (let i = 0; i < 6; i++) { E.srs(S, k, true, D); dues.push(S.items[k].due); }
  assert.deepEqual(dues, ['2026-10-20', '2026-10-22', '2026-10-26', '2026-11-02', '2026-11-18', '2026-11-18']);
  E.srs(S, k, false, D);
  assert.deepEqual(S.items[k], { box: 1, due: '2026-10-20' });
  assert.deepEqual(E.dueItems(S, D), []);
  assert.deepEqual(E.dueItems(S, '2026-10-20'), [k]);
});

test('racha: sube con días seguidos, no cuenta dos veces el mismo día y se reinicia si se salta uno', () => {
  const S = E.fresh();
  E.touchStreak(S, '2026-10-17'); E.touchStreak(S, '2026-10-18'); E.touchStreak(S, '2026-10-18');
  assert.equal(S.streak.count, 2);
  assert.equal(E.liveStreak(S, '2026-10-19'), 2, 'aún se puede mantener hoy');
  assert.equal(E.liveStreak(S, '2026-10-20'), 0, 'se perdió ayer');
  E.touchStreak(S, '2026-10-20');
  assert.equal(S.streak.count, 1);
});

test('racha: cruza bien el cambio de mes y de año', () => {
  assert.equal(E.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(E.addDays('2026-03-01', -1), '2026-02-28');
});

test('meta diaria: se reinicia cada día', () => {
  const S = E.fresh();
  E.grantXp(S, 30, '2026-10-18'); E.grantXp(S, 30, '2026-10-18');
  assert.deepEqual(S.daily, { day: '2026-10-18', xp: 60 });
  E.grantXp(S, 10, D);
  assert.deepEqual(S.daily, { day: D, xp: 10 });
  assert.equal(S.xp, 70);
});

test('XP: 10 por acierto y +2 desde el tercer acierto seguido', () => {
  assert.deepEqual([1, 2, 3, 4].map(E.xpFor), [10, 10, 12, 12]);
});

test('insignias: se conceden una sola vez y devuelven solo las nuevas', () => {
  const S = E.fresh();
  E.scoreUnit(S, 'a0-1', 100);
  S.xp = 600;
  const first = E.award(S, D).map((b) => b.id);
  assert.deepEqual(first.sort(), ['first-flag', 'perfect', 'xp-500']);
  assert.deepEqual(E.award(S, D), []);
  assert.deepEqual(E.award(S, D, ['review']).map((b) => b.id), ['review']);
  assert.equal(S.badges.review, D);
});

test('insignias: «Pentester bilingüe» pide root flag en las dos unidades de pentest', () => {
  const S = E.fresh();
  E.scoreUnit(S, 'b2-1', 100);
  assert.ok(!E.award(S, D).some((b) => b.id === 'pentester'));
  E.scoreUnit(S, 'b2-2', 100);
  assert.ok(E.award(S, D).some((b) => b.id === 'pentester'));
});

test('insignias: 21 en total, cada una con icono, título y descripción', () => {
  assert.equal(E.BADGES.length, 21);
  assert.equal(new Set(E.BADGES.map((b) => b.id)).size, 21);
  for (const b of E.BADGES) assert.ok(b.icon && b.t && b.d, b.id);
});

test('prueba de nivel: dos preguntas por nivel; se para en el primer nivel con un fallo', () => {
  const plan = E.placementPlan({ rng: seeded() });
  assert.equal(plan.length, 12);
  assert.deepEqual([...new Set(plan.map((p) => p.li))], [0, 1, 2, 3, 4, 5]);
  const ok = (li) => [{ li, ok: true }, { li, ok: true }];
  assert.deepEqual(E.placementLevel([...ok(0), ...ok(1), { li: 2, ok: true }, { li: 2, ok: false }]), { reached: 2, open: 2 });
  assert.deepEqual(E.placementLevel([{ li: 0, ok: false }, { li: 0, ok: true }]), { reached: 0, open: 0 });
  assert.deepEqual(E.placementLevel([0, 1, 2, 3, 4, 5].flatMap(ok)), { reached: 6, open: 5 }, 'tope en C1');
});

test('sanitize: un progreso manipulado o corrupto no rompe la app ni cuela datos', () => {
  const S = E.sanitize({
    xp: -50, updatedAt: 'x', streak: { count: 1e12, last: '2026-10-19' }, unlocked: 99,
    items: { 'a0-1:0': { box: 99, due: '2026-10-19' }, 'zz:1': { box: 1, due: '2026-10-19' }, 'a0-1:1': { box: 1, due: '<img>' } },
    units: { 'a0-1': { user: 'yes', root: true, best: 900 }, evil: { user: true } },
    badges: { perfect: '2026-10-19', fake: '2026-10-19', 'xp-500': '<script>' },
    stats: { listen: 3, hack: 1 }, __proto__: { polluted: true },
  });
  assert.equal(S.xp, 0);
  assert.equal(S.updatedAt, 0);
  assert.equal(S.streak.count, 100000);
  assert.equal(S.unlocked, 5);
  assert.deepEqual(S.items, { 'a0-1:0': { box: 5, due: '2026-10-19' } });
  assert.deepEqual(S.units, { 'a0-1': { user: false, root: true, best: 100 } });
  assert.deepEqual(S.badges, { perfect: '2026-10-19' });
  assert.deepEqual(S.stats, { listen: 3, build: 0, type: 0, lessons: 0 });
  assert.equal({}.polluted, undefined);
  assert.deepEqual(E.sanitize(null), E.fresh());
  assert.deepEqual(E.sanitize('basura'), E.fresh());
});
