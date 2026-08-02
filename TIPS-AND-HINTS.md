# Tips & Hints — página para el .pbix de muestra

> Microsoft marca como *soft failure* los envíos cuyo `.pbix` de muestra no incluye
> orientación de uso. Crea una página nueva llamada **"Tips & Hints"** en Power BI Desktop
> y copia cada bloque de abajo en un **text box** independiente.

---

## 📦 Text box 1 — Getting Started

**GETTING STARTED**

1. Add **Tile Grid Map Pro** to your report from the Visualizations pane.
2. Drag your **Latitude** column into the *Latitude* field well (decimal degrees, e.g. `40.4168`).
3. Drag your **Longitude** column into the *Longitude* field well (e.g. `-3.7038`).
4. Drop a numeric measure into **Value** — this is what colours each tile.
5. Open the Format pane → **Map Settings** → pick your **Country / Region**.
6. That's it. Each coordinate is snapped to its grid cell and coloured by the aggregated value.

> No shapefiles, no GIS setup, no custom code required.

**📺 Watch the full walkthrough:** https://www.youtube.com/watch?v=LnTb3qHsHdg

---

## 🎯 Text box 2 — Field Wells

**FIELD WELLS**

| Field well | Required | What it does |
|---|---|---|
| **Latitude** | ✅ Yes | Decimal degrees. One column, max 1 field. |
| **Longitude** | ✅ Yes | Decimal degrees. One column, max 1 field. |
| **Value** | Recommended | Numeric measure that colours each tile. Without it, all cells render in the "no data" colour. |
| **Label** | Optional | City / region name. Shown on small tiles and in tooltips. |
| **Tooltips** | Optional | Up to **10** extra measures shown on hover. Each is aggregated independently (Sum stays Sum, Average stays Average). |

**Data limits:** Free tier renders the first **500 rows**. Pro removes the cap (up to 30,000 rows).

---

## ⚙️ Text box 3 — Format Pane

**FORMAT PANE REFERENCE**

**Map Settings**
- *Country / Region* — 27 built-in grids, plus "Custom TopoJSON (Pro)"
- *Value Aggregation* — Sum · Average · Count · Min · Max
- *Show Empty Cells* — draw grid cells that have no data
- *Show Cell Labels* — print the value inside each tile
- *Label Font Size* — 5 to 14 px
- *Label Min Tile Size* — below this tile width, labels are hidden (default 20 px)
- *Tooltip Decimal Places* — 0 to 6 (default 2)

**Color Scale**
- *Scale Type* — Sequential · Diverging (Pro) · Categorical (Pro)
- *Color Min / Mid / Max* — your own palette (Pro)
- *No Data Color* — fill for cells without values

**Conditional Formatting**
- *Enable Rules* — master toggle
- *Rule 1* — operator (`<`, `≤`, `>`, `≥`, `=`) + value + colour
- *Rule 2* — **between range**: From (≥) and To (≤) + colour
- *Rule 3* — operator + value + colour
- Rules override the colour scale when they match.

**Accessibility**
- *Show Cell Borders*, *Border Color*, *Border Width*
- *Selected Ring Color*, *Selected Ring Width*

**Legend** — Show Legend, Position (Bottom · Right · Top)

**Pro Settings** — Custom TopoJSON URL, Show Pro Pill

---

## 🔓 Text box 4 — Free vs Pro

**FREE VS PRO**

| Feature | Free | Pro |
|---|:---:|:---:|
| 27 built-in country grids | ✅ | ✅ |
| Data points | 500 | Unlimited (30K) |
| Aggregations (Sum/Avg/Count/Min/Max) | ✅ | ✅ |
| Conditional formatting (3 rules) | ✅ | ✅ |
| Tooltips (up to 10 fields) | ✅ | ✅ |
| Accessibility & high contrast | ✅ | ✅ |
| Cross-filter & multi-select | ✅ | ✅ |
| Sequential colour scale | Fixed palette | **Your colours** |
| Diverging scale (min/mid/max) | ❌ | ✅ |
| Categorical palette | ❌ | ✅ |
| **Custom TopoJSON boundaries** | ❌ | ✅ |
| TopoJSON saved inside the .pbix | ❌ | ✅ |
| Load TopoJSON from URL | ❌ | ✅ |

---

## 💡 Text box 5 — Tips & Best Practices

**TIPS & BEST PRACTICES**

1. **Use decimal degrees, not DMS.** `40.4168` works; `40°25'00"N` does not. Convert before loading.

2. **Aggregation is auto-detected.** The visual reads the aggregation from your field's metadata, so a measure defined as Average stays an Average. If a tooltip value looks off, set *Value Aggregation* explicitly in Map Settings.

3. **Turn labels off on dense grids.** Below ~20px per tile, labels overlap. Use *Label Min Tile Size* to control the cutoff rather than toggling labels on and off.

4. **Match the scale to the question.** Sequential for volume (sales, population). Diverging for variance against a target — set the mid colour at your baseline. Categorical when regions are groups, not magnitudes.

5. **Simplify TopoJSON before loading.** Boundary files from Natural Earth or geoBoundaries often carry far more vertices than a tile map needs. Run them through mapshaper.org at 5–10% simplification: same shape, much faster render.

6. **Conditional formatting overrides the colour scale.** Keep it off while exploring the data, then switch it on for the final report to flag thresholds.

7. **Click a tile to cross-filter; click it again to clear.** Ctrl+click adds to the selection. Right-click opens the standard Power BI context menu.

---

## 🗺️ Text box 6 — Custom TopoJSON (Pro)

**USING YOUR OWN BOUNDARIES (PRO)**

1. Set **Map Settings → Country / Region** to *Custom TopoJSON (Pro)*.
2. **Drag a `.json` / `.topojson` file directly onto the visual.** The drop zone appears automatically.
3. The visual decodes the boundaries and assigns each lat/long point to its polygon.
4. The file is **stored inside the .pbix** — close the report, reopen it, and your map is still there. No re-upload.

**Alternative:** paste a public HTTPS link into *Pro Settings → Custom TopoJSON URL*.

**Where to get boundaries:**
- geoBoundaries.org — administrative divisions worldwide
- Natural Earth — country, state and province outlines
- Your national statistics office — most publish official TopoJSON/GeoJSON

**Requirements:** a valid TopoJSON topology with Polygon or MultiPolygon geometries. Coordinates must be in WGS84 (standard lat/long), the same system as your data.

---

## 📊 Text box 7 — Example Configurations

**EXAMPLE CONFIGURATIONS**

**Retail — store performance by province**
Latitude/Longitude = store coordinates · Value = `SUM(Sales)` · Label = Province
Scale: Sequential · Conditional formatting: Rule 1 `< 50000` red, Rule 3 `≥ 200000` green

**Logistics — average delivery time**
Latitude/Longitude = delivery address · Value = `AVERAGE(DeliveryHours)` · Tooltips = Order count, Late %
Scale: Diverging, mid colour at your SLA target — over-target regions shift to the warm end

**Public health — incidence per 100K**
Latitude/Longitude = health district centroid · Value = `Cases / Population * 100000`
Scale: Sequential · Labels on · Legend: Right

**Sales territories — custom regions (Pro)**
Country/Region = Custom TopoJSON · Drop your sales-territory boundary file
Value = `SUM(Revenue)` · Scale: Categorical to distinguish territories rather than rank them

---

## ❓ Text box 8 — Troubleshooting

**TROUBLESHOOTING**

**Nothing renders / "No data points found"**
Your coordinates fall outside the selected region. Check that Country/Region matches your data, and that latitude and longitude aren't swapped.

**Some tiles are empty**
Those grid cells have no matching coordinates. Turn off *Show Empty Cells* to hide them.

**"Free version limited to 500 data points"**
Expected on the Free tier. Aggregate your data upstream, or upgrade to Pro for the full dataset.

**Tooltip values don't match my card visual**
The visual aggregates per cell using the field's own aggregation. If a measure is defined differently in the card, set *Value Aggregation* explicitly to match.

**Custom TopoJSON option does nothing**
Custom boundaries are a Pro feature and need an active AppSource license.

**Dropped TopoJSON disappeared after reopening**
It shouldn't — the file is persisted into the .pbix. Make sure you **saved the report** after dropping the file.

---

📺 Video walkthrough: https://www.youtube.com/watch?v=LnTb3qHsHdg
Support: https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html · tino@tcviz.com
