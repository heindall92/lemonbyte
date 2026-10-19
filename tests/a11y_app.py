"""Accesibilidad con axe-core (WCAG 2.2 A/AA) en todas las vistas, cada tipo de ejercicio y la hoja de respuesta,
en tema claro y oscuro, escritorio y móvil.

Uso:  python3 tests/a11y_app.py     (falla si hay alguna infracción; detalle en tests/artifacts/a11y.json)
axe-core se inyecta con la CSP desactivada solo en este contexto de prueba; la CSP se prueba en e2e_app.py.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = (ROOT / "dist" / "index.html").as_uri() + "?test"
AXE = (ROOT / "tests" / "vendor" / "axe.min.js").read_text()
OUT = ROOT / "tests" / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]


def settle(page):
    """Espera a que terminen las animaciones para que axe mida los colores finales."""
    page.wait_for_timeout(120)
    page.evaluate("Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))")


def correct_answer(page):
    ex = page.evaluate("(() => { const e = window.__HERMES__.current(); return { type: e.type, correct: e.correct }; })()")
    if ex["type"] in ("meaning", "reverse", "listen", "gap"):
        page.evaluate("(c) => [...document.querySelectorAll('#ex .opt')].find(b => b.dataset.v.toLowerCase() === c.toLowerCase()).click()", ex["correct"])
    elif ex["type"] == "type":
        page.fill("#typein", ex["correct"]); page.click("#check")
    else:
        for w in ex["correct"].split(" "):
            page.evaluate("(w) => [...document.querySelectorAll('#bank .tile')].find(b => !b.disabled && b.textContent === w).click()", w)
        page.click("#check")


def states(page):
    yield "inicio"
    page.click("#continue")
    seen = set()
    while page.locator("#v-lesson").is_visible():
        t = page.evaluate("window.__HERMES__.current().type")
        if t not in seen:
            seen.add(t)
            yield f"ejercicio/{t}"
        correct_answer(page)
        if len(seen) == 1:
            yield "hoja/acierto"
        page.click("#s-next")
    yield "final"
    page.click("#d-home")
    page.click('#units .unit[data-unit="a0-2"]')
    t = page.evaluate("window.__HERMES__.current().type")
    if t == "type":
        page.fill("#typein", "zzz"); page.click("#check")
    elif t == "build":
        page.locator("#bank .tile").first.click(); page.click("#check")
    else:
        page.evaluate("(c) => [...document.querySelectorAll('#ex .opt')].find(b => b.dataset.v.toLowerCase() !== c.toLowerCase()).click()", page.evaluate("window.__HERMES__.current().correct"))
    yield "hoja/fallo"
    page.click("#quit")
    page.click("#all-badges")
    yield "insignias"
    page.click("#b-back")
    page.click('#route .st >> nth=3')
    yield "nivel bloqueado"


results, total = {}, 0
with sync_playwright() as p:
    browser = p.chromium.launch()
    for scheme in ("light", "dark"):
        for w, h in ((1280, 900), (390, 844)):
            ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, bypass_csp=True)
            page = ctx.new_page()
            page.goto(APP)
            for name in states(page):
                settle(page)
                page.add_script_tag(content=AXE)
                v = page.evaluate("(tags) => axe.run(document, { runOnly: tags }).then(r => r.violations.map(v => ({ id: v.id, n: v.nodes.length, where: v.nodes.slice(0, 3).map(x => x.target.join(' ')) })))", TAGS)
                key = f"{scheme}/{w}/{name}"
                results[key] = v
                total += len(v)
                print(("  ok  " if not v else "  FALLO ") + key + ("" if not v else f" {v}"))
            ctx.close()
    browser.close()

(OUT / "a11y.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
if total:
    print(f"\n{total} infracciones de accesibilidad")
    sys.exit(1)
print(f"\naxe-core: 0 infracciones en {len(results)} estados")
