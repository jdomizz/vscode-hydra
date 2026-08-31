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
 * from the runtime to the editor-supervised BlobReceiver server. When a
 * BlobReceiver is provided, the pipeline generates captureIds, registers
 * pending promises, and awaits the HTTP blob arrival. When no receiver
 * is provided (legacy / test mode), the wire reply carries `path` directly.
 */

import { randomUUID } from 'node:crypto';

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
 * Structural BlobReceiver interface for the capture pipeline.
 *
 * The pipeline only needs `expectBlob`; it does not depend on the full
 * BlobReceiver class. This allows tests to inject a mock receiver.
 */
export interface BlobReceiverLike {
    expectBlob(captureId: string, ext: string): Promise<string>;
}

/**
 * Result of a `capture:image` round-trip.
 *
 * `ok` is true when the runtime responded successfully. `path` is the
 * file path where the blob was written (via BlobReceiver HTTP transport)
 * or, in legacy mode, the path from the wire reply.
 */
export interface CaptureImageResult {
    ok: boolean;
    path?: string;
}

/**
 * Result of a `capture:stop` round-trip.
 *
 * `path` is the file path where the blob was written (via BlobReceiver
 * HTTP transport) or, in legacy mode, the path from the wire reply.
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
 * - `captureImage()` — send `capture:image`, await blob via HTTP or wire reply
 * - `startRecording()` — send `capture:start`, await `capture:state { recording: true }`
 * - `stopRecording()` — send `capture:stop`, await blob via HTTP or wire reply
 *
 * When a {@link BlobReceiverLike} is provided, bulk data travels via HTTP
 * (γ correction). When omitted, the pipeline falls back to the legacy
 * "path on wire" model for backward compatibility.
 */
export class CapturePipeline {
    #wire: WireLike;
    #blobReceiver: BlobReceiverLike | null;
    #timeoutMs: number;

    constructor(wire: WireLike, blobReceiverOrTimeout?: BlobReceiverLike | number, timeoutMs = FEEDBACK_TIMEOUT_MS) {
        this.#wire = wire;
        if (typeof blobReceiverOrTimeout === 'number') {
            this.#blobReceiver = null;
            this.#timeoutMs = blobReceiverOrTimeout;
        } else {
            this.#blobReceiver = blobReceiverOrTimeout ?? null;
            this.#timeoutMs = timeoutMs;
        }
    }

    /**
     * Send `capture:image` and await the result.
     *
     * With BlobReceiver: generates a captureId, registers a pending blob,
     * sends the wire command with the captureId, and awaits the HTTP POST.
     * Without BlobReceiver (legacy): awaits the wire reply with `path`.
     */
    async captureImage(): Promise<CaptureImageResult> {
        try {
            if (this.#blobReceiver) {
                const captureId = randomUUID();
                const blobPromise = this.#blobReceiver.expectBlob(captureId, '.png');
                const reply = await this.#wire.sendCommand({ type: 'capture:image', captureId });
                if (reply.type === 'error') {
                    return { ok: false };
                }
                const path = await blobPromise;
                return { ok: true, path };
            }
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
     * Send `capture:stop` and await the result.
     *
     * With BlobReceiver: generates a captureId, registers a pending blob,
     * sends the wire command with the captureId, and awaits the HTTP POST.
     * Without BlobReceiver (legacy): awaits wire feedback with `path`.
     */
    async stopRecording(): Promise<StopRecordingResult> {
        if (this.#blobReceiver) {
            const captureId = randomUUID();
            const blobPromise = this.#blobReceiver.expectBlob(captureId, '.webm');
            await this.#awaitFeedback(
                'capture:stop',
                (fb) => fb.type === 'capture:state' && fb.recording === false,
                { captureId },
            );
            const path = await blobPromise;
            return { path };
        }
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
        extraFields?: Record<string, unknown>,
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

            this.#wire.sendCommand({ type: cmdType, ...extraFields }).then(
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
