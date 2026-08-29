import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';

export interface SweepCliConfig {
    sweepCliPath: string;
    syncPort: number;
}

export interface SweepCommand {
    id?: number;
    type: string;
    [key: string]: any;
}

export interface SweepFeedback {
    id?: number;
    type: string;
    [key: string]: any;
}

export class SweepctlClient extends EventEmitter {
    private process: ChildProcess | null = null;
    private config: SweepCliConfig;
    private nextId = 1;
    private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

    constructor(config: SweepCliConfig) {
        super();
        this.config = config;
    }

    async start(): Promise<void> {
        if (this.process) {
            throw new Error('Sweep CLI client already running');
        }

        const url = `ws://localhost:${this.config.syncPort}`;
        
        this.process = spawn(this.config.sweepCliPath, ['stdio'], {
            env: { ...process.env, SWEEP_RELAY_URL: url }
        });

        this.process.stdout?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                try {
                    const feedback: SweepFeedback = JSON.parse(line);
                    this.handleFeedback(feedback);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to parse sweepctl output: ${line}`);
                }
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            vscode.window.showErrorMessage(`sweepctl stderr: ${data.toString()}`);
        });

        this.process.on('close', (code: number | null) => {
            this.process = null;
            this.emit('close', code);
        });

        this.process.on('error', (err: Error) => {
            this.emit('error', err);
        });

        // Wait for ready message
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for sweepctl ready'));
            }, 5000);

            this.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    private handleFeedback(feedback: SweepFeedback): void {
        if (feedback.type === 'ready') {
            this.emit('ready');
            return;
        }

        if (feedback.id && this.pendingRequests.has(feedback.id)) {
            const { resolve } = this.pendingRequests.get(feedback.id)!;
            this.pendingRequests.delete(feedback.id);
            resolve(feedback);
            return;
        }

        // Push event (no id)
        this.emit('feedback', feedback);
    }

    async sendCommand(command: SweepCommand): Promise<SweepFeedback> {
        if (!this.process) {
            throw new Error('Sweep CLI client not running');
        }

        const id = this.nextId++;
        const commandWithId = { ...command, id };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            
            const line = JSON.stringify(commandWithId) + '\n';
            this.process!.stdin!.write(line);
        });
    }

    async evalCode(code: string): Promise<SweepFeedback> {
        return this.sendCommand({ type: 'eval:code', code });
    }

    async sceneNext(): Promise<SweepFeedback> {
        return this.sendCommand({ type: 'scene:next' });
    }

    async scenePrev(): Promise<SweepFeedback> {
        return this.sendCommand({ type: 'scene:prev' });
    }

    async setMacro(index: number, value: number): Promise<SweepFeedback> {
        return this.sendCommand({ type: 'macro:set', index, value });
    }

    stop(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }

    dispose(): void {
        this.stop();
        this.removeAllListeners();
    }
}
