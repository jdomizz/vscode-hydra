import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'events';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { RigSettings } from '../settings.js';
import { DEFAULTS } from '../settings.js';
import { RelayServer } from './relay-server.js';

/**
 * Composite process supervisor for rig services (relay, serve, osc-bridge, midi-bridge).
 *
 * - **In-process by default**: bundles a thin WebSocket relay and HTTP static
 *   server. Zero prerequisites — no external binaries needed.
 * - **Hybrid mode**: spawns external binaries when `rig.*Path` settings point
 *   to a non-default path (e.g., `rig.relayPath: '/usr/local/bin/rig-relay'`).
 * - **Real ready detection**: waits for the WebSocketServer `listening` event
 *   (in-process) or stdout log patterns (spawned). No fixed `setTimeout` sleeps.
 * - **Auto-restart**: spawned processes that exit unexpectedly are restarted
 *   with exponential backoff (1s → 30s max).
 *
 * Phase 2: relay + serve in-process. OSC/MIDI bridges stay external (always
 * spawned) since they need native modules (osc-js native bindings, easymidi).
 */
export class RigProcessSupervisor extends EventEmitter {
  #settings: RigSettings;
  #relay?: InProcessRelay | SpawnedProcess;
  #serve?: InProcessServe | SpawnedProcess;
  #oscBridge?: SpawnedProcess;
  #midiBridge?: SpawnedProcess;
  #disposed = false;

  constructor(settings: RigSettings) {
    super();
    this.#settings = settings;
  }

  /**
   * Start all configured services.
   *
   * 1. Start the HTTP server (in-process or spawned).
   * 2. Start the relay (in-process or spawned).
   * 3. Optionally start OSC + MIDI bridges (always spawned; native).
   * 4. Wait for `ready` feedback from each service.
   * 5. Return the URLs the wire client connects to.
   */
  async start(): Promise<{ relayUrl: string; httpUrl: string }> {
    if (this.#disposed) {
      throw new Error('RigProcessSupervisor: cannot start after dispose');
    }

    // Start HTTP server.
    const serveInProcess = this.#settings.servePath === DEFAULTS.servePath;
    if (serveInProcess) {
      const serve = new InProcessServe({
        port: this.#settings.httpPort,
        root: process.cwd(),
      });
      await serve.start();
      this.#serve = serve;
    } else {
      const serve = new SpawnedProcess({
        name: 'rig-serve',
        command: this.#settings.servePath,
        args: ['--port', String(this.#settings.httpPort), '--root', process.cwd()],
        readyPattern: /serving/i,
        url: `http://127.0.0.1:${this.#settings.httpPort}`,
      });
      serve.on('exit', (code) => this.#onSpawnedExit('serve', code));
      await serve.start();
      this.#serve = serve;
    }

    // Start relay.
    const relayInProcess = this.#settings.relayPath === DEFAULTS.relayPath;
    if (relayInProcess) {
      const relay = new InProcessRelay({ port: this.#settings.relayPort });
      await relay.start();
      this.#relay = relay;
    } else {
      const relay = new SpawnedProcess({
        name: 'rig-relay',
        command: this.#settings.relayPath,
        args: ['--port', String(this.#settings.relayPort)],
        readyPattern: /listening/i,
        url: `ws://127.0.0.1:${this.#settings.relayPort}`,
      });
      relay.on('exit', (code) => this.#onSpawnedExit('relay', code));
      await relay.start();
      this.#relay = relay;
    }

    // Start OSC bridge (spawned; native modules; hybrid mode only).
    // Only spawn if we're in hybrid mode (relay or serve are spawned).
    const hybridMode = !serveInProcess || !relayInProcess;
    if (hybridMode) {
      const oscBridge = new SpawnedProcess({
        name: 'rig-osc-bridge',
        command: this.#settings.oscBridgePath,
        args: [
          '--udp-port',
          String(this.#settings.udpIn),
          '--ws-url',
          `ws://127.0.0.1:${this.#settings.relayPort}`,
        ],
        readyPattern: /UDP/i,
        url: `udp://127.0.0.1:${this.#settings.udpIn}`,
      });
      oscBridge.on('exit', (code) => this.#onSpawnedExit('osc', code));
      try {
        await oscBridge.start();
        this.#oscBridge = oscBridge;
      } catch (err) {
        this.emit('error', { service: 'osc', error: err });
      }

      // Start MIDI bridge (spawned; native modules; only if enabled).
      if (this.#settings.midiEnabled) {
        const midiBridge = new SpawnedProcess({
          name: 'rig-midi-bridge',
          command: this.#settings.midiBridgePath,
          args: ['--ws-url', `ws://127.0.0.1:${this.#settings.relayPort}`],
          readyPattern: /Listening on MIDI input/i,
          url: 'midi://',
        });
        midiBridge.on('exit', (code) => this.#onSpawnedExit('midi', code));
        try {
          await midiBridge.start();
          this.#midiBridge = midiBridge;
        } catch (err) {
          this.emit('error', { service: 'midi', error: err });
        }
      }
    }

    return {
      relayUrl: this.#relay!.url,
      httpUrl: this.#serve!.url,
    };
  }

  /** Stop all services and release resources. */
  async stop(): Promise<void> {
    this.#disposed = true;
    const tasks: Promise<void>[] = [];

    if (this.#relay) {
      const relay = this.#relay;
      if (relay.mode === 'in-process') {
        tasks.push(relay.stop());
      } else {
        relay.stop();
      }
      this.#relay = undefined;
    }
    if (this.#serve) {
      const serve = this.#serve;
      if (serve.mode === 'in-process') {
        tasks.push(serve.stop());
      } else {
        serve.stop();
      }
      this.#serve = undefined;
    }
    if (this.#oscBridge) {
      this.#oscBridge.stop();
      this.#oscBridge = undefined;
    }
    if (this.#midiBridge) {
      this.#midiBridge.stop();
      this.#midiBridge = undefined;
    }

    await Promise.all(tasks);
  }

  /** Composite status for the StatusPanel. */
  getStatus(): {
    relay: { port: number; mode: 'in-process' | 'spawned' | 'stopped'; running: boolean };
    http: { port: number; mode: 'in-process' | 'spawned' | 'stopped'; running: boolean };
    osc: { port: number; mode: 'spawned' | 'stopped'; running: boolean };
    midi: { enabled: boolean; mode: 'spawned' | 'stopped'; running: boolean };
  } {
    const relayStatus = this.#relay
      ? {
          port: this.#settings.relayPort,
          mode: this.#relay.mode,
          running: this.#relay.running,
        }
      : { port: this.#settings.relayPort, mode: 'stopped' as const, running: false };

    const httpStatus = this.#serve
      ? {
          port: this.#settings.httpPort,
          mode: this.#serve.mode,
          running: this.#serve.running,
        }
      : { port: this.#settings.httpPort, mode: 'stopped' as const, running: false };

    const oscStatus = this.#oscBridge
      ? { port: this.#settings.udpIn, mode: 'spawned' as const, running: this.#oscBridge.running }
      : { port: this.#settings.udpIn, mode: 'stopped' as const, running: false };

    const midiStatus = {
      enabled: this.#settings.midiEnabled,
      mode: (this.#midiBridge ? 'spawned' : 'stopped') as 'spawned' | 'stopped',
      running: this.#midiBridge?.running ?? false,
    };

    return { relay: relayStatus, http: httpStatus, osc: oscStatus, midi: midiStatus };
  }

  #onSpawnedExit(service: 'relay' | 'serve' | 'osc' | 'midi', code: number | null): void {
    if (this.#disposed) {
      return;
    }
    this.emit('exit', { service, code });
    // Auto-restart logic is handled by SpawnedProcess internally.
  }
}

// ─── In-process relay ────────────────────────────────────────────────────────

interface InProcessRelayOptions {
  port: number;
}

/**
 * In-process WebSocket relay wrapping {@link RelayServer}.
 *
 * Ready detection: resolves {@link start} once the underlying WebSocketServer
 * emits `listening`. No fixed sleeps.
 */
class InProcessRelay {
  readonly mode = 'in-process' as const;
  #server: RelayServer;
  #running = false;

  constructor(options: InProcessRelayOptions) {
    this.#server = new RelayServer({ port: options.port });
  }

  async start(): Promise<void> {
    await this.#server.ready;
    this.#running = true;
  }

  async stop(): Promise<void> {
    this.#running = false;
    await this.#server.close();
  }

  get url(): string {
    return this.#server.url;
  }

  get running(): boolean {
    return this.#running;
  }
}

// ─── In-process HTTP server ──────────────────────────────────────────────────

interface InProcessServeOptions {
  port: number;
  root: string;
}

/**
 * In-process HTTP static file server.
 *
 * Ports the core logic of `@jdomizz/rig-serve`'s `createHttpServer` without
 * pulling the package as a runtime dependency. Serves files from `root` with
 * CORS headers and correct MIME types.
 *
 * Ready detection: resolves {@link start} once the HTTP server emits `listening`.
 */
class InProcessServe {
  readonly mode = 'in-process' as const;
  #server: ReturnType<typeof createHttpServer>;
  #port: number;
  #root: string;
  #running = false;

  constructor(options: InProcessServeOptions) {
    this.#port = options.port;
    this.#root = options.root;
    this.#server = createHttpServer((req, res) => {
      this.#handleRequest(req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal server error');
        }
      });
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.#server.listen(this.#port, () => resolve());
    });
    this.#running = true;
  }

  async stop(): Promise<void> {
    this.#running = false;
    await new Promise<void>((resolve, reject) => {
      this.#server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  get url(): string {
    const addr = this.#server.address();
    const port = addr && typeof addr === 'object' ? addr.port : this.#port;
    return `http://127.0.0.1:${port}`;
  }

  get running(): boolean {
    return this.#running;
  }

  async #handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    const filePath = resolve(this.#root, '.' + pathname);

    if (!filePath.startsWith(this.#root)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const contentType = getMimeType(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileStat.size,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const content = await readFile(filePath);
    res.end(content);
  }
}

// ─── Spawned process ─────────────────────────────────────────────────────────

interface SpawnedProcessOptions {
  name: string;
  command: string;
  args: string[];
  /** Regex pattern to match in stdout for ready detection. */
  readyPattern: RegExp;
  /** URL this service exposes (for status reporting). */
  url: string;
}

/**
 * Spawned external process with ready detection and auto-restart.
 *
 * - **Ready detection**: resolves {@link start} when stdout matches `readyPattern`.
 *   Rejects if the process exits before ready or after a 5s timeout.
 * - **Auto-restart**: if the process exits unexpectedly after being ready, it
 *   is restarted with exponential backoff (1s → 30s max). Backoff resets on
 *   successful ready.
 */
class SpawnedProcess extends EventEmitter {
  readonly mode = 'spawned' as const;
  #options: SpawnedProcessOptions;
  #process: ChildProcess | null = null;
  #running = false;
  #intentionalStop = false;
  #backoffMs = 1000;
  #restartTimer?: ReturnType<typeof setTimeout>;

  constructor(options: SpawnedProcessOptions) {
    super();
    this.#options = options;
  }

  async start(): Promise<void> {
    this.#intentionalStop = false;
    await this.#spawn();
  }

  stop(): void {
    this.#intentionalStop = true;
    this.#running = false;
    if (this.#restartTimer) {
      clearTimeout(this.#restartTimer);
      this.#restartTimer = undefined;
    }
    if (this.#process) {
      this.#process.kill('SIGTERM');
      this.#process = null;
    }
  }

  get url(): string {
    return this.#options.url;
  }

  get running(): boolean {
    return this.#running;
  }

  async #spawn(): Promise<void> {
    return new Promise<void>((resolveReady, rejectReady) => {
      this.#process = spawn(this.#options.command, this.#options.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const onStdout = (data: Buffer): void => {
        const msg = data.toString();
        if (this.#options.readyPattern.test(msg)) {
          this.#process?.stdout?.off('data', onStdout);
          this.#process?.off('close', onClose);
          clearTimeout(timer);
          this.#running = true;
          this.#backoffMs = 1000; // Reset backoff on successful ready.
          resolveReady();
        }
      };

      const onClose = (code: number | null): void => {
        this.#process?.stdout?.off('data', onStdout);
        this.#process?.off('close', onClose);
        clearTimeout(timer);
        this.#process = null;
        this.#running = false;
        this.emit('exit', code);
        if (!this.#intentionalStop) {
          this.#scheduleRestart();
        }
        rejectReady(new Error(`${this.#options.name} exited before ready (code ${code})`));
      };

      const timer = setTimeout(() => {
        this.#process?.stdout?.off('data', onStdout);
        this.#process?.off('close', onClose);
        this.#process?.kill('SIGTERM');
        this.#process = null;
        rejectReady(new Error(`${this.#options.name} ready timeout (5s)`));
      }, 5000);

      this.#process.stdout?.on('data', onStdout);
      this.#process.stderr?.on('data', (data) => {
        this.emit('log', data.toString());
      });
      this.#process.once('close', onClose);
    });
  }

  #scheduleRestart(): void {
    if (this.#intentionalStop) {
      return;
    }
    this.#restartTimer = setTimeout(() => {
      this.#spawn().catch(() => {
        // Spawn failed; will retry with increased backoff.
      });
      this.#backoffMs = Math.min(this.#backoffMs * 2, 30000);
    }, this.#backoffMs);
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
  '.glsl': 'text/plain; charset=utf-8',
};

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
}
