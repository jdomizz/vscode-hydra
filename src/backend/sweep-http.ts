import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface HttpServerConfig {
  path: string;
  port: number;
  root: string;
}

export class SweepHttpServer extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: HttpServerConfig;

  constructor(config: HttpServerConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('HTTP server already running');
    }

    const args = [
      '--port', this.config.port.toString(),
      '--root', this.config.root
    ];

    this.process = spawn(this.config.path, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      this.emit('log', message);
    });

    this.process.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      this.emit('error', message);
    });

    this.process.on('close', (code) => {
      this.process = null;
      this.emit('close', code);
    });

    // Wait a bit to ensure process started
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  getPort(): number {
    return this.config.port;
  }

  getRoot(): string {
    return this.config.root;
  }
}
