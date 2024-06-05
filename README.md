# 🧩 Hydra for Visual Studio Code

![demo](./media/demo.gif)

This extension is for [live coding](https://en.wikipedia.org/wiki/Live_coding) with [Hydra](https://hydra.ojack.xyz/) in Visual Studio Code. 
- Includes [p5.js](https://p5js.org).
- Allows loading Hydra [extensions](https://github.com/hydra-synth/hydra-extensions) and external libraries.
- Supports [OSC](https://en.wikipedia.org/wiki/Open_Sound_Control) channels.

## Features

This extension contributes the following commands:

- `Ctrl/Cmd + Shift + Enter`: Eval the code of the active JavaScript document.
- `Ctrl/Cmd + Alt + Enter`: Eval a line (or a selection) of the active JavaScript document.
- `Alt + Enter`: Eval a block of the active JavaScript document.
- `Ctrl/Cmd + Shift + S`: Take a screenshot of the canvas.
- `Ctrl/Cmd + Shift + V`: Start or stop video recording the canvas.

## Settings

This extension contributes the following settings:

* `jdomizz.vscode-hydra.width`: Set the width of the canvas.
* `jdomizz.vscode-hydra.height`: Set the height of the canvas.
* `jdomizz.vscode-hydra.loadScripts`: Set the list of scripts to be loaded at startup.

Example:

```json
"jdomizz.vscode-hydra.width": 1024,
"jdomizz.vscode-hydra.height": 1024,
"jdomizz.vscode-hydra.loadScripts": [
    "https://cdn.statically.io/gl/metagrowing/extra-shaders-for-hydra/main/lib/all.js",
    "https://unpkg.com/tone"
]
```

## Issues

Microphones, webcams, and MIDI do not work due to the Visual Studio Code permissions policy.
If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.

