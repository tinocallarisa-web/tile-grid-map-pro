# Changelog

All notable changes to **Tile Grid Map Pro** are documented here.

This project follows the Power BI custom visual four-part versioning scheme
(`major.minor.patch.build`).

---

## [1.2.0.0] — 2026-09-23

### Fixed

- **The purchase path was broken.** `notifyLicenseRequired` was raised first and `notifyFeatureBlocked` second, in the same update. Power BI shows one notification at a time and the last call replaces the previous one, so the banner wiped out the persistent Upgrade bar; when the banner faded some ten seconds later, a free user who had just reached for a Pro feature was left with **no way to buy at all**. The sequence is now: clear any standing notice, raise the banner naming the feature, and raise the Upgrade bar 10.5 seconds later, once the banner has gone. The timer is cancelled in `destroy()`, because Power BI recreates the visual on every page change and a live timer would notify on behalf of a map that no longer exists.

### Fixed (also new in this release)

- **The watermark did not go away when the Pro settings were turned off.** Two causes. The
  colour overrides were detected by the *presence* of the property in `metadata.objects`, and
  Power BI keeps a property written there for good once it has been touched — even after the
  user puts the colour back to its original value — so "custom scale colours" stayed on the
  list for ever. It now compares the **value** against the free default. A legitimate value can
  never be a sentinel; this is the same fault that cost a release in Pareto Chart Pro. The
  second cause was introduced with the preview itself: the labels were computed *before* the
  render, but `_hasSize` and the row count are filled in *during* it, inside `scan()`, so
  removing the Size field left the watermark up for one more update. The keys are still
  computed first, because the render needs them to decide what to draw, but the labels are
  recomputed afterwards with fresh data.

### Added

- **Pro preview.** A free user who chose a hexagon tile, a diverging scale, custom colours or a size measure saw the setting **silently reverted** — the map simply carried on as before. That does not read as "there is something here to buy", it reads as a visual that ignores you. Those features are now drawn *working*, under a "Pro preview" watermark that names them, while you edit a report without a licence. In reading view — and anywhere the licence cannot be read, such as Publish to Web, embedding or export — the free result renders with no watermark and no prompt, so a published report never uses a feature nobody paid for. The preview is granted **per feature**, never in bulk: inserting the visual hands out nothing, because nothing has been asked for yet.

### Changed

- **The format pane is available in Spanish.** It was always going to be English: `capabilities.json` had **zero** `displayNameKey`, `settings.ts` had none either, `stringResources` in the manifest was an empty array, and `FormattingSettingsService` was built without a localization manager — so even the `en-US` folder that existed was a dead file nobody read. There are now 100 keys in `en-US` and `es-ES`, covering the five cards, the 34 pane settings, the seven field wells, their descriptions, every enumeration value and all 27 grid names. Six entries are identical in both languages because the country is spelled the same.
- **Toolchain on current versions.** Tools 7.2.1, API 5.11.1 (the manifest still declared 5.10.0), TypeScript 5.5.4 and the `qs`/`uuid` overrides. `npm audit` reports 0 vulnerabilities, lint runs over four files with no errors, and `pbiviz package --certification-audit` — the official check for `fetch`, `XMLHttpRequest` and `eval`, which needs tools 6.1.0 and could not be run before — finds no external requests.

---

## [1.1.0.0] — 2026-09-14

### Fixed
- **Licence never matched a paying customer.** `spIdentifier` is the full Service
  ID (`publisher.offer.plan`); it is now accepted when it ends with
  `.tile-grid-map-pro-tcviz`.
- A Pro customer stayed limited to 500 rows after the licence arrived (the row
  cache was not rebuilt).
- Coastal points (Barcelona, Valencia, Porto, New York, Miami, Perth, Osaka…) were
  silently dropped by the land masks. They are now snapped to the nearest land cell
  within 3 cells, and rows truly outside the map are counted on screen.
- Blank values were counted as 0 (wrong averages and minimums) and blank
  coordinates as 0,0.
- The default aggregation summed already-aggregated fields. New default
  **Auto (from field)** follows the field-well aggregation (Sum / Average / Min /
  Max / Count); model measures default to Sum, and the tooltip names the
  aggregation used.
- The legend is now drawn from the same scale as the tiles (diverging midpoint,
  free palette, minimum excludes empty cells). With colour rules on it shows one
  swatch per active rule with its condition (e.g. "< 0", "0 – 100", "> 100",
  thresholds formatted like the field) plus "Other"; with the categorical scale it
  lists the categories and their colours.
- High contrast now encodes the value by opacity.
- Ctrl multi-select highlighted only one tile.
- Clicking the background left the selection ring visible.
- TopoJSON: MultiPolygon regions are one region; the tooltip shows the region name;
  projected-coordinate files are detected and explained; invalid or oversized files
  are explained.
- Number formatting respects the locale, the field's percent format and 0 decimals;
  no more "1000K".
- Colour rules (the visual's own 3-rule card): rule 3 default changed to `> 100` (was `>= 0`, which
  matched everything); empty thresholds are ignored; the Enable switch moved to the
  card header; thresholds for a percent field are typed as shown (25 for 25%).
- Labels are only drawn when they fit.
- "Show Empty Cells" and legend "Position" (Top / Bottom; Right removed) now work.
- Legend text font, size and colour are configurable (Format → Legend).
- Tiny viewports no longer draw broken tiles.

### Added
- **Tile Shape** (Map Settings): Square (Free), Circle (Pro), Hexagon (Pro).
  Hexagons use offset rows (odd rows shifted half a tile).
- **Legend text options** (Format → Legend): Font, Text Size, Text Color (Free).
- **Category** data role (Grouping, max 1), used by the **Categorical (Pro)** scale:
  each tile takes the category with the most rows; the 12 categories covering most
  rows get the report theme's colours (stable per category across filters) and the
  rest share a grey "Other". The legend lists the categories (up to 2 rows, long
  names shortened) and the tooltip shows "Category: X (+N more)". Without a
  Category field, Categorical colours by the first Label, with no legend.
- **Size (Pro)** data role (Measure, max 1): a second measure scales each tile's
  area (colour = Value, size = Size). Shown in the tooltip. Not applied in Custom
  TopoJSON mode.
- **Quantile (Pro)** scale type: 5 classes with an equal number of cells each,
  coloured from Color Min to Color Max; the legend shows the classes with their
  break values, so one outlier no longer washes out the map.
- **Correct Latitude Distortion** (Map Settings, Free, on by default): tiles take the
  real ground proportion of each cell at the map's mid-latitude, so northern
  countries (Norway, Sweden, Canada) are no longer stretched.
- **Keyboard navigation:** arrow keys move focus, Enter / Space select,
  Ctrl+Enter multi-selects, Esc clears, Shift+F10 or the context-menu key opens the
  context menu.
- Bookmarks and external selections are reflected on the tiles.
- On-screen row notes: "Showing the first 500 of N rows", "Power BI sent the first
  30,000 rows", and how many rows were not shown (outside the map / without
  coordinates).

### Changed
- Finer default grids for Canarias and Hawaii: each cell is split 4×4 (about 380
  and 240 tiles instead of 24 and 15), so the islands read in detail.

### Removed
- TopoJSON URL option — the visual no longer makes any network request. Custom
  TopoJSON is loaded only by drag & drop and saved in the report.
- "Pro Settings → Show Pro Pill" and the in-visual "Upgrade" message; Power BI's
  own licence notifications are used instead.
- Unused format options, the unimplemented `supportsHighlight` /
  `supportsSynchronizingFilterState` flags, unused dependencies and dead code.

### Security / compliance
- No `innerHTML`; ESLint (`eslint-plugin-powerbi-visuals`) clean.

---

## [1.0.0.5] — 2026-08-09

### Added
- **30-day free trial** — users without a paid license are granted full Pro
  access for 30 days via the AppSource trial plan, unlocking all Pro features
  during the trial period.

---

## [1.0.0.4] — 2026-08-02

### Added
- **Configurable tooltip decimals** — new *Tooltip Decimal Places* setting in
  Map Settings (0–6, default 2).
- **TopoJSON persistence** — boundary files loaded by drag-and-drop are now
  stored inside the `.pbix` and survive closing and reopening the report. No
  need to re-upload after every session.
- **Drag-and-drop TopoJSON loading** — drop a `.json` / `.topojson` file
  directly onto the visual instead of hosting it at a URL.
- **Per-field tooltip aggregation** — each tooltip measure is now aggregated
  using its own aggregation type, so a Sum field and an Average field in the
  same tooltip both report correctly.

### Changed
- **Faster TopoJSON rendering** — added a bounding-box prefilter before
  point-in-polygon testing, and cached the scan result per dataView. Settings
  changes no longer re-run the geometry pass.
- **Automatic aggregation detection** — the visual reads the aggregation type
  from the field's metadata (query name, display name and aggregate values)
  rather than assuming Sum. *Value Aggregation* remains available as a manual
  override.

### Fixed
- Tooltip values were computed from the first row in a cell instead of the
  aggregate of all rows.
- Sum aggregation was applied to fields defined as Average.
- Clicking a selected cell or polygon a second time did not deselect it.
- Deselection failed on cells containing more than one data point, because the
  cross-filter re-render cleared the selection state from the DOM.
- Selecting "All" in a slicer did not clear the map selection — it required an
  extra click on empty space in the visual.
- Conditional formatting Rule 2 did not behave as a between-range test.

### Documentation
- Rewrote the support page: it previously described Location/ISO-code field
  wells and features that do not exist in this visual.
- Added a video walkthrough: https://www.youtube.com/watch?v=LnTb3qHsHdg
- Privacy Policy now documents the drag-and-drop file path and `.pbix`
  persistence explicitly.
- Terms of Use now list Custom TopoJSON under the Pro tier, and add a clause on
  user-supplied boundary files.

---

## [1.0.0.3] — 2026

### Added
- Custom TopoJSON mode (Pro) with point-in-polygon assignment of coordinates.
- Conditional formatting with three rules, including a between-range rule.
- Accessibility card: cell borders, border colour and width, selection ring
  colour and width.
- Configurable label minimum tile size for responsive label hiding.

### Changed
- Rendering rewritten to build SVG as a single string and parse it in one pass,
  replacing per-cell DOM node creation.
- Event handling moved to delegation — one listener on the SVG root instead of
  one per cell.

---

## [1.0.0.0] — 2026

Initial release.

- Tile grid maps for 27 countries and regions.
- Latitude / longitude binding with automatic grid cell assignment.
- Value aggregation: Sum, Average, Count, Min, Max.
- Sequential, diverging and categorical colour scales.
- Tooltips with up to 10 additional measures.
- Legend with configurable position.
- High contrast support, cross-filtering, multi-selection and context menu.
- Free tier limited to 500 data points; Pro tier without the 500-point cap.

---

[1.1.0.0]: https://github.com/tinocallarisa-web/tile-grid-map-pro
[1.0.0.5]: https://github.com/tinocallarisa-web/tile-grid-map-pro
[1.0.0.4]: https://github.com/tinocallarisa-web/tile-grid-map-pro
[1.0.0.3]: https://github.com/tinocallarisa-web/tile-grid-map-pro
[1.0.0.0]: https://github.com/tinocallarisa-web/tile-grid-map-pro
