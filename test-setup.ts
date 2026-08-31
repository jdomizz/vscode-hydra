/**
 * Vitest global setup — runs once before any test file.
 *
 * Rebuilds the runtime bundle via `npm run compile:runtime` so the
 * bundle-existence tests in src/runtime-bundle.spec.ts pass even on a
 * fresh checkout where `out/runtime/` has never been built.
 *
 * Skipped if SKIP_RUNTIME_REBUILD=1 (e.g. when running a single file with
 * `vitest run src/foo.spec.ts` and you don't want to pay the rebuild cost).
 */
import { execSync } from 'node:child_process'

export function setup(): void {
    if (process.env.SKIP_RUNTIME_REBUILD) return
    try {
        execSync('npm run compile:runtime', { stdio: 'pipe' })
    } catch (err) {
        console.error('[test-setup] Failed to rebuild runtime bundle:')
        console.error(err)
        throw err
    }
}