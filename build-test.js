/**
 * build-test.js — Tile Grid Map Pro
 *
 * Genera un .pbiviz de TEST que convive con la versión de AppSource.
 *
 * Uso:
 *   node build-test.js          Pro forzado (FORCE_PRO = true). GUID <real>_test
 *   node build-test.js --free   tier Free REAL, sin forzar nada. GUID <real>_testfree
 *
 * El GUID de test es SIEMPRE el real con sufijo: nunca uno inventado.
 * El fuente queda SIEMPRE en estado producción: se restaura al final, falle lo que falle.
 */

const fs           = require("fs");
const path         = require("path");
const { execSync } = require("child_process");

const ROOT        = __dirname;
const VISUAL_TS   = path.join(ROOT, "src", "visual.ts");
const PBIVIZ_JSON = path.join(ROOT, "pbiviz.json");

const GUID_PROD = "tileGridMapProTCViz1234567890";

// Línea exacta del fuente. Si cambia, actualiza ESTE script, no el fuente.
const FORCE_OFF = "const FORCE_PRO = false; // FORCE_PRO_MARKER";
const FORCE_ON  = "const FORCE_PRO = true;  // FORCE_PRO_MARKER";

const originalVisual = fs.readFileSync(VISUAL_TS,   "utf8");
const originalPbiviz = fs.readFileSync(PBIVIZ_JSON, "utf8");

function restore() {
  fs.writeFileSync(VISUAL_TS,   originalVisual, "utf8");
  fs.writeFileSync(PBIVIZ_JSON, originalPbiviz, "utf8");
  console.log("✅  Ficheros restaurados al estado de producción.");
}

process.on("SIGINT", () => { restore(); process.exit(130); });

try {
  const freeMode = process.argv.includes("--free");
  const guid     = GUID_PROD + (freeMode ? "_testfree" : "_test");

  const pbiviz = JSON.parse(originalPbiviz);
  if (pbiviz.visual.guid !== GUID_PROD) {
    throw new Error(`GUID inesperado en pbiviz.json: "${pbiviz.visual.guid}". Se esperaba "${GUID_PROD}".`);
  }
  pbiviz.visual.guid = guid;
  fs.writeFileSync(PBIVIZ_JSON, JSON.stringify(pbiviz, null, 2), "utf8");
  console.log(`📝  GUID  →  ${guid}`);

  if (!originalVisual.includes(FORCE_OFF)) {
    throw new Error(`No se encontró "${FORCE_OFF}" en src/visual.ts. Actualiza este script.`);
  }
  if (!freeMode) {
    fs.writeFileSync(VISUAL_TS, originalVisual.replace(FORCE_OFF, FORCE_ON), "utf8");
    console.log("📝  FORCE_PRO  →  true");
  } else {
    console.log("📝  --free: licencia real, sin forzar");
  }

  execSync("npx pbiviz package", { cwd: ROOT, stdio: "inherit", shell: true });
  console.log(`\n✅  Build de TEST completado (${guid}).`);
} catch (err) {
  console.error("\n❌  Falló el build de test:", err.message);
  process.exitCode = 1;
} finally {
  restore();
}
