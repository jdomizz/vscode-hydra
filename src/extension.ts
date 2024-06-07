import * as vscode from 'vscode';
import { EditorService } from './backend/editor';
import { OSCService } from './backend/osc';
import { HydraPanel } from './backend/panel';

export function activate(context: vscode.ExtensionContext) {

    const panel = new HydraPanel(context);
    const editor = new EditorService();
    const osc = new OSCService();

    osc.open();

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalDocument', () => panel.evalCode(editor.document)));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalLine', () => panel.evalCode(editor.line)));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalBlock', () => panel.evalCode(editor.block)));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.captureImage', () => panel.captureImage()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.startRecorder', () => panel.startRecorder()));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.stopRecorder', () => panel.stopRecorder()));

}