import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

const { AutoDropdown, ToggleSwitch, NumUpDown, ColorPicker } = formattingSettings;
type SimpleSlice = formattingSettings.SimpleSlice;
type FormattingSettingsCard = formattingSettings.SimpleCard;

// ─── Map Settings Card ────────────────────────────────────────────────────────
export class MapSettingsCard extends formattingSettings.SimpleCard {
  name = "mapSettings";
  displayName = "Map Settings";
  displayNameKey = "Visual_MapSettings";

  country = new AutoDropdown({
    name: "country",
    displayName: "Country / Region",
    displayNameKey: "Visual_Country",
    value: "es",
  });

  tileShape = new AutoDropdown({
    name: "tileShape",
    displayName: "Tile Shape",
    displayNameKey: "Visual_TileShape",
    value: "square",
  });

  latitudeCorrection = new ToggleSwitch({
    name: "latitudeCorrection",
    displayName: "Correct Latitude Distortion",
    displayNameKey: "Visual_LatitudeCorrection",
    value: true,
  });

  aggregationType = new AutoDropdown({
    name: "aggregationType",
    displayName: "Value Aggregation",
    displayNameKey: "Visual_Aggregation",
    value: "auto",
  });

  showEmptyCells = new ToggleSwitch({
    name: "showEmptyCells",
    displayName: "Show Empty Cells",
    displayNameKey: "Visual_ShowEmptyCells",
    value: true,
  });

  showLabels = new ToggleSwitch({
    name: "showLabels",
    displayName: "Show Cell Labels",
    displayNameKey: "Visual_ShowLabels",
    value: false,
  });

  labelFontSize = new NumUpDown({
    name: "labelFontSize",
    displayName: "Label Font Size",
    displayNameKey: "Visual_LabelFontSize",
    value: 7,
    options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 5 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 14 } }
  });

  labelMinTileSize = new NumUpDown({
    name: "labelMinTileSize",
    displayName: "Label Min Tile Size (px)",
    displayNameKey: "Visual_LabelMinTile",
    value: 20,
    options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 60 } }
  });

  tooltipDecimals = new NumUpDown({
    name: "tooltipDecimals",
    displayName: "Decimal Places",
    displayNameKey: "Visual_Decimals",
    value: 2,
    options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 6 } }
  });

  slices: SimpleSlice[] = [this.country, this.tileShape, this.latitudeCorrection, this.aggregationType, this.showEmptyCells, this.showLabels, this.labelFontSize, this.labelMinTileSize, this.tooltipDecimals];
}

// ─── Color Scale Card ─────────────────────────────────────────────────────────
export class ColorScaleCard extends formattingSettings.SimpleCard {
  name = "colorScale";
  displayName = "Color Scale";
  displayNameKey = "Visual_ColorScale";

  scaleType = new AutoDropdown({
    name: "scaleType",
    displayName: "Scale Type",
    displayNameKey: "Visual_ScaleType",
    value: "sequential",
  });

  colorMin = new ColorPicker({
    name: "colorMin",
    displayName: "Color Min (Pro)",
    displayNameKey: "Visual_ColorMin",
    value: { value: "#d0e4f7" },
  });

  colorMid = new ColorPicker({
    name: "colorMid",
    displayName: "Color Mid (Pro, Diverging)",
    displayNameKey: "Visual_ColorMid",
    value: { value: "#f7f7f7" },
  });

  colorMax = new ColorPicker({
    name: "colorMax",
    displayName: "Color Max (Pro)",
    displayNameKey: "Visual_ColorMax",
    value: { value: "#1a5276" },
  });

  noDataColor = new ColorPicker({
    name: "noDataColor",
    displayName: "No Data Color",
    displayNameKey: "Visual_NoDataColor",
    value: { value: "#e8e8e8" },
  });

  slices: SimpleSlice[] = [this.scaleType, this.colorMin, this.colorMid, this.colorMax, this.noDataColor];
}

// ─── Legend Card ──────────────────────────────────────────────────────────────
export class LegendCard extends formattingSettings.SimpleCard {
  name = "legend";
  displayName = "Legend";
  displayNameKey = "Visual_Legend";

  showLegend = new ToggleSwitch({
    name: "showLegend",
    displayName: "Show Legend",
    displayNameKey: "Visual_ShowLegend",
    value: true,
  });

  legendPosition = new AutoDropdown({
    name: "legendPosition",
    displayName: "Position",
    displayNameKey: "Visual_Position",
    value: "bottom",
  });

  fontColor = new ColorPicker({
    name: "fontColor",
    displayName: "Text Color",
    displayNameKey: "Visual_TextColor",
    value: { value: "#555555" },
  });

  fontSize = new NumUpDown({
    name: "fontSize",
    displayName: "Text Size",
    displayNameKey: "Visual_TextSize",
    value: 10,
    options: {
      minValue: { type: powerbi.visuals.ValidatorType.Min, value: 7 },
      maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 24 },
    },
  });

  fontFamily = new formattingSettings.FontPicker({
    name: "fontFamily",
    displayName: "Font",
    displayNameKey: "Visual_Font",
    value: "Segoe UI, wf_segoe-ui_normal, helvetica, arial, sans-serif",
  });

  slices: SimpleSlice[] = [this.showLegend, this.legendPosition, this.fontFamily, this.fontSize, this.fontColor];
}

// ─── Accessibility Card ───────────────────────────────────────────────────────
export class AccessibilityCard extends formattingSettings.SimpleCard {
  name = "accessibility";
  displayName = "Accessibility";
  displayNameKey = "Visual_Accessibility";

  showBorders = new ToggleSwitch({
    name: "showBorders",
    displayName: "Show Cell Borders",
    displayNameKey: "Visual_ShowBorders",
    value: false,
  });

  borderColor = new ColorPicker({
    name: "borderColor",
    displayName: "Border Color",
    displayNameKey: "Visual_BorderColor",
    value: { value: "#cccccc" },
  });

  borderWidth = new NumUpDown({
    name: "borderWidth",
    displayName: "Border Width",
    displayNameKey: "Visual_BorderWidth",
    value: 0.5,
    options: {
      minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0.5 },
      maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 3 },
    },
  });

  selectedRingColor = new ColorPicker({
    name: "selectedRingColor",
    displayName: "Selected Ring Color",
    displayNameKey: "Visual_RingColor",
    value: { value: "#2980b9" },
  });

  selectedRingWidth = new NumUpDown({
    name: "selectedRingWidth",
    displayName: "Selected Ring Width",
    displayNameKey: "Visual_RingWidth",
    value: 2,
    options: {
      minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
      maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 5 },
    },
  });

  slices: SimpleSlice[] = [
    this.showBorders, this.borderColor, this.borderWidth,
    this.selectedRingColor, this.selectedRingWidth,
  ];
}

// ─── Conditional Formatting Card ─────────────────────────────────────────────
export class ConditionalFormattingCard extends formattingSettings.SimpleCard {
  name = "conditionalFormatting";
  displayName = "Conditional Formatting";
  displayNameKey = "Visual_ConditionalFormatting";

  cfEnabled = new ToggleSwitch({
    name: "cfEnabled",
    displayName: "Enable Rules",
    displayNameKey: "Visual_EnableRules",
    value: false,
  });

  // ── Rule 1 ──
  cfRule1Operator = new AutoDropdown({
    name: "cfRule1Operator",
    displayName: "Rule 1 – Operator",
    displayNameKey: "Visual_Rule1Operator",
    value: "lt",
  });
  cfRule1Value = new NumUpDown({
    name: "cfRule1Value",
    displayName: "Rule 1 – Value",
    displayNameKey: "Visual_Rule1Value",
    value: 0,
  });
  cfRule1Color = new ColorPicker({
    name: "cfRule1Color",
    displayName: "Rule 1 – Color",
    displayNameKey: "Visual_Rule1Color",
    value: { value: "#e74c3c" },
  });

  // ── Rule 2 — Between range ──
  cfRule2MinValue = new NumUpDown({
    name: "cfRule2MinValue",
    displayName: "Rule 2 – From (≥)",
    displayNameKey: "Visual_Rule2From",
    value: 0,
  });
  cfRule2MaxValue = new NumUpDown({
    name: "cfRule2MaxValue",
    displayName: "Rule 2 – To (≤)",
    displayNameKey: "Visual_Rule2To",
    value: 100,
  });
  cfRule2Color = new ColorPicker({
    name: "cfRule2Color",
    displayName: "Rule 2 – Color",
    displayNameKey: "Visual_Rule2Color",
    value: { value: "#f39c12" },
  });

  // ── Rule 3 ── default "> 100": it no longer swallows every value rules 1 and 2 leave.
  cfRule3Operator = new AutoDropdown({
    name: "cfRule3Operator",
    displayName: "Rule 3 – Operator",
    displayNameKey: "Visual_Rule3Operator",
    value: "gt",
  });
  cfRule3Value = new NumUpDown({
    name: "cfRule3Value",
    displayName: "Rule 3 – Value",
    displayNameKey: "Visual_Rule3Value",
    value: 100,
  });
  cfRule3Color = new ColorPicker({
    name: "cfRule3Color",
    displayName: "Rule 3 – Color",
    displayNameKey: "Visual_Rule3Color",
    value: { value: "#27ae60" },
  });

  // The switch sits in the card header: buried among the rules it went unnoticed, and
  // colours chosen with it off appeared to do nothing.
  topLevelSlice = this.cfEnabled;

  slices: SimpleSlice[] = [
    this.cfRule1Operator, this.cfRule1Value, this.cfRule1Color,
    this.cfRule2MinValue, this.cfRule2MaxValue, this.cfRule2Color,
    this.cfRule3Operator, this.cfRule3Value, this.cfRule3Color,
  ];
}

// ─── Root Model ───────────────────────────────────────────────────────────────
// The persisted TopoJSON lives in the "proSettings" object (capabilities.json). It has
// no card: it is set by dropping a file on the visual, never typed in the pane.
export class VisualFormattingSettingsModel extends formattingSettings.Model {
  mapSettings           = new MapSettingsCard();
  colorScale            = new ColorScaleCard();
  conditionalFormatting = new ConditionalFormattingCard();
  accessibility         = new AccessibilityCard();
  legend                = new LegendCard();

  cards: FormattingSettingsCard[] = [
    this.mapSettings,
    this.colorScale,
    this.conditionalFormatting,
    this.accessibility,
    this.legend,
  ];
}
