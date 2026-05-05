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

// ─── Cell data point ─────────────────────────────────────────────────────────
interface CellDataPoint {
  col: number;
  row: number;
  value: number;
  count: number;
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

  constructor(options: VisualConstructorOptions | undefined) {
    if (!options) { return; }

    this.host              = options.host;
    this.selectionManager  = this.host.createSelectionManager();
    this.formattingService = new FormattingSettingsService();
    this.settings          = new VisualFormattingSettingsModel();
    this.events            = this.host.eventService;
    this.tooltipSvc        = this.host.tooltipService;

    this.isPro = false;

    this.licenseManager = this.host.licenseManager;
    this.licenseManager.getAvailableServicePlans().then((result: LicenseInfoResult) => {
      const plan = result?.plans?.find(p => p.spIdentifier === SP_IDENTIFIER);
      this.isPro = plan?.state === 1;
    });

    this.container = options.element;
    this.container.style.position   = "relative";
    this.container.style.overflow   = "hidden";
    this.container.style.fontFamily = "'Segoe UI', system-ui, sans-serif";

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.width   = "100%";
    this.svg.style.height  = "100%";
    this.svg.style.display = "block";
    this.container.appendChild(this.svg);

    this.svg.addEventListener("contextmenu", (e: MouseEvent) => {
      if (!this.host.hostCapabilities.allowInteractions) return;
      e.preventDefault();
      this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
    });

    // Clear selection on background click
    this.svg.addEventListener("click", () => {
      if (!this.host.hostCapabilities.allowInteractions) return;
      this.selectionManager.clear();
      this.updateSelectionOpacity(false);
    });

    // Respond to external filter/selection changes
    this.selectionManager.registerOnSelectCallback(() => {
      this.update({ ...this._lastOptions } as VisualUpdateOptions);
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

      while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

      // Resolve country grid
      const countryKey = String(this.settings.mapSettings.country.value);
      this.grid = COUNTRY_GRIDS[countryKey] ?? COUNTRY_GRIDS["es"];

      // Landing page
      if (!dataView?.table) {
        this.renderLandingPage(options.viewport, isHC);
        this.events.renderingFinished(options);
        return;
      }

      // Parse data
      this.dataPoints = this.parseData(dataView, isHC);

      // Render
      const useHex = false; // Hexagons coming in v1.1
      this.renderGrid(options.viewport, useHex, isHC);

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

  // ── Parse Data → aggregate per cell ─────────────────────────────────────────
  private parseData(dataView: DataView, isHC: boolean): CellDataPoint[] {
    if (!this.grid) return [];

    const table   = dataView.table!;
    const columns = table.columns;
    const allRows = table.rows ?? [];

    // Free tier: limit to 500 rows
    const FREE_LIMIT = 500;
    const rows = this.isPro ? allRows : allRows.slice(0, FREE_LIMIT);
    this.freeLimitHit = !this.isPro && allRows.length > FREE_LIMIT;

    const latIdx   = columns.findIndex(c => c.roles?.["latitude"]);
    const lngIdx   = columns.findIndex(c => c.roles?.["longitude"]);
    const valIdx   = columns.findIndex(c => c.roles?.["value"]);
    const labelIdx = columns.findIndex(c => c.roles?.["label"]);
    const ttIdxs   = columns.map((c, i) => c.roles?.["tooltips"] ? i : -1).filter(i => i >= 0);

    if (latIdx < 0 || lngIdx < 0) return [];

    const cellMap = new Map<string, {
      col: number; row: number;
      values: number[]; labels: string[];
      tooltips: Map<string, string[]>;
      selIds: ISelectionId[];
    }>();

    rows.forEach((row, rowIdx) => {
      const lat = Number(row[latIdx]);
      const lng = Number(row[lngIdx]);
      if (isNaN(lat) || isNaN(lng)) return;

      const cell = latLngToCell(lat, lng, this.grid!);
      if (!cell) return;

      const key = `${cell.col},${cell.row}`;
      const val = valIdx >= 0 ? Number(row[valIdx]) : NaN;
      const lbl = labelIdx >= 0 ? String(row[labelIdx] ?? "") : "";

      const selId = this.host.createSelectionIdBuilder()
        .withTable(table, rowIdx)
        .createSelectionId();

      if (!cellMap.has(key)) {
        cellMap.set(key, {
          col: cell.col, row: cell.row,
          values: [], labels: [], tooltips: new Map(), selIds: []
        });
      }

      const entry = cellMap.get(key)!;
      if (!isNaN(val)) entry.values.push(val);
      if (lbl) entry.labels.push(lbl);
      entry.selIds.push(selId);

      ttIdxs.forEach(ti => {
        const name = columns[ti].displayName ?? `col${ti}`;
        if (!entry.tooltips.has(name)) entry.tooltips.set(name, []);
        entry.tooltips.get(name)!.push(String(row[ti] ?? ""));
      });
    });

    // Build colour scale
    const cellValues = new Map<string, number>();
    cellMap.forEach((e, k) => {
      if (e.values.length > 0) cellValues.set(k, e.values.reduce((a, b) => a + b, 0));
    });

    const [minV, maxV] = domain(cellValues);
    const scaleType    = String(this.settings.colorScale.scaleType.value);
    const noDataColor  = isHC ? this.hcBg : (this.settings.colorScale.noDataColor.value?.value ?? "#e8e8e8");

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
      const aggVal   = hasValue ? entry.values.reduce((a, b) => a + b, 0) : null;

      let color: string;
      if (!hasValue) {
        color = noDataColor;
      } else if (scaleType === "categorical" && this.isPro && !isHC) {
        color = categoricalColor(catIdx++);
      } else {
        color = colorFn(normalise(aggVal!, minV, maxV));
      }

      const tooltipExtras: { displayName: string; value: string }[] = [];
      entry.tooltips.forEach((vals, name) => {
        if (vals.length > 0) tooltipExtras.push({ displayName: name, value: vals[0] });
      });

      points.push({
        col: entry.col, row: entry.row,
        value: aggVal ?? 0, count: entry.selIds.length,
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
    const showEmpty   = true; // always show empty cells within country mask
    const showLabels  = this.settings.mapSettings.showLabels.value;
    const fontSize    = Math.min(Number(this.settings.mapSettings.labelFontSize.value) || 7, tileSize * 0.4);
    const noDataColor = isHC ? this.hcBg : (this.settings.colorScale.noDataColor.value?.value ?? "#e8e8e8");

    const dpMap = new Map<string, CellDataPoint>();
    this.dataPoints.forEach(dp => dpMap.set(`${dp.col},${dp.row}`, dp));

    const { cols, rows } = this.grid;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const inMask  = isInMask(col, row, this.grid);
        if (!inMask) continue; // never render outside country shape
        const dp      = dpMap.get(`${col},${row}`);
        const hasData = dp !== undefined;
        const color = hasData ? dp!.color : noDataColor;
        this.drawSquare(col, row, color, tileSize, gap, offsetX, offsetY, dp, showLabels, fontSize, isHC);
      }
    }

    if (this.dataPoints.length === 0) {
      this.renderEmpty(`No data points found in ${this.grid.name}. Check coordinates.`, isHC);
    }

    if (!this.isPro && this.freeLimitHit) {
      this.renderEmpty(`Free version limited to 500 data points. Upgrade to TCViz Pro for unlimited data.`, isHC);
    }
  }


  private drawSquare(
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
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(w));
    rect.setAttribute("height", String(h));
    rect.setAttribute("fill", color);
    rect.setAttribute("rx", String(Math.max(1, w * 0.08)));
    if (isHC) { rect.setAttribute("stroke", this.hcFg); rect.setAttribute("stroke-width", "0.5"); }
    const isSelected = dp && this.selectionManager.hasSelection();
    rect.setAttribute("data-selected", dp ? "true" : "false");
    if (isSelected) rect.style.opacity = "1";
    rect.style.cursor = dp ? "pointer" : "default";

    if (dp) {
      this.attachEvents(rect, dp, col, row);
    } else {
      rect.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();
        this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
      });
    }

    this.svg.appendChild(rect);

    if (showLabels && w >= 12 && dp) {
      this.svg.appendChild(this.makeLabel(
        this.formatValue(dp.value), x + w / 2, y + h / 2, fontSize, color, isHC
      ));
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

    if (dp) {
      this.attachEvents(hex, dp, col, row);
    } else {
      hex.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();
        this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
      });
    }

    this.svg.appendChild(hex);

    if (showLabels && r >= 8 && dp) {
      this.svg.appendChild(this.makeLabel(
        this.formatValue(dp.value), cx, cy, fontSize, color, isHC
      ));
    }
  }

  // ── Events + Tooltips ────────────────────────────────────────────────────────
  private updateSelectionOpacity(hasSelection: boolean): void {
    const opacity = hasSelection ? "0.4" : "1";
    const rects = this.svg.querySelectorAll("rect[data-selected='false']");
    rects.forEach(r => (r as SVGElement).style.opacity = opacity);
  }

  private attachEvents(el: SVGElement, dp: CellDataPoint, col: number, row: number): void {
    el.addEventListener("click", (e: MouseEvent) => {
      if (!this.host.hostCapabilities.allowInteractions) return;
      e.stopPropagation();
      this.selectionManager.select(dp.selectionIds[0], e.ctrlKey || e.metaKey);
      const hasSelection = this.selectionManager.hasSelection();
      this.updateSelectionOpacity(hasSelection);
    });

    el.addEventListener("contextmenu", (e: MouseEvent) => {
      if (!this.host.hostCapabilities.allowInteractions) return;
      e.preventDefault();
      this.selectionManager.showContextMenu(
        dp.selectionIds[0] ?? ({} as ISelectionId),
        { x: e.clientX, y: e.clientY }
      );
    });

    const getItems = (): VisualTooltipDataItem[] => {
      const grid    = this.grid!;
      const cellW   = (grid.bbox.maxLng - grid.bbox.minLng) / grid.cols;
      const cellH   = (grid.bbox.maxLat - grid.bbox.minLat) / grid.rows;
      const centreLat = (grid.bbox.maxLat - (row + 0.5) * cellH).toFixed(2);
      const centreLng = (grid.bbox.minLng + (col + 0.5) * cellW).toFixed(2);

      const items: VisualTooltipDataItem[] = [
        { displayName: "Value",        value: this.formatValue(dp.value) },
        { displayName: "Data points",  value: String(dp.count) },
        { displayName: "Cell",         value: `${centreLat}°, ${centreLng}°` },
      ];
      if (dp.labels.length > 0) {
        items.unshift({ displayName: "Location", value: dp.labels.slice(0, 3).join(", ") });
      }
      dp.tooltipExtras.forEach(tv => items.push({ displayName: tv.displayName, value: tv.value }));
      return items;
    };

    el.addEventListener("mouseover", (e: MouseEvent) => {
      this.tooltipSvc.show({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: getItems(), identities: dp.selectionIds });
    });
    el.addEventListener("mousemove", (e: MouseEvent) => {
      this.tooltipSvc.move({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: getItems(), identities: dp.selectionIds });
    });
    el.addEventListener("mouseleave", () => {
      this.tooltipSvc.hide({ immediately: false, isTouchEvent: false });
    });
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
      const lc = isHC ? this.hcFg : "#555";
      this.addLegendLabel(this.formatValue(Math.min(...vals)), x,         y + 32, "start", lc);
      this.addLegendLabel(this.formatValue(Math.max(...vals)), x + gradW, y + 32, "end",   lc);
    }
  }

  private addLegendLabel(text: string, x: number, y: number, anchor: string, color: string): void {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
    t.setAttribute("text-anchor", anchor); t.setAttribute("font-size", "10");
    t.setAttribute("fill", color); t.textContent = text;
    this.svg.appendChild(t);
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
    const h = hex.replace("#", "");
    const lum = (0.299 * parseInt(h.slice(0,2),16) + 0.587 * parseInt(h.slice(2,4),16) + 0.114 * parseInt(h.slice(4,6),16)) / 255;
    return lum > 0.55 ? "#333" : "#fff";
  }

  private formatValue(v: number | null): string {
    if (v === null || v === undefined) return "—";
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingService.buildFormattingModel(this.settings);
  }
}
