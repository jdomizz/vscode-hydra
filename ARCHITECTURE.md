# Architecture

How Hydra Code is put together — the human-readable implementation map.
Agent quick reference: [AGENTS.md](./AGENTS.md). How to hack on it:
[CONTRIBUTING.md](./CONTRIBUTING.md).

## The three layers

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

The plugin is a **bridge, not a framework**: a thin editor shell over the
[Rig](https://github.com/jdomizz/rig) wire protocol. The wire is the
platform; runtime pages are clients.

### Layer 1 — Editor shell

- `src/extension.ts` — activation, command registration, wires all modules
- `src/editor/extract.ts` — document/line/block/selection/expression
  extraction (pure); `src/editor/index.ts` — the `EditorService` VS Code glue
- `src/decorations.ts` — eval-flash + error decorations
- `src/diagnostics.ts` — `vscode.Diagnostic` collection (Problems panel)
- `src/status/index.ts` — `StatusPanel`: single status bar item (rig state,
  ports tooltip, open-runtime link), sets the `vscode-hydra.status` context
  key
- `src/capture/pipeline.ts` — `capture:image|start|stop` over the wire; the
  runtime page delivers files as browser downloads

### Layer 2 — Rig wire

- `src/rig/client.ts` — `RigWire`, a thin wrapper over `TransportClient`
  from `@jdomizz/rig-transport`
- `src/rig/supervisor.ts` — `RigProcessSupervisor`: starts relay + serve
  **in-process** by default (zero prerequisites); hybrid mode spawns external
  binaries via the `rig.*Path` settings; on `EADDRINUSE` the in-process
  services fall back to an OS-assigned port so multiple windows coexist
- `src/settings-core.ts` — pure settings resolver (`rig.*` primary,
  `hydra.*` legacy fallback); `src/settings.ts` — VS Code configuration

### Layer 3 — Renderer

- `src/runtime/index.html` + `src/runtime/main.ts` — the served runtime page;
  mounts `<hydra-element>` and connects via `@jdomizz/rig-host`'s
  `createRigHost`
- `src/runtime/adapter.ts` — `createHydraEngine(el)`: bridges
  `<hydra-element>` to rig-host's `HostEngine` seam
- `src/webview/panel.ts` — `RuntimeWebviewPanel`: a `WebviewPanel` whose body
  is an `<iframe>` loading the same served runtime page (CSP derived from the
  resolved URL's origin — works for localhost, SSH/WSL tunnels, VS Code for
  the Web)

**One frontend, two mounts.** `rig.renderer` picks the surface: `'webview'`
(default — integrated panel, no devices per
[microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568))
or `'external'` (system browser — camera/audio/MIDI work). No duplicated
logic: both mounts load the same page on the same wire.

### Type definitions (`src/types/`)

`hydra-synth.d.ts` (DSL types), `hydra-element.d.ts` (shim for the
JS-only package), `global.d.ts` (sketch globals), `glsl/glsl-functions.d.ts`
(transform catalog).

## Invariants

- **D5 — no `hydra-synth` direct imports in `src/`.** The codebase uses
  `<hydra-element>` exclusively; `hydra-synth` is a transitive dependency of
  it. Guard: `git grep "from 'hydra-synth'" src/` must return nothing.
- **Backend bundles as CommonJS** (esbuild → `out/extension.js`, deps
  inlined, `vscode` + Node builtins external). The extension host `require()`s
  extensions; ESM-format bundles break on Node 18 hosts. This rules out
  `import.meta`-using ESM-only packages (why `open` was dropped for
  `vscode.env.openExternal`).
- **Runtime bundles with Rollup** (`out/runtime/`), served by
  `@jdomizz/rig-serve`.
- **No new `hydra.*` settings** — the namespace is frozen legacy fallback;
  new configuration goes in `rig.*`.
- **Manifest parity** — every declared command/keybinding/setting is backed
  by registered code, enforced by `src/manifest.spec.ts`.
- **Rig boundary (κ)** — no rig-responsibility code lives here; extractions
  go through a proposal. See the workspace root `AGENTS.md`.

## Dependencies

Runtime deps (npm after R1/R2; `file:` refs until then):
`@jdomizz/rig-{transport,relay,serve,host,capture}` + `hydra-element` +
`ws`. `osc-js` is dev-only (`demo/osc-node.js`).

## Testing

vitest, 131 tests across 11 spec files (settings resolver, decorations,
extraction, EditorService, RigWire, supervisor, capture pipeline,
StatusPanel, runtime bundle output, runtime conformance, manifest parity).
Playwright covers the served runtime page (mounts `<hydra-element>`,
dispatches `hydra-ready`, round-trips `rig.eval`).

## Release shape

CI (`.github/workflows/publish.yml`) builds on tags: `v*-rc.*` → VSIX on a
GitHub Release only (beta window); stable `v*` → GitHub Release + OpenVSX +
VS Marketplace. Release program: `.opencode/specs/vscode-hydra/active/release-0.4.0.md`
(private registry).
