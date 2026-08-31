import * as vscode from 'vscode';

/**
 * Structured state for the status panel.
 *
 * The extension calls {@link StatusPanel.update} when the rig lifecycle
 * changes (start/stop, port assignments). The panel itself subscribes to
 * wire feedback for transient state (panic, recording).
 */
export interface RigStatusState {
    running: boolean;
    relay?: { port: number; connected: boolean };
    http?: { port: number; running: boolean };
    osc?: { port: number; running: boolean };
    midi?: { enabled: boolean; connected: boolean };
    panic: boolean;
    recording: boolean;
    runtimeUrl?: string;
}

/**
 * Structural wire interface for status panel subscription.
 *
 * The panel only needs push feedback; it does not send commands. This
 * avoids a hard dependency on the RigWire class.
 */
export interface StatusWire {
    onFeedback(handler: (fb: { type: string; [key: string]: unknown }) => void): () => void;
}

/**
 * Single status bar item with ports tooltip + "Open runtime" link.
 *
 * Phase 2 finalization (F4): integrates with the rig wire state
 * (relay/http/osc/midi ports and statuses, panic, recording).
 */
export class StatusPanel implements vscode.Disposable {
    #barItem: vscode.StatusBarItem;
    #state: RigStatusState = {
        running: false,
        panic: false,
        recording: false,
    };
    #unsubFeedback: (() => void) | null = null;

    /**
     * @param _deps — backward-compatible placeholder for Phase 0 deps.
     * Phase 2 uses `update()` to inject state; the constructor no longer
     * requires bridge instances.
     */
    constructor(_deps?: unknown) {
        this.#barItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
        this.#barItem.text = '$(server) Rig: stopped';
        this.#barItem.tooltip = this.#buildTooltip();
        this.#barItem.command = 'vscode-hydra.openRuntime';
        this.#barItem.show();
    }

    /**
     * Update the status panel with new rig state.
     *
     * Called by the extension when the rig lifecycle changes (start/stop,
     * port assignments). The panel re-renders text and tooltip.
     */
    update(state: RigStatusState): void {
        this.#state = state;
        this.#render();
    }

    /**
     * Subscribe to wire feedback for transient state (panic, recording).
     *
     * The panel listens for `panic:state` and `capture:state` feedback
     * and updates its internal state accordingly. Returns a disposable
     * that unsubscribes.
     */
    subscribe(wire: StatusWire): vscode.Disposable {
        this.unsubscribe();
        this.#unsubFeedback = wire.onFeedback((fb) => {
            if (fb.type === 'panic:state') {
                this.#state.panic = fb.active as boolean;
                this.#render();
            } else if (fb.type === 'capture:state') {
                this.#state.recording = fb.recording as boolean;
                this.#render();
            }
        });
        return { dispose: () => this.unsubscribe() };
    }

    /**
     * Dispose the status bar item and unsubscribe from wire feedback.
     */
    dispose(): void {
        this.unsubscribe();
        this.#barItem.dispose();
    }

    private unsubscribe(): void {
        if (this.#unsubFeedback) {
            this.#unsubFeedback();
            this.#unsubFeedback = null;
        }
    }

    #render(): void {
        if (!this.#state.running) {
            this.#barItem.text = '$(server) Rig: stopped';
            void vscode.commands.executeCommand('setContext', 'vscode-hydra.status', 'stopped');
        } else {
            const parts: string[] = [];
            if (this.#state.relay) {
                parts.push(`relay :${this.#state.relay.port}`);
            }
            if (this.#state.http) {
                parts.push(`http :${this.#state.http.port}`);
            }
            if (this.#state.osc) {
                parts.push(`OSC :${this.#state.osc.port}`);
            }
            if (this.#state.midi?.enabled) {
                parts.push('MIDI');
            }
            let text = `$(server-process) Rig: ${parts.join(' · ')}`;
            if (this.#state.recording) {
                text += ' $(record) recording';
            }
            if (this.#state.panic) {
                text += ' $(alert) PANIC';
            }
            this.#barItem.text = text;

            // Set context key for keybinding/menu `when` clauses.
            let statusValue: string = 'rendering';
            if (this.#state.panic) {
                statusValue = 'panic';
            } else if (this.#state.recording) {
                statusValue = 'recording';
            }
            void vscode.commands.executeCommand('setContext', 'vscode-hydra.status', statusValue);
        }
        this.#barItem.tooltip = this.#buildTooltip();
    }

    #buildTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        if (!this.#state.running) {
            md.appendMarkdown('Rig is stopped.');
            return md;
        }

        md.appendMarkdown('**Rig** is running\n\n');
        md.appendMarkdown('| Service | Port | Status |\n');
        md.appendMarkdown('|---|---|---|\n');

        if (this.#state.relay) {
            const status = this.#state.relay.connected ? '✓ connected' : '○ disconnected';
            md.appendMarkdown(`| relay (ws) | ${this.#state.relay.port} | ${status} |\n`);
        }
        if (this.#state.http) {
            const status = this.#state.http.running ? '✓ running' : '○ stopped';
            md.appendMarkdown(`| http | ${this.#state.http.port} | ${status} |\n`);
        }
        if (this.#state.osc) {
            const status = this.#state.osc.running ? '✓ running' : '○ stopped';
            md.appendMarkdown(`| osc (udp) | ${this.#state.osc.port} | ${status} |\n`);
        }
        if (this.#state.midi) {
            const status = this.#state.midi.connected ? '✓ connected' : '○ disconnected';
            md.appendMarkdown(`| midi | — | ${status} |\n`);
        }

        if (this.#state.panic) {
            md.appendMarkdown('\n---\n\n');
            md.appendMarkdown('$(alert) **PANIC** is active\n');
        }

        if (this.#state.recording) {
            md.appendMarkdown('\n---\n\n');
            md.appendMarkdown('$(record) **Recording** in progress\n');
        }

        if (this.#state.runtimeUrl) {
            md.appendMarkdown('\n---\n\n');
            md.appendMarkdown(`[Open runtime](${this.#state.runtimeUrl})`);
        }

        return md;
    }
}

/**
 * Backward-compatible alias for the Phase 0 `Status` class.
 *
 * Phase 0 shipped a basic status panel under the name `Status`. Phase 2
 * (F4) rewrites it as `StatusPanel` with full rig state integration.
 * The alias preserves the old export for any code that imports `Status`.
 */
export { StatusPanel as Status };
