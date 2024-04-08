# 🧩 Hydra for Visual Studio Code

This extension makes it easy to eval and render [Hydra](https://hydra.ojack.xyz/) scripts in Visual Studio Code. 

![demo video](./media/demo.gif)

## Installation

Search for `vscode-hydra` in the Visual Studio Code [marketplace](https://marketplace.visualstudio.com/vscode) and install the extension.

## Features

This extension contributes the following commands:

- `Ctrl/Cmd + Shift + Enter`: Eval the code of the active JavaScript document with the Hydra engine.
- `Ctrl/Cmd + Shift + S`: Take a screenshot of the Hydra canvas.
- `Ctrl/Cmd + Shift + V`: Start or stop video recording of the Hydra canvas.

## Settings

This extension contributes the following settings:

* `jdomizz.vscode-hydra.width`: Set the width of the canvas.
* `jdomizz.vscode-hydra.height`: Set the height of the canvas.

## Known Issues

- **Microphones** and **webcams** do not work because Visual Studio Code restricts access to media devices.
- **MIDI** does not work. There are plans to implement it.

If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.

