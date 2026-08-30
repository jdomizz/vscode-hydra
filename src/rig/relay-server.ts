import { WebSocketServer, WebSocket } from 'ws';
import { isRigCommand, isRigFeedback } from '@jdomizz/rig-transport';

export interface RelayServerOptions {
  /** TCP port to bind. Pass 0 for a random free port. */
  port: number;
  /** Host to bind. Defaults to '127.0.0.1'. */
  host?: string;
}

/**
 * Thin WebSocket fan-out relay for in-process mode.
 *
 * Mirrors the routing logic of `@jdomizz/rig-relay`'s `RelayServer` without
 * pulling the package as a runtime dependency. Accepts WebSocket connections,
 * validates that inbound messages are rig commands or feedbacks, and
 * broadcasts them to every other connected client.
 *
 * Resolves {@link ready} once the underlying `WebSocketServer` is listening.
 */
export class RelayServer {
  #wss: WebSocketServer;
  #clients = new Set<WebSocket>();
  #port: number;
  #host: string;
  #readyResolve: (() => void) | null = null;
  #readyPromise: Promise<void>;
  #closed = false;

  constructor(options: RelayServerOptions) {
    this.#port = options.port;
    this.#host = options.host ?? '127.0.0.1';
    this.#wss = new WebSocketServer({ port: this.#port, host: this.#host });
    this.#readyPromise = new Promise<void>((resolve) => {
      this.#readyResolve = resolve;
    });
    this.#wss.on('listening', () => {
      // Capture the actual port when bound to 0.
      const addr = this.#wss.address();
      if (addr && typeof addr === 'object') {
        this.#port = addr.port;
      }
      this.#readyResolve?.();
      this.#readyResolve = null;
    });
    this.#wss.on('connection', (ws) => this.#onConnection(ws));
    this.#wss.on('error', () => {
      // Surface errors; the supervisor decides whether to restart.
    });
  }

  /** Resolves once the WebSocketServer is listening and accepting connections. */
  get ready(): Promise<void> {
    return this.#readyPromise;
  }

  /** The WebSocket URL clients should connect to. */
  get url(): string {
    return `ws://${this.#host}:${this.#port}`;
  }

  /** The port the server is actually listening on (resolved after {@link ready}). */
  get port(): number {
    return this.#port;
  }

  #onConnection(ws: WebSocket): void {
    this.#clients.add(ws);
    const remove = (): void => {
      this.#clients.delete(ws);
    };
    ws.on('close', remove);
    ws.on('error', remove);
    ws.on('message', (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'Parse error: invalid JSON' }));
        }
        return;
      }
      if (isRigCommand(msg) || isRigFeedback(msg)) {
        this.#broadcast(ws, msg);
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    });
  }

  #broadcast(sender: WebSocket, msg: unknown): void {
    const data = JSON.stringify(msg);
    for (const client of this.#clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** Close the server and all connected clients. */
  async close(): Promise<void> {
    if (this.#closed) { return; }
    this.#closed = true;
    for (const client of this.#clients) {
      client.close();
    }
    this.#clients.clear();
    await new Promise<void>((resolve) => {
      this.#wss.close(() => resolve());
    });
  }
}
