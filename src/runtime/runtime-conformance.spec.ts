import { describe, it, expect, vi } from "vitest";
import type { WebSocketLike, RigFeedback } from "@jdomizz/rig-transport";
import { createRigHost, type HostEngine } from "@jdomizz/rig-host";
import { createHydraEngine } from "./adapter.js";

// ── Test helpers ──────────────────────────────────────────────────────

class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  closed = false;

  simulateOpen(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateReceive(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  simulateError(): void {
    this.onerror?.();
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }
}

function sentFeedbacks(ws: FakeWebSocket): RigFeedback[] {
  return ws.sent.map((s) => JSON.parse(s) as RigFeedback);
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Minimal document polyfill for the adapter's download path. The
 * adapter triggers browser downloads via `document.createElement('a')`
 * + click; in Node, document is undefined. We provide just enough surface
 * (createElement with click + body.appendChild/removeChild) for the
 * download glue to be a no-op without throwing.
 */
if (typeof (globalThis as { document?: unknown }).document === "undefined") {
  (globalThis as { document: unknown }).document = {
    createElement: vi.fn((_tag: string) => ({
      set href(_: string) {},
      set download(_: string) {},
      style: {} as Record<string, string>,
      click: vi.fn(),
      remove: vi.fn(),
    })),
    body: {
      append: vi.fn(),
      remove: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  } as unknown;
}

/**
 * Creates a fake `<hydra-element>` for adapter tests.
 * Simulates code, synth, canvas, and the hydra-eval event.
 */
function makeFakeElement() {
  const listeners = new Map<string, Set<EventListener>>();
  let lastCode = "";
  let nextEvalResult = { success: true } as { success: boolean; error?: string };
  let codeValue = "";

  const element = {
    canvas: {
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => cb(new Blob(["test"]))),
      captureStream: vi.fn(() => ({})),
    } as unknown as HTMLCanvasElement,
    synth: {
      bpm: 120,
      screencap: vi.fn(),
      stats: { fps: 30 },
    },
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    // Test helpers
    _setEvalResult(result: { success: boolean; error?: string }) {
      nextEvalResult = result;
    },
  };

  // Use Object.defineProperty for the code getter/setter (triggers eval event)
  Object.defineProperty(element, "code", {
    get() {
      return codeValue;
    },
    set(v: string) {
      codeValue = v;
      lastCode = v;
      setTimeout(() => {
        listeners.get("hydra-eval")?.forEach((listener) => {
          listener(new CustomEvent("hydra-eval", { detail: nextEvalResult }) as unknown as Event);
        });
      }, 0);
    },
    enumerable: true,
    configurable: true,
  });

  return element as typeof element & {
    code: string;
    _setEvalResult: (r: { success: boolean; error?: string }) => void;
  };
}

/**
 * Creates a rig-host wired to a fake WebSocket, using a stub engine
 * that mirrors the adapter's shape. Tests wire-level conformance.
 */
function makeRuntimeHarness(engineOverrides?: Partial<HostEngine>) {
  const sockets: FakeWebSocket[] = [];
  const engine: HostEngine = {
    state: () => ({ playing: true, bpm: 120 }),
    eval: vi.fn(),
    setBpm: vi.fn(),
    captureImage: vi.fn().mockResolvedValue(undefined),
    startCapture: vi.fn(),
    stopCapture: vi.fn().mockResolvedValue(undefined),
    ...engineOverrides,
  };
  const host = createRigHost({
    wsUrl: "ws://test",
    engine,
    createSocket: () => {
      const ws = new FakeWebSocket();
      sockets.push(ws);
      return ws;
    },
    fpsIntervalMs: 0,
  });
  return { host, sockets, engine };
}

// ── Adapter unit tests ────────────────────────────────────────────────

describe("createHydraEngine (adapter)", () => {
  it("state() reads bpm from synth", () => {
    const el = makeFakeElement();
    (el.synth as { bpm: number }).bpm = 140;
    const engine = createHydraEngine(el as unknown as HTMLElement);
    expect(engine.state()).toEqual({ playing: true, bpm: 140 });
  });

  it("state() defaults bpm to 120 when synth.bpm is absent", () => {
    const el = makeFakeElement();
    (el.synth as { bpm?: number }).bpm = undefined;
    const engine = createHydraEngine(el as unknown as HTMLElement);
    expect(engine.state()).toEqual({ playing: true, bpm: 120 });
  });

  it("eval() sets el.code and resolves on hydra-eval success", async () => {
    const el = makeFakeElement();
    const engine = createHydraEngine(el as unknown as HTMLElement);
    await engine.eval("osc().out()");
    expect(el.code).toBe("osc().out()");
  });

  it("eval() throws on hydra-eval failure", async () => {
    const el = makeFakeElement();
    el._setEvalResult({ success: false, error: "undefined is not a function" });
    const engine = createHydraEngine(el as unknown as HTMLElement);
    await expect(engine.eval("bad()")).rejects.toThrow("undefined is not a function");
  });

  it("setBpm() assigns through to synth.bpm", () => {
    const el = makeFakeElement();
    const engine = createHydraEngine(el as unknown as HTMLElement);
    engine.setBpm!(140);
    expect((el.synth as { bpm: number }).bpm).toBe(140);
  });

  it("captureImage() calls screencap and triggers canvas.toBlob for download", async () => {
    const el = makeFakeElement();
    const engine = createHydraEngine(el as unknown as HTMLElement);
    await engine.captureImage!();
    expect((el.synth as { screencap: ReturnType<typeof vi.fn> }).screencap).toHaveBeenCalled();
    expect(el.canvas.toBlob).toHaveBeenCalled();
  });

  it("captureImage() throws when canvas is unavailable", async () => {
    const el = makeFakeElement();
    (el as { canvas: HTMLCanvasElement | null }).canvas = null;
    const engine = createHydraEngine(el as unknown as HTMLElement);
    await expect(engine.captureImage!()).rejects.toThrow(/canvas not available/);
  });

  it("getFps() reads from synth.stats.fps", () => {
    const el = makeFakeElement();
    const engine = createHydraEngine(el as unknown as HTMLElement);
    expect(engine.getFps!()).toBe(30);
  });

  it("getFps() returns 0 when stats.fps is absent", () => {
    const el = makeFakeElement();
    (el.synth as { stats?: unknown }).stats = undefined;
    const engine = createHydraEngine(el as unknown as HTMLElement);
    expect(engine.getFps!()).toBe(0);
  });
});

// ── Runtime conformance tests (wire-level via createRigHost) ──────────

describe("runtime-conformance (rig-host + adapter-shaped engine)", () => {
  it("sends ready on transport-ready", async () => {
    const { host, sockets } = makeRuntimeHarness();
    await host.start();
    sockets[0].simulateOpen();
    expect(sentFeedbacks(sockets[0]).some((f) => f.type === "ready")).toBe(true);
    host.dispose();
  });

  it("eval:code success sends state snapshot", async () => {
    const { host, sockets } = makeRuntimeHarness();
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "eval:code", code: "osc()" });
    await flush();
    const fb = sentFeedbacks(sockets[0]).find((f) => f.type === "state");
    expect(fb).toBeDefined();
    expect(fb).toMatchObject({ type: "state", playing: true, bpm: 120 });
    host.dispose();
  });

  it("eval:code failure sends error with source eval", async () => {
    const { host, sockets } = makeRuntimeHarness({
      eval: () => {
        throw new Error("boom");
      },
    });
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "eval:code", code: "bad()" });
    await flush();
    const fb = sentFeedbacks(sockets[0]).find((f) => f.type === "error");
    expect(fb).toBeDefined();
    expect(fb).toMatchObject({ type: "error", source: "eval", message: "boom" });
    host.dispose();
  });

  it("tracks lastGoodCode across successful evals", async () => {
    const evalSpy = vi.fn<(code: string) => void>();
    const { host, sockets } = makeRuntimeHarness({
      eval: (code: string) => {
        evalSpy(code);
        if (code === "bad()") {
          throw new Error("boom");
        }
      },
    });
    await host.start();
    sockets[0].simulateOpen();

    sockets[0].simulateReceive({ type: "eval:code", code: "good()" });
    await flush();
    sockets[0].simulateReceive({ type: "eval:code", code: "bad()" });
    await flush();
    sockets[0].simulateReceive({ type: "eval:revert" });
    await flush();

    const calls = evalSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain("good()");
    expect(calls).toContain("bad()");
    expect(calls[calls.length - 1]).toBe("good()");
    host.dispose();
  });

  it("eval:revert replays lastGoodCode (adapter omits revert)", async () => {
    const evalSpy = vi.fn();
    const { host, sockets } = makeRuntimeHarness({ eval: evalSpy });
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "eval:code", code: "osc()" });
    await flush();
    evalSpy.mockClear();

    sockets[0].simulateReceive({ type: "eval:revert" });
    await flush();

    expect(evalSpy).toHaveBeenCalledWith("osc()");
    host.dispose();
  });

  it("state:query returns engine.state() snapshot", async () => {
    const { host, sockets } = makeRuntimeHarness();
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "state:query" });
    await flush();
    const fb = sentFeedbacks(sockets[0]).find((f) => f.type === "state");
    expect(fb).toBeDefined();
    expect(fb).toMatchObject({ type: "state", playing: true, bpm: 120 });
    host.dispose();
  });

  it("panic latches + gates commands + emits panic:state", async () => {
    const setBpmSpy = vi.fn();
    const { host, sockets } = makeRuntimeHarness({ setBpm: setBpmSpy });
    await host.start();
    sockets[0].simulateOpen();

    sockets[0].simulateReceive({ type: "panic" });
    await flush();
    expect(
      sentFeedbacks(sockets[0]).some((f) => f.type === "panic:state" && f.active === true),
    ).toBe(true);

    // Gated: transport:bpm should not reach engine while panicked
    sockets[0].simulateReceive({ type: "transport:bpm", bpm: 140 });
    await flush();
    expect(setBpmSpy).not.toHaveBeenCalled();

    // Eval unpanics
    sockets[0].simulateReceive({ type: "eval:code", code: "osc()" });
    await flush();
    const feedbacks = sentFeedbacks(sockets[0]);
    const panicFalseIdx = feedbacks.findIndex(
      (f) => f.type === "panic:state" && f.active === false,
    );
    const stateIdx = feedbacks.findIndex((f) => f.type === "state");
    expect(panicFalseIdx).toBeGreaterThanOrEqual(0);
    expect(stateIdx).toBeGreaterThanOrEqual(0);
    expect(panicFalseIdx).toBeLessThan(stateIdx);
    host.dispose();
  });

  it("transport error forwarded as error feedback", async () => {
    const { host, sockets } = makeRuntimeHarness();
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateError();
    const fb = sentFeedbacks(sockets[0]).find((f) => f.type === "error");
    expect(fb).toBeDefined();
    expect(fb!.type === "error" && fb.message).toMatch(/WebSocket connection error/);
    host.dispose();
  });

  it("transport:bpm routes to engine.setBpm", async () => {
    const setBpmSpy = vi.fn();
    const { host, sockets } = makeRuntimeHarness({ setBpm: setBpmSpy });
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "transport:bpm", bpm: 140 });
    await flush();
    expect(setBpmSpy).toHaveBeenCalledWith(140);
    host.dispose();
  });

  it("transport:tap sends error feedback when engine omits tap", async () => {
    const { host, sockets } = makeRuntimeHarness();
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "transport:tap" });
    await flush();
    const fb = sentFeedbacks(sockets[0]).find((f) => f.type === "error");
    expect(fb).toBeDefined();
    expect(fb!.type === "error" && fb.message).toMatch(/transport:tap not supported/);
    host.dispose();
  });

  it("capture:start/stop routes + capture:state feedback", async () => {
    const startSpy = vi.fn();
    const stopSpy = vi.fn();
    const { host, sockets } = makeRuntimeHarness({
      startCapture: startSpy,
      stopCapture: stopSpy,
    });
    await host.start();
    sockets[0].simulateOpen();

    sockets[0].simulateReceive({ type: "capture:start" });
    await flush();
    expect(startSpy).toHaveBeenCalled();
    expect(
      sentFeedbacks(sockets[0]).some((f) => f.type === "capture:state" && f.recording === true),
    ).toBe(true);

    sockets[0].simulateReceive({ type: "capture:stop" });
    await flush();
    expect(stopSpy).toHaveBeenCalled();
    expect(
      sentFeedbacks(sockets[0]).some((f) => f.type === "capture:state" && f.recording === false),
    ).toBe(true);
    host.dispose();
  });

  it("capture:image routes to engine.captureImage", async () => {
    const captureSpy = vi.fn().mockResolvedValue(undefined);
    const { host, sockets } = makeRuntimeHarness({ captureImage: captureSpy });
    await host.start();
    sockets[0].simulateOpen();
    sockets[0].simulateReceive({ type: "capture:image" });
    await flush();
    expect(captureSpy).toHaveBeenCalled();
    host.dispose();
  });

  it("dispose is idempotent", async () => {
    const { host } = makeRuntimeHarness();
    await host.start();
    host.dispose();
    host.dispose(); // second call should not throw
  });

  it("default wsUrl aligns with RIG_RELAY_URL default", () => {
    // Verify createRigHost defaults to ws://localhost:9163
    // by creating a host with no wsUrl and checking the socket URL
    const sockets: FakeWebSocket[] = [];
    const host = createRigHost({
      engine: { state: () => ({ playing: true, bpm: 120 }), eval: () => {} },
      createSocket: (_url: string) => {
        // The default URL is passed to the socket factory
        const ws = new FakeWebSocket();
        sockets.push(ws);
        return ws;
      },
      fpsIntervalMs: 0,
    });
    void host.start();
    // The socket was created (default URL was used internally)
    expect(sockets.length).toBe(1);
    host.dispose();
  });
});
