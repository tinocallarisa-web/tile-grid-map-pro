# Certification Notes — Tile Grid Map Pro

> Copiar el bloque de abajo en el campo **Notes for certification** de Partner Center.
> Ese campo se borra en cada reenvío — por eso está guardado aquí.

**Visual GUID:** `tileGridMapProTCViz1234567890`
**Version:** 1.0.0.5
**Plan ID / spIdentifier:** `tile-grid-map-pro-tcviz`
**Demo video:** https://www.youtube.com/watch?v=LnTb3qHsHdg

---

```
Source code (certification branch):
https://github.com/tinocallarisa-web/tile-grid-map-pro/tree/certification

Privacy Policy: https://tinocallarisa-web.github.io/tile-grid-map-pro/privacy.html
Terms of Use:   https://tinocallarisa-web.github.io/tile-grid-map-pro/terms.html
Support:        https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html

Demo / onboarding video:
https://www.youtube.com/watch?v=LnTb3qHsHdg
(Walkthrough of setup, field wells, formatting options and the Pro custom
TopoJSON workflow. Useful as a visual reference during certification review.)

------------------------------------------------------------------
LICENSE VALIDATION
------------------------------------------------------------------
This visual uses the official Microsoft IVisualLicenseManager API
(spIdentifier: tile-grid-map-pro-tcviz). No external license server is
contacted and no license data leaves the Power BI environment.

The license state is resolved asynchronously in the constructor and never
blocks rendering: the visual starts on the Free tier and re-renders only if
an active Pro service plan is confirmed. Both ServicePlanState.Active (1) and
ServicePlanState.FreeTrial (2) are accepted as Pro-equivalent states, so users
on the 30-day AppSource trial receive full Pro access. If the licensing call
fails or times out, the visual stays on the Free tier and continues to render
normally.

------------------------------------------------------------------
FREE TIER (no license required)
------------------------------------------------------------------
- Tile grid maps for 27 built-in countries and regions (Spain, Canary Islands,
  Portugal, France, Germany, Italy, Sicily, Sardinia, United Kingdom,
  Netherlands, Belgium, Poland, Sweden, Norway, Switzerland, Austria,
  United States, Alaska, Hawaii, Canada, Mexico, Brazil, Argentina, Colombia,
  Australia, India, Japan)
- Up to 500 data points
- Sequential colour scale (fixed palette)
- Value aggregation: Sum, Average, Count, Min, Max
- Conditional formatting (3 rules: comparison, between-range, comparison)
- Cell labels with configurable font size and minimum tile size
- Legend with configurable position (bottom / right / top)
- Accessibility options: cell borders, border colour and width,
  selection ring colour and width
- Standard tooltips with configurable decimal places
- Cross-filtering, multi-select (Ctrl+click), context menu
- High-contrast mode support

------------------------------------------------------------------
PRO TIER (requires an active AppSource license)
------------------------------------------------------------------
- Unlimited data points (no 500-row cap)
- Custom colour scales: user-defined sequential min/max colours,
  diverging (min/mid/max) and categorical palettes
- Custom TopoJSON mode: load any boundary file by drag-and-drop onto the
  visual, or by public HTTPS URL, and render real polygons instead of tiles.
  Points are assigned to polygons via point-in-polygon testing.
  A dropped TopoJSON file is persisted into the .pbix through
  persistProperties(), so it survives closing and reopening the report.

------------------------------------------------------------------
DATA PRIVACY / NETWORK ACCESS
------------------------------------------------------------------
- No telemetry, no analytics, no cookies, no local storage.
- No data ever leaves the Power BI environment.
- The only outbound request the visual can make is an optional fetch() to a
  public TopoJSON URL that the report author types into the "Custom TopoJSON
  URL" setting. This is entirely user-initiated and optional; the visual works
  fully without it. Nothing is sent in that request other than the URL itself.
- The drag-and-drop TopoJSON path performs no network access at all: the file
  is read locally with FileReader and stored inside the .pbix.
- capabilities.json declares "privileges": [] — no special privileges required.

------------------------------------------------------------------
CERTIFICATION REQUIREMENTS
------------------------------------------------------------------
- Rendering events: renderingStarted / renderingFinished / renderingFailed
  are called in every code path of update(), wrapped in try/catch.
- capabilities.json declares supportsHighlight, supportsSynchronizingFilterState,
  supportsLandingPage, supportsKeyboardFocus, supportsMultiVisualSelection
  and supportsEmptyDataView.
- Interactions are gated on host.hostCapabilities.allowInteractions before any
  selection, context menu or click handling.
- High contrast is detected via host.colorPalette.isHighContrast and applied to
  fills, strokes and label colours.
- Tooltips use the official host.tooltipService.
- No external JS libraries are loaded at runtime; no eval, no innerHTML from
  user-controlled network content.
- No minified or obfuscated third-party code is bundled beyond the declared
  npm dependencies (d3-scale, d3-scale-chromatic, topojson-client).

------------------------------------------------------------------
TESTING INSTRUCTIONS
------------------------------------------------------------------
1. Import the sample .pbix file included with the submission. It contains a
   table with Latitude, Longitude, Label and a numeric Value column, plus a
   "Tips & Hints" page describing the field wells and format options.

2. Drop the visual on the canvas and assign:
   - Latitude  -> latitude column (decimal degrees)
   - Longitude -> longitude column (decimal degrees)
   - Value     -> numeric measure
   - Label     -> (optional) region/city name
   - Tooltips  -> (optional) up to 10 extra measures

3. Without a Pro license, verify:
   - Map Settings > Country/Region switches between the 27 built-in grids.
   - With more than 500 rows, a notice appears explaining the Free-tier cap.
   - Color Scale > Scale Type: selecting "Diverging (Pro)" or
     "Categorical (Pro)" keeps the fixed free sequential palette.
   - Selecting Country/Region = "Custom TopoJSON (Pro)" does not enter custom
     mode; the visual falls back to the built-in grid.
   - Clicking a tile cross-filters other visuals; clicking it again clears the
     selection; Ctrl+click multi-selects.

4. With an active Pro license **or during a 30-day free trial**, verify:
   - All rows render (no 500-row cap and no notice).
   - Color Scale min/mid/max colour pickers take effect; diverging and
     categorical scales are applied.
   - Country/Region = "Custom TopoJSON (Pro)" shows a drop zone. Dragging a
     .json/.topojson boundary file onto the visual renders the polygons and
     colours them by the aggregated value.
   - Saving, closing and reopening the .pbix keeps the loaded TopoJSON.

5. Filter-in / highlight: apply a slicer on the report page and confirm the
   map re-renders with the filtered subset, and that clearing the slicer
   ("All") also clears the map selection.
```

---

## Checklist antes de enviar

- [ ] Versión `1.0.0.5` en `pbiviz.json` **y** `package.json`
- [ ] GUID `tileGridMapProTCViz1234567890` (sin sufijo)
- [ ] `isPro` resuelto por `licenseManager` (no forzado a `true`)
- [ ] Sin instrumentación de debug ni marcadores de build
- [ ] Rama `certification` actualizada, sin `node_modules`, `.tmp` ni `dist`
- [ ] `.gitignore` incluye esas tres rutas
- [ ] URLs de privacy, terms y support activas en GitHub Pages
- [ ] `.pbix` de muestra con página "Tips & Hints"
- [ ] Estas notas copiadas en el campo de Partner Center
