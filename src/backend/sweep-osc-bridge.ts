import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface OscBridgeConfig {
  path: string;
  udpPort: number;
  wsUrl: string;
}

export class SweepOscBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: OscBridgeConfig;

  constructor(config: OscBridgeConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('OSC bridge already running');
    }

    const args = [
      '--udp-port', this.config.udpPort.toString(),
      '--ws-url', this.config.wsUrl
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

  getUdpPort(): number {
    return this.config.udpPort;
  }
}
