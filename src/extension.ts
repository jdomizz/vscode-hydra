import * as vscode from 'vscode';
import * as path from 'node:path';
import { getRigSettings, onSettingsChanged } from './settings.js';
import { EditorService } from './editor/index.js';
import { DiagnosticsManager } from './diagnostics.js';
import { flashEditorForEval, errorRange } from './decorations.js';
import { StatusPanel } from './status/index.js';
import { RigWire, RigProcessSupervisor } from './rig/index.js';
import { CapturePipeline } from './capture/pipeline.js';
import { BlobReceiver } from './capture/transport.js';
import open from 'open';

/**
 * Extension activation — M3 v1.0 wiring.
 *
 * Activation sequence:
 * 1. Resolve settings (rig.* primary, hydra.* fallback).
 * 2. Start RigProcessSupervisor (in-process relay + HTTP server by default).
 * 3. Start BlobReceiver (HTTP server for capture blob upload).
 * 4. Connect RigWire to the supervisor's relay URL.
 * 5. Register commands (eval, capture, openRuntime, panic).
 * 6. On wire ready, open the runtime page in the external browser.
 *
 * Deactivation reverses the order: wire → blobReceiver → supervisor.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const settings = getRigSettings();
    const diagnostics = new DiagnosticsManager();
    const editor = new EditorService();
    const status = new StatusPanel();

    // Start the rig process supervisor (relay + HTTP server).
    // In-process by default; hybrid mode when rig.*Path settings point to
    // external binaries. Resolves when both relay and HTTP server are listening.
    const supervisor = new RigProcessSupervisor(settings);
    let relayUrl: string;
    let httpUrl: string;
    try {
        const urls = await supervisor.start();
        relayUrl = urls.relayUrl;
        httpUrl = urls.httpUrl;
    } catch (err) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Rig supervisor failed to start: ${message}`);
        context.subscriptions.push({ dispose: () => { diagnostics.dispose(); status.dispose(); } });
        return;
    }

    // Start the blob receiver for capture uploads (PNG/WebM).
    const captureDir = path.join(
        context.storageUri?.fsPath ?? context.extensionPath,
        'captures',
    );
    const blobReceiver = new BlobReceiver(captureDir);
    try {
        await blobReceiver.start(settings.capturePort);
    } catch (err) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Capture receiver failed to start: ${message}`);
    }

    // Set initial status context key so keybindings/menus resolve correctly.
    await vscode.commands.executeCommand('setContext', 'vscode-hydra.status', 'rendering');

    // Wire integration — connects to the supervisor's relay.
    const wire = new RigWire();
    wire.connect(relayUrl);

    // Status panel subscribes to wire feedback for panic/recording state.
    context.subscriptions.push(status.subscribe(wire));

    // Current runtime URL — updated when the wire connects, read by openRuntime command.
    let currentRuntimeUrl: string | null = null;

    // Wire ready (WebSocket open) → open the runtime page in external browser.
    wire.onReady(() => {
        currentRuntimeUrl = `${httpUrl}/runtime/index.html?relay=${encodeURIComponent(relayUrl)}&context=hydra&capturePort=${settings.capturePort}`;
        status.update({
            running: true,
            relay: { port: settings.relayPort, connected: true },
            http: { port: settings.httpPort, running: true },
            panic: false,
            recording: false,
            runtimeUrl: currentRuntimeUrl,
        });
        void open(currentRuntimeUrl);
    });

    // Wire feedback → update status for state changes.
    wire.onFeedback((fb) => {
        if (fb.type === 'state' || fb.type === 'state:update') {
            status.update({
                running: true,
                relay: { port: settings.relayPort, connected: true },
                http: { port: settings.httpPort, running: true },
                panic: false,
                recording: false,
            });
        }
    });

    // Wire errors → surface as status update (disconnected).
    wire.onError((err) => {
        vscode.window.showErrorMessage(`Rig wire error: ${err.message}`);
        status.update({
            running: false,
            panic: false,
            recording: false,
        });
    });

    // Eval commands — use EditorService methods + flash + diagnostics.
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalDocument', async () => {
        try {
            const { code, range } = editor.document();
            await evalWithFlash(wire, diagnostics, code, range);
        } catch (err) {
            vscode.window.showErrorMessage(`Eval failed: ${(err as Error).message}`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalLine', async () => {
        try {
            const { code, range } = editor.line();
            await evalWithFlash(wire, diagnostics, code, range);
        } catch (err) {
            vscode.window.showErrorMessage(`Eval failed: ${(err as Error).message}`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.evalBlock', async () => {
        try {
            const { code, range } = editor.block();
            await evalWithFlash(wire, diagnostics, code, range);
        } catch (err) {
            vscode.window.showErrorMessage(`Eval failed: ${(err as Error).message}`);
        }
    }));

    // Capture commands — delegate to CapturePipeline with BlobReceiver.
    const capture = new CapturePipeline(wire, blobReceiver);
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.captureImage', async () => {
        try {
            const result = await capture.captureImage();
            if (result.ok && result.path) {
                vscode.window.showInformationMessage(`Screenshot saved: ${result.path}`);
            } else if (!result.ok) {
                vscode.window.showErrorMessage('Screenshot failed');
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Screenshot failed: ${(err as Error).message}`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.startRecorder', async () => {
        try {
            await capture.startRecording();
            vscode.window.showInformationMessage('Recording started');
        } catch (err) {
            vscode.window.showErrorMessage(`Recording failed: ${(err as Error).message}`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.stopRecorder', async () => {
        try {
            const result = await capture.stopRecording();
            if (result.path) {
                vscode.window.showInformationMessage(`Recording saved: ${result.path}`);
            } else {
                vscode.window.showInformationMessage('Recording stopped');
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Recording failed: ${(err as Error).message}`);
        }
    }));

    // Open runtime in external browser — invoked by status bar click.
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.openRuntime', async () => {
        if (currentRuntimeUrl) {
            await vscode.env.openExternal(vscode.Uri.parse(currentRuntimeUrl));
        } else {
            vscode.window.showWarningMessage('Runtime is not ready yet');
        }
    }));

    // Panic — silence all outputs immediately.
    context.subscriptions.push(vscode.commands.registerCommand('vscode-hydra.panic', async () => {
        try {
            await wire.sendCommand({ type: 'panic' });
        } catch (err) {
            vscode.window.showErrorMessage(`Panic failed: ${(err as Error).message}`);
        }
    }));

    // Subscribe to settings changes (hot-reload of rig.* values).
    context.subscriptions.push(onSettingsChanged((s) => {
        // Re-connect wire if relay port changed.
        const newRelayUrl = `ws://localhost:${s.relayPort}`;
        if (newRelayUrl !== relayUrl) {
            wire.connect(newRelayUrl);
        }
        // Update status with new ports.
        status.update({
            running: wire.connected,
            relay: { port: s.relayPort, connected: wire.connected },
            http: { port: s.httpPort, running: wire.connected },
            panic: false,
            recording: false,
        });
    }));

    // Cleanup — reverse order of creation.
    context.subscriptions.push({
        dispose: () => {
            diagnostics.dispose();
            status.dispose();
            wire.dispose();
            void blobReceiver.stop();
            void supervisor.stop();
        },
    });
}

/**
 * Evaluate code with visual flash and diagnostics.
 *
 * Flashes the evaluated range, sends the code to the runtime via the wire,
 * and surfaces errors as diagnostics + wavy underlines.
 */
async function evalWithFlash(
    wire: RigWire,
    diagnostics: DiagnosticsManager,
    code: string,
    range: vscode.Range,
): Promise<void> {
    const textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
        vscode.window.showWarningMessage('No active file editor');
        return;
    }

    // Clear prior diagnostics for this document before evaluating.
    diagnostics.clear(textEditor.document.uri);

    // Flash the evaluated range.
    flashEditorForEval(textEditor, code, range);

    // Send to runtime.
    const result = await wire.eval(code);

    // Surface errors as diagnostics + wavy underlines.
    if (!result.ok && result.feedback?.type === 'error') {
        const message = result.feedback.message;
        diagnostics.report(textEditor, message, range, 'error');
        errorRange(textEditor, range, message);
    }
}
