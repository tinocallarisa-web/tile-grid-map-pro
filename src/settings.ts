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

  slices: SimpleSlice[] = [this.country, this.showEmptyCells, this.showLabels, this.labelFontSize];
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
  mapSettings = new MapSettingsCard();
  colorScale  = new ColorScaleCard();
  legend      = new LegendCard();
  proSettings = new ProSettingsCard();

  cards: FormattingSettingsCard[] = [
    this.mapSettings,
    this.colorScale,
    this.legend,
    this.proSettings,
  ];
}
