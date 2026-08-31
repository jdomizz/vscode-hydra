import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CapturePipeline } from "./pipeline";
import type { WireLike } from "./pipeline";

/**
 * In-memory mock wire for testing the capture pipeline.
 *
 * Records fire-and-forget sends and supports pushing feedback events
 * (which is how the runtime actually delivers capture:state replies).
 */
class MockWire implements WireLike {
  sent: Array<{ type: string; [key: string]: unknown }> = [];
  feedbackHandlers: Array<(fb: { type: string; [key: string]: unknown }) => void> = [];
  closed = false;

  send(cmd: { type: string; [key: string]: unknown }): void {
    if (this.closed) {
      throw new Error("Wire closed");
    }
    this.sent.push(cmd);
  }

  sendAwaitFeedback(): never {
    throw new Error("sendAwaitFeedback removed; pipeline uses onFeedback + send");
  }

  onFeedback(handler: (fb: { type: string; [key: string]: unknown }) => void): () => void {
    this.feedbackHandlers.push(handler);
    return () => {
      const idx = this.feedbackHandlers.indexOf(handler);
      if (idx >= 0) {
        this.feedbackHandlers.splice(idx, 1);
      }
    };
  }

  pushFeedback(fb: { type: string; [key: string]: unknown }): void {
    for (const handler of this.feedbackHandlers) {
      handler(fb);
    }
  }

  close(): void {
    this.closed = true;
  }
}

describe("CapturePipeline", () => {
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

  describe("captureImage()", () => {
    it("sends capture:image command over the wire (fire-and-forget)", async () => {
      const result = await pipeline.captureImage();
      expect(wire.sent.length).toBe(1);
      expect(wire.sent[0].type).toBe("capture:image");
      expect(result.ok).toBe(true);
    });

    it("returns ok:false when wire is closed", async () => {
      wire.close();
      const result = await pipeline.captureImage();
      expect(result.ok).toBe(false);
    });

    it("does not await a wire reply (fire-and-forget)", async () => {
      // Even if the wire would reply, captureImage doesn't await it.
      // No expect on capture:state, no path returned.
      const result = await pipeline.captureImage();
      expect(result).not.toHaveProperty("path");
      expect(result).toEqual({ ok: true });
    });
  });

  describe("startRecording()", () => {
    it("sends capture:start and resolves when feedback arrives", async () => {
      const promise = pipeline.startRecording();
      expect(wire.sent.length).toBe(1);
      expect(wire.sent[0].type).toBe("capture:start");
      wire.pushFeedback({ type: "capture:state", recording: true });
      await promise;
    });

    it("rejects on timeout", async () => {
      const promise = pipeline.startRecording();
      vi.advanceTimersByTime(6000);
      await expect(promise).rejects.toThrow(/timeout/);
    });

    it("rejects when wire is closed (send throws synchronously)", async () => {
      wire.close();
      const promise = pipeline.startRecording();
      await expect(promise).rejects.toThrow(/Wire closed/);
    });

    it("ignores feedback that does not match", async () => {
      const promise = pipeline.startRecording();
      wire.pushFeedback({ type: "fps", value: 60 });
      wire.pushFeedback({ type: "capture:state", recording: true });
      await promise;
    });
  });

  describe("stopRecording()", () => {
    it("sends capture:stop and resolves when feedback arrives", async () => {
      const promise = pipeline.stopRecording();
      expect(wire.sent.length).toBe(1);
      expect(wire.sent[0].type).toBe("capture:stop");
      wire.pushFeedback({ type: "capture:state", recording: false });
      const result = await promise;
      expect(result).toEqual({});
    });

    it("rejects on timeout", async () => {
      const promise = pipeline.stopRecording();
      vi.advanceTimersByTime(6000);
      await expect(promise).rejects.toThrow(/timeout/);
    });

    it("rejects when wire is closed", async () => {
      wire.close();
      const promise = pipeline.stopRecording();
      await expect(promise).rejects.toThrow(/Wire closed/);
    });

    it("ignores feedback that does not match", async () => {
      const promise = pipeline.stopRecording();
      wire.pushFeedback({ type: "capture:state", recording: true });
      wire.pushFeedback({ type: "fps", value: 60 });
      wire.pushFeedback({ type: "capture:state", recording: false });
      await promise;
    });

    it("result has no path field (v1.0 delivery = browser download)", async () => {
      const promise = pipeline.stopRecording();
      wire.pushFeedback({ type: "capture:state", recording: false });
      const result = await promise;
      expect(result.path).toBeUndefined();
    });
  });

  describe("malformed feedback", () => {
    it("ignores feedback with wrong type", async () => {
      const promise = pipeline.startRecording();
      wire.pushFeedback({ type: "state", playing: true, bpm: 120 });
      wire.pushFeedback({ type: "capture:state", recording: true });
      await promise;
    });

    it("ignores feedback with missing fields", async () => {
      const promise = pipeline.startRecording();
      wire.pushFeedback({ type: "capture:state" });
      wire.pushFeedback({ type: "capture:state", recording: true });
      await promise;
    });
  });
});
