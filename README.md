# 🧩 Hydra Live Code

![demo](./media/demo.gif)

Extension for live coding with [Hydra](https://hydra.ojack.xyz/) in Visual Studio Code. 

## Features

- Supports live coding with Hydra and JavaScript in general.
- Supports loading Hydra [extensions](https://github.com/hydra-synth/hydra-extensions) and external JavaScript libraries.
- Supports [OSC](https://en.wikipedia.org/wiki/Open_Sound_Control) channels.
- Includes [p5.js](https://p5js.org).

## Commands

- `Ctrl/Cmd + Shift + Enter`: Eval the active JavaScript document.
- `Ctrl/Cmd + Alt + Enter`: Eval a line (or a selection) of code.
- `Alt + Enter`: Eval a block of code.
- `Ctrl/Cmd + Shift + S`: Take a screenshot of the canvas.
- `Ctrl/Cmd + Shift + V`: Start or stop video recording the canvas.

## Settings

* `jdomizz.vscode-hydra.width`: Set the width of the canvas.
* `jdomizz.vscode-hydra.height`: Set the height of the canvas.
* `jdomizz.vscode-hydra.loadScripts`: Set the list of scripts to be loaded at startup.

## Scripts

Hydra [extensions](https://github.com/hydra-synth/hydra-extensions) and external JavaScript libraries can be loaded using Hydra's `loadScript` function or via the `jdomizz.vscode-hydra.loadScripts` configuration option:

```json
{
    "jdomizz.vscode-hydra.loadScripts": [
        "https://unpkg.com/tone",
        "https://hyper-hydra.glitch.me/hydra-gif.js",
    ]
}
```

## OSC

Open Sound Control is provided by [osc-js](https://adzialocha.github.io/osc-js/). It has been configured as follows:

- Port `41234` is for _sending_ messages
- Port `41235` is for _receiving_ messages

Use the `OSC` object to send an receive messages:

```js
OSC.send('/test', value)

OSC.on('/test', (args) => { /* do something with args */ })
```

## p5.js

This extension includes the same wrapper for [p5.js](https://p5js.org) as the Hydra web editor. You can check how to use it in the Hydra [documentacion](https://hydra.ojack.xyz/docs/docs/learning/extending-hydra/extending-hydra/#p5js).

## Issues

Microphones, webcams, and MIDI do not work due to the Visual Studio Code permissions policy.
If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.

