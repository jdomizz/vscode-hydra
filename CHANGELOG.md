# Change Log

All notable changes to the `vscode-hydra` extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1.0 (M3 plugin rewrite)

### Added
- Rig framework integration: `@jdomizz/rig-transport` consumed as library
- `@jdomizz/rig-host` (file: ref to `../rig/packages/rig-host`) — renderer-side conformance kit (`createRigHost`, `HostEngine` seam)
- `@jdomizz/rig-relay` (file: ref) — in-process WebSocket relay spawned by supervisor
- `@jdomizz/rig-serve` (file: ref) — static server for the runtime bundle
- External browser runtime as primary render surface (`<hydra-element>`, served by `rig-serve`)
- **Dual-mount renderer** (`dual-mount-renderer.md`): `WebviewPanel` containing an `<iframe>` that loads the same served runtime page. `rig.renderer: 'webview'` (default) opens an integrated panel next to the editor; `'external'` opens the system browser. One frontend, two mounts — zero code duplication. D5 preserved (no `hydra-synth` direct imports).
- One-time info notification when the webview mount is active (module-level flag, fires once per activation) explaining the device-access limitation and pointing to `rig.renderer: 'external'`.
- Runtime page now uses `@jdomizz/rig-host`'s `createRigHost` instead of hand-rolled conformance (`src/runtime/main.ts`, `src/runtime/adapter.ts`)
- Rollup runtime bundle: `src/runtime/` → `out/runtime/` (single-file output served by `rig-serve`)
- Single status bar item with rig state (relay/http/osc/midi ports, panic, recording)
- Eval-flash decoration + diagnostics (Problems panel integration)
- Capture pipeline: `capture:image|start|stop` over wire. **Delivery is browser download** in the runtime page (`URL.createObjectURL` + anchor click); the editor pipeline is fire-and-forget for `capture:image` and round-trips `capture:state` for `start`/`stop` (status bar recording indicator). No HTTP server in the editor; no port conflicts; no workspace-storage round-trip. Files land in the browser's Downloads folder — `hydra-capture-<ts>.png` / `hydra-recording-<ts>.webm`.
- `rig.*` settings namespace with `hydra.*` fallback (`rig.instrument`, `rig.target`, `rig.renderer`, `rig.relayPort`, `rig.httpPort`, `rig.udpIn/Out`, `rig.midiEnabled`, `rig.*Path`)
- `RigProcessSupervisor`: in-process rig-relay + rig-serve by default; hybrid mode via `rig.*Path` settings; wired at activation with manifest reconciliation
- Activation wires `RigProcessSupervisor` + rig commands end-to-end (`src/extension.ts`)
- `RuntimeContext` interface for runtime pages
- m4 P2 compatibility shims for 0.3.x → v1.0 upgrade:
  - `rig.renderer: 'webview' | 'external'` toggle (default `webview` — integrated panel; `external` — browser with full device access). See `README.md → Renderer surfaces`.
  - `jdomizz.vscode-hydra.loadScripts` honored as `rig.loadScripts` fallback (silent); `width` / `height` silently ignored
  - 4 deprecated `hydra.*` commands re-registered as informational no-op aliases (`startOscBridge` / `stopOscBridge` / `startHttpServer` / `stopHttpServer`) — clicking them shows an info message pointing to the rig supervisor + README migration section
  - One-time "What's new in v1.0" notification on first activation (globalState-keyed; `WHATS_NEW_VERSION` constant re-triggers on v1.1, etc.)
  - One-time settings-migration notice when any 0.3.x `jdomizz.vscode-hydra.*` key is detected
- Stage 2-4 of `rig-process-supervisor.md`: `src/rig/relay-server.ts` deleted; inline `RelayServer` and `InProcessServe` swapped for `@jdomizz/rig-relay` / `@jdomizz/rig-serve` via `file:` deps
- vitest test suite (124 tests across 11 files)
- `README.md` "Upgrading from 0.3.x" section: settings map, OSC port guidance (41234/41235 → 9000/9001), renderer toggle note, what's new cross-ref
- `README.md` "Renderer surfaces" section: dual-mount explanation, when to use `webview` vs `external`, switching instructions
- `src/manifest.spec.ts` — 8 structural parity tests (C1 commands, C2 KEY_MAP, C3 context keys, C4 README `rig.*` mentions, C5 deprecated aliases, C6 hybrid binary paths)

### Changed
- Plugin is now a thin editor shell — no longer renders Hydra itself in production
- Settings: `rig.*` primary; `hydra.*` deprecated (kept as fallbacks)
- Old OSC bridge stack removed (was double-bind 8080 + sweep-osc-bridge)
- `setTimeout(500)` occult waits replaced with event-driven ready detection
- D5 invariant generalized: no `hydra-synth` direct imports anywhere in `src/`; legacy webview (`src/frontend/*`) deleted — `src/` is now exclusively editor shell + rig wire + served runtime
- Backend bundled with esbuild as **CommonJS** (`out/extension.js`) — the format the VS Code extension host `require()`s. Replaces the tsc multi-file output (whose ESM syntax and extensionless imports broke activation) and an interim ESM bundle that relied on Node ≥22.12 `require(esm)` and a `createRequire` banner (broke on Node 18 hosts with `SyntaxError`, and on `ws`'s `require("events")` with `Dynamic require of "events" is not supported`)

### Fixed
- Extension failed to activate when launched with F5: `Dynamic require of "events" is not supported` (esbuild `__require` shim inside the ESM bundle of `ws`). Root cause + fix: CJS bundling (see Changed)
- `open` npm package dropped from activation path — `vscode.env.openExternal` opens the runtime page instead. `open` spawned a browser on the remote host in remote workspaces (silently failing on headless servers) and its top-level `import.meta` usage made CJS bundling impossible
- Runtime page 404: the in-process HTTP server served `process.cwd()` (the extension host's cwd — not the workspace, not the extension dir) while the extension opened `/runtime/index.html`. `RigProcessSupervisor` now takes `serveRoot` and the extension passes `<extensionPath>/out`, where `out/runtime/index.html` actually lives
- F5 launch never completed: the watch task used `$esbuild-watch`, a problem matcher provided by the `connor4312.esbuild-problem-matchers` extension (not installed) — without it VS Code cannot track the background preLaunchTask. Replaced with a self-contained inline matcher in `.vscode/tasks.json` driven by `[esbuild] build started/finished` log lines from a plugin in `esbuild.mjs` (errors land in the Problems panel as `file(line,col): error: msg`)
- Remote workspaces (SSH/WSL/web) got `ERR_CONNECTION_REFUSED` on the runtime page: the extension opened `http://127.0.0.1:<port>/...` in the user's browser, but the rig servers listen on the remote machine's localhost. Both the runtime page URL and the relay `ws://` URL are now resolved via `vscode.env.asExternalUri`, which establishes VS Code port-forwarding tunnels (the ws URL is tunneled through an http probe and scheme-swapped, since `asExternalUri` only supports http/https). Local workspaces are unaffected (no-op passthrough)
- Second F5 window on the same workspace never activated (silent hang): the in-process servers' start promises never settled on `EADDRINUSE` (fixed in `@jdomizz/rig-relay` / `@jdomizz/rig-serve` — listen errors now reject). `RigProcessSupervisor` additionally falls back to an OS-assigned port when the configured `rig.relayPort` / `rig.httpPort` is busy, so multiple windows work concurrently; the status panel shows the actually-bound ports. Note: an HTTP request to the relay port (e.g. clicking it in the Ports panel) answers `WebSockets request was expected` — that is the relay correctly refusing plain HTTP, not an error

### Removed
- `hydra-synth`, `p5` as direct dependencies (now transitive via `hydra-element`)
- Legacy webview files: `src/frontend/{main,hydra,canvas,osc,recorder,p5}.ts`
- Inline `RelayServer` (32 LoC in `src/rig/relay-server.ts`) — replaced by `@jdomizz/rig-relay` package
- Inline `InProcessServe` (~100 LoC) + `MIME_TYPES` / `getMimeType` / `setCorsHeaders` (~30 LoC) in `src/rig/supervisor.ts` — replaced by `@jdomizz/rig-serve`'s `createHttpServer`

### Deprecated (preserved for 0.3.x muscle memory)
- 4 `hydra.*` commands: `startOscBridge`, `stopOscBridge`, `startHttpServer`, `stopHttpServer` — informational no-ops; the rig supervisor starts these services automatically. To be deleted in `v1.1`.

### Migration
- Existing `hydra.*` settings continue to work via fallback resolution
- Wire JSON shape unchanged for eval/eval:code/etc; new wire commands `panic` and `capture:*` available
- Renderer: external browser only; legacy webview removed

## [0.3.0] - 2026-05-11

### Added

- GitHub Action to publish the extension on the Visual Studio Marketplace and the Open VSX Registry, and attach it to the GitHub release

## [0.2.0] - 2024-06-07

### Added

- Command to eval a line (or a selection) of code.
- Command to eval a block of code.
- Setting to load scripts at startup.
- Global `_hydra` reference for extensions.
- P5 wrapper.
- OSC support.

## [0.1.0] - 2024-04-09

### Added

- Command to eval the code of the active JavaScript document.
- Command to take a screenshot of the canvas.
- Command to start video recording of the canvas.
- Command to stop video recording of the canvas.
- Setting for the width of the canvas.
- Setting for the height of the canvas.