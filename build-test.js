/**
 * build-test.js
 * Empaqueta la versión ABIERTA de TileGridMapPro (uso propio, NO para AppSource):
 *   - isPro forzado a true → todas las features desbloqueadas sin licencia
 *   - GUID distinto (sufijo Open) → puede convivir con la versión de AppSource
 *   - Restaura los archivos originales al terminar
 *
 * Uso: node build-test.js
 */

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT        = __dirname;
const VISUAL_TS   = path.join(ROOT, "src", "visual.ts");
const PBIVIZ_JSON = path.join(ROOT, "pbiviz.json");

const GUID_PROD = "tileGridMapProTCViz1234567890";
const GUID_OPEN = "tileGridMapProTCVizOpen0000001";

// ── 1. Back up originals ───────────────────────────────────────────────────
const originalVisual = fs.readFileSync(VISUAL_TS,   "utf8");
const originalPbiviz = fs.readFileSync(PBIVIZ_JSON, "utf8");

// ── 2. Patch visual.ts: forzar isPro = true ───────────────────────────────
console.log("🔧  Parcheando visual.ts (isPro = true)...");

const licenseBlock =
`    // License check — Pro features unlocked via AppSource service plan
    this.isPro = false; // default free until license confirmed
    this.host.licenseManager.getAvailableServicePlans().then((result) => {
      const wasProBefore = this.isPro;
      this.isPro = result?.plans?.some(
        p => p.spIdentifier === "tile-grid-map-pro-tcviz" && (p.state as unknown as number) === 1 /* ServicePlanState.Active */
      ) ?? false;
      if (this.isPro !== wasProBefore && this._lastOptions) {
        this.update(this._lastOptions);
      }
    }).catch(() => { /* license check failed — stay free */ });`;

const openBlock =
`    // ⚠️ VERSIÓN ABIERTA — todas las features activadas. No publicar en AppSource.
    this.isPro = true;`;

const patchedVisual = originalVisual.replace(licenseBlock, openBlock);
if (patchedVisual === originalVisual) {
  console.error("❌  No se encontró el bloque de licencia en visual.ts.");
  process.exit(1);
}
fs.writeFileSync(VISUAL_TS, patchedVisual, "utf8");

// ── 3. Patch pbiviz.json: GUID y displayName distintos ────────────────────
console.log("🔧  Parcheando pbiviz.json (GUID abierto)...");

let patchedPbiviz = originalPbiviz
  .replace(`"guid": "${GUID_PROD}"`, `"guid": "${GUID_OPEN}"`)
  .replace(`"displayName": "Tile Grid Map Pro"`, `"displayName": "Tile Grid Map Pro (Open)"`);

if (patchedPbiviz === originalPbiviz) {
  console.error("❌  No se encontró el GUID en pbiviz.json.");
  restore();
  process.exit(1);
}
fs.writeFileSync(PBIVIZ_JSON, patchedPbiviz, "utf8");

// ── 4. Build ───────────────────────────────────────────────────────────────
try {
  console.log("📦  Ejecutando pbiviz package...");
  execSync("npx pbiviz package", { cwd: ROOT, stdio: "inherit" });
  console.log("✅  Versión ABIERTA empaquetada en dist/");
} catch (err) {
  console.error("❌  Error durante pbiviz package.");
  restore();
  process.exit(1);
}

// ── 5. Restore originals ───────────────────────────────────────────────────
restore();
console.log("✅  Archivos originales restaurados (estado producción).");

function restore() {
  fs.writeFileSync(VISUAL_TS,   originalVisual, "utf8");
  fs.writeFileSync(PBIVIZ_JSON, originalPbiviz, "utf8");
}
