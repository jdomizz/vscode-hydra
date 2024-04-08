import * as vscode from 'vscode';

type Message = { type: string, value: string };

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

    private get code(): string {
        let result = '';
        if (vscode.window.activeTextEditor?.document) {
            const activeDocument = vscode.window.activeTextEditor.document.uri.scheme === 'file'
                ? vscode.window.activeTextEditor.document
                : vscode.window.visibleTextEditors.filter(editor => editor.document.uri.scheme === 'file')[0].document;
            if (activeDocument) {
                result = activeDocument.getText();
            }
        }
        return result;
    }

    constructor(private readonly extension: vscode.Uri) { }

    evalDocument() {
        if (this.panel) {
            this.panel.webview.postMessage({ type: 'evalCode', value: this.code });
        } else {
            this.createWebviewPanel();
        }
    }

    captureImage() {
        this.panel?.webview.postMessage({ type: 'captureImage' });
    }

    startRecorder() {
        this.panel?.webview.postMessage({ type: 'startRecorder' });
    }

    stopRecorder() {
        this.panel?.webview.postMessage({ type: 'stopRecorder' });
    }

    private createWebviewPanel() {
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
            this.handleWebviewMessage(message);
        });

        this.panel.webview.postMessage({ type: 'evalCode', value: this.code });
        vscode.commands.executeCommand('setContext', 'vscode-hydra.status', 'rendering');
    }

    private handleWebviewMessage(message: Message) {
        const { type, value } = message;

        switch (type) {
            case 'status': return vscode.commands.executeCommand('setContext', 'vscode-hydra.status', message.value);
            case 'error': return vscode.window.showErrorMessage(value);
        }
    }
}