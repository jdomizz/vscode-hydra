# 🧩 Hydra Live Code

![demo](./media/demo.gif)

Extension for live coding with [Hydra](https://hydra.ojack.xyz/) in Visual Studio Code. 

## Features

- Supports live coding with Hydra and JavaScript in general.
- Supports loading Hydra [extensions](https://github.com/hydra-synth/hydra-extensions) and external JavaScript libraries.
- Supports [OSC](https://opensoundcontrol.stanford.edu/) communication.
- Includes [p5.js](https://p5js.org).

Take a look at [this](https://github.com/jdomizz/vscode-hydra/tree/main/demo) demo project with examples of use and configuration.

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

Open Sound Control is provided by [osc-js](https://adzialocha.github.io/osc-js/) in bridge mode. It has been configured as follows:

- Port `41234` is for _sending_ messages
- Port `41235` is for _receiving_ messages

Use the `OSC` object to send and receive messages:

```js
OSC.send('/test', value)

OSC.on('/test', (args) => { /* do something with args */ })
```

Note you can also open and close connections:

```js
OSC.open({ host: '127.0.0.1', port: 8080 })

OSC.close()
```

## p5.js

This extension includes the same wrapper for [p5.js](https://p5js.org) as the Hydra web editor. You can check how to use it in the Hydra [documentacion](https://hydra.ojack.xyz/docs/docs/learning/extending-hydra/extending-hydra/#p5js).

## Assets

Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension to serve assets from your project folder. This way you can use local images and videos.

```js
s0.initImage('http://localhost:5500/image/hydra.jpg')
```

## Issues

Microphones, webcams, screen capture and MIDI do not work due to the Visual Studio Code permissions policy.
If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.

