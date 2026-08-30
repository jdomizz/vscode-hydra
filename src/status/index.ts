import * as vscode from 'vscode';
import type { SweepOscBridge } from '../backend/sweep-osc-bridge';
import type { SweepHttpServer } from '../backend/sweep-http';

export interface StatusState {
    running: boolean;
    ports?: { relay?: number; http?: number; osc?: number };
}

export interface StatusDeps {
    oscBridge: SweepOscBridge;
    httpServer: SweepHttpServer;
}

export class Status implements vscode.Disposable {
    private readonly barItem: vscode.StatusBarItem;
    private readonly oscBridge: SweepOscBridge;
    private readonly httpServer: SweepHttpServer;
    private state: StatusState = { running: false };

    constructor(deps: StatusDeps) {
        this.oscBridge = deps.oscBridge;
        this.httpServer = deps.httpServer;

        this.barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.barItem.text = '$(server) Rig: stopped';
        this.barItem.tooltip = this.buildTooltip();
        this.barItem.show();

        this.wire();
    }

    update(state: StatusState): void {
        this.state = state;
        this.render();
    }

    dispose(): void {
        this.barItem.dispose();
    }

    private wire(): void {
        const ports: { relay?: number; http?: number; osc?: number } = {};

        this.oscBridge.on('log', (msg: string) => {
            if (msg.includes('listening on UDP')) {
                ports.osc = this.oscBridge.getUdpPort();
                this.update({ running: true, ports: { ...ports } });
            }
        });

        this.oscBridge.on('close', () => {
            delete ports.osc;
            this.update({ running: Object.keys(ports).length > 0, ports: { ...ports } });
        });

        this.oscBridge.on('error', (msg: string) => {
            vscode.window.showErrorMessage(`OSC Bridge: ${msg}`);
        });

        this.httpServer.on('log', (msg: string) => {
            if (msg.includes('Serving')) {
                ports.http = this.httpServer.getPort();
                this.update({ running: true, ports: { ...ports } });
            }
        });

        this.httpServer.on('close', () => {
            delete ports.http;
            this.update({ running: Object.keys(ports).length > 0, ports: { ...ports } });
        });

        this.httpServer.on('error', (msg: string) => {
            vscode.window.showErrorMessage(`HTTP Server: ${msg}`);
        });
    }

    private render(): void {
        this.barItem.text = this.state.running
            ? '$(server-process) Rig: running'
            : '$(server) Rig: stopped';
        this.barItem.tooltip = this.buildTooltip();
    }

    private buildTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        if (this.state.running && this.state.ports) {
            md.appendMarkdown('**Rig** is running\n\n');
            if (this.state.ports.relay !== undefined) {
                md.appendMarkdown(`- **${this.state.ports.relay}** relay (ws)\n`);
            }
            if (this.state.ports.http !== undefined) {
                md.appendMarkdown(`- **${this.state.ports.http}** http\n`);
            }
            if (this.state.ports.osc !== undefined) {
                md.appendMarkdown(`- **${this.state.ports.osc}** osc (udp)\n`);
            }
            md.appendMarkdown('\n---\n\n');
            if (this.state.ports.http !== undefined) {
                md.appendMarkdown(`[Open runtime](http://localhost:${this.state.ports.http})`);
            }
        } else {
            md.appendMarkdown('Rig is stopped.');
        }

        return md;
    }
}
