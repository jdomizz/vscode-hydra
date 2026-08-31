import { TransportClient, type RigCommand, type RigFeedback } from "@jdomizz/rig-transport";

/**
 * Result of an `eval:code` round-trip. `ok` is false when the runtime
 * responded with an `error` feedback or the request timed out / the
 * connection dropped before a response arrived.
 */
export interface EvalResult {
  ok: boolean;
  feedback?: RigFeedback;
}

/**
 * Wire client wrapper for the editor side.
 *
 * Wraps a {@link TransportClient} with a narrower, Rig-command-shaped API:
 * `eval()` correlates `eval:code` requests with their response by id,
 * `sendCommand()` is a typed passthrough, and the `on*` methods expose
 * push events, ready, and error streams.
 *
 * In-process mode: the transport is bundled into the extension; no
 * subprocess is spawned here (that is `RigProcessSupervisor`, a later
 * task).
 */
export class RigWire {
  #client: TransportClient<RigCommand, RigFeedback> | null = null;

  /**
   * Connect to a rig-relay WebSocket at the given URL. Disposes any
   * prior connection before opening a new one.
   */
  connect(url: string): void {
    this.dispose();
    this.#client = new TransportClient<RigCommand, RigFeedback>(url);
  }

  /** True once {@link connect} has been called and not yet disposed. */
  get connected(): boolean {
    return this.#client !== null;
  }

  /**
   * Send `eval:code` and wait for the runtime's response (correlated by
   * id). Resolves with `{ ok: true, feedback }` on a non-error response,
   * `{ ok: false, feedback }` when the runtime replies with `error`, and
   * `{ ok: false }` when the request times out or the connection drops.
   */
  async eval(code: string): Promise<EvalResult> {
    const client = this.#requireClient();
    const cmd: RigCommand = { type: "eval:code", code };
    try {
      const fb = await client.sendCommand(cmd);
      if (fb.type === "error") {
        return { ok: false, feedback: fb };
      }
      return { ok: true, feedback: fb };
    } catch {
      return { ok: false };
    }
  }

  /** Send any RigCommand and wait for its id-correlated response. */
  sendCommand(cmd: RigCommand): Promise<RigFeedback> {
    const client = this.#client;
    if (!client) {
      return Promise.reject(new Error("RigWire: not connected (call connect() first)"));
    }
    return client.sendCommand(cmd);
  }

  /**
   * Fire-and-forget send. Used for commands with no wire feedback
   * (e.g. `capture:image` — the runtime downloads the blob locally;
   * there is no success feedback type in the wire protocol).
   */
  send(cmd: RigCommand): void {
    const client = this.#client;
    if (!client) {
      throw new Error("RigWire: not connected (call connect() first)");
    }
    client.sendFireAndForget(cmd);
  }

  /** Register a handler for push events (feedback without an id). */
  onFeedback(handler: (fb: RigFeedback) => void): () => void {
    return this.#requireClient().onPush(handler);
  }

  /** Register a handler for connection-ready (WebSocket open). */
  onReady(handler: () => void): () => void {
    return this.#requireClient().onReady(handler);
  }

  /** Register a handler for transport errors. */
  onError(handler: (err: Error) => void): () => void {
    return this.#requireClient().onError(handler);
  }

  /** Tear down the underlying transport and release resources. */
  dispose(): void {
    this.#client?.dispose();
    this.#client = null;
  }

  #requireClient(): TransportClient<RigCommand, RigFeedback> {
    if (!this.#client) {
      throw new Error("RigWire: not connected (call connect() first)");
    }
    return this.#client;
  }
}
