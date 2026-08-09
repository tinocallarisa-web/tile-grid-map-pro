# Changelog

All notable changes to **Tile Grid Map Pro** are documented here.

This project follows the Power BI custom visual four-part versioning scheme
(`major.minor.patch.build`).

---

## [1.0.0.5] — 2026-08-09

### Added
- **30-day free trial** — users without a paid license are granted full Pro
  access for 30 days via the AppSource trial plan. The visual now recognises
  `ServicePlanState.FreeTrial` (state 2) in addition to `Active` (state 1)
  and unlocks all Pro features during the trial period.

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
- Free tier limited to 500 data points; Pro tier unlimited.

---

[1.0.0.4]: https://github.com/tinocallarisa-web/tile-grid-map-pro
[1.0.0.3]: https://github.com/tinocallarisa-web/tile-grid-map-pro
[1.0.0.0]: https://github.com/tinocallarisa-web/tile-grid-map-pro
