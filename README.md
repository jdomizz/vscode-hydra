# 🧩 Hydra Live Code

![demo](./media/demo.gif)

Extension for live coding with the [Hydra](https://hydra.ojack.xyz/) video synthesizer in Visual Studio Code and its forks.

## Status

**v0.4.x is the last release of the standalone webview plugin.** Version 1.0 (in development on `lane/F-plugin-v1`) is a thin editor shell over the [Rig](https://github.com/jdomizz/rig) framework. The **external browser runtime** is the primary render surface — camera, audio, and MIDI all work there. The webview stays as a contained quick-preview (no device access — see [microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568)).

See the [plugin rewrite spec](.opencode/specs/active/rig-plugin-rewrite.md) and the [program roadmap](https://github.com/jdomizz/vscode-hydra/blob/main/.opencode/specs/roadmap.md) for details.

## Architecture

The plugin is three layers:

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
│    external browser runtime (primary) ← rig-serve           │
│    webview quick-preview (fallback, no devices)             │
└─────────────────────────────────────────────────────────────┘
```

- **Editor shell** — commands, document/line/block/selection/expression extraction, eval-flash decorations, diagnostics (Problems panel), single status bar item, capture pipeline.
- **Rig wire** — `RigWire` wraps `TransportClient` from `@jdomizz/rig-transport`. One JSON-over-WS protocol; no socket.io, no stdio framing, no WebRTC.
- **Renderer** — the plugin serves a runtime page at `http://localhost:<httpPort>/runtime/` that mounts `<hydra-element>` (D5: the runtime frontend never imports `hydra-synth` directly). Open it in a real browser for full device access. The webview remains as a contained quick-preview.

## Features

- **External runtime (primary):** camera, audio reactivity, MIDI — all work in a real browser.
- **Webview (quick-preview):** contained inside VS Code; no camera/audio/MIDI per the VS Code permissions policy.
- **All eval modes:** document, line, selection, block, expression.
- **Eval-flash + diagnostics:** evaluated region flashes ~700ms; errors surface in the Problems panel with mapped positions.
- **Capture over the wire:** `capture:image` (screenshot), `capture:start` / `capture:stop` (video recording). Blobs travel out-of-band over HTTP; control stays on the wire.
- **Status bar:** single item with rig state — relay / HTTP / OSC / MIDI ports, panic, recording. Tooltip lists ports; click opens the runtime URL.
- **OSC:** via `rig-osc-bridge` over the relay (configurable ports).
- **p5.js:** included (same wrapper as the Hydra web editor).

Demo project with examples: [github.com/jdomizz/vscode-hydra/tree/main/demo](https://github.com/jdomizz/vscode-hydra/tree/main/demo).

## Install

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jdomizz.vscode-hydra)
- [Open VSX Registry](https://open-vsx.org/extension/jdomizz/vscode-hydra)
- [VSIX file](https://github.com/jdomizz/vscode-hydra/releases)

> **Note:** v0.4.x is the current published version. v1.0 (M3) is in development.

## Commands

- `Ctrl/Cmd + Shift + Enter`: Eval the active JavaScript document.
- `Ctrl/Cmd + Alt + Enter`: Eval a line (or a selection) of code.
- `Alt + Enter`: Eval a block of code.
- `Ctrl/Cmd + Shift + S`: Take a screenshot of the canvas.
- `Ctrl/Cmd + Shift + V`: Start or stop video recording the canvas.

## Settings

Primary namespace: `rig.*`. Legacy `hydra.*` settings continue to work as fallbacks.

| Setting | Default | Description |
|---|---|---|
| `rig.instrument` | `"sweep"` | Instrument (`"sweep"`, future `"cycles"`) |
| `rig.target` | `"default"` | Runtime profile → `?context=` URL param (`"sweep"` / `"hydra"` / `"default"`) |
| `rig.relayPort` | `9163` | WebSocket relay port |
| `rig.httpPort` | `8080` | HTTP server port (serves runtime page + workspace assets) |
| `rig.udpIn` | `9000` | OSC UDP in port |
| `rig.udpOut` | `9001` | OSC UDP out port |
| `rig.midiEnabled` | `false` | Enable MIDI bridge |
| `rig.relayPath` | `"rig-relay"` | Path to external relay binary (hybrid mode) |
| `rig.servePath` | `"rig-serve"` | Path to external serve binary (hybrid mode) |
| `rig.oscBridgePath` | `"sweep-osc-bridge"` | Path to OSC bridge binary |
| `rig.midiBridgePath` | `"sweep-midi-bridge"` | Path to MIDI bridge binary |
| `rig.sweepCliPath` | `"sweepctl"` | Path to sweepctl executable |
| `rig.httpServerPath` | `"sweep-http"` | Path to HTTP server binary |

When `rig.*Path` settings are left at their defaults, the plugin runs rig services **in-process** (zero prerequisites). Point a `*Path` setting at an external binary to switch to hybrid mode.

## Scripts

Hydra [extensions](https://github.com/hydra-synth/hydra-extensions) and external JavaScript libraries can be loaded using Hydra's `loadScript` function or via the `rig.loadScripts` configuration option (legacy `hydra.loadScripts` also works):

```json
{
    "rig.loadScripts": [
        "https://unpkg.com/tone",
        "https://hyper-hydra.glitch.me/hydra-gif.js"
    ]
}
```

## p5.js

This extension includes the same wrapper for [p5.js](https://p5js.org) as the Hydra web editor. You can check how to use it in the Hydra [documentation](https://hydra.ojack.xyz/docs/docs/learning/extending-hydra/extending-hydra/#p5js).

## Assets

Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension to serve assets from your project folder. This way you can use local images and videos.

```js
s0.initImage('http://localhost:5500/image/hydra.jpg')
```

## Issues

Camera, microphone, screen capture, and MIDI do not work inside the VS Code webview due to the permissions policy ([microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568)). Use the **external browser runtime** (click the status bar item → "Open runtime") for full device access.

If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.
