/**
 * Capture pipeline — editor-side driver for `capture:image|start|stop`.
 *
 * The pipeline wraps a wire-like transport and exposes high-level methods
 * for screenshot and recording. It does not depend on the RigWire class
 * directly; instead it uses a structural {@link WireLike} interface so
 * tests can inject a mock wire.
 *
 * Transport model (per D3 γ correction): control commands travel on the
 * JSON wire; bulk data (PNG/MP4 blobs) travels out-of-band via HTTP POST
 * from the runtime to the editor-supervised server. For Phase 2 the wire
 * reply includes `path` directly (the runtime tells the editor where it
 * saved the file).
 */

/**
 * Structural wire interface for the capture pipeline.
 *
 * The pipeline only needs `sendCommand` and `onFeedback`; it does not
 * depend on the full RigWire class. This allows tests to inject a mock
 * wire without instantiating a real TransportClient.
 */
export interface WireLike {
    sendCommand(cmd: { type: string; [key: string]: unknown }): Promise<{ type: string; [key: string]: unknown }>;
    onFeedback(handler: (fb: { type: string; [key: string]: unknown }) => void): () => void;
}

/**
 * Result of a `capture:image` round-trip.
 *
 * `ok` is true when the runtime responded successfully. `path` is the
 * file path where the runtime saved the PNG (Phase 2 in-process model).
 */
export interface CaptureImageResult {
    ok: boolean;
    path?: string;
}

/**
 * Result of a `capture:stop` round-trip.
 *
 * `path` is the file path where the runtime saved the recording (Phase 2
 * in-process model).
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
 * - `captureImage()` — send `capture:image`, await reply with `path`
 * - `startRecording()` — send `capture:start`, await `capture:state { recording: true }`
 * - `stopRecording()` — send `capture:stop`, await `capture:state { recording: false }`
 */
export class CapturePipeline {
    #wire: WireLike;
    #timeoutMs: number;

    constructor(wire: WireLike, timeoutMs = FEEDBACK_TIMEOUT_MS) {
        this.#wire = wire;
        this.#timeoutMs = timeoutMs;
    }

    /**
     * Send `capture:image` and await the runtime's response.
     *
     * The runtime replies with `{ type: 'capture:state', path }` (Phase 2
     * in-process model). The blob travels out-of-band via HTTP POST.
     */
    async captureImage(): Promise<CaptureImageResult> {
        try {
            const reply = await this.#wire.sendCommand({ type: 'capture:image' });
            if (reply.type === 'error') {
                return { ok: false };
            }
            return { ok: true, path: reply.path as string | undefined };
        } catch {
            return { ok: false };
        }
    }

    /**
     * Send `capture:start` and await `capture:state { recording: true }`.
     *
     * The runtime may send the feedback as a push event (no id) or as a
     * response to the command (with id). This method listens for both.
     */
    async startRecording(): Promise<void> {
        await this.#awaitFeedback(
            'capture:start',
            (fb) => fb.type === 'capture:state' && fb.recording === true,
        );
    }

    /**
     * Send `capture:stop` and await `capture:state { recording: false }`.
     *
     * Returns the path where the runtime saved the recording (Phase 2
     * in-process model).
     */
    async stopRecording(): Promise<StopRecordingResult> {
        const fb = await this.#awaitFeedback(
            'capture:stop',
            (fb) => fb.type === 'capture:state' && fb.recording === false,
        );
        return { path: fb.path as string | undefined };
    }

    /**
     * Send a command and await a matching feedback.
     *
     * The feedback may arrive as a push event (no id) or as a response
     * to the command (with id). This method listens for both and resolves
     * when a matching feedback arrives or rejects on timeout.
     */
    async #awaitFeedback(
        cmdType: string,
        match: (fb: { type: string; [key: string]: unknown }) => boolean,
    ): Promise<{ type: string; [key: string]: unknown }> {
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
                    resolve(fb);
                }
            });

            timer = setTimeout(() => {
                cleanup();
                reject(new Error(`CapturePipeline: timeout awaiting feedback for ${cmdType}`));
            }, this.#timeoutMs);

            this.#wire.sendCommand({ type: cmdType }).then(
                (reply) => {
                    if (match(reply)) {
                        cleanup();
                        resolve(reply);
                    }
                },
                (err) => {
                    cleanup();
                    reject(err);
                },
            );
        });
    }
}
