# -*- coding: utf-8 -*-
"""
Imágenes de la oferta (1366×768) con el visual REAL: el bundle de la build de prueba (.tmp/drop, `node build-test.js`)
pintado en un navegador sin cabeza, con los datos de Begudes Nord (empresa ficticia, datos/demo_rtm) y la plantilla
TCViz (fondo #FAF9F5, tarjetas blancas, Poppins, paleta del tema TCViz). Plan de capturas aprobado el 27-10-2026.

Escribe en assets/: Screenshot_1.png (objetivo), Screenshot_2.png (tramo de la leyenda), Screenshot_3.png (estilos) y
.tmp/mapa_objetivo.jpg, la imagen que lleva dentro la infografía (docs/infographic.html → assets/infographic.png). Las frases de conclusión se calculan de los datos.

    node build-test.js && python tools/simulador/imagenes.py
"""
import asyncio, base64, csv, io, json, os, sys
from collections import defaultdict
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATOS = r"C:\tcviz\datos\demo_rtm\csv_en\fact_spain.csv"
POPPINS = r"C:\tcviz\datos\demo_rtm\tema\Poppins"
LOGO = r"C:\tcviz\web\logos\tcviz-logo-light.svg"
ASSETS = os.path.join(ROOT, "assets")
TMP = os.path.join(ROOT, ".tmp")

# Paleta del tema TCViz (datos/demo_rtm/tema/TCViz.json): lo que Power BI daría al visual con ese tema.
PALETA = """colorPalette: { isHighContrast: false, foreground:{value:'#3D3929'}, background:{value:'#FFFFFF'},
    foregroundNeutralSecondary:{value:'#6B6A63'}, negative:{value:'#C0392B'}, positive:{value:'#3E9C5B'},
    foregroundSelected:{value:'#1AEBFF'}, getColor(){ return {value:'#2B6CB0'}; } },"""


def num(x):
    """Celda numérica o None (un punto de venta nuevo no tiene venta del año anterior)."""
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def leer():
    filas = list(csv.DictReader(io.open(DATOS, encoding="utf-8-sig")))
    return filas


def dataview(filas, objetivo=False, objects=None):
    cols = [{"displayName": "Latitude", "queryName": "fact_spain.latitude", "roles": {"latitude": True}, "index": 0},
            {"displayName": "Longitude", "queryName": "fact_spain.longitude", "roles": {"longitude": True}, "index": 1},
            {"displayName": "Net sales", "queryName": "Sum(fact_spain.net_sales)", "roles": {"value": True}, "isMeasure": True, "format": "€#,0", "index": 2},
            {"displayName": "Province", "queryName": "fact_spain.province", "roles": {"label": True}, "index": 3}]
    rows = [[float(f["latitude"]), float(f["longitude"]), num(f["net_sales"]), f["province"]] for f in filas]
    if objetivo:
        cols.append({"displayName": "Net sales LY", "queryName": "Sum(fact_spain.net_sales_py)", "roles": {"target": True}, "isMeasure": True, "format": "€#,0", "index": 4})
        rows = [r + [num(f["net_sales_py"])] for r, f in zip(rows, filas)]
    return {"metadata": {"columns": cols, "objects": objects or {}}, "table": {"columns": cols, "rows": rows, "identity": []}}


def uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()


def plantilla(pregunta, subtitulo, cuerpo, lateral):
    fuentes = "".join(f"@font-face{{font-family:'Poppins';font-weight:{w};src:url('{uri(os.path.join(POPPINS, f), 'font/ttf')}')}}"
                      for w, f in ((400, "Poppins-Regular.ttf"), (500, "Poppins-Medium.ttf"), (600, "Poppins-SemiBold.ttf")))
    return f"""<html><head><style>{fuentes}
body{{margin:0;background:#FAF9F5;font-family:'Segoe UI',sans-serif;color:#3D3929}}
#lienzo{{width:1366px;height:768px;box-sizing:border-box;padding:22px 30px;display:flex;flex-direction:column;gap:16px}}
.cab{{display:flex;align-items:center;gap:20px}} .cab img{{height:40px}} .sep{{width:1px;height:40px;background:#DAD9D4}}
.cab h1{{font-family:Poppins;font-weight:600;font-size:25px;margin:0;line-height:1.15}}
.cab p{{margin:2px 0 0;font-size:13px;color:#6B6A63}}
.fila{{display:flex;gap:16px;flex:1;min-height:0}}
.tarjeta{{background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(61,57,41,.10);padding:14px;box-sizing:border-box}}
.lat{{width:300px;display:flex;flex-direction:column;gap:14px}}
.lat h3{{font-family:Poppins;font-weight:600;font-size:14px;margin:0 0 6px;color:#2B6CB0}}
.lat p{{margin:0;font-size:13.5px;line-height:1.5;color:#535146}} .lat b{{color:#3D3929}}
.kpi .n{{font-family:Poppins;font-weight:600;font-size:30px;line-height:1.1}} .kpi .t{{font-size:12.5px;color:#6B6A63}}
.host{{position:relative;overflow:hidden}}
</style></head><body><div id="lienzo">
<div class="cab"><img src="{uri(LOGO, 'image/svg+xml')}"><div class="sep"></div><div><h1>{pregunta}</h1><p>{subtitulo}</p></div></div>
<div class="fila">{cuerpo}<div class="lat">{lateral}</div></div></div></body></html>"""


async def montar(b, html, hosts):
    """hosts: [(id, dataview, w, h)] → crea un visual en cada uno."""
    guid = json.load(io.open(os.path.join(H.DROP, "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]
    pg = await b.new_page(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
    await pg.set_content(html)
    await pg.add_style_tag(path=os.path.join(H.DROP, "visual.css"))
    stub = H.STUB.replace("__LOCALE__", "en-US")
    # La paleta del stub del simulador se cambia por la del tema TCViz.
    stub = stub.replace(stub[stub.index("  colorPalette:"):stub.index("  persistProperties")], "  " + PALETA + "\n")
    await pg.add_script_tag(content=stub)
    await pg.add_script_tag(path=os.path.join(H.DROP, "visual.js"))
    for hid, dv, w, h in hosts:
        await pg.evaluate("""([g, id, dv, w, h]) => { const v = powerbi.visuals.plugins[g].create({ element: document.getElementById(id), host: __host });
            window['v_' + id] = v; v.update({ dataViews: [dv], viewport: {width: w, height: h}, type: 2, operationKind: 0, viewMode: 1 }); }""",
                          [guid, hid, dv, w, h])
    await pg.wait_for_timeout(500)
    return pg


def provincias(filas):
    act, py = defaultdict(float), defaultdict(float)
    for f in filas:
        a, b = num(f["net_sales"]), num(f["net_sales_py"])
        if a is not None and b is not None:   # comparar lo comparable: solo puntos con las dos cifras
            act[f["province"]] += a; py[f["province"]] += b
    return act, py


async def main():
    if not os.path.exists(os.path.join(H.DROP, "visual.js")):
        print("Falta .tmp/drop: node build-test.js"); sys.exit(2)
    filas = leer()
    act, py = provincias(filas)
    detras = sorted([p for p in act if py[p] and act[p] < py[p]], key=lambda p: act[p] / py[p] - 1)
    total, total_py = sum(act.values()), sum(py.values())
    var_total = total / total_py - 1
    peor = detras[0] if detras else None
    W, Hh = 1000, 610
    sub = "Tile Grid Map Pro · Begudes Nord · fictitious company · 9,063 outlets · 2025"
    os.makedirs(ASSETS, exist_ok=True); os.makedirs(TMP, exist_ok=True)

    async with async_playwright() as p:
        b = await p.chromium.launch()

        # 1 · Objetivo: venta contra el año anterior, hexágonos.
        cuerpo = f'<div class="tarjeta host" id="m1" style="width:{W}px;height:{Hh}px;padding:0"></div>'
        lat = (f'<div class="tarjeta kpi"><div class="n">{var_total:+.1%}</div><div class="t">Net sales vs last year, Spain</div></div>'
               f'<div class="tarjeta kpi"><div class="n">{len(detras)} of {len(act)}</div><div class="t">provinces behind last year</div></div>'
               f'<div class="tarjeta"><h3>Reading the map</h3><p>Each tile is coloured by its variance against <b>Target</b> — here, last '
               f'year\'s sales. Red is behind, green ahead, on a scale centred on 0% so +10% and −10% weigh the same.'
               + (f' The weakest province is <b>{peor}</b> ({act[peor] / py[peor] - 1:+.1%}).' if peor else "") + '</p></div>')
        pg = await montar(b, plantilla("Which areas are behind last year?", sub, cuerpo, lat),
                          [("m1", dataview(filas, objetivo=True, objects={"mapSettings": {"tileShape": "hexagon"}}), W, Hh)])
        await pg.screenshot(path=os.path.join(ASSETS, "Screenshot_1.png"), clip={"x": 0, "y": 0, "width": 1366, "height": 768})
        await pg.close()
        # El mapa de la infografía, a la medida exacta de su hueco (16:9, 775×436): con otra proporción se recorta.
        pg = await montar(b, '<html><body style="margin:0;background:#fff"><div id="mi" style="position:relative;width:775px;height:436px;overflow:hidden"></div></body></html>',
                          [("mi", dataview(filas, objetivo=True, objects={"mapSettings": {"tileShape": "hexagon"}}), 775, 436)])
        el = await pg.query_selector("#mi")
        await el.screenshot(path=os.path.join(TMP, "mapa_objetivo.jpg"), type="jpeg", quality=85)
        await pg.close()

        # 2 · Tramo de la leyenda: arrastre sobre el último tercio del degradado.
        cuerpo = f'<div class="tarjeta host" id="m2" style="width:{W}px;height:{Hh}px;padding:0"></div>'
        pg = await montar(b, plantilla("Where do outlets sell the most?", sub, cuerpo, ""),
                          [("m2", dataview(filas, objects={"mapSettings": {"aggregationType": "average"}}), W, Hh)])
        await pg.evaluate("""() => { const bar = document.querySelector('#m2 [data-o=legend] rect[fill^="url"]'); const r = bar.getBoundingClientRect();
            bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.x + r.width * 0.34, clientY: r.y + 2 }));
            window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.x + r.width, clientY: r.y + 2 }));
            window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.x + r.width, clientY: r.y + 2 })); }""")
        await pg.wait_for_timeout(300)
        nota = await pg.evaluate("() => Array.from(document.querySelectorAll('#m2 svg > text')).map(e => e.textContent).find(t => t.includes('range')) || ''")
        lat = ('<div class="tarjeta"><h3>Pick a range in the legend</h3><p>Drag across the colour bar — or click a class, rule or '
               'category — and only the tiles in that range stay in full colour.</p></div>'
               f'<div class="tarjeta kpi"><div class="n" style="font-size:22px">{nota.split("·")[0].strip()}</div>'
               f'<div class="t">{nota.split("·")[1].strip() if "·" in nota else ""}</div></div>'
               '<div class="tarjeta"><h3>Free</h3><p>It only affects the map: the report is not filtered and nothing is saved. '
               'Click the bar again to clear it. Here: average net sales per outlet in each tile.</p></div>')
        await pg.evaluate("(h) => { document.querySelector('.lat').innerHTML = h; }", lat)
        await pg.screenshot(path=os.path.join(ASSETS, "Screenshot_2.png"), clip={"x": 0, "y": 0, "width": 1366, "height": 768})
        await pg.close()

        # 3 · Estilos: el mismo mapa en Report theme y en tres estilos de la colección.
        w3, h3 = 320, 300
        estilos = [("classic", "Report theme"), ("boardroom", "Boardroom"), ("ledger", "Ledger"), ("terrace", "Terrace")]
        celdas = "".join(f'<div style="display:flex;flex-direction:column;gap:6px"><div style="font-family:Poppins;font-weight:600;font-size:14px">{n}'
                         f'{"" if t == "classic" else " <span style=\'font-size:11px;color:#9C87F5\'>PRO</span>"}</div>'
                         f'<div class="tarjeta host" id="e_{t}" style="width:{w3}px;height:{h3}px;padding:0"></div></div>' for t, n in estilos)
        cuerpo = f'<div style="display:grid;grid-template-columns:repeat(2,{w3}px);gap:14px 18px;align-content:start">{celdas}</div>'
        lat = ('<div class="tarjeta"><h3>Style template</h3><p><b>Report theme</b> (free) takes its colours from your report theme, so the map '
               'matches the page.</p><p style="margin-top:8px">Six collection styles (Pro) — Boardroom, Ledger, Editorial, Signal, Aurora, '
               'Terrace — set the ramp, legend, border colour and background in one click. A colour you set yourself always wins.</p></div>'
               '<div class="tarjeta"><h3>Native</h3><p>Highlighting from other visuals, on-object formatting, report page tooltips, '
               'keyboard and high contrast, twelve languages. No network requests.</p></div>')
        html = plantilla("One map, the look of your report", sub, cuerpo, lat).replace('.lat{width:300px', '.lat{width:560px')
        pg = await montar(b, html, [(f"e_{t}", dataview(filas, objects={"style": {"template": t}, "mapSettings": {"tileShape": "hexagon", "aggregationType": "average"}}), w3, h3) for t, _ in estilos])
        await pg.screenshot(path=os.path.join(ASSETS, "Screenshot_3.png"), clip={"x": 0, "y": 0, "width": 1366, "height": 768})
        await pg.close()
        await b.close()
    print("assets/Screenshot_1-3.png y .tmp/mapa_objetivo.jpg ·", f"{len(detras)}/{len(act)} provincias por detrás, total {var_total:+.1%}")


if __name__ == "__main__":
    asyncio.run(main())
