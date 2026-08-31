import * as vscode from 'vscode';
import { getRigSettings, onSettingsChanged } from './settings.js';
import { EditorService } from './editor/index.js';
import { DiagnosticsManager } from './diagnostics.js';
import { flashEditorForEval, errorRange } from './decorations.js';
import { StatusPanel } from './status/index.js';
import { RigWire } from './rig/index.js';
import { CapturePipeline } from './capture/pipeline.js';
import open from 'open';

/**
 * Extension activation — M3 v1.0 wiring.
 *
 * Connects the editor shell (EditorService, DiagnosticsManager, decorations)
 * to the rig transport (RigWire) and capture pipeline. The status panel
 * subscribes to wire feedback for transient state (panic, recording).
 *
 * The runtime page (external browser) is served by rig-serve; the extension
 * opens it when the wire connects. The served runtime page is the sole
 * render surface.
 */
export function activate(context: vscode.ExtensionContext): void {
    const settings = getRigSettings();
    const diagnostics = new DiagnosticsManager();
    const editor = new EditorService();
    const status = new StatusPanel();

    // Wire integration — connects to rig-relay (in-process bundle).
    // For Phase 2 we use the file: workspace ref directly; production
    // gets the npm-published version after M1.
    const wire = new RigWire();
    const relayUrl = `ws://localhost:${settings.relayPort}`;
    wire.connect(relayUrl);

    // Status panel subscribes to wire feedback for panic/recording state.
    // The panel internally handles `panic:state` and `capture:state` feedback.
    context.subscriptions.push(status.subscribe(wire));

    // Wire ready (WebSocket open) → open the runtime page in external browser.
    wire.onReady(() => {
        const runtimeUrl = `http://localhost:${settings.httpPort}/runtime/index.html?relay=${encodeURIComponent(relayUrl)}&context=hydra`;
        status.update({
            running: true,
            relay: { port: settings.relayPort, connected: true },
            http: { port: settings.httpPort, running: true },
            panic: false,
            recording: false,
            runtimeUrl,
        });
        void open(runtimeUrl);
    });

    // Wire feedback → update status for state changes.
    // The panel already handles panic:state and capture:state via subscribe();
    // here we handle state/state:update to confirm the rig is running.
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

    // Capture commands — delegate to CapturePipeline.
    const capture = new CapturePipeline(wire);
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

    // Cleanup.
    context.subscriptions.push({
        dispose: () => {
            diagnostics.dispose();
            status.dispose();
            wire.dispose();
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
