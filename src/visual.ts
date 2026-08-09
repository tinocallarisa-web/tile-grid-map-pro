"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

import { VisualFormattingSettingsModel } from "./settings";
import { COUNTRY_GRIDS, CountryGrid, latLngToCell, isInMask } from "./countryGrids";
import {
  freeSequentialScale,
  sequentialScale,
  divergingScale,
  categoricalColor,
  normalise,
  domain,
} from "./colorScale";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions      = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                  = powerbi.extensibility.visual.IVisual;
import IVisualHost              = powerbi.extensibility.visual.IVisualHost;
import DataView                 = powerbi.DataView;
import ISelectionId             = powerbi.visuals.ISelectionId;
import ISelectionManager        = powerbi.extensibility.ISelectionManager;
import IVisualLicenseManager    = powerbi.extensibility.IVisualLicenseManager;
import LicenseInfoResult        = powerbi.extensibility.visual.LicenseInfoResult;
import IVisualEventService      = powerbi.extensibility.IVisualEventService;
import VisualTooltipDataItem    = powerbi.extensibility.VisualTooltipDataItem;

// ─── Constants ────────────────────────────────────────────────────────────────
const SP_IDENTIFIER   = "tile-grid-map-pro-tcviz";
const HEX_FLAT_ANGLES = [0, 60, 120, 180, 240, 300].map(d => (d * Math.PI) / 180);

// ─── TopoJSON types ───────────────────────────────────────────────────────────
interface TopoFeature {
  rings: [number, number][][];  // [outerRing, ...holes] in source coordinates
  bbox:  [number, number, number, number]; // [minX, maxX, minY, maxY] precomputed for fast prefilter
}

interface TopoFeatureData {
  value: number;
  valueCount: number;
  count: number;
  aggType: string;
  hasValue: boolean;
  selectionIds: ISelectionId[];
  tooltipExtras: { displayName: string; value: string }[];
}

// ─── Raw cell map (intermediate cache between row scan and color computation) ──
type TooltipColData = { nums: number[]; firstText: string; aggType: string };
type RawCellEntry = {
  col: number; row: number;
  values: number[]; labels: string[];
  tooltips: Map<string, TooltipColData>;  // numeric values aggregated; text: first occurrence
  selIds: ISelectionId[];                 // ALL row selectionIds — needed for correct cross-filter
};
type RawCellMap = Map<string, RawCellEntry>;

// ─── Cell data point ─────────────────────────────────────────────────────────
interface CellDataPoint {
  col: number;
  row: number;
  value: number;
  count: number;      // total rows mapping to this cell (for selection)
  valueCount: number; // valid (non-NaN) values used in aggregation
  aggType: string;
  labels: string[];
  tooltipExtras: { displayName: string; value: string }[];
  selectionIds: ISelectionId[];
  color: string;
}

// ─── Visual ───────────────────────────────────────────────────────────────────
export class Visual implements IVisual {
  private readonly host!: IVisualHost;
  private readonly selectionManager!: ISelectionManager;
  private readonly licenseManager!: IVisualLicenseManager;
  private readonly formattingService!: FormattingSettingsService;
  private readonly events!: IVisualEventService;
  private readonly tooltipSvc!: any; // typed as any — cross-version compat

  private container!: HTMLElement;
  private svg!: SVGSVGElement;
  private settings!: VisualFormattingSettingsModel;

  private isPro: boolean = false;
  private freeLimitHit: boolean = false;
  private _lastOptions: VisualUpdateOptions | null = null;
  private dataPoints: CellDataPoint[] = [];
  private grid: CountryGrid | null = null;

  private hcFg: string = "#000";
  private hcBg: string = "#fff";

  // Layout state — kept for event delegation hit-testing
  private _tileSize: number = 0;
  private _offsetX:  number = 0;
  private _offsetY:  number = 0;
  private _gap:      number = 0;
  private _dpMap:    Map<string, CellDataPoint> = new Map();

  // Contrast colour cache — avoids re-computing per cell
  private _contrastCache: Map<string, string> = new Map();

  // ── Raw cell cache — expensive row scan, rebuilt only when dataView changes ──
  // Stores pre-aggregated cell data independent of visual settings (colors, etc.)
  private _rawCellMap: RawCellMap | null = null;
  private _lastDataView: DataView | null = null;
  private _detectedAggType: string = "sum"; // auto-detected from value column metadata

  // SVG bounding rect cache — avoids getBoundingClientRect() on every mousemove
  private _svgBounds: { left: number; top: number } = { left: 0, top: 0 };

  // TopoJSON custom mode
  private _topoCache:       Record<string, TopoFeature[]> = {};
  private _pendingTopoUrl:  string = "";
  private _topoFeatureData: TopoFeatureData[] = [];
  private _localTopoKey:    string = "";   // key of the locally-loaded file in _topoCache

  // Cache for topo point-in-polygon scan result (O(n×m), expensive — cached per dataView)
  private _rawTopoDataView: DataView | null = null;
  private _rawTopoFeatVals:     number[][]                        = [];
  private _rawTopoFeatSelIds:   ISelectionId[][]                  = [];
  private _rawTopoFeatRowCount: number[]                          = [];
  private _rawTopoFeatTooltips: Map<string, TooltipColData>[]     = [];

  // Track selected cell/polygon so data-selected survives cross-filter re-renders
  private _selectedGridCell: { col: number; row: number } | null = null;
  private _selectedTopoFi:   number = -1;

  constructor(options: VisualConstructorOptions | undefined) {
    if (!options) { return; }

    this.host              = options.host;
    this.selectionManager  = this.host.createSelectionManager();

    // When selection is cleared externally (slicer "All", cross-visual deselect, etc.)
    // PBI calls this callback — we reset visual selection state to match.
    this.selectionManager.registerOnSelectCallback((ids: powerbi.extensibility.ISelectionId[]) => {
      if (ids.length === 0) {
        this._selectedGridCell = null;
        this._selectedTopoFi   = -1;
        this.svg.querySelectorAll("[data-selected='true']").forEach(el =>
          el.setAttribute("data-selected", "false")
        );
        this.updateOpacity();
      }
    });

    this.formattingService = new FormattingSettingsService();
    this.settings          = new VisualFormattingSettingsModel();
    this.events            = this.host.eventService;
    this.tooltipSvc        = this.host.tooltipService;

    this.licenseManager = this.host.licenseManager;

    // License check — Pro features unlocked via AppSource service plan
    this.isPro = false; // default free until license confirmed
    this.host.licenseManager.getAvailableServicePlans().then((result) => {
      const wasProBefore = this.isPro;
      this.isPro = result?.plans?.some(
        p => p.spIdentifier === "tile-grid-map-pro-tcviz" &&
          ((p.state as unknown as number) === 1 /* ServicePlanState.Active */ ||
           (p.state as unknown as number) === 2 /* ServicePlanState.FreeTrial */)
      ) ?? false;
      if (this.isPro !== wasProBefore && this._lastOptions) {
        this.update(this._lastOptions);
      }
    }).catch(() => { /* license check failed — stay free */ });

    this.container = options.element;
    this.container.style.position   = "relative";
    this.container.style.overflow   = "hidden";
    this.container.style.fontFamily = "'Segoe UI', system-ui, sans-serif";

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.width   = "100%";
    this.svg.style.height  = "100%";
    this.svg.style.display = "block";
    this.container.appendChild(this.svg);

    // ── Delegated event handlers (one per event type, not per cell) ──

    // Helper: get topo feature index from event target
    const getTopoFi = (e: MouseEvent): number => {
      const el = (e.target as Element)?.closest?.("path[data-fi]");
      return el ? parseInt(el.getAttribute("data-fi") ?? "-1", 10) : -1;
    };

    this.svg.addEventListener("contextmenu", (e: MouseEvent) => {
      if (!this.host.hostCapabilities.allowInteractions) return;
      e.preventDefault();
      const fi = getTopoFi(e);
      if (fi >= 0 && this._topoFeatureData[fi]?.selectionIds.length) {
        this.selectionManager.showContextMenu(this._topoFeatureData[fi].selectionIds[0], { x: e.clientX, y: e.clientY });
      } else {
        const dp = this.hitTest(e);
        this.selectionManager.showContextMenu(dp?.selectionIds[0] ?? ({} as ISelectionId), { x: e.clientX, y: e.clientY });
      }
    });

    this.svg.addEventListener("click", (e: MouseEvent) => {
      if (!this.host.hostCapabilities.allowInteractions) return;

      // TopoJSON mode
      const fi = getTopoFi(e);
      if (fi >= 0) {
        const fd = this._topoFeatureData[fi];
        if (fd?.hasValue && fd.selectionIds.length > 0) {
          e.stopPropagation();
          const hitPath   = this.svg.querySelector(`path[data-fi="${fi}"]`);
          const isSelected = hitPath?.getAttribute("data-selected") === "true";

          if (isSelected && !e.ctrlKey && !e.metaKey) {
            // Second click on selected polygon → deselect
            this._selectedTopoFi = -1;
            this.selectionManager.clear().then(() => {
              this.svg.querySelectorAll("path[data-fi]").forEach(p => p.setAttribute("data-selected", "false"));
              this.updateOpacity();
            });
          } else {
            this._selectedTopoFi = fi;
            this.selectionManager.select(fd.selectionIds, e.ctrlKey || e.metaKey).then(() => {
              this.svg.querySelectorAll("path[data-fi]").forEach(p => p.setAttribute("data-selected", "false"));
              if (hitPath && this.selectionManager.hasSelection()) hitPath.setAttribute("data-selected", "true");
              this.updateOpacity();
            });
          }
          return;
        }
      }

      // Grid mode
      const dp = this.hitTest(e);
      if (dp) {
        e.stopPropagation();
        const col = Math.floor((e.offsetX - this._offsetX) / this._tileSize);
        const row = Math.floor((e.offsetY - this._offsetY) / this._tileSize);
        const hitRect  = this.svg.querySelector(`rect[data-col="${col}"][data-row="${row}"]`);
        const wasSelected = hitRect?.getAttribute("data-selected") === "true";

        if (wasSelected && !e.ctrlKey && !e.metaKey) {
          // Second click on same cell → deselect
          this._selectedGridCell = null;
          this.selectionManager.clear().then(() => {
            this.svg.querySelectorAll("rect[data-has-data='true']").forEach(r => r.setAttribute("data-selected", "false"));
            this.updateOpacity();
          });
        } else {
          this._selectedGridCell = { col, row };
          this.selectionManager.select(dp.selectionIds, e.ctrlKey || e.metaKey).then(() => {
            this.svg.querySelectorAll("rect[data-has-data='true']").forEach(r => r.setAttribute("data-selected", "false"));
            if (hitRect && this.selectionManager.hasSelection()) hitRect.setAttribute("data-selected", "true");
            this.updateOpacity();
          });
        }
      } else {
        this.selectionManager.clear().then(() => {
          this.svg.querySelectorAll("rect[data-has-data='true']").forEach(r => {
            r.setAttribute("data-selected", "false");
            (r as SVGElement).style.opacity = "1";
          });
        });
      }
    });

    let _lastTooltipKey = "";
    this.svg.addEventListener("mousemove", (e: MouseEvent) => {
      // TopoJSON mode — show tooltip on ALL polygons (with or without data)
      const fi = getTopoFi(e);
      if (fi >= 0 && this._topoFeatureData.length > 0) {
        const fd = this._topoFeatureData[fi];
        if (fd) {
          const key = `topo-${fi}`;
          const items = this.buildTopoTooltipItems(fd);
          if (key !== _lastTooltipKey) {
            this.tooltipSvc.show({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: items, identities: fd.selectionIds });
            _lastTooltipKey = key;
          } else {
            this.tooltipSvc.move({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: items, identities: fd.selectionIds });
          }
          return;
        }
      }

      // Grid mode
      const dp = this.hitTest(e);
      if (dp) {
        const key = `${dp.col},${dp.row}`;
        const items = this.buildTooltipItems(dp);
        if (key !== _lastTooltipKey) {
          this.tooltipSvc.show({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: items, identities: dp.selectionIds });
          _lastTooltipKey = key;
        } else {
          this.tooltipSvc.move({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: items, identities: dp.selectionIds });
        }
      } else {
        if (_lastTooltipKey !== "") {
          this.tooltipSvc.hide({ immediately: false, isTouchEvent: false });
          _lastTooltipKey = "";
        }
      }
    });

    this.svg.addEventListener("mouseleave", () => {
      this.tooltipSvc.hide({ immediately: false, isTouchEvent: false });
      _lastTooltipKey = "";
    });

    // ── Drag-and-drop for local TopoJSON loading ──
    this.container.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      this.container.style.outline = "2px dashed #2980b9";
    });

    this.container.addEventListener("dragleave", (e: DragEvent) => {
      e.preventDefault();
      this.container.style.outline = "";
    });

    this.container.addEventListener("drop", (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.style.outline = "";
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const raw = JSON.parse(content);
          const key = `local::${file.name}`;
          this._topoCache[key]  = this.decodeTopoJson(raw);
          this._localTopoKey    = key;
          this._rawTopoDataView = null; // invalidate scan cache for new TopoJSON
          // Persist in .pbix so the TopoJSON survives report close/reopen
          this.host.persistProperties({
            merge: [{
              objectName: "proSettings",
              selector:   {},
              properties: {
                topoJsonContent:  content,
                topoJsonFileName: file.name,
              }
            }]
          });
          if (this._lastOptions) this.update(this._lastOptions);
        } catch (err) {
          console.error("TileGridMapPro: error parsing dropped TopoJSON", err);
        }
      };
      reader.readAsText(file);
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  public update(options: VisualUpdateOptions): void {
    this.events.renderingStarted(options);
    this._lastOptions = options;
    try {
      const dataView = options?.dataViews?.[0];

      this.settings = this.formattingService.populateFormattingSettingsModel(
        VisualFormattingSettingsModel,
        dataView
      );

      // High Contrast
      const palette = this.host.colorPalette;
      const isHC    = palette.isHighContrast;
      if (isHC) {
        this.hcFg = (palette as any).foreground?.value ?? "#fff";
        this.hcBg = (palette as any).background?.value ?? "#000";
      }

      this.svg.innerHTML = "";  // single DOM op, replaces while-removeChild loop
      this._contrastCache.clear();
      this._topoFeatureData = [];

      // Resolve country / mode
      const countryKey = String(this.settings.mapSettings.country.value);

      // ── Custom TopoJSON mode ──
      if (countryKey === "custom" && this.isPro) {
        const url = String(this.settings.proSettings.customTopoJsonUrl.value ?? "").trim();

        // Restore persisted TopoJSON from .pbix if not already in memory cache
        // (happens after report close/reopen — drag-and-drop data lives in .pbix properties)
        if (!this._localTopoKey) {
          const saved = dataView?.metadata?.objects?.["proSettings"];
          const savedContent  = saved?.["topoJsonContent"]  as string | undefined;
          const savedFileName = saved?.["topoJsonFileName"] as string | undefined;
          if (savedContent && savedFileName) {
            try {
              const key = `local::${savedFileName}`;
              if (!this._topoCache[key]) {
                this._topoCache[key] = this.decodeTopoJson(JSON.parse(savedContent));
              }
              this._localTopoKey = key;
            } catch (e) {
              console.warn("TileGridMapPro: could not restore persisted TopoJSON", e);
            }
          }
        }

        // Determine which cache key to use: URL or last loaded local file
        const cacheKey = url || this._localTopoKey;

        if (cacheKey && this._topoCache[cacheKey]) {
          // Already decoded — render immediately
          if (dataView?.table) {
            this.renderTopoMode(this._topoCache[cacheKey], options.viewport, isHC);
            this.restoreSelectionState();
          } else {
            this.renderLandingPage(options.viewport, isHC);
          }
        } else if (url) {
          // Fetch from URL (only once per URL)
          this.renderEmpty("Loading TopoJSON…", isHC);
          if (this._pendingTopoUrl !== url) {
            this._pendingTopoUrl = url;
            this.loadTopoJson(url);
          }
        } else {
          // No URL and no local file loaded yet — show file picker button
          this.renderLocalFileButton(options.viewport, isHC);
        }

        if (this.isPro && this.settings.proSettings.showPill.value) {
          this.renderProPill(options.viewport);
        }
        this.events.renderingFinished(options);
        return;
      }

      // ── Grid mode ──
      this.grid = COUNTRY_GRIDS[countryKey] ?? COUNTRY_GRIDS["es"];

      // Landing page
      if (!dataView?.table) {
        this.renderLandingPage(options.viewport, isHC);
        this.events.renderingFinished(options);
        return;
      }

      // ── Only rebuild raw cell map when dataView actually changed ──
      // parseData is O(n_rows) + O(n_cells*selectionIdBuilder).
      // Settings changes (color, font, etc.) don't change data — skip row scan.
      if (dataView !== this._lastDataView || this._rawCellMap === null) {
        this._lastDataView = dataView;
        this._rawCellMap   = this.buildCellMap(dataView);
      }
      // Color computation is always O(n_cells) — cheap, always run
      this.dataPoints = this.buildDataPoints(this._rawCellMap, isHC);

      // Cache SVG bounds after paint for hitTest (avoids per-mousemove reflow)
      requestAnimationFrame(() => {
        const r = this.svg.getBoundingClientRect();
        this._svgBounds = { left: r.left, top: r.top };
      });

      // Render
      const useHex = false; // Hexagons coming in v1.1
      this.renderGrid(options.viewport, useHex, isHC);
      this.restoreSelectionState();

      if (this.settings.legend.showLegend.value) {
        this.renderLegend(options.viewport, isHC);
      }
      if (this.isPro && this.settings.proSettings.showPill.value) {
        this.renderProPill(options.viewport);
      }

      this.events.renderingFinished(options);
    } catch (e) {
      this.events.renderingFailed(options);
      console.error("TileGridMapPro render error:", e);
    }
  }

  // ── Build raw cell map (EXPENSIVE — O(n_rows), cached per dataView) ──────────
  // Only re-runs when the dataView object reference changes (new data from PBI).
  // Settings changes (colors, font, etc.) reuse the cached map.
  private buildCellMap(dataView: DataView | undefined): RawCellMap {
    if (!this.grid || !dataView?.table) return new Map();

    const table   = dataView.table;
    const columns = table.columns;
    const allRows = table.rows ?? [];

    const FREE_LIMIT = 500;
    const rows = this.isPro ? allRows : allRows.slice(0, FREE_LIMIT);
    this.freeLimitHit = !this.isPro && allRows.length > FREE_LIMIT;

    const latIdx   = columns.findIndex(c => c.roles?.["latitude"]);
    const lngIdx   = columns.findIndex(c => c.roles?.["longitude"]);
    const valIdx   = columns.findIndex(c => c.roles?.["value"]);
    const labelIdx = columns.findIndex(c => c.roles?.["label"]);
    const ttIdxs   = columns.map((c, i) => c.roles?.["tooltips"] ? i : -1).filter(i => i >= 0);

    if (latIdx < 0 || lngIdx < 0) return new Map();

    const cellMap: RawCellMap = new Map();

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const lat = Number(row[latIdx]);
      const lng = Number(row[lngIdx]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const cell = latLngToCell(lat, lng, this.grid!);
      if (!cell) continue;

      const key = `${cell.col},${cell.row}`;
      const val = valIdx >= 0 ? Number(row[valIdx]) : NaN;
      const lbl = labelIdx >= 0 ? String(row[labelIdx] ?? "") : "";

      // All selectionIds stored — needed for correct cross-filter.
      // Performance cost is paid only once per dataView change (cached in _rawCellMap).
      const selId = this.host.createSelectionIdBuilder()
        .withTable(table, rowIdx)
        .createSelectionId();

      if (!cellMap.has(key)) {
        cellMap.set(key, {
          col: cell.col, row: cell.row,
          values: [], labels: [],
          tooltips: new Map(),
          selIds: [],
        });
      }

      const entry = cellMap!.get(key)!;
      entry.selIds.push(selId);
      if (!isNaN(val)) entry.values.push(val);
      if (lbl && !entry.labels.includes(lbl)) entry.labels.push(lbl);

      // Tooltip: accumulate numeric values for aggregation; store first text value
      ttIdxs.forEach(ti => {
        const name = columns[ti].displayName ?? `col${ti}`;
        if (!entry.tooltips.has(name)) {
          entry.tooltips.set(name, { nums: [], firstText: "", aggType: this.detectAggType(columns[ti]) });
        }
        const td  = entry.tooltips.get(name)!;
        const raw = row[ti];
        const num = Number(raw);
        if (raw !== null && raw !== undefined && raw !== "" && !isNaN(num)) {
          td.nums.push(num);
        } else if (!td.firstText && raw != null) {
          td.firstText = String(raw);
        }
      });
    }

    // Detect aggregation type from value column metadata (set by user in PBI field well)
    if (valIdx >= 0) {
      this._detectedAggType = this.detectAggType(columns[valIdx]);
    }

    return cellMap;
  }

  // ── Detect aggregation from PBI column metadata ───────────────────────────────
  // PBI doesn't expose aggregationFunction cleanly, but modifies queryName and
  // displayName when the user changes the field-well aggregation.
  // queryName format: "Sum(Table.Field)", "Avg(Table.Field)", "Min(...)", etc.
  // displayName format: "Average of Sales", "Sum of Revenue", etc.
  private detectAggType(col: powerbi.DataViewMetadataColumn): string {
    // ── 1. queryName prefix (works for columns aggregated in the field well) ──
    // PBI formats: "Avg(Table[Col])", "Sum(Table[Col])", "Min(...)", etc.
    const qn = (col.queryName ?? "").toLowerCase();
    if (qn.startsWith("sum("))                                       return "sum";
    if (qn.startsWith("avg(") || qn.startsWith("average("))         return "average";
    if (qn.startsWith("min("))                                       return "min";
    if (qn.startsWith("max("))                                       return "max";
    if (qn.startsWith("count(") || qn.startsWith("counta(") ||
        qn.startsWith("countdistinct("))                             return "count";

    // ── 2. displayName prefix (PBI renames: "Average of Sales", etc.) ──
    const dn = (col.displayName ?? "").toLowerCase();
    if (dn.startsWith("average of ") || dn.startsWith("avg of ") ||
        dn.startsWith("promedio de ") || dn.startsWith("media de ")) return "average";
    if (dn.startsWith("sum of ")     || dn.startsWith("suma de "))   return "sum";
    if (dn.startsWith("min of ")     || dn.startsWith("minimum of ") ||
        dn.startsWith("mínimo de "))                                 return "min";
    if (dn.startsWith("max of ")     || dn.startsWith("maximum of ") ||
        dn.startsWith("máximo de "))                                 return "max";
    if (dn.startsWith("count of ")   || dn.startsWith("recuento de ") ||
        dn.startsWith("número de "))                                 return "count";

    // ── 3. Heuristic via col.aggregates (works for pre-defined measures) ──
    // PBI exposes: aggregates.subtotal, aggregates.average, aggregates.count
    // For a SUM field:     subtotal ≈ average × count  (subtotal = grand total)
    // For an AVERAGE field: subtotal ≈ average          (PBI reports avg as the "total")
    // For a COUNT field:    subtotal ≈ count
    const agg = col.aggregates;
    if (agg !== undefined) {
      const subtotal = Number(agg.subtotal);
      const average  = Number(agg.average);
      const count    = Number(agg.count ?? 0);
      if (!isNaN(subtotal) && !isNaN(average) && count > 1 && Math.abs(average) > 0) {
        const scale       = Math.abs(subtotal) || 1;
        const diffFromAvg = Math.abs(subtotal - average) / scale;
        const diffFromSum = Math.abs(subtotal - average * count) / scale;
        // subtotal ≈ average → AVERAGE field
        if (diffFromAvg < 0.001 && diffFromSum > 0.05) return "average";
        // subtotal ≈ average × count → SUM field
        if (diffFromSum < 0.001 && diffFromAvg > 0.05) return "sum";
      }
      // min/max: subtotal == min or max
      if (agg.min !== undefined && Math.abs(subtotal - Number(agg.min)) < 0.001) return "min";
      if (agg.max !== undefined && Math.abs(subtotal - Number(agg.max)) < 0.001) return "max";
      // if only count aggregate → count field
      if (agg.count !== undefined && agg.average === undefined && agg.subtotal === undefined) return "count";
    }

    return "sum"; // safe fallback
  }

  // ── Build data points from cached cell map (CHEAP — O(n_cells)) ───────────────
  // Runs on every update to recompute colors from current settings.
  private buildDataPoints(cellMap: RawCellMap | null, isHC: boolean): CellDataPoint[] {
    if (!cellMap || cellMap.size === 0) return [];

    const aggType    = String(this.settings.mapSettings.aggregationType.value);
    const scaleType  = String(this.settings.colorScale.scaleType.value);
    const noDataColor = isHC ? this.hcBg : (this.settings.colorScale.noDataColor.value?.value ?? "#e8e8e8");

    // Compute aggregate value per cell for domain
    const cellValues = new Map<string, number>();
    cellMap.forEach((e, k) => {
      if (e.values.length > 0) cellValues.set(k, this.aggregateValues(e.values, aggType));
    });
    const [minV, maxV] = domain(cellValues);

    let colorFn: (t: number) => string;
    if (isHC) {
      colorFn = () => this.hcFg;
    } else if (!this.isPro) {
      colorFn = freeSequentialScale();
    } else if (scaleType === "diverging") {
      colorFn = divergingScale(
        this.settings.colorScale.colorMin.value?.value ?? "#d0e4f7",
        this.settings.colorScale.colorMid.value?.value ?? "#f7f7f7",
        this.settings.colorScale.colorMax.value?.value ?? "#1a5276"
      );
    } else {
      colorFn = sequentialScale(
        this.settings.colorScale.colorMin.value?.value ?? "#d0e4f7",
        this.settings.colorScale.colorMax.value?.value ?? "#1a5276"
      );
    }

    const points: CellDataPoint[] = [];
    let catIdx = 0;

    cellMap.forEach((entry) => {
      const hasValue = entry.values.length > 0;
      const aggVal   = hasValue ? this.aggregateValues(entry.values, aggType) : null;

      let color: string;
      if (!hasValue) {
        color = noDataColor;
      } else if (isHC) {
        color = this.hcFg;
      } else {
        const cfColor = this.applyConditionalFormatting(aggVal!);
        if (cfColor) {
          color = cfColor;
        } else if (scaleType === "categorical" && this.isPro) {
          color = categoricalColor(catIdx++);
        } else {
          color = colorFn(normalise(aggVal!, minV, maxV));
        }
      }

      const tooltipExtras: { displayName: string; value: string }[] = [];
      entry.tooltips.forEach((td, name) => {
        const displayVal = td.nums.length > 0
          ? this.formatValue(this.aggregateValues(td.nums, td.aggType))
          : td.firstText;
        tooltipExtras.push({ displayName: name, value: displayVal });
      });

      points.push({
        col: entry.col, row: entry.row,
        value: aggVal ?? 0,
        count: entry.selIds.length,
        valueCount: entry.values.length,
        aggType,
        labels: entry.labels, tooltipExtras,
        selectionIds: entry.selIds, color,
      });
    });

    return points;
  }

  // ── Render Grid ──────────────────────────────────────────────────────────────
  private renderGrid(viewport: powerbi.IViewport, useHex: boolean, isHC: boolean): void {
    if (!this.grid) return;

    const { tileSize, offsetX, offsetY } = this.computeLayout(viewport);
    const gap         = Math.max(1, Math.floor(tileSize * 0.08));
    const showLabels  = this.settings.mapSettings.showLabels.value;
    const fontSize    = Math.min(Number(this.settings.mapSettings.labelFontSize.value) || 7, tileSize * 0.4);
    const noDataColor = isHC ? this.hcBg : (this.settings.colorScale.noDataColor.value?.value ?? "#e8e8e8");
    const minLabelSz  = Number(this.settings.mapSettings.labelMinTileSize.value) || 20;

    // Store layout for hit-testing in delegated events
    this._tileSize = tileSize;
    this._offsetX  = offsetX;
    this._offsetY  = offsetY;
    this._gap      = gap;

    this._dpMap = new Map<string, CellDataPoint>();
    this.dataPoints.forEach(dp => this._dpMap.set(`${dp.col},${dp.row}`, dp));

    const { cols, rows } = this.grid;
    const acc = this.settings.accessibility;

    // Precompute border string (shared across all tiles)
    let strokeStr: string;
    if (isHC) {
      strokeStr = `stroke="${this.hcFg}" stroke-width="0.5" data-base-stroke="${this.hcFg}" data-base-sw="0.5"`;
    } else if (acc.showBorders.value) {
      const bc = acc.borderColor.value?.value ?? "#cccccc";
      const bw = String(Number(acc.borderWidth.value) || 0.5);
      strokeStr = `stroke="${bc}" stroke-width="${bw}" data-base-stroke="${bc}" data-base-sw="${bw}"`;
    } else {
      strokeStr = `stroke="none" data-base-stroke="none" data-base-sw="0"`;
    }

    // ── Build SVG as string — parsed in one shot, much faster than N×createElementNS ──
    const rectParts:  string[] = [];
    const labelParts: string[] = []; // rendered after rects so they sit on top

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isInMask(col, row, this.grid)) continue;
        const dp    = this._dpMap.get(`${col},${row}`);
        const color = dp ? dp.color : noDataColor;
        const x  = offsetX + col * tileSize + gap;
        const y  = offsetY + row * tileSize + gap;
        const w  = tileSize - gap * 2;
        const h  = tileSize - gap * 2;
        if (w < 1 || h < 1) continue;
        const rx      = Math.max(1, w * 0.08).toFixed(1);
        const hasData = dp ? "true" : "false";
        const cursor  = dp ? "pointer" : "default";

        rectParts.push(
          `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"` +
          ` fill="${color}" rx="${rx}" ${strokeStr}` +
          ` data-col="${col}" data-row="${row}" data-has-data="${hasData}" data-selected="false"` +
          ` style="cursor:${cursor}"/>`
        );

        if (showLabels && dp) {
          const cx = (x + w / 2).toFixed(1);
          const cy = (y + h / 2).toFixed(1);
          const textColor = isHC ? this.hcBg : this.contrastColor(color);
          if (w >= minLabelSz) {
            const txt = this.escSvg(this.formatValue(dp.value));
            labelParts.push(
              `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"` +
              ` font-size="${fontSize.toFixed(1)}" fill="${textColor}" font-weight="600"` +
              ` style="pointer-events:none;user-select:none">${txt}</text>`
            );
          } else if (w >= minLabelSz * 0.5 && dp.labels.length > 0) {
            const abbr = this.escSvg(dp.labels[0].slice(0, 4));
            const fs2  = Math.max(5, fontSize * 0.8).toFixed(1);
            labelParts.push(
              `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"` +
              ` font-size="${fs2}" fill="${textColor}" font-weight="600"` +
              ` style="pointer-events:none;user-select:none">${abbr}</text>`
            );
          }
        }
      }
    }

    // Single innerHTML parse — far faster than individual DOM insertions
    this.svg.innerHTML = rectParts.join("") + labelParts.join("");

    if (this.dataPoints.length === 0) {
      this.renderEmpty(`No data points found in ${this.grid.name}. Check coordinates.`, isHC);
    }
    if (!this.isPro && this.freeLimitHit) {
      this.renderEmpty(`Free version limited to 500 data points. Upgrade to TCViz Pro for unlimited data.`, isHC);
    }
  }

  /** Escape special XML characters for safe SVG text content. */
  private escSvg(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }


  private drawSquare(
    frag: DocumentFragment,
    col: number, row: number, color: string,
    size: number, gap: number, ox: number, oy: number,
    dp: CellDataPoint | undefined,
    showLabels: boolean, fontSize: number, isHC: boolean
  ): void {
    const x = ox + col * size + gap;
    const y = oy + row * size + gap;
    const w = size - gap * 2;
    const h = size - gap * 2;
    if (w < 1 || h < 1) return;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x",      String(x));
    rect.setAttribute("y",      String(y));
    rect.setAttribute("width",  String(w));
    rect.setAttribute("height", String(h));
    rect.setAttribute("fill",   color);
    rect.setAttribute("rx",     String(Math.max(1, w * 0.08)));
    // Store col/row for hit-testing by delegated handler
    rect.setAttribute("data-col", String(col));
    rect.setAttribute("data-row", String(row));
    rect.setAttribute("data-has-data", dp ? "true" : "false");
    rect.setAttribute("data-selected", "false");
    rect.style.cursor = dp ? "pointer" : "default";

    // Borders: HC always, accessibility setting otherwise
    const acc = this.settings.accessibility;
    if (isHC) {
      rect.setAttribute("stroke", this.hcFg);
      rect.setAttribute("stroke-width", "0.5");
      rect.setAttribute("data-base-stroke", this.hcFg);
      rect.setAttribute("data-base-sw", "0.5");
    } else if (acc.showBorders.value) {
      const bc  = acc.borderColor.value?.value ?? "#cccccc";
      const bw  = String(Number(acc.borderWidth.value) || 0.5);
      rect.setAttribute("stroke", bc);
      rect.setAttribute("stroke-width", bw);
      rect.setAttribute("data-base-stroke", bc);
      rect.setAttribute("data-base-sw", bw);
    } else {
      rect.setAttribute("stroke", "none");
      rect.setAttribute("data-base-stroke", "none");
      rect.setAttribute("data-base-sw", "0");
    }

    frag.appendChild(rect);

    if (showLabels && dp) {
      const minSize = Number(this.settings.mapSettings.labelMinTileSize.value) || 20;
      if (w >= minSize) {
        // Full label: formatted value
        frag.appendChild(this.makeLabel(
          this.formatValue(dp.value), x + w / 2, y + h / 2, fontSize, color, isHC
        ));
      } else if (w >= minSize * 0.5 && dp.labels.length > 0) {
        // Medium tile: abbreviated user label (max 4 chars)
        const abbr = dp.labels[0].slice(0, 4);
        frag.appendChild(this.makeLabel(
          abbr, x + w / 2, y + h / 2, Math.max(5, fontSize * 0.8), color, isHC
        ));
      }
      // Below minSize * 0.5 → no label
    }
  }

  private drawHex(
    col: number, row: number, color: string,
    size: number, ox: number, oy: number,
    dp: CellDataPoint | undefined,
    showLabels: boolean, fontSize: number, isHC: boolean
  ): void {
    const r  = size / 2 - 1;
    const cx = ox + col * size * 0.866 + r;
    const cy = oy + row * size + (col % 2 === 1 ? size / 2 : 0) + r;
    const pts = HEX_FLAT_ANGLES.map(a => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`).join(" ");

    const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    hex.setAttribute("points", pts);
    hex.setAttribute("fill", color);
    if (isHC) { hex.setAttribute("stroke", this.hcFg); hex.setAttribute("stroke-width", "0.5"); }
    hex.style.cursor = dp ? "pointer" : "default";

    // Events handled by delegation on svg; just mark data attributes
    hex.setAttribute("data-col", String(col));
    hex.setAttribute("data-row", String(row));
    hex.setAttribute("data-has-data", dp ? "true" : "false");
    hex.setAttribute("data-selected", "false");

    this.svg.appendChild(hex);

    if (showLabels && r >= 8 && dp) {
      this.svg.appendChild(this.makeLabel(
        this.formatValue(dp.value), cx, cy, fontSize, color, isHC
      ));
    }
  }

  // ── Restore data-selected after re-render (cross-filter clears innerHTML) ────
  private restoreSelectionState(): void {
    if (!this.selectionManager.hasSelection()) return;
    if (this._selectedGridCell !== null) {
      const { col, row } = this._selectedGridCell;
      const el = this.svg.querySelector(`rect[data-col="${col}"][data-row="${row}"]`);
      if (el) el.setAttribute("data-selected", "true");
    }
    if (this._selectedTopoFi >= 0) {
      const el = this.svg.querySelector(`path[data-fi="${this._selectedTopoFi}"]`);
      if (el) el.setAttribute("data-selected", "true");
    }
    this.updateOpacity();
  }

  // ── Events + Tooltips ────────────────────────────────────────────────────────
  private updateOpacity(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const ringColor    = this.settings.accessibility.selectedRingColor.value?.value ?? "#2980b9";
    const ringWidth    = String(Number(this.settings.accessibility.selectedRingWidth.value) || 2);

    // Grid mode tiles
    this.svg.querySelectorAll("rect[data-has-data='true']").forEach(r => {
      const el = r as SVGElement;
      const isSelected = el.getAttribute("data-selected") === "true";
      el.style.opacity = hasSelection && !isSelected ? "0.3" : "1";
      if (isSelected) {
        el.setAttribute("stroke", ringColor);
        el.setAttribute("stroke-width", ringWidth);
      } else {
        el.setAttribute("stroke", el.getAttribute("data-base-stroke") ?? "none");
        el.setAttribute("stroke-width", el.getAttribute("data-base-sw") ?? "0");
      }
    });

    // TopoJSON mode polygons
    this.svg.querySelectorAll("path[data-fi]").forEach(p => {
      const el = p as SVGElement;
      const isSelected = el.getAttribute("data-selected") === "true";
      el.style.opacity = hasSelection && !isSelected ? "0.3" : "1";
      if (isSelected) {
        el.setAttribute("stroke", ringColor);
        el.setAttribute("stroke-width", ringWidth);
      } else {
        el.setAttribute("stroke", this.hcBg === "#000" ? this.hcFg : "#fff");
        el.setAttribute("stroke-width", "0.5");
      }
    });
  }

  /** Convert a mouse event to a CellDataPoint using stored layout geometry.
   *  Uses cached _svgBounds (updated once per update via rAF) to avoid
   *  getBoundingClientRect() — which forces layout reflow — on every mousemove. */
  private hitTest(e: MouseEvent): CellDataPoint | null {
    if (this._tileSize === 0) return null;
    const x = e.clientX - this._svgBounds.left;
    const y = e.clientY - this._svgBounds.top;
    const col = Math.floor((x - this._offsetX) / this._tileSize);
    const row = Math.floor((y - this._offsetY) / this._tileSize);
    return this._dpMap.get(`${col},${row}`) ?? null;
  }

  private buildTopoTooltipItems(fd: TopoFeatureData): VisualTooltipDataItem[] {
    if (!fd.hasValue) {
      return [{ displayName: "Data points", value: "No data" }];
    }
    const aggLabels: Record<string, string> = {
      sum: "Sum", average: "Average", count: "Count", min: "Min", max: "Max"
    };
    const valueLabel   = aggLabels[fd.aggType] ?? "Value";
    const pointsDetail = fd.valueCount < fd.count
      ? `${fd.valueCount} of ${fd.count} rows`
      : String(fd.count);
    return [
      { displayName: valueLabel,    value: this.formatValue(fd.value) },
      { displayName: "Data points", value: pointsDetail },
      ...fd.tooltipExtras,
    ];
  }

  private buildTooltipItems(dp: CellDataPoint): VisualTooltipDataItem[] {
    const grid      = this.grid!;
    const cellW     = (grid.bbox.maxLng - grid.bbox.minLng) / grid.cols;
    const cellH     = (grid.bbox.maxLat - grid.bbox.minLat) / grid.rows;
    const centreLat = (grid.bbox.maxLat - (dp.row + 0.5) * cellH).toFixed(2);
    const centreLng = (grid.bbox.minLng + (dp.col + 0.5) * cellW).toFixed(2);

    const aggLabels: Record<string, string> = {
      sum: "Sum", average: "Average", count: "Count", min: "Min", max: "Max"
    };
    const valueLabel = aggLabels[dp.aggType] ?? "Value";

    // "N rows → M values used" gives the user full transparency
    const pointsDetail = dp.valueCount < dp.count
      ? `${dp.valueCount} of ${dp.count} rows`
      : String(dp.count);

    const items: VisualTooltipDataItem[] = [
      { displayName: valueLabel,     value: this.formatValue(dp.value) },
      { displayName: "Data points",  value: pointsDetail },
      { displayName: "Cell",         value: `${centreLat}°, ${centreLng}°` },
    ];
    if (dp.labels.length > 0) {
      items.unshift({ displayName: "Location", value: dp.labels.slice(0, 3).join(", ") });
    }
    dp.tooltipExtras.forEach(tv => items.push({ displayName: tv.displayName, value: tv.value }));
    return items;
  }

  // ── Layout ───────────────────────────────────────────────────────────────────
  private computeLayout(viewport: powerbi.IViewport): { tileSize: number; offsetX: number; offsetY: number } {
    const legendH = this.settings.legend.showLegend.value ? 48 : 0;
    const pillH   = this.isPro && this.settings.proSettings.showPill.value ? 24 : 0;
    const vw      = viewport.width;
    const drawH   = viewport.height - legendH - pillH - 8;
    const cols    = this.grid?.cols || 25;
    const rows    = this.grid?.rows || 20;
    const tileSize = Math.max(3, Math.floor(Math.min(vw / cols, drawH / rows)));
    const offsetX  = (vw      - cols * tileSize) / 2;
    const offsetY  = (drawH   - rows * tileSize) / 2;
    return { tileSize, offsetX, offsetY };
  }

  // ── Legend ──────────────────────────────────────────────────────────────────
  private renderLegend(viewport: powerbi.IViewport, isHC: boolean): void {
    const vw    = viewport.width;
    const vh    = viewport.height;
    const gradW = Math.min(200, vw * 0.6);
    const x     = (vw - gradW) / 2;
    const y     = vh - 44;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", "lgGrad");
    grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "0%");

    const minC = isHC ? this.hcBg : (this.settings.colorScale.colorMin.value?.value ?? "#d0e4f7");
    const maxC = isHC ? this.hcFg  : (this.isPro ? (this.settings.colorScale.colorMax.value?.value ?? "#1a5276") : "#1a5276");

    const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s1.setAttribute("offset", "0%");   s1.setAttribute("stop-color", minC);
    const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s2.setAttribute("offset", "100%"); s2.setAttribute("stop-color", maxC);
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
    this.svg.appendChild(defs);

    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("x", String(x));   bar.setAttribute("y", String(y + 8));
    bar.setAttribute("width", String(gradW)); bar.setAttribute("height", "12");
    bar.setAttribute("fill", "url(#lgGrad)"); bar.setAttribute("rx", "4");
    if (isHC) { bar.setAttribute("stroke", this.hcFg); bar.setAttribute("stroke-width", "1"); }
    this.svg.appendChild(bar);

    const vals = this.dataPoints.map(dp => dp.value);
    if (vals.length > 0) {
      let minV = vals[0], maxV = vals[0];
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] < minV) minV = vals[i];
        if (vals[i] > maxV) maxV = vals[i];
      }
      const lc = isHC ? this.hcFg : "#555";
      this.addLegendLabel(this.formatValue(minV), x,         y + 32, "start", lc);
      this.addLegendLabel(this.formatValue(maxV), x + gradW, y + 32, "end",   lc);
    }
  }

  private addLegendLabel(text: string, x: number, y: number, anchor: string, color: string): void {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
    t.setAttribute("text-anchor", anchor); t.setAttribute("font-size", "10");
    t.setAttribute("fill", color); t.textContent = text;
    this.svg.appendChild(t);
  }

  // ── Local File Button (custom mode, no URL) ──────────────────────────────────
  private renderLocalFileButton(viewport: powerbi.IViewport, isHC: boolean): void {
    const vw     = viewport.width;
    const vh     = viewport.height;
    const accent = isHC ? this.hcFg : "#2980b9";
    const fg     = isHC ? this.hcFg : "#555";
    const dimFg  = isHC ? this.hcFg : "#888";

    // Drop zone rect
    const zoneW = Math.min(vw - 40, 280);
    const zoneH = 110;
    const zx = (vw - zoneW) / 2;
    const zy = vh / 2 - zoneH / 2;

    const zone = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    zone.setAttribute("x", String(zx));
    zone.setAttribute("y", String(zy));
    zone.setAttribute("width", String(zoneW));
    zone.setAttribute("height", String(zoneH));
    zone.setAttribute("rx", "8");
    zone.setAttribute("fill", "none");
    zone.setAttribute("stroke", accent);
    zone.setAttribute("stroke-width", "2");
    zone.setAttribute("stroke-dasharray", "6 4");
    this.svg.appendChild(zone);

    const makeT = (text: string, y: number, size: string, fill: string, weight = "normal") => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(vw / 2));
      t.setAttribute("y", String(y));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", size);
      t.setAttribute("font-weight", weight);
      t.setAttribute("fill", fill);
      t.textContent = text;
      this.svg.appendChild(t);
    };

    // Icon area (simple arrow-down symbol)
    const iconY = zy + 30;
    const iconX = vw / 2;
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrow.setAttribute("d", `M${iconX} ${iconY - 10} L${iconX} ${iconY + 8} M${iconX - 7} ${iconY + 1} L${iconX} ${iconY + 8} L${iconX + 7} ${iconY + 1}`);
    arrow.setAttribute("stroke", accent);
    arrow.setAttribute("stroke-width", "2");
    arrow.setAttribute("stroke-linecap", "round");
    arrow.setAttribute("stroke-linejoin", "round");
    arrow.setAttribute("fill", "none");
    this.svg.appendChild(arrow);

    makeT("Drag & drop your TopoJSON file here", zy + 54, "11", fg, "600");
    makeT("or set a URL in Format → Pro Settings", zy + 72, "10", dimFg);
    makeT("(.json / .topojson)", zy + 88, "9", dimFg);
  }

  // ── Landing Page ─────────────────────────────────────────────────────────────
  private renderLandingPage(viewport: powerbi.IViewport, isHC: boolean): void {
    const vw = viewport.width; const vh = viewport.height;
    const accent = isHC ? this.hcFg : "#2980b9";
    const fg     = isHC ? this.hcFg : "#666";
    const s = 12; const g = 2;
    const gw = 5 * s + 4 * g; const gh = 4 * s + 3 * g;
    const ox = (vw - gw) / 2; const oy = vh / 2 - gh - 16;
    const blues = ["#d0e4f7","#5b9bd5","#1a5276","#5b9bd5","#1a5276","#d0e4f7","#1a5276","#d0e4f7","#5b9bd5","#1a5276","#d0e4f7","#5b9bd5","#1a5276","#5b9bd5","#d0e4f7","#1a5276","#5b9bd5","#1a5276","#d0e4f7","#5b9bd5"];
    let idx = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", String(ox + col * (s + g)));
        r.setAttribute("y", String(oy + row * (s + g)));
        r.setAttribute("width", String(s)); r.setAttribute("height", String(s));
        r.setAttribute("fill", isHC ? this.hcFg : blues[idx++]);
        r.setAttribute("rx", "2");
        this.svg.appendChild(r);
      }
    }
    const makeT = (text: string, y: number, size: string, weight: string, fill: string) => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(vw / 2)); t.setAttribute("y", String(y));
      t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", size);
      t.setAttribute("font-weight", weight);   t.setAttribute("fill", fill);
      t.textContent = text; this.svg.appendChild(t);
    };
    makeT("Tile Grid Map Pro",                          vh / 2 + 4,  "14", "600",    accent);
    makeT("Add Latitude and Longitude fields to start.", vh / 2 + 22, "11", "normal", fg);
  }

  // ── Pro Pill ────────────────────────────────────────────────────────────────
  private renderProPill(viewport: powerbi.IViewport): void {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", String(viewport.width - 62)); bg.setAttribute("y", "4");
    bg.setAttribute("width", "58"); bg.setAttribute("height", "16");
    bg.setAttribute("rx", "8"); bg.setAttribute("fill", "#2980b9");
    g.appendChild(bg);
    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", String(viewport.width - 33)); txt.setAttribute("y", "16");
    txt.setAttribute("text-anchor", "middle"); txt.setAttribute("font-size", "9");
    txt.setAttribute("fill", "#fff"); txt.setAttribute("font-weight", "600");
    txt.textContent = "TCViz Pro"; g.appendChild(txt);
    this.svg.appendChild(g);
  }

  // ── Empty State ──────────────────────────────────────────────────────────────
  private renderEmpty(msg: string, isHC: boolean): void {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", "50%"); t.setAttribute("y", "92%");
    t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", "11");
    t.setAttribute("fill", isHC ? this.hcFg : "#aaa");
    t.textContent = msg;
    this.svg.appendChild(t);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private makeLabel(text: string, cx: number, cy: number, fontSize: number, bgColor: string, isHC: boolean): SVGTextElement {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", String(cx)); t.setAttribute("y", String(cy));
    t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("font-size", String(fontSize));
    t.setAttribute("fill", isHC ? this.hcBg : this.contrastColor(bgColor));
    t.setAttribute("font-weight", "600");
    t.style.pointerEvents = "none"; t.style.userSelect = "none";
    t.textContent = text; return t;
  }

  private contrastColor(hex: string): string {
    const cached = this._contrastCache.get(hex);
    if (cached) return cached;
    const h = hex.replace("#", "");
    const lum = (0.299 * parseInt(h.slice(0,2),16) + 0.587 * parseInt(h.slice(2,4),16) + 0.114 * parseInt(h.slice(4,6),16)) / 255;
    const result = lum > 0.55 ? "#333" : "#fff";
    this._contrastCache.set(hex, result);
    return result;
  }

  private formatValue(v: number | null): string {
    if (v === null || v === undefined) return "—";
    const dec = Math.max(0, Math.min(6, Number(this.settings.mapSettings.tooltipDecimals.value) || 2));
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(dec) + "B";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(dec) + "M";
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(dec) + "K";
    return v.toLocaleString(undefined, { maximumFractionDigits: dec });
  }

  // ── TopoJSON: renderer ───────────────────────────────────────────────────────

  private renderTopoMode(features: TopoFeature[], viewport: powerbi.IViewport, isHC: boolean): void {
    const dataView  = this._lastOptions?.dataViews?.[0];
    const table     = dataView?.table;
    const aggType   = String(this.settings.mapSettings.aggregationType.value);
    const noDataClr = isHC ? this.hcBg : (this.settings.colorScale.noDataColor.value?.value ?? "#e8e8e8");
    const scaleType = String(this.settings.colorScale.scaleType.value);

    // ── Point-in-polygon scan: cached per dataView, with bbox prefilter ──────────
    // Only re-runs when dataView changes (new data). Settings changes reuse cache.
    let featVals:     number[][];
    let featSelIds:   ISelectionId[][];
    let featRowCount: number[];
    let featTooltips: Map<string, TooltipColData>[];

    if (dataView && dataView === this._rawTopoDataView && this._rawTopoFeatVals.length === features.length) {
      // Cache hit — reuse previous scan result
      featVals     = this._rawTopoFeatVals;
      featSelIds   = this._rawTopoFeatSelIds;
      featRowCount = this._rawTopoFeatRowCount;
      featTooltips = this._rawTopoFeatTooltips;
    } else {
      // Cache miss — run the scan
      featVals     = features.map(() => []);
      featSelIds   = features.map(() => []);
      featRowCount = features.map(() => 0);
      featTooltips = features.map(() => new Map());

      if (table) {
        const cols   = table.columns;
        const latIdx = cols.findIndex(c => c.roles?.["latitude"]);
        const lngIdx = cols.findIndex(c => c.roles?.["longitude"]);
        const valIdx = cols.findIndex(c => c.roles?.["value"]);
        const ttIdxs = cols.map((c, i) => c.roles?.["tooltips"] ? i : -1).filter(i => i >= 0);
        const allRows = table.rows ?? [];
        const rows = this.isPro ? allRows : allRows.slice(0, 500);

        rows.forEach((row, rowIdx) => {
          const lat = Number(row[latIdx]);
          const lng = Number(row[lngIdx]);
          if (isNaN(lat) || isNaN(lng)) return;
          const val = valIdx >= 0 ? Number(row[valIdx]) : NaN;
          for (let fi = 0; fi < features.length; fi++) {
            // Bbox prefilter — eliminates ~95% of pointInFeature calls
            const [bMinX, bMaxX, bMinY, bMaxY] = features[fi].bbox;
            if (lng < bMinX || lng > bMaxX || lat < bMinY || lat > bMaxY) continue;
            if (this.pointInFeature(lng, lat, features[fi])) {
              if (!isNaN(val)) featVals[fi].push(val);
              featRowCount[fi]++;
              featSelIds[fi].push(
                this.host.createSelectionIdBuilder().withTable(table, rowIdx).createSelectionId()
              );
              ttIdxs.forEach(ti => {
                const name = cols[ti].displayName ?? `col${ti}`;
                if (!featTooltips[fi].has(name)) {
                  featTooltips[fi].set(name, { nums: [], firstText: "", aggType: this.detectAggType(cols[ti]) });
                }
                const td  = featTooltips[fi].get(name)!;
                const raw = row[ti];
                const num = Number(raw);
                if (raw !== null && raw !== undefined && raw !== "" && !isNaN(num)) {
                  td.nums.push(num);
                } else if (!td.firstText && raw != null) {
                  td.firstText = String(raw);
                }
              });
              break;
            }
          }
        });
      }

      // Store in cache
      this._rawTopoDataView    = dataView ?? null;
      this._rawTopoFeatVals    = featVals;
      this._rawTopoFeatSelIds  = featSelIds;
      this._rawTopoFeatRowCount = featRowCount;
      this._rawTopoFeatTooltips = featTooltips;
    }

    // ── Compute aggregated values and colour scale ──
    const aggValues = featVals.map(vals => vals.length > 0 ? this.aggregateValues(vals, aggType) : null);
    const nonNull   = aggValues.filter((v): v is number => v !== null);
    let minV = Infinity, maxV = -Infinity;
    nonNull.forEach(v => { if (v < minV) minV = v; if (v > maxV) maxV = v; });

    let colorFn: (t: number) => string;
    if (isHC) {
      colorFn = () => this.hcFg;
    } else if (!this.isPro) {
      colorFn = freeSequentialScale();
    } else if (scaleType === "diverging") {
      colorFn = divergingScale(
        this.settings.colorScale.colorMin.value?.value ?? "#d0e4f7",
        this.settings.colorScale.colorMid.value?.value ?? "#f7f7f7",
        this.settings.colorScale.colorMax.value?.value ?? "#1a5276"
      );
    } else {
      colorFn = sequentialScale(
        this.settings.colorScale.colorMin.value?.value ?? "#d0e4f7",
        this.settings.colorScale.colorMax.value?.value ?? "#1a5276"
      );
    }

    // ── Projection: scale-to-fit bounding box ──
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    features.forEach(f => f.rings[0]?.forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }));
    const pad     = 12;
    const legendH = this.settings.legend.showLegend.value ? 48 : 0;
    const drawW   = viewport.width  - pad * 2;
    const drawH   = viewport.height - pad * 2 - legendH;
    const spanX   = maxX - minX || 1;
    const spanY   = maxY - minY || 1;
    const scale   = Math.min(drawW / spanX, drawH / spanY);
    const projW   = spanX * scale;
    const projH   = spanY * scale;
    const offX    = pad + (drawW - projW) / 2;
    const offY    = pad + (drawH - projH) / 2;

    const project = (x: number, y: number): [number, number] => [
      offX + (x - minX) * scale,
      offY + (maxY - y) * scale,   // flip Y: lat increases up, SVG Y increases down
    ];

    // ── Store feature data for event delegation ──
    this._topoFeatureData = features.map((_, fi) => {
      const aggVal   = aggValues[fi];
      const hasValue = aggVal !== null;
      const tooltipExtras: { displayName: string; value: string }[] = [];
      featTooltips[fi].forEach((td, name) => {
        const displayVal = td.nums.length > 0
          ? this.formatValue(this.aggregateValues(td.nums, td.aggType))
          : td.firstText;
        tooltipExtras.push({ displayName: name, value: displayVal });
      });
      return {
        value:        aggVal ?? 0,
        valueCount:   featVals[fi].length,
        count:        featRowCount[fi],
        aggType,
        hasValue,
        selectionIds: featSelIds[fi],
        tooltipExtras,
      };
    });

    // ── Render SVG paths ──
    const frag = document.createDocumentFragment();
    const borderClr = isHC ? this.hcFg : "#fff";

    features.forEach((feature, fi) => {
      const aggVal   = aggValues[fi];
      const hasValue = aggVal !== null;

      let color: string;
      if (!hasValue || isHC) {
        color = hasValue ? this.hcFg : noDataClr;
      } else {
        const cfColor = this.applyConditionalFormatting(aggVal);
        color = cfColor ?? colorFn(normalise(aggVal, minV, maxV));
      }

      // Build SVG path (even-odd for holes)
      let d = "";
      for (const ring of feature.rings) {
        if (ring.length < 2) continue;
        const [sx, sy] = project(ring[0][0], ring[0][1]);
        d += `M${sx.toFixed(1)},${sy.toFixed(1)}`;
        for (let i = 1; i < ring.length; i++) {
          const [px, py] = project(ring[i][0], ring[i][1]);
          d += `L${px.toFixed(1)},${py.toFixed(1)}`;
        }
        d += "Z";
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", color);
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("stroke", borderClr);
      path.setAttribute("stroke-width", "0.5");
      path.setAttribute("data-fi", String(fi));
      path.setAttribute("data-has-value", hasValue ? "true" : "false");
      path.style.cursor = hasValue ? "pointer" : "default";
      frag.appendChild(path);
    });

    this.svg.appendChild(frag);

    // Legend
    if (this.settings.legend.showLegend.value && nonNull.length > 0) {
      this.renderLegend(viewport, isHC);
    }
  }

  // ── TopoJSON: load, decode, point-in-polygon ─────────────────────────────────

  private async loadTopoJson(url: string): Promise<void> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      this._topoCache[url]  = this.decodeTopoJson(raw);
      this._rawTopoDataView = null; // invalidate scan cache for new TopoJSON
      if (this._lastOptions) this.update(this._lastOptions);
    } catch (e) {
      console.error("TileGridMapPro: TopoJSON load error", e);
      this._pendingTopoUrl = ""; // allow retry on next update
    }
  }

  private decodeTopoJson(topo: any): TopoFeature[] {
    const tf = topo.transform as { scale: [number, number]; translate: [number, number] } | undefined;
    const rawArcs: number[][][] = topo.arcs ?? [];

    // Decode arcs: delta encoding + optional quantization transform
    const arcs: [number, number][][] = rawArcs.map(rawArc => {
      let x = 0, y = 0;
      return rawArc.map(([dx, dy]: number[]) => {
        x += dx; y += dy;
        return tf
          ? [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]] as [number, number]
          : [x, y] as [number, number];
      });
    });

    // Use the first object in the topology
    const objKey = Object.keys(topo.objects ?? {})[0];
    if (!objKey) return [];
    const obj = topo.objects[objKey];
    const geometries: any[] = obj.type === "GeometryCollection" ? obj.geometries : [obj];

    const features: TopoFeature[] = [];
    for (const geom of geometries) {
      if (!geom) continue;
      if (geom.type === "Polygon") {
        const rings = this.assembleRings(geom.arcs, arcs);
        features.push({ rings, bbox: this.computeBbox(rings[0]) });
      } else if (geom.type === "MultiPolygon") {
        for (const polyArcs of geom.arcs as number[][][]) {
          const rings = this.assembleRings(polyArcs, arcs);
          features.push({ rings, bbox: this.computeBbox(rings[0]) });
        }
      }
    }
    return features;
  }

  private assembleRings(arcIdxs: number[][], decodedArcs: [number, number][][]): [number, number][][] {
    return arcIdxs.map(ring =>
      ring.flatMap(i => {
        const arc = i >= 0 ? decodedArcs[i] : [...decodedArcs[~i]].reverse();
        return arc.slice(0, -1); // drop last point (shared with next arc's first)
      })
    );
  }

  private computeBbox(ring: [number, number][]): [number, number, number, number] {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return [minX, maxX, minY, maxY];
  }

  private pointInFeature(lng: number, lat: number, feature: TopoFeature): boolean {
    if (!feature.rings[0] || !this.pointInRing(lng, lat, feature.rings[0])) return false;
    for (let i = 1; i < feature.rings.length; i++) {
      if (this.pointInRing(lng, lat, feature.rings[i])) return false; // inside a hole
    }
    return true;
  }

  private pointInRing(px: number, py: number, ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ── Conditional Formatting ───────────────────────────────────────────────────
  private applyConditionalFormatting(value: number): string | null {
    const cf = this.settings.conditionalFormatting;
    if (!cf.cfEnabled.value) return null;

    const testOp = (op: string, threshold: number, v: number): boolean =>
      (op === "lt"  && v <  threshold) ||
      (op === "lte" && v <= threshold) ||
      (op === "gt"  && v >  threshold) ||
      (op === "gte" && v >= threshold) ||
      (op === "eq"  && v === threshold);

    // Rule 1 — single operator condition (e.g., < 30 → red)
    const r1Color = cf.cfRule1Color.value?.value ?? "";
    if (r1Color && testOp(String(cf.cfRule1Operator.value), Number(cf.cfRule1Value.value), value)) {
      return r1Color;
    }

    // Rule 2 — between range (≥ min AND ≤ max)
    const r2Color  = cf.cfRule2Color.value?.value ?? "";
    const r2Min    = Number(cf.cfRule2MinValue.value);
    const r2Max    = Number(cf.cfRule2MaxValue.value);
    if (r2Color && value >= r2Min && value <= r2Max) {
      return r2Color;
    }

    // Rule 3 — single operator condition (e.g., > 70 → green)
    const r3Color = cf.cfRule3Color.value?.value ?? "";
    if (r3Color && testOp(String(cf.cfRule3Operator.value), Number(cf.cfRule3Value.value), value)) {
      return r3Color;
    }

    return null;
  }

  // ── Aggregation helper ───────────────────────────────────────────────────────
  private aggregateValues(values: number[], type: string): number {
    if (values.length === 0) return 0;
    // Use loops instead of Math.min/max spread to avoid stack overflow on large arrays
    switch (type) {
      case "average": return values.reduce((a, b) => a + b, 0) / values.length;
      case "min": {
        let m = values[0];
        for (let i = 1; i < values.length; i++) if (values[i] < m) m = values[i];
        return m;
      }
      case "max": {
        let m = values[0];
        for (let i = 1; i < values.length; i++) if (values[i] > m) m = values[i];
        return m;
      }
      case "count": return values.length;
      default:      return values.reduce((a, b) => a + b, 0); // "sum"
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingService.buildFormattingModel(this.settings);
  }
}
