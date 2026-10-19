# Cambios

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
