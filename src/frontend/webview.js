const vscode = acquireVsCodeApi();

window.addEventListener('message', (event) => vscode.postMessage(event.data));
