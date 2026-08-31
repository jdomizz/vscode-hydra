# AGENTS.md

## Commands

- `npm run compile` — compile backend (tsc) to `out/`
- `npm run compile:backend` — compile TypeScript backend only (`tsc`)
- `npm run watch` — watch backend TypeScript changes (`tsc -watch`)
- `npm run lint` — lint `src/` with ESLint
- `npm test` — run unit tests (`vitest run` — 124 tests across 11 files)
- `npm run package` — package as VSIX (`vsce package`)
- `npm run test:osc` — run demo OSC node (`node demo/osc-node.js`)

## Architecture

VS Code extension for live coding with Hydra video synthesizer. **Three-layer architecture** (M3 v1.0 rewrite):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EDITOR SHELL (the extension)                             │
│    eval commands, extraction, diagnostics, decorations,     │
│    single status bar panel, RigProcessSupervisor            │
├─────────────────────────────────────────────────────────────┤
│ 2. RIG WIRE (one transport)                                 │
│    RigWire → @jdomizz/rig-transport (TransportClient)       │
│    rig-relay in-process (spawned in hybrid mode)            │
├─────────────────────────────────────────────────────────────┤
│ 3. RENDERER                                                 │
│    external browser runtime ← rig-serve                     │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1 — Editor shell (`src/editor/`, `src/diagnostics.ts`, `src/decorations.ts`, `src/status/`, `src/capture/`)

- `src/extension.ts` — activation, command registration, wires all M3 modules
- `src/editor/extract.ts` — document/line/block/selection extraction (pure)
- `src/editor/index.ts` — `EditorService` (VS Code integration)
- `src/decorations.ts` — eval-flash + error decorations
- `src/diagnostics.ts` — `vscode.Diagnostic` collection (Problems panel)
- `src/status/index.ts` — `StatusPanel` (single status bar item, rig state, ports tooltip, open-runtime link)
- `src/capture/pipeline.ts` — `CapturePipeline` (`capture:image|start|stop` over wire + HTTP blob transport)
- `src/capture/transport.ts` — out-of-band HTTP blob receiver

### Layer 2 — Rig wire (`src/rig/`, `src/settings*.ts`)

- `src/rig/client.ts` — `RigWire` (wraps `TransportClient` from `@jdomizz/rig-transport`)
- `src/rig/supervisor.ts` — `RigProcessSupervisor` (in-process relay + serve by default; hybrid mode via `rig.*Path`)
- `src/settings-core.ts` — pure settings resolver (`rig.*` primary, `hydra.*` fallback)
- `src/settings.ts` — VS Code configuration integration

### Layer 3 — Renderer (`src/runtime/`)

- `src/runtime/index.html` — served runtime page
- `src/runtime/main.ts` — mounts `<hydra-element>`, connects via `@jdomizz/rig-host`'s `createRigHost`
- `src/runtime/adapter.ts` — `createHydraEngine(el)` bridges `<hydra-element>` to rig-host's `HostEngine` seam

### Type definitions (`src/types/`)

- `src/types/hydra-synth.d.ts` — hydra-synth DSL types (from feat/types branch)
- `src/types/hydra-element.d.ts` — type shim for `hydra-element` (ships JS only)
- `src/types/global.d.ts` — global type declarations for hydra sketches
- `src/types/glsl/glsl-functions.d.ts` — GLSL transform catalog types

## Conventions

- TypeScript strict mode everywhere; `@typescript-eslint`
- Backend: compiled by `tsc` to `out/`
- Runtime: bundled with Rollup; served by `rig-serve`
- ESLint config in `.eslintrc.json` — warns on style issues, no errors
- `demo/` is a playground with examples — not part of the extension
- **Do not add new `hydra.*` settings.** Use `rig.*`. The `hydra.*` namespace is frozen and kept only as backward-compatible fallbacks.

### Runtime dependencies

| Package | Role |
|---|---|
| `@jdomizz/rig-host` | Renderer-side conformance kit (file ref to `../rig/packages/rig-host`) |
| `@jdomizz/rig-relay` | WebSocket fan-out relay (file ref to `../rig/packages/rig-relay`) |
| `@jdomizz/rig-serve` | Static file server (file ref to `../rig/packages/rig-serve`) |
| `@jdomizz/rig-transport` | Wire protocol (file ref to `../rig/packages/rig-transport`) |
| `hydra-element` | Runtime custom element (file ref to `../hydra-element`) |
| `open` | Open runtime URL in external browser |

`osc-js` is in `devDependencies` (used by `demo/osc-node.js`).

### D5 invariant — no `hydra-synth` direct imports in `src/`

No file in `src/` may import `hydra-synth` directly. The codebase uses `<hydra-element>` exclusively. This is a hard invariant:

```bash
# Must return NOTHING (exit code 1):
git grep "from 'hydra-synth'" src/
```

The legacy webview (`src/frontend/`) was deleted in M4 closure. `hydra-synth` remains a transitive dependency of `hydra-element`; the served runtime page is the sole render surface.

## Testing

**vitest** — 124 tests across 11 spec files:

| File | Tests | Covers |
|---|---|---|
| `src/settings.spec.ts` | 7 | Settings resolver (rig.*/hydra.* fallback) — uses `node:test` |
| `src/decorations.spec.ts` | 7 | Eval-flash + error decorations |
| `src/editor/extract.spec.ts` | 14 | Document/line/block/word/expression extraction |
| `src/editor/index.spec.ts` | 14 | EditorService (document, line, block, selection, expression) |
| `src/rig/client.spec.ts` | 11 | RigWire (eval, sendCommand, feedback, lifecycle) |
| `src/rig/supervisor.spec.ts` | 10 | RigProcessSupervisor (in-process + hybrid) |
| `src/capture/pipeline.spec.ts` | 13 | CapturePipeline (image, recording, timeout, malformed feedback) |
| `src/status/index.spec.ts` | 20 | StatusPanel (state, tooltip, feedback, dispose) |
| `src/runtime-bundle.spec.ts` | 5 | Runtime bundle output verification |
| `src/runtime/runtime-conformance.spec.ts` | 22 | Runtime conformance (adapter hooks + rig-host wire protocol) |
| `src/manifest.spec.ts` | 8 | Manifest parity (C1-C6: commands, settings, context keys, README) |

**Playwright** is the planned test runner for the runtime page (Phase 2 / Phase 3 work — served page mounts `<hydra-element>`, dispatches `hydra-ready`, round-trips `rig.eval`).

## Migration: Rig (in progress)

This plugin is migrating to the [Rig](https://github.com/jdomizz/rig) framework. The program is tracked in the workspace program roadmap (`.opencode/specs/roadmap.md` at the workspace root) with milestones M0–M4; the plugin-specific spec is `.opencode/specs/active/rig-plugin-rewrite.md`.

- **M0 (done):** Plugin Phase 0 — pre-Rig coherence. Single status panel, kill legacy double-OSC stack, remove 500ms readiness sleeps, add `rig.*` settings alongside `hydra.*`, fix documentation drift. Shipped in `906e772`.
- **M1 (done):** Rig published — the six `@jdomizz/rig-*` packages on npm. (Blocked on user `npm login`; local file refs used in development.)
- **M2 (done):** Wire freeze — generic wire core + `panic` + `capture:*` plugin extension.
- **M3 (done):** Plugin Phase 2 — v1.0 rewrite. Three-layer architecture (editor shell / rig transport / renderer), external browser runtime as primary render surface, `<hydra-element>` replaces direct `hydra-synth` usage in `src/runtime/`. Commits: `914859c`, `3fdbd6c`, `147c26a`.
- **M4 (pending):** Publish vscode-hydra v1.0.

### M3 status

| Component | Status |
|---|---|
| Extension activation (`src/extension.ts`) | ✅ Done — wires all M3 modules |
| Editor shell (`src/editor/`, `src/decorations.ts`, `src/diagnostics.ts`) | ✅ Done |
| Rig wire (`src/rig/client.ts`, `src/rig/supervisor.ts`) | ✅ Done |
| Runtime page (`src/runtime/`) | ✅ Done — uses `@jdomizz/rig-host`'s `createRigHost` to drive `<hydra-element>` |
| Status panel (`src/status/`) | ✅ Done — sets `vscode-hydra.status` context key (`running`/`recording`/`panic`/`stopped`) |
| Capture pipeline (`src/capture/`) | ✅ Done — image + recording over wire + HTTP blobs (gamma correction honored) |
| Settings (`src/settings*.ts`) | ✅ Done — `rig.*` primary, `hydra.*` fallback |
| vitest test suite (124 tests) | ✅ Done |
| `package.json` contributes `rig.*` settings | ✅ Done — 13 rig.* properties + rig.loadScripts + rig.capturePort + rig.captureTimeoutMs |
| Playwright runtime tests | ⏳ Pending — Phase 2 / Phase 3 |
| Publish v1.0 | ⏳ Pending — M4 |

### Settings deprecation path

| Setting | Status |
|---|---|
| `hydra.*` (existing) | Frozen. Remain as backward-compatible fallbacks. No new settings added here. |
| `rig.*` (Phase 0+) | Primary. New settings go here. Become the only settings in v1.0 (with `hydra.*` auto-migrated). |

Contributors: when adding configuration, use `rig.*`. The `hydra.*` namespace is read-only until removal in v1.0.

## Publishing

CI publishes to GitHub Releases, OpenVSX, and VS Marketplace on `v*` tags (`.github/workflows/publish.yml`).

## Workflow

Specs live in `.opencode/specs/` (index in `roadmap.md`) — the canonical spec
structure used across all workspace projects (hydra-element is the reference
implementation):

```
backlog/ → active/ → archive/
```

- **backlog/** — Specs pending implementation
- **active/** — Specs being implemented (multiple allowed)
- **archive/** — Specs completed with user approval

When implementing a spec:
1. Move it from `backlog/` to `active/`
2. Implement according to the spec's "Done when" criteria
3. User reviews and approves
4. Move to `archive/`, append `## Status: accepted` with the commit hash
5. Update docs if needed: README status with commit hash, CHANGELOG entry, and AGENTS.md if the implementation changes commands, dependencies, architecture, or workflow

Cross-project developments (e.g. the Rig program) are sequenced and decided in
the workspace program roadmap (`.opencode/specs/roadmap.md` at the workspace
root); this repo's `roadmap.md` indexes local specs only.

When a spec (or any feature/fix) is finished and approved, **update the docs** before considering it done:

- **README** — reflect any new/changed features, usage, or status
- **CHANGELOG** — add an entry describing the change (follow its existing format)
- **AGENTS.md** — amend if the change affects commands, dependencies, architecture, or workflow
- Only update each doc if it's actually affected by the change; don't pad with noise

**Important:** Specs can only move to `archive/` after explicit user approval, even if implementation is complete.

## Language conventions

- **Project language: English** — All code, docs, and commits are in English
- **Agent responses**: Respond in the user's language when chatting
- **Code artifacts**: Always in English (variable names, comments, commit messages)
