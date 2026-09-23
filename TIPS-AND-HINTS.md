# Tips & Hints — página para el .pbix de muestra

> Microsoft marca como *soft failure* los envíos cuyo `.pbix` de muestra no incluye
> orientación de uso. Crea una página nueva llamada **"Tips & Hints"** en Power BI Desktop
> y copia cada bloque de abajo en un **text box** independiente.
> Versión del visual: 1.2.0.0

---

## 📦 Text box 1 — Getting Started

**GETTING STARTED**

1. Add **Tile Grid Map Pro** from the Visualizations pane.
2. Put a latitude column in **Latitude** and a longitude column in **Longitude** (decimal degrees, e.g. `40.4168`, `-3.7038`).
3. Put a number in **Value** — it colours each tile.
4. Format pane → **Map Settings** → **Country / Region**.

No shapefiles, no GIS setup, no code.

📺 Walkthrough: https://www.youtube.com/watch?v=iCXAk3kI9nE

---

## 🧭 Text box 2 — How the map is built

**HOW THE MAP IS BUILT**

1. **Coordinates** — rows with a blank latitude or longitude are skipped ("without coordinates").
2. **Tile** — each point goes to its map cell. A coastal point that lands in the sea moves to the nearest land cell within 3 cells. Farther points count as "outside the map" — filter other countries out with a slicer.
3. **Aggregate** — the rows in a tile are combined (Auto follows the field well; model measures use Sum). Blanks are ignored.
4. **Colour** — colour rules first (if enabled), then the colour scale. Tiles without a value use No Data Color.

Notes under the map tell you how many rows were not shown and why.

---

## 🎯 Text box 3 — Field Wells

**FIELD WELLS**

| Field well | What it does |
|---|---|
| **Latitude / Longitude** | Required. Decimal degrees, WGS84. |
| **Value** | Number that colours each tile. |
| **Size (Pro)** | Second measure: bigger value, bigger tile. Not used with Custom TopoJSON. |
| **Tooltips** | Up to 10 extra fields on hover. |
| **Label** | City or region name, shown in tooltips and on small tiles. |
| **Category** | Group for the Categorical (Pro) scale: each tile takes its most frequent category. |

**Rows:** Free uses the first **500 rows**; Pro uses all rows up to **30,000** (Power BI's limit).

---

## ⚙️ Text box 4 — Format Pane

**FORMAT PANE**

**Map Settings** — Country / Region (27 maps + Custom TopoJSON Pro) · Tile Shape (Square; Circle, Hexagon Pro) · Correct Latitude Distortion · Value Aggregation (Auto, Sum, Average, Count, Min, Max) · Show Empty Cells · Show Cell Labels · Label Font Size · Label Min Tile Size · Decimal Places

**Color Scale** — Sequential · Quantile (Pro) · Diverging (Pro) · Categorical (Pro) · Color Min / Mid / Max (Pro) · No Data Color

**Legend** — Show Legend · Position (Bottom / Top) · Font · Text Size · Text Color

**Accessibility** — cell borders, selection ring colour and width

**Conditional Formatting** — the visual's own 3 colour rules. Turn on **Enable Rules** in the card header. For a percent field type `25` for 25%.

---

## 🔓 Text box 5 — Free vs Pro

**FREE VS PRO**

| Feature | Free | Pro |
|---|:---:|:---:|
| 27 built-in maps | ✅ | ✅ |
| Rows used | First 500 | Up to 30,000 |
| Tile shape | Square | Square · Circle · Hexagon |
| Latitude distortion correction | ✅ | ✅ |
| Aggregation, labels, legend, tooltips | ✅ | ✅ |
| Colour rules (3) with legend | ✅ | ✅ |
| Keyboard, high contrast, cross-filter | ✅ | ✅ |
| Sequential colours | Fixed blue | Your colours |
| Quantile scale | ❌ | ✅ |
| Diverging scale | ❌ | ✅ |
| Categorical scale (by Category field) | ❌ | ✅ |
| Size role | ❌ | ✅ |
| Custom TopoJSON regions | ❌ | ✅ |

**TRY PRO BEFORE YOU BUY**

While you are editing a report WITHOUT a licence, a Pro feature you turn on is drawn
WORKING, under a "Pro preview" watermark that names it, and Power BI shows its own notice
with the Upgrade option. Turn the setting off and the watermark goes with it.

In READING VIEW — and anywhere Power BI cannot check licences, such as Publish to Web,
embedding or export — the free result is drawn with no watermark and no prompt, so a
published report never uses a feature you have not paid for. The preview applies only to the
setting you actually changed, not to every Pro option at once.

30-day free trial on Microsoft AppSource.

---

## 💡 Text box 6 — Tips

**TIPS**

1. **Averages:** a model measure is summed per tile. Choose *Average* in Value Aggregation for ratios.
2. **Pick the scale:** Sequential for volume · Quantile (Pro) when one outlier washes out the rest · Diverging (Pro) for values around zero · Categorical (Pro) for groups.
3. **Colour rules win:** rules are tested 1 → 2 → 3; the first match colours the tile. The legend lists each rule plus "Other".
4. **Volume and rate:** rate in Value (colour), volume in Size (Pro).
5. **Labels** appear only where they fit — enlarge the visual or lower Label Min Tile Size.
6. **Keyboard:** arrows move, Enter/Space select, Ctrl+Enter adds, Esc clears, Shift+F10 context menu.

---

## 🗺️ Text box 7 — Custom TopoJSON (Pro)

**YOUR OWN REGIONS (PRO)**

1. Country / Region → *Custom TopoJSON (Pro)*.
2. Drag a TopoJSON file onto the visual (longitude/latitude, WGS84, max 5 MB).
3. Each polygon or multipolygon is one region; its name comes from the file's *name* property.
4. The file is saved in the report — save the .pbix after dropping it.

No network requests. Simplify big files at mapshaper.org first.

---

## ❓ Text box 8 — Troubleshooting

**TROUBLESHOOTING**

**Rows "outside the map"** — wrong Country / Region, Latitude and Longitude swapped, or rows from other countries (filter them).

**All tiles the same colour / rules not applying** — check *Enable Rules* in the card header; for percent fields type 25, not 0.25; Rule 2's range may catch everything first.

**Legend missing** — *Show Legend* off, no tile has a value, or Categorical without a Category field.

**Average looks like a sum** — set Value Aggregation to Average.

**Labels not showing** — turn on Show Cell Labels; labels only appear where they fit.

**TopoJSON not loading** — needs Pro, a TopoJSON (not GeoJSON) file with polygons, under 5 MB, in longitude/latitude. The note under the map says what failed.

---

Support: https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html · support@tcviz.com
