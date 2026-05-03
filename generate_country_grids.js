/**
 * generate_country_grids.js
 * =========================
 * Reads Natural Earth 1:10m admin-0 countries shapefile
 * and generates countryGrids.ts for Tile Grid Map Pro.
 *
 * Usage:
 *   npm install shapefile
 *   node generate_country_grids.js
 *
 * Output:
 *   countryGrids.ts  → copy to src/ in your Power BI visual project
 */

const fs   = require("fs");
const path = require("path");

let shapefile;
try {
  shapefile = require("shapefile");
} catch {
  console.error("ERROR: Run this first:  npm install shapefile");
  process.exit(1);
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const SHAPEFILE_PATH = String.raw`C:\Users\Tino\OneDrive\TCVIZ\Mapas visual\ne_10m_admin_0_countries(1)\ne_10m_admin_0_countries.shp`;

const GRID_COLS = 40;
const GRID_ROWS = 32;

// Countries: ISO_A2 → config
const COUNTRIES = {
  ES: { name: "Spain",           cols: 40, rows: 32, insets: ["ES_CANARIAS"], bboxOverride: [35.9, 43.9, -9.4, 4.4] },
  PT: { name: "Portugal",        cols: 15, rows: 32, bboxOverride: [36.9, 42.2, -9.5, -6.2] },
  FR: { name: "France",          cols: 40, rows: 32, bboxOverride: [41.3, 51.1, -5.2, 9.7] },
  DE: { name: "Germany",         cols: 40, rows: 32 },
  IT: { name: "Italy", cols: 22, rows: 44, bboxOverride: [37.5, 47.2, 6.6, 18.6], insets: ["IT_SARDINIA"], extraCells: [[10,37],[10,38],[10,39],[10,40],[10,41],[9,38],[9,39],[9,40],[9,41],[16,37],[16,38],[16,39],[16,40],[16,41]] },
  GB: { name: "United Kingdom",  cols: 22, rows: 44, bboxOverride: [49.8, 61.0, -8.3, 2.0] },
  NL: { name: "Netherlands",     cols: 15, rows: 15, bboxOverride: [50.7, 53.6, 3.3, 7.3] },
  BE: { name: "Belgium",         cols: 15, rows: 15, bboxOverride: [49.4, 51.6, 2.4, 6.5] },
  PL: { name: "Poland",          cols: 40, rows: 32 },
  SE: { name: "Sweden",          cols: 22, rows: 44, bboxOverride: [55.2, 69.2, 11.0, 24.3] },
  NO: { name: "Norway",          cols: 40, rows: 32, bboxOverride: [57.8, 71.2, 4.4, 31.2] },
  CH: { name: "Switzerland",     cols: 15, rows: 15, bboxOverride: [45.8, 47.9, 5.9, 10.5] },
  AT: { name: "Austria",         cols: 25, rows: 15, bboxOverride: [46.3, 49.1, 9.4, 17.3] },
  US: { name: "United States",   cols: 40, rows: 32, bboxOverride: [24.4, 49.4, -125.0, -66.9], insets: ["US_HAWAII", "US_ALASKA"] },
  CA: { name: "Canada",          cols: 40, rows: 32, bboxOverride: [41.6, 83.2, -141.1, -52.5] },
  MX: { name: "Mexico",          cols: 32, rows: 32 },
  BR: { name: "Brazil",          cols: 40, rows: 32 },
  AR: { name: "Argentina",       cols: 22, rows: 44, bboxOverride: [-55.2, -21.7, -73.7, -53.5] },
  CO: { name: "Colombia",        cols: 24, rows: 32 },
  AU: { name: "Australia",       cols: 40, rows: 32, bboxOverride: [-43.7, -10.6, 113.1, 153.7] },
  IN: { name: "India",           cols: 32, rows: 44, bboxOverride: [8.0, 37.2, 68.0, 97.5] },
};

// Inset grids (small secondary maps — predefined island groups)
const INSETS = {
  ES_CANARIAS: {
    label: "Canarias",
    isoFilter: (props) => props.ISO_A2 === "ES" || props.ADM0_A3 === "ESP",
    bbox: [27.0, 29.8, -18.5, -13.0],
    cols: 14, rows: 4,
  },
  PT_AZORES: {
    label: "Açores",
    isoFilter: (props) => props.ISO_A2 === "PT" || props.ADM0_A3 === "PRT",
    bbox: [36.9, 39.9, -31.3, -24.7],
    cols: 10, rows: 6,
  },
  PT_MADEIRA: {
    label: "Madeira",
    isoFilter: (props) => props.ISO_A2 === "PT" || props.ADM0_A3 === "PRT",
    bbox: [32.4, 33.2, -17.3, -16.2],
    cols: 6, rows: 4,
  },
  US_HAWAII: {
    label: "Hawaii",
    isoFilter: (props) => props.ISO_A2 === "US" || props.ADM0_A3 === "USA",
    bbox: [18.8, 22.3, -160.3, -154.7],
    cols: 10, rows: 6,
  },
  US_ALASKA: {
    label: "Alaska",
    isoFilter: (props) => props.ISO_A2 === "US" || props.ADM0_A3 === "USA",
    bbox: [54.0, 71.5, -168.0, -130.0],
    cols: 14, rows: 10,
  },
  IT_SARDINIA: {
    label: "Sardegna",
    isoFilter: (props) => props.ISO_A2 === "IT" || props.ADM0_A3 === "ITA",
    bbox: [38.8, 41.3, 8.1, 9.9],
    cols: 8, rows: 10,
  },
};

// ISO fallback lookup (Natural Earth uses inconsistent ISO_A2 for some countries)
const ISO_FALLBACK = {
  GB: ["GBR", "United Kingdom"],
  FR: ["FRA", "France"],
  ES: ["ESP", "Spain"],
  PT: ["PRT", "Portugal"],
  DE: ["DEU", "Germany"],
  IT: ["ITA", "Italy"],
  US: ["USA", "United States of America"],
  CA: ["CAN", "Canada"],
  AU: ["AUS", "Australia"],
  IN: ["IND", "India"],
  BR: ["BRA", "Brazil"],
  AR: ["ARG", "Argentina"],
  CO: ["COL", "Colombia"],
  MX: ["MEX", "Mexico"],
  NL: ["NLD", "Netherlands"],
  BE: ["BEL", "Belgium"],
  PL: ["POL", "Poland"],
  SE: ["SWE", "Sweden"],
  NO: ["NOR", "Norway"],
  CH: ["CHE", "Switzerland"],
  AT: ["AUT", "Austria"],
};

// ─── Geometry helpers ──────────────────────────────────────────────────────────

function getRings(geometry) {
  const rings = [];
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) rings.push(ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates)
      for (const ring of poly) rings.push(ring);
  }
  return rings;
}

function pointInRings(px, py, rings) {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length;
    let j = n - 1;
    for (let i = 0; i < n; i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
        inside = !inside;
      j = i;
    }
  }
  return inside;
}

function clipRingsToBbox(rings, bbox) {
  const [minLat, maxLat, minLng, maxLng] = bbox;
  // Simple clip: keep only rings that have at least one point inside bbox
  // and filter coordinates to bbox (approximate — good enough for rasterization)
  return rings.filter(ring =>
    ring.some(([lng, lat]) =>
      lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
    )
  );
}

function rasterize(rings, bbox, cols, rows) {
  const [minLat, maxLat, minLng, maxLng] = bbox;
  const cw = (maxLng - minLng) / cols;
  const ch = (maxLat - minLat) / rows;
  const grid = new Set();
  for (let row = 0; row < rows; row++) {
    const latC = maxLat - (row + 0.5) * ch;
    for (let col = 0; col < cols; col++) {
      const lngC = minLng + (col + 0.5) * cw;
      if (pointInRings(lngC, latC, rings)) grid.add(`${col},${row}`);
    }
  }
  return grid;
}

function floodFill(grid, cols, rows) {
  const outside = new Set();
  const queue = [];

  function add(c, r) {
    const k = `${c},${r}`;
    if (c >= 0 && c < cols && r >= 0 && r < rows && !grid.has(k) && !outside.has(k)) {
      outside.add(k); queue.push([c, r]);
    }
  }

  for (let r = 0; r < rows; r++) { add(0, r); add(cols - 1, r); }
  for (let c = 0; c < cols; c++) { add(c, 0); add(c, rows - 1); }

  while (queue.length) {
    const [c, r] = queue.shift();
    add(c - 1, r); add(c + 1, r); add(c, r - 1); add(c, r + 1);
  }

  const filled = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!outside.has(`${c},${r}`)) filled.push([c, r]);
  return filled;
}

function computeBbox(rings, pad = 0.3) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings)
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    }
  return [minLat - pad, maxLat + pad, minLng - pad, maxLng + pad];
}

function asciiPreview(cells, cols, rows) {
  const set = new Set(cells.map(([c, r]) => `${c},${r}`));
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = `  ${String(r).padStart(2)} `;
    for (let c = 0; c < cols; c++) line += set.has(`${c},${r}`) ? "█" : "·";
    lines.push(line);
  }
  return lines.join("\n");
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reading: ${SHAPEFILE_PATH}\n`);

  // Load all features
  const features = [];
  const source = await shapefile.open(SHAPEFILE_PATH);
  let result;
  while (!(result = await source.read()).done) {
    features.push(result.value);
  }
  console.log(`Loaded ${features.length} features\n`);

  // Index features by ISO
  const byIso2  = new Map();
  const byIso3  = new Map();
  const byName  = new Map();
  for (const f of features) {
    const p = f.properties;
    if (p.ISO_A2 && p.ISO_A2 !== "-99") byIso2.set(p.ISO_A2.toUpperCase(), f);
    if (p.ADM0_A3) byIso3.set(p.ADM0_A3.toUpperCase(), f);
    if (p.NAME)    byName.set(p.NAME.toUpperCase(), f);
    if (p.NAME_EN) byName.set(p.NAME_EN.toUpperCase(), f);
  }

  function findFeature(iso2) {
    if (byIso2.has(iso2)) return byIso2.get(iso2);
    const fallbacks = ISO_FALLBACK[iso2] || [];
    for (const fb of fallbacks) {
      if (byIso3.has(fb.toUpperCase())) return byIso3.get(fb.toUpperCase());
      if (byName.has(fb.toUpperCase())) return byName.get(fb.toUpperCase());
    }
    return null;
  }

  const results   = {};
  const insetData = {};

  // Process main countries
  for (const [iso, config] of Object.entries(COUNTRIES)) {
    process.stdout.write(`Processing ${iso} (${config.name})... `);

    const feature = findFeature(iso);
    if (!feature) { console.log("NOT FOUND — skipping"); continue; }

    const cols = config.cols || GRID_COLS;
    const rows = config.rows || GRID_ROWS;

    let rings = getRings(feature.geometry);

    let bbox;
    if (config.bboxOverride) {
      bbox = config.bboxOverride;
      rings = clipRingsToBbox(rings, bbox);
    } else {
      bbox = computeBbox(rings);
    }

    const raster = rasterize(rings, bbox, cols, rows);
    const cells  = floodFill(raster, cols, rows);

    // Add manually specified extra cells (bridges, islands close to mainland)
    if (config.extraCells) {
      config.extraCells.forEach(([c, r]) => cells.push([c, r]));
    }

    console.log(`${cells.length} cells (${cols}×${rows})`);
    console.log(asciiPreview(cells, cols, rows));

    results[iso.toLowerCase()] = {
      name: config.name,
      bbox: { minLat: +bbox[0].toFixed(4), maxLat: +bbox[1].toFixed(4), minLng: +bbox[2].toFixed(4), maxLng: +bbox[3].toFixed(4) },
      cols, rows,
      cells,
      insetIds: config.insets || [],
    };
  }

  // Process insets
  for (const [insetId, inset] of Object.entries(INSETS)) {
    process.stdout.write(`\nProcessing inset ${insetId}... `);

    const isoKey = insetId.split("_")[0];
    const feature = findFeature(isoKey);

    let cells = [];
    if (feature) {
      let rings = getRings(feature.geometry);
      rings = clipRingsToBbox(rings, inset.bbox);
      if (rings.length > 0) {
        const raster = rasterize(rings, inset.bbox, inset.cols, inset.rows);
        cells = floodFill(raster, inset.cols, inset.rows);
      }
    }

    // Fallback: manual Canarias layout if rasterization gives too few cells
    if (cells.length < 5 && insetId === "ES_CANARIAS") {
      console.log("using manual layout (14×8)");
      // bbox: lat 27.0–29.8, lng -18.5–-13.0
      // Cell width: 5.5/14 = 0.393° per col
      // Cell height: 2.8/8 = 0.35° per row
      // col 0 = -18.5W, col 13 = -13.0W
      // row 0 = 29.8N, row 7 = 27.0N
      // El Hierro:  27.7N,-18.0W → col1,row6
      // La Palma:   28.7N,-17.8W → col1-2,row3
      // La Gomera:  28.1N,-17.1W → col3,row5
      // Tenerife:   28.3N,-16.6W → col5,row4-5
      // Gran Canaria:28.1N,-15.5W→ col7-8,row5
      // Fuerteventura:28.4N,-14.0W→col11,row3-5
      // Lanzarote:  29.0N,-13.6W → col12-13,row2-3
      cells = [
        // El Hierro
        [0,2],[0,3],
        // La Palma
        [1,1],[1,2],[1,3],
        // La Gomera
        [3,2],
        // Tenerife
        [4,1],[5,1],[6,1],[5,2],[6,2],
        // Gran Canaria
        [7,1],[8,1],[7,2],[8,2],
        // Fuerteventura
        [10,0],[10,1],[11,1],[10,2],[11,2],
        // Lanzarote
        [12,0],[13,0],[12,1],[13,1],
      ];
    } else {
      console.log(`${cells.length} cells`);
    }

    console.log(asciiPreview(cells, inset.cols, inset.rows));

    insetData[insetId] = {
      label: inset.label,
      bbox: { minLat: inset.bbox[0], maxLat: inset.bbox[1], minLng: inset.bbox[2], maxLng: inset.bbox[3] },
      cols: inset.cols, rows: inset.rows, cells,
    };
  }

  // ─── Generate TypeScript ───────────────────────────────────────────────────
  const lines = [];
  lines.push('"use strict";');
  lines.push("/**");
  lines.push(" * countryGrids.ts");
  lines.push(" * Auto-generated from Natural Earth 1:10m admin-0 shapefile.");
  lines.push(" * Ray casting + flood fill on real border polygons.");
  lines.push(` * ${Object.keys(results).length} countries, ${GRID_COLS}x${GRID_ROWS} grid each.`);
  lines.push(" * DO NOT EDIT MANUALLY — re-run generate_country_grids.js to update.");
  lines.push(" */");
  lines.push("");
  lines.push("export interface CountryBBox { minLat:number; maxLat:number; minLng:number; maxLng:number; }");
  lines.push("export interface CountryInset { label:string; bbox:CountryBBox; cols:number; rows:number; cells:Set<string>; }");
  lines.push("export interface CountryGrid { id:string; name:string; bbox:CountryBBox; cols:number; rows:number; cells:Set<string>; insets?:CountryInset[]; }");
  lines.push("");
  lines.push("function toSet(cells:[number,number][]): Set<string> {");
  lines.push("  const s = new Set<string>();");
  lines.push("  cells.forEach(([c,r]) => s.add(`${c},${r}`));");
  lines.push("  return s;");
  lines.push("}");
  lines.push("");

  for (const [iso, data] of Object.entries(results)) {
    const cellsStr = data.cells.map(([c,r]) => `[${c},${r}]`).join(",");
    lines.push(`const C_${iso.toUpperCase()}:[number,number][]=[${cellsStr}];`);
  }
  lines.push("");
  for (const [id, data] of Object.entries(insetData)) {
    const cellsStr = data.cells.map(([c,r]) => `[${c},${r}]`).join(",");
    lines.push(`const I_${id}:[number,number][]=[${cellsStr}];`);
  }
  lines.push("");

  lines.push("export const COUNTRY_GRIDS: Record<string, CountryGrid> = {");
  for (const [iso, data] of Object.entries(results)) {
    const b = data.bbox;
    let insetsStr = "";
    if (data.insetIds && data.insetIds.length > 0) {
      const insetObjs = data.insetIds
        .filter(id => insetData[id])
        .map(id => {
          const ins = insetData[id];
          const ib  = ins.bbox;
          return `{label:"${ins.label}",bbox:{minLat:${ib.minLat},maxLat:${ib.maxLat},minLng:${ib.minLng},maxLng:${ib.maxLng}},cols:${ins.cols},rows:${ins.rows},cells:toSet(I_${id})}`;
        });
      if (insetObjs.length > 0) insetsStr = `,insets:[${insetObjs.join(",")}]`;
    }
    lines.push(`  ${iso}:{id:"${iso}",name:"${data.name}",bbox:{minLat:${b.minLat},maxLat:${b.maxLat},minLng:${b.minLng},maxLng:${b.maxLng}},cols:${data.cols},rows:${data.rows},cells:toSet(C_${iso.toUpperCase()})${insetsStr}},`);
  }
  lines.push("};");
  lines.push("");
  lines.push(`export function latLngToCell(
  lat:number, lng:number, grid:CountryGrid
):{col:number;row:number;insetIdx:number}|null {
  if(grid.insets) {
    for(let i=0;i<grid.insets.length;i++) {
      const ins=grid.insets[i];
      const ib=ins.bbox; const ic=ins.cols; const ir=ins.rows;
      if(lat>=ib.minLat&&lat<=ib.maxLat&&lng>=ib.minLng&&lng<=ib.maxLng) {
        const col=Math.min(ic-1,Math.floor(((lng-ib.minLng)/(ib.maxLng-ib.minLng))*ic));
        const row=Math.min(ir-1,Math.floor(((ib.maxLat-lat)/(ib.maxLat-ib.minLat))*ir));
        if(ins.cells.has(\`\${col},\${row}\`)) return {col,row,insetIdx:i};
        let bc=col,br=row,bd=Infinity;
        ins.cells.forEach((k:string)=>{const p=k.split(',');const c=+p[0];const r=+p[1];const d=Math.abs(c-col)+Math.abs(r-row);if(d<bd){bd=d;bc=c;br=r;}});
        return {col:bc,row:br,insetIdx:i};
      }
    }
  }
  const {bbox,cols,rows}=grid;
  if(lat<bbox.minLat||lat>bbox.maxLat||lng<bbox.minLng||lng>bbox.maxLng) return null;
  const col=Math.min(cols-1,Math.floor(((lng-bbox.minLng)/(bbox.maxLng-bbox.minLng))*cols));
  const row=Math.min(rows-1,Math.floor(((bbox.maxLat-lat)/(bbox.maxLat-bbox.minLat))*rows));
  return {col,row,insetIdx:-1};
}

export function isInMask(col:number,row:number,grid:CountryGrid):boolean {
  return grid.cells.has(\`\${col},\${row}\`);
}
`);

  const ts = lines.join("\n");
  const outPath = path.join(process.cwd(), "countryGrids.ts");
  fs.writeFileSync(outPath, ts, "utf8");

  const sizeKb = (Buffer.byteLength(ts) / 1024).toFixed(1);
  console.log(`\n✓ countryGrids.ts written (${sizeKb} KB)`);
  console.log(`  Countries: ${Object.keys(results).length}`);
  console.log(`\n  Copy to: src\\countryGrids.ts in your Power BI visual project`);
}

main().catch(err => { console.error(err); process.exit(1); });
