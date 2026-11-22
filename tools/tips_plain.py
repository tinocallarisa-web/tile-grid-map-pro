# -*- coding: utf-8 -*-
"""TIPS-AND-HINTS-PLAIN.txt a partir de TIPS-AND-HINTS.md, listo para pegar en un cuadro de texto de Power BI: sin
markdown ni tablas, con el formato del resto de la cartera (Chip Slicer, Waterfall). Ejecutar desde la raíz:
    python tools/tips_plain.py
"""
import io, os, re, textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = io.open(os.path.join(ROOT, "TIPS-AND-HINTS.md"), encoding="utf-8").read().replace("\r\n", "\n")
ANCHO = 95
RAYA = "_" * 40
limpia = lambda t: re.sub(r"\*\*|`|(?<![\w*])\*(?=\S)|(?<=\S)\*(?![\w*])", "", t).strip()


def parrafo(t, sangria=""):
    return textwrap.fill(t, ANCHO, initial_indent=sangria, subsequent_indent=" " * len(sangria))


out = []
lineas = md.split("\n")
titulo = limpia(lineas[0].lstrip("# "))
out += [titulo.upper().replace("TIPS & HINTS", "TIPS & HINTS"), limpia(lineas[1]), RAYA, ""]
cab = None
primera = True
for linea in lineas[2:]:
    s = linea.rstrip()
    if s.strip() == "---":
        continue
    if s.startswith("## "):
        if not primera:
            out += ["", RAYA, ""]
        primera = False
        t = limpia(s[3:]).upper()
        out += [t, "-" * len(t)]
        cab = None
        continue
    if s.startswith("|"):
        celdas = [limpia(c) for c in s.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c) for c in celdas):
            continue
        if cab is None:
            cab = celdas
            continue
        if len(celdas) == 2:
            out.append(parrafo(f"{celdas[0]} {'.' * max(3, 22 - len(celdas[0]))} {celdas[1]}", "· "))
        else:
            out.append(parrafo(f"{celdas[0]} — " + " · ".join(f"{h}: {c}" for h, c in zip(cab[1:], celdas[1:])), "· "))
        continue
    cab = None
    if not s.strip():
        if out and out[-1] != "":
            out.append("")
        continue
    m = re.match(r"- (.*)", s)
    n = re.match(r"(\d+)\. (.*)", s)
    if m:
        out.append(parrafo(limpia(m.group(1)), "· "))
    elif n:
        out.append(parrafo(limpia(n.group(2)), f"{n.group(1)}. "))
    else:
        out.append(parrafo(limpia(s)))
txt = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip() + "\n"
io.open(os.path.join(ROOT, "TIPS-AND-HINTS-PLAIN.txt"), "w", encoding="utf-8", newline="\r\n").write(txt)
print(len(txt.splitlines()), "líneas")
