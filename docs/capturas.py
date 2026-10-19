"""Regenera las capturas del README a partir de dist/index.html.

Uso:  python3 docs/capturas.py
Juega varios labs antes de capturar para que se vea progreso real, no una pantalla vacía.
"""
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = (ROOT / "dist" / "index.html").as_uri() + "?test"
IMG = ROOT / "docs" / "img"
IMG.mkdir(parents=True, exist_ok=True)


def solve(page, right=True):
    ex = page.evaluate("(() => { const e = window.__LEMONBYTE__.current(); return { type: e.type, correct: e.correct }; })()")
    if ex["type"] in ("meaning", "reverse", "listen", "gap"):
        page.evaluate("([c, r]) => [...document.querySelectorAll('#ex .opt')].find(b => (b.dataset.v.toLowerCase() === c.toLowerCase()) === r).click()", [ex["correct"], right])
    elif ex["type"] == "type":
        page.fill("#typein", ex["correct"]); page.click("#check")
    else:
        for w in ex["correct"].split(" "):
            page.evaluate("(w) => [...document.querySelectorAll('#bank .tile')].find(b => !b.disabled && b.textContent === w).click()", w)
        page.click("#check")


def play(page, unit, wrong_first=0):
    page.click(f'.lab[data-unit="{unit}"]')
    n = 0
    while page.locator("#v-lesson").is_visible():
        solve(page, right=n >= wrong_first); n += 1; page.click("#s-next")


def calm(page):
    page.wait_for_timeout(600)


with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ("light", "dark"):
        page = b.new_page(viewport={"width": 1440, "height": 900}, color_scheme=scheme, reduced_motion="reduce")
        page.goto(APP)
        page.click(".nav [data-go=labs]")
        for i, u in enumerate(["a0-1", "a0-2", "a0-3", "a0-4", "a0-5", "a0-6"]):
            play(page, u, wrong_first=1 if i % 3 == 2 else 0)
            if u == "a0-6":
                calm(page); page.screenshot(path=str(IMG / f"final-{scheme}.png"))
            page.click("#d-home")
        calm(page); page.screenshot(path=str(IMG / f"labs-{scheme}.png"))
        page.click(".nav [data-go=home]"); calm(page); page.screenshot(path=str(IMG / f"inicio-{scheme}.png"))
        page.click(".nav [data-go=progress]"); calm(page); page.screenshot(path=str(IMG / f"progreso-{scheme}.png"))
        page.click("#open-help"); page.click("#ht-metodo"); calm(page); page.screenshot(path=str(IMG / f"ayuda-{scheme}.png"))
        page.keyboard.press("Escape")
        page.click(".nav [data-go=labs]"); page.click('.lab[data-unit="a0-7"]')
        while page.evaluate("window.__LEMONBYTE__.current().type") != "gap":
            solve(page); page.click("#s-next")
        solve(page); calm(page); page.screenshot(path=str(IMG / f"respuesta-{scheme}.png"))
        page.close()
    m = b.new_page(viewport={"width": 390, "height": 844}, color_scheme="dark", reduced_motion="reduce")
    m.goto(APP); m.click(".bottom [data-go=labs]"); calm(m); m.screenshot(path=str(IMG / "movil-labs.png"))
    m.click('.lab[data-unit="a0-1"]')
    while m.evaluate("window.__LEMONBYTE__.current().type") != "build":
        solve(m); m.click("#s-next")
    calm(m); m.screenshot(path=str(IMG / "movil-ordenar.png"))
    b.close()
print("Capturas en docs/img/")
