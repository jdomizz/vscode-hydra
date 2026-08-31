/**
 * Capture pipeline — editor-side driver for `capture:image|start|stop`.
 *
 * Model (v1.0, post-rig-host capture hooks redesign): the runtime owns
 * delivery. `capture:image` triggers a browser-side download in the
 * runtime page; the editor pipeline fires the wire command and forgets
 * about it. `capture:start` / `capture:stop` still round-trip through
 * `capture:state { recording } }` so so the status bar's recording
 * indicator can update.
 *
 * The pipeline wraps a wire-like transport and exposes high-level methods
 * for screenshot and recording. It does not depend on the RigWire class
 * directly; instead it uses a structural {@link WireLike} interface so
 * tests can inject a mock wire.
 */

export interface WireLike {
  /**
   * Fire-and-forget send. May throw synchronously if the wire is closed.
   * For `capture:start` / `capture:stop`, the runtime answers via a
   * `capture:state` push (subscribe via `onFeedback` BEFORE calling `send`
   * to avoid missing the fast push).
   */
  send(cmd: { type: string; [key: string]: unknown }): void;
  onFeedback(handler: (fb: { type: string; [key: string]: unknown }) => void): () => void;
}

/**
 * Result of a `capture:image` round-trip. In v1.0 the file lands in the
 * browser's Downloads folder; the editor has no path. `ok` reflects
 * whether the runtime accepted the command (no wire ack fires for
 * capture:image — `ok: true` means the fire-and-forget send completed
 * without error, i.e. the wire was open).
 */
export interface CaptureImageResult {
  ok: boolean;
}

/**
 * Result of a `capture:stop` round-trip. `path` is intentionally
 * undefined in v1.0 — the runtime delivers the file via browser download.
 * The shape is kept so callers (status panel, info messages) can keep
 * their conditionals.
 */
export interface StopRecordingResult {
  path?: string;
}

/**
 * Timeout for awaiting feedback after a capture command.
 *
 * The runtime should respond quickly (within a few seconds); if it does
 * not, the pipeline rejects the promise to avoid hanging the UI.
 */
const FEEDBACK_TIMEOUT_MS = 10_000;

/**
 * Capture pipeline — editor-side driver for screenshot and recording.
 *
 * Wraps a wire-like transport and exposes high-level methods:
 * - `captureImage()` — fire-and-forget; the runtime downloads the file.
 * - `startRecording()` — send `capture:start`, await `capture:state { recording: true }`
 * - `stopRecording()` — send `capture:stop`, await `capture:state { recording: false }`
 *
 * @param timeoutMs — feedback timeout in ms for start/stop. capture:image
 *  is fire-and-forget so this does not apply.
 */
export class CapturePipeline {
  #wire: WireLike;
  #timeoutMs: number;

  constructor(wire: WireLike, timeoutMs = FEEDBACK_TIMEOUT_MS) {
    this.#wire = wire;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * Trigger a screenshot. Fire-and-forget — the runtime downloads the
   * PNG via the browser. The editor has no path to display (file lands
   * in the user's Downloads folder); we report `ok: true` if the wire
   * accepted the command, `ok: false` if the wire was closed.
   */
  async captureImage(): Promise<CaptureImageResult> {
    try {
      this.#wire.send({ type: "capture:image" });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /**
   * Send `capture:start` and await `capture:state { recording: true }`.
   *
   * Subscribes to onFeedback BEFORE sending so the runtime's push is
   * never missed (the runtime responds very fast).
   */
  async startRecording(): Promise<void> {
    return this.#awaitFeedback(
      "capture:start",
      (fb) => fb.type === "capture:state" && fb.recording === true,
    );
  }

  /**
   * Send `capture:stop` and await `capture:state { recording: false }`.
   *
   * The file lands in the browser's Downloads folder (no path comes
   * back over the wire). `StopRecordingResult.path` is always
   * `undefined` in v1.0.
   */
  async stopRecording(): Promise<StopRecordingResult> {
    await this.#awaitFeedback(
      "capture:stop",
      (fb) => fb.type === "capture:state" && fb.recording === false,
    );
    return {};
  }

  /**
   * Subscribe to feedback, then send the command. Resolves on the first
   * matching feedback; rejects on timeout or wire error.
   */
  #awaitFeedback(
    cmdType: string,
    match: (fb: { type: string; [key: string]: unknown }) => boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let unsub: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (unsub) {
          unsub();
          unsub = null;
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      unsub = this.#wire.onFeedback((fb) => {
        if (match(fb)) {
          cleanup();
          resolve();
        }
      });

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`CapturePipeline: timeout awaiting feedback for ${cmdType}`));
      }, this.#timeoutMs);

      try {
        this.#wire.send({ type: cmdType });
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}
