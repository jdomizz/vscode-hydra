import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WebSocketLike } from '@jdomizz/rig-transport';
import type { RigFeedback } from '@jdomizz/rig-transport';
import { RigWire } from './client.js';

/**
 * Minimal in-memory WebSocket mock matching the {@link WebSocketLike}
 * surface used by `TransportClient`. Mirrors the harness in
 * `rig-transport/client.spec.ts` so the two test suites stay aligned.
 */
class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  closed = false;

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(data: unknown): void {
    this.onmessage?.({ data });
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
}

interface Harness {
  wire: RigWire;
  sockets: FakeWebSocket[];
}

/**
 * Build a RigWire whose TransportClient uses our FakeWebSocket factory.
 * We monkey-patch the global WebSocket for the duration of the test,
 * since TransportClient captures the global WebSocket at module load.
 */
function makeHarness(): Harness {
  const sockets: FakeWebSocket[] = [];
  const originalWebSocket = globalThis.WebSocket;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = class {
    constructor(_url: string) {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      // Return the fake socket masquerading as a WebSocket.
      return socket;
    }
  };
  const wire = new RigWire();
  return { wire, sockets };
}

describe('RigWire', () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    vi.useRealTimers();
    originalWebSocket = globalThis.WebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it('throws when eval is called before connect()', async () => {
    const wire = new RigWire();
    await expect(wire.eval('osc().out()')).rejects.toThrow(/not connected/i);
    wire.dispose();
  });

  it('throws when sendCommand is called before connect()', async () => {
    const wire = new RigWire();
    await expect(
      wire.sendCommand({ type: 'eval:code', code: 'osc().out()' }),
    ).rejects.toThrow(/not connected/i);
    wire.dispose();
  });

  it('connect() creates a socket and onReady fires when it opens', () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    let ready = false;
    h.wire.onReady(() => {
      ready = true;
    });
    expect(h.sockets.length).toBe(1);
    h.sockets[0].open();
    expect(ready).toBe(true);
    h.wire.dispose();
  });

  it('eval() correlates response by id and returns ok:true on state feedback', async () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();

    const promise = h.wire.eval('osc().out()');
    // The TransportClient assigned an id; echo it back with state feedback.
    const sent = JSON.parse(h.sockets[0].sent[0]);
    expect(sent.type).toBe('eval:code');
    expect(sent.code).toBe('osc().out()');
    expect(typeof sent.id).toBe('number');

    h.sockets[0].receive(
      JSON.stringify({ id: sent.id, type: 'state', playing: true, bpm: 120 }),
    );

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.feedback?.type).toBe('state');
    h.wire.dispose();
  });

  it('eval() returns ok:false when runtime responds with error feedback', async () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();

    const promise = h.wire.eval('bogus');
    const sent = JSON.parse(h.sockets[0].sent[0]);
    h.sockets[0].receive(
      JSON.stringify({ id: sent.id, type: 'error', message: 'undefined is not a function' }),
    );

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.feedback?.type).toBe('error');
    h.wire.dispose();
  });

  it('eval() returns ok:false when connection closes before response', async () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();

    const promise = h.wire.eval('osc().out()');
    h.sockets[0].close();

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.feedback).toBeUndefined();
    h.wire.dispose();
  });

  it('sendCommand() passes through to TransportClient', async () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();

    const promise = h.wire.sendCommand({ type: 'panic' });
    const sent = JSON.parse(h.sockets[0].sent[0]);
    expect(sent.type).toBe('panic');
    h.sockets[0].receive(
      JSON.stringify({ id: sent.id, type: 'panic:state', active: true }),
    );

    const fb = await promise;
    expect(fb.type).toBe('panic:state');
    h.wire.dispose();
  });

  it('onFeedback() receives push events (feedback without id)', () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();

    const pushes: RigFeedback[] = [];
    h.wire.onFeedback((fb) => pushes.push(fb));
    h.sockets[0].receive(
      JSON.stringify({ type: 'fps', value: 60 }),
    );

    expect(pushes.length).toBe(1);
    expect(pushes[0].type).toBe('fps');
    h.wire.dispose();
  });

  it('onError() receives transport errors', () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();

    const errors: Error[] = [];
    h.wire.onError((err) => errors.push(err));
    h.sockets[0].receive('not json');

    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/Parse error/);
    h.wire.dispose();
  });

  it('dispose() closes the socket and prevents further commands', async () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    h.sockets[0].open();
    h.wire.dispose();

    expect(h.sockets[0].closed).toBe(true);
    await expect(h.wire.eval('osc().out()')).rejects.toThrow(/not connected/i);
  });

  it('connect() disposes prior connection before opening a new one', () => {
    const h = makeHarness();
    h.wire.connect('ws://localhost:9163');
    expect(h.sockets.length).toBe(1);
    const first = h.sockets[0];

    // Re-connect: the first socket should be closed.
    const originalWebSocket = globalThis.WebSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = class {
      constructor(_url: string) {
        const socket = new FakeWebSocket();
        h.sockets.push(socket);
        return socket;
      }
    };
    h.wire.connect('ws://localhost:9164');
    globalThis.WebSocket = originalWebSocket;

    expect(first.closed).toBe(true);
    expect(h.sockets.length).toBe(2);
    h.wire.dispose();
  });
});
