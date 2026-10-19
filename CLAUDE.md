# Instrucciones para Claude Code

## Autoría

- El autor de todo el trabajo es **Yoandy Ramírez Delgado** (`yoandyramirezdelgado@gmail.com`). Siempre debe aparecer él, nunca Claude.
- Antes del primer commit en cualquier clon: `git config user.name "Yoandy Ramírez Delgado"` y `git config user.email "yoandyramirezdelgado@gmail.com"`. Comprueba con `git log -1 --format='%an <%ae>'` que el commit sale a su nombre.
- No añadas `Co-Authored-By: Claude` ni otras líneas que atribuyan la autoría a Claude en commits, PR, código o documentación.

## Flujo de trabajo

- **Una PR por versión.** Rama `version/X.Y.Z` desde `main`, `./run_tests.sh` en verde (motor, e2e y axe) y PR hacia `main`. La fusiona Yoandy.
- `dist/` se versiona: tras cambiar `app/`, ejecuta `node app/build.js` y sube el resultado (la CI comprueba que está al día).
- El contenido va en `app/src/content.js`; la lógica, en `app/src/engine.js` (pura y probada); la interfaz, en `app/src/ui.js`.

## Estilo y diseño

- Antes de tocar la interfaz, el contenido o el repositorio, carga la skill `estilo-yoandy` (`SKILL.md` y la referencia que toque).
- La visualización propia de HERMES es la ruta de estaciones A0→C1 y las flags por máquina; no usar anillos (son de Rosetta).

## Siguiente paso

- Lee `ROADMAP.md` antes de proponer trabajo nuevo.
