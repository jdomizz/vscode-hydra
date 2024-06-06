import * as vscode from 'vscode';
import { EditorService } from './backend/editor';
import { OSCService } from './backend/osc';
import { HydraPanel } from './backend/panel';

export function activate(context: vscode.ExtensionContext) {
    const editor = new EditorService();
    const osc = new OSCService();
    const panel = new HydraPanel(context, editor, osc);

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalDocument', () => panel.evalDocument()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalLine', () => panel.evalLine()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalBlock', () => panel.evalBlock()));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.captureImage', () => panel.captureImage()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.startRecorder', () => panel.startRecorder()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.stopRecorder', () => panel.stopRecorder()));
}