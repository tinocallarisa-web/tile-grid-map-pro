# Certification Notes — Tile Grid Map Pro

> Copiar el bloque de abajo en el campo **Notes for certification** de Partner Center.
> Ese campo se borra en cada reenvío — por eso está guardado aquí.
> Si el campo tiene límite de caracteres, usar `docs/CERTIFICATION-NOTES-SHORT.txt`.

**Visual GUID:** `tileGridMapProTCViz1234567890`
**Version:** 1.3.0.0
**Plan ID / spIdentifier:** `tile-grid-map-pro-tcviz` (Service ID completo `publisher.offer.plan`, se acepta por sufijo)
**Demo video:** https://www.youtube.com/watch?v=iCXAk3kI9nE

---

```
Tile Grid Map Pro v1.3.0.0 - GUID tileGridMapProTCViz1234567890

Source code (certification branch):
https://github.com/tinocallarisa-web/tile-grid-map-pro/tree/certification

Privacy Policy: https://tinocallarisa-web.github.io/tile-grid-map-pro/privacy.html
Terms of Use:   https://tinocallarisa-web.github.io/tile-grid-map-pro/terms.html
Support:        https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html

Demo / onboarding video:
https://www.youtube.com/watch?v=iCXAk3kI9nE

------------------------------------------------------------------
WHAT CHANGED IN 1.3.0.0
------------------------------------------------------------------
1. PICK A RANGE IN THE LEGEND. Click a class, colour rule or category in the
legend, or drag across the gradient: tiles in the range stay in full colour,
the rest dim, and a note under the map gives the count and share of the total.
It only affects the visual: no selection is sent to the report, nothing is
persisted, and it repaints without extra rendering events. Disabled in format
mode and when allowInteractions is false.

2. TARGET ROLE (PRO). A new measure role. Tile colour = (Value - Target) /
|Target| on a diverging scale symmetric around 0. Legend, labels and rules read
in variance; tooltip shows actual, target and variance. Without a licence it is
drawn under the Pro preview notice while editing (same per-feature preview as
1.2).

3. LABEL CONTENT. Auto / Value / Name / Name and value (two lines). Never below
8 px and never wider than the tile.

4. STYLE TEMPLATE. Report theme (free; colours from host.colorPalette) and six
collection styles (Pro). A colour set by the author always wins.

5. HIGHLIGHT. supportsHighlight: true. The mapping declares both table (used to
build the map) and categorical (latitude, longitude, label, category; value).
Highlighted rows are read from categorical.values[0].highlights and matched to
table rows by their grouping values, not by position.

6. ON-OBJECT FORMATTING. supportsOnObjectFormatting and
enablePointerEventsFormatMode, with powerbi-visuals-utils-onobjectutils
(HtmlSubSelectionHelper). Tiles, labels and legend have styles, shortcuts and a
link to their card. In format mode a click selects what to format and never
filters; keyboard selection is off too.

7. LANGUAGES. 12 stringResources. Desktop only resolves keys declared in
capabilities.json, so on-canvas texts (start screen, notes, tooltips, licence
banner) also ship in the bundle (src/strings.ts).

8. FORMAT AND RENDERING. Values use the model's format string and locale via
powerbi-visuals-utils-formattingutils. Fixed: licence resolution and TopoJSON
drop repainted through update(), sending extra rendering events; internal
repaints now draw without events, so each update reports one start and one
finish. Fixed: the stylesheet was not packaged.

9. Toolchain: ESLint 10, TypeScript 5.9, tools 7.2.1, API 5.11.1, npm audit 0.

------------------------------------------------------------------
LICENSE VALIDATION
------------------------------------------------------------------
The visual uses the official IVisualLicenseManager API. No external licence
server is contacted and no licence data leaves the Power BI environment.

- getAvailableServicePlans() is called asynchronously; rendering is never
  blocked. The visual starts Free and repaints when the licence arrives
  (including rebuilding the row cache so Pro gets all rows).
- A plan counts as Pro when its spIdentifier (the full Service ID,
  publisher.offer.plan) ends with ".tile-grid-map-pro-tcviz" and its state is
  Active (1) or Warning (2, payment grace). The 30-day trial is Pro.
- isLicenseUnsupportedEnv and isLicenseInfoAvailable are honoured: where
  licensing is unsupported (Publish to Web, embed, export) or the licence
  cannot be read, the visual stays Free and shows no licence notification.
- No own purchase UI (no upgrade text, badge or pill); the only notice of its
  own is the Pro preview watermark while editing. When a Free user uses a Pro
  feature the visual calls clearLicenseNotification, then notifyFeatureBlocked
  (banner naming the features), then notifyLicenseRequired (icon) 10.5 s later,
  once the banner has gone; the timer is cancelled in destroy().
  clearLicenseNotification is called again when the feature is no longer used
  or the licence becomes Pro.
- If the licensing call fails, the visual stays Free and renders normally.

------------------------------------------------------------------
DATA ROLES
------------------------------------------------------------------
Latitude (Grouping, max 1), Longitude (Grouping, max 1), Value (Measure,
max 1), Size (Pro) (Measure, max 1), Target (Pro) (Measure, max 1),
Tooltips (Measure, max 10), Label (Grouping, max 1), Category (Grouping, max 1).
Table mapping (top 30000) plus categorical mapping (top 30000) for highlights.

------------------------------------------------------------------
FREE TIER (no license required)
------------------------------------------------------------------
- 27 bundled square tile grids (Spain, Canarias, Portugal, France, Germany,
  Italy, Sicily, Sardinia, United Kingdom, Netherlands, Belgium, Poland,
  Sweden, Norway, Switzerland, Austria, United States, Alaska, Hawaii,
  Canada, Mexico, Brazil, Argentina, Colombia, Australia, India, Japan)
- The first 500 rows (on-screen note "Showing the first 500 of N rows")
- Square tiles
- Legend Font, Text Size and Text Color
- Correct Latitude Distortion (on by default)
- Style template Report theme: sequential ramp from the report theme
- Aggregation: Auto (from field), Sum, Average, Count, Min, Max
- Rule-based colour rules (the visual's own 3-rule card, not fx formatting),
  labels, legend (top or bottom), decimals. Enable Rules switch in the card
  header; percent thresholds typed as shown (25 = 25%); with rules on the
  legend shows one swatch per active rule with its condition plus "Other"
- Borders, selection ring, no-data colour, show/hide empty cells
- Tooltips (up to 10 fields) and report page tooltips, cross-filtering,
  highlighting, Ctrl multi-select, context menu
- Legend range, Label Content, on-object formatting, 12 languages
- Keyboard navigation, high contrast (value encoded by opacity)

------------------------------------------------------------------
PRO TIER (active AppSource licence, trial or Warning state)
------------------------------------------------------------------
- All rows up to 30,000 (Power BI data reduction limit)
- Six collection styles (Boardroom, Ledger, Editorial, Signal, Aurora, Terrace)
- Target role: colour by variance against a target
- Tile Shape Circle / Hexagon (offset rows)
- Size role: a second measure scales each tile's area (not in TopoJSON mode)
- Quantile scale: 5 equal-count classes, legend shows break values
- Custom TopoJSON regions by drag & drop (lon/lat WGS84, max 5 MB),
  persisted in the .pbix via persistProperties()
- Diverging scale (neutral colour at zero when data crosses zero)
- Categorical scale with the Category role: majority category per tile, 12
  host-palette colours (stable across filters) + grey "Other", legend with the
  categories, tooltip "Category: X (+N more)"; without Category it colours by
  the first Label, no legend
- Custom scale colours (Color Min / Mid / Max)

------------------------------------------------------------------
DATA PRIVACY / NETWORK ACCESS
------------------------------------------------------------------
- The visual makes no network requests at all. The former TopoJSON URL option
  was removed in 1.1.0.0.
- No telemetry, no analytics, no cookies, no local or session storage.
- TopoJSON is read locally with FileReader from a drag & drop and stored in
  the report.
- capabilities.json declares "privileges": [].

------------------------------------------------------------------
CERTIFICATION REQUIREMENTS
------------------------------------------------------------------
- renderingStarted / renderingFinished / renderingFailed in every code path
  of update(), wrapped in try/catch.
- capabilities.json declares supportsLandingPage, supportsEmptyDataView,
  supportsKeyboardFocus, supportsMultiVisualSelection, supportsHighlight,
  supportsOnObjectFormatting and enablePointerEventsFormatMode.
  supportsSynchronizingFilterState is not declared (not implemented).
- Interactions gated on host.hostCapabilities.allowInteractions.
- High contrast via host.colorPalette.isHighContrast.
- Tooltips via host.tooltipService; context menu via
  selectionManager.showContextMenu (mouse and Shift+F10 / context-menu key).
- Keyboard: arrows move focus, Enter/Space select, Ctrl+Enter multi-select,
  Esc clears.
- Bookmarks and external selections are reflected on the tiles.
- No innerHTML, no eval, no external scripts at runtime. ESLint with
  eslint-plugin-powerbi-visuals is clean.

------------------------------------------------------------------
TESTING INSTRUCTIONS
------------------------------------------------------------------
1. Open the sample .pbix (table with Latitude, Longitude, Label and Value,
   plus a "Tips & Hints" page).

2. Assign Latitude, Longitude, Value; optionally Label and Tooltips.

3. Without a Pro licence, verify:
   - Map Settings > Country/Region switches between the 27 grids.
   - With more than 500 rows: "Showing the first 500 of N rows". Rows outside
     the map or without coordinates are counted on screen.
   - While EDITING, a Pro style, Scale Type "Quantile/Diverging/Categorical
     (Pro)", changed Color Min/Max, Tile Shape Circle/Hexagon, a field in
     Size (Pro) or Target (Pro) is drawn under a "Pro preview" notice naming
     it; Power BI shows the banner, then the Upgrade bar. In reading view the
     free result is shown with no notice.
   - Legend: drag across the gradient (tiles outside dim, note under the map);
     click the gradient to clear. Label Content > Name and value.
   - Click a bar in another visual: the map highlights instead of filtering.
   - Correct Latitude Distortion on/off changes tile proportions (e.g. Norway).
   - Country/Region = "Custom TopoJSON (Pro)": while EDITING, the drop zone
     appears and a dropped file is drawn under the Pro preview notice; in
     reading view it shows "Custom TopoJSON regions are not available" and no
     drop zone.
   - Click cross-filters; click again or click the background clears;
     Ctrl+click multi-selects; right-click opens the context menu.
   - Keyboard: Tab into the visual, arrows, Enter/Space, Ctrl+Enter, Esc,
     Shift+F10.

4. With an active Pro licence or during the 30-day trial, verify:
   - All rows up to 30,000 are used.
   - Styles, Target, quantile, diverging, categorical and Color Min/Mid/Max
     take effect with no notice.
   - Circle and Hexagon shapes apply.
   - A measure in Size scales tile area and appears in the tooltip.
   - Country/Region = "Custom TopoJSON (Pro)" shows a drop zone. Dropping a
     TopoJSON file renders its regions; save, close and reopen keeps it.

5. Apply a slicer and a bookmark: the map re-renders with the filtered subset
   and reflects the bookmarked selection.
```

---

## Checklist antes de enviar

- [ ] Versión `1.3.0.0` en `pbiviz.json` y `1.3.0` en `package.json` (3 dígitos)
- [ ] GUID `tileGridMapProTCViz1234567890` (sin sufijo)
- [ ] `isPro` resuelto por `licenseManager` (no forzado a `true`)
- [ ] Sin instrumentación de debug ni marcadores de build
- [ ] Rama `certification` actualizada, sin `node_modules`, `.tmp` ni `dist`
- [ ] `.gitignore` incluye esas tres rutas
- [ ] URLs de privacy, terms y support activas en GitHub Pages
- [ ] `.pbix` de muestra con página "Tips & Hints", solo con la build de producción y con otro visual en la página (para probar el resaltado)
- [ ] Estas notas (o `docs/CERTIFICATION-NOTES-SHORT.txt`) copiadas en Partner Center
