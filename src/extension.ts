import * as vscode from 'vscode';
import { EditorService } from './backend/editor';
import { HydraPanel } from './backend/panel';
import { SweepOscBridge } from './backend/sweep-osc-bridge';
import { SweepHttpServer } from './backend/sweep-http';
import { Status } from './status';

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('hydra');
    
    const panel = new HydraPanel(context);
    const editor = new EditorService();
    
    // OSC Bridge
    const oscBridge = new SweepOscBridge({
        path: config.get<string>('oscBridgePath', 'sweep-osc-bridge'),
        udpPort: config.get<number>('oscUdpPort', 9000),
        wsUrl: `ws://localhost:${config.get<number>('syncPort', 9163)}`
    });
    
    // HTTP Server
    const httpServer = new SweepHttpServer({
        path: config.get<string>('httpServerPath', 'sweep-http'),
        port: config.get<number>('httpPort', 8080),
        root: config.get<string>('httpRoot', vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd())
    });
    
    // Single status panel
    const status = new Status({ oscBridge, httpServer });
    context.subscriptions.push(status);
    
    // Auto-start if configured
    if (config.get<boolean>('autoStartOscBridge', false)) {
        oscBridge.start().catch(err => {
            vscode.window.showErrorMessage(`Failed to start OSC bridge: ${err.message}`);
        });
    }
    
    if (config.get<boolean>('autoStartHttpServer', false)) {
        httpServer.start().catch(err => {
            vscode.window.showErrorMessage(`Failed to start HTTP server: ${err.message}`);
        });
    }
    
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalDocument', () => panel.evalCode(editor.document)));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalLine', () => panel.evalCode(editor.line)));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalBlock', () => panel.evalCode(editor.block)));
    
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.captureImage', () => panel.captureImage()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.startRecorder', () => panel.startRecorder()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.stopRecorder', () => panel.stopRecorder()));
    
    // OSC Bridge commands
    context.subscriptions.push(vscode.commands.registerCommand('hydra.startOscBridge', async () => {
        try {
            await oscBridge.start();
            vscode.window.showInformationMessage('OSC Bridge started');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to start OSC bridge: ${err.message}`);
        }
    }));
    
    context.subscriptions.push(vscode.commands.registerCommand('hydra.stopOscBridge', () => {
        oscBridge.stop();
        vscode.window.showInformationMessage('OSC Bridge stopped');
    }));
    
    // HTTP Server commands
    context.subscriptions.push(vscode.commands.registerCommand('hydra.startHttpServer', async () => {
        try {
            await httpServer.start();
            vscode.window.showInformationMessage('HTTP Server started');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to start HTTP server: ${err.message}`);
        }
    }));
    
    context.subscriptions.push(vscode.commands.registerCommand('hydra.stopHttpServer', () => {
        httpServer.stop();
        vscode.window.showInformationMessage('HTTP Server stopped');
    }));
    
    // Cleanup
    context.subscriptions.push({
        dispose: () => {
            panel.dispose();
            oscBridge.stop();
            httpServer.stop();
        }
    });
}
