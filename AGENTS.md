# AGENTS.md

## Commands

- `npm run compile` — compile backend (tsc) + frontend (rollup) to `out/`
- `npm run compile:backend` — compile TypeScript backend only (`tsc`)
- `npm run compile:frontend` — bundle frontend only (`rollup -c`)
- `npm run watch` — watch backend TypeScript changes (`tsc -watch`)
- `npm run lint` — lint `src/` with ESLint
- `npm run package` — package as VSIX (`vsce package`)
- `npm run test:osc` — run demo OSC node (`node demo/osc-node.js`)

## Architecture

VS Code extension for live coding with Hydra video synthesizer.

Two compilation targets:
- **Backend** (`src/**/*.ts`) — TypeScript, compiled by `tsc` to `out/`. Extension entry: `src/extension.ts` → `out/extension.js`
- **Frontend** (`src/frontend/*.ts`) — TypeScript, bundled by Rollup to `out/frontend/main.js`. Runs inside webview panel.

Backend modules:
- `src/extension.ts` — activation, command registration
- `src/backend/panel.ts` — webview panel management
- `src/backend/editor.ts` — document/line/block extraction
- `src/backend/osc.ts` — OSC bridge service

Frontend modules (webview):
- `src/frontend/main.ts` — entry point
- `src/frontend/hydra.ts` — Hydra synth wrapper
- `src/frontend/canvas.ts` — canvas management
- `src/frontend/osc.ts` — OSC in webview
- `src/frontend/recorder.ts` — video recording
- `src/frontend/p5.ts` — p5.js wrapper

Type definitions:
- `src/types/hydra-synth.d.ts` — hydra-synth DSL types (from feat/types branch)
- `src/types/global.d.ts` — global type declarations for hydra sketches
- `src/types/glsl/glsl-functions.d.ts` — GLSL transform catalog types

## Conventions

- Backend: TypeScript, strict mode, `@typescript-eslint`
- Frontend: TypeScript, strict mode, bundled with Rollup
- ESLint config in `.eslintrc.json` — warns on style issues, no errors
- Runtime dependencies: `hydra-synth`, `osc-js`, `p5`
- `demo/` is a playground with examples — not part of the extension
- OSC ports: `41234` send, `41235` receive (bridge mode)
- **Do not add new `hydra.*` settings.** Phase 0 introduces `rig.*` settings alongside the existing `hydra.*` ones. The `hydra.*` settings remain as backward-compatible fallbacks; `rig.*` become the primary settings in Phase 2 (v1.0). New configuration belongs under `rig.*`.

## Migration: Rig (in progress)

This plugin is migrating to the [Rig](https://github.com/jdomizz/rig) framework. The program is tracked in the workspace program roadmap (`.opencode/specs/roadmap.md` at the workspace root) with milestones M0–M4; the plugin-specific spec is `.opencode/specs/backlog/rig-plugin-rewrite.md`.

- **M0 (current):** Plugin Phase 0 — pre-Rig coherence. Single status panel, kill legacy double-OSC stack, remove 500ms readiness sleeps, add `rig.*` settings alongside `hydra.*`, fix documentation drift.
- **M1:** Rig published — the six `@jdomizz/rig-*` packages on npm.
- **M2:** Wire freeze — generic wire core + `panic` + `capture:*` plugin extension.
- **M3:** Plugin Phase 2 — v1.0 rewrite. Three-layer architecture (editor shell / rig transport / renderer), one frontend two mounts (webview quick-preview + plugin-served runtime page in external browser), `<hydra-element>` replaces direct `hydra-synth` usage.
- **M4:** Publish vscode-hydra v1.0.

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
