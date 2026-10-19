"""Regenera las capturas del README a partir de dist/index.html.

Uso:  python3 docs/capturas.py
Juega una máquina hasta la root flag para que las capturas muestren progreso real, no una pantalla vacía.
"""
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = (ROOT / "dist" / "index.html").as_uri() + "?test"
IMG = ROOT / "docs" / "img"
IMG.mkdir(parents=True, exist_ok=True)


def solve(page):
    ex = page.evaluate("(() => { const e = window.__HERMES__.current(); return { type: e.type, correct: e.correct }; })()")
    if ex["type"] in ("meaning", "reverse", "listen", "gap"):
        page.evaluate("(c) => [...document.querySelectorAll('#ex .opt')].find(b => b.dataset.v.toLowerCase() === c.toLowerCase()).click()", ex["correct"])
    elif ex["type"] == "type":
        page.fill("#typein", ex["correct"]); page.click("#check")
    else:
        for w in ex["correct"].split(" "):
            page.evaluate("(w) => [...document.querySelectorAll('#bank .tile')].find(b => !b.disabled && b.textContent === w).click()", w)
        page.click("#check")


def calm(page):
    page.wait_for_timeout(700)


with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ("light", "dark"):
        page = b.new_page(viewport={"width": 1280, "height": 860}, color_scheme=scheme, reduced_motion="reduce")
        page.goto(APP)
        for unit in ("a0-1", "a0-2"):
            page.click(f'#units .unit[data-unit="{unit}"]')
            while page.locator("#v-lesson").is_visible():
                solve(page); page.click("#s-next")
            if unit == "a0-2":
                calm(page); page.screenshot(path=str(IMG / f"final-{scheme}.png"))
            page.click("#d-home")
        calm(page); page.screenshot(path=str(IMG / f"inicio-{scheme}.png"))
        page.click('#units .unit[data-unit="a0-3"]')
        while page.evaluate("window.__HERMES__.current().type") != "gap":
            solve(page); page.click("#s-next")
        calm(page); page.screenshot(path=str(IMG / f"leccion-{scheme}.png"))
        solve(page)
        calm(page); page.screenshot(path=str(IMG / f"respuesta-{scheme}.png"))
        page.close()
    m = b.new_page(viewport={"width": 390, "height": 844}, color_scheme="dark", reduced_motion="reduce")
    m.goto(APP); m.click("#continue")
    while m.evaluate("window.__HERMES__.current().type") != "build":
        solve(m); m.click("#s-next")
    calm(m); m.screenshot(path=str(IMG / "movil-ordenar.png"))
    b.close()
print("Capturas en docs/img/")
