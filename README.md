# Tile Grid Map Pro — TCViz

> Tile grid maps for Power BI without the GIS detour. Bind latitude and longitude, pick one of 27 bundled grids, and each equal tile is coloured by the rows that fall in it — no boundary files, region codes or map service.

[![Version](https://img.shields.io/badge/version-1.3.0.0-2980b9)](CHANGELOG.md)
[![AppSource](https://img.shields.io/badge/Microsoft_AppSource-Available-0078D4?logo=microsoft)](https://appsource.microsoft.com)
[![TCViz](https://img.shields.io/badge/Publisher-TCViz-2980b9)](https://tcviz.com)

## Maps

27 bundled square tile grids: Spain, Canarias, Portugal, France, Germany, Italy,
Sicily, Sardinia, United Kingdom, Netherlands, Belgium, Poland, Sweden, Norway,
Switzerland, Austria, United States, Alaska, Hawaii, Canada, Mexico, Brazil,
Argentina, Colombia, Australia, India, Japan. Canarias and Hawaii use finer grids
(about 380 and 240 tiles) so the islands read in detail.

Map Settings also control the grid itself:

- **Tile Shape** — Square (Free), Circle (Pro), Hexagon (Pro). Hexagons use offset
  rows (odd rows shifted half a tile).
- **Correct Latitude Distortion** (Free, on by default) — tiles take the real ground
  proportion of each cell at the map's mid-latitude, so northern countries (Norway,
  Sweden, Canada) are no longer stretched.

Plus **Custom TopoJSON (Pro)**: drag and drop a TopoJSON file (longitude/latitude,
WGS84, max 5 MB) onto the visual. It is saved inside the `.pbix`. The visual makes
no network requests.

## New in 1.3

- **Pick a range in the legend** — click a class, rule or category, or drag across the gradient: only the tiles in
  that range stay in full colour, with how many they are and their share of the total. Map only, not saved.
- **Target (Pro)** — colour each tile by its variance against a target, on a symmetric diverging scale around 0 %.
- **Label Content** — Auto, Value, Name, or Name and value in two lines.
- **Style template** — Report theme (free) and six collection styles (Pro).
- Highlighting from other visuals, on-object formatting, report page tooltips, 12 languages, number format from
  the model, text that shrinks with the visual, thinner borders on small tiles.

Each coordinate is assigned to the grid cell that contains it. Coastal points that
fall just outside the land mask are snapped to the nearest land cell within 3 cells;
rows that are truly outside the map, or have no coordinates, are counted on screen.

## Data roles

| Role | Kind | Max | Notes |
|---|---|:---:|---|
| **Latitude** | Grouping | 1 | Decimal degrees, e.g. `40.4168` |
| **Longitude** | Grouping | 1 | Decimal degrees, e.g. `-3.7038` |
| **Value** | Measure | 1 | Colours each tile |
| **Size (Pro)** | Measure | 1 | Second measure that scales each tile's area (not applied in Custom TopoJSON mode); shown in the tooltip |
| **Target (Pro)** | Measure | 1 | Each tile is coloured by (Value − Target) ÷ \|Target\|; tooltip shows actual, target and variance |
| **Tooltips** | Measure | 10 | Extra fields on hover (Free); report page tooltips supported |
| **Label** | Grouping | 1 | Optional display name (city, region) |
| **Category** | Grouping | 1 | Group used by the Categorical (Pro) scale: each tile takes the category with the most rows |

With colour rules on, the legend shows one swatch per active rule with its condition
(e.g. "< 0", "0 – 100", "> 100") plus "Other". The **Enable Rules** switch is in the
Conditional Formatting card header; for a percent field, thresholds are typed as
shown (25 = 25%).

## Row limits

Power BI sends the visual at most **30,000 rows**. Free uses the first **500 rows**;
Pro uses all rows up to 30,000. The visual says so on screen ("Showing the first 500
of N rows" / "Power BI sent the first 30,000 rows") and reports how many rows were
not shown (outside the map / without coordinates).

## Free vs Pro

| Feature | Free | Pro |
|---|:---:|:---:|
| All 27 bundled maps | ✅ | ✅ |
| Rows used | first 500 | up to 30,000 |
| Style template | Report theme | + Boardroom, Ledger, Editorial, Signal, Aurora, Terrace |
| Tile shape | Square | Square, Circle, Hexagon |
| Target (variance against a target) | ❌ | ✅ |
| Pick a range in the legend | ✅ | ✅ |
| Label content: value, name, name and value | ✅ | ✅ |
| Legend font, text size, text colour | ✅ | ✅ |
| Correct latitude distortion | ✅ | ✅ |
| Size role (tile area by a second measure) | ❌ | ✅ |
| Sequential scale | ramp of the style (report theme) | custom colours |
| Quantile scale (5 equal-count classes) | ❌ | ✅ |
| Aggregation: Auto (from field), Sum, Average, Count, Min, Max | ✅ | ✅ |
| Labels, legend (top or bottom), decimals | ✅ | ✅ |
| Rule-based colour rules (3 rules, the visual's own card) | ✅ | ✅ |
| Borders, selection ring, no-data colour, show/hide empty cells | ✅ | ✅ |
| Tooltips, report page tooltips, cross-filtering, highlighting, Ctrl multi-select, context menu | ✅ | ✅ |
| On-object formatting, 12 languages | ✅ | ✅ |
| Keyboard navigation, high contrast | ✅ | ✅ |
| Diverging scale (neutral colour at zero when data crosses zero) | ❌ | ✅ |
| Categorical scale (Category field, 12 theme colours + "Other", legend) | ❌ | ✅ |
| Custom scale colours (Color Min / Mid / Max) | ❌ | ✅ |
| Custom TopoJSON regions (drag & drop) | ❌ | ✅ |

Without a licence, a Pro option turned on while editing is drawn working under a
"Pro preview" notice that names it, and Power BI shows its own licence notifications
(feature-blocked banner, then the licence icon). Reading view, Publish to Web, embedding
and exports show the free result with no notice. The 30-day trial and the payment grace
(Warning) state count as Pro.

## Keyboard

Arrow keys move focus between tiles · Enter / Space select · Ctrl+Enter adds to the
selection · Esc clears · Shift+F10 or the context-menu key opens the context menu.

## Development

```bash
npm install
npm start        # dev server
npm run lint     # tsc + ESLint (eslint-plugin-powerbi-visuals)
```

Release builds follow the TCViz pipeline: `node build-test.js` (Pro forced, `_test`) and
`node build-test.js --free` (real Free, `_testfree`). `tools/simulador/harness.py` runs the
visual in a headless browser against the Free/Pro, size, language and interaction cases.
Translations: `python tools/i18n.py` (table in `tools/i18n_tg.py`).

## Links

- [Support](https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html)
- [Privacy Policy](https://tinocallarisa-web.github.io/tile-grid-map-pro/privacy.html)
- [Terms of Use](https://tinocallarisa-web.github.io/tile-grid-map-pro/terms.html)
- [Changelog](CHANGELOG.md)
- support@tcviz.com

## License

Source code: MIT  
Visual & bundled data: © 2026 TCViz — All rights reserved
