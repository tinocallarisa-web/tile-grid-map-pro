/**
 * colorScale.ts
 * Colour interpolation without external dependencies.
 */

export interface ColorStop {
  value: number;   // 0–1 normalised
  color: string;   // hex
}

/** Parse "#rgb" or "#rrggbb" → [r, g, b]. Anything unparseable falls back to mid grey. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = String(hex ?? "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [128, 128, 128];
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

/** Free tier fixed sequential blue palette. */
export const FREE_STOPS: ColorStop[] = [
  { value: 0,   color: "#d0e4f7" },
  { value: 0.5, color: "#5b9bd5" },
  { value: 1,   color: "#1a5276" },
];

/**
 * PRO categorical scale — cycles through a palette.
 */
export const CATEGORICAL_PALETTE = [
  "#2980b9", "#e74c3c", "#27ae60", "#f39c12",
  "#8e44ad", "#16a085", "#d35400", "#2c3e50",
  "#1abc9c", "#c0392b", "#7f8c8d", "#f1c40f",
];

/**
 * Colour for a category, derived from its name rather than its position, so the
 * same category keeps its colour when a filter removes others.
 */
export function categoricalColorFor(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return CATEGORICAL_PALETTE[(h >>> 0) % CATEGORICAL_PALETTE.length];
}

/**
 * Normalise a raw value to [0, 1] given domain [min, max].
 */
export function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Diverging normalisation. When the domain crosses zero the neutral colour sits at
 * zero, not at the midpoint of [min, max]: with data from -10 to 90 a value of 40 is
 * not "neutral".
 */
export function normaliseDiverging(value: number, min: number, max: number): number {
  if (min < 0 && max > 0) {
    return value < 0
      ? 0.5 * Math.max(0, (value - min) / (0 - min))
      : 0.5 + 0.5 * Math.min(1, value / max);
  }
  return normalise(value, min, max);
}

/** Min/max of a list of finite numbers. */
export function domainOf(values: number[]): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min === Infinity ? 0 : min, max === -Infinity ? 1 : max];
}
