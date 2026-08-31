# 🧩 Hydra Code

![demo](./media/demo.gif)

Extension for live coding with the [Hydra](https://hydra.ojack.xyz/) video synthesizer in Visual Studio Code and its forks.

## Status

**Published: 0.3.1** (as "Hydra Live Code") on the VS Marketplace and Open VSX.
**Next: 0.4.0 — "Hydra Code"** — a thin editor shell over the
[Rig](https://github.com/jdomizz/rig) framework, with **two peer renderer
surfaces** — pick the one that fits your workflow:

- **`webview`** (default) — integrated panel next to the editor; no device access. See [Renderer surfaces](#renderer-surfaces) below.
- **`external`** — opens the runtime page in your default browser; camera, audio, and MIDI work there.

Upgrading from 0.3.x? See [Upgrading from 0.3.x](#upgrading-from-03x).

## Documentation

- [CHANGELOG](./CHANGELOG.md) — release history
- [ARCHITECTURE](./ARCHITECTURE.md) — how the extension is put together (the three layers, the rig wire, the renderer surfaces)
- [CONTRIBUTING](./CONTRIBUTING.md) — development: setup, commands, testing, workflow

## Features

- **Webview runtime (default):** integrated panel next to the editor; zero setup; the same served page the browser opens. No camera/audio/MIDI — see [microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568).
- **External runtime (opt-in):** opens the same page in your system browser — full device access (camera, audio reactivity, MIDI).
- **All eval modes:** document, line, selection, block, expression.
- **Eval-flash + diagnostics:** evaluated region flashes ~700ms; errors surface in the Problems panel with mapped positions.
- **Capture over the wire:** `capture:image` (screenshot), `capture:start` / `capture:stop` (video recording). Blobs travel out-of-band over HTTP; control stays on the wire.
- **Status bar:** single item with rig state — relay / HTTP / OSC / MIDI ports, panic, recording. Tooltip lists ports; click opens the runtime URL.
- **OSC:** via `rig-osc-bridge` over the relay (configurable ports).
- **p5.js:** included (same wrapper as the Hydra web editor).

Demo project with examples: [github.com/jdomizz/vscode-hydra/tree/main/demo](https://github.com/jdomizz/vscode-hydra/tree/main/demo).

## Renderer surfaces

The plugin mounts the runtime page in one of two surfaces, controlled by `rig.renderer`:

| Setting | Surface | Pros | Cons |
|---|---|---|---|
| `"webview"` (default) | Integrated VS Code panel (column two) | Canvas next to the editor; no extra windows; zero setup | No camera/audio/MIDI (VS Code permission policy) |
| `"external"` | Your system browser (Chrome / Firefox / Safari) | Full device access (camera, audio, MIDI); second monitor friendly | Alt-tab between editor and browser |

Both surfaces load **the same served runtime page** — the webview mounts it via `<iframe>`, the browser opens it directly. The wire is shared; eval/capture commands work identically from both.

**Choose `webview` if:**
- Your script doesn't need `getUserMedia` or MIDI (geometry, noise, oscillator, feedback — most beginner work).
- You're on one monitor and want the canvas next to your code.

**Choose `external` if:**
- Your script uses the camera (`s0.initCam()`), microphone (`a.setSource()`), or MIDI.
- You want to put the canvas on a second monitor.
- You're in a remote workspace (SSH / WSL / Container) — the browser opens the runtime URL through VS Code's port-forwarding tunnel.

If you switch surfaces mid-session, the change takes effect on the next window reload (or the next time you click the status bar item).

## Switching the renderer

To override the default in your VS Code settings:

```json
{
  "rig.renderer": "external"
}
```

## Install

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jdomizz.vscode-hydra)
- [Open VSX Registry](https://open-vsx.org/extension/jdomizz/vscode-hydra)
- [VSIX file](https://github.com/jdomizz/vscode-hydra/releases)

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
| `rig.renderer` | `"webview"` | Renderer surface — `"webview"` (integrated panel) or `"external"` (browser). See [Renderer surfaces](#renderer-surfaces). |
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

## Upgrading from 0.3.x

0.4.0 brings back the integrated webview panel as the **default** renderer. Where 0.3.x rendered Hydra in a VS Code webview, 0.4.0 ships **both surfaces** — pick whichever fits your workflow. See [Renderer surfaces](#renderer-surfaces) above.

- The webview mount is implemented as an `<iframe>` inside a `WebviewPanel`. It loads the same served runtime page (`<hydra-element>`) the browser opens. No code duplication, no new bundle.
- Camera, audio, and MIDI only work in the **external browser** surface (see [microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568)). Set `rig.renderer: 'external'` if you need those.

### Settings map

| 0.3.1 key | 0.4.0 target | What happens |
|---|---|---|
| `jdomizz.vscode-hydra.width` / `.height` | — | Silently ignored. The runtime window is the browser default; the webview iframe is responsive. |
| `jdomizz.vscode-hydra.loadScripts` | `rig.loadScripts` | Honored as fallback; runtime loads scripts on `ready` via `<hydra-element>`'s global bridge. |
| OSC ports 41234 / 41235 (undocumented setting, README-documented behavior) | `rig.udpIn` / `rig.udpOut` | New defaults are `9000` / `9001`. To keep your SuperCollider / Max / TouchDesigner setup, set `rig.udpIn` / `rig.udpOut` to `41234` / `41235`. |
| (dev-only) sweep-era `hydra.*` | `rig.*` via `KEY_MAP` | Already resolved by `settings-core.ts`; dead keys pruned in 0.4.0. |

### OSC port guidance

If you were using 0.3.x's OSC bridge on the undocumented `41234` (send) / `41235` (receive) ports:

- Update your SuperCollider / Max / TouchDesigner configs to point at the new defaults `9000` (in) / `9001` (out), **or**
- Set `rig.udpIn: 41234` and `rig.udpOut: 41235` in your VS Code settings to keep the old behavior.

The new defaults were chosen to avoid collision with the served runtime's HTTP port (`8080`).

### Renderer toggle

`rig.renderer` defaults to `'webview'` (integrated panel). To open the runtime in your system browser with full device access, set `rig.renderer: 'external'`. The change takes effect on the next window reload, or the next time you click the status bar item. See [Renderer surfaces](#renderer-surfaces).

### Deprecated commands

The following 0.3.x commands are still in the palette but are now informational no-ops:

- `hydra.startOscBridge`, `hydra.stopOscBridge` — the rig supervisor starts the OSC bridge automatically; these are no-ops.
- `hydra.startHttpServer`, `hydra.stopHttpServer` — same; the HTTP server (which serves the runtime page) starts automatically.

They will be removed in a future minor version. For now, they exist to preserve muscle-memory.

### What's new notification

On first activation of 0.4.0, you'll see a one-time notification with this same content. To suppress, set `vscode-hydra.suppressWhatsNew: true` in your settings (or run `vscode-hydra.dismissWhatsNew`).

## Issues

Camera, microphone, screen capture, and MIDI do not work inside the default webview surface due to the VS Code permissions policy ([microsoft/vscode#250568](https://github.com/microsoft/vscode/issues/250568)). Set `rig.renderer: 'external'` to open the runtime in your system browser with full device access. See [Renderer surfaces](#renderer-surfaces).

If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.
