"""Pruebas de la app en un navegador real (Chromium con Playwright) sobre dist/index.html, con su CSP.

Uso:  python3 tests/e2e_app.py
Recorre lo que hace una persona: jugar una máquina hasta la root flag, fallar y repetir, guardar y recargar,
repasar, hacer la prueba de nivel, usar el teclado y el tema. Comprueba que no hay errores ni peticiones de red.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = (ROOT / "dist" / "index.html").as_uri() + "?test"
OUT = ROOT / "tests" / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)
fallos = []


def check(cond, msg):
    print(("  ok  " if cond else "  FALLO ") + msg)
    if not cond:
        fallos.append(msg)


def answer(page, right=True):
    """Responde el ejercicio en curso leyendo la respuesta correcta del gancho de pruebas."""
    ex = page.evaluate("(() => { const e = window.__HERMES__.current(); return { type: e.type, correct: e.correct }; })()")
    t, correct = ex["type"], ex["correct"]
    if t in ("meaning", "reverse", "listen", "gap"):
        opts = page.locator("#ex .opt")
        values = [opts.nth(i).get_attribute("data-v") for i in range(opts.count())]
        norm = lambda s: s.lower().strip()
        idx = next(i for i, v in enumerate(values) if (norm(v) == norm(correct)) == right)
        opts.nth(idx).click()
    elif t == "type":
        page.fill("#typein", correct if right else "zzz")
        page.click("#check")
    elif t == "build":
        if right:
            for w in correct.split(" "):
                # Pulsa la primera ficha libre con esa palabra exacta (puede haber repetidas)
                page.evaluate("""(w) => [...document.querySelectorAll('#bank .tile')].find(b => !b.disabled && b.textContent === w).click()""", w)
        else:
            page.locator("#bank .tile").first.click()
        page.click("#check")
    page.wait_for_selector("#sheet.show")
    return t


def play(page, wrong_first=0):
    """Juega la lección abierta; falla las `wrong_first` primeras respuestas."""
    n = 0
    while page.locator("#v-lesson").is_visible():
        answer(page, right=n >= wrong_first)
        n += 1
        page.click("#s-next")
        if n > 60:
            raise RuntimeError("la lección no termina")
    return n


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errores, red = [], []
    page.on("pageerror", lambda e: errores.append(str(e)))
    page.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
    page.on("request", lambda r: red.append(r.url) if not r.url.startswith(("file:", "data:", "blob:")) else None)

    print("== Primera visita")
    page.goto(APP)
    check(page.locator("#continue-t").inner_text() == "Empezar", "botón «Empezar» en la primera visita")
    check(page.locator("#units .unit").count() == 4, "4 máquinas en A0")
    check(page.locator("#route .st.locked").count() == 5, "A1–C1 bloqueados al empezar")
    check(page.locator("#review").is_disabled(), "repaso desactivado sin expresiones aprendidas")

    print("== Máquina perfecta: user y root flag")
    page.click("#continue")
    check(page.locator("#v-lesson").is_visible(), "abre la lección")
    tipos = set()
    while page.locator("#v-lesson").is_visible():
        tipos.add(answer(page))
        check(page.locator("#sheet").get_attribute("class").find("ok") > 0, "respuesta correcta marcada en verde") if len(tipos) == 1 else None
        page.click("#s-next")
    check(len(tipos) >= 5, f"varios tipos de ejercicio en una lección ({', '.join(sorted(tipos))})")
    check(page.locator("#d-h").inner_text() == "Root flag conseguida", "pantalla final: root flag")
    check(page.locator("#d-acc").inner_text() == "100 %", "100 % de acierto")
    check(page.locator("#d-xp").inner_text() == "+136", "XP: 10 aciertos con combo + 20 de root = 136")
    nuevas = page.locator("#d-badges b").all_inner_texts()
    check(any("Primera flag" in b for b in nuevas) and any("Sin fallos" in b for b in nuevas), "insignias nuevas: Primera flag y Sin fallos")
    page.screenshot(path=str(OUT / "final.png"))
    page.click("#d-home")
    check(page.locator("#c-xp").inner_text() == "136", "XP en la barra")
    check(page.locator("#c-streak").inner_text() == "1", "racha de 1 día")
    card = page.locator('#units .unit[data-unit="a0-1"]')
    check(card.locator(".got-user").count() == 1 and card.locator(".got-root").count() == 1, "la máquina muestra sus dos flags")

    print("== Fallar: la expresión vuelve al final y no hay root flag")
    page.click('#units .unit[data-unit="a0-2"]')
    answer(page, right=False)
    check("ko" in page.locator("#sheet").get_attribute("class"), "respuesta incorrecta marcada")
    check("Respuesta:" in page.locator("#s-detail").inner_text(), "se enseña la respuesta correcta")
    page.click("#s-next")
    n = play(page)
    check(n == 10, f"la fallada se repite al final (11 respuestas en total: {n + 1})")
    check(page.locator("#d-acc").inner_text() == "90 %", "acierto a la primera: 90 %")
    check(page.locator("#d-h").inner_text() == "User flag conseguida", "user flag sin root")
    page.click("#d-home")

    print("== Guardado y recarga")
    page.reload()
    check(page.locator("#c-xp").inner_text() != "0", "la XP sobrevive a la recarga")
    check(page.locator('#units .unit[data-unit="a0-1"] .got-root').count() == 1, "las flags sobreviven a la recarga")
    check(page.locator("#continue-t").inner_text() == "Continuar", "el botón pasa a «Continuar»")

    print("== Repaso espaciado")
    page.evaluate("""(() => { const k = 'hermes-progress-v1'; const s = JSON.parse(localStorage.getItem(k));
      for (const it of Object.values(s.items)) it.due = '2000-01-01'; s.updatedAt = Date.now(); localStorage.setItem(k, JSON.stringify(s)); })()""")
    page.reload()
    check(not page.locator("#review").is_disabled(), "con expresiones vencidas se puede repasar")
    page.click("#review")
    play(page)
    check(page.locator("#d-h").inner_text() == "Repaso completado", "repaso completado")
    check(any("Repaso al día" in b for b in page.locator("#d-badges b").all_inner_texts()), "insignia «Repaso al día»")
    page.click("#d-home")

    print("== Teclado")
    page.click('#units .unit[data-unit="a0-3"]')
    for _ in range(12):
        ex = page.evaluate("window.__HERMES__.current()")
        if ex["type"] in ("meaning", "reverse", "listen", "gap"):
            break
        answer(page); page.keyboard.press("Enter")
    vals = [page.locator("#ex .opt").nth(i).get_attribute("data-v") for i in range(4)]
    key = str(next(i for i, v in enumerate(vals) if v.lower() == ex["correct"].lower()) + 1)
    page.keyboard.press(key)
    check(page.locator("#sheet.show.ok").count() == 1, f"responder con la tecla {key}")
    page.keyboard.press("Enter")
    check(not page.locator("#sheet").get_attribute("class").endswith("show ok"), "Enter continúa")
    page.wait_for_timeout(500)  # la hoja sale con una transición de 0,4 s
    check(page.locator("#sheet").is_hidden(), "la hoja cerrada queda oculta y fuera del orden de tabulación")
    page.click("#quit")

    print("== Prueba de nivel")
    page.click("#placement")
    while page.locator("#v-lesson").is_visible():
        answer(page); page.click("#s-next")
    check(page.locator("#d-h").inner_text() == "Tu punto de partida: C1", "todo bien: empieza en C1")
    page.click("#d-home")
    check(page.locator("#route .st.locked").count() == 0, "todos los niveles abiertos")
    check(page.locator("#units-h").inner_text() == "Máquinas del nivel C1", "muestra las máquinas de C1")
    page.click('#route .st >> nth=4')
    check(page.locator("#units-h").inner_text() == "Máquinas del nivel B2", "se puede elegir otro nivel")

    print("== Insignias y tema")
    page.click("#all-badges")
    check(page.locator("#badge-list .badge").count() == 21, "21 insignias en la lista")
    check(page.locator("#badge-list .bd.got").count() >= 4, "las conseguidas aparecen marcadas")
    page.click("#b-back")
    page.click("#theme")
    tema = page.evaluate("document.documentElement.dataset.theme")
    page.reload()
    check(page.evaluate("document.documentElement.dataset.theme") == tema, "el tema elegido se recuerda")

    print("== Datos corruptos en el navegador")
    page.evaluate("localStorage.setItem('hermes-progress-v1', '{\"xp\":\"<img src=x>\",\"units\":{\"a0-1\":{\"user\":1}}}')")
    page.reload()
    check(page.locator("#c-xp").inner_text() == "0", "un progreso corrupto se descarta sin romper la app")

    print("== Móvil")
    m = browser.new_page(viewport={"width": 390, "height": 844})
    m.goto(APP)
    check(m.evaluate("document.documentElement.scrollWidth - innerWidth") == 0, "sin scroll horizontal en el inicio")
    m.click("#continue")
    check(m.evaluate("document.documentElement.scrollWidth - innerWidth") == 0, "sin scroll horizontal en la lección")
    m.screenshot(path=str(OUT / "movil-leccion.png"))

    print("== Seguridad")
    check(errores == [], f"sin errores en consola ni de CSP {errores[:3]}")
    check(red == [], f"cero peticiones de red {red[:3]}")
    browser.close()

if fallos:
    print(f"\n{len(fallos)} FALLOS")
    sys.exit(1)
print("\nE2E en verde")
