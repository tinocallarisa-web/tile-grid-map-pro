# Ficha de producto — Tile Grid Map Pro

Contenido para las cuatro pestañas de la web de TCViz.
Versión 1.2.0.0 · Actualizado 23 septiembre 2026

---
---

# 🟠 PESTAÑA 1 — OVERVIEW

## Tile Grid Map Pro

**Regional maps for Power BI, without the GIS detour.**

On a real map, area lies. Madrid is a dot and Castilla is a continent, so the
regions that matter most to your business are often the hardest to see. Sparse
rural areas dominate the screen while dense urban ones vanish into a pixel.

Tile Grid Map Pro gives every region the same visual weight. Each area becomes an
equally sized tile, positioned to keep the country recognisable, and coloured by
your data. Comparison becomes honest: what stands out is the number, not the
square kilometres.

### How it works

Feed it latitude and longitude. That's the whole setup.

Each coordinate is assigned to the grid cell that contains it (coastal points are
snapped to the nearest land cell), values are aggregated per cell, and the map
renders. No shapefiles to prepare, no region names to match, no ISO codes to look
up, no GIS knowledge required.

**27 countries and regions are built in.** And when your business runs on
geographies nobody ships out of the box — sales territories, service areas,
custom districts — the Pro tier lets you drag in your own TopoJSON boundary file
and render its regions instead of tiles.

### Who it's for

Analysts and report builders who need regional comparison to be readable and
fair, and who would rather spend their time on the analysis than on preparing
geographic data.

### At a glance

- 27 built-in country and region grids
- Works directly from latitude and longitude
- Square tiles in Free; circle and hexagon tiles in Pro
- Free uses the first 500 rows; Pro uses all rows up to 30,000
- Custom TopoJSON regions (Pro), stored inside your `.pbix`
- Cross-filtering, tooltips, rule-based colour rules, keyboard navigation,
  high contrast
- No network requests, no telemetry, no cookies

**[Get it on Microsoft AppSource →]**
**[Watch the walkthrough →](https://www.youtube.com/watch?v=iCXAk3kI9nE)**

---
---

# 🟠 PESTAÑA 2 — FEATURES

## Maps and geography

**27 built-in grids**
Spain · Canarias · Portugal · France · Germany · Italy · Sicily · Sardinia ·
United Kingdom · Netherlands · Belgium · Poland · Sweden · Norway · Switzerland ·
Austria · United States · Alaska · Hawaii · Canada · Mexico · Brazil · Argentina ·
Colombia · Australia · India · Japan

**Coordinate-driven**
Bind latitude and longitude in decimal degrees. Each point is assigned to its
grid cell automatically. Rows outside the map or without coordinates are counted
on screen, never dropped silently.

**Tile shape** — Square (Free), Circle and Hexagon (Pro). Hexagons use offset
rows.

**Finer island grids** — Canarias and Hawaii use finer grids (about 380 and 240
tiles), so the islands read in detail.

**Correct latitude distortion** — on by default. Tiles take the real ground
proportion at the map's mid-latitude, so Norway, Sweden or Canada are no longer
stretched.

**Custom TopoJSON** · *Pro*
Drag a `.json` or `.topojson` boundary file (longitude/latitude WGS84, max 5 MB)
onto the visual and it renders its regions. Rows are assigned by
point-in-polygon testing. The file is stored inside the `.pbix`: close the
report, reopen it, and your map is still there.

## Data and aggregation

**Auto (from field)** — the default follows the aggregation chosen in the field
well (Sum, Average, Min, Max, Count). Model measures default to Sum, and the
tooltip names the aggregation used. Sum, Average, Count, Min and Max are
available as overrides. Blank values are ignored.

**Size** · *Pro* — a second measure scales each tile's area: colour = Value,
size = Size. Not applied in Custom TopoJSON mode.

**Tooltips** — up to 10 extra fields. Configurable decimal places (0–6).

## Colour and formatting

**Sequential scale** — fixed blue palette in Free; your own colours in Pro.

**Quantile scale** · *Pro* — 5 classes with an equal number of cells each; the
legend shows the break values. One outlier no longer washes out the map.

**Diverging scale** · *Pro* — neutral colour at zero when data crosses zero.

**Categorical scale** · *Pro* — add a **Category** field: each tile takes the
category with the most rows. The 12 main categories get your report theme's
colours, stable across filters; the rest share a grey "Other". The legend lists the
categories.

**Colour rules** — the visual's own three rule-based colour rules, including a
between-range rule, switched on from the card header. The legend shows each active
rule with its condition. For percent fields, type thresholds as shown (25 = 25%).

**No-data colour** — control how empty cells read, or hide them.

## Labels and legend

- Value labels inside each tile, drawn only when they fit
- Legend at the top or bottom, drawn from the same scale as the tiles, with
  configurable font, text size and text colour

## Interactivity

- Click a tile to cross-filter; click again or click the background to clear
- Ctrl+click to multi-select
- Right-click for the Power BI context menu
- Bookmarks and external selections are reflected on the tiles

## Accessibility

- Keyboard navigation: arrows, Enter / Space, Ctrl+Enter, Esc, Shift+F10
- High contrast mode, with value encoded by opacity
- Configurable cell borders and selection ring

## Free vs Pro

| | Free | Pro |
|---|:---:|:---:|
| 27 built-in grids | ✅ | ✅ |
| **Rows used** | First 500 | **Up to 30,000** |
| **Tile shape** | Square | **Square, Circle, Hexagon** |
| Correct latitude distortion | ✅ | ✅ |
| **Size role** | — | ✅ |
| Aggregation (Auto, Sum, Avg, Count, Min, Max) | ✅ | ✅ |
| Rule-based colour rules, 3 rules | ✅ | ✅ |
| Tooltips, up to 10 fields | ✅ | ✅ |
| Labels, legend, borders, selection ring | ✅ | ✅ |
| Cross-filter, multi-select, context menu | ✅ | ✅ |
| Keyboard navigation, high contrast | ✅ | ✅ |
| **Sequential colours** | Fixed blue palette | **Yours** |
| **Quantile scale** | — | ✅ |
| **Diverging scale** | — | ✅ |
| **Categorical scale** | — | ✅ |
| **Custom TopoJSON (saved in the .pbix)** | — | ✅ |
| **Pro preview while editing** | ✅ | — |

### See it before you buy it

Turn on a Pro feature without a licence and it is drawn **working**, under a "Pro preview"
watermark that names it. You get to see your own data as a hexagon grid, on a diverging
scale, sized by a second measure — not a screenshot of someone else's.

Reading view shows the free result with no watermark and no prompt, so a published report
never uses a feature nobody paid for. The preview covers only the setting you changed, not
every Pro option at once.

---
---

# 🟠 PESTAÑA 3 — TECHNICAL

## Specifications

| | |
|---|---|
| **Version** | 1.2.0.0 |
| **Power BI API** | 5.10.0 |
| **Publisher** | TCViz |
| **Data view mapping** | Table |
| **Maximum rows** | 30,000 (Power BI data reduction limit) |
| **Free tier** | First 500 rows |
| **Rendering** | SVG |
| **Availability** | Microsoft AppSource |

## Field wells

| Field well | Required | Max fields | Accepts |
|---|---|:---:|---|
| **Latitude** | Yes | 1 | Numeric — decimal degrees, WGS84 |
| **Longitude** | Yes | 1 | Numeric — decimal degrees, WGS84 |
| **Value** | Recommended | 1 | Numeric measure |
| **Size (Pro)** | No | 1 | Numeric measure |
| **Tooltips** | No | 10 | Any measure |
| **Label** | No | 1 | Text |
| **Category** | No | 1 | Text — used by the Categorical (Pro) scale |

## Custom TopoJSON requirements · Pro

- Valid TopoJSON topology with `Polygon` or `MultiPolygon` geometries
- Coordinates in longitude/latitude (WGS84); projected files are detected and
  explained
- Maximum 5 MB; invalid or oversized files are explained on screen
- Loaded by drag & drop only (no URL loading)

## Power BI integration

| Capability | Supported |
|---|:---:|
| Multi-visual selection | ✅ |
| Keyboard focus and navigation | ✅ |
| Landing page | ✅ |
| Empty data view | ✅ |
| Standard and canvas tooltips | ✅ |
| Context menu | ✅ |
| Bookmarks / external selection | ✅ |
| High contrast | ✅ |
| Rendering events | ✅ |

## Licensing

Pro features are unlocked through the official Microsoft
`IVisualLicenseManager` API. No external licence server is contacted. The
30-day trial and the payment grace period count as Pro.

There is no upgrade text or badge inside the visual: Power BI's own licence
notifications (feature-blocked banner and licence icon) carry the purchase path,
and they never appear where licensing is unsupported (Publish to Web, embed,
export) or the licence cannot be read.

## Privacy and security

- **No network requests** of any kind.
- **No telemetry.** No analytics, no cookies, no local or session storage.
- **No external scripts** loaded at runtime; no `innerHTML`.
- **No special privileges** declared in the visual manifest.
- **Drag-and-drop TopoJSON** is read locally and stored inside your own `.pbix`.

Full policy: [Privacy Policy](https://tinocallarisa-web.github.io/tile-grid-map-pro/privacy.html)

## Support

- [Documentation and FAQ](https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html)
- [Video walkthrough](https://www.youtube.com/watch?v=iCXAk3kI9nE)
- [Report an issue](https://github.com/tinocallarisa-web/tile-grid-map-pro/issues)
- support@tcviz.com

---
---

# 🟠 PESTAÑA 4 — CHANGELOG

## 1.2.0.0 — 23 September 2026

**Added**
- Pro preview: turn on a Pro feature without a licence and it is drawn working, under a
  watermark that names it, so you can see your own data as a hexagon grid or on a diverging
  scale before deciding. Reading view shows the free result, with no watermark

**Fixed**
- The Upgrade option could disappear. Power BI shows one notification at a time, and the
  banner naming the blocked feature was replacing the persistent Upgrade bar instead of
  following it; once the banner faded there was nothing left to click. The banner now comes
  first and the Upgrade bar follows about ten seconds later

## 1.1.0.0 — 14 September 2026

**Added**
- Tile Shape: Square (Free), Circle and Hexagon (Pro)
- Finer default grids for Canarias and Hawaii (about 380 and 240 tiles)
- Legend Font, Text Size and Text Color
- Category data role for the Categorical (Pro) scale, with a category legend
- Legend entries for colour rules; Enable Rules switch in the card header
- Size (Pro) data role: tile area from a second measure
- Quantile (Pro) colour scale with 5 equal-count classes
- Correct Latitude Distortion (Free, on by default)
- Keyboard navigation; bookmarks and external selections shown on tiles
- On-screen notes for row limits and rows not shown

**Fixed**
- Pro licences were not recognised for paying customers
- Pro customers stayed at 500 rows after the licence arrived
- Coastal points were dropped; now snapped to the nearest land cell
- Blank values and coordinates were counted as 0
- Default aggregation summed already-aggregated fields (new Auto default)
- Legend, high contrast, Ctrl multi-select, background click, TopoJSON
  MultiPolygon handling, number formatting, colour rule defaults, labels,
  Show Empty Cells, legend position and tiny viewports

**Removed**
- TopoJSON URL option (the visual now makes no network requests)
- In-visual Pro pill and upgrade message (Power BI's licence notifications are
  used instead)

---

## 1.0.0.5 — 9 August 2026

- 30-day free trial unlocks all Pro features

---

## 1.0.0.4 — 2 August 2026

- Configurable tooltip decimal places, drag-and-drop TopoJSON stored inside the
  `.pbix`, per-field tooltip aggregation, faster TopoJSON rendering and several
  selection fixes

---

## 1.0.0.3 — 2026

- Custom TopoJSON mode (Pro), conditional formatting rules, accessibility
  options, faster rendering

---

## 1.0.0.0 — 2026

Initial release: tile grid maps for 27 countries and regions.
