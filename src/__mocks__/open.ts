/**
 * No-op mock for the `open` package.
 *
 * Aliased in `vitest.config.ts` so that `src/extension.ts`'s
 * `void open(currentRuntimeUrl)` call (line 86) does NOT spawn a Chrome
 * tab every time `activate()` runs under tests. Without this alias,
 * `npm test` opens 8+ browser tabs per run (one per `manifest.spec.ts`
 * test that mock-activates the extension).
 *
 * The mock is intentionally silent — calling `open(url)` in a test
 * context is a side effect the tests should not observe.
 */
const open = (): Promise<unknown> => Promise.resolve();
export default open;