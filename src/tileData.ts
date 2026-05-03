/**
 * tileData.ts
 * Bundled tile-grid layouts for countries.
 * Each entry maps a region key (ISO 3166-1 alpha-2 / alpha-3 / name) to a
 * grid cell { col, row } in the tile layout.
 *
 * Free tier: "world" map only (country-level tiles).
 * Pro tier:  all country sub-region grids.
 *
 * Coordinates are zero-based [col, row].
 */

export interface TileCell {
  key: string;          // canonical ISO / region key (lowercase)
  label: string;        // short display label
  col: number;
  row: number;
  aliases?: string[];   // alternative keys the user might supply
}

export interface TileLayout {
  id: string;
  name: string;
  cols: number;         // grid width
  rows: number;         // grid height
  cells: TileCell[];
  proOnly: boolean;
}

// ─── WORLD (country-level) ────────────────────────────────────────────────────
// Classic "tile grid world map" layout — 30×16 grid
const WORLD_CELLS: TileCell[] = [
  // North America
  { key: "ca", label: "CA", col: 2,  row: 1,  aliases: ["canada"] },
  { key: "us", label: "US", col: 2,  row: 2,  aliases: ["united states", "usa"] },
  { key: "mx", label: "MX", col: 2,  row: 3,  aliases: ["mexico"] },
  { key: "gt", label: "GT", col: 3,  row: 3,  aliases: ["guatemala"] },
  { key: "bz", label: "BZ", col: 4,  row: 3,  aliases: ["belize"] },
  { key: "hn", label: "HN", col: 3,  row: 4,  aliases: ["honduras"] },
  { key: "sv", label: "SV", col: 2,  row: 4,  aliases: ["el salvador"] },
  { key: "ni", label: "NI", col: 4,  row: 4,  aliases: ["nicaragua"] },
  { key: "cr", label: "CR", col: 3,  row: 5,  aliases: ["costa rica"] },
  { key: "pa", label: "PA", col: 4,  row: 5,  aliases: ["panama"] },
  { key: "cu", label: "CU", col: 4,  row: 2,  aliases: ["cuba"] },
  { key: "jm", label: "JM", col: 5,  row: 2,  aliases: ["jamaica"] },
  { key: "ht", label: "HT", col: 5,  row: 3,  aliases: ["haiti"] },
  { key: "do", label: "DO", col: 6,  row: 3,  aliases: ["dominican republic"] },
  { key: "pr", label: "PR", col: 6,  row: 2,  aliases: ["puerto rico"] },
  // South America
  { key: "co", label: "CO", col: 4,  row: 6,  aliases: ["colombia"] },
  { key: "ve", label: "VE", col: 5,  row: 6,  aliases: ["venezuela"] },
  { key: "gy", label: "GY", col: 6,  row: 6,  aliases: ["guyana"] },
  { key: "sr", label: "SR", col: 7,  row: 6,  aliases: ["suriname"] },
  { key: "br", label: "BR", col: 6,  row: 7,  aliases: ["brazil"] },
  { key: "ec", label: "EC", col: 4,  row: 7,  aliases: ["ecuador"] },
  { key: "pe", label: "PE", col: 4,  row: 8,  aliases: ["peru"] },
  { key: "bo", label: "BO", col: 5,  row: 8,  aliases: ["bolivia"] },
  { key: "py", label: "PY", col: 5,  row: 9,  aliases: ["paraguay"] },
  { key: "ar", label: "AR", col: 4,  row: 10, aliases: ["argentina"] },
  { key: "cl", label: "CL", col: 3,  row: 10, aliases: ["chile"] },
  { key: "uy", label: "UY", col: 5,  row: 10, aliases: ["uruguay"] },
  // Europe
  { key: "is", label: "IS", col: 9,  row: 0,  aliases: ["iceland"] },
  { key: "no", label: "NO", col: 11, row: 0,  aliases: ["norway"] },
  { key: "se", label: "SE", col: 12, row: 0,  aliases: ["sweden"] },
  { key: "fi", label: "FI", col: 13, row: 0,  aliases: ["finland"] },
  { key: "ie", label: "IE", col: 9,  row: 1,  aliases: ["ireland"] },
  { key: "gb", label: "GB", col: 10, row: 1,  aliases: ["united kingdom", "uk"] },
  { key: "nl", label: "NL", col: 11, row: 1,  aliases: ["netherlands"] },
  { key: "dk", label: "DK", col: 12, row: 1,  aliases: ["denmark"] },
  { key: "ee", label: "EE", col: 13, row: 1,  aliases: ["estonia"] },
  { key: "lv", label: "LV", col: 13, row: 2,  aliases: ["latvia"] },
  { key: "lt", label: "LT", col: 13, row: 3,  aliases: ["lithuania"] },
  { key: "pt", label: "PT", col: 9,  row: 2,  aliases: ["portugal"] },
  { key: "es", label: "ES", col: 10, row: 2,  aliases: ["spain"] },
  { key: "fr", label: "FR", col: 10, row: 2,  aliases: ["france"] },
  { key: "be", label: "BE", col: 11, row: 2,  aliases: ["belgium"] },
  { key: "lu", label: "LU", col: 11, row: 3,  aliases: ["luxembourg"] },
  { key: "de", label: "DE", col: 12, row: 2,  aliases: ["germany"] },
  { key: "pl", label: "PL", col: 13, row: 2,  aliases: ["poland"] },
  { key: "cz", label: "CZ", col: 12, row: 3,  aliases: ["czech republic", "czechia"] },
  { key: "sk", label: "SK", col: 13, row: 3,  aliases: ["slovakia"] },
  { key: "at", label: "AT", col: 12, row: 3,  aliases: ["austria"] },
  { key: "ch", label: "CH", col: 11, row: 3,  aliases: ["switzerland"] },
  { key: "it", label: "IT", col: 11, row: 4,  aliases: ["italy"] },
  { key: "si", label: "SI", col: 12, row: 4,  aliases: ["slovenia"] },
  { key: "hr", label: "HR", col: 12, row: 4,  aliases: ["croatia"] },
  { key: "hu", label: "HU", col: 13, row: 4,  aliases: ["hungary"] },
  { key: "ro", label: "RO", col: 14, row: 4,  aliases: ["romania"] },
  { key: "by", label: "BY", col: 14, row: 2,  aliases: ["belarus"] },
  { key: "ua", label: "UA", col: 14, row: 3,  aliases: ["ukraine"] },
  { key: "md", label: "MD", col: 14, row: 4,  aliases: ["moldova"] },
  { key: "ba", label: "BA", col: 12, row: 5,  aliases: ["bosnia"] },
  { key: "rs", label: "RS", col: 13, row: 5,  aliases: ["serbia"] },
  { key: "me", label: "ME", col: 12, row: 5,  aliases: ["montenegro"] },
  { key: "al", label: "AL", col: 12, row: 6,  aliases: ["albania"] },
  { key: "mk", label: "MK", col: 13, row: 5,  aliases: ["north macedonia"] },
  { key: "bg", label: "BG", col: 14, row: 5,  aliases: ["bulgaria"] },
  { key: "gr", label: "GR", col: 13, row: 6,  aliases: ["greece"] },
  { key: "tr", label: "TR", col: 15, row: 5,  aliases: ["turkey"] },
  { key: "ru", label: "RU", col: 16, row: 1,  aliases: ["russia"] },
  // Middle East & Central Asia
  { key: "ge", label: "GE", col: 15, row: 4,  aliases: ["georgia"] },
  { key: "am", label: "AM", col: 16, row: 4,  aliases: ["armenia"] },
  { key: "az", label: "AZ", col: 16, row: 5,  aliases: ["azerbaijan"] },
  { key: "sy", label: "SY", col: 15, row: 5,  aliases: ["syria"] },
  { key: "lb", label: "LB", col: 15, row: 6,  aliases: ["lebanon"] },
  { key: "il", label: "IL", col: 15, row: 6,  aliases: ["israel"] },
  { key: "jo", label: "JO", col: 15, row: 7,  aliases: ["jordan"] },
  { key: "sa", label: "SA", col: 15, row: 7,  aliases: ["saudi arabia"] },
  { key: "ye", label: "YE", col: 15, row: 8,  aliases: ["yemen"] },
  { key: "om", label: "OM", col: 16, row: 7,  aliases: ["oman"] },
  { key: "ae", label: "AE", col: 16, row: 6,  aliases: ["uae", "united arab emirates"] },
  { key: "qa", label: "QA", col: 16, row: 6,  aliases: ["qatar"] },
  { key: "kw", label: "KW", col: 15, row: 5,  aliases: ["kuwait"] },
  { key: "bh", label: "BH", col: 16, row: 6,  aliases: ["bahrain"] },
  { key: "iq", label: "IQ", col: 16, row: 5,  aliases: ["iraq"] },
  { key: "ir", label: "IR", col: 17, row: 5,  aliases: ["iran"] },
  { key: "af", label: "AF", col: 18, row: 5,  aliases: ["afghanistan"] },
  { key: "pk", label: "PK", col: 18, row: 6,  aliases: ["pakistan"] },
  { key: "kz", label: "KZ", col: 18, row: 3,  aliases: ["kazakhstan"] },
  { key: "uz", label: "UZ", col: 18, row: 4,  aliases: ["uzbekistan"] },
  { key: "tm", label: "TM", col: 17, row: 4,  aliases: ["turkmenistan"] },
  // South & Southeast Asia
  { key: "in", label: "IN", col: 19, row: 6,  aliases: ["india"] },
  { key: "np", label: "NP", col: 19, row: 5,  aliases: ["nepal"] },
  { key: "bd", label: "BD", col: 20, row: 6,  aliases: ["bangladesh"] },
  { key: "lk", label: "LK", col: 19, row: 7,  aliases: ["sri lanka"] },
  { key: "mm", label: "MM", col: 21, row: 6,  aliases: ["myanmar"] },
  { key: "th", label: "TH", col: 21, row: 7,  aliases: ["thailand"] },
  { key: "la", label: "LA", col: 22, row: 6,  aliases: ["laos"] },
  { key: "vn", label: "VN", col: 22, row: 7,  aliases: ["vietnam"] },
  { key: "kh", label: "KH", col: 22, row: 7,  aliases: ["cambodia"] },
  { key: "my", label: "MY", col: 22, row: 8,  aliases: ["malaysia"] },
  { key: "sg", label: "SG", col: 22, row: 9,  aliases: ["singapore"] },
  { key: "id", label: "ID", col: 23, row: 9,  aliases: ["indonesia"] },
  { key: "ph", label: "PH", col: 24, row: 8,  aliases: ["philippines"] },
  // East Asia
  { key: "cn", label: "CN", col: 21, row: 4,  aliases: ["china"] },
  { key: "mn", label: "MN", col: 21, row: 3,  aliases: ["mongolia"] },
  { key: "kr", label: "KR", col: 23, row: 4,  aliases: ["south korea"] },
  { key: "kp", label: "KP", col: 23, row: 3,  aliases: ["north korea"] },
  { key: "jp", label: "JP", col: 24, row: 4,  aliases: ["japan"] },
  { key: "tw", label: "TW", col: 24, row: 5,  aliases: ["taiwan"] },
  // Africa
  { key: "ma", label: "MA", col: 10, row: 4,  aliases: ["morocco"] },
  { key: "dz", label: "DZ", col: 11, row: 4,  aliases: ["algeria"] },
  { key: "tn", label: "TN", col: 12, row: 4,  aliases: ["tunisia"] },
  { key: "ly", label: "LY", col: 13, row: 5,  aliases: ["libya"] },
  { key: "eg", label: "EG", col: 14, row: 5,  aliases: ["egypt"] },
  { key: "mr", label: "MR", col: 9,  row: 5,  aliases: ["mauritania"] },
  { key: "ml", label: "ML", col: 10, row: 5,  aliases: ["mali"] },
  { key: "ne", label: "NE", col: 11, row: 5,  aliases: ["niger"] },
  { key: "td", label: "TD", col: 12, row: 5,  aliases: ["chad"] },
  { key: "sd", label: "SD", col: 13, row: 6,  aliases: ["sudan"] },
  { key: "sn", label: "SN", col: 9,  row: 6,  aliases: ["senegal"] },
  { key: "gn", label: "GN", col: 9,  row: 7,  aliases: ["guinea"] },
  { key: "gh", label: "GH", col: 10, row: 7,  aliases: ["ghana"] },
  { key: "ng", label: "NG", col: 11, row: 7,  aliases: ["nigeria"] },
  { key: "cm", label: "CM", col: 12, row: 7,  aliases: ["cameroon"] },
  { key: "cf", label: "CF", col: 12, row: 7,  aliases: ["central african republic"] },
  { key: "et", label: "ET", col: 14, row: 7,  aliases: ["ethiopia"] },
  { key: "so", label: "SO", col: 15, row: 7,  aliases: ["somalia"] },
  { key: "ke", label: "KE", col: 14, row: 8,  aliases: ["kenya"] },
  { key: "tz", label: "TZ", col: 13, row: 8,  aliases: ["tanzania"] },
  { key: "cd", label: "CD", col: 12, row: 8,  aliases: ["drc", "congo"] },
  { key: "ao", label: "AO", col: 11, row: 9,  aliases: ["angola"] },
  { key: "zm", label: "ZM", col: 12, row: 9,  aliases: ["zambia"] },
  { key: "mz", label: "MZ", col: 13, row: 9,  aliases: ["mozambique"] },
  { key: "zw", label: "ZW", col: 12, row: 9,  aliases: ["zimbabwe"] },
  { key: "na", label: "NA", col: 11, row: 10, aliases: ["namibia"] },
  { key: "bw", label: "BW", col: 12, row: 10, aliases: ["botswana"] },
  { key: "za", label: "ZA", col: 12, row: 11, aliases: ["south africa"] },
  { key: "mg", label: "MG", col: 14, row: 10, aliases: ["madagascar"] },
  // Oceania
  { key: "au", label: "AU", col: 23, row: 11, aliases: ["australia"] },
  { key: "nz", label: "NZ", col: 25, row: 12, aliases: ["new zealand"] },
  { key: "pg", label: "PG", col: 24, row: 10, aliases: ["papua new guinea"] },
];

// ─── US States ────────────────────────────────────────────────────────────────
const US_CELLS: TileCell[] = [
  { key: "ak", label: "AK", col: 0, row: 5, aliases: ["alaska"] },
  { key: "hi", label: "HI", col: 1, row: 6, aliases: ["hawaii"] },
  { key: "wa", label: "WA", col: 1, row: 0, aliases: ["washington"] },
  { key: "or", label: "OR", col: 1, row: 1, aliases: ["oregon"] },
  { key: "ca", label: "CA", col: 1, row: 2, aliases: ["california"] },
  { key: "nv", label: "NV", col: 2, row: 2, aliases: ["nevada"] },
  { key: "id", label: "ID", col: 2, row: 1, aliases: ["idaho"] },
  { key: "mt", label: "MT", col: 3, row: 0, aliases: ["montana"] },
  { key: "wy", label: "WY", col: 3, row: 1, aliases: ["wyoming"] },
  { key: "ut", label: "UT", col: 2, row: 2, aliases: ["utah"] },
  { key: "co", label: "CO", col: 3, row: 2, aliases: ["colorado"] },
  { key: "az", label: "AZ", col: 2, row: 3, aliases: ["arizona"] },
  { key: "nm", label: "NM", col: 3, row: 3, aliases: ["new mexico"] },
  { key: "nd", label: "ND", col: 4, row: 0, aliases: ["north dakota"] },
  { key: "sd", label: "SD", col: 4, row: 1, aliases: ["south dakota"] },
  { key: "ne", label: "NE", col: 4, row: 2, aliases: ["nebraska"] },
  { key: "ks", label: "KS", col: 4, row: 3, aliases: ["kansas"] },
  { key: "ok", label: "OK", col: 4, row: 4, aliases: ["oklahoma"] },
  { key: "tx", label: "TX", col: 4, row: 5, aliases: ["texas"] },
  { key: "mn", label: "MN", col: 5, row: 0, aliases: ["minnesota"] },
  { key: "ia", label: "IA", col: 5, row: 1, aliases: ["iowa"] },
  { key: "mo", label: "MO", col: 5, row: 2, aliases: ["missouri"] },
  { key: "ar", label: "AR", col: 5, row: 3, aliases: ["arkansas"] },
  { key: "la", label: "LA", col: 5, row: 4, aliases: ["louisiana"] },
  { key: "wi", label: "WI", col: 6, row: 0, aliases: ["wisconsin"] },
  { key: "il", label: "IL", col: 6, row: 1, aliases: ["illinois"] },
  { key: "ms", label: "MS", col: 6, row: 3, aliases: ["mississippi"] },
  { key: "mi", label: "MI", col: 7, row: 0, aliases: ["michigan"] },
  { key: "in", label: "IN", col: 6, row: 1, aliases: ["indiana"] },
  { key: "ky", label: "KY", col: 6, row: 2, aliases: ["kentucky"] },
  { key: "tn", label: "TN", col: 6, row: 2, aliases: ["tennessee"] },
  { key: "al", label: "AL", col: 6, row: 3, aliases: ["alabama"] },
  { key: "oh", label: "OH", col: 7, row: 1, aliases: ["ohio"] },
  { key: "wv", label: "WV", col: 7, row: 2, aliases: ["west virginia"] },
  { key: "va", label: "VA", col: 8, row: 2, aliases: ["virginia"] },
  { key: "nc", label: "NC", col: 8, row: 3, aliases: ["north carolina"] },
  { key: "sc", label: "SC", col: 8, row: 3, aliases: ["south carolina"] },
  { key: "ga", label: "GA", col: 7, row: 3, aliases: ["georgia"] },
  { key: "fl", label: "FL", col: 8, row: 4, aliases: ["florida"] },
  { key: "pa", label: "PA", col: 8, row: 1, aliases: ["pennsylvania"] },
  { key: "ny", label: "NY", col: 9, row: 0, aliases: ["new york"] },
  { key: "nj", label: "NJ", col: 9, row: 1, aliases: ["new jersey"] },
  { key: "de", label: "DE", col: 9, row: 2, aliases: ["delaware"] },
  { key: "md", label: "MD", col: 8, row: 2, aliases: ["maryland"] },
  { key: "dc", label: "DC", col: 8, row: 2, aliases: ["district of columbia"] },
  { key: "ct", label: "CT", col: 10, row: 1, aliases: ["connecticut"] },
  { key: "ri", label: "RI", col: 10, row: 1, aliases: ["rhode island"] },
  { key: "ma", label: "MA", col: 10, row: 0, aliases: ["massachusetts"] },
  { key: "vt", label: "VT", col: 10, row: 0, aliases: ["vermont"] },
  { key: "nh", label: "NH", col: 10, row: 0, aliases: ["new hampshire"] },
  { key: "me", label: "ME", col: 11, row: 0, aliases: ["maine"] },
];

// ─── Registry ─────────────────────────────────────────────────────────────────
export const TILE_LAYOUTS: Record<string, TileLayout> = {
  world: {
    id: "world",
    name: "World",
    cols: 30,
    rows: 16,
    cells: WORLD_CELLS,
    proOnly: false, // Free tier gets world map
  },
  us: {
    id: "us",
    name: "United States",
    cols: 12,
    rows: 8,
    cells: US_CELLS,
    proOnly: true,
  },
  // Additional country layouts are placeholders — Pro generates from bundled TopoJSON
  gb: { id: "gb", name: "United Kingdom", cols: 6, rows: 11, cells: [], proOnly: true },
  de: { id: "de", name: "Germany", cols: 6, rows: 8, cells: [], proOnly: true },
  fr: { id: "fr", name: "France", cols: 8, rows: 8, cells: [], proOnly: true },
  es: { id: "es", name: "Spain", cols: 7, rows: 6, cells: [], proOnly: true },
  it: { id: "it", name: "Italy", cols: 6, rows: 10, cells: [], proOnly: true },
  br: { id: "br", name: "Brazil", cols: 8, rows: 8, cells: [], proOnly: true },
  au: { id: "au", name: "Australia", cols: 8, rows: 6, cells: [], proOnly: true },
  ca: { id: "ca", name: "Canada", cols: 12, rows: 6, cells: [], proOnly: true },
  mx: { id: "mx", name: "Mexico", cols: 8, rows: 7, cells: [], proOnly: true },
  in: { id: "in", name: "India", cols: 6, rows: 8, cells: [], proOnly: true },
  jp: { id: "jp", name: "Japan", cols: 4, rows: 8, cells: [], proOnly: true },
  cn: { id: "cn", name: "China", cols: 10, rows: 8, cells: [], proOnly: true },
  custom: { id: "custom", name: "Custom TopoJSON", cols: 0, rows: 0, cells: [], proOnly: true },
};

/**
 * Resolve a user-supplied location key to a canonical TileCell key.
 * Tries exact match → alias match → prefix match.
 */
export function resolveKey(userKey: string, cells: TileCell[]): TileCell | undefined {
  const k = userKey.toLowerCase().trim();
  return (
    cells.find(c => c.key === k) ??
    cells.find(c => c.aliases?.includes(k)) ??
    cells.find(c => c.key.startsWith(k) || c.label.toLowerCase() === k)
  );
}
