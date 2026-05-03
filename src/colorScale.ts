/**
 * colorScale.ts
 * Lightweight color interpolation — no d3 dependency in Free tier.
 * Pro tier can leverage d3-scale-chromatic scales.
 */

export interface ColorStop {
  value: number;   // 0–1 normalised
  color: string;   // hex
}

/** Parse "#rrggbb" → [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** [r, g, b] → "#rrggbb" */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Lerp between two hex colors at t ∈ [0, 1] */
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/**
 * Build a scale function from stops.
 * Returns a function: (normalisedValue: 0–1) → hex color.
 */
export function buildStopScale(stops: ColorStop[]): (t: number) => string {
  const sorted = [...stops].sort((a, b) => a.value - b.value);
  return (t: number): string => {
    if (t <= sorted[0].value) return sorted[0].color;
    if (t >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].color;
    for (let i = 1; i < sorted.length; i++) {
      if (t <= sorted[i].value) {
        const range = sorted[i].value - sorted[i - 1].value;
        const local = range === 0 ? 0 : (t - sorted[i - 1].value) / range;
        return lerpColor(sorted[i - 1].color, sorted[i].color, local);
      }
    }
    return sorted[sorted.length - 1].color;
  };
}

/**
 * FREE tier — fixed sequential blue scale.
 */
export function freeSequentialScale(): (t: number) => string {
  return buildStopScale([
    { value: 0, color: "#d0e4f7" },
    { value: 0.5, color: "#5b9bd5" },
    { value: 1, color: "#1a5276" },
  ]);
}

/**
 * PRO sequential scale from two hex endpoints.
 */
export function sequentialScale(colorMin: string, colorMax: string): (t: number) => string {
  return buildStopScale([
    { value: 0, color: colorMin },
    { value: 1, color: colorMax },
  ]);
}

/**
 * PRO diverging scale (min → mid → max).
 */
export function divergingScale(colorMin: string, colorMid: string, colorMax: string): (t: number) => string {
  return buildStopScale([
    { value: 0,   color: colorMin },
    { value: 0.5, color: colorMid },
    { value: 1,   color: colorMax },
  ]);
}

/**
 * PRO categorical scale — cycles through a palette.
 */
export const CATEGORICAL_PALETTE = [
  "#2980b9", "#e74c3c", "#27ae60", "#f39c12",
  "#8e44ad", "#16a085", "#d35400", "#2c3e50",
  "#1abc9c", "#c0392b", "#7f8c8d", "#f1c40f",
];

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

/**
 * Normalise a raw value to [0, 1] given domain [min, max].
 */
export function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Compute min/max from a map of key → value.
 */
export function domain(values: Map<string, number>): [number, number] {
  let min = Infinity, max = -Infinity;
  values.forEach(v => {
    if (v < min) min = v;
    if (v > max) max = v;
  });
  return [min === Infinity ? 0 : min, max === -Infinity ? 1 : max];
}
