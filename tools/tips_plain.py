# -*- coding: utf-8 -*-
"""TIPS-AND-HINTS-PLAIN.txt a partir de TIPS-AND-HINTS.md: sin markdown ni tablas (los text boxes de Power BI no las
admiten). Ejecutar desde la raíz:  python tools/tips_plain.py"""
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = io.open(os.path.join(ROOT, "TIPS-AND-HINTS.md"), encoding="utf-8").read().replace("\r\n", "\n")
version = re.search(r"Versión del visual: ([\d.]+)", md).group(1)
SEP = "─" * 64
out = ["=" * 64, "TIPS & HINTS — versión texto plano para text boxes de Power BI", "=" * 64,
       "Los text boxes de Power BI no soportan tablas markdown. Este archivo",
       "usa solo texto plano y viñetas, así que se pega sin perder formato.", "",
       "Copia cada bloque (entre las líneas ─────) en un text box distinto.",
       "Sugerencia: fuente Segoe UI 10-11pt, títulos en 14pt negrita.",
       f"Versión del visual: {version}  (generado desde TIPS-AND-HINTS.md con tools/tips_plain.py)", "=" * 64, ""]
limpia = lambda t: re.sub(r"\*\*|`|(?<!\w)\*(?!\s)|(?<!\s)\*(?!\w)", "", t).strip()
cab = None
for linea in md.split("\n")[1:]:
    m = re.match(r"## \S+ Text box (\d+) — (.+)", linea)
    if m:
        out += ["", SEP, f"TEXT BOX {m.group(1)} — {m.group(2).upper()}", SEP, ""]
        cab = None
        continue
    if out[-1:] == [""] and not linea.strip() or linea.startswith(">") or linea.strip() == "---":
        continue
    if linea.startswith("|"):
        celdas = [limpia(c) for c in linea.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c) for c in celdas):
            continue
        if cab is None:
            cab = celdas
            continue
        if len(celdas) == 2:
            out.append(f"•  {celdas[0]}: {celdas[1]}")
        else:
            out.append(f"•  {celdas[0]} — " + " · ".join(f"{h}: {c}" for h, c in zip(cab[1:], celdas[1:])))
        continue
    cab = None
    out.append(limpia(linea).replace("✅", "yes").replace("❌", "no") if not linea.startswith("**") else limpia(linea))
txt = "\n".join(out).replace("✅", "yes").replace("❌", "no")
txt = re.sub(r"\n{3,}", "\n\n", txt).rstrip() + "\n"
io.open(os.path.join(ROOT, "TIPS-AND-HINTS-PLAIN.txt"), "w", encoding="utf-8", newline="\r\n").write(txt)
print(len(txt.splitlines()), "líneas")
