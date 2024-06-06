import * as vscode from 'vscode';
import { EditorService } from './editor';

export class HydraPanel {

    private panel?: vscode.WebviewPanel;

    private get html(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Permissions-Policy" content="display-capture=self">
                <script type="module" src="${this.script}"></script>
            </head>
            <body data-vscode-context='{"preventDefaultContextMenuItems": true}'></body>
            </html>
        `;
    }

    private get script(): vscode.Uri | undefined {
        return this.panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extension, 'out', 'frontend', 'webview.js')
        );
    }

    constructor(
        private readonly extension: vscode.Uri,
        private readonly editor: EditorService,
    ) { }

    evalDocument() {
        this.eval(this.editor.document);
    }

    evalLine() {
        this.eval(this.editor.line);
    }

    evalBlock() {
        this.eval(this.editor.block);
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

    private createWebviewPanel(code: string) {
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

        // FIXME: tras ejecutar createHydra la webview envia msg para que se ejecute el evalCode 
        // la idea es que se cargan todos los scriptsantes del eval, pero no va a funcionar por los async dentro del eval
        this.panel.webview.postMessage({ type: 'createHydra', value: vscode.workspace.getConfiguration('jdomizz.vscode-hydra') });
        this.panel.webview.postMessage({ type: 'evalCode', value: code });
        vscode.commands.executeCommand('setContext', 'vscode-hydra.status', 'rendering');
    }

    private handleWebviewMessage(message: { type: string, value: string }) {
        switch (message.type) {
            case 'status': return vscode.commands.executeCommand('setContext', 'vscode-hydra.status', message.value);
            case 'error': return vscode.window.showErrorMessage(message.value);
        }
    }

    private eval(code: string) {
        if (this.panel) {
            this.panel.webview.postMessage({ type: 'evalCode', value: code });
        } else {
            this.createWebviewPanel(code);
        }
    }

}