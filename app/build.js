#!/usr/bin/env node
/* Construye LemonByte:
 *  - dist/index.html: un único HTML autónomo con CSP por hashes, sin peticiones de red (fuentes e iconos incrustados).
 *  - dist/intro/: los vídeos de la intro (WebM y MP4, horizontal y vertical), que se cargan solo al mostrarla.
 *  - dist/artifact/lemonbyte.html: el mismo contenido sin <head>, para claude.ai (allí el progreso se guarda además en la cuenta).
 * Uso: node app/build.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIST = path.join(ROOT, '..', 'dist');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const b64 = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'vendor', f)).toString('base64');
const ICONS = JSON.parse(read('vendor', 'lucide-icons.json'));
// Logo de LemonByte: el limón, sin fondo, incrustado (también es el favicon)
const LOGO = 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, 'vendor', 'lemon-mark.webp')).toString('base64');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'package.json'), 'utf8'));

const icon = (n) => {
  if (!ICONS[n]) throw new Error(`Icono Lucide desconocido: ${n}`);
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
};
// Los iconos que pide ui.js con I('...') también tienen que existir
for (const m of read('src', 'ui.js').matchAll(/I\('([a-z0-9-]+)'\)/g)) icon(m[1]);

const css = read('src', 'styles.css')
  .replace('/*__FONT_SANS__*/', () => b64('mona-sans-latin-wght-normal.woff2'))
  .replace('/*__FONT_MONO__*/', () => b64('jetbrains-mono-latin-wght-normal.woff2'));
const body = read('src', 'body.html')
  .replace(/\{\{i:([a-z0-9-]+)\}\}/g, (_, n) => icon(n))
  .replace(/\{\{version\}\}/g, pkg.version)
  .replace(/\{\{LOGO\}\}/g, LOGO);
const LEVEL_FILES = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1'];
const js = [
  `window.LEMONBYTE_ICONS = ${JSON.stringify(ICONS)};`,
  ...LEVEL_FILES.map((f) => read('src', 'content', f + '.js')),
  read('vendor', 'animateicons.js'),
  read('src', 'engine.js'),
  read('src', 'ui.js'),
].join('\n').replace(/<\/script/gi, '<\\/script');
if (/\{\{|\/\*__/.test(body + css)) throw new Error('Quedan marcadores sin sustituir');

const page = `<title>LemonByte</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${css}</style>\n\n${body}\n<script>\n${js}\n</script>\n`;
fs.mkdirSync(path.join(DIST, 'artifact'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'artifact', 'lemonbyte.html'), page);

const sha = (t) => "'sha256-" + crypto.createHash('sha256').update(t, 'utf8').digest('base64') + "'";
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]));
const styles = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => sha(m[1]));
// Solo se ejecuta el código de este build; sin conexiones salientes ni recursos externos.
const CSP = `default-src 'none'; script-src ${scripts.join(' ')}; style-src ${styles.join(' ')}; style-src-attr 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; media-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'`;
const favicon = LOGO;
const head = `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="no-referrer">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="color-scheme" content="light dark">\n<meta name="description" content="LemonByte · Cyber English: 100 laboratorios de inglés del A0 al C1 con user y root flags, jefes finales, XP, rachas, insignias y repaso espaciado.">\n<link rel="icon" href="${favicon}">\n`;
const standalone = head + page.replace('<a class="skip"', '</head>\n<body>\n<a class="skip"') + '</body>\n</html>\n';
fs.writeFileSync(path.join(DIST, 'index.html'), standalone);
// Vídeos de la intro: ficheros aparte para que solo se descarguen la primera vez que se ven
fs.mkdirSync(path.join(DIST, 'intro'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'media'))) fs.copyFileSync(path.join(ROOT, 'media', f), path.join(DIST, 'intro', f.replace(/^intro-/, 'lemonbyte-intro-')));
console.log(`OK dist/index.html ${(standalone.length / 1024).toFixed(0)} KB · dist/artifact/lemonbyte.html ${(page.length / 1024).toFixed(0)} KB`);
