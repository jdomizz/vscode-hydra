# AGENTS.md

## Commands

- `npm run compile` — production build: esbuild bundle (CommonJS → `out/extension.js`) + runtime bundle (rollup → `out/runtime/`)
- `npm run compile:dev` — dev build (sourcemaps, no minify) + runtime bundle
- `npm run compile:runtime` — runtime bundle only (rollup + copy `index.html`)
- `npm run watch` — esbuild watch on the backend bundle
- `npm run lint` — lint `src/` with ESLint
- `npm test` — run unit tests (`vitest run` — 131 tests across 11 files)
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
│ 3. RENDERER (rig.renderer)                                  │
│    webview iframe (default, integrated panel) ← rig-serve   │
│    external browser (peer surface, full device access)      │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1 — Editor shell (`src/editor/`, `src/diagnostics.ts`, `src/decorations.ts`, `src/status/`, `src/capture/`)

- `src/extension.ts` — activation, command registration, wires all M3 modules
- `src/editor/extract.ts` — document/line/block/selection extraction (pure)
- `src/editor/index.ts` — `EditorService` (VS Code integration)
- `src/decorations.ts` — eval-flash + error decorations
- `src/diagnostics.ts` — `vscode.Diagnostic` collection (Problems panel)
- `src/status/index.ts` — `StatusPanel` (single status bar item, rig state, ports tooltip, open-runtime link)
- `src/capture/pipeline.ts` — `CapturePipeline` (`capture:image|start|stop` over wire; the runtime page triggers a browser download for delivery)

### Layer 2 — Rig wire (`src/rig/`, `src/settings*.ts`)

- `src/rig/client.ts` — `RigWire` (wraps `TransportClient` from `@jdomizz/rig-transport`)
- `src/rig/supervisor.ts` — `RigProcessSupervisor` (in-process relay + serve by default; hybrid mode via `rig.*Path`; `serveRoot` option — the extension passes `<extensionPath>/out`; on `EADDRINUSE` the in-process services fall back to an OS-assigned port so multiple windows coexist)
- `src/settings-core.ts` — pure settings resolver (`rig.*` primary, `hydra.*` fallback)
- `src/settings.ts` — VS Code configuration integration

### Layer 3 — Renderer (`src/runtime/`, `src/webview/`)

- `src/runtime/index.html` — served runtime page
- `src/runtime/main.ts` — mounts `<hydra-element>`, connects via `@jdomizz/rig-host`'s `createRigHost`
- `src/runtime/adapter.ts` — `createHydraEngine(el)` bridges `<hydra-element>` to rig-host's `HostEngine` seam
- `src/webview/panel.ts` — `RuntimeWebviewPanel`: `WebviewPanel` containing an `<iframe>` that loads the served runtime page. Used when `rig.renderer === 'webview'` (the default). The same served page works in both mounts — no duplicated logic.

### Type definitions (`src/types/`)

- `src/types/hydra-synth.d.ts` — hydra-synth DSL types (from feat/types branch)
- `src/types/hydra-element.d.ts` — type shim for `hydra-element` (ships JS only)
- `src/types/global.d.ts` — global type declarations for hydra sketches
- `src/types/glsl/glsl-functions.d.ts` — GLSL transform catalog types

## Conventions

- TypeScript strict mode everywhere; `@typescript-eslint`
- Backend: bundled by esbuild as **CommonJS** to `out/extension.js` (single file, deps inlined, `vscode` + Node builtins external). CJS is required — the extension host `require()`s extensions whose entry is neither `.mjs` nor `"type": "module"`; ESM-format bundles break on Node 18 hosts and on bundled CJS deps' `require()` calls. This rules out `import.meta`-using ESM-only packages (why `open` was dropped for `vscode.env.openExternal`)
- Runtime: bundled with Rollup; served by `rig-serve`
- ESLint config in `.eslintrc.json` — warns on style issues, no errors
- **`.vscode/tasks.json` ↔ `esbuild.mjs` sync invariant**: the F5 watch task's inline problem matcher tracks the `[esbuild] build started/finished` lines printed by the `watchLogPlugin` in `esbuild.mjs`. Changing either side breaks the preLaunchTask. Do not use `$esbuild-watch` — it requires the `connor4312.esbuild-problem-matchers` extension to be installed (absent here, the F5 launch never completes).
- `demo/` is a playground with examples — not part of the extension
- **Do not add new `hydra.*` settings.** Use `rig.*`. The `hydra.*` namespace is frozen and kept only as backward-compatible fallbacks.

### Runtime dependencies

| Package | Role |
|---|---|
| `@jdomizz/rig-host` | Renderer-side conformance kit (file ref to `../rig/packages/rig-host`) |
| `@jdomizz/rig-relay` | WebSocket fan-out relay (file ref to `../rig/packages/rig-relay`) |
| `@jdomizz/rig-serve` | Static file server (file ref to `../rig/packages/rig-serve`) |
| `@jdomizz/rig-transport` | Wire protocol (file ref to `../rig/packages/rig-transport`) |
| `@jdomizz/rig-capture` | Renderer-side capture core (file ref to `../rig/packages/rig-capture`; source-only `.ts` exports) |
| `hydra-element` | Runtime custom element (file ref to `../hydra-element`) |

`osc-js` is in `devDependencies` (used by `demo/osc-node.js`).

### D5 invariant — no `hydra-synth` direct imports in `src/`

No file in `src/` may import `hydra-synth` directly. The codebase uses `<hydra-element>` exclusively. This is a hard invariant:

```bash
# Must return NOTHING (exit code 1):
git grep "from 'hydra-synth'" src/
```

The legacy webview (`src/frontend/`) was deleted in M4 closure. `hydra-synth` remains a transitive dependency of `hydra-element`; the served runtime page is the sole render surface, mounted either inside a `WebviewPanel` iframe (`rig.renderer: 'webview'`, default) or in the system browser (`rig.renderer: 'external'`). See [Renderer surfaces](#renderer-surfaces) below.

### Renderer surfaces

The plugin mounts the served runtime page in one of two surfaces, controlled by `rig.renderer`:

- **`webview` (default)** — `RuntimeWebviewPanel` creates a `WebviewPanel` whose body is an `<iframe>` pointing at the resolved runtime URL. CSP is derived dynamically from the URL's origin (works for localhost, SSH/WSL tunnels, and VS Code for the Web). No camera/audio/MIDI per [microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568) — set `rig.renderer: 'external'` to use devices.
- **`external`** — `vscode.env.openExternal()` opens the resolved runtime URL in the system browser. Audio/MIDI/camera work normally.

`vscode-hydra.openRuntime` (status bar item / command palette) honors the active renderer. The wire is shared across both mounts — eval, panic, and capture work identically.

## Testing

**vitest** — 131 tests across 11 spec files:

| File | Tests | Covers |
|---|---|---|
| `src/settings.spec.ts` | 7 | Settings resolver (rig.*/hydra.* fallback) — uses `node:test` |
| `src/decorations.spec.ts` | 7 | Eval-flash + error decorations |
| `src/editor/extract.spec.ts` | 14 | Document/line/block/word/expression extraction |
| `src/editor/index.spec.ts` | 14 | EditorService (document, line, block, selection, expression) |
| `src/rig/client.spec.ts` | 11 | RigWire (eval, sendCommand, feedback, lifecycle) |
| `src/rig/supervisor.spec.ts` | 11 | RigProcessSupervisor (in-process + hybrid) |
| `src/capture/pipeline.spec.ts` | 14 | CapturePipeline (image, recording, timeout, malformed feedback) |
| `src/status/index.spec.ts` | 24 | StatusPanel (state, tooltip, feedback, dispose) |
| `src/runtime-bundle.spec.ts` | 5 | Runtime bundle output verification |
| `src/runtime/runtime-conformance.spec.ts` | 23 | Runtime conformance (adapter hooks + rig-host wire protocol) |
| `src/manifest.spec.ts` | 8 | Manifest parity (C1-C6: commands, settings, context keys, README) |

**Playwright** is the planned test runner for the runtime page (Phase 2 / Phase 3 work — served page mounts `<hydra-element>`, dispatches `hydra-ready`, round-trips `rig.eval`).

## Migration: Rig (in progress)

This plugin is migrating to the [Rig](https://github.com/jdomizz/rig) framework. The program is tracked in the workspace program roadmap (private registry at `/home/domi/code/.opencode/specs/roadmap.md`) with milestones M0–M4; the plugin-specific spec index is at `/home/domi/code/.opencode/specs/vscode-hydra/`.

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
| Capture pipeline (`src/capture/`) | ✅ Done — image + recording over wire; runtime downloads the file via the browser (no editor-side HTTP receiver) |
| Settings (`src/settings*.ts`) | ✅ Done — `rig.*` primary, `hydra.*` fallback |
| vitest test suite (131 tests) | ✅ Done |
| `package.json` contributes `rig.*` settings | ✅ Done — 12 rig.* properties + rig.loadScripts (capturePort / captureTimeoutMs removed: capture delivery no longer needs an editor-side HTTP port) |
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

Specs and agent config live in the workspace registry (private, this repo is
not the home of spec docs). The per-project index for vscode-hydra is at
`/home/domi/code/.opencode/specs/vscode-hydra/`; layouts follow the standard
`backlog/ → active/ → archive/` with movement into `archive/` requiring
explicit user approval. This repo does not host a `.opencode/` directory.

When implementing a spec landed in this repo:

1. Move the spec from `backlog/` to `active/` in the registry
2. Implement according to the spec's "Done when" criteria
3. User reviews and approves
4. Move to `archive/` in the registry, append `## Status: accepted` with the commit hash
5. Update this repo's docs if the change affects it: README status, CHANGELOG entry, AGENTS.md
6. Commit the registry repo alongside this repo's commit

Cross-project developments (e.g. the Rig program) are sequenced and decided in
the workspace program roadmap (private); the registry's `roadmap.md` is the
authoritative program index.

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
