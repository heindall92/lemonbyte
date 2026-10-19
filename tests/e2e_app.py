"""Pruebas de LemonByte en un navegador real (Chromium con Playwright) sobre dist/index.html, con su CSP.

Uso:  python3 tests/e2e_app.py
Recorre lo que hace una persona: jugar un lab hasta la root flag, fallar y repetir, oír los efectos, guardar y
recargar, repasar, derrotar a un jefe final, hacer la prueba de nivel, buscar con Ctrl K, abrir la ayuda,
usar el teclado, el tema, el acento y el lateral, y el móvil. Comprueba que no hay errores ni peticiones de red.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = (ROOT / "dist" / "index.html").as_uri() + "?test"
OUT = ROOT / "tests" / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)
KEY = "lemonbyte-progress-v1"
fallos = []

# Cuenta los osciladores creados: cada efecto de sonido crea al menos uno.
COUNT_AUDIO = """
window.__tones = 0;
const C = window.AudioContext || window.webkitAudioContext;
if (C) { const o = C.prototype.createOscillator; C.prototype.createOscillator = function () { window.__tones++; return o.call(this); }; }
"""


def check(cond, msg):
    print(("  ok  " if cond else "  FALLO ") + msg)
    if not cond:
        fallos.append(msg)


def answer(page, right=True):
    """Responde el ejercicio en curso leyendo la respuesta correcta del gancho de pruebas."""
    ex = page.evaluate("(() => { const e = window.__LEMONBYTE__.current(); return { type: e.type, correct: e.correct }; })()")
    t, correct = ex["type"], ex["correct"]
    if t in ("meaning", "reverse", "listen", "gap"):
        page.evaluate("([c, right]) => [...document.querySelectorAll('#ex .opt')].find(b => (b.dataset.v.toLowerCase() === c.toLowerCase()) === right).click()", [correct, right])
    elif t == "type":
        page.fill("#typein", correct if right else "zzz")
        page.click("#check")
    else:
        if right:
            for w in correct.split(" "):
                page.evaluate("(w) => [...document.querySelectorAll('#bank .tile')].find(b => !b.disabled && b.textContent === w).click()", w)
        else:
            page.locator("#bank .tile").first.click()
        page.click("#check")
    page.wait_for_selector("#sheet.show")
    return t


def play(page, wrong_first=0):
    n = 0
    while page.locator("#v-lesson").is_visible():
        answer(page, right=n >= wrong_first)
        n += 1
        page.click("#s-next")
        if n > 60:
            raise RuntimeError("el lab no termina")
    return n


def state(page):
    return page.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")


def set_state(page, mutate_js):
    page.wait_for_timeout(1400)  # deja terminar el guardado diferido de la app (1,2 s) para no pisarlo
    page.evaluate(f"(() => {{ const s = JSON.parse(localStorage.getItem('{KEY}') || '{{}}'); {mutate_js}; s.updatedAt = Date.now() + 1000; localStorage.setItem('{KEY}', JSON.stringify(s)); }})()")
    page.reload()


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_init_script(COUNT_AUDIO)
    page = ctx.new_page()
    errores, red = [], []
    page.on("pageerror", lambda e: errores.append(str(e)))
    page.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
    page.on("request", lambda r: red.append(r.url) if not r.url.startswith(("file:", "data:", "blob:")) else None)

    print("== Portada de GitHub Pages")
    page.goto((ROOT / "index.html").as_uri())
    page.wait_for_url("**/dist/index.html")
    check(page.url.endswith("/dist/index.html"), "la raíz del sitio abre la app (no el README)")

    print("== Primera visita")
    page.goto(APP)
    check(page.title() == "Inicio · LemonByte", f"título de la vista ({page.title()})")
    check(page.locator(".side .logo-img").count() == 1 and page.locator(".brand-t .byte").inner_text() == "Byte", "logo del limón y marca LemonByte en el lateral")
    check(page.locator("#continue-t").inner_text() == "Empezar", "botón «Empezar»")
    check(page.locator("#matrix-home .cell").count() == 100, "el inicio enseña el mapa de 100 labs")
    check(page.locator("#review").is_disabled(), "repaso desactivado sin expresiones aprendidas")
    page.click(".nav [data-go=labs]")
    check(page.title() == "Laboratorios · LemonByte", "navegación a Laboratorios")
    check(page.locator("#route .st").count() == 6 and page.locator("#route .st.locked").count() == 5, "6 niveles, 5 bloqueados")
    check(page.locator("#phases .lab").count() == 14, "A0 tiene 14 labs (13 y el jefe)")
    check(page.locator("#phases .tier-tag").all_inner_texts() == ["FÁCIL", "MEDIA", "DIFÍCIL", "INSANE"] or page.locator("#phases .tier-tag").all_inner_texts() == ["Fácil", "Media", "Difícil", "Insane"], "fases Fácil, Media, Difícil e Insane")
    check(page.locator('.lab.boss[data-unit="a0-jefe"]').is_disabled(), "el jefe final empieza bloqueado")
    check(len(set(page.locator("#phases .kind-tag").all_inner_texts())) == 4, "cuatro tipos de lab distintos")

    print("== Lab perfecto: user y root flag, con sonido")
    page.click('.lab[data-unit="a0-1"]')
    check(page.locator("#v-lesson").is_visible(), "abre el lab")
    tones0 = page.evaluate("window.__tones")
    answer(page)
    check(page.evaluate("window.__tones") > tones0, "suena el efecto de acierto")
    page.click("#s-next")
    tipos = {"meaning"}
    while page.locator("#v-lesson").is_visible():
        tipos.add(answer(page)); page.click("#s-next")
    check(len(tipos) >= 4, f"varios tipos de ejercicio ({', '.join(sorted(tipos))})")
    check(page.locator("#d-h").inner_text() == "Root flag conseguida", "pantalla final: root flag")
    check(page.locator("#d-xp").inner_text() == "+136", "XP: 10 aciertos con combo + 20 de root = 136")
    nuevas = " ".join(page.locator("#d-badges b").all_inner_texts())
    check("Primera flag" in nuevas and "Sin fallos" in nuevas, "insignias nuevas: Primera flag y Sin fallos")
    page.screenshot(path=str(OUT / "final.png"))
    page.click("#d-home")
    check(page.locator("#c-xp").inner_text() == "136" and page.locator("#c-streak").inner_text() == "1", "XP y racha en la barra")
    card = page.locator('.lab[data-unit="a0-1"]')
    check(card.locator(".got-user").count() == 1 and card.locator(".got-root").count() == 1, "el lab muestra sus dos flags")

    print("== Fallar: sonido de fallo, repetición y sin root")
    page.click('.lab[data-unit="a0-2"]')
    tones0 = page.evaluate("window.__tones")
    answer(page, right=False)
    check(page.evaluate("window.__tones") > tones0, "suena el efecto de fallo")
    check("ko" in page.locator("#sheet").get_attribute("class") and "Respuesta:" in page.locator("#s-detail").inner_text(), "fallo marcado con la respuesta correcta")
    page.click("#s-next")
    n = play(page)
    check(n == 10, f"la fallada se repite al final (11 respuestas: {n + 1})")
    check(page.locator("#d-acc").inner_text() == "90 %" and page.locator("#d-h").inner_text() == "User flag conseguida", "90 %: user flag sin root")
    page.click("#d-home")

    print("== Silenciar los efectos")
    page.click("#sound")
    check(page.locator("#sound").get_attribute("aria-pressed") == "false", "el botón de sonido pasa a desactivado")
    page.click('.lab[data-unit="a0-3"]')
    tones0 = page.evaluate("window.__tones")
    answer(page)
    check(page.evaluate("window.__tones") == tones0, "silenciado no suena nada")
    page.click("#quit")
    page.reload()
    check(page.locator("#sound").get_attribute("aria-pressed") == "false", "la preferencia de sonido se recuerda")
    page.click("#sound")

    print("== Guardado y recarga")
    page.reload()
    check(page.locator("#v-labs").is_visible(), "tras recargar sigue en la vista enlazada (#labs)")
    page.click(".nav [data-go=home]")
    check(page.locator("#c-xp").inner_text() != "0" and page.locator("#continue-t").inner_text() == "Continuar", "la XP sobrevive y el botón pasa a «Continuar»")

    print("== Repaso espaciado")
    set_state(page, "for (const it of Object.values(s.items)) it.due = '2000-01-01'")
    page.click(".nav [data-go=home]")
    check(not page.locator("#review").is_disabled() and page.locator("#n-due").is_visible(), "con expresiones vencidas: botón activo y aviso en el lateral")
    page.click("#review")
    play(page)
    check(page.locator("#d-h").inner_text() == "Repaso completado" and "Repaso al día" in " ".join(page.locator("#d-badges b").all_inner_texts()), "repaso completado con su insignia")
    page.click("#d-home")

    print("== Jefe final")
    set_state(page, "for (let i = 1; i <= 10; i++) s.units['a0-' + i] = { user: true, root: false, best: 80 }")
    page.click(".nav [data-go=labs]")
    check(not page.locator('.lab.boss[data-unit="a0-jefe"]').is_disabled(), "con 10 de 13 labs se abre el jefe")
    page.click('.lab.boss[data-unit="a0-jefe"]')
    n = play(page)
    check(n == 12, f"el jefe son 12 retos ({n})")
    check(page.locator("#d-h").inner_text() == "Root flag conseguida", "jefe derrotado sin fallos")
    nuevas = " ".join(page.locator("#d-badges b").all_inner_texts())
    check("Jefe derrotado" in nuevas and "Nivel A0 superado" in nuevas and "10 labs" in nuevas, "insignias: Jefe derrotado, Nivel A0 superado y 10 labs")
    page.click("#d-home")
    check(page.locator("#route .st.locked").count() == 4, "A1 se abre al derrotar al jefe")

    print("== Teclado")
    page.click('#route .st[data-level="1"]')
    page.click('.lab[data-unit="a1-1"]')
    for _ in range(12):
        ex = page.evaluate("window.__LEMONBYTE__.current()")
        if ex["type"] in ("meaning", "reverse", "listen", "gap"):
            break
        answer(page); page.keyboard.press("Enter")
    vals = [page.locator("#ex .opt").nth(i).get_attribute("data-v") for i in range(4)]
    key = str(next(i for i, v in enumerate(vals) if v.lower() == ex["correct"].lower()) + 1)
    page.keyboard.press(key)
    check(page.locator("#sheet.show.ok").count() == 1, f"responder con la tecla {key}")
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    check(page.locator("#sheet").is_hidden(), "Enter continúa y la hoja cerrada queda fuera del foco")
    page.keyboard.press("Escape")
    check(page.locator("#v-labs").is_visible(), "Escape sale del lab")

    print("== Prueba de nivel")
    page.click(".nav [data-go=placement]")
    while page.locator("#v-lesson").is_visible():
        answer(page); page.click("#s-next")
    check(page.locator("#d-h").inner_text() == "Tu punto de partida: C1", "todo bien: empieza en C1")
    page.click("#d-home")
    check(page.locator("#route .st.locked").count() == 0, "todos los niveles abiertos")

    print("== Búsqueda (Ctrl K)")
    page.keyboard.press("Control+k")
    check(page.locator("#search-dlg").is_visible() and page.evaluate("document.activeElement.id") == "s-input", "Ctrl K abre la búsqueda con el foco en el campo")
    page.fill("#s-input", "reunion")
    check(any("meeting" in t for t in page.locator("#s-results .s-item b").all_inner_texts()), "busca sin tildes: «reunion» encuentra «meeting»")
    page.fill("#s-input", "kick")
    page.keyboard.press("ArrowDown"); page.keyboard.press("ArrowUp"); page.keyboard.press("Enter")
    page.wait_for_timeout(150)
    check(page.locator("#search-dlg").is_hidden() and page.locator("#h-labs").inner_text() == "Pentest y cliente", "Enter lleva al lab del resultado (B2)")

    print("== Centro de ayuda")
    page.locator("body").press("?")
    check(page.locator("#help-dlg").is_visible(), "? abre la ayuda")
    page.keyboard.press("ArrowRight")
    check(page.locator("#ht-metodo").get_attribute("aria-selected") == "true", "→ pasa a la pestaña Método")
    metodo = page.locator("#hp-metodo").inner_text()
    check("≥ 70 %" in metodo and "+20 XP" in metodo and "+50 XP" in metodo and "en 30 días" in metodo, "el método sale de las constantes del motor")
    page.click("#ht-labs")
    check("100 laboratorios y 752 expresiones" in page.locator("#hp-labs").inner_text(), "la pestaña Laboratorios cuenta 100 labs y 752 expresiones")
    page.click("#ht-acerca")
    check(page.locator("#eco .eco-item").count() == 9, "Acerca de: ecosistema con 9 herramientas")
    check("Yoandy Ramírez Delgado" in page.locator("#hp-acerca").inner_text(), "Acerca de: autor")
    page.keyboard.press("Escape")
    check(page.locator("#help-dlg").is_hidden(), "Escape cierra la ayuda")

    print("== Lateral, tema y acento")
    page.locator("body").press("[")
    check("collapsed" in page.get_attribute("#app", "class"), "[ contrae el lateral")
    page.reload()
    check("collapsed" in page.get_attribute("#app", "class"), "el lateral contraído se recuerda")
    page.click("#toggle-side")
    dark = page.get_attribute("#theme", "aria-checked")
    page.click("#theme")
    check(page.get_attribute("#theme", "aria-checked") != dark, "el interruptor de tema cambia")
    page.click('[data-acc="verde"]')
    page.reload()
    check(page.evaluate("document.documentElement.dataset.accent") == "verde" and page.get_attribute("#theme", "aria-checked") != dark, "tema y acento se recuerdan")

    print("== Datos corruptos y migración")
    page.evaluate(f"localStorage.setItem('{KEY}', '{{\"xp\":\"<img src=x>\",\"units\":{{\"a0-1\":{{\"user\":1}}}}}}')")
    page.reload()
    check(page.locator("#c-xp").inner_text() == "0", "un progreso corrupto se descarta sin romper la app")
    page.evaluate(f"localStorage.removeItem('{KEY}'); localStorage.setItem('hermes-progress-v1', JSON.stringify({{ xp: 136, units: {{ 'a0-1': {{ user: true, root: true, best: 100 }} }} }}))")
    page.reload()
    check(page.locator("#c-xp").inner_text() == "136", "el progreso de HERMES 0.1 se conserva")

    print("== Móvil")
    m = browser.new_page(viewport={"width": 390, "height": 844})
    m.goto(APP)
    check(m.evaluate("document.documentElement.scrollWidth - innerWidth") == 0, "sin scroll horizontal en el inicio")
    check(m.locator(".side").is_hidden() and m.locator(".bottom").is_visible(), "en móvil: sin lateral y con barra inferior")
    m.click("#more-btn")
    check(m.locator("#more-pop").is_visible(), "«Más» abre el resto de secciones")
    m.click('#more-pop [data-go="badges"]')
    check(m.locator("#v-badges").is_visible(), "desde «Más» se llega a Insignias")
    m.click('.bottom [data-go="labs"]')
    m.click('.lab[data-unit="a0-1"]')
    check(m.evaluate("document.documentElement.scrollWidth - innerWidth") == 0, "sin scroll horizontal en el lab")
    m.screenshot(path=str(OUT / "movil-lab.png"))

    print("== Seguridad")
    check(errores == [], f"sin errores en consola ni de CSP {errores[:3]}")
    check(red == [], f"cero peticiones de red {red[:3]}")
    browser.close()

if fallos:
    print(f"\n{len(fallos)} FALLOS")
    sys.exit(1)
print("\nE2E en verde")
