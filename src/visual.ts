"use strict";
import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { createProWatermark, renderProWatermark } from "./comun/watermark";
import { STRINGS } from "./strings";
import {
  HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
  SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";

import { VisualFormattingSettingsModel } from "./settings";
import { COUNTRY_GRIDS, CountryGrid, locateCell, isInMask, MAX_SNAP_CELLS } from "./countryGrids";
import {
  ColorStop,
  buildStopScale,
  categoricalColorFor,
  normalise,
  normaliseDiverging,
  domainOf,
  hexToRgb,
} from "./colorScale";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions      = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                  = powerbi.extensibility.visual.IVisual;
import IVisualHost              = powerbi.extensibility.visual.IVisualHost;
import DataView                 = powerbi.DataView;
import ISelectionId             = powerbi.visuals.ISelectionId;
import ISelectionManager        = powerbi.extensibility.ISelectionManager;
import IVisualEventService      = powerbi.extensibility.IVisualEventService;
import VisualTooltipDataItem    = powerbi.extensibility.VisualTooltipDataItem;

// ─── Constants ────────────────────────────────────────────────────────────────
const SP_IDENTIFIER  = "tile-grid-map-pro-tcviz";
const FREE_ROW_LIMIT = 500;
const ROW_CAP        = 30000;           // dataReductionAlgorithm in capabilities.json
const MAX_TOPO_CHARS = 5 * 1024 * 1024; // persisted in the .pbix: keep it bounded
/** Patched to true by build-test.js only. Production source always keeps false. */
const FORCE_PRO = false; // FORCE_PRO_MARKER

/**
 * spIdentifier is the full Partner Center Service ID (publisher.offer.plan), not the
 * bare plan ID, so an exact comparison never matches a real licence. The bare plan
 * ID is accepted as well.
 */
function matchesPlan(spIdentifier: unknown, planId: string): boolean {
  const sp = String(spIdentifier ?? "");
  return sp === planId || sp.endsWith("." + planId);
}

/** A blank is not zero: null, undefined, "" and non-finite values are NaN. */
function toNumber(raw: powerbi.PrimitiveValue | undefined): number {
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return NaN;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TopoFeature {
  polygons: [number, number][][][];         // polygon → rings (outer first) → points
  bbox:     [number, number, number, number]; // [minX, maxX, minY, maxY]
  name:     string;
}

type TooltipColData = { nums: number[]; firstText: string; aggType: string; percent: boolean; fmt?: string };

/** Rows aggregated into one cell (grid) or one region (TopoJSON). */
interface Bucket {
  key: string;
  col: number; row: number;          // grid only
  values: number[];
  sizes: number[];
  labels: string[];
  cats: Map<string, number>;         // Category value → rows

  tooltips: Map<string, TooltipColData>;
  selIds: ISelectionId[];
  rowCount: number;
  targets: number[];                 // objetivo (Pro, 1.3)
  hl: boolean;                       // alguna fila resaltada desde otro visual
}

/** What is drawn and interacted with. */
interface Point {
  key: string;
  bucket: Bucket;
  value: number | null;              // null = no value
  color: string;
  opacity: number;
  name: string;                      // region name (TopoJSON) or "" (grid)
  cx: number; cy: number;            // screen centre, for keyboard context menu
}

interface ScanStats { total: number; used: number; blankCoords: number; outside: number; snapped: number; capped: boolean; }

interface ColorModel {
  kind: "free" | "sequential" | "quantile" | "diverging" | "categorical" | "hc";
  min: number; max: number;
  colorFor(value: number, bucket: Bucket): string;
  opacityFor(value: number): number;
  legendStops: ColorStop[] | null;   // null = no gradient legend
  recortada?: boolean;               // hay valores más allá de min/max: la leyenda dice ≤ / ≥
  classes?: { color: string; from: number }[];  // quantile legend
  categories?: { color: string; text: string }[]; // categorical legend
}

const MAX_CATEGORIES = 12;
/** Formato de la desviación contra el objetivo: con signo, un decimal. */
const FMT_DESVIACION = "+0.0%;-0.0%;0.0%";
const OTHER_CATEGORY_COLOR = "#b0b0b0";

// ─── Visual ───────────────────────────────────────────────────────────────────
/** ¿La cadena de formato es un porcentaje? El "%" cuenta fuera de comillas y escapes. */
function esPorcentaje(fmt: string | null | undefined): boolean {
  return !!fmt && /%/.test(fmt.replace(/"[^"]*"|\\./g, ""));
}

/**
 * ESTILOS DE LA COLECCIÓN (1.3), con los mismos tokens que Waterfall, KPI Card o Bullet para que una página en
 * Boardroom se lea como un solo informe. Para un mapa: rampa secuencial (lo → hi), divergente (down · mid · up),
 * casillas sin dato, tinta de la leyenda, bordes y anillo de selección, y el fondo del visual.
 */
interface MapTokens { bg?: string; grad?: string; text: string; axis: string; grid: string; lo: string; hi: string;
  down: string; mid: string; up: string; empty: string; ring: string; font?: string; }
const PRO_STYLES = ["boardroom", "ledger", "editorial", "signal", "aurora", "terrace"];
const STYLE_NAMES: Record<string, string> = { boardroom: "Boardroom", ledger: "Ledger", editorial: "Editorial",
  signal: "Signal", aurora: "Aurora", terrace: "Terrace" };
function mixHex(a: string, b: string, t: number): string {
  return buildStopScale([{ value: 0, color: a }, { value: 1, color: b }])(t);
}
function estilo(bg: string, text: string, axis: string, grid: string, acento: string, down: string, up: string,
                oscuro: boolean, extra: Partial<MapTokens> = {}): MapTokens {
  return { bg, text, axis, grid, lo: mixHex(bg, acento, oscuro ? 0.32 : 0.14), hi: acento, down, up,
    mid: mixHex(bg, text, oscuro ? 0.22 : 0.06), empty: mixHex(bg, text, oscuro ? 0.12 : 0.08), ring: text, ...extra };
}
const STYLE_TOKENS: Record<string, MapTokens> = {
  boardroom: estilo("#16263D", "#F2F0E8", "#9FB0C6", "#2A3E5C", "#C9A45C", "#EB8A7B", "#6FCF97", true),
  ledger:    estilo("#FBF8EF", "#231F16", "#6E6652", "#D9D2BE", "#2F6B3B", "#A32A2A", "#2F6B3B", false, { font: "Georgia, serif" }),
  editorial: estilo("#FFFFFF", "#111111", "#5F5F5F", "#E2E2E2", "#111111", "#D7263D", "#111111", false, { font: "Georgia, serif" }),
  signal:    estilo("#FFFFFF", "#14202B", "#566472", "#D9DEE4", "#1F5F8B", "#C0392B", "#1F7A4D", false),
  aurora:    estilo("#10395E", "#FFFFFF", "#C5D3E3", "#3A5C7E", "#7CE7D0", "#FF9DB0", "#7CE7D0", true,
                    { grad: "linear-gradient(135deg, #1B1147, #10395E 50%, #0B5A5E)" }),
  terrace:   estilo("#FBF5EC", "#3A2A1E", "#7A6450", "#E5D6C2", "#5E7128", "#B5372A", "#5E7128", false),
};

export class Visual implements IVisual {
  private host!: IVisualHost;
  private selectionManager!: ISelectionManager;
  private formattingService!: FormattingSettingsService;
  private events!: IVisualEventService;
  private tooltipSvc!: powerbi.extensibility.ITooltipService;

  private container!: HTMLElement;
  private svg!: SVGSVGElement;
  private settings: VisualFormattingSettingsModel = new VisualFormattingSettingsModel();
  private locale = "en-US";

  // Licence
  private isPro = false;
  private licenseResolved = false;
  private licenseEnvSupported = true;
  private licenseInfoAvailable = true;
  private lastBlockedNotice = "";
  private licenseIconShown = false;
  /** Editando sin licencia y con la licencia ya resuelta: lo Pro se dibuja con marca. */
  private proPreview = false;
  private editing = false;
  /** Claves de las funciones Pro que el usuario ha tocado. */
  private attemptedKeys = new Set<string>();
  /** Etiquetas legibles de esas funciones, para la marca de agua. */
  private attemptedLabels: string[] = [];
  /** Temporizador que deja la barra de Upgrade cuando el banner termina. */
  private licenseIconTimer: number | null = null;

  private _lastOptions: VisualUpdateOptions | null = null;
  private grid: CountryGrid | null = null;
  private isHC = false;
  private hcFg = "#000";
  private hcBg = "#fff";

  // Data caches. Keyed on the dataView AND on everything that changes the scan, so a
  // licence arriving (row limit), a country change or a new TopoJSON rebuilds them.
  private _scanKey = "";
  private _scanDataView: DataView | null = null;
  private _buckets: Map<string, Bucket> = new Map();
  private _stats: ScanStats = { total: 0, used: 0, blankCoords: 0, outside: 0, snapped: 0, capped: false };
  private _valueAggType = "sum";
  private _valuePercent = false;
  private _valueFmt: string | undefined;   // cadena de formato de la medida (1.3)
  private _hasSize = false;
  private _hasCategory = false;
  private _sizeAggType = "sum";
  private _sizePercent = false;
  private _sizeFmt: string | undefined;

  // Rendered points — the only source for hit-testing, tooltips and selection
  private _points: Map<string, Point> = new Map();
  private _orderedKeys: string[] = [];
  private _selectedKeys: Set<string> = new Set();
  private _focusKey = "";

  // TopoJSON
  private _topoFeatures: TopoFeature[] | null = null;
  private wm!: HTMLDivElement;           // marca de agua común (1.3)
  private tk!: MapTokens;                 // tokens del estilo en vigor (1.3)
  private tplVisto: string | null = null;  // última plantilla vista: al cambiarla se borran los colores que define
  private _topoSource = "";   // file name + length, part of the scan key
  private _topoError = "";
  private _hayResaltado = false;
  // Id único del degradado de la leyenda: con un id fijo, dos mapas en el mismo documento compartían el primero.
  private static instancias = 0;
  private readonly idDegradado = "tgmLegendGrad-" + (++Visual.instancias);
  // Objetivo (Pro, 1.3): con un campo en Target, cada tesela se colorea por su desviación contra él.
  private _hasTarget = false;
  private _targetAggType = "sum";
  private _targetFmt: string | undefined = undefined;
  // Tramo elegido en la leyenda (1.3): por valor (degradado) o por color (clases, reglas, categorías). Solo en el visual.
  private _rango: { lo: number; hi: number } | { color: string } | null = null;
  private _rangoKind = "";
  private _enRango: Set<string> | null = null;
  private localizationManager: powerbi.extensibility.ILocalizationManager | null = null;
  // Formato sobre el lienzo (1.3, receta de Waterfall): en modo formato el clic elige qué formatear, no filtra.
  private subSelectionHelper!: HtmlSubSelectionHelper;
  public visualOnObjectFormatting?: powerbi.extensibility.visual.VisualOnObjectFormatting;
  private formatMode = false;

  constructor(options: VisualConstructorOptions | undefined) {
    if (!options) { return; }

    this.host              = options.host;
    this.selectionManager  = this.host.createSelectionManager();
    // CON el gestor de localizacion. Sin el, los displayNameKey de settings.ts no se
    // resuelven y el panel sale en ingles aunque existan las traducciones.
    this.localizationManager = this.host.createLocalizationManager();
    this.formattingService = new FormattingSettingsService(this.localizationManager);
    this.events            = this.host.eventService;
    this.tooltipSvc        = this.host.tooltipService;
    this.locale            = this.host.locale || "en-US";

    // Selection changed from outside (bookmark, slicer, another visual's clear).
    this.selectionManager.registerOnSelectCallback((ids: powerbi.extensibility.ISelectionId[]) => {
      this.syncSelectionFrom(ids as unknown as ISelectionId[]);
      this.applySelectionStyles();
    });

    this.container = options.element;
    this.container.style.position   = "relative";
    this.container.style.overflow   = "hidden";
    this.container.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    this.container.tabIndex = 0;
    this.container.setAttribute("role", "application");
    this.container.setAttribute("aria-label", "Tile Grid Map Pro");

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.width   = "100%";
    this.svg.style.height  = "100%";
    this.svg.style.display = "block";
    this.container.appendChild(this.svg);
    this.wm = createProWatermark(this.container);

    this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
      hostElement: options.element,
      subSelectionService: options.host.subSelectionService,
      selectionIdCallback: () => undefined as unknown as powerbi.visuals.ISelectionId,
    });
    this.visualOnObjectFormatting = {
      getSubSelectionStyles: (subs) => this.getSubSelectionStyles(subs),
      getSubSelectionShortcuts: (subs) => this.getSubSelectionShortcuts(subs),
      getSubSelectables: (filter) => this.subSelectionHelper.getAllSubSelectables(filter),
    };

    this.bindPointerEvents();
    this.bindKeyboard();
    this.bindDrop();
    this.resolveLicense();
  }

  // ── Licence ─────────────────────────────────────────────────────────────────
  private resolveLicense(): void {
    if (FORCE_PRO) {
      this.licenseResolved = true;
      this.isPro = true;
      return;
    }
    const lm = this.host.licenseManager;
    if (!lm) {
      this.licenseResolved = true;
      this.licenseInfoAvailable = false;
      return;
    }
    const failed = () => {
      // The licence could not be read: Free, and never a purchase prompt.
      this.licenseResolved = true;
      this.licenseInfoAvailable = false;
      this.applyLicense(false);
    };
    try {
      lm.getAvailableServicePlans().then(result => {
        this.licenseEnvSupported  = !result?.isLicenseUnsupportedEnv;
        this.licenseInfoAvailable = result?.isLicenseInfoAvailable !== false;
        // ServicePlanState: Active = 1, Warning = 2 (payment grace period). Both usable.
        const pro = (result?.plans ?? []).some(p =>
          matchesPlan(p.spIdentifier, SP_IDENTIFIER) &&
          ((p.state as unknown as number) === 1 || (p.state as unknown as number) === 2));
        this.licenseResolved = true;
        this.applyLicense(pro);
      }, failed);
    } catch (_) {
      failed();
    }
  }

  private applyLicense(pro: boolean): void {
    this.isPro = pro;
    if (pro) this.clearLicenseNotice();
    // Always repaint: a Pro customer needs the full rows (the scan key includes the
    // row limit), and a Free user needs the notification render() skipped earlier.
    this.repaint();
  }

  /** Pro features the user is actually trying to use. */

  private attemptedProFeatures(dataView: DataView | undefined): { labels: string[]; signature: string; keys: Set<string> } {
    const labels: string[] = [];
    const parts: string[] = [];
    const keys = new Set<string>();
    const objs = (dataView?.metadata?.objects ?? {}) as powerbi.DataViewObjects;
    const country = String(this.settings.mapSettings.country.value);
    const scale = String(this.settings.colorScale.scaleType.value);

    const tplPedida = String((objs as Record<string, Record<string, unknown> | undefined>).style?.template ?? "classic");
    if (PRO_STYLES.indexOf(tplPedida) >= 0) { labels.push(this.tf("UI_WmStyle", "the {0} style", STYLE_NAMES[tplPedida])); parts.push(`style=${tplPedida}`); keys.add("style"); }
    const custom = country === "custom";
    if (custom) { labels.push(this.t("UI_WmCustom", "custom TopoJSON regions")); parts.push("custom"); keys.add("custom"); }
    if (scale === "diverging" || scale === "categorical") { labels.push(this.t(scale === "diverging" ? "UI_WmDiverging" : "UI_WmCategorical", scale === "diverging" ? "the diverging colour scale" : "the categorical colour scale")); parts.push(scale); keys.add("scale"); }
    // Por VALOR, no por presencia: Power BI deja la propiedad escrita para siempre una vez
    // tocada, asi que mirar si existe dejaba la marca de agua puesta aunque el usuario
    // devolviera el color a su valor de origen.
    // Por defecto ya no hay un color fijo: es el del estilo en vigor (1.3). Cuenta como color propio el que está
    // guardado y es distinto del que pondría el estilo.
    const csAj = this.settings.colorScale;
    const guardados = (objs as Record<string, Record<string, unknown> | undefined>).colorScale ?? {};
    const colours = (["colorMin", "colorMid", "colorMax"] as const).filter(p => {
      if (guardados[p] === undefined) return false;
      const actual = String(csAj[p].value?.value ?? "").toLowerCase();
      return actual !== "" && actual !== this.colorPorDefecto(p).toLowerCase();
    });
    if (colours.length) {
      labels.push(this.t("UI_WmColours", "custom scale colours"));
      parts.push(colours.map(p => `${p}=${String(csAj[p].value?.value ?? "")}`).join(","));
      keys.add("colours");
    }
    const ms = this.settings.mapSettings;
    if (!custom && String(ms.tileShape.value) !== "square") { labels.push(this.t(String(ms.tileShape.value) === "circle" ? "UI_WmCircle" : "UI_WmHex", String(ms.tileShape.value) === "circle" ? "circle tiles" : "hexagon tiles")); parts.push(`shape=${String(ms.tileShape.value)}`); keys.add("shape"); }
    if (scale === "quantile") { labels.push(this.t("UI_WmQuantile", "the quantile colour scale")); parts.push("quantile"); keys.add("scale"); }
    if (this._hasTarget) { labels.push(this.t("UI_WmTarget", "colouring tiles by variance against a target")); parts.push("target"); keys.add("target"); }
    if (this._hasSize && !custom) { labels.push(this.t("UI_WmSize", "sizing tiles by a second measure")); parts.push("size"); keys.add("size"); }
    if (this._stats.total > FREE_ROW_LIMIT) {
      labels.push(this.tf("UI_WmRows", "more than {0} rows (this report has {1})", String(FREE_ROW_LIMIT), this._stats.total.toLocaleString(this.locale)));
      parts.push(`rows>${FREE_ROW_LIMIT}`);
      keys.add("rows");
    }
    return { labels, signature: parts.join("|"), keys };
  }

  /** Plantilla que se dibuja: un estilo Pro sin licencia (ni vista previa) se dibuja como Report theme. */
  private plantillaEfectiva(dataView: DataView | undefined): string {
    const pedida = String(((dataView?.metadata?.objects ?? {}) as Record<string, Record<string, unknown> | undefined>).style?.template ?? "classic");
    if (PRO_STYLES.indexOf(pedida) < 0) return "classic";
    return this.isPro || (this.proPreview && this.estiloIntentado(pedida)) ? pedida : "classic";
  }
  private estiloIntentado(t: string): boolean { return PRO_STYLES.indexOf(t) >= 0; }

  /**
   * "Report theme" (valor interno "classic"): la rampa sale del primer color de datos del tema del informe, la
   * divergente de su sentimiento malo/bueno y la tinta de su gris secundario. Lo que el host no dé, los de siempre.
   */
  private tokensTema(): MapTokens {
    const pal = this.host.colorPalette as unknown as Record<string, { value?: string } | undefined> & { getColor?: (k: string) => { value: string } };
    const ok = (c?: string) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : undefined;
    let hi: string | undefined;
    try { hi = ok(pal.getColor?.("tgm-sequential")?.value); } catch (_) { hi = undefined; }
    hi = hi ?? "#1A5276";
    return { text: ok(pal.foreground?.value) ?? "#252423", axis: ok(pal.foregroundNeutralSecondary?.value) ?? "#555555",
      grid: "#CCCCCC", lo: mixHex("#FFFFFF", hi, 0.15), hi, down: ok(pal.negative?.value) ?? "#C0392B", mid: "#F2F2F2",
      up: ok(pal.positive?.value) ?? hi, empty: "#E8E8E8", ring: "#2980B9" };
  }

  /** Color que pone el estilo en vigor en una propiedad de la escala (la divergente usa down · mid · up). */
  private colorPorDefecto(p: "colorMin" | "colorMid" | "colorMax"): string {
    const div = String(this.settings.colorScale.scaleType.value) === "diverging";
    return p === "colorMid" ? this.tk.mid : p === "colorMin" ? (div ? this.tk.down : this.tk.lo) : (div ? this.tk.up : this.tk.hi);
  }

  /**
   * Pone los colores del estilo donde el autor no ha fijado nada, también en el panel, que así enseña los que se ven.
   * Lo que el autor fija siempre gana.
   */
  private aplicarEstilo(dataView: DataView | undefined): void {
    const tpl = this.plantillaEfectiva(dataView);
    this.tk = tpl === "classic" ? this.tokensTema() : STYLE_TOKENS[tpl];
    const objs = (dataView?.metadata?.objects ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const pon = (card: string, slice: { value: unknown }, prop: string, valor: string | undefined, color = true) => {
      if (valor === undefined || objs[card]?.[prop] !== undefined) return;
      slice.value = color ? { value: valor } : valor;
    };
    const cs = this.settings.colorScale, lg = this.settings.legend, ac = this.settings.accessibility;
    pon("colorScale", cs.colorMin, "colorMin", this.colorPorDefecto("colorMin"));
    pon("colorScale", cs.colorMid, "colorMid", this.colorPorDefecto("colorMid"));
    pon("colorScale", cs.colorMax, "colorMax", this.colorPorDefecto("colorMax"));
    pon("colorScale", cs.noDataColor, "noDataColor", this.tk.empty);
    pon("legend", lg.fontColor, "fontColor", this.tk.axis);
    pon("legend", lg.fontFamily, "fontFamily", this.tk.font, false);
    pon("accessibility", ac.borderColor, "borderColor", this.tk.grid);
    pon("accessibility", ac.selectedRingColor, "selectedRingColor", this.tk.ring);
    // Fondo del visual: el del estilo (oscuro en Boardroom y Aurora); con Report theme, transparente como siempre.
    this.container.style.background = this.isHCActivo() ? "" : (this.tk.grad ?? this.tk.bg ?? "");
  }
  private isHCActivo(): boolean { return !!this.host.colorPalette?.isHighContrast; }

  /** Propiedades que define una plantilla: se borran al elegir otra para que se vea. */
  private aplicarPlantilla(): void {
    const quita = (objectName: string, props: string[]) => ({ objectName, selector: null as unknown as powerbi.data.Selector,
      properties: props.reduce((acc: Record<string, null>, k) => { acc[k] = null; return acc; }, {}) });
    try {
      this.host.persistProperties({ remove: [
        quita("colorScale", ["colorMin", "colorMid", "colorMax", "noDataColor"]),
        quita("legend", ["fontColor", "fontFamily"]),
        quita("accessibility", ["borderColor", "selectedRingColor"]),
      ] } as unknown as powerbi.VisualObjectInstancesToPersist);
    } catch (_) { /* best-effort */ }
  }

  /**
   * Vista previa Pro.
   *
   * Solo con la licencia ya resuelta y en un entorno donde se puede leer: al arrancar,
   * isPro es false tambien para quien ya pago, y donde la licencia no se resuelve
   * -Publicar en la web, incrustado, exportacion- un cliente Pro se lee como gratuito.
   * Dibujar la marca ahi seria ponersela a quien ya compro.
   */
  private computePreview(): boolean {
    return !this.isPro && this.editing && this.licenseResolved
      && this.licenseEnvSupported && this.licenseInfoAvailable;
  }

  /**
   * Si una funcion concreta se dibuja. POR FUNCION, nunca en bloque: conceder la previa
   * entera repartiria los valores Pro por defecto en cuanto se inserta el visual.
   */
  private allow(key: string): boolean {
    if (this.isPro) return true;
    if (!this.proPreview) return false;
    return this.attemptedKeys.has(key);
  }

  private notifyLicense(dataView: DataView | undefined): void {
    if (!this.licenseResolved || this.isPro) return;
    // A Pro customer legitimately reads as Free here: never ask them to buy.
    if (!this.licenseEnvSupported || !this.licenseInfoAvailable) return;

    const { labels, signature } = this.attemptedProFeatures(dataView);
    if (labels.length === 0) { this.clearLicenseNotice(); return; }

    const lm = this.host.licenseManager;
    if (signature === this.lastBlockedNotice) return;
    this.lastBlockedNotice = signature;

    // Limpiar primero. Si hay una barra de Upgrade levantada, el banner la sustituiria y al
    // expirar no quedaria nada: es lo que pasaba llamando a notifyLicenseRequired antes.
    try { lm.clearLicenseNotification?.(); } catch (_) { /* best-effort */ }
    this.licenseIconShown = false;

    const list = labels.length === 1 ? labels[0] : this.tf("UI_ListAnd", "{0} and {1}", labels.slice(0, -1).join(", "), labels[labels.length - 1]);
    try {
      lm.notifyFeatureBlocked(labels.length === 1
        ? this.tf("UI_BlockedOne", "Tile Grid Map Pro: {0} is part of the Pro plan. Get a licence to enable it.", list)
        : this.tf("UI_BlockedMany", "Tile Grid Map Pro: {0} are part of the Pro plan. Get a licence to enable them.", list));
    } catch (_) { /* best-effort */ }

    // La barra de Upgrade, cuando el banner ya se ha ido. 10,5 s es lo que dura.
    this.cancelLicenseIcon();
    this.licenseIconTimer = window.setTimeout(() => {
      this.licenseIconTimer = null;
      if (this.isPro) return;
      try {
        lm.notifyLicenseRequired(0 /* LicenseNotificationType.General */);
        this.licenseIconShown = true;
      } catch (_) { /* best-effort */ }
    }, 10500);
  }

  /** Cancela la barra de Upgrade pendiente. */
  /**
   * Power BI recrea el visual al cambiar de pagina: un temporizador vivo levantaria la
   * barra de Upgrade sobre un visual que ya no existe.
   */
  public destroy(): void {
    this.cancelLicenseIcon();
  }

  private cancelLicenseIcon(): void {
    if (this.licenseIconTimer !== null) {
      window.clearTimeout(this.licenseIconTimer);
      this.licenseIconTimer = null;
    }
  }

  private clearLicenseNotice(): void {
    this.lastBlockedNotice = "";
    this.cancelLicenseIcon();
    if (!this.licenseIconShown) return;
    this.licenseIconShown = false;
    try { this.host.licenseManager?.clearLicenseNotification(); } catch (_) { /* best-effort */ }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  public update(options: VisualUpdateOptions): void {
    this.events.renderingStarted(options);
    try {
      // Al ELEGIR una plantilla se borran los colores guardados que ella define, para que se vea. Aquí, en un update
      // del host, nunca en un repintado ni en el callback de selección (persistProperties no puede salir de ahí).
      const objsU = (options?.dataViews?.[0]?.metadata?.objects ?? {}) as Record<string, Record<string, unknown> | undefined>;
      const tplU = String(objsU.style?.template ?? "classic");
      const editando = (options as unknown as { viewMode?: number }).viewMode !== 0;
      if (editando && this.tplVisto !== null && this.tplVisto !== tplU) this.aplicarPlantilla();
      this.tplVisto = tplU;
      this.formatMode = !!(options as unknown as { formatMode?: boolean }).formatMode;
      this.subSelectionHelper.setFormatMode(this.formatMode);
      if (this.formatMode) this.tooltipSvc.hide({ immediately: true, isTouchEvent: false });
      this.render(options);
      this.marcarSubseleccionables();
      if (this.formatMode) {
        const subs = (options as unknown as { subSelections?: powerbi.visuals.CustomVisualSubSelection[] }).subSelections ?? [];
        this.subSelectionHelper.updateOutlinesFromSubSelections(subs, true);
      }
      this.events.renderingFinished(options);
    } catch (e) {
      this.events.renderingFailed(options, String(e));
    }
  }

  /**
   * Repintado interno (licencia resuelta, TopoJSON soltado), SIN eventos de render. Microsoft exige un
   * renderingStarted/Finished por cada update del host: repintar llamando a update() los duplicaba, y es el
   * motivo por el que rechazaron Likert (1.3, 21-11-2026).
   */
  private repaint(): void {
    if (!this._lastOptions) return;
    try { this.render(this._lastOptions); } catch (_) { /* se mantiene lo pintado */ }
  }

  /**
   * TEXTO QUE ENCOGE CON EL VISUAL (1.3, norma de la cartera; receta de Waterfall 1.3). Por debajo de ~760×440 todo
   * el texto propio (leyenda, mensajes, pantalla de inicio) baja en proporción, hasta el 60 % y nunca por debajo de
   * 8 px. Por encima, los tamaños elegidos: los informes guardados se ven igual.
   */
  private scale = 1;
  private fz(px: number): number {
    if (this.scale >= 1) return px;
    return Math.max(Math.min(8, px), Math.round(px * this.scale * 2) / 2);
  }

  private render(options: VisualUpdateOptions): void {
    this._lastOptions = options;
    const vp0 = options.viewport;
    this.scale = vp0 && vp0.width > 0 && vp0.height > 0
      ? Math.min(1, Math.max(0.6, Math.min(vp0.width / 760, vp0.height / 440))) : 1;
    // viewMode 0 es vista de lectura. La previa es cosa de quien edita: un informe
    // publicado nunca debe usar una funcion que no se ha pagado.
    this.editing = (options as unknown as { viewMode?: number }).viewMode !== 0;
    this.proPreview = this.computePreview();
    {
      const dataView = options?.dataViews?.[0];
      this.settings = this.formattingService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);
      this.aplicarEstilo(dataView);

      // Las claves se calculan ANTES de pintar: el render pregunta por ellas en cada
      // punto de bloqueo, asi que no pueden salir del aviso, que va despues.
      if (this.isPro) {
        this.attemptedKeys = new Set<string>();
        this.attemptedLabels = [];
      } else {
        const intento = this.attemptedProFeatures(dataView);
        this.attemptedKeys = intento.keys;
        this.attemptedLabels = intento.labels;
      }

      const palette = this.host.colorPalette;
      this.isHC = !!palette.isHighContrast;
      if (this.isHC) {
        this.hcFg = palette.foreground?.value ?? "#fff";
        this.hcBg = palette.background?.value ?? "#000";
      }

      while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
      this._points = new Map();
      this._orderedKeys = [];

      // Con un estilo que pinta fondo (Ledger, Boardroom, Aurora…), el mapa deja un margen para no tocar el canto del
      // fondo (Tino, 21-11-2026). Con Report theme, sin fondo propio, el mapa usa todo el visual como siempre.
      const vpTotal = options.viewport;
      const margen = (this.tk.bg || this.tk.grad) && !this.isHC
        ? Math.max(6, Math.min(16, Math.round(Math.min(vpTotal.width, vpTotal.height) * 0.03))) : 0;
      this.svg.style.margin = margen ? `${margen}px` : "";
      this.svg.style.width = margen ? `calc(100% - ${2 * margen}px)` : "100%";
      this.svg.style.height = margen ? `calc(100% - ${2 * margen}px)` : "100%";
      const vp = { width: Math.max(0, vpTotal.width - 2 * margen), height: Math.max(0, vpTotal.height - 2 * margen) };
      const countryKey = String(this.settings.mapSettings.country.value);
      const custom = countryKey === "custom";

      if (!dataView?.table) {
        // Sin datos no hay nada que contar. scan() no llega a ejecutarse en esta rama, asi
        // que sin este reinicio el recuento de filas anterior sobrevivia: al quitar la
        // latitud, la marca de agua de "mas de 500 filas" se quedaba puesta para siempre.
        this._stats = { total: 0, used: 0, blankCoords: 0, outside: 0, snapped: 0, capped: false };
        this._hasSize = false;
        this.attemptedKeys = new Set<string>();
        this.attemptedLabels = [];
        this.renderLandingPage(vp);
      } else if (custom && !this.allow("custom")) {
        // Gated where it is drawn. The purchase path is Power BI's notification.
        this._stats = { total: dataView.table.rows?.length ?? 0, used: 0, blankCoords: 0, outside: 0, snapped: 0, capped: false };
        this._scanDataView = null; // these stats are not a scan: force the next one
        this.renderCentredText(vp, [this.t("UI_CustomNA", "Custom TopoJSON regions are not available."), this.t("UI_ChooseCountry", "Choose a country in Format → Map Settings.")]);
      } else if (custom) {
        this.restorePersistedTopo(dataView);
        if (this._topoFeatures && this._topoFeatures.length > 0) {
          this.scan(dataView, null);
          this.renderTopo(this._topoFeatures, vp);
        } else {
          this.renderDropZone(vp);
        }
      } else {
        this.grid = COUNTRY_GRIDS[countryKey] ?? COUNTRY_GRIDS["es"];
        this.scan(dataView, this.grid);
        this.renderGrid(vp);
      }

      this.applySelectionStyles();
      // Recalculadas AQUI, no antes de pintar: _hasSize y el recuento de filas se rellenan
      // dentro de scan(), asi que antes iban un ciclo por detras y la marca sobrevivia a
      // quitar el campo Size. Las CLAVES si se calculan antes, porque el render las
      // necesita para decidir que dibuja.
      if (!this.isPro) {
        this.attemptedLabels = this.attemptedProFeatures(dataView).labels;
      }
      this.renderWatermark(vpTotal);
      this.notifyLicense(dataView);
    }
  }

  // ── Data scan (cached) ────────────────────────────────────────────────────
  private scan(dataView: DataView, grid: CountryGrid | null): void {
    const limit = this.allow("rows") ? Infinity : FREE_ROW_LIMIT;
    const key = [grid ? grid.id : "topo:" + this._topoSource, String(limit)].join("|");
    if (dataView === this._scanDataView && key === this._scanKey) return;
    this._scanDataView = dataView;
    this._scanKey = key;

    const table   = dataView.table!;
    const columns = table.columns;
    const allRows = table.rows ?? [];
    const rows    = allRows.length > limit ? allRows.slice(0, limit) : allRows;

    const latIdx   = columns.findIndex(c => c.roles?.["latitude"]);
    const lngIdx   = columns.findIndex(c => c.roles?.["longitude"]);
    const valIdx   = columns.findIndex(c => c.roles?.["value"]);
    const labelIdx = columns.findIndex(c => c.roles?.["label"]);
    const ttIdxs   = columns.map((c, i) => c.roles?.["tooltips"] ? i : -1).filter(i => i >= 0);

    const sizeIdx  = columns.findIndex(c => c.roles?.["size"]);
    this._hasSize = sizeIdx >= 0;
    this._sizeAggType = sizeIdx >= 0 ? this.detectAggType(columns[sizeIdx]) : "sum";
    this._sizeFmt = sizeIdx >= 0 ? (columns[sizeIdx].format || undefined) : undefined;
    this._sizePercent = esPorcentaje(this._sizeFmt);
    const catIdx   = columns.findIndex(c => c.roles?.["category"]);
    this._hasCategory = catIdx >= 0;
    const tgtIdx   = columns.findIndex(c => c.roles?.["target"]);
    this._hasTarget = tgtIdx >= 0;
    this._targetAggType = tgtIdx >= 0 ? this.detectAggType(columns[tgtIdx]) : "sum";
    this._targetFmt = tgtIdx >= 0 ? (columns[tgtIdx].format || undefined) : undefined;
    const maxSnap = grid?.snapCells ?? MAX_SNAP_CELLS;
    this._valueAggType = valIdx >= 0 ? this.detectAggType(columns[valIdx]) : "count";
    this._valueFmt = valIdx >= 0 ? (columns[valIdx].format || undefined) : undefined;
    this._valuePercent = esPorcentaje(this._valueFmt);

    // RESALTADO (1.3): al hacer clic en otro visual, Power BI no filtra el mapa sino que manda qué filas resaltar, y solo
    // en la vista categórica. Se cruzan con las filas de la tabla por sus valores (latitud|longitud|etiqueta|categoría),
    // no por posición: las dos vistas no garantizan el mismo orden.
    const resaltadas = this.filasResaltadas(dataView);
    this._hayResaltado = resaltadas !== null;
    const claveFila = (row: powerbi.DataViewTableRow) => [latIdx, lngIdx, labelIdx, catIdx].map(i => i >= 0 ? String(row[i] ?? "") : "").join("|");

    const stats: ScanStats = { total: allRows.length, used: 0, blankCoords: 0, outside: 0, snapped: 0, capped: allRows.length >= ROW_CAP };
    const buckets = new Map<string, Bucket>();
    const features = grid ? null : this._topoFeatures;

    if (latIdx >= 0 && lngIdx >= 0) {
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const lat = toNumber(row[latIdx]);
        const lng = toNumber(row[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) { stats.blankCoords++; continue; }

        let key: string, col = -1, r = -1;
        if (grid) {
          const cell = locateCell(lat, lng, grid, maxSnap);
          if (!cell) { stats.outside++; continue; }
          if (cell.snapped) stats.snapped++;
          col = cell.col; r = cell.row; key = `${col},${r}`;
        } else {
          const fi = this.findFeature(lng, lat, features!);
          if (fi < 0) { stats.outside++; continue; }
          key = `t${fi}`;
        }

        let b = buckets.get(key);
        if (!b) {
          b = { key, col, row: r, values: [], sizes: [], labels: [], cats: new Map(), tooltips: new Map(), selIds: [], rowCount: 0, targets: [], hl: false };
          buckets.set(key, b);
        }
        b.rowCount++;
        stats.used++;
        if (resaltadas && resaltadas.has(claveFila(row))) b.hl = true;
        b.selIds.push(this.host.createSelectionIdBuilder().withTable(table, rowIdx).createSelectionId());

        const val = valIdx >= 0 ? toNumber(row[valIdx]) : NaN;
        if (!isNaN(val)) b.values.push(val);
        if (sizeIdx >= 0) {
          const sz = toNumber(row[sizeIdx]);
          if (!isNaN(sz)) b.sizes.push(sz);
        }
        if (tgtIdx >= 0) {
          const tg = toNumber(row[tgtIdx]);
          if (!isNaN(tg)) b.targets.push(tg);
        }
        if (catIdx >= 0) {
          const cv = row[catIdx];
          const cat = cv === null || cv === undefined || cv === "" ? this.t("UI_Blank", "(Blank)") : String(cv);
          b.cats.set(cat, (b.cats.get(cat) ?? 0) + 1);
        }
        if (labelIdx >= 0) {
          const lbl = row[labelIdx];
          if (lbl !== null && lbl !== undefined && lbl !== "" && b.labels.length < 50) {
            const s = String(lbl);
            if (b.labels.indexOf(s) < 0) b.labels.push(s);
          }
        }
        for (const ti of ttIdxs) {
          const name = columns[ti].displayName ?? `col${ti}`;
          let td = b.tooltips.get(name);
          if (!td) {
            td = { nums: [], firstText: "", aggType: this.detectAggType(columns[ti]), percent: esPorcentaje(columns[ti].format), fmt: columns[ti].format || undefined };
            b.tooltips.set(name, td);
          }
          const raw = row[ti];
          const num = toNumber(raw);
          if (!isNaN(num)) td.nums.push(num);
          else if (!td.firstText && raw !== null && raw !== undefined && raw !== "") td.firstText = String(raw);
        }
      }
    }

    this._buckets = buckets;
    this._stats = stats;
  }

  /**
   * Claves (latitud|longitud|etiqueta|categoría) de las filas que otro visual resalta, o null si no hay resaltado.
   * Las categorías llegan en el orden del select de capabilities; se colocan por rol para que la clave case con la tabla.
   */
  private filasResaltadas(dataView: DataView): Set<string> | null {
    const cat = dataView.categorical;
    // Cualquier medida trae los resaltados (Value, Size, Target, Tooltips): sin Value el mapa también reacciona.
    const hls = (cat?.values ?? []).map(v => v.highlights).filter((h): h is powerbi.PrimitiveValue[] => !!h);
    if (!cat?.categories?.length || hls.length === 0) return null;
    const porRol = (rol: string) => cat.categories!.find(c => c.source.roles?.[rol]);
    const cols = ["latitude", "longitude", "label", "category"].map(porRol);
    const n = cat.categories[0].values.length;
    const out = new Set<string>();
    for (let i = 0; i < n; i++) {
      if (!hls.some(h => h[i] !== null && h[i] !== undefined)) continue;
      out.add(cols.map(c => c ? String(c.values[i] ?? "") : "").join("|"));
    }
    // Un resaltado que no coincide con ninguna fila del mapa lo atenúa entero (antes salía todo a color).
    return out;
  }

  /** Aggregation implied by the field well ("Sum of", "Average of", …). */
  private detectAggType(col: powerbi.DataViewMetadataColumn): string {
    const qn = (col.queryName ?? "").toLowerCase();
    if (qn.startsWith("sum("))                                   return "sum";
    if (qn.startsWith("avg(") || qn.startsWith("average("))     return "average";
    if (qn.startsWith("min("))                                   return "min";
    if (qn.startsWith("max("))                                   return "max";
    if (qn.startsWith("count(") || qn.startsWith("counta(") ||
        qn.startsWith("countnonnull(") || qn.startsWith("countdistinct(")) return "count";

    const dn = (col.displayName ?? "").toLowerCase();
    if (/^(average|avg) of |^(promedio|media) de /.test(dn))      return "average";
    if (/^sum of |^suma de /.test(dn))                            return "sum";
    if (/^(min|minimum) of |^m[ií]nimo de /.test(dn))             return "min";
    if (/^(max|maximum) of |^m[aá]ximo de /.test(dn))             return "max";
    if (/^count of |^recuento de |^n[uú]mero de /.test(dn))      return "count";
    // A model measure gives no hint. Sum is right for additive measures; a ratio or an
    // average needs "Average" chosen in Map Settings, and the tooltip names the one used.
    return "sum";
  }

  private aggType(): string {
    const setting = String(this.settings.mapSettings.aggregationType.value);
    return setting === "auto" ? this._valueAggType : setting;
  }

  private aggregate(values: number[], type: string): number {
    if (values.length === 0) return NaN;
    switch (type) {
      case "average": return values.reduce((a, b) => a + b, 0) / values.length;
      case "min": { let m = values[0]; for (let i = 1; i < values.length; i++) if (values[i] < m) m = values[i]; return m; }
      case "max": { let m = values[0]; for (let i = 1; i < values.length; i++) if (values[i] > m) m = values[i]; return m; }
      case "count": return values.length;
      default: return values.reduce((a, b) => a + b, 0);
    }
  }

  /**
   * ETIQUETA DE LA TESELA (1.3). "auto" es lo de siempre: el valor si la tesela es grande, si no las 4 primeras letras
   * del nombre. "value" y "name" fijan una cosa; "both" pone el nombre encima y el valor debajo, como los mapas de
   * mosaico de prensa, y si no caben las dos líneas deja el valor. Nunca por debajo de 8 px y nunca más ancha que la
   * tesela: lo que no cabe no se dibuja (un nombre se recorta a lo que quepa, con «…»).
   */
  private lineasEtiqueta(value: number, nombre: string, inner: number, minLabel: number, fontSize: number, modo: string):
      { texto: string; fs: number; dy: number; peso: string }[] {
    const cabe = (t: string, fs: number) => t.length * fs * 0.6 <= inner - 2;
    const recorta = (t: string, fs: number) => {
      const n = Math.floor((inner - 2) / (fs * 0.6));
      return n >= t.length ? t : n >= 3 ? t.slice(0, n - 1).trimEnd() + "…" : "";
    };
    const valor = this.formatValue(value, this.fmtValor());
    const grande = inner >= minLabel;
    if (modo === "auto") {
      const fs = Math.max(8, grande ? fontSize : fontSize * 0.8);
      const t = grande ? valor : nombre.slice(0, 4);
      return t && cabe(t, fs) ? [{ texto: t, fs, dy: 0, peso: "600" }] : [];
    }
    const fs = Math.max(8, fontSize);
    const soloNombre = () => { const t = recorta(nombre, fs); return t ? [{ texto: t, fs, dy: 0, peso: "600" }] : []; };
    if (modo === "name") return soloNombre();
    if (modo === "both" && nombre) {
      const fsN = Math.max(8, fs * 0.85);
      const n = recorta(nombre, fsN);
      if (n && cabe(valor, fs) && inner >= (fs + fsN) * 1.15) {
        const alto = fs + fsN + 1;
        return [{ texto: n, fs: fsN, dy: -alto / 2 + fsN / 2, peso: "400" }, { texto: valor, fs, dy: alto / 2 - fs / 2, peso: "600" }];
      }
    }
    if (cabe(valor, fs)) return [{ texto: valor, fs, dy: 0, peso: "600" }];
    return modo === "both" ? soloNombre() : [];
  }

  /** ¿Se colorea por desviación contra el objetivo? Pro (o su vista previa) y con un campo en Target. */
  private modoObjetivo(): boolean {
    return this._hasTarget && this.allow("target");
  }

  /** Las reglas se escriben como se ven: con un campo en % o en modo objetivo, 25 es 25 %. */
  private umbralEnPorcentaje(): boolean {
    return this._valuePercent || this.modoObjetivo();
  }

  /** Objetivo agregado de una tesela, o NaN. */
  private objetivoTesela(b: Bucket): number {
    return this.aggregate(b.targets, this._targetAggType);
  }

  /**
   * Lo que pinta la tesela: su valor o, en modo objetivo, la desviación (valor − objetivo) / |objetivo|. Sin objetivo,
   * o con objetivo 0, no hay desviación que calcular y la tesela queda sin dato.
   */
  private valorTesela(b: Bucket, type: string): number | null {
    const v = this.bucketValue(b, type);
    if (!this.modoObjetivo()) return v;
    const t = this.objetivoTesela(b);
    if (v === null || !Number.isFinite(t) || t === 0) return null;
    return (v - t) / Math.abs(t);
  }

  /** Aggregated value of a bucket, or null when it has none. Count counts rows. */
  private bucketValue(b: Bucket, type: string): number | null {
    if (type === "count") return b.rowCount;
    const v = this.aggregate(b.values, type);
    return isNaN(v) ? null : v;
  }

  // ── Colour model ──────────────────────────────────────────────────────────
  private buildColorModel(values: number[]): ColorModel {
    const [min, max] = domainOf(values);
    const cs = this.settings.colorScale;
    const scale = String(cs.scaleType.value);

    if (this.isHC) {
      // One colour cannot encode a value, so opacity does.
      return {
        kind: "hc", min, max,
        colorFor: () => this.hcFg,
        opacityFor: v => 0.25 + 0.75 * normalise(v, min, max),
        legendStops: [{ value: 0, color: this.mixHex(this.hcBg, this.hcFg, 0.25) }, { value: 1, color: this.hcFg }],
      };
    }
    if (this.modoObjetivo()) {
      // Desviación contra el objetivo: divergente y SIMÉTRICA alrededor de 0, para que un +10 % y un −10 % pesen igual;
      // rojo/verde del estilo (en Report theme, los colores de sentimiento del tema).
      // El extremo es el PERCENTIL 95 de |desviación|, no el máximo: una tesela con un objetivo diminuto (+140 %) dejaba
      // el resto del mapa casi blanco (visto el 22-11-2026 con Begudes Nord). Lo que pasa del extremo se satura y la
      // leyenda lo dice con ≤ / ≥.
      const abs = values.map(v => Math.abs(v)).sort((a, b) => a - b);
      const maxAbs = abs.length ? abs[abs.length - 1] : 0;
      const p95 = abs.length ? abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.95))] : 0;
      const m = (p95 > 0 ? p95 : maxAbs) || 1;
      const stops = [{ value: 0, color: this.tk.down }, { value: 0.5, color: this.tk.mid }, { value: 1, color: this.tk.up }];
      const fn = buildStopScale(stops);
      return { kind: "diverging", min: -m, max: m, colorFor: v => fn(normaliseDiverging(v, -m, m)), opacityFor: () => 1, legendStops: stops,
        recortada: maxAbs > m * 1.0001 };
    }
    if (!this.allow("scale") && !this.allow("colours")) {
      // La rampa gratuita es la del estilo en vigor (Report theme por defecto); antes, un azul fijo.
      const stops = [{ value: 0, color: this.tk.lo }, { value: 1, color: this.tk.hi }];
      const fn = buildStopScale(stops);
      return { kind: "free", min, max, colorFor: v => fn(normalise(v, min, max)), opacityFor: () => 1, legendStops: stops };
    }
    const cMin = cs.colorMin.value?.value ?? "#d0e4f7";
    const cMid = cs.colorMid.value?.value ?? "#f7f7f7";
    const cMax = cs.colorMax.value?.value ?? "#1a5276";
    if (scale === "categorical") {
      if (!this._hasCategory) {
        // No Category field: fall back to the first label, as before (no legend possible).
        return { kind: "categorical", min, max, colorFor: (_v, b) => categoricalColorFor(b.labels[0] ?? b.key), opacityFor: () => 1, legendStops: null };
      }
      // Each tile takes the category with most rows. The categories covering most rows
      // overall get the report theme's colours, stable per category across filters;
      // the rest share one grey "Other" so twelve colours are never reused.
      const totals = new Map<string, number>();
      this._buckets.forEach(b => b.cats.forEach((n, c) => totals.set(c, (totals.get(c) ?? 0) + n)));
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const top = new Set(ranked.slice(0, MAX_CATEGORIES).map(e => e[0]));
      const colorOf = (c: string) => top.has(c) ? this.host.colorPalette.getColor(c).value : OTHER_CATEGORY_COLOR;
      const categories = ranked.slice(0, MAX_CATEGORIES).map(([c]) => ({ color: colorOf(c), text: c }));
      if (ranked.length > MAX_CATEGORIES) categories.push({ color: OTHER_CATEGORY_COLOR, text: this.t("UI_Other", "Other") });
      return {
        kind: "categorical", min, max, opacityFor: () => 1, legendStops: null, categories,
        colorFor: (_v, b) => { const c = this.majorityCategory(b); return c === null ? OTHER_CATEGORY_COLOR : colorOf(c); },
      };
    }
    if (scale === "quantile") {
      // Equal-count classes: one extreme value can no longer wash out the whole map.
      const sorted = [...values].sort((a, b) => a - b);
      const k = Math.max(1, Math.min(5, new Set(sorted).size));
      const breaks: number[] = [];
      for (let i = 1; i < k; i++) breaks.push(sorted[Math.min(sorted.length - 1, Math.floor(i * sorted.length / k))]);
      const fn = buildStopScale([{ value: 0, color: cMin }, { value: 1, color: cMax }]);
      const classColor = (c: number) => fn(k === 1 ? 0.5 : c / (k - 1));
      const classOf = (v: number) => { let c = 0; while (c < breaks.length && v >= breaks[c]) c++; return c; };
      const classes = Array.from({ length: k }, (_, c) => ({ color: classColor(c), from: c === 0 ? min : breaks[c - 1] }));
      return { kind: "quantile", min, max, colorFor: v => classColor(classOf(v)), opacityFor: () => 1, legendStops: null, classes };
    }
    if (scale === "diverging") {
      const stops =[{ value: 0, color: cMin }, { value: 0.5, color: cMid }, { value: 1, color: cMax }];
      const fn = buildStopScale(stops);
      return { kind: "diverging", min, max, colorFor: v => fn(normaliseDiverging(v, min, max)), opacityFor: () => 1, legendStops: stops };
    }
    const stops = [{ value: 0, color: cMin }, { value: 1, color: cMax }];
    const fn = buildStopScale(stops);
    return { kind: "sequential", min, max, colorFor: v => fn(normalise(v, min, max)), opacityFor: () => 1, legendStops: stops };
  }

  private mixHex(a: string, b: string, t: number): string {
    return buildStopScale([{ value: 0, color: a }, { value: 1, color: b }])(t);
  }

  private pointColor(value: number | null, b: Bucket, model: ColorModel, noData: string): { color: string; opacity: number } {
    if (value === null) return { color: noData, opacity: 1 };
    if (!this.isHC) {
      const cf = this.applyConditionalFormatting(value);
      if (cf) return { color: cf, opacity: 1 };
    }
    return { color: model.colorFor(value, b), opacity: model.opacityFor(value) };
  }

  private noDataColor(): string {
    return this.isHC ? this.hcBg : (this.settings.colorScale.noDataColor.value?.value ?? "#e8e8e8");
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  private legendVisible(model: ColorModel | null): boolean {
    const rules = this.settings.conditionalFormatting.cfEnabled.value && !this.isHC;
    return !!model && (!!model.legendStops || !!model.classes || !!model.categories || rules) && this.settings.legend.showLegend.value;
  }

  private statusLines(): string[] {
    const s = this._stats;
    const out: string[] = [];
    const n = (x: number) => x.toLocaleString(this.locale);
    if (!this.allow("rows") && s.total > FREE_ROW_LIMIT) out.push(this.tf("UI_ShowingFirst", "Showing the first {0} of {1} rows.", n(FREE_ROW_LIMIT), n(s.total)));
    else if (s.capped) out.push(this.tf("UI_RowCap", "Power BI sent the first {0} rows; further rows are not shown.", n(ROW_CAP)));
    const missing = s.outside + s.blankCoords;
    if (missing > 0) {
      const parts: string[] = [];
      if (s.outside) parts.push(this.tf("UI_Outside", "{0} outside the map", n(s.outside)));
      if (s.blankCoords) parts.push(this.tf("UI_NoCoords", "{0} without coordinates", n(s.blankCoords)));
      out.push(this.tf("UI_NotShown", "{0} rows not shown: {1}.", n(missing), parts.join(", ")));
    }
    if (this._topoError) out.push(this._topoError);
    return out.slice(0, 2);
  }

  // ── Render: grid ───────────────────────────────────────────────────────────
  private renderGrid(vp: powerbi.IViewport): void {
    const grid = this.grid!;
    const type = this.aggType();
    const noData = this.noDataColor();

    const values: number[] = [];
    const bucketVals = new Map<string, number | null>();
    this._buckets.forEach((b, k) => {
      const v = this.valorTesela(b, type);
      bucketVals.set(k, v);
      if (v !== null) values.push(v);
    });
    const model = this.buildColorModel(values);
    const showLegend = this.legendVisible(model) && values.length > 0;
    const status = this.statusLines();

    this.calcularRango(model, bucketVals, noData, status);
    const legendH = showLegend ? this.legendHeight(model, vp.width) : 0;
    const statusH = Math.min(2, status.length) * 14;
    const legendTop = String(this.settings.legend.legendPosition.value) === "top";
    const drawTop = 4 + (legendTop ? legendH : 0);
    const drawH = vp.height - legendH - statusH - 8;

    const ms = this.settings.mapSettings;
    const acc = this.settings.accessibility;
    const shape = this.allow("shape") ? String(ms.tileShape.value) : "square";
    const hex = shape === "hexagon";

    // A cell spans cell_w degrees of longitude and cell_h of latitude. On the ground a
    // degree of longitude shrinks with cos(latitude), so a square tile stretches
    // northern countries; the correction draws each tile in its real proportion.
    const midLat = (grid.bbox.minLat + grid.bbox.maxLat) / 2;
    const ratio = ms.latitudeCorrection.value
      ? Math.min(2.5, Math.max(0.4, grid.bbox.cell_h / (grid.bbox.cell_w * Math.cos(midLat * Math.PI / 180))))
      : 1;
    const colSpan = grid.cols + (hex ? 0.5 : 0);
    const pitchX = Math.min(vp.width / colSpan, drawH / (grid.rows * ratio));
    const pitchY = pitchX * ratio;

    if (pitchX < 2 || pitchY < 2) {
      this.renderStatus(vp, status.length ? status : [this.t("UI_Enlarge", "Enlarge the visual to see the map.")]);
      return;
    }
    const offX = (vp.width - colSpan * pitchX) / 2;
    const offY = drawTop + (drawH - grid.rows * pitchY) / 2;

    const base = Math.min(pitchX, pitchY);
    const gap = base >= 6 ? Math.max(1, Math.floor(base * 0.08)) : 0;
    const showLabels = ms.showLabels.value;
    const showEmpty = ms.showEmptyCells.value;
    const fontSize = Math.min(Number(ms.labelFontSize.value) || 8, base * 0.4);
    const minLabel = Number(ms.labelMinTileSize.value) || 20;
    const labelContent = String(ms.labelContent.value || "auto");

    // Size (Pro): area proportional to the second measure, never below 30% of the tile.
    const useSize = this.allow("size") && this._hasSize;
    let sizeMax = 0;
    const sizeOf = new Map<string, number>();
    if (useSize) {
      this._buckets.forEach((b, k) => {
        const s = b.sizes.length ? this.aggregate(b.sizes, this._sizeAggType) : NaN;
        sizeOf.set(k, s);
        if (Math.abs(s) > sizeMax) sizeMax = Math.abs(s);
      });
    }
    const scaleFor = (key: string) => {
      if (!useSize) return 1;
      const s = sizeOf.get(key);
      if (s === undefined || isNaN(s) || sizeMax === 0) return 0.3;
      return 0.3 + 0.7 * Math.sqrt(Math.max(0, s) / sizeMax);
    };

    const baseStroke = this.isHC ? this.hcFg : (acc.showBorders.value ? (acc.borderColor.value?.value ?? "#cccccc") : "none");
    // El grosor elegido es un MÁXIMO (1.3): en teselas pequeñas el borde adelgaza con ellas (2 % del lado, nunca bajo
    // 0,15 px), para que no se coma el color. Tino, 22-11-2026: los hexágonos pequeños pesaban demasiado a 0,5.
    const swElegido = Math.max(0.1, Number(acc.borderWidth.value) || 0.5);
    const baseSw = this.isHC ? "0.5" : (acc.showBorders.value ? String(+Math.min(swElegido, Math.max(0.15, base * 0.02)).toFixed(2)) : "0");

    const ns = "http://www.w3.org/2000/svg";
    const rects = document.createElementNS(ns, "g");
    const labels = document.createElementNS(ns, "g");
    labels.setAttribute("data-o", "labels");
    const makeShape = (cx: number, cy: number, w: number, h: number, fill: string): SVGElement => {
      let el: SVGElement;
      if (shape === "circle") {
        el = document.createElementNS(ns, "circle");
        el.setAttribute("cx", cx.toFixed(1)); el.setAttribute("cy", cy.toFixed(1));
        el.setAttribute("r", (Math.min(w, h) / 2).toFixed(1));
      } else if (hex) {
        // Pointy-top hexagon inscribed in the tile.
        const R = Math.min(w / Math.sqrt(3), h / 1.5);
        const pts: string[] = [];
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 180 * (60 * i - 90);
          pts.push(`${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`);
        }
        el = document.createElementNS(ns, "polygon");
        el.setAttribute("points", pts.join(" "));
      } else {
        el = document.createElementNS(ns, "rect");
        el.setAttribute("x", (cx - w / 2).toFixed(1)); el.setAttribute("y", (cy - h / 2).toFixed(1));
        el.setAttribute("width", w.toFixed(1)); el.setAttribute("height", h.toFixed(1));
        el.setAttribute("rx", Math.max(0, Math.min(w, h) * 0.08).toFixed(1));
      }
      el.setAttribute("fill", fill);
      el.setAttribute("stroke", baseStroke); el.setAttribute("stroke-width", baseSw);
      return el;
    };

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!isInMask(col, row, grid)) continue;
        const key = `${col},${row}`;
        const b = this._buckets.get(key);
        if (!b && !showEmpty) continue;

        const cx = offX + (col + 0.5 + (hex && row % 2 === 1 ? 0.5 : 0)) * pitchX;
        const cy = offY + (row + 0.5) * pitchY;
        const fullW = pitchX - gap * 2;
        const fullH = pitchY - gap * 2;
        if (fullW < 1 || fullH < 1) continue;

        if (!b) {
          rects.appendChild(makeShape(cx, cy, fullW, fullH, noData));
          continue;
        }

        const k = scaleFor(key);
        const w = fullW * k;
        const h = fullH * k;
        const value = bucketVals.get(key) ?? null;
        const { color, opacity } = this.pointColor(value, b, model, noData);
        this._points.set(key, { key, bucket: b, value, color, opacity, name: "", cx, cy });
        this._orderedKeys.push(key);

        const el = makeShape(cx, cy, w, h, color);
        el.setAttribute("fill-opacity", opacity.toFixed(2));
        el.setAttribute("data-key", key);
        el.setAttribute("data-base-stroke", baseStroke);
        el.setAttribute("data-base-sw", baseSw);
        el.style.cursor = "pointer";
        rects.appendChild(el);

        const inner = Math.min(w, h) * (shape === "square" ? 1 : 0.8);
        if (showLabels && value !== null && inner >= minLabel * 0.5) {
          const textColor = this.isHC ? this.hcBg : this.contrastColor(color);
          const lineas = this.lineasEtiqueta(value, b.labels[0] ?? "", inner, minLabel, fontSize, labelContent);
          lineas.forEach(l => {
            const t = document.createElementNS(ns, "text");
            t.setAttribute("x", cx.toFixed(1)); t.setAttribute("y", (cy + l.dy).toFixed(1));
            t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "middle");
            t.setAttribute("font-size", l.fs.toFixed(1)); t.setAttribute("fill", textColor);
            t.setAttribute("font-weight", l.peso);
            t.style.pointerEvents = "none"; t.style.userSelect = "none";
            t.textContent = l.texto;
            labels.appendChild(t);
          });
        }
      }
    }

    rects.setAttribute("data-o", "tiles");
    this.svg.appendChild(rects);
    this.svg.appendChild(labels);

    if (this._buckets.size === 0) {
      this.renderCentredText(vp, [this.tf("UI_NoRowsInside", "No rows fall inside {0}.", grid.name), this.t("UI_CheckCountry", "Check the country and that Latitude and Longitude are not swapped.")]);
    }
    if (showLegend) {
      const legendY = legendTop ? 4 : vp.height - legendH - statusH;
      this.renderLegend(vp, model, legendY);
    }
    this.renderStatus(vp, status);
  }

  // ── Render: TopoJSON ───────────────────────────────────────────────────────
  private findFeature(lng: number, lat: number, features: TopoFeature[]): number {
    for (let fi = 0; fi < features.length; fi++) {
      const [x0, x1, y0, y1] = features[fi].bbox;
      if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
      if (this.pointInFeature(lng, lat, features[fi])) return fi;
    }
    return -1;
  }

  private renderTopo(features: TopoFeature[], vp: powerbi.IViewport): void {
    const type = this.aggType();
    const noData = this.noDataColor();

    const values: number[] = [];
    const vals = features.map((_, fi) => {
      const b = this._buckets.get(`t${fi}`);
      const v = b ? this.valorTesela(b, type) : null;
      if (v !== null) values.push(v);
      return v;
    });
    const model = this.buildColorModel(values);
    const showLegend = this.legendVisible(model) && values.length > 0;
    const status = this.statusLines();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of features) {
      if (f.bbox[0] < minX) minX = f.bbox[0];
      if (f.bbox[1] > maxX) maxX = f.bbox[1];
      if (f.bbox[2] < minY) minY = f.bbox[2];
      if (f.bbox[3] > maxY) maxY = f.bbox[3];
    }
    if (minX < -180.5 || maxX > 180.5 || minY < -90.5 || maxY > 90.5) {
      status.unshift(this.t("UI_Projected", "The TopoJSON uses projected coordinates; rows cannot be matched to its regions. Export it in longitude/latitude (WGS84)."));
    }

    const valsTopo = new Map<string, number | null>();
    features.forEach((_, fi) => { if (this._buckets.has(`t${fi}`)) valsTopo.set(`t${fi}`, vals[fi]); });
    this.calcularRango(model, valsTopo, noData, status);
    const legendH = showLegend ? this.legendHeight(model, vp.width) : 0;
    const statusH = Math.min(2, status.length) * 14;
    const legendTop = String(this.settings.legend.legendPosition.value) === "top";
    const pad = 12;
    const drawW = vp.width - pad * 2;
    const drawH = vp.height - pad * 2 - legendH - statusH;
    if (drawW < 10 || drawH < 10) { this.renderStatus(vp, status); return; }
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min(drawW / spanX, drawH / spanY);
    const offX = pad + (drawW - spanX * scale) / 2;
    const offY = pad + (legendTop ? legendH : 0) + (drawH - spanY * scale) / 2;
    const px = (x: number) => offX + (x - minX) * scale;
    const py = (y: number) => offY + (maxY - y) * scale;

    const strokeClr = this.isHC ? this.hcFg : "#ffffff";
    const frag = document.createElementNS("http://www.w3.org/2000/svg", "g");
    frag.setAttribute("data-o", "tiles");

    features.forEach((f, fi) => {
      const key = `t${fi}`;
      const b = this._buckets.get(key);
      const value = vals[fi];
      const { color, opacity } = b ? this.pointColor(value, b, model, noData) : { color: noData, opacity: 1 };

      let d = "";
      for (const poly of f.polygons) {
        for (const ring of poly) {
          if (ring.length < 3) continue;
          d += `M${px(ring[0][0]).toFixed(1)},${py(ring[0][1]).toFixed(1)}`;
          for (let i = 1; i < ring.length; i++) d += `L${px(ring[i][0]).toFixed(1)},${py(ring[i][1]).toFixed(1)}`;
          d += "Z";
        }
      }
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", color);
      path.setAttribute("fill-opacity", opacity.toFixed(2));
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("stroke", strokeClr);
      path.setAttribute("stroke-width", "0.5");
      path.setAttribute("data-base-stroke", strokeClr);
      path.setAttribute("data-base-sw", "0.5");
      if (b) {
        path.setAttribute("data-key", key);
        path.style.cursor = "pointer";
        const [x0, x1, y0, y1] = f.bbox;
        this._points.set(key, { key, bucket: b, value, color, opacity, name: f.name, cx: (px(x0) + px(x1)) / 2, cy: (py(y0) + py(y1)) / 2 });
        this._orderedKeys.push(key);
      }
      frag.appendChild(path);
    });
    this.svg.appendChild(frag);

    if (showLegend) this.renderLegend(vp, model, legendTop ? 4 : vp.height - legendH - statusH);
    this.renderStatus(vp, status);
  }

  // ── TopoJSON: persistence, decoding, geometry ─────────────────────────────
  private restorePersistedTopo(dataView: DataView): void {
    const saved = dataView.metadata?.objects?.["proSettings"];
    const content  = saved?.["topoJsonContent"]  as string | undefined;
    const fileName = saved?.["topoJsonFileName"] as string | undefined;
    if (!content || !fileName) return;
    const source = `${fileName}:${content.length}`;
    if (source === this._topoSource && this._topoFeatures) return;
    try {
      this._topoFeatures = this.decodeTopoJson(JSON.parse(content));
      this._topoSource = source;
      this._topoError = this._topoFeatures.length ? "" : this.tf("UI_TopoNoPolygons", "\"{0}\" contains no polygons.", fileName);
    } catch (_) {
      this._topoFeatures = null;
      this._topoError = this.tf("UI_TopoUnreadable", "\"{0}\" could not be read as TopoJSON.", fileName);
    }
  }

  private loadDroppedFile(file: File): void {
    if (file.size > MAX_TOPO_CHARS) {
      this._topoError = this.tf("UI_TopoTooBig", "\"{0}\" is {1} MB; the limit is 5 MB. Simplify it (e.g. mapshaper.org) and try again.", file.name, (file.size / 1048576).toLocaleString(this.locale, { maximumFractionDigits: 1 }));
      this.repaint();
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const content = String(ev.target?.result ?? "");
      try {
        const features = this.decodeTopoJson(JSON.parse(content));
        if (features.length === 0) throw new Error("no polygons");
        this._topoFeatures = features;
        this._topoSource = `${file.name}:${content.length}`;
        this._topoError = "";
        // Persist in the .pbix so the regions survive closing the report.
        this.host.persistProperties({
          merge: [{ objectName: "proSettings", selector: {}, properties: { topoJsonContent: content, topoJsonFileName: file.name } }],
        });
      } catch (_) {
        this._topoError = this.tf("UI_TopoNotTopo", "\"{0}\" is not a TopoJSON file with polygons.", file.name);
      }
      this.repaint();
    };
    reader.readAsText(file);
  }

  private decodeTopoJson(topo: any): TopoFeature[] {
    if (!topo || topo.type !== "Topology" || !topo.objects) return [];
    const tf = topo.transform as { scale: [number, number]; translate: [number, number] } | undefined;
    const rawArcs: number[][][] = Array.isArray(topo.arcs) ? topo.arcs : [];
    const arcs: [number, number][][] = rawArcs.map(rawArc => {
      let x = 0, y = 0;
      return rawArc.map(pt => {
        if (tf) { x += pt[0]; y += pt[1]; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]] as [number, number]; }
        return [pt[0], pt[1]] as [number, number];
      });
    });

    // The object with the most geometries is the region layer.
    const objects = Object.keys(topo.objects).map(k => topo.objects[k]).filter((o: any) => o);
    const count = (o: any) => o.type === "GeometryCollection" ? (o.geometries?.length ?? 0) : 1;
    objects.sort((a, b) => count(b) - count(a));
    const obj = objects[0];
    if (!obj) return [];
    const geometries: any[] = obj.type === "GeometryCollection" ? (obj.geometries ?? []) : [obj];

    const ring = (idxs: number[]): [number, number][] => {
      const pts: [number, number][] = [];
      for (const i of idxs ?? []) {
        const arc = i >= 0 ? arcs[i] : arcs[~i] ? [...arcs[~i]].reverse() : undefined;
        if (!arc) continue;
        pts.push(...(pts.length ? arc.slice(1) : arc));
      }
      return pts;
    };

    const features: TopoFeature[] = [];
    geometries.forEach((g, gi) => {
      if (!g || !Array.isArray(g.arcs)) return;
      const polys: number[][][] = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
      const polygons = polys.map(p => (p ?? []).map(ring).filter(r => r.length >= 3)).filter(p => p.length > 0);
      if (polygons.length === 0) return;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of polygons) for (const [x, y] of p[0]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const pr = g.properties ?? {};
      const name = String(pr.name ?? pr.NAME ?? pr.NAME_1 ?? pr.name_en ?? pr.NAME_EN ?? g.id ?? `Region ${gi + 1}`);
      features.push({ polygons, bbox: [x0, x1, y0, y1], name });
    });
    return features;
  }

  private pointInFeature(lng: number, lat: number, f: TopoFeature): boolean {
    for (const poly of f.polygons) {
      if (!this.pointInRing(lng, lat, poly[0])) continue;
      let inHole = false;
      for (let i = 1; i < poly.length; i++) if (this.pointInRing(lng, lat, poly[i])) { inHole = true; break; }
      if (!inHole) return true;
    }
    return false;
  }

  private pointInRing(px: number, py: number, ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ── Legend, status, empty states ──────────────────────────────────────────
  /** La leyenda entera en un grupo, para poder elegirla en el formato sobre el lienzo. */
  private renderLegend(vp: powerbi.IViewport, model: ColorModel, y: number): void {
    const antes = this.svg.childNodes.length;
    this.renderLegendPiezas(vp, model, y);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-o", "legend");
    Array.from(this.svg.childNodes).slice(antes).forEach(n => g.appendChild(n));
    this.svg.appendChild(g);
  }

  private renderLegendPiezas(vp: powerbi.IViewport, model: ColorModel, y: number): void {
    // Rules on, or categories: a gradient would not describe the tiles, so use swatches.
    const swatches = this.swatchItems(model);
    if (swatches) {
      this.renderSwatches(vp, swatches, y, model);
      return;
    }
    const ns = "http://www.w3.org/2000/svg";
    const gradW = Math.min(200, vp.width * 0.6);
    const x = (vp.width - gradW) / 2;
    const { color: lc, size: fs, family: ff } = this.legendFont();
    const p = this.fmtValor();
    const barH = this.legendBarH();
    const ty = y + 10 + barH + fs;

    if (model.classes) {
      const k = model.classes.length;
      const sw = gradW / k;
      model.classes.forEach((c, i) => {
        const r = document.createElementNS(ns, "rect");
        r.setAttribute("x", String(x + i * sw)); r.setAttribute("y", String(y + 6));
        r.setAttribute("width", String(Math.max(1, sw - 1))); r.setAttribute("height", String(barH));
        r.setAttribute("fill", c.color);
        this.hacerPulsable(r, c.color, model);
        this.svg.appendChild(r);
        // Break values under each boundary, when there is room for them.
        if (sw >= fs * 3.4 || i === 0) this.addText(this.formatValue(c.from, p), x + i * sw, ty, i === 0 ? "start" : "middle", lc, fs, ff);
      });
      this.addText(this.formatValue(model.max, p), x + gradW, ty, "end", lc, fs, ff);
      return;
    }
    if (!model.legendStops) return;

    const defs = document.createElementNS(ns, "defs");
    const grad = document.createElementNS(ns, "linearGradient");
    grad.setAttribute("id", this.idDegradado);
    for (const s of model.legendStops) {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", `${Math.round(s.value * 100)}%`);
      stop.setAttribute("stop-color", s.color);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
    this.svg.appendChild(defs);

    const bar = document.createElementNS(ns, "rect");
    bar.setAttribute("x", String(x)); bar.setAttribute("y", String(y + 6));
    bar.setAttribute("width", String(gradW)); bar.setAttribute("height", String(barH));
    bar.setAttribute("rx", "4"); bar.setAttribute("fill", `url(#${this.idDegradado})`);
    if (this.isHC) { bar.setAttribute("stroke", this.hcFg); bar.setAttribute("stroke-width", "1"); }
    this.svg.appendChild(bar);
    this.hacerArrastrable(bar, model, x, y + 6, gradW, barH);
    const lim = model.recortada ? ["≤ ", "≥ "] : ["", ""];
    this.addText(lim[0] + this.formatValue(model.min, p), x, ty, "start", lc, fs, ff);
    this.addText(lim[1] + this.formatValue(model.max, p), x + gradW, ty, "end", lc, fs, ff);
    if (model.kind === "diverging" && model.min < 0 && model.max > 0) this.addText(this.formatValue(0, p), x + gradW / 2, ty, "middle", lc, fs, ff);
  }

  /**
   * TRAMO DE LA LEYENDA (1.3, la mejora propia del mapa; la barra de rango del Histogram llevada al mapa). Clic en una
   * clase, regla o categoría de la leyenda, o arrastre sobre el degradado: el mapa deja a pleno color solo las teselas
   * de ese tramo y dice cuántas son y qué parte del total suman. Otro clic en lo mismo, o un clic sin arrastrar en el
   * degradado, lo quita. Es solo del visual: no filtra el informe ni se guarda.
   */
  private calcularRango(model: ColorModel, valores: Map<string, number | null>, noData: string, status: string[]): void {
    this._enRango = null;
    if (!this._rango) return;
    const clave = `${model.kind}|${this.settings.conditionalFormatting.cfEnabled.value}`;
    if (this._rangoKind !== clave) { this._rango = null; return; }   // cambió la escala: el tramo ya no significa nada
    const r = this._rango;
    const dentro = new Set<string>();
    let total = 0, suma = 0, n = 0;
    valores.forEach((v, k) => {
      if (v === null) return;
      n++;
      const b = this._buckets.get(k);
      const real = b ? this.bucketValue(b, this.aggType()) : null;
      if (real !== null) total += real;
      const ok = "color" in r
        ? (b ? this.pointColor(v, b, model, noData).color.toLowerCase() === r.color.toLowerCase() : false)
        : v >= r.lo && v <= r.hi;
      if (ok) { dentro.add(k); if (real !== null) suma += real; }
    });
    this._enRango = dentro;
    const nf = (x: number) => x.toLocaleString(this.locale);
    const aditivo = this.aggType() === "sum" || this.aggType() === "count";
    status.unshift(aditivo && total > 0 && suma >= 0
      ? this.tf("UI_RangeSummary", "{0} of {1} tiles in the range · {2} of the total", nf(dentro.size), nf(n), (suma / total).toLocaleString(this.locale, { style: "percent", maximumFractionDigits: 0 }))
      : this.tf("UI_RangeSummaryN", "{0} of {1} tiles in the range", nf(dentro.size), nf(n)));
  }

  /** ¿Se puede tocar la leyenda? Ni en modo formato ni donde Power BI prohíbe interactuar. */
  private leyendaInteractiva(): boolean {
    return !this.formatMode && !!this.host.hostCapabilities.allowInteractions;
  }

  /** Clase, regla o categoría de la leyenda que se puede pulsar para quedarse con su tramo. */
  private hacerPulsable(el: SVGElement, color: string, model: ColorModel): void {
    if (!this.leyendaInteractiva()) return;
    const elegido = !!this._rango && "color" in this._rango && this._rango.color.toLowerCase() === color.toLowerCase();
    if (this._rango && !elegido) el.style.opacity = "0.35";
    el.style.cursor = "pointer";
    el.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      this._rango = elegido ? null : { color };
      this._rangoKind = `${model.kind}|${this.settings.conditionalFormatting.cfEnabled.value}`;
      this.repaint();
    });
  }

  /** Arrastre sobre el degradado: tramo de valores. Un clic sin arrastrar quita el tramo. */
  private hacerArrastrable(bar: SVGRectElement, model: ColorModel, x: number, y: number, w: number, h: number): void {
    const ns = "http://www.w3.org/2000/svg";
    const lc = this.legendFont().color;
    const aValor = (t: number) => {
      t = Math.max(0, Math.min(1, t));
      if (model.kind === "diverging" && model.min < 0 && model.max > 0) return t < 0.5 ? model.min + (t / 0.5) * (0 - model.min) : ((t - 0.5) / 0.5) * model.max;
      return model.min + t * (model.max - model.min);
    };
    const aT = (v: number) => {
      if (model.kind === "diverging" && model.min < 0 && model.max > 0) return normaliseDiverging(Math.max(model.min, Math.min(model.max, v)), model.min, model.max);
      return model.max === model.min ? 0 : Math.max(0, Math.min(1, (v - model.min) / (model.max - model.min)));
    };
    const banda = document.createElementNS(ns, "rect");
    banda.setAttribute("y", String(y - 2)); banda.setAttribute("height", String(h + 4)); banda.setAttribute("rx", "3");
    banda.setAttribute("fill", "none"); banda.setAttribute("stroke", lc); banda.setAttribute("stroke-width", "1.5");
    banda.style.pointerEvents = "none";
    const ponBanda = (t0: number, t1: number) => {
      const a = Math.min(t0, t1), b = Math.max(t0, t1);
      banda.setAttribute("x", String(x + a * w)); banda.setAttribute("width", String(Math.max(2, (b - a) * w)));
    };
    if (this._rango && "lo" in this._rango) {
      ponBanda(aT(this._rango.lo), aT(this._rango.hi));
      this.svg.appendChild(banda);
    }
    if (!this.leyendaInteractiva()) return;
    bar.style.cursor = "ew-resize";
    bar.addEventListener("click", (e: MouseEvent) => e.stopPropagation());
    bar.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const caja = bar.getBoundingClientRect();
      const tDe = (cx: number) => caja.width > 0 ? Math.max(0, Math.min(1, (cx - caja.left) / caja.width)) : 0;
      const t0 = tDe(e.clientX);
      let t1 = t0;
      if (!banda.parentNode) bar.parentNode?.appendChild(banda);
      ponBanda(t0, t1);
      const mover = (ev: MouseEvent) => { t1 = tDe(ev.clientX); ponBanda(t0, t1); };
      const soltar = () => {
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
        if (Math.abs(t1 - t0) * caja.width < 3) this._rango = null;
        else {
          // Llegar al borde de la barra es "y todo lo que hay más allá": con la escala recortada (objetivo) hay teselas
          // saturadas fuera de min/max que si no se quedarían fuera del tramo.
          const a = Math.min(t0, t1), z = Math.max(t0, t1);
          this._rango = { lo: a <= 0.01 ? -Infinity : aValor(a), hi: z >= 0.99 ? Infinity : aValor(z) };
        }
        this._rangoKind = `${model.kind}|${this.settings.conditionalFormatting.cfEnabled.value}`;
        this.repaint();
      };
      window.addEventListener("mousemove", mover);
      window.addEventListener("mouseup", soltar);
    });
  }

  /** Swatch legend entries — colour rules when on, else categories — or null for a gradient. */
  private swatchItems(model: ColorModel): { color: string; text: string }[] | null {
    if (this.settings.conditionalFormatting.cfEnabled.value && !this.isHC) return this.ruleItems(model);
    return model.categories ?? null;
  }

  /** Swatches wrapped into at most two centred rows; long names are shortened. */
  private layoutSwatches(items: { color: string; text: string }[], width: number): { color: string; text: string; w: number }[][] {
    const fs = this.legendFont().size;
    const sw = Math.max(8, fs);
    const rows: { color: string; text: string; w: number }[][] = [[]];
    let rowW = 0;
    for (const it of items) {
      const text = it.text.length > 18 ? it.text.slice(0, 17) + "…" : it.text;
      const w = sw + 4 + text.length * fs * 0.6 + 14;
      if (rowW + w > width - 8 && rows[rows.length - 1].length > 0) {
        if (rows.length === 2) break;
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push({ color: it.color, text, w });
      rowW += w;
    }
    return rows;
  }

  private legendHeight(model: ColorModel, width: number): number {
    const fs = this.legendFont().size;
    const swatches = this.swatchItems(model);
    if (!swatches) return 14 + this.legendBarH() + fs;
    return 10 + this.layoutSwatches(swatches, width).length * (Math.max(8, fs) + 8);
  }

  private renderSwatches(vp: powerbi.IViewport, items: { color: string; text: string }[], y: number, model: ColorModel): void {
    if (items.length === 0) return;
    const { color: lc, size: fs, family: ff } = this.legendFont();
    const ns = "http://www.w3.org/2000/svg";
    const sw = Math.max(8, fs);
    this.layoutSwatches(items, vp.width).forEach((row, ri) => {
      const total = row.reduce((a, it) => a + it.w, 0);
      let x = Math.max(4, (vp.width - total) / 2);
      const cy = y + 6 + sw / 2 + ri * (sw + 8);
      for (const it of row) {
        const r = document.createElementNS(ns, "rect");
        r.setAttribute("x", String(x)); r.setAttribute("y", String(cy - sw / 2));
        r.setAttribute("width", String(sw)); r.setAttribute("height", String(sw));
        r.setAttribute("rx", "2"); r.setAttribute("fill", it.color);
        this.hacerPulsable(r, it.color, model);
        this.svg.appendChild(r);
        this.addText(it.text, x + sw + 4, cy + fs * 0.35, "start", lc, fs, ff);
        x += it.w;
      }
    });
  }

  /** Category with most rows in a tile (ties broken by name), or null without one. */
  private majorityCategory(b: Bucket): string | null {
    let best: string | null = null, bestN = -1;
    b.cats.forEach((n, c) => { if (n > bestN || (n === bestN && best !== null && c < best)) { best = c; bestN = n; } });
    return best;
  }

  /** One entry per active colour rule, plus "Other" for tiles no rule matched. */
  private ruleItems(model: ColorModel): { color: string; text: string }[] {
    const cf = this.settings.conditionalFormatting;
    const num = (x: unknown) => (x === null || x === undefined || x === "") ? NaN : Number(x);
    // Thresholds are typed as shown (25 for 25%); formatValue expects the raw value.
    const shown = (t: number) => this.formatValue(this.umbralEnPorcentaje() ? t / 100 : t, this.fmtValor());
    const sym: Record<string, string> = { lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=" };

    const items: { color: string; text: string }[] = [];
    const t1 = num(cf.cfRule1Value.value);
    if (cf.cfRule1Color.value?.value && !isNaN(t1)) items.push({ color: cf.cfRule1Color.value.value, text: `${sym[String(cf.cfRule1Operator.value)] ?? ""} ${shown(t1)}` });
    const lo = num(cf.cfRule2MinValue.value), hi = num(cf.cfRule2MaxValue.value);
    if (cf.cfRule2Color.value?.value && !isNaN(lo) && !isNaN(hi)) items.push({ color: cf.cfRule2Color.value.value, text: `${shown(lo)} – ${shown(hi)}` });
    const t3 = num(cf.cfRule3Value.value);
    if (cf.cfRule3Color.value?.value && !isNaN(t3)) items.push({ color: cf.cfRule3Color.value.value, text: `${sym[String(cf.cfRule3Operator.value)] ?? ""} ${shown(t3)}` });

    const other = model.classes ? model.classes[Math.floor(model.classes.length / 2)].color
      : model.legendStops ? buildStopScale(model.legendStops)(0.5) : null;
    if (other) items.push({ color: other, text: this.t("UI_Other", "Other") });
    return items;
  }

  /** Alto de la barra de la leyenda: 12 px, y menos con el visual pequeño. */
  private legendBarH(): number { return Math.max(8, Math.round(12 * this.scale)); }

  /** Legend text style from the format pane; high contrast keeps the theme foreground. */
  private legendFont(): { color: string; size: number; family: string } {
    const lg = this.settings.legend;
    const size = Number(lg.fontSize.value);
    return {
      color: this.isHC ? this.hcFg : (lg.fontColor.value?.value ?? "#555555"),
      size: this.fz(Number.isFinite(size) ? Math.max(8, Math.min(24, size)) : 10),
      family: String(lg.fontFamily.value || "Segoe UI, sans-serif"),
    };
  }

  /**
   * "Pro preview" sobre el lienzo y las funciones que lo han encendido: la PIEZA COMÚN de la cartera (src/comun, 1.3),
   * la misma en todos los visuales. Antes era un SVG propio girado, hueco y grande que tapaba el mapa. Solo editando
   * sin licencia y con alguna función Pro en uso; nunca sobre la pantalla de inicio.
   */
  private renderWatermark(vp: powerbi.IViewport): void {
    const ver = this.proPreview && this.attemptedLabels.length > 0 && !!this._lastOptions?.dataViews?.[0]?.table;
    renderProWatermark(this.wm, ver ? {
      width: vp.width, height: vp.height, title: this.t("UI_ProPreview", "Pro preview"), features: this.attemptedLabels,
      highContrast: this.isHC ? { foreground: this.hcFg, background: this.hcBg } : null,
    } : null);
  }

  /** Texto por clave: primero la tabla del bundle (Desktop no traduce claves que no estén en capabilities). */
  private t(key: string, fallback: string): string {
    const loc = String(this.host?.locale || "");
    const tabla = STRINGS[loc] || STRINGS[Object.keys(STRINGS).find(l => l.slice(0, 2) === loc.slice(0, 2)) || ""];
    if (tabla && tabla[key]) return tabla[key];
    try {
      const s = this.localizationManager?.getDisplayName(key);
      return s && s !== key ? s : fallback;
    } catch { return fallback; }
  }

  /** Plantillas con "{0}", "{1}"… */
  private tf(key: string, fallback: string, ...args: string[]): string {
    return this.t(key, fallback).replace(/\{(\d+)\}/g, (_m, i) => args[Number(i)] ?? "");
  }

  private renderStatus(vp: powerbi.IViewport, lines: string[]): void {
    const color = this.isHC ? this.hcFg : "#777";
    lines.slice(0, 2).forEach((line, i, arr) => {
      this.addText(line, vp.width / 2, vp.height - 4 - (arr.length - 1 - i) * this.fz(14), "middle", color, this.fz(10));
    });
  }

  private renderCentredText(vp: powerbi.IViewport, lines: string[]): void {
    const color = this.isHC ? this.hcFg : "#666";
    lines.forEach((line, i) => this.addText(line, vp.width / 2, vp.height / 2 + i * this.fz(16), "middle", color, this.fz(i === 0 ? 12 : 10)));
  }

  private addText(text: string, x: number, y: number, anchor: string, color: string, size: number, family?: string): void {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    if (family) t.setAttribute("font-family", family);
    t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
    t.setAttribute("text-anchor", anchor); t.setAttribute("font-size", String(size));
    t.setAttribute("fill", color); t.style.pointerEvents = "none";
    t.textContent = text;
    this.svg.appendChild(t);
  }

  private renderDropZone(vp: powerbi.IViewport): void {
    const ns = "http://www.w3.org/2000/svg";
    const accent = this.isHC ? this.hcFg : "#2980b9";
    const fg = this.isHC ? this.hcFg : "#555";
    const zoneW = Math.max(60, Math.min(vp.width - 40, 280));
    const zx = (vp.width - zoneW) / 2, zy = vp.height / 2 - 50;
    const zone = document.createElementNS(ns, "rect");
    zone.setAttribute("x", String(zx)); zone.setAttribute("y", String(zy));
    zone.setAttribute("width", String(zoneW)); zone.setAttribute("height", "100");
    zone.setAttribute("rx", "8"); zone.setAttribute("fill", "none");
    zone.setAttribute("stroke", accent); zone.setAttribute("stroke-width", "2"); zone.setAttribute("stroke-dasharray", "6 4");
    this.svg.appendChild(zone);
    this.addText(this.t("UI_DropHere", "Drag & drop a TopoJSON file here"), vp.width / 2, zy + 44, "middle", fg, this.fz(11));
    this.addText(this.t("UI_DropHint", ".json / .topojson in longitude/latitude, up to 5 MB"), vp.width / 2, zy + 62, "middle", fg, this.fz(9));
    this.renderStatus(vp, this.statusLines());
  }

  private renderLandingPage(vp: powerbi.IViewport): void {
    const ns = "http://www.w3.org/2000/svg";
    const accent = this.isHC ? this.hcFg : "#2980b9";
    const fg = this.isHC ? this.hcFg : "#666";
    const blues = ["#d0e4f7", "#5b9bd5", "#1a5276"];
    const s = 12, g = 2, ox = (vp.width - (5 * s + 4 * g)) / 2, oy = vp.height / 2 - (4 * s + 3 * g) - 16;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const r = document.createElementNS(ns, "rect");
        r.setAttribute("x", String(ox + col * (s + g))); r.setAttribute("y", String(oy + row * (s + g)));
        r.setAttribute("width", String(s)); r.setAttribute("height", String(s)); r.setAttribute("rx", "2");
        r.setAttribute("fill", this.isHC ? this.hcFg : blues[(row * 5 + col * 7) % 3]);
        this.svg.appendChild(r);
      }
    }
    this.addText("Tile Grid Map Pro", vp.width / 2, vp.height / 2 + 4, "middle", accent, this.fz(14));
    this.addText(this.t("UI_Landing", "Add Latitude and Longitude fields to start."), vp.width / 2, vp.height / 2 + 4 + this.fz(18), "middle", fg, this.fz(11));
  }

  // ── Interaction ───────────────────────────────────────────────────────────
  private keyFromEvent(e: Event): string {
    const el = (e.target as Element)?.closest?.("[data-key]");
    return el?.getAttribute("data-key") ?? "";
  }

  private bindPointerEvents(): void {
    this.svg.addEventListener("click", (e: MouseEvent) => {
      if (this.formatMode || !this.host.hostCapabilities.allowInteractions) return;   // en modo formato el clic elige qué formatear
      const key = this.keyFromEvent(e);
      if (key) {
        e.stopPropagation();
        this._focusKey = key;
        this.selectPoint(key, e.ctrlKey || e.metaKey);
      } else {
        this.clearSelection();
      }
    });

    this.svg.addEventListener("contextmenu", (e: MouseEvent) => {
      if (this.formatMode || !this.host.hostCapabilities.allowInteractions) return;   // en modo formato el clic elige qué formatear
      e.preventDefault();
      const p = this._points.get(this.keyFromEvent(e));
      this.selectionManager.showContextMenu(p?.bucket.selIds[0] ?? ({} as ISelectionId), { x: e.clientX, y: e.clientY });
    });

    let lastKey = "";
    this.svg.addEventListener("mousemove", (e: MouseEvent) => {
      const p = this.formatMode ? undefined : this._points.get(this.keyFromEvent(e));   // en modo formato, sin tooltip
      if (!p) {
        if (lastKey) { this.tooltipSvc.hide({ immediately: false, isTouchEvent: false }); lastKey = ""; }
        return;
      }
      const args = { coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: this.tooltipItems(p), identities: p.bucket.selIds };
      if (p.key !== lastKey) { this.tooltipSvc.show(args); lastKey = p.key; }
      else this.tooltipSvc.move(args);
    });

    this.svg.addEventListener("mouseleave", () => {
      this.tooltipSvc.hide({ immediately: false, isTouchEvent: false });
      lastKey = "";
    });
  }

  private bindKeyboard(): void {
    this.container.addEventListener("keydown", (e: KeyboardEvent) => {
      if (this._orderedKeys.length === 0) return;
      const keys = this._orderedKeys;
      let idx = keys.indexOf(this._focusKey);

      const move = (to: number) => {
        e.preventDefault();
        this._focusKey = keys[Math.max(0, Math.min(keys.length - 1, to))];
        this.applySelectionStyles();
        this.announceFocus();
      };

      switch (e.key) {
        case "ArrowRight": return move(idx < 0 ? 0 : idx + 1);
        case "ArrowLeft":  return move(idx < 0 ? 0 : idx - 1);
        case "ArrowDown":
        case "ArrowUp": {
          if (idx < 0) return move(0);
          const cur = this._points.get(keys[idx])!;
          const dir = e.key === "ArrowDown" ? 1 : -1;
          let best = -1, bestD = Infinity;
          keys.forEach((k, i) => {
            const p = this._points.get(k)!;
            const dy = (p.cy - cur.cy) * dir;
            if (dy <= 0.5) return;
            const d = dy * dy * 4 + (p.cx - cur.cx) * (p.cx - cur.cx);
            if (d < bestD) { bestD = d; best = i; }
          });
          return best >= 0 ? move(best) : undefined;
        }
        case "Enter":
        case " ":
          if (idx < 0 || this.formatMode || !this.host.hostCapabilities.allowInteractions) return;
          e.preventDefault();
          this.selectPoint(keys[idx], e.ctrlKey || e.metaKey);
          return;
        case "Escape":
          e.preventDefault();
          if (this.formatMode || !this.host.hostCapabilities.allowInteractions) return;   // como Enter y Shift+F10
          this.clearSelection();
          return;
        case "ContextMenu":
        case "F10": {
          if (e.key === "F10" && !e.shiftKey) return;
          if (idx < 0 || this.formatMode || !this.host.hostCapabilities.allowInteractions) return;
          e.preventDefault();
          const p = this._points.get(keys[idx])!;
          const r = this.svg.getBoundingClientRect();
          this.selectionManager.showContextMenu(p.bucket.selIds[0], { x: r.left + p.cx, y: r.top + p.cy });
          return;
        }
      }
    });
    this.container.addEventListener("blur", () => { this._focusKey = ""; this.applySelectionStyles(); });
  }

  private announceFocus(): void {
    const p = this._points.get(this._focusKey);
    if (!p) return;
    const name = p.name || p.bucket.labels.slice(0, 3).join(", ") || this.t("UI_Cell", "Cell");
    const value = p.value === null ? this.t("UI_NoValueLc", "no value") : this.formatValue(p.value, this.fmtValor());
    this.container.setAttribute("aria-label", this.tf("UI_AriaPoint", "{0}: {1}, {2} rows", name, value, String(p.bucket.rowCount)));
  }

  private bindDrop(): void {
    const canDrop = () => this.allow("custom") && String(this.settings.mapSettings.country.value) === "custom"
      && this.host.hostCapabilities.allowInteractions && !this.formatMode;
    this.container.addEventListener("dragover", (e: DragEvent) => {
      if (!canDrop()) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      this.container.style.outline = "2px dashed #2980b9";
    });
    this.container.addEventListener("dragleave", () => { this.container.style.outline = ""; });
    this.container.addEventListener("drop", (e: DragEvent) => {
      this.container.style.outline = "";
      if (!canDrop()) return;
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) this.loadDroppedFile(file);
    });
  }

  private selectPoint(key: string, multi: boolean): void {
    const p = this._points.get(key);
    if (!p) return;
    if (!multi && this._selectedKeys.size === 1 && this._selectedKeys.has(key)) {
      this.clearSelection();
      return;
    }
    this.selectionManager.select(p.bucket.selIds, multi).then(() => {
      if (!multi) this._selectedKeys.clear();
      if (multi && this._selectedKeys.has(key)) this._selectedKeys.delete(key);
      else this._selectedKeys.add(key);
      if (!this.selectionManager.hasSelection()) this._selectedKeys.clear();
      this.applySelectionStyles();
    });
  }

  private clearSelection(): void {
    this.selectionManager.clear().then(() => {
      this._selectedKeys.clear();
      this.applySelectionStyles();
    });
  }

  /** Mirror a selection set from outside (bookmarks, other visuals) onto the points. */
  private syncSelectionFrom(ids: ISelectionId[]): void {
    this._selectedKeys.clear();
    if (!ids || ids.length === 0) return;
    let work = 0;
    this._points.forEach(p => { work += p.bucket.selIds.length; });
    if (work * ids.length > 5e6) return; // too large to match; show unselected rather than hang
    this._points.forEach(p => {
      if (p.bucket.selIds.some(s => ids.some(i => i.equals(s)))) this._selectedKeys.add(p.key);
    });
  }

  private applySelectionStyles(): void {
    if (!this.svg) return;
    const has = this._selectedKeys.size > 0;
    const ring = this.settings.accessibility.selectedRingColor.value?.value ?? "#2980b9";
    const ringW = String(Number(this.settings.accessibility.selectedRingWidth.value) || 2);
    this.svg.querySelectorAll("[data-key]").forEach(node => {
      const el = node as SVGElement;
      const key = el.getAttribute("data-key") ?? "";
      const selected = this._selectedKeys.has(key);
      const focused = key === this._focusKey && document.activeElement === this.container;
      const atenuada = has ? !selected
        : this._enRango ? !this._enRango.has(key)
        : (this._hayResaltado && !this._points.get(key)?.bucket.hl);
      el.style.opacity = atenuada ? "0.3" : "1";
      if (selected || focused) {
        el.setAttribute("stroke", this.isHC ? this.hcFg : ring);
        el.setAttribute("stroke-width", focused && !selected ? String(Math.max(1.5, Number(ringW) - 0.5)) : ringW);
        el.setAttribute("stroke-dasharray", focused && !selected ? "3 2" : "");
      } else {
        el.setAttribute("stroke", el.getAttribute("data-base-stroke") ?? "none");
        el.setAttribute("stroke-width", el.getAttribute("data-base-sw") ?? "0");
        el.removeAttribute("stroke-dasharray");
      }
    });
  }

  // ── Tooltips ──────────────────────────────────────────────────────────────
  private tooltipItems(p: Point): VisualTooltipDataItem[] {
    const b = p.bucket;
    const type = this.aggType();
    const aggLabels: Record<string, string> = { sum: this.t("UI_TtSum", "Sum"), average: this.t("UI_TtAverage", "Average"), count: this.t("UI_TtCount", "Count"), min: this.t("UI_TtMin", "Min"), max: this.t("UI_TtMax", "Max") };
    const items: VisualTooltipDataItem[] = [];

    if (p.name) items.push({ displayName: this.t("UI_TtRegion", "Region"), value: p.name });
    if (b.labels.length > 0) {
      const extra = b.labels.length > 3 ? " " + this.tf("UI_TtMore", "(+{0} more)", String(b.labels.length - 3)) : "";
      items.push({ displayName: this.t("UI_TtLocation", "Location"), value: b.labels.slice(0, 3).join(", ") + extra });
    }
    if (this.modoObjetivo()) {
      const real = this.bucketValue(b, type);
      const obj = this.objetivoTesela(b);
      const fReal = type === "count" ? null : this._valueFmt;
      items.push({ displayName: aggLabels[type] ?? this.t("UI_TtValue", "Value"), value: real === null ? this.t("UI_TtNoValue", "No value") : this.formatValue(real, fReal) });
      items.push({ displayName: this.t("UI_TtTarget", "Target"), value: Number.isFinite(obj) ? this.formatValue(obj, this._targetFmt) : this.t("UI_TtNoValue", "No value") });
      items.push({ displayName: this.t("UI_TtVariance", "Variance vs target"), value: p.value === null ? "—" : this.formatValue(p.value, FMT_DESVIACION) });
    } else {
      items.push({ displayName: aggLabels[type] ?? this.t("UI_TtValue", "Value"), value: p.value === null ? this.t("UI_TtNoValue", "No value") : this.formatValue(p.value, this.fmtValor()) });
    }
    if (this._hasSize && b.sizes.length > 0) {
      items.push({ displayName: this.t("UI_TtSize", "Size"), value: this.formatValue(this.aggregate(b.sizes, this._sizeAggType), this._sizeFmt) });
    }
    if (this._hasCategory && b.cats.size > 0) {
      const main = this.majorityCategory(b);
      const extra = b.cats.size > 1 ? " " + this.tf("UI_TtMore", "(+{0} more)", String(b.cats.size - 1)) : "";
      items.push({ displayName: this.t("UI_TtCategory", "Category"), value: `${main}${extra}` });
    }
    if (this.settings.conditionalFormatting.cfEnabled.value && !this.isHC && p.value !== null) {
      // Says which rule coloured the tile, so a rule that never matches is visible.
      const m = this.matchedRule(p.value);
      items.push({ displayName: this.t("UI_TtRule", "Colour rule"), value: m ? this.tf("UI_TtRuleN", "Rule {0}", String(m.rule)) : this.t("UI_TtRuleNone", "None (scale colour)") });
    }
    items.push({ displayName: this.t("UI_TtRows", "Rows"), value: b.values.length < b.rowCount && type !== "count" ? this.tf("UI_TtRowsWith", "{0} ({1} with a value)", String(b.rowCount), String(b.values.length)) : String(b.rowCount) });

    if (!p.name && this.grid) {
      const g = this.grid;
      const lat = g.bbox.maxLat - (b.row + 0.5) * g.bbox.cell_h;
      const lng = g.bbox.minLng + (b.col + 0.5) * g.bbox.cell_w;
      items.push({ displayName: this.t("UI_TtCentre", "Cell centre"), value: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°` });
    }
    b.tooltips.forEach((td, name) => {
      const v = td.nums.length > 0 ? this.formatValue(this.aggregate(td.nums, td.aggType), td.aggType === "count" ? null : td.fmt) : td.firstText;
      items.push({ displayName: name, value: v });
    });
    return items;
  }

  // ── Formatting helpers ────────────────────────────────────────────────────
  /** Formato del valor de las teselas: el de la medida, salvo si la tesela cuenta filas (un recuento no es dinero). */
  private fmtValor(): string | null | undefined {
    if (this.modoObjetivo()) return FMT_DESVIACION;
    return this.aggType() === "count" ? null : this._valueFmt;
  }

  /**
   * FORMATO NATIVO (1.3, obligatorio en la cartera): la cadena de formato de la medida en el modelo y el idioma del
   * informe, como los visuales nativos. Antes se miraba solo si llevaba "%" y se pintaba con K/M propios: se perdían
   * moneda, separadores y decimales del modelo. Unidades automáticas (K, M, bn) salvo en porcentajes, que nunca se
   * escalan (0,3 con Miles daba "0.03K%"). Los decimales del panel solo mandan si el usuario los tocó; si no, los del
   * formato de la medida. fmt null: recuento, entero sin formato.
   */
  private formatValue(v: number | null, fmt: string | null | undefined): string {
    if (v === null || !Number.isFinite(v)) return "—";
    const objs = (this._lastOptions?.dataViews?.[0]?.metadata?.objects ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const decTocado = objs.mapSettings?.tooltipDecimals !== undefined;
    const rawDec = Number(this.settings.mapSettings.tooltipDecimals.value);
    const dec = Number.isFinite(rawDec) ? Math.max(0, Math.min(6, Math.round(rawDec))) : 2;
    const formato = fmt === null ? "#,0" : fmt;
    const pct = esPorcentaje(formato);
    const opts: Record<string, unknown> = { format: formato, cultureSelector: this.locale, displayUnitSystemType: 2 };
    if (!pct && fmt !== null) opts.value = Math.abs(v);
    if (decTocado && fmt !== null) {
      opts.precision = dec;
      if (opts.value === undefined) opts.value = 0;   // precision solo se aplica con value
    }
    const clave = JSON.stringify([opts.format, opts.precision, opts.value === undefined ? "-" : Math.floor(Math.log10(Math.max(1, opts.value as number)) / 3)]);
    try {
      let f = this.fmtCache.get(clave);
      if (!f) { f = valueFormatter.create(opts as valueFormatter.ValueFormatterOptions); this.fmtCache.set(clave, f); }
      return f.format(v);
    } catch (_) {
      return v.toLocaleString(this.locale, { maximumFractionDigits: dec });
    }
  }
  private fmtCache = new Map<string, valueFormatter.IValueFormatter>();

  private contrastColor(hex: string): string {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#333333" : "#ffffff";
  }

  // ── Conditional Formatting ─────────────────────────────────────────────────
  private applyConditionalFormatting(value: number): string | null {
    return this.matchedRule(value)?.color ?? null;
  }

  /** The first colour rule a value meets (checked 1 → 2 → 3), or null. */
  private matchedRule(value: number): { color: string; rule: number } | null {
    const cf = this.settings.conditionalFormatting;
    if (!cf.cfEnabled.value) return null;
    // Thresholds are typed as the user reads the value: 25 for a field shown as 25%.
    if (this.umbralEnPorcentaje()) value = value * 100;
    const num = (x: unknown) => (x === null || x === undefined || x === "") ? NaN : Number(x);
    const test = (op: string, threshold: number, v: number): boolean =>
      !isNaN(threshold) && (
        (op === "lt" && v < threshold) || (op === "lte" && v <= threshold) ||
        (op === "gt" && v > threshold) || (op === "gte" && v >= threshold) ||
        (op === "eq" && v === threshold));

    const c1 = cf.cfRule1Color.value?.value ?? "";
    if (c1 && test(String(cf.cfRule1Operator.value), num(cf.cfRule1Value.value), value)) return { color: c1, rule: 1 };
    const c2 = cf.cfRule2Color.value?.value ?? "";
    const lo = num(cf.cfRule2MinValue.value), hi = num(cf.cfRule2MaxValue.value);
    if (c2 && !isNaN(lo) && !isNaN(hi) && value >= lo && value <= hi) return { color: c2, rule: 2 };
    const c3 = cf.cfRule3Color.value?.value ?? "";
    if (c3 && test(String(cf.cfRule3Operator.value), num(cf.cfRule3Value.value), value)) return { color: c3, rule: 3 };
    return null;
  }

  // ── Formato sobre el lienzo (1.3) ────────────────────────────────────────────

  /** Pieza → [tarjeta, clave del nombre, nombre en inglés]. */
  private static readonly SUB: Record<string, [string, string, string]> = {
    tiles:  ["mapSettings", "Visual_MapSettings", "Map Settings"],
    labels: ["mapSettings", "Visual_MapSettings", "Map Settings"],
    legend: ["legend", "Visual_Legend", "Legend"],
  };

  /** Marca lo que se puede elegir en modo formato. Fuera de él, no deja rastro. */
  private marcarSubseleccionables(): void {
    this.svg.querySelectorAll("[data-o]").forEach(nodo => {
      const el = nodo as SVGElement;
      const o = el.getAttribute("data-o") ?? "";
      const info = Visual.SUB[o];
      if (o === "labels") el.style.pointerEvents = this.formatMode ? "auto" : "";
      if (o === "labels") el.querySelectorAll("text").forEach(t => { (t as SVGElement).style.pointerEvents = this.formatMode ? "auto" : "none"; });
      if (!this.formatMode || !info) { el.classList.remove(HtmlSubSelectableClass); return; }
      el.classList.add(HtmlSubSelectableClass);
      el.setAttribute(SubSelectableObjectNameAttribute, o);
      el.setAttribute(SubSelectableDisplayNameAttribute, o === "labels" ? this.t("Visual_ShowLabels", "Show Cell Labels") : this.t(info[1], info[2]));
      el.setAttribute(SubSelectableTypeAttribute, String(o === "tiles"
        ? powerbi.visuals.SubSelectionStylesType.Shape : powerbi.visuals.SubSelectionStylesType.Text));
    });
  }

  private getSubSelectionStyles(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
    const o = subs[0]?.customVisualObjects[0]?.objectName;
    const ref = (obj: string, prop: string, key: string, def: string) => ({ reference: { objectName: obj, propertyName: prop }, label: this.t(key, def) });
    const Shape = powerbi.visuals.SubSelectionStylesType.Shape, Text = powerbi.visuals.SubSelectionStylesType.Text;
    switch (o) {
      case "tiles": return { type: Shape, fill: ref("colorScale", "noDataColor", "Visual_NoDataColor", "No Data Color"),
        stroke: ref("accessibility", "borderColor", "Visual_BorderColor", "Border Color") } as powerbi.visuals.SubSelectionStyles;
      case "labels": return { type: Text, fontSize: ref("mapSettings", "labelFontSize", "Visual_LabelFontSize", "Label Font Size") } as powerbi.visuals.SubSelectionStyles;
      case "legend": return { type: Text, fontSize: ref("legend", "fontSize", "Visual_TextSize", "Text Size"),
        fontFamily: ref("legend", "fontFamily", "Visual_Font", "Font"),
        fontColor: ref("legend", "fontColor", "Visual_TextColor", "Text Color") } as powerbi.visuals.SubSelectionStyles;
    }
    return undefined;
  }

  private getSubSelectionShortcuts(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.VisualSubSelectionShortcuts | undefined {
    const o = subs[0]?.customVisualObjects[0]?.objectName;
    const info = o ? Visual.SUB[o] : undefined;
    if (!info) return undefined;
    const id = (obj: string, prop: string) => ({ objectName: obj, propertyName: prop });
    const toggle = (obj: string, prop: string, key: string, def: string) => ({ type: powerbi.visuals.VisualShortcutType.Toggle, ...id(obj, prop),
      relatedToggledFormattingIds: [id(obj, prop)], disabledLabel: this.t(key, def), enabledLabel: this.t(key, def) });
    const reset = (ids: [string, string][]) => ({ type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: ids.map(([a, b]) => id(a, b)) });
    const picker = (obj: string, prop: string, key: string, def: string) => ({ type: powerbi.visuals.VisualShortcutType.Picker, ...id(obj, prop), label: this.t(key, def) });
    // FormattingSettingsService forma el uid "<objeto>-card" y Power BI lo publica como "Visual-<objeto>-card".
    const nav = { type: powerbi.visuals.VisualShortcutType.Navigate, destinationInfo: { cardUid: "Visual-" + info[0] + "-card" }, label: this.t(info[1], info[2]) };
    const div = { type: powerbi.visuals.VisualShortcutType.Divider };
    switch (o) {
      case "tiles":
        return [picker("mapSettings", "tileShape", "Visual_TileShape", "Tile Shape"),
          toggle("mapSettings", "showLabels", "Visual_ShowLabels", "Show Cell Labels"),
          toggle("mapSettings", "showEmptyCells", "Visual_ShowEmptyCells", "Show Empty Cells"),
          toggle("accessibility", "showBorders", "Visual_ShowBorders", "Show Cell Borders"), div,
          reset([["colorScale", "noDataColor"], ["accessibility", "borderColor"]]), nav] as powerbi.visuals.VisualSubSelectionShortcuts;
      case "labels":
        return [toggle("mapSettings", "showLabels", "Visual_ShowLabels", "Show Cell Labels"), div,
          reset([["mapSettings", "labelFontSize"]]), nav] as powerbi.visuals.VisualSubSelectionShortcuts;
      case "legend":
        return [picker("legend", "legendPosition", "Visual_Position", "Position"),
          toggle("legend", "showLegend", "Visual_ShowLegend", "Show Legend"), div,
          reset([["legend", "fontSize"], ["legend", "fontFamily"], ["legend", "fontColor"]]), nav] as powerbi.visuals.VisualSubSelectionShortcuts;
    }
    return undefined;
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingService.buildFormattingModel(this.settings);
  }
}
