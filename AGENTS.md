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

## Agent integration policy

**No AI agent merges, fast-forwards, force-pushes, or directly commits to `main` — ever.** The agent workflow here is:

1. **Branches for work.** AI agents create feature branches off `dev` (e.g. `feat/webview-mount`, `chore/esbuild-cjs`, `lane/F-plugin-v1` for the M3 lane) and iterate there.
2. **Integration target = `dev`.** When the work is approved, the agent opens a PR or merges the feature branch into `dev`. This includes the M3 work on `lane/F-plugin-v1` — it merges to `dev`, not `main`.
3. **`main` is human-only.** `main` only receives merges from a human reviewer. Once `main` is published (the 0.4.0 publish), downstream VS Marketplace consumers pick it up; a bad agent commit there is hostile to consumers.
4. **Tags are human-only.** Releasing a tag (e.g. `v0.4.0`) is a human-driven action; agents prepare on `dev` but never push the tag.

The currently active branch should always be a feature branch or `dev`. If you find yourself sitting on `main` with uncommitted work, switch to a feature branch first (`git switch -c <topic>`) and replay the work there before pushing. Same rule across every repo in the workspace — see root AGENTS.md for the canonical statement.

## Architecture

VS Code extension for live coding with the Hydra video synthesizer — a thin editor shell over the Rig wire. Three layers: **editor shell** (commands, extraction, diagnostics, status panel, capture pipeline) / **rig wire** (`RigWire` over `TransportClient`; `RigProcessSupervisor` starts relay + serve in-process) / **renderer** (a served runtime page mounting `<hydra-element>`, mounted in a webview iframe by default or in the system browser via `rig.renderer`).

Full map, invariants, and file index: [ARCHITECTURE.md](./ARCHITECTURE.md). Dev setup and commands: [CONTRIBUTING.md](./CONTRIBUTING.md).

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

The legacy webview (`src/frontend/`) was deleted during the rewrite's P0 closure. `hydra-synth` remains a transitive dependency of `hydra-element`; the served runtime page is the sole render surface, mounted in a webview iframe (default) or the system browser — details in [ARCHITECTURE.md](./ARCHITECTURE.md).

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

## Release status — Rig rewrite → 0.4.0

The Rig rewrite is complete on `dev` (local `package.json` = **0.4.0**, `displayName: "Hydra Code"`). The published surface is 0.3.1 "Hydra Live Code" (both marketplaces). The next release is **0.4.0 = R3 of the workspace release chain** (private registry, `.opencode/specs/common/roadmap.md`): it consumes hydra-element + the five `@jdomizz/rig-*` packages from npm (R1/R2, user-gated on `npm login`), completes the "Hydra Code" rename with a new logo (decision θ), and ships through a staged rc window.

Program history: M0 (pre-Rig coherence, `906e772`), wire freeze + rig-host/rig-capture (rig side), M3 rewrite (`914859c`, `3fdbd6c`, `147c26a`, merged to `dev` as `c20d169`). P0 of the release spec (manifest truth, supervisor wiring, runtime bundling, dead-code deletion, parity test) is closed; P1–P4 remain. Release spec: `.opencode/specs/vscode-hydra/active/release-0.4.0.md`.

### Rig boundary rule (κ)

**No rig-responsibility code lives in this repo.** If you find any (process supervision, wire plumbing, server lifecycle that is engine-agnostic), it gets extracted via a proposal — never refactored in place as if it were plugin code. Before implementing generic plumbing here, check whether rig already offers it, analyze whether rig should own it, and propose to the user first. Audit spec: `.opencode/specs/common/active/rig-boundary-audit.md`.

### Settings deprecation path

| Setting | Status |
|---|---|
| `hydra.*` (existing) | Frozen. Remain as backward-compatible fallbacks. No new settings added here. |
| `rig.*` (Phase 0+) | Primary. New settings go here. The only namespace in 0.4.0 (with `hydra.*` read as silent fallbacks). |

Contributors: when adding configuration, use `rig.*`. The `hydra.*` namespace is read-only compatibility surface.

## Publishing

CI publishes to GitHub Releases, OpenVSX, and VS Marketplace on `v*` tags (`.github/workflows/publish.yml`). The 0.4.0 rollout is staged first: `v*-rc.*` tags build a VSIX attached to a GitHub Release only; stable `v*` tags hit both marketplaces (release spec P1).

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
5. Update this repo's docs if the change affects them: CHANGELOG, README, ARCHITECTURE, CONTRIBUTING, AGENTS — only the ones the change actually touches
6. Commit the registry repo alongside this repo's commit

Cross-project developments (e.g. the Rig program) are sequenced and decided in
the workspace program roadmap (private); the registry's `common/roadmap.md` is
the authoritative program index.

When a spec (or any feature/fix) is finished and approved, **update the docs** before considering it done:

- **CHANGELOG** — add an entry describing the change (follow its existing format)
- **README** — reflect any new/changed features, usage, or status
- **ARCHITECTURE** — amend if the implementation shape changed
- **CONTRIBUTING** — amend if setup, commands, or workflow changed
- **AGENTS** — amend if commands, dependencies, architecture, or workflow changed
- Only update each doc if it's actually affected by the change; don't pad with noise

**Important:** Specs can only move to `archive/` after explicit user approval, even if implementation is complete.

## Language conventions

- **Project language: English** — All code, docs, and commits are in English
- **Agent responses**: Respond in the user's language when chatting
- **Code artifacts**: Always in English (variable names, comments, commit messages)
