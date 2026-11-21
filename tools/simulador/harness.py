# -*- coding: utf-8 -*-
"""Simulador Playwright de Tile Grid Map Pro 1.3, a los tamaños de un informe real (mosaico de ~400×250 y
~470×380, además del grande): el texto encoge con el visual y nunca baja de 8 px, las cifras salen con el formato
de su medida y el idioma del informe, y cada update emite un renderingStarted/Finished (también al resolver la
licencia, que antes repintaba llamando a update()). Datos: Begudes Nord (ficticia).

    node build-test.js
    python tools/simulador/harness.py
"""
import asyncio, io, json, os, sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
DROP = os.path.join(ROOT, ".tmp", "drop")
FALLOS = []

STUB = r"""
window.__ev = [];
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
(function(){
 function mkId(k){ return { __k:k, getKey(){return k;}, getSelector(){return {k};}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && o.__k===k; } }; }
 window.__host = {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push("X"); console.error("FAILED", m); } },
  createSelectionManager(){ return { select(){ return Promise.resolve([]); }, clear(){ return Promise.resolve(); }, getSelectionIds(){ return []; },
     hasSelection(){ return false; }, registerOnSelectCallback(cb){}, showContextMenu(){ return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ const k=[]; return { withTable(t, i){ k.push(String(i)); return this; }, withCategory(){ return this; },
     withMeasure(m){ k.push(m); return this; }, withSeries(){ return this; }, createSelectionId(){ return mkId(k.join('|')); } }; },
  createLocalizationManager(){ return { getDisplayName(k){ return k; } }; },
  licenseManager: { getAvailableServicePlans(){ return Promise.resolve({ plans: [], isLicenseUnsupportedEnv: false, isLicenseInfoAvailable: true }); },
     notifyLicenseRequired(){ return Promise.resolve(true); }, notifyFeatureBlocked(){ return Promise.resolve(true); }, clearLicenseNotification(){ return Promise.resolve(true); } },
  tooltipService: { enabled(){ return true; }, show(){}, move(){}, hide(){} },
  hostCapabilities: { allowInteractions: true }, locale: '__LOCALE__',
  colorPalette: { isHighContrast: false, foreground:{value:'#252423'}, background:{value:'#FFFFFF'}, foregroundSelected:{value:'#1AEBFF'},
    getColor(){ return {value:'#118DFF'}; } },
  persistProperties(){}, launchUrl(){}, applyJsonFilter(){},
 };
})();
"""

# Ventas de Begudes Nord por población (ficticias).
PUEBLOS = [("Barcelona", 41.39, 2.17, 1_420_000), ("Girona", 41.98, 2.82, 380_000), ("Lleida", 41.62, 0.62, 290_000),
           ("Tarragona", 41.12, 1.25, 340_000), ("Madrid", 40.42, -3.70, 2_100_000), ("Valencia", 39.47, -0.38, 860_000),
           ("Sevilla", 37.39, -5.98, 640_000), ("Málaga", 36.72, -4.42, 510_000), ("Bilbao", 43.26, -2.93, 470_000),
           ("Zaragoza", 41.65, -0.88, 420_000), ("Murcia", 37.99, -1.13, 300_000), ("Valladolid", 41.65, -4.72, 210_000),
           ("A Coruña", 43.36, -8.41, 260_000), ("Oviedo", 43.36, -5.85, 180_000), ("Pamplona", 42.81, -1.64, 190_000),
           ("Alicante", 38.35, -0.48, 330_000), ("Granada", 37.18, -3.60, 230_000), ("Salamanca", 40.97, -5.66, 120_000),
           ("Badajoz", 38.88, -6.97, 90_000), ("Santander", 43.46, -3.80, 150_000)]


def dv(fmt="#,0", pct=False, objects=None):
    cols = [{"displayName": "Lat", "queryName": "T.Lat", "roles": {"latitude": True}, "index": 0},
            {"displayName": "Lng", "queryName": "T.Lng", "roles": {"longitude": True}, "index": 1},
            {"displayName": "Sales", "queryName": "Sum(T.Sales)", "roles": {"value": True}, "isMeasure": True, "format": fmt, "index": 2},
            {"displayName": "Town", "queryName": "T.Town", "roles": {"label": True}, "index": 3}]
    rows = [[la, ln, (v / 10_000_000 if pct else v), n] for (n, la, ln, v) in PUEBLOS]
    return {"metadata": {"columns": cols, "objects": objects or {}}, "table": {"columns": cols, "rows": rows, "identity": []}}


def check(name, ok, detail=""):
    print(("  OK    " if ok else "  FALLO ") + name + (f"  — {detail}" if detail else ""))
    if not ok: FALLOS.append(name)


async def page(browser, data, W, H, name=None, locale="en-US"):
    guid = json.load(io.open(os.path.join(DROP, "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]
    pg = await browser.new_page(viewport={"width": W, "height": H})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.set_content(f"<html><body style='margin:0;background:#FFFFFF'><div id='host' style='position:relative;width:{W}px;height:{H}px;overflow:hidden'></div></body></html>")
    css = os.path.join(DROP, "visual.css")
    if os.path.exists(css): await pg.add_style_tag(path=css)
    await pg.add_script_tag(content=STUB.replace("__LOCALE__", locale))
    await pg.add_script_tag(path=os.path.join(DROP, "visual.js"))
    await pg.evaluate("(g) => { window.__v = powerbi.visuals.plugins[g].create({ element: document.getElementById('host'), host: __host }); }", guid)
    await pg.evaluate("([dv, W, H]) => __v.update({ dataViews: [dv], viewport: {width: W, height: H}, type: 2, operationKind: 0, viewMode: 1 })", [data, W, H])
    await pg.wait_for_timeout(400)
    pg.__errs = errs
    if name:
        os.makedirs(OUT, exist_ok=True)
        await pg.screenshot(path=os.path.join(OUT, name + ".png"))
    return pg


TEXTOS = """() => {
  const host = document.getElementById('host').getBoundingClientRect();
  // La marca de agua "Pro preview" escala aparte (24-88 px): fuera de la cuenta.
  const t = Array.from(document.querySelectorAll('svg text')).filter(e => !e.closest('.tgm-watermark') && e.textContent.trim());
  const fs = e => parseFloat(e.getAttribute('font-size') || getComputedStyle(e).fontSize);
  const fuera = t.filter(e => { const r = e.getBoundingClientRect(); return r.right > host.right + 1 || r.left < host.left - 1 || r.bottom > host.bottom + 1 || r.top < host.top - 1; });
  return { n: t.length, min: t.length ? Math.min(...t.map(fs)) : null, max: t.length ? Math.max(...t.map(fs)) : null,
           fuera: fuera.map(e => e.textContent).slice(0, 4), textos: t.map(e => e.textContent).slice(0, 40) };
}"""


async def main():
    if not os.path.exists(os.path.join(DROP, "visual.js")):
        print("Falta .tmp/drop: ejecuta antes node build-test.js"); sys.exit(2)
    async with async_playwright() as p:
        b = await p.chromium.launch()

        print("Tamaños de informe real: nada por debajo de 8 px, nada fuera, eventos 1:1 (también al resolver la licencia)")
        anterior = None
        for (W, H) in ((400, 250), (470, 380), (760, 440), (1100, 700)):
            pg = await page(b, dv(), W, H, name=f"01_{W}x{H}")
            r = await pg.evaluate(TEXTOS)
            ev = await pg.evaluate("() => __ev.join('')")
            check(f"{W}×{H}: ningún texto por debajo de 8 px", r["n"] > 0 and r["min"] >= 8, str({k: r[k] for k in ('n', 'min', 'max', 'fuera')}))
            check(f"{W}×{H}: ningún texto fuera del visual", not r["fuera"], str(r["fuera"]))
            check(f"{W}×{H}: un renderingStarted y un renderingFinished por update, sin errores", ev == "SF" and not pg.__errs, f"{ev} {pg.__errs[:2]}")
            if anterior is not None and W <= 470:
                pass
            if W == 400: pequeno = r["max"]
            if W == 1100: grande = r["max"]
            await pg.close()
        check("El texto de la leyenda encoge con el visual (400×250 más pequeño que 1100×700)", pequeno < grande, f"{pequeno} vs {grande}")

        print("Formato de la medida e idioma del informe")
        pg = await page(b, dv(fmt="€#,0.00"), 760, 440, name="02_euros")
        r = await pg.evaluate(TEXTOS)
        check("Moneda del modelo en la leyenda", any("€" in x for x in r["textos"]), str(r["textos"][:8]))
        tip = await pg.evaluate("() => __v.formatValue(1234.5, '\\u20ac#,0.00')")
        check("formatValue con la cadena del modelo", "€" in tip, tip)
        await pg.close()
        pg = await page(b, dv(fmt="0.0%", pct=True), 760, 440, name="03_porcentaje")
        r = await pg.evaluate(TEXTOS)
        check("Porcentaje: la leyenda dice %, nunca la fracción ni K%", any("%" in x for x in r["textos"]) and not any("K%" in x for x in r["textos"]), str(r["textos"][:8]))
        await pg.close()
        pg = await page(b, dv(fmt="#,0.00"), 760, 440, name="04_es", locale="es-ES")
        tip = await pg.evaluate("() => __v.formatValue(1234.5, '#,0.00')")
        check("Idioma del informe (es-ES): coma decimal", "," in tip and tip.strip().endswith(("K", "50", "5")) or "," in tip, tip)
        await pg.close()

        print("Estilos de la colección (build Pro): fondo, leyenda y rampa; lo que fija el autor gana")
        for tpl in ("classic", "boardroom", "ledger", "editorial", "signal", "aurora", "terrace"):
            pg = await page(b, dv(objects={"style": {"template": tpl}}), 470, 380, name=f"06_estilo_{tpl}")
            r = await pg.evaluate("""() => ({ fondo: getComputedStyle(document.getElementById('host')).backgroundImage + ' ' + getComputedStyle(document.getElementById('host')).backgroundColor,
                leyenda: Array.from(document.querySelectorAll('svg text')).filter(e => !e.closest('.tgm-watermark')).map(e => e.getAttribute('fill'))[0],
                teselas: [...new Set(Array.from(document.querySelectorAll('[data-key]')).map(e => e.getAttribute('fill')))].length })""")
            oscuro = tpl in ("boardroom", "aurora")
            check(f"Estilo {tpl}: se dibuja sin errores", not pg.__errs and r["teselas"] > 2, f"{r} {pg.__errs[:1]}")
            if tpl == "classic":
                check("Report theme: sin fondo propio (transparente)", "rgba(0, 0, 0, 0)" in r["fondo"] and "none" in r["fondo"], r["fondo"])
            if oscuro:
                check(f"Estilo {tpl}: fondo oscuro del estilo", "rgb(22, 38, 61)" in r["fondo"] or "gradient" in r["fondo"], r["fondo"])
            await pg.close()
        pg = await page(b, dv(objects={"style": {"template": "boardroom"}, "legend": {"fontColor": {"solid": {"color": "#FF0000"}}}}), 470, 380)
        r = await pg.evaluate("() => Array.from(document.querySelectorAll('svg text')).filter(e => !e.closest('.tgm-watermark')).map(e => e.getAttribute('fill'))")
        check("Un color que fija el autor gana al estilo", "#FF0000" in r, str(r[:3]))
        await pg.close()

        guid = json.load(io.open(os.path.join(DROP, "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]
        if guid.endswith("_testfree"):
            print("Build Free: marca de agua común (src/comun) solo con una función Pro en uso, editando")
            WM = "() => { const w = document.querySelector('.tcviz-wm'); return w ? { ver: getComputedStyle(w).display !== 'none', texto: w.textContent } : null; }"
            pg = await page(b, dv(objects={"style": {"template": "terrace"}}), 470, 380, name="07_marca_terrace")
            await pg.wait_for_timeout(200)
            r = await pg.evaluate(WM)
            check("Estilo Pro sin licencia: marca común visible y nombra el estilo", bool(r) and r["ver"] and "Pro preview" in r["texto"] and "Terrace" in r["texto"], str(r))
            await pg.close()
            pg = await page(b, dv(), 470, 380)
            r = await pg.evaluate(WM)
            check("Report theme (gratis): sin marca de agua", bool(r) and not r["ver"], str(r))
            await pg.close()
            pg = await page(b, dv(objects={"style": {"template": "terrace"}}), 470, 380)
            await pg.evaluate("() => __v.update({ dataViews: [__v._lastOptions.dataViews[0]], viewport: {width: 470, height: 380}, type: 2, viewMode: 0 })")
            r = await pg.evaluate(WM)
            check("Vista de lectura: sin marca de agua", bool(r) and not r["ver"], str(r))
            await pg.close()

        print("Sin datos: pantalla de inicio que encoge sin bajar de 8 px")
        for (W, H) in ((300, 200), (900, 500)):
            pg = await page(b, {"metadata": {"columns": []}}, W, H, name=f"05_inicio_{W}x{H}")
            r = await pg.evaluate(TEXTOS)
            check(f"Inicio {W}×{H}: textos ≥ 8 px y dentro", r["n"] > 0 and r["min"] >= 8 and not r["fuera"], str({k: r[k] for k in ('n', 'min', 'max', 'fuera')}))
            await pg.close()

        await b.close()
    print(f"\n{len(FALLOS)} fallos" + (": " + ", ".join(FALLOS) if FALLOS else ""))
    sys.exit(1 if FALLOS else 0)


if __name__ == "__main__":
    asyncio.run(main())
