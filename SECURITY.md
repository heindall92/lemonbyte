# Seguridad

HERMES guarda poco y no envía nada: el progreso de aprendizaje (XP, flags, insignias, fechas de repaso) en el almacenamiento local del navegador. Aun así se trata como si fuera hostil todo lo que se lee de ahí.

## Modelo de amenazas

| Vector | Ejemplo | Defensa |
|---|---|---|
| `localStorage` manipulado | Otra pestaña del mismo origen escribe `"xp":"<img onerror=…>"` o unidades inventadas | `sanitize()` reconstruye el estado campo a campo: números finitos y acotados, fechas `AAAA-MM-DD`, solo unidades, expresiones e insignias que existen. Lo demás se descarta. |
| Prototype pollution | Claves `__proto__` en el progreso guardado | El estado se reconstruye desde un objeto nuevo copiando solo claves conocidas; nunca se fusiona el JSON leído. |
| XSS | Un texto del contenido o del progreso pintado como HTML | Todo texto pasa por `esc()` antes de entrar en el DOM; el contenido del curso no admite `<` ni `>` (lo comprueba `engine.test.js`). |
| Ejecución de código inyectado | Un fallo de escapado | CSP por hashes generada en el build: solo se ejecutan los bloques de `app/build.js`, sin `'unsafe-inline'` ni `'unsafe-eval'` para código. |
| Exfiltración | Código que intenta enviar datos fuera | `default-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'`. La app no hace ninguna petición de red. |
| Acceso al estado desde la página | Una extensión que lee `window` | El estado solo se expone en `window.__HERMES__` cuando la URL lleva `?test` (pruebas automáticas). |

## Verificación automática

- `tests/engine.test.js` alimenta `sanitize()` con un progreso manipulado (`__proto__`, tipos imposibles, unidades e insignias inventadas) y comprueba que no pasa nada.
- `tests/e2e_app.py` recarga la app con un `localStorage` corrupto, y comprueba que no hay errores de consola ni de CSP y que no sale ninguna petición de red.
- `tests/a11y_app.py` pasa axe-core (WCAG 2.2 A/AA) por 48 estados en claro y oscuro, a 1280 y 390 px.

## Informar de una vulnerabilidad

Escribe a **yoandyramirezdelgado@gmail.com** con el asunto `HERMES · seguridad`. Respuesta en un máximo de 7 días.
