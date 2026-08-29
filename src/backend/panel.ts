import * as vscode from 'vscode';
import { SweepctlClient, SweepFeedback } from './sweepctl';
import open from 'open';

export class HydraPanel {

    private panel?: vscode.WebviewPanel;
    private sweepClient?: SweepctlClient;
    private isSweepMode = false;

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

    constructor(private readonly context: vscode.ExtensionContext) { }

    async evalCode(code: string) {
        this.code = code;
        
        const config = vscode.workspace.getConfiguration('hydra');
        const connectToSweep = config.get<boolean>('connectToSweep', false);
        
        if (connectToSweep) {
            await this.evalCodeInSweep(code);
        } else {
            this.evalCodeInWebview(code);
        }
    }

    private async evalCodeInSweep(code: string) {
        if (!this.sweepClient) {
            await this.startSweepClient();
        }
        
        if (this.sweepClient) {
            try {
                await this.sweepClient.evalCode(code);
            } catch (error) {
                vscode.window.showErrorMessage(`Sweep eval error: ${error}`);
            }
        }
    }

    private evalCodeInWebview(code: string) {
        if (this.panel) {
            this.panel.webview.postMessage({ type: 'evalCode', value: this.code });
        } else {
            this.createPanel();
        }
    }

    private async startSweepClient() {
        const config = vscode.workspace.getConfiguration('hydra');
        const sweepCliPath = config.get<string>('sweepCliPath', 'sweepctl');
        const syncPort = config.get<number>('syncPort', 9163);
        const canvasUrl = config.get<string>('canvasUrl', 'http://localhost:4173/canvas.html');

        try {
            this.sweepClient = new SweepctlClient({ sweepCliPath, syncPort });
            await this.sweepClient.start();
            
            // Open canvas.html in external browser
            const url = `${canvasUrl}?ws=ws://localhost:${syncPort}`;
            await open(url);
            
            this.isSweepMode = true;
            vscode.window.showInformationMessage('Connected to Sweep PWA');
            
            this.sweepClient.on('feedback', (feedback: SweepFeedback) => {
                if (feedback.type === 'error') {
                    vscode.window.showErrorMessage(`Sweep: ${feedback.message}`);
                }
            });
            
            this.sweepClient.on('close', (code: number | null) => {
                this.isSweepMode = false;
                this.sweepClient = undefined;
                vscode.window.showWarningMessage('Disconnected from Sweep PWA');
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start sweepctl: ${error}`);
        }
    }

    captureImage() {
        if (this.isSweepMode) {
            vscode.window.showWarningMessage('Capture not supported in Sweep mode yet');
            return;
        }
        this.panel?.webview.postMessage({ type: 'captureImage' });
    }

    startRecorder() {
        if (this.isSweepMode) {
            vscode.window.showWarningMessage('Recording not supported in Sweep mode yet');
            return;
        }
        this.panel?.webview.postMessage({ type: 'startRecorder' });
    }

    stopRecorder() {
        if (this.isSweepMode) {
            vscode.window.showWarningMessage('Recording not supported in Sweep mode yet');
            return;
        }
        this.panel?.webview.postMessage({ type: 'stopRecorder' });
    }

    private createPanel() {
        this.panel = vscode.window.createWebviewPanel('vscode-hydra.panel', 'Hydra', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.context.extensionUri]
        });
        this.panel.onDidDispose(() => {
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

    dispose() {
        if (this.sweepClient) {
            this.sweepClient.dispose();
            this.sweepClient = undefined;
        }
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

}
