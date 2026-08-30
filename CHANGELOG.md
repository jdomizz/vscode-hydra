# Change Log

All notable changes to the `vscode-hydra` extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1.0 (M3 plugin rewrite)

### Added
- Rig framework integration: `@jdomizz/rig-transport` consumed as library
- External browser runtime as primary render surface (`<hydra-element>`, served by `rig-serve`)
- Single status bar item with rig state (relay/http/osc/midi ports, panic, recording)
- Eval-flash decoration + diagnostics (Problems panel integration)
- Capture pipeline: `capture:image|start|stop` over wire + out-of-band HTTP blobs
- `rig.*` settings namespace with `hydra.*` fallback (`rig.instrument`, `rig.target`, `rig.relayPort`, `rig.httpPort`, `rig.udpIn/Out`, `rig.midiEnabled`, `rig.*Path`)
- `RigProcessSupervisor`: in-process rig-relay + rig-serve by default; hybrid mode via `rig.*Path` settings
- `RuntimeContext` interface for runtime pages
- vitest test suite (86 tests across 8 files)

### Changed
- Plugin is now a thin editor shell — no longer renders Hydra itself in production
- Settings: `rig.*` primary; `hydra.*` deprecated (kept as fallbacks)
- Old OSC bridge stack removed (was double-bind 8080 + sweep-osc-bridge)
- `setTimeout(500)` occult waits replaced with event-driven ready detection

### Migration
- Existing `hydra.*` settings continue to work via fallback resolution
- Wire JSON shape unchanged for eval/eval:code/etc; new wire commands `panic` and `capture:*` available
- Renderer recommended: external browser; webview still works as quick-preview

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