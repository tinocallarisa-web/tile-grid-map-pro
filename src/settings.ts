import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

const { AutoDropdown, ToggleSwitch, NumUpDown, ColorPicker, TextInput } = formattingSettings;
type SimpleSlice = formattingSettings.SimpleSlice;
type FormattingSettingsCard = formattingSettings.SimpleCard;

// ─── Map Settings Card ────────────────────────────────────────────────────────
export class MapSettingsCard extends formattingSettings.SimpleCard {
  name = "mapSettings";
  displayName = "Map Settings";

  country = new AutoDropdown({
    name: "country",
    displayName: "Country / Region",
    value: "es",
  });

  aggregationType = new AutoDropdown({
    name: "aggregationType",
    displayName: "Value Aggregation",
    value: "sum",
  });

  showEmptyCells = new ToggleSwitch({
    name: "showEmptyCells",
    displayName: "Show Empty Cells",
    value: true,
  });

  showLabels = new ToggleSwitch({
    name: "showLabels",
    displayName: "Show Cell Labels",
    value: false,
  });

  labelFontSize = new NumUpDown({
    name: "labelFontSize",
    displayName: "Label Font Size",
    value: 7,
    options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 5 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 14 } }
  });

  labelMinTileSize = new NumUpDown({
    name: "labelMinTileSize",
    displayName: "Label Min Tile Size (px)",
    value: 20,
    options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 60 } }
  });

  tooltipDecimals = new NumUpDown({
    name: "tooltipDecimals",
    displayName: "Tooltip Decimal Places",
    value: 2,
    options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 6 } }
  });

  slices: SimpleSlice[] = [this.country, this.aggregationType, this.showEmptyCells, this.showLabels, this.labelFontSize, this.labelMinTileSize, this.tooltipDecimals];
}

// ─── Color Scale Card ─────────────────────────────────────────────────────────
export class ColorScaleCard extends formattingSettings.SimpleCard {
  name = "colorScale";
  displayName = "Color Scale";

  scaleType = new AutoDropdown({
    name: "scaleType",
    displayName: "Scale Type",
    value: "sequential",
  });

  colorMin = new ColorPicker({
    name: "colorMin",
    displayName: "Color Min",
    value: { value: "#d0e4f7" },
  });

  colorMid = new ColorPicker({
    name: "colorMid",
    displayName: "Color Mid (Diverging)",
    value: { value: "#f7f7f7" },
  });

  colorMax = new ColorPicker({
    name: "colorMax",
    displayName: "Color Max",
    value: { value: "#1a5276" },
  });

  noDataColor = new ColorPicker({
    name: "noDataColor",
    displayName: "No Data Color",
    value: { value: "#e8e8e8" },
  });

  slices: SimpleSlice[] = [this.scaleType, this.colorMin, this.colorMid, this.colorMax, this.noDataColor];
}

// ─── Legend Card ──────────────────────────────────────────────────────────────
export class LegendCard extends formattingSettings.SimpleCard {
  name = "legend";
  displayName = "Legend";

  showLegend = new ToggleSwitch({
    name: "showLegend",
    displayName: "Show Legend",
    value: true,
  });

  legendPosition = new AutoDropdown({
    name: "legendPosition",
    displayName: "Position",
    value: "bottom",
  });

  slices: SimpleSlice[] = [this.showLegend, this.legendPosition];
}

// ─── Accessibility Card ───────────────────────────────────────────────────────
export class AccessibilityCard extends formattingSettings.SimpleCard {
  name = "accessibility";
  displayName = "Accessibility";

  showBorders = new ToggleSwitch({
    name: "showBorders",
    displayName: "Show Cell Borders",
    value: false,
  });

  borderColor = new ColorPicker({
    name: "borderColor",
    displayName: "Border Color",
    value: { value: "#cccccc" },
  });

  borderWidth = new NumUpDown({
    name: "borderWidth",
    displayName: "Border Width",
    value: 0.5,
    options: {
      minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0.5 },
      maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 3 },
    },
  });

  selectedRingColor = new ColorPicker({
    name: "selectedRingColor",
    displayName: "Selected Ring Color",
    value: { value: "#2980b9" },
  });

  selectedRingWidth = new NumUpDown({
    name: "selectedRingWidth",
    displayName: "Selected Ring Width",
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

  cfEnabled = new ToggleSwitch({
    name: "cfEnabled",
    displayName: "Enable Rules",
    value: false,
  });

  // ── Rule 1 ──
  cfRule1Operator = new AutoDropdown({
    name: "cfRule1Operator",
    displayName: "Rule 1 – Operator",
    value: "lt",
  });
  cfRule1Value = new NumUpDown({
    name: "cfRule1Value",
    displayName: "Rule 1 – Value",
    value: 0,
  });
  cfRule1Color = new ColorPicker({
    name: "cfRule1Color",
    displayName: "Rule 1 – Color",
    value: { value: "#e74c3c" },
  });

  // ── Rule 2 — Between range ──
  cfRule2MinValue = new NumUpDown({
    name: "cfRule2MinValue",
    displayName: "Rule 2 – From (≥)",
    value: 0,
  });
  cfRule2MaxValue = new NumUpDown({
    name: "cfRule2MaxValue",
    displayName: "Rule 2 – To (≤)",
    value: 100,
  });
  cfRule2Color = new ColorPicker({
    name: "cfRule2Color",
    displayName: "Rule 2 – Color",
    value: { value: "#f39c12" },
  });

  // ── Rule 3 ──
  cfRule3Operator = new AutoDropdown({
    name: "cfRule3Operator",
    displayName: "Rule 3 – Operator",
    value: "gte",
  });
  cfRule3Value = new NumUpDown({
    name: "cfRule3Value",
    displayName: "Rule 3 – Value",
    value: 0,
  });
  cfRule3Color = new ColorPicker({
    name: "cfRule3Color",
    displayName: "Rule 3 – Color",
    value: { value: "#27ae60" },
  });

  slices: SimpleSlice[] = [
    this.cfEnabled,
    this.cfRule1Operator, this.cfRule1Value, this.cfRule1Color,
    this.cfRule2MinValue, this.cfRule2MaxValue, this.cfRule2Color,
    this.cfRule3Operator, this.cfRule3Value, this.cfRule3Color,
  ];
}

// ─── Pro Settings Card ────────────────────────────────────────────────────────
export class ProSettingsCard extends formattingSettings.SimpleCard {
  name = "proSettings";
  displayName = "Pro Settings";

  customTopoJsonUrl = new TextInput({
    name: "customTopoJsonUrl",
    displayName: "Custom TopoJSON URL",
    placeholder: "https://example.com/regions.topojson",
    value: "",
  });

  showPill = new ToggleSwitch({
    name: "showPill",
    displayName: "Show Pro Pill",
    value: true,
  });

  slices: SimpleSlice[] = [this.customTopoJsonUrl, this.showPill];
}

// ─── Root Model ───────────────────────────────────────────────────────────────
export class VisualFormattingSettingsModel extends formattingSettings.Model {
  mapSettings           = new MapSettingsCard();
  colorScale            = new ColorScaleCard();
  conditionalFormatting = new ConditionalFormattingCard();
  accessibility         = new AccessibilityCard();
  legend                = new LegendCard();
  proSettings           = new ProSettingsCard();

  cards: FormattingSettingsCard[] = [
    this.mapSettings,
    this.colorScale,
    this.conditionalFormatting,
    this.accessibility,
    this.legend,
    this.proSettings,
  ];
}
