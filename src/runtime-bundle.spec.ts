import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_RUNTIME_MAIN = resolve(__dirname, "..", "out", "runtime", "main.js");
const OUT_RUNTIME_HTML = resolve(__dirname, "..", "out", "runtime", "index.html");

describe("runtime bundle", () => {
  it("out/runtime/main.js exists", () => {
    expect(existsSync(OUT_RUNTIME_MAIN)).toBe(true);
  });

  it("out/runtime/index.html exists", () => {
    expect(existsSync(OUT_RUNTIME_HTML)).toBe(true);
  });

  it("out/runtime/index.html references ./main.js (not .ts)", () => {
    const html = readFileSync(OUT_RUNTIME_HTML, "utf8");
    expect(html).toContain('src="./main.js"');
    expect(html).not.toContain('src="./main.ts"');
  });

  it("out/runtime/main.js has no bare import statements", () => {
    const code = readFileSync(OUT_RUNTIME_MAIN, "utf8");
    // Bare imports like `import 'hydra-element'` or `import { x } from 'pkg'`
    // would fail in a browser without an import map. The bundle must inline all deps.
    const bareImportPattern = /^import\s+.*from\s+['"][^./]/m;
    const bareSideEffectImport = /^import\s+['"][^./]/m;
    expect(code).not.toMatch(bareImportPattern);
    expect(code).not.toMatch(bareSideEffectImport);
  });

  it("out/runtime/main.js is non-trivial (bundled deps included)", () => {
    const code = readFileSync(OUT_RUNTIME_MAIN, "utf8");
    // A bare tsc output would be ~1KB. A real bundle with hydra-element is >100KB.
    expect(code.length).toBeGreaterThan(50_000);
  });
});
