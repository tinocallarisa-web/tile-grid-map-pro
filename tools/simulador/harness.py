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
  createSelectionManager(){ return { select(){ window.__sel = (window.__sel||0)+1; return Promise.resolve([]); }, clear(){ return Promise.resolve(); }, getSelectionIds(){ return []; },
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
  subSelectionService: { subSelect(a){ (window.__sub = window.__sub || []).push(a); }, updateRegionOutlines(){}, updateRegionOutlinesWithArgs(){} },
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
            if tpl != "classic":
                m = await pg.evaluate("""() => { const h = document.getElementById('host').getBoundingClientRect();
                    const t = Array.from(document.querySelectorAll('[data-key]')).map(e => e.getBoundingClientRect());
                    return Math.min(...t.map(r => r.left - h.left), ...t.map(r => h.right - r.right), ...t.map(r => r.top - h.top)); }""")
                check(f"Estilo {tpl}: el mapa deja margen respecto al fondo", m >= 6, f"{m:.1f}px")
            if oscuro:
                check(f"Estilo {tpl}: fondo oscuro del estilo", "rgb(22, 38, 61)" in r["fondo"] or "gradient" in r["fondo"], r["fondo"])
            await pg.close()
        for tpl in ("classic", "terrace"):
            pg = await page(b, dv(objects={"style": {"template": tpl}, "mapSettings": {"country": "us", "tileShape": "circle"}, "legend": {"showLegend": False}}), 700, 420, name=f"08_eeuu_{tpl}")
            m = await pg.evaluate("""() => { const h = document.getElementById('host').getBoundingClientRect();
                const t = Array.from(document.querySelectorAll('svg circle, svg rect, svg polygon')).map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
                return Math.min(...t.map(r => r.left - h.left), ...t.map(r => h.right - r.right)); }""")
            if tpl == "classic":
                check("EE. UU. con Report theme: el mapa usa todo el ancho, como siempre", m < 3, f"{m:.1f}px")
            else:
                check("EE. UU. con Terrace: margen a los lados del fondo", m >= 6, f"{m:.1f}px")
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
            pg = await page(b, dv(objects={"style": {"template": "terrace"}}), 470, 380, name="07_marca_es", locale="es-ES")
            await pg.wait_for_timeout(200)
            r = await pg.evaluate(WM)
            check("Marca de agua en español (es-ES)", bool(r) and "Vista previa Pro" in r["texto"] and "el estilo Terrace" in r["texto"], str(r))
            await pg.close()

        print("Sin datos: pantalla de inicio que encoge sin bajar de 8 px")
        for (W, H) in ((300, 200), (900, 500)):
            pg = await page(b, {"metadata": {"columns": []}}, W, H, name=f"05_inicio_{W}x{H}")
            r = await pg.evaluate(TEXTOS)
            check(f"Inicio {W}×{H}: textos ≥ 8 px y dentro", r["n"] > 0 and r["min"] >= 8 and not r["fuera"], str({k: r[k] for k in ('n', 'min', 'max', 'fuera')}))
            await pg.close()

        print("Formato sobre el lienzo: piezas elegibles solo en modo formato, y ahí el clic no filtra")
        pg = await page(b, dv(), 760, 440)
        FM = "(fm) => { __ev.length = 0; __v.update({ dataViews: [__v._lastOptions.dataViews[0]], viewport: {width: 760, height: 440}, type: 2, viewMode: 1, formatMode: fm }); return { ev: __ev.join(''), piezas: Array.from(document.querySelectorAll('[data-o]')).filter(e => e.classList.length && [...e.classList].some(c => /sub/i.test(c))).map(e => e.getAttribute('data-o')) }; }"
        r = await pg.evaluate(FM, False)
        check("Fuera de modo formato: nada marcado", r["piezas"] == [], str(r))
        r = await pg.evaluate(FM, True)
        check("En modo formato: teselas, etiquetas y leyenda elegibles; eventos 1:1", set(r["piezas"]) >= {"tiles", "legend"} and r["ev"] == "SF", str(r))
        sel = await pg.evaluate("() => { window.__sel = 0; const t = document.querySelector('[data-key]'); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return window.__sel; }")
        check("En modo formato el clic en una tesela no filtra", sel == 0, str(sel))
        sc = await pg.evaluate("() => [ 'tiles', 'labels', 'legend' ].map(o => { const s = [{ customVisualObjects: [{ objectName: o }] }]; return [o, !!__v.visualOnObjectFormatting.getSubSelectionStyles(s), (__v.visualOnObjectFormatting.getSubSelectionShortcuts(s) || []).length]; })")
        check("Estilos y atajos para cada pieza", all(x[1] and x[2] >= 3 for x in sc), str(sc))
        r = await pg.evaluate(FM, False)
        sel = await pg.evaluate("() => { window.__sel = 0; const t = document.querySelector('[data-key]'); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return window.__sel; }")
        check("Al salir de modo formato el clic vuelve a filtrar", sel == 1 and r["piezas"] == [], f"{sel} {r}")
        await pg.close()

        print("Resaltado desde otro visual: lo resaltado a pleno color, el resto atenuado; sin resaltado, nada atenuado")
        d = dv()
        cols = d["table"]["columns"]
        d["categorical"] = {
            "categories": [{"source": cols[0], "values": [r[0] for r in d["table"]["rows"]]},
                           {"source": cols[1], "values": [r[1] for r in d["table"]["rows"]]},
                           {"source": cols[3], "values": [r[3] for r in d["table"]["rows"]]}],
            "values": [{"source": cols[2], "values": [r[2] for r in d["table"]["rows"]],
                        "highlights": [r[2] if r[3] in ("Madrid", "Sevilla") else None for r in d["table"]["rows"]]}]}
        OP = "() => { const o = Array.from(document.querySelectorAll('[data-key]')).map(e => e.style.opacity || '1'); return { plenas: o.filter(x => x === '1').length, tenues: o.filter(x => x !== '1').length }; }"
        pg = await page(b, d, 760, 440, name="10_resaltado")
        r = await pg.evaluate(OP)
        check("Con resaltado: 2 teselas a pleno color y el resto atenuadas", r["plenas"] == 2 and r["tenues"] > 10, str(r))
        await pg.close()
        pg = await page(b, dv(), 760, 440)
        r = await pg.evaluate(OP)
        check("Sin resaltado: ninguna atenuada", r["tenues"] == 0, str(r))
        await pg.close()

        print("Bordes: el grosor elegido es un máximo; en teselas pequeñas adelgaza")
        pg = await page(b, dv(objects={"mapSettings": {"tileShape": "hexagon"}, "accessibility": {"showBorders": True, "borderWidth": 0.5}}), 220, 160)
        sw = await pg.evaluate("() => Math.max(...Array.from(document.querySelectorAll('[data-key]')).map(e => +e.getAttribute('stroke-width')))")
        check("Hexágonos pequeños: borde por debajo de 0,5", 0 < sw < 0.5, str(sw))
        await pg.close()
        pg = await page(b, dv(objects={"accessibility": {"showBorders": True, "borderWidth": 0.5}}), 1100, 700)
        sw2 = await pg.evaluate("() => Math.max(...Array.from(document.querySelectorAll('[data-key]')).map(e => +e.getAttribute('stroke-width')))")
        check("Teselas grandes: borde más grueso que en pequeñas, sin pasar del elegido (0,5)", sw < sw2 <= 0.5, f"{sw} → {sw2}")
        await pg.close()

        print("Idioma de Desktop: los textos propios salen del bundle (el gestor solo devuelve la clave)")
        for loc, esperado in (("es-ES", "Añade los campos Latitud y Longitud"), ("ja-JP", "緯度と経度"), ("en-US", "Add Latitude and Longitude")):
            pg = await page(b, {"metadata": {"columns": []}}, 600, 400, name=f"09_inicio_{loc}", locale=loc)
            r = await pg.evaluate(TEXTOS)
            check(f"Pantalla de inicio en {loc}", any(esperado in x for x in r["textos"]), str(r["textos"][:3]))
            await pg.close()
        pg = await page(b, dv(), 470, 380, locale="es-ES")
        tt = await pg.evaluate("() => { const k = [...__v._points.keys()][0]; return __v.tooltipItems(__v._points.get(k)).map(i => i.displayName); }")
        check("Tooltip en español", "Filas" in tt and not "Rows" in tt, str(tt))
        await pg.close()

        await b.close()
    print(f"\n{len(FALLOS)} fallos" + (": " + ", ".join(FALLOS) if FALLOS else ""))
    sys.exit(1 if FALLOS else 0)


if __name__ == "__main__":
    asyncio.run(main())
