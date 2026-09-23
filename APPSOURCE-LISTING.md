# AppSource listing copy — Tile Grid Map Pro v1.2.0.0

Copy ready to paste into Partner Center, English only. **The marketplace description is the
documentation most people read** — update it on every release.

Limits measured in Partner Center: *Search results summary* 100 characters, *Description*
5,000 (truncated silently). **Editing this file does not change the offer**: the field
Microsoft reviews lives only in the console.

This file did not exist before 1.2.0.0. The offer has a description in Partner Center, but it
was never kept under version control, so nobody could tell what the live text said without
opening the console. Paste this over it.

---

## Offer name

```
Tile Grid Map Pro
```

---

## Search results summary

```
Tile grid maps for Power BI: every region the same size, so none of them can hide.
```

---

## Description

```
On a normal map, the regions that matter least take up the most room. A province with forty thousand people and a lot of countryside dominates the screen; the city district with two million is a dot you cannot click. You are reading acreage, not data.

A tile grid map gives every region the same square, arranged so the shape is still recognisable. Madrid is as big as Castilla y León. Rhode Island is as big as Texas. The colour is the only thing carrying information, which is what you wanted in the first place.

TWENTY-SEVEN GRIDS, READY TO USE

Spain (and the Canaries separately), Portugal, France, Germany, Italy (plus Sardinia and the smaller islands), the United Kingdom, the Netherlands, Belgium, Poland, Sweden, Norway, Switzerland, Austria, the United States (plus Alaska and Hawaii), Canada, Mexico, Brazil, Argentina, Colombia, Australia, India and Japan.

Bind latitude, longitude and a value. Each row snaps to its nearest tile — no region codes to look up, no join to maintain, no name spelling to get right.

READING THE MAP

• Aggregation per tile: automatic, sum, average, count, minimum or maximum
• Up to three colour rules with their own legend, for thresholds that mean something to your business
• Labels on the tiles, a legend, borders and a selection ring
• Tooltips with up to ten fields of your choosing
• Correct latitude distortion, so northern regions stop looking larger than they are

PRO

• Up to 30,000 rows instead of the first 500
• Circle and hexagon tiles as well as squares
• Your own colours on the sequential scale
• Quantile, diverging and categorical scales — diverging for anything with a meaningful centre, categorical to colour by a category field rather than by value
• A Size field: the tile keeps its place in the grid and changes area, so you can read two measures at once
• Custom TopoJSON: drop in your own regions — sales territories, health districts, franchise areas — and they are saved inside the report

SEE IT BEFORE YOU BUY IT

Turn on a Pro feature without a licence and it is drawn working, under a "Pro preview" watermark that names it. You see your own data as a hexagon grid, on a diverging scale, sized by a second measure — not a screenshot of someone else's data. Reading view shows the free result with no watermark, so a published report never uses a feature nobody paid for.

INTEGRATED WITH POWER BI

• Click a tile to cross-filter the report; Ctrl+click for several
• Filters from other visuals are reflected in the map
• Right-click for the Power BI context menu
• Keyboard navigation and high contrast

PRIVACY

The visual makes no network requests of any kind: no map tile server, no geocoding service, no analytics, no telemetry. Your coordinates never leave the report. That is also why the grids ship inside the visual and why custom regions arrive by drag and drop rather than from a URL.

GETTING STARTED

1. Add the visual and bind Latitude, Longitude and a Value.
2. Pick your country under Format → Map Settings.
3. Pro: add a Size measure, or drop in your own TopoJSON for territories that are not a country.

Documentation and sample data: https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html
Support: support@tcviz.com

WHAT'S NEW IN 1.2.0.0

Pro preview: every Pro feature can now be seen working on your own data before you buy it. And a fix that matters — the Upgrade option could disappear before you had a chance to use it, because the notice naming the blocked feature was replacing it instead of following it.
```

---

## URLs to keep in sync

| Field | URL |
|---|---|
| Support / documentation | https://tinocallarisa-web.github.io/tile-grid-map-pro/support.html |
| Privacy policy | https://tinocallarisa-web.github.io/tile-grid-map-pro/privacy.html |
| Terms / licence | https://tinocallarisa-web.github.io/tile-grid-map-pro/terms.html |
| GitHub repo | https://github.com/tinocallarisa-web/tile-grid-map-pro |
| Video | https://www.youtube.com/watch?v=iCXAk3kI9nE |

Canonical YouTube URL only (policy 100.3.3.3). **This offer was rejected on 2026-09-18 for
exactly this**: the video had been pasted in the shortener form, `youtu` + `.be` followed by
the id, instead of the `watch?v=` form. Shortened links, `/shorts/` and `/embed/` are
rejected automatically. The URL written in the table above is the one to paste — deliberately
the only video URL in this file, so there is nothing wrong to copy by mistake.

## Search keywords (max 3)

```
tile grid map
cartogram
choropleth alternative
```

`tile grid map` is the name of the technique and what someone who already knows they want one
will type. `cartogram` is the academic term for the same idea and brings the people who know
the concept but not this name for it. `choropleth alternative` catches the ones who have a
normal filled map that is not working and are looking for a way out — that is the moment
this visual is bought.

`map` alone was not used: it competes with Azure Maps, Bing and every filled map in the
marketplace, and it brings people looking for roads and pins, which this visual deliberately
does not do.

## Plan

| Field | Value |
|---|---|
| Plan ID | `tile-grid-map-pro-tcviz` — matched by `SP_IDENTIFIER` in `src/visual.ts` as the full Service ID (`publisher.offer.plan`), accepted by suffix |
| Plan name | Tile Grid Map Pro |
| Price | $9.99 per user |
| Plan description | Unlocks up to 30,000 rows, circle and hexagon tiles, your own scale colours, the quantile, diverging and categorical scales, the Size role, and custom TopoJSON regions saved inside the report. |

## Images

| Asset | File |
|---|---|
| Offer screenshot | `docs/infographic.html` → *Download PNG*, 1366×768. **`docs/infographic.png` is the exported copy and has to be regenerated when the HTML changes** |
| Offer icon | 300×300, uploaded by hand: it does not travel inside the package |
| Package icon | `assets/icon.png`, embedded as `content.iconBase64` |
