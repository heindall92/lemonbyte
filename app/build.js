#!/usr/bin/env node
/* Construye HERMES:
 *  - dist/index.html: un único HTML autónomo con CSP por hashes, sin peticiones de red (fuentes e iconos incrustados).
 *  - dist/artifact/hermes.html: el mismo contenido sin <head>, para claude.ai (allí el progreso se guarda además en la cuenta).
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
  .replace(/\{\{version\}\}/g, pkg.version);
const js = [
  `window.HERMES_ICONS = ${JSON.stringify(ICONS)};`,
  read('src', 'content.js'),
  read('src', 'engine.js'),
  read('src', 'ui.js'),
].join('\n').replace(/<\/script/gi, '<\\/script');
if (/\{\{|\/\*__/.test(body + css)) throw new Error('Quedan marcadores sin sustituir');

const page = `<title>HERMES English Lab</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${css}</style>\n\n${body}\n<script>\n${js}\n</script>\n`;
fs.mkdirSync(path.join(DIST, 'artifact'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'artifact', 'hermes.html'), page);

const sha = (t) => "'sha256-" + crypto.createHash('sha256').update(t, 'utf8').digest('base64') + "'";
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]));
const styles = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => sha(m[1]));
// Solo se ejecuta el código de este build; sin conexiones salientes ni recursos externos.
const CSP = `default-src 'none'; script-src ${scripts.join(' ')}; style-src ${styles.join(' ')}; style-src-attr 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'`;
const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#1a4fe0"/><path d="M9 9v14M23 9v14M9 16h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>');
const head = `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="no-referrer">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="color-scheme" content="light dark">\n<meta name="description" content="Laboratorio de inglés por niveles A0–C1 con máquinas, user y root flags, XP, rachas, insignias y repaso espaciado.">\n<link rel="icon" href="${favicon}">\n`;
const standalone = head + page.replace('<header class="top">', '</head>\n<body>\n<header class="top">') + '</body>\n</html>\n';
fs.writeFileSync(path.join(DIST, 'index.html'), standalone);
console.log(`OK dist/index.html ${(standalone.length / 1024).toFixed(0)} KB · dist/artifact/hermes.html ${(page.length / 1024).toFixed(0)} KB`);
