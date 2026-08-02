/**
 * build-pro.js
 * Empaqueta la versión PRO de TileGridMapPro para AppSource.
 * El output mantiene el nombre estándar: {guid}.{version}.pbiviz
 *
 * Uso: node build-pro.js
 */

const { execSync } = require("child_process");

try {
  console.log("📦  Empaquetando versión PRO...");
  execSync("npx pbiviz package", { cwd: __dirname, stdio: "inherit" });
  console.log("✅  Empaquetado en dist/");
} catch (err) {
  console.error("❌  Error durante pbiviz package.");
  process.exit(1);
}
