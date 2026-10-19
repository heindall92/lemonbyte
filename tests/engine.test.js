/* Pruebas del motor y del contenido de LemonByte: node --test tests/engine.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS } = require('../app/src/content/index.js');
const { build } = require('../app/src/engine.js');

const E = build(LEVELS);
const D = '2026-10-19';
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const winAll = (S, list, acc = 80) => list.forEach((u) => E.scoreUnit(S, u.id, acc));

/* ── Contenido ── */
test('contenido: 6 niveles del MCER y exactamente 100 laboratorios (94 de contenido y 6 jefes)', () => {
  assert.deepEqual(LEVELS.map((L) => L.id), ['A0', 'A1', 'A2', 'B1', 'B2', 'C1']);
  assert.equal(E.UNITS.length, 100);
  assert.equal(E.UNITS.filter((u) => u.boss).length, 6);
  assert.deepEqual(LEVELS.map((L, li) => E.unitsOf(li).length), [14, 16, 18, 18, 18, 16]);
  for (const u of E.UNITS.filter((x) => !x.boss)) assert.equal(u.items.length, 8, u.id);
  assert.equal(E.ITEMS.length, 752);
});

test('contenido: identificadores únicos y cada expresión completa y sin HTML', () => {
  assert.equal(new Set(E.UNITS.map((u) => u.id)).size, 100);
  for (const it of E.ITEMS) {
    for (const f of ['en', 'es', 'exEn', 'exEs']) assert.ok(typeof it[f] === 'string' && it[f].trim(), `${it.key}.${f}`);
    assert.doesNotMatch(Object.values(it).join(' '), /[<>]/, it.key);
  }
});

test('contenido: sin expresiones repetidas dentro de un nivel, ni en inglés ni en español (las opciones serían ambiguas)', () => {
  for (const L of LEVELS) {
    const items = E.ITEMS.filter((x) => x.level === L.id);
    const en = items.map((x) => E.norm(x.en)), es = items.map((x) => x.es.toLowerCase());
    assert.equal(new Set(en).size, en.length, `${L.id} inglés`);
    assert.equal(new Set(es).size, es.length, `${L.id} español`);
  }
});

test('contenido: cada ejemplo contiene su expresión como palabra completa (para el ejercicio de hueco)', () => {
  assert.deepEqual(E.ITEMS.filter((it) => !E.gapOf(it)).map((it) => `${it.key} «${it.en}»`), []);
  const g = E.gapOf(E.ITEMS.find((x) => x.en === "o'clock"));
  assert.equal(g.before + g.word + g.after, "It is five o'clock.");
});

test('fases: cada nivel tiene labs fáciles, medios y difíciles en ese orden, y termina en un jefe insane', () => {
  LEVELS.forEach((L, li) => {
    const tiers = E.unitsOf(li).map((u) => u.tier);
    assert.equal(tiers.at(-1), 'insane', L.id);
    const order = ['facil', 'media', 'dificil', 'insane'];
    for (let i = 1; i < tiers.length; i++) assert.ok(order.indexOf(tiers[i]) >= order.indexOf(tiers[i - 1]), `${L.id} orden`);
    for (const t of order) assert.ok(tiers.includes(t), `${L.id} tiene ${t}`);
  });
});

test('variedad: los cuatro tipos de lab aparecen en cada nivel y cada tipo cambia los ejercicios', () => {
  LEVELS.forEach((L, li) => assert.deepEqual(new Set(E.contentOf(li).map((u) => u.kind)), new Set(['mixto', 'oido', 'frases', 'escritura']), L.id));
  const count = (id, t) => E.lessonPlan(id, { rng: seeded() }).filter((x) => x.type === t).length;
  const oido = E.contentOf(0).find((u) => u.kind === 'oido').id;
  const frases = E.contentOf(0).find((u) => u.kind === 'frases').id;
  assert.ok(count(oido, 'listen') >= 4, 'el lab de oído es sobre todo escucha');
  assert.ok(count(frases, 'build') >= 4, 'el lab de frases es sobre todo ordenar');
});

/* ── Ejercicios ── */
test('gapOf no corta dentro de otra palabra', () => {
  assert.equal(E.gapOf({ en: 'one', exEn: 'Someone has one key.' }).before, 'Someone has ');
  assert.equal(E.gapOf({ en: 'ten', exEn: 'Written often.' }), null);
});

test('norm: mayúsculas, apóstrofos tipográficos y puntuación no penalizan', () => {
  assert.equal(E.norm('  I DON’T understand!! '), "i don't understand");
  assert.equal(E.norm('Kind regards, Yoandy'), E.norm('kind regards yoandy'));
});

test('cada ejercicio de las 752 expresiones tiene exactamente una respuesta correcta entre sus opciones o fichas', () => {
  const rng = seeded();
  for (const it of E.ITEMS) {
    for (const t of ['meaning', 'reverse', 'listen', 'gap', 'build', 'type']) {
      const ex = E.makeEx(it, t);
      const opts = E.optionsFor(ex, rng);
      if (opts) {
        assert.equal(opts.length, 4, `${it.key} ${ex.type}`);
        assert.equal(opts.filter((o) => E.isCorrect(ex, o)).length, 1, `${it.key} ${ex.type}`);
      }
      if (ex.type === 'build') { const tiles = E.tilesFor(ex, rng); for (const w of it.exEn.split(' ')) assert.ok(tiles.includes(w), `${it.key}: falta «${w}»`); }
    }
  }
});

test('makeEx adapta el ejercicio: sin audio no hay escucha; frases largas no se ordenan; expresiones largas no se escriben', () => {
  assert.equal(E.makeEx(E.ITEMS[0], 'listen', false).type, 'meaning');
  const long = E.ITEMS.find((x) => x.exEn.split(' ').length > 9);
  assert.equal(E.makeEx(long, 'build').type, 'gap');
  assert.equal(E.makeEx(E.ITEMS.find((x) => x.en.split(' ').length > 3), 'type').type, 'reverse');
});

test('un lab normal son 10 ejercicios con sus 8 expresiones; el jefe, 12 retos de todo el nivel', () => {
  const plan = E.lessonPlan('a0-1', { rng: seeded() });
  assert.equal(plan.length, 10);
  assert.equal(new Set(plan.map((x) => x.item.key)).size, 8);
  const boss = E.lessonPlan('a0-jefe', { rng: seeded() });
  assert.equal(boss.length, 12);
  assert.ok(boss.every((x) => x.item.level === 'A0'));
  assert.ok(new Set(boss.map((x) => x.item.unit)).size >= 5, 'mezcla varios labs');
});

/* ── Progreso ── */
test('flags: user con 70 %, root sin fallos; el jefe da más bonificación', () => {
  const S = E.fresh();
  assert.deepEqual(E.scoreUnit(S, 'a0-1', 60), { newUser: false, newRoot: false, bonus: 0 });
  assert.deepEqual(E.scoreUnit(S, 'a0-1', 70), { newUser: true, newRoot: false, bonus: 0 });
  assert.deepEqual(E.scoreUnit(S, 'a0-1', 100), { newUser: false, newRoot: true, bonus: E.XP_ROOT });
  assert.equal(E.scoreUnit(S, 'a0-jefe', 100).bonus, E.XP_ROOT_BOSS);
  E.scoreUnit(S, 'a0-1', 80);
  assert.equal(E.unitState(S, 'a0-1').best, 100, 'el mejor resultado no baja');
});

test('jefe final: se abre con el 75 % de los labs del nivel; el nivel siguiente, al derrotarlo', () => {
  const S = E.fresh();
  const content = E.contentOf(0), boss = E.bossOf(0);
  assert.equal(E.bossNeed(0), Math.ceil(content.length * 0.75));
  assert.equal(E.canPlay(S, content[5]), true, 'los labs del nivel abierto se juegan en cualquier orden');
  winAll(S, content.slice(0, E.bossNeed(0) - 1));
  assert.equal(E.canPlay(S, boss), false);
  E.scoreUnit(S, content[E.bossNeed(0) - 1].id, 80);
  assert.equal(E.canPlay(S, boss), true);
  assert.equal(E.maxOpenLevel(S), 0);
  assert.equal(E.canPlay(S, E.contentOf(1)[0]), false);
  E.scoreUnit(S, boss.id, 75);
  assert.equal(E.maxOpenLevel(S), 1);
  assert.equal(E.canPlay(S, E.contentOf(1)[0]), true);
});

test('siguiente lab: primero los pendientes del nivel, luego el jefe, luego el nivel siguiente', () => {
  const S = E.fresh();
  assert.equal(E.nextUnit(S).id, 'a0-1');
  winAll(S, E.contentOf(0));
  assert.equal(E.nextUnit(S).id, 'a0-jefe');
  E.scoreUnit(S, 'a0-jefe', 80);
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
  assert.deepEqual(E.dueItems(S, '2026-10-20'), [k]);
  const c = E.boxCounts(S);
  assert.equal(c[1], 1);
  assert.equal(c.reduce((a, b) => a + b), 752);
});

test('racha: sube con días seguidos, no cuenta dos veces el mismo día y se reinicia si se salta uno', () => {
  const S = E.fresh();
  E.touchStreak(S, '2026-10-17'); E.touchStreak(S, '2026-10-18'); E.touchStreak(S, '2026-10-18');
  assert.equal(S.streak.count, 2);
  assert.equal(E.liveStreak(S, '2026-10-19'), 2);
  assert.equal(E.liveStreak(S, '2026-10-20'), 0);
  E.touchStreak(S, '2026-10-20');
  assert.equal(S.streak.count, 1);
  assert.equal(E.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(E.addDays('2026-03-01', -1), '2026-02-28');
});

test('meta diaria e historial: la meta se reinicia cada día y el historial guarda la XP por día', () => {
  const S = E.fresh();
  E.grantXp(S, 30, '2026-10-18'); E.grantXp(S, 30, '2026-10-18');
  E.grantXp(S, 10, D);
  assert.deepEqual(S.daily, { day: D, xp: 10, labs: 0 });
  assert.equal(S.xp, 70);
  assert.deepEqual(E.lastDays(S, D, 3), [{ day: '2026-10-17', xp: 0 }, { day: '2026-10-18', xp: 60 }, { day: D, xp: 10 }]);
});

test('XP: 10 por acierto y +2 desde el tercer acierto seguido', () => {
  assert.deepEqual([1, 2, 3, 4].map(E.xpFor), [10, 10, 12, 12]);
});

/* ── Insignias ── */
test('insignias: se conceden una sola vez y devuelven solo las nuevas', () => {
  const S = E.fresh();
  E.scoreUnit(S, 'a0-1', 100);
  S.xp = 600;
  assert.deepEqual(E.award(S, D).map((b) => b.id).sort(), ['first-flag', 'perfect', 'xp-500']);
  assert.deepEqual(E.award(S, D), []);
  assert.deepEqual(E.award(S, D, ['review']).map((b) => b.id), ['review']);
});

test('insignias de hora, combo y triplete', () => {
  const S = E.fresh();
  assert.deepEqual(E.award(S, D, [], { hour: 7 }).map((b) => b.id), ['early']);
  assert.deepEqual(E.award(S, D, [], { hour: 23 }).map((b) => b.id), ['night']);
  assert.deepEqual(E.award(S, D, [], { hour: 12 }), []);
  S.stats.bestCombo = 10; S.daily = { day: D, xp: 0, labs: 3 };
  assert.deepEqual(E.award(S, D).map((b) => b.id).sort(), ['combo-10', 'triple']);
});

test('insignias de laboratorios, jefe y nivel', () => {
  const S = E.fresh();
  winAll(S, E.contentOf(0).slice(0, 10));
  assert.ok(E.award(S, D).some((b) => b.id === 'labs-10'));
  E.scoreUnit(S, 'a0-jefe', 90);
  const ids = E.award(S, D).map((b) => b.id);
  assert.ok(ids.includes('boss') && ids.includes('level-A0'));
  winAll(S, E.UNITS);
  assert.ok(E.award(S, D).some((b) => b.id === 'labs-100'));
});

test('insignias: «Pentester bilingüe» pide root flag en los tres labs de pentest del B2', () => {
  const S = E.fresh();
  E.scoreUnit(S, 'b2-1', 100); E.scoreUnit(S, 'b2-2', 100);
  assert.ok(!E.award(S, D).some((b) => b.id === 'pentester'));
  E.scoreUnit(S, 'b2-17', 100);
  assert.ok(E.award(S, D).some((b) => b.id === 'pentester'));
});

test('insignias: cada una con icono, título y descripción, sin repetir identificador', () => {
  assert.equal(new Set(E.BADGES.map((b) => b.id)).size, E.BADGES.length);
  assert.equal(E.BADGES.length, 29);
  for (const b of E.BADGES) assert.ok(b.icon && b.t && b.d, b.id);
});

/* ── Prueba de nivel y búsqueda ── */
test('prueba de nivel: dos preguntas por nivel; se para en el primer nivel con un fallo', () => {
  assert.equal(E.placementPlan({ rng: seeded() }).length, 12);
  const ok = (li) => [{ li, ok: true }, { li, ok: true }];
  assert.deepEqual(E.placementLevel([...ok(0), ...ok(1), { li: 2, ok: true }, { li: 2, ok: false }]), { reached: 2, open: 2 });
  assert.deepEqual(E.placementLevel([{ li: 0, ok: false }]), { reached: 0, open: 0 });
  assert.deepEqual(E.placementLevel([0, 1, 2, 3, 4, 5].flatMap(ok)), { reached: 6, open: 5 });
});

test('búsqueda: encuentra labs y expresiones sin acentos, en los dos idiomas', () => {
  assert.ok(E.search('informe').units.some((u) => u.id === 'b2-1'));
  assert.ok(E.search('reunion').items.some((it) => it.en === 'meeting'), 'sin tilde encuentra «reunión»');
  assert.ok(E.search('kick').items.some((it) => it.en === 'kick-off'));
  assert.deepEqual(E.search('a'), { units: [], items: [] }, 'una letra no busca');
});

/* ── Saneado ── */
test('sanitize: un progreso manipulado o corrupto no rompe la app ni cuela datos', () => {
  const S = E.sanitize({
    xp: -50, updatedAt: 'x', streak: { count: 1e12, last: '2026-10-19' }, unlocked: 99,
    history: { '2026-10-19': 40, hack: 5, '<x>': 1 },
    items: { 'a0-1:0': { box: 99, due: '2026-10-19' }, 'zz:1': { box: 1, due: '2026-10-19' }, 'a0-1:1': { box: 1, due: '<img>' } },
    units: { 'a0-1': { user: 'yes', root: true, best: 900 }, evil: { user: true } },
    badges: { perfect: '2026-10-19', fake: '2026-10-19', 'xp-500': '<script>' },
    stats: { listen: 3, hack: 1 }, __proto__: { polluted: true },
  });
  assert.equal(S.xp, 0);
  assert.equal(S.streak.count, 100000);
  assert.equal(S.unlocked, 5);
  assert.deepEqual(S.history, { '2026-10-19': 40 });
  assert.deepEqual(S.items, { 'a0-1:0': { box: 5, due: '2026-10-19' } });
  assert.deepEqual(S.units, { 'a0-1': { user: false, root: true, best: 100 } });
  assert.deepEqual(S.badges, { perfect: '2026-10-19' });
  assert.deepEqual(S.stats, { listen: 3, build: 0, type: 0, lessons: 0, bestCombo: 0 });
  assert.equal({}.polluted, undefined);
  assert.deepEqual(E.sanitize(null), E.fresh());
});

test('sanitize: el progreso de la versión anterior (HERMES 0.1) se conserva', () => {
  const old = { v: 1, xp: 136, daily: { day: D, xp: 136 }, streak: { count: 1, last: D }, items: { 'a0-1:0': { box: 1, due: D } }, units: { 'a0-1': { user: true, root: true, best: 100 } }, badges: { 'first-flag': D }, unlocked: 0, stats: { listen: 2, build: 1, type: 1, lessons: 1 } };
  const S = E.sanitize(old);
  assert.equal(S.xp, 136);
  assert.deepEqual(S.units['a0-1'], { user: true, root: true, best: 100 });
  assert.equal(S.badges['first-flag'], D);
  assert.equal(S.daily.labs, 0);
});
