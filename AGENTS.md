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
- **Frontend** (`src/frontend/*.js`) — plain JS, bundled by Rollup to `out/frontend/main.js`. Runs inside webview panel.

Backend modules:
- `src/extension.ts` — activation, command registration
- `src/backend/panel.ts` — webview panel management
- `src/backend/editor.ts` — document/line/block extraction
- `src/backend/osc.ts` — OSC bridge service

Frontend modules (webview):
- `src/frontend/main.js` — entry point
- `src/frontend/hydra.js` — Hydra synth wrapper
- `src/frontend/canvas.js` — canvas management
- `src/frontend/osc.js` — OSC in webview
- `src/frontend/recorder.js` — video recording
- `src/frontend/p5.js` — p5.js wrapper

## Conventions

- Backend: TypeScript, strict mode, `@typescript-eslint`
- Frontend: plain JS (no TypeScript), ES modules
- ESLint config in `.eslintrc.json` — warns on style issues, no errors
- Runtime dependencies: `hydra-synth`, `osc-js`, `p5`
- `demo/` is a playground with examples — not part of the extension
- OSC ports: `41234` send, `41235` receive (bridge mode)

## Publishing

CI publishes to GitHub Releases, OpenVSX, and VS Marketplace on `v*` tags (`.github/workflows/publish.yml`).

## Workflow

Specs live in `dev/roadmap/`:

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
4. Move to `archive/`
5. Update docs if needed: README status with commit hash, CHANGELOG entry, and AGENTS.md if the implementation changes commands, dependencies, architecture, or workflow

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
