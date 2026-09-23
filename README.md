# Tile Grid Map Pro — TCViz

> Regional maps for Power BI without the GIS detour. Bind latitude and longitude, pick one of 27 bundled square tile grids, and every region gets the same visual weight.

[![Version](https://img.shields.io/badge/version-1.2.0.0-2980b9)](CHANGELOG.md)
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
| **Tooltips** | Measure | 10 | Extra fields on hover (Free) |
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
| Tile shape | Square | Square, Circle, Hexagon |
| Legend font, text size, text colour | ✅ | ✅ |
| Correct latitude distortion | ✅ | ✅ |
| Size role (tile area by a second measure) | ❌ | ✅ |
| Sequential scale | fixed blue palette | custom colours |
| Quantile scale (5 equal-count classes) | ❌ | ✅ |
| Aggregation: Auto (from field), Sum, Average, Count, Min, Max | ✅ | ✅ |
| Labels, legend (top or bottom), decimals | ✅ | ✅ |
| Rule-based colour rules (3 rules, the visual's own card) | ✅ | ✅ |
| Borders, selection ring, no-data colour, show/hide empty cells | ✅ | ✅ |
| Tooltips, cross-filtering, Ctrl multi-select, context menu | ✅ | ✅ |
| Keyboard navigation, high contrast | ✅ | ✅ |
| Diverging scale (neutral colour at zero when data crosses zero) | ❌ | ✅ |
| Categorical scale (Category field, 12 theme colours + "Other", legend) | ❌ | ✅ |
| Custom scale colours (Color Min / Mid / Max) | ❌ | ✅ |
| Custom TopoJSON regions (drag & drop) | ❌ | ✅ |

Licensing uses Power BI's own licence notifications (feature-blocked banner and
licence icon); there is no upgrade text or badge inside the visual. The 30-day trial
and the payment grace (Warning) state count as Pro.

## Keyboard

Arrow keys move focus between tiles · Enter / Space select · Ctrl+Enter adds to the
selection · Esc clears · Shift+F10 or the context-menu key opens the context menu.

## Development

```bash
npm install
npm start        # dev server
```

Release builds follow the TCViz pipeline (`build-test.js` for test packages).

## Links

- [Support](https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html)
- [Privacy Policy](https://tinocallarisa-web.github.io/tile-grid-map-pro/privacy.html)
- [Terms of Use](https://tinocallarisa-web.github.io/tile-grid-map-pro/terms.html)
- [Changelog](CHANGELOG.md)
- support@tcviz.com

## License

Source code: MIT  
Visual & bundled data: © 2026 TCViz — All rights reserved
