import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

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
      throw new Error("OSC bridge already running");
    }

    const args = ["--udp-port", this.config.udpPort.toString(), "--ws-url", this.config.wsUrl];

    this.process = spawn(this.config.path, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data) => {
      const message = data.toString().trim();
      this.emit("log", message);
    });

    this.process.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      this.emit("error", message);
    });

    this.process.on("close", (code) => {
      this.process = null;
      this.emit("close", code);
    });

    // Wait for the process to signal readiness via stdout
    await new Promise<void>((resolve, reject) => {
      const onLog = (msg: string) => {
        if (msg.includes("listening on UDP")) {
          this.off("log", onLog);
          this.off("close", onClose);
          clearTimeout(timer);
          resolve();
        }
      };
      const onClose = (code: number) => {
        this.off("log", onLog);
        clearTimeout(timer);
        reject(new Error(`OSC bridge exited before ready (code ${code})`));
      };
      const timer = setTimeout(() => {
        this.off("log", onLog);
        this.off("close", onClose);
        reject(new Error("OSC bridge ready timeout (5s)"));
      }, 5000);

      this.on("log", onLog);
      this.once("close", onClose);
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
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
