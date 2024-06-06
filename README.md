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
- `Ctrl/Cmd + Alt + Enter`: Eval a line (or a selection) of the active JavaScript document.
- `Alt + Enter`: Eval a block of the active JavaScript document.
- `Ctrl/Cmd + Shift + S`: Take a screenshot of the canvas.
- `Ctrl/Cmd + Shift + V`: Start or stop video recording the canvas.

## Settings

* `jdomizz.vscode-hydra.width`: Set the width of the canvas.
* `jdomizz.vscode-hydra.height`: Set the height of the canvas.
* `jdomizz.vscode-hydra.loadScripts`: Set the list of scripts to be loaded at startup.

## Loading scripts

There are two ways to load Hydra [extensions](https://github.com/hydra-synth/hydra-extensions) and external JavaScript libraries.

Using the Hydra `loadScript` function:

```js
loadScript("https://unpkg.com/tone")
```

Using the `jdomizz.vscode-hydra.loadScripts` configuration option:

```json
{
    "jdomizz.vscode-hydra.loadScripts": [
        "https://unpkg.com/tone",
        "https://hyper-hydra.glitch.me/hydra-gif.js",
    ]
}
```

## OSC

// FIXME https://github.com/ojack/hydra-osc

[OSC](https://en.wikipedia.org/wiki/Open_Sound_Control) has been configured as follows:

- Port `41234` for _sending_ messages (server)
- Port `41235` for _receiving_ messages (client)

Use the `msg` object to send and receive OSC messages.

To send a message:

```js
msg.send('/address', value)
```

To receive a message:

```js
msg.on('/address', (args) => { /* do something */ })
```

See [this repository](https://github.com/hydra-synth/hydra-examples) for examples of use.

## p5.js

This extension includes the same wrapper for [p5.js](https://p5js.org) as the Hydra web editor. You can check how to use it in the Hydra [documentacion](https://hydra.ojack.xyz/docs/docs/learning/extending-hydra/extending-hydra/#p5js).

## Issues

Microphones, webcams, and MIDI do not work due to the Visual Studio Code permissions policy.
If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.

