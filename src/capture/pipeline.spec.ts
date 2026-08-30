import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CapturePipeline } from './pipeline';
import type { WireLike } from './pipeline';

/**
 * In-memory mock wire for testing the capture pipeline.
 *
 * Records sent commands and allows tests to push feedback manually.
 */
class MockWire implements WireLike {
    sent: Array<{ type: string; [key: string]: unknown }> = [];
    feedbackHandlers: Array<(fb: { type: string; [key: string]: unknown }) => void> = [];
    commandReplies: Map<string, { type: string; [key: string]: unknown }> = new Map();
    closed = false;

    async sendCommand(cmd: { type: string; [key: string]: unknown }): Promise<{ type: string; [key: string]: unknown }> {
        if (this.closed) {
            throw new Error('Wire closed');
        }
        this.sent.push(cmd);
        const reply = this.commandReplies.get(cmd.type);
        if (reply) {
            return reply;
        }
        return { type: 'ack' };
    }

    onFeedback(handler: (fb: { type: string; [key: string]: unknown }) => void): () => void {
        this.feedbackHandlers.push(handler);
        return () => {
            const idx = this.feedbackHandlers.indexOf(handler);
            if (idx >= 0) { this.feedbackHandlers.splice(idx, 1); }
        };
    }

    /**
     * Push a feedback event to all registered handlers.
     */
    pushFeedback(fb: { type: string; [key: string]: unknown }): void {
        for (const handler of this.feedbackHandlers) {
            handler(fb);
        }
    }

    /**
     * Set the reply for a given command type.
     */
    setReply(cmdType: string, reply: { type: string; [key: string]: unknown }): void {
        this.commandReplies.set(cmdType, reply);
    }

    close(): void {
        this.closed = true;
    }
}

describe('CapturePipeline', () => {
    let wire: MockWire;
    let pipeline: CapturePipeline;

    beforeEach(() => {
        vi.useFakeTimers();
        wire = new MockWire();
        pipeline = new CapturePipeline(wire, 5000);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('captureImage()', () => {
        it('sends capture:image command over the wire', async () => {
            wire.setReply('capture:image', { type: 'capture:state', path: '/tmp/screenshot.png' });
            const promise = pipeline.captureImage();
            const result = await promise;
            expect(wire.sent.length).toBe(1);
            expect(wire.sent[0].type).toBe('capture:image');
            expect(result.ok).toBe(true);
            expect(result.path).toBe('/tmp/screenshot.png');
        });

        it('returns ok:false when runtime responds with error', async () => {
            wire.setReply('capture:image', { type: 'error', message: 'not supported' });
            const result = await pipeline.captureImage();
            expect(result.ok).toBe(false);
            expect(result.path).toBeUndefined();
        });

        it('returns ok:false when wire is closed', async () => {
            wire.close();
            const result = await pipeline.captureImage();
            expect(result.ok).toBe(false);
        });
    });

    describe('startRecording()', () => {
        it('sends capture:start and resolves when feedback arrives', async () => {
            const promise = pipeline.startRecording();
            expect(wire.sent.length).toBe(1);
            expect(wire.sent[0].type).toBe('capture:start');
            wire.pushFeedback({ type: 'capture:state', recording: true });
            await promise;
        });

        it('resolves when command reply matches', async () => {
            wire.setReply('capture:start', { type: 'capture:state', recording: true });
            await pipeline.startRecording();
        });

        it('rejects on timeout', async () => {
            const promise = pipeline.startRecording();
            vi.advanceTimersByTime(6000);
            await expect(promise).rejects.toThrow(/timeout/);
        });

        it('rejects when wire is closed', async () => {
            wire.close();
            const promise = pipeline.startRecording();
            await expect(promise).rejects.toThrow(/Wire closed/);
        });
    });

    describe('stopRecording()', () => {
        it('sends capture:stop and resolves with path when feedback arrives', async () => {
            const promise = pipeline.stopRecording();
            expect(wire.sent.length).toBe(1);
            expect(wire.sent[0].type).toBe('capture:stop');
            wire.pushFeedback({ type: 'capture:state', recording: false, path: '/tmp/recording.webm' });
            const result = await promise;
            expect(result.path).toBe('/tmp/recording.webm');
        });

        it('resolves when command reply matches', async () => {
            wire.setReply('capture:stop', { type: 'capture:state', recording: false, path: '/tmp/recording.webm' });
            const result = await pipeline.stopRecording();
            expect(result.path).toBe('/tmp/recording.webm');
        });

        it('rejects on timeout', async () => {
            const promise = pipeline.stopRecording();
            vi.advanceTimersByTime(6000);
            await expect(promise).rejects.toThrow(/timeout/);
        });

        it('ignores feedback that does not match', async () => {
            const promise = pipeline.stopRecording();
            wire.pushFeedback({ type: 'capture:state', recording: true });
            wire.pushFeedback({ type: 'fps', value: 60 });
            wire.pushFeedback({ type: 'capture:state', recording: false });
            await promise;
        });
    });

    describe('malformed feedback', () => {
        it('ignores feedback with wrong type', async () => {
            const promise = pipeline.startRecording();
            wire.pushFeedback({ type: 'state', playing: true, bpm: 120 });
            wire.pushFeedback({ type: 'capture:state', recording: true });
            await promise;
        });

        it('ignores feedback with missing fields', async () => {
            const promise = pipeline.startRecording();
            wire.pushFeedback({ type: 'capture:state' });
            wire.pushFeedback({ type: 'capture:state', recording: true });
            await promise;
        });
    });
});
