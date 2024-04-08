import * as vscode from 'vscode';
import { HydraViewProvider } from './backend/provider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new HydraViewProvider(context.extensionUri);

	context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalDocument', () => provider.evalDocument()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.captureImage', () => provider.captureImage()));

}