import * as vscode from 'vscode';

export class HydraViewProvider {

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
        const script = vscode.Uri.joinPath(this.extension, 'out', 'frontend', 'webview.js');
        return this.panel?.webview.asWebviewUri(script);
    }

    private get editor(): vscode.TextEditor {
        return vscode.window.activeTextEditor?.document.uri.scheme === 'file'
            ? vscode.window.activeTextEditor
            : vscode.window.visibleTextEditors.filter(editor => editor.document.uri.scheme === 'file')[0];
    }

    constructor(private readonly extension: vscode.Uri) { }

    evalDocument() {
        this.eval(this.editor.document.getText());
    }

    evalLine() {
        this.eval(this.editor.document.getText(this.getLine()));
    }

    evalBlock() {
        this.eval(this.editor.document.getText(this.getBlock()));
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

    private getLine(): vscode.Range {
        return this.editor.selection.isEmpty
            ? this.editor.document.lineAt(this.editor.selection.active.line).range
            : this.editor.selection;
    }

    private getBlock(): vscode.Range {
        const currentLine = this.editor.selection.active.line;

        let startLine = currentLine;
        while (startLine > 0 && !this.isEmptyLine(startLine)) {
            startLine--;
        }

        let endLine = currentLine;
        while (endLine < this.editor.document.lineCount - 1 && !this.isEmptyLine(endLine)) {
            endLine++;
        }

        const start = this.editor.document.lineAt(startLine).range.start;
        const end = this.editor.document.lineAt(endLine).range.end;
        return new vscode.Range(start, end);
    }

    private isEmptyLine(position: number): boolean {
        const line = this.editor.document.lineAt(position).range;
        return this.editor.document.getText(line) === '';
    }
}