import * as vscode from 'vscode';

export class HydraViewProvider {

    private panel?: vscode.WebviewPanel;

    private get html(): string {
        const script = vscode.Uri.joinPath(this.extension, 'out', 'frontend', 'webview.js');
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Permissions-Policy" content="display-capture=self">
                <script type="module" src="${this.panel?.webview.asWebviewUri(script)}"></script>
            </head>
            <body data-vscode-context='{"preventDefaultContextMenuItems": true}'></body>
            </html>
        `;
    }

    constructor(private readonly extension: vscode.Uri) { }

    createPanel() {
        this.panel = vscode.window.createWebviewPanel('vscode-hydra.panel', 'Hydra', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.extension]
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.panel.webview.html = this.html;
        this.panel.webview.onDidReceiveMessage((message) => {
            const { type, value } = message;
            vscode.window.showInformationMessage(`${type} ${value}`);
        });

        this.panel.webview.postMessage({ type: 'eval', value: 'osc().out()' });
    }

}