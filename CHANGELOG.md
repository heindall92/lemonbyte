# Cambios

## 0.2.3 · 2026-10-19

- **Intro de la marca** en la primera visita: el limón se corta en espiral y aparece el logo de LemonByte. En pantallas apaisadas sale el vídeo horizontal y en el móvil el vertical, en WebM (VP9) con MP4 (H.264) de respaldo y sin sonido. Se salta con «Saltar intro», con un clic, con Escape o al terminar; mientras dura, la app queda inerte detrás y el foco no se escapa. No sale con movimiento reducido ni en visitas posteriores, y se puede repetir desde Ayuda › Acerca de › «Ver la intro». Los vídeos son ficheros aparte (unos 450 KB cada uno), así que solo se descargan la primera vez.
- **Corregido el «cajón» al cambiar de tema.** El fondo de la página, los botones y las tarjetas cambiaban de color a ritmos distintos (0,35 s, 0,2 s y al instante), y durante esa fracción de segundo se veían rectángulos a medio color, el más visible el del propio interruptor. Ahora todo cambia en el mismo fotograma y, donde hay View Transitions, la página entera funde de un tema a otro mientras la bola se desliza. Una prueba e2e comprueba que no queda ninguna transición de color suelta (antes había más de 40).
- **Acentos en el móvil.** En el móvil no hay barra lateral y la paleta de los siete acentos no aparecía en ningún sitio. Ahora está en el menú «Más», en una fila de puntos de 28 px, sincronizada con la del lateral.
- `aria-checked` del interruptor de tema se actualiza al instante.
- CSP: `media-src 'self'` para los vídeos de la intro.

## 0.2.2 · 2026-10-19

- La tarjeta **«Siguiente laboratorio»** tiene ondas de limón: cinco anillos amarillos que nacen en su esquina superior derecha y se expanden y se desvanecen antes de llegar al texto. Sustituyen al halo fijo. En tema claro el anillo usa un amarillo algo más hondo (`#f5c400`) para que se vea sobre blanco, y en oscuro el amarillo eléctrico (`#ffe01a`).
- Solo se animan cuando se ven: se pausan si la tarjeta sale de pantalla, al cambiar de vista o con la pestaña en segundo plano. Con movimiento reducido quedan tres anillos quietos.
- Pruebas e2e nuevas: hay cinco ondas decorativas (`aria-hidden`), son amarillas, el texto queda por encima, se pausan fuera del inicio y quedan quietas con movimiento reducido.

## 0.2.1 · 2026-10-19

- La dirección de GitHub Pages (`heindall92.github.io/lemonbyte/`) abría el README en vez de la app: se añade un `index.html` en la raíz que abre `dist/index.html`, como en KAIROS y ARGOS. Una prueba e2e lo comprueba.

## 0.2.0 · 2026-10-19 · LemonByte

El proyecto pasa a llamarse **LemonByte · Cyber English**, con su logo del limón.

- **100 laboratorios** (antes 24): 94 de contenido y un jefe final por nivel. **752 expresiones** (antes 192), con inglés de IT, redes, sistemas, nube, Active Directory, aplicaciones web, respuesta a incidentes, ingeniería social, RGPD, NIS2, DORA y gobierno de la IA.
- **Fases por dificultad** en cada nivel (Fácil, Media, Difícil) y **jefe final Insane** con doce retos de todo el nivel; se abre con el 75 % de los labs y, al vencerlo, se abre el nivel siguiente.
- **Cuatro tipos de laboratorio**: Mixto, Oído, Frases y Escritura.
- **Sonidos** de acierto, fallo, user flag, root flag e insignia, sintetizados con Web Audio y con botón para silenciarlos.
- **Interfaz nueva** con la guía de Emil Kowalski: barra lateral flotante con pastilla deslizante, barra superior de vidrio, interruptor de tema, siete acentos, barra inferior en móvil, transiciones con muelle y movimiento reducido.
- **Búsqueda Ctrl K**, **centro de ayuda** (guía, método generado desde el código, laboratorios, atajos, glosario y acerca de con el ecosistema) y vista de **Progreso** con el mapa de los 100 laboratorios, la XP por día y la memoria por cajas.
- **Amarillo eléctrico** para lo que se gana (XP, root flags, insignias, meta), en claro y oscuro.
- 29 insignias (antes 21), cuatro secretas.
- El progreso de la 0.1 se conserva.
- Corregido: los diálogos cerrados podían bloquear los clics; el foco llegaba tarde al abrir un diálogo; contraste de los niveles bloqueados y de las etiquetas de dificultad.
- Pruebas: 27 del motor y del contenido, 63 comprobaciones e2e (incluidos los sonidos) y axe-core sin infracciones en más de 80 estados.

## 0.1.0 · 2026-10-19

Primera versión (como HERMES): 6 niveles, 24 laboratorios y 192 expresiones, flags, XP, rachas, 21 insignias, repaso espaciado y prueba de nivel.
