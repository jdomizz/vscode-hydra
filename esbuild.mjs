import { build, context } from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * Logs deterministic start/finish lines so the tasks.json problem matcher
 * can track the background watch task (required for the F5 preLaunchTask
 * to complete). Errors are printed in the `file(line,col): error: msg`
 * format the inline matcher parses into the Problems panel.
 *
 * NOTE: `.vscode/tasks.json` must stay in sync with these strings —
 * beginsPattern `^\[esbuild\] build started`, endsPattern `^\[esbuild\] build finished`.
 * Do not use `$esbuild-watch` (it requires the connor4312.esbuild-problem-matchers
 * extension to be installed; without it the F5 launch never completes).
 *
 * @type {import('esbuild').Plugin}
 */
const watchLogPlugin = {
  name: "watch-log",
  setup(b) {
    b.onStart(() => {
      console.log("[esbuild] build started");
    });
    b.onEnd((result) => {
      for (const { text, location } of result.errors) {
        if (location) {
          console.error(`${location.file}(${location.line},${location.column}): error: ${text}`);
        } else {
          console.error(`✘ [ERROR] ${text}`);
        }
      }
      console.log("[esbuild] build finished");
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  // CommonJS output — the format the VS Code extension host `require()`s
  // for extensions whose entry is neither `.mjs` nor `"type": "module"`
  // (see `_isESM` in extensionHostProcess). CJS keeps native `require`
  // for bundled CommonJS deps (e.g. `ws` via @jdomizz/rig-relay), so
  // `require("events")` works without any shim or banner. Note: this
  // rules out bundling `import.meta`-using ESM-only packages — which is
  // why the `open` package was replaced with `vscode.env.openExternal`
  // (also the correct API for remote workspaces, where it opens the
  // browser on the client machine instead of the headless server).
  format: "cjs",
  platform: "node",
  // node18 honors `engines.vscode: ^1.88` (its extension host runs Node 18).
  target: "node18",
  outfile: "out/extension.js",
  external: ["vscode"],
  sourcemap: !production,
  minify: production,
  logLevel: "info",
  plugins: [watchLogPlugin],
};

if (watch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log("esbuild: watching...");
} else {
  await build(config);
}
