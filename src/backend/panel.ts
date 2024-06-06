import * as vscode from 'vscode';
import { EditorService } from './editor';
import { OSCService } from './osc';

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
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'frontend', 'main.js')
        );
    }

    private code = '';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly editor: EditorService,
        private readonly osc: OSCService,
    ) { }

    evalDocument() {
        this.code = this.editor.document;
        this.evalCode();
    }

    evalLine() {
        this.code = this.editor.line;
        this.evalCode();
    }

    evalBlock() {
        this.code = this.editor.block;
        this.evalCode();
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

    private evalCode() {
        if (this.panel) {
            this.panel.webview.postMessage({ type: 'evalCode', value: this.code });
        } else {
            this.createPanel();
        }
    }

    private createPanel() {
        this.osc.open();
        this.panel = vscode.window.createWebviewPanel('vscode-hydra.panel', 'Hydra', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.context.extensionUri]
        });
        this.panel.onDidDispose(() => {
            this.osc.close();
            this.panel = undefined;
        });

        this.panel.webview.html = this.html;
        this.panel.webview.onDidReceiveMessage((message) => {
            this.onMessage(message);
        });

        const config = vscode.workspace.getConfiguration('jdomizz.vscode-hydra');
        this.panel.webview.postMessage({ type: 'createHydra', value: config });
    }

    private onMessage(message: { type: string, value: string }) {
        switch (message.type) {
            case 'status': return vscode.commands.executeCommand('setContext', 'vscode-hydra.status', message.value);
            case 'error': return vscode.window.showErrorMessage(message.value);
            case 'start': return this.panel?.webview.postMessage({ type: 'evalCode', value: this.code });
        }
    }

}