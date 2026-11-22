import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        // build-test.js y tools/ son scripts locales, no forman parte del visual.
        ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**", "*.js", "*.mjs", "tools/**"],
    },
];
