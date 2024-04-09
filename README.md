# 🧩 Hydra for Visual Studio Code

![demo](./media/demo.gif)

This extension makes it easy to eval and render [Hydra](https://hydra.ojack.xyz/) scripts in Visual Studio Code.

## Installation

Search for `vscode-hydra` in the Visual Studio Code [marketplace](https://marketplace.visualstudio.com/vscode) and install the extension.

## Features

This extension contributes the following commands:

- `Ctrl/Cmd + Shift + Enter`: Eval the code of the active JavaScript document.
- `Ctrl/Cmd + Shift + S`: Take a screenshot of the canvas.
- `Ctrl/Cmd + Shift + V`: Start or stop video recording the canvas.

## Settings

This extension contributes the following settings:

* `jdomizz.vscode-hydra.width`: Set the width of the canvas.
* `jdomizz.vscode-hydra.height`: Set the height of the canvas.

## Issues

Microphones, webcams, and MIDI do not work due to the Visual Studio Code permissions policy.
If you detect any other problem, please [open an issue](https://github.com/jdomizz/vscode-hydra/issues).

## License

Distributed under the GNU Affero General Public License.

