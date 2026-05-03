"""
generate_country_grids.py
=========================
Reads Natural Earth 1:10m admin-0 countries shapefile and generates
countryGrids.ts for Tile Grid Map Pro.

Usage:
    pip install geopandas shapely
    python generate_country_grids.py

Output:
    countryGrids.ts  (copy to src/ in your Power BI visual project)
"""

import json
import sys
from collections import deque
from pathlib import Path

try:
    import geopandas as gpd
    from shapely.geometry import mapping, MultiPolygon, Polygon
except ImportError:
    print("ERROR: Missing dependencies. Run:")
    print("  pip install geopandas shapely")
    sys.exit(1)

# ─── Configuration ─────────────────────────────────────────────────────────────

SHAPEFILE = r"C:\Users\Tino\OneDrive\TCVIZ\Mapas visual\ne_10m_admin_0_countries(1)\ne_10m_admin_0_countries.shp"

GRID_COLS = 25
GRID_ROWS = 20

# Countries to include: ISO_A2 code → config
# bbox will be computed from the shapefile automatically
# inset: optional secondary grid for islands (Canarias, Hawaii, etc.)
COUNTRIES = {
    # Europe
    "ES": { "name": "Spain",           "inset": "ES_CANARIAS" },
    "PT": { "name": "Portugal"         },
    "FR": { "name": "France",          "bbox_override": [41.3, 51.1, -5.2, 9.7] },  # metro only
    "DE": { "name": "Germany"          },
    "IT": { "name": "Italy"            },
    "GB": { "name": "United Kingdom"   },
    "NL": { "name": "Netherlands"      },
    "BE": { "name": "Belgium"          },
    "PL": { "name": "Poland"           },
    "SE": { "name": "Sweden"           },
    "NO": { "name": "Norway",          "bbox_override": [57.8, 71.2, 4.4, 31.2] },  # mainland
    "CH": { "name": "Switzerland"      },
    "AT": { "name": "Austria"          },
    # Americas
    "US": { "name": "United States",   "bbox_override": [24.4, 49.4, -125.0, -66.9] },  # continental
    "CA": { "name": "Canada",          "bbox_override": [41.6, 83.2, -141.1, -52.5] },
    "MX": { "name": "Mexico"           },
    "BR": { "name": "Brazil"           },
    "AR": { "name": "Argentina"        },
    "CO": { "name": "Colombia"         },
    # Rest of world
    "AU": { "name": "Australia"        },
    "IN": { "name": "India"            },
}

# Special inset definitions
INSETS = {
    "ES_CANARIAS": {
        "label": "Canarias",
        "iso": "ES",
        "bbox": [27.4, 29.6, -18.3, -13.3],
        "cols": 10,
        "rows": 6,
    }
}

# ─── Geometry helpers ──────────────────────────────────────────────────────────

def get_rings(geometry):
    """Extract all exterior rings from a Polygon or MultiPolygon."""
    rings = []
    if geometry.geom_type == "Polygon":
        rings.append(list(geometry.exterior.coords))
        for interior in geometry.interiors:
            rings.append(list(interior.coords))  # holes
    elif geometry.geom_type == "MultiPolygon":
        for part in geometry.geoms:
            rings.append(list(part.exterior.coords))
            for interior in part.interiors:
                rings.append(list(interior.coords))
    return rings

def point_in_rings(px, py, rings):
    """Ray casting — handles multiple rings (exterior + holes)."""
    inside = False
    for ring in rings:
        n = len(ring)
        j = n - 1
        for i in range(n):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
    return inside

def rasterize(rings, bbox, cols, rows):
    """Ray-cast polygon rings onto grid. Returns set of (col, row) inside."""
    minLat, maxLat, minLng, maxLng = bbox
    cw = (maxLng - minLng) / cols
    ch = (maxLat - minLat) / rows
    grid = set()
    for row in range(rows):
        lat_c = maxLat - (row + 0.5) * ch
        for col in range(cols):
            lng_c = minLng + (col + 0.5) * cw
            if point_in_rings(lng_c, lat_c, rings):
                grid.add((col, row))
    return grid

def flood_fill(grid, cols, rows):
    """Flood fill from edges to find outside cells. Returns filled interior."""
    outside = set()
    queue = deque()

    def add(c, r):
        if 0 <= c < cols and 0 <= r < rows and (c, r) not in grid and (c, r) not in outside:
            outside.add((c, r))
            queue.append((c, r))

    for r in range(rows):
        add(0, r); add(cols - 1, r)
    for c in range(cols):
        add(c, 0); add(c, rows - 1)

    while queue:
        c, r = queue.popleft()
        add(c - 1, r); add(c + 1, r)
        add(c, r - 1); add(c, r + 1)

    all_cells = set((c, r) for r in range(rows) for c in range(cols))
    return all_cells - outside

def compute_bbox(geometry):
    """Get [minLat, maxLat, minLng, maxLng] from geometry bounds."""
    minx, miny, maxx, maxy = geometry.bounds
    # Add small padding
    pad = 0.2
    return [miny - pad, maxy + pad, minx - pad, maxx + pad]

def clip_geometry_to_bbox(geometry, bbox):
    """Clip a geometry to a bounding box (for countries with bbox_override)."""
    from shapely.geometry import box
    minLat, maxLat, minLng, maxLng = bbox
    clip_box = box(minLng, minLat, maxLng, maxLat)
    clipped = geometry.intersection(clip_box)
    return clipped

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Reading shapefile: {SHAPEFILE}")
    gdf = gpd.read_file(SHAPEFILE)
    print(f"Loaded {len(gdf)} features. CRS: {gdf.crs}")

    # Normalize to WGS84
    if gdf.crs and not gdf.crs.is_geographic:
        gdf = gdf.to_crs(epsg=4326)

    # Index by ISO_A2 (Natural Earth uses ISO_A2 column)
    iso_col = None
    for col in ["ISO_A2", "ADM0_A3", "iso_a2", "iso_a3"]:
        if col in gdf.columns:
            iso_col = col
            break

    if not iso_col:
        print("ERROR: Could not find ISO column. Available:", list(gdf.columns))
        sys.exit(1)

    print(f"Using ISO column: {iso_col}")
    gdf_indexed = gdf.set_index(iso_col)

    results = {}
    inset_results = {}

    for iso, config in COUNTRIES.items():
        print(f"\nProcessing {iso} ({config['name']})...")

        # Find the country
        if iso not in gdf_indexed.index:
            # Try alternative codes
            alt = {"GB": "GBR", "FR": "FRA", "ES": "ESP", "PT": "PRT",
                   "DE": "DEU", "IT": "ITA", "US": "USA", "CA": "CAN",
                   "AU": "AUS", "IN": "IND", "BR": "BRA", "AR": "ARG",
                   "CO": "COL", "MX": "MEX", "NL": "NLD", "BE": "BEL",
                   "PL": "POL", "SE": "SWE", "NO": "NOR", "CH": "CHE",
                   "AT": "AUT"}
            alt_code = alt.get(iso)
            if alt_code and alt_code in gdf_indexed.index:
                row = gdf_indexed.loc[alt_code]
            else:
                # Try name search
                name_mask = gdf["NAME"].str.upper() == config["name"].upper()
                if name_mask.any():
                    row = gdf[name_mask].iloc[0]
                else:
                    print(f"  WARNING: {iso} not found, skipping")
                    continue
        else:
            row = gdf_indexed.loc[iso]

        # Handle MultiIndex (multiple rows for same ISO)
        if hasattr(row, 'iloc'):
            row = row.iloc[0]

        geometry = row.geometry

        # Apply bbox override (clip geometry to continental area)
        if "bbox_override" in config:
            bbox = config["bbox_override"]
            geometry = clip_geometry_to_bbox(geometry, bbox)
            if geometry.is_empty:
                print(f"  WARNING: Clipping resulted in empty geometry for {iso}")
                continue
        else:
            bbox = compute_bbox(geometry)

        # Rasterize
        rings = get_rings(geometry)
        print(f"  Rings: {len(rings)}, bbox: {[round(x,2) for x in bbox]}")

        raster = rasterize(rings, bbox, GRID_COLS, GRID_ROWS)
        filled = flood_fill(raster, GRID_COLS, GRID_ROWS)
        cells = sorted(filled)

        print(f"  Cells: {len(cells)}")

        # Show ASCII preview
        grid_set = set(cells)
        for r in range(GRID_ROWS):
            line = "".join("█" if (c, r) in grid_set else "·" for c in range(GRID_COLS))
            print(f"    {r:2d} {line}")

        results[iso.lower()] = {
            "name": config["name"],
            "bbox": {
                "minLat": round(bbox[0], 4),
                "maxLat": round(bbox[1], 4),
                "minLng": round(bbox[2], 4),
                "maxLng": round(bbox[3], 4),
            },
            "cols": GRID_COLS,
            "rows": GRID_ROWS,
            "cells": cells,
            "inset_id": config.get("inset"),
        }

    # Process insets
    for inset_id, inset_config in INSETS.items():
        print(f"\nProcessing inset: {inset_id} ({inset_config['label']})...")
        iso = inset_config["iso"]

        if iso not in gdf_indexed.index:
            print(f"  WARNING: {iso} not found for inset, skipping")
            continue

        row = gdf_indexed.loc[iso]
        if hasattr(row, 'iloc'):
            row = row.iloc[0]

        geometry = row.geometry
        bbox = inset_config["bbox"]
        cols = inset_config["cols"]
        rows = inset_config["rows"]

        # Clip to inset bbox
        geometry = clip_geometry_to_bbox(geometry, bbox)
        if not geometry.is_empty:
            rings = get_rings(geometry)
            raster = rasterize(rings, bbox, cols, rows)
            filled = flood_fill(raster, cols, rows)
            cells = sorted(filled)
            print(f"  Cells: {len(cells)}")
            for r in range(rows):
                line = "".join("█" if (c, r) in cells else "·" for c in range(cols))
                print(f"    {r} {line}")
        else:
            # Canarias — use manual layout as fallback
            print(f"  Using manual layout for {inset_id}")
            cells = [
                (0,2),(0,3),(0,4),(0,5),(1,3),(2,3),(2,4),(3,3),(3,4),
                (4,3),(4,4),(5,3),(5,4),(7,2),(7,3),(7,4),(8,1),(8,3),(9,1),(9,2)
            ]

        inset_results[inset_id] = {
            "label": inset_config["label"],
            "bbox": {
                "minLat": bbox[0], "maxLat": bbox[1],
                "minLng": bbox[2], "maxLng": bbox[3],
            },
            "cols": cols,
            "rows": rows,
            "cells": cells,
        }

    # ─── Generate TypeScript ───────────────────────────────────────────────────
    print("\n\nGenerating countryGrids.ts...")

    lines = []
    lines.append('"use strict";')
    lines.append('/**')
    lines.append(' * countryGrids.ts')
    lines.append(' * Auto-generated from Natural Earth 1:10m admin-0 shapefile.')
    lines.append(' * Ray casting + flood fill on real border polygons.')
    lines.append(f' * {len(results)} countries, {GRID_COLS}x{GRID_ROWS} grid each.')
    lines.append(' * DO NOT EDIT MANUALLY — re-run generate_country_grids.py to update.')
    lines.append(' */')
    lines.append('')
    lines.append('export interface CountryBBox { minLat:number; maxLat:number; minLng:number; maxLng:number; }')
    lines.append('export interface CountryInset { label:string; bbox:CountryBBox; cols:number; rows:number; cells:Set<string>; }')
    lines.append('export interface CountryGrid { id:string; name:string; bbox:CountryBBox; cols:number; rows:number; cells:Set<string>; inset?:CountryInset; }')
    lines.append('')
    lines.append('function toSet(cells:[number,number][]): Set<string> {')
    lines.append('  const s = new Set<string>();')
    lines.append('  cells.forEach(([c,r]) => s.add(`${c},${r}`));')
    lines.append('  return s;')
    lines.append('}')
    lines.append('')

    # Emit cell arrays
    for iso, data in results.items():
        var = f"C_{iso.upper()}"
        cells_str = ",".join(f"[{c},{r}]" for c, r in data["cells"])
        lines.append(f"const {var}:[number,number][]=[{cells_str}];")

    lines.append("")

    # Emit inset cell arrays
    for inset_id, data in inset_results.items():
        var = f"I_{inset_id}"
        cells_str = ",".join(f"[{c},{r}]" for c, r in data["cells"])
        lines.append(f"const {var}:[number,number][]=[{cells_str}];")

    lines.append("")

    # Build inset objects
    inset_by_id = {}
    for inset_id, data in inset_results.items():
        b = data["bbox"]
        inset_by_id[inset_id] = (
            f'{{label:"{data["label"]}",'
            f'bbox:{{minLat:{b["minLat"]},maxLat:{b["maxLat"]},minLng:{b["minLng"]},maxLng:{b["maxLng"]}}},'
            f'cols:{data["cols"]},rows:{data["rows"]},cells:toSet(I_{inset_id})}}'
        )

    # Registry
    lines.append("export const COUNTRY_GRIDS: Record<string, CountryGrid> = {")
    for iso, data in results.items():
        b = data["bbox"]
        inset_str = ""
        if data.get("inset_id") and data["inset_id"] in inset_by_id:
            inset_str = f",inset:{inset_by_id[data['inset_id']]}"
        lines.append(
            f'  {iso}: {{id:"{iso}",name:"{data["name"]}",'
            f'bbox:{{minLat:{b["minLat"]},maxLat:{b["maxLat"]},minLng:{b["minLng"]},maxLng:{b["maxLng"]}}},'
            f'cols:{data["cols"]},rows:{data["rows"]},cells:toSet(C_{iso.upper()}){inset_str}}},'
        )
    lines.append("};")
    lines.append("")

    # Helper functions
    lines.append("""export function latLngToCell(
  lat:number, lng:number, grid:CountryGrid
):{col:number;row:number;isInset:boolean}|null {
  // Check inset first
  if(grid.inset) {
    const ib=grid.inset.bbox; const ic=grid.inset.cols; const ir=grid.inset.rows;
    if(lat>=ib.minLat&&lat<=ib.maxLat&&lng>=ib.minLng&&lng<=ib.maxLng) {
      const col=Math.min(ic-1,Math.floor(((lng-ib.minLng)/(ib.maxLng-ib.minLng))*ic));
      const row=Math.min(ir-1,Math.floor(((ib.maxLat-lat)/(ib.maxLat-ib.minLat))*ir));
      if(grid.inset.cells.has(`${col},${row}`)) return {col,row,isInset:true};
    }
  }
  const {bbox,cols,rows}=grid;
  if(lat<bbox.minLat||lat>bbox.maxLat||lng<bbox.minLng||lng>bbox.maxLng) return null;
  const col=Math.min(cols-1,Math.floor(((lng-bbox.minLng)/(bbox.maxLng-bbox.minLng))*cols));
  const row=Math.min(rows-1,Math.floor(((bbox.maxLat-lat)/(bbox.maxLat-bbox.minLat))*rows));
  return {col,row,isInset:false};
}

export function isInMask(col:number,row:number,grid:CountryGrid):boolean {
  return grid.cells.has(`${col},${row}`);
}
""")

    ts = "\n".join(lines)
    out_path = Path("countryGrids.ts")
    out_path.write_text(ts, encoding="utf-8")

    size_kb = len(ts.encode()) / 1024
    print(f"\nDone! countryGrids.ts written ({size_kb:.1f} KB)")
    print(f"Countries: {len(results)}")
    print(f"Copy to: src/countryGrids.ts in your Power BI visual project")


if __name__ == "__main__":
    main()
