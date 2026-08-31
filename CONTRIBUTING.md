# Contributing

Development guide for Hydra Code. Using the extension?
[README.md](./README.md) is enough. How it's built:
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Setup

```sh
git clone https://github.com/jdomizz/vscode-hydra
cd vscode-hydra
npm install
npm run compile
```

Open the folder in VS Code and press **F5** to launch the
Extension Development Host (the preLaunchTask runs the esbuild watcher).

Note: the runtime deps on `@jdomizz/rig-*` and `hydra-element` currently use
local `file:` references into sibling checkouts (`../rig`, `../hydra-element`).
Clone those alongside, or swap the refs for npm versions once published.

## Commands

| Command | Purpose |
|---|---|
| `npm run compile` | Production build: esbuild CJS bundle (`out/extension.js`) + Rollup runtime bundle (`out/runtime/`) |
| `npm run compile:dev` | Dev build (sourcemaps, no minify) + runtime bundle |
| `npm run compile:runtime` | Runtime bundle only |
| `npm run watch` | esbuild watch on the backend bundle |
| `npm run lint` | ESLint on `src/` |
| `npm test` | vitest (131 tests, 11 files) |
| `npm run package` | Package as VSIX (`vsce package`) |
| `npm run test:osc` | Run the demo OSC node (`demo/osc-node.js`) |

## Testing notes

- vitest runs in Node; `vscode` is mocked (`src/__mocks__/vscode.ts`).
- The Playwright runtime test targets the served page — it needs the built
  runtime bundle (`npm run compile:runtime`) and a real chromium
  (`npx playwright install chromium`).
- `src/manifest.spec.ts` is the drift guard: declared surface vs registered
  code. If your change adds a command/setting/keybinding, the test must know.

## Workflow

- **Branches:** work happens on feature branches off `dev`; `dev` is the
  integration line. **`main` is human-only** (it feeds the VS Marketplace),
  and **tags are human-only** — agents and contributors prepare on `dev`,
  never push tags or `main`.
- **Spec workflow:** specs and the roadmap live in the workspace registry
  (private), not in this repo — see `AGENTS.md` for the pointer and the
  move flow (`backlog → active → archive`, archive requires owner approval).
- **Language:** code, docs, and commits in **English**; chat replies in the
  user's language.
- **Commits:** conventional commits, one feature per commit.

## Before you call it done

Update the docs the change actually touches — `CHANGELOG.md` (entry under
`## [Unreleased]`), `README.md` (features/usage), `ARCHITECTURE.md`
(implementation shape), `CONTRIBUTING.md` (commands/workflow), `AGENTS.md`
(agent-facing facts). No padding — only what the change affects.
