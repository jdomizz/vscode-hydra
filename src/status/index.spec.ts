import { describe, it, expect, beforeEach } from "vitest";
import { StatusPanel } from "./index";
import type { RigStatusState, StatusWire } from "./index";
import { getStatusBarItems } from "../__mocks__/vscode";

/**
 * In-memory mock wire for testing the status panel subscription.
 */
class MockStatusWire implements StatusWire {
  feedbackHandlers: Array<(fb: { type: string; [key: string]: unknown }) => void> = [];

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
}

function makeRunningState(overrides: Partial<RigStatusState> = {}): RigStatusState {
  return {
    running: true,
    relay: { port: 9163, connected: true },
    http: { port: 8080, running: true },
    panic: false,
    recording: false,
    runtimeUrl: "http://localhost:8080",
    ...overrides,
  };
}

describe("StatusPanel", () => {
  let panel: StatusPanel;

  beforeEach(() => {
    panel = new StatusPanel();
  });

  describe("initial state", () => {
    it("renders stopped text by default", () => {
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toBe("$(server) Rig: stopped");
    });
  });

  describe("update()", () => {
    it("renders stopped text when running=false", () => {
      panel.update({ running: false, panic: false, recording: false });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toBe("$(server) Rig: stopped");
    });

    it("renders multi-port text when running=true", () => {
      panel.update(makeRunningState());
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toBe("$(server-process) Rig: relay :9163 · http :8080");
    });

    it("includes OSC port when present", () => {
      panel.update(
        makeRunningState({
          osc: { port: 9000, running: true },
        }),
      );
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toBe("$(server-process) Rig: relay :9163 · http :8080 · OSC :9000");
    });

    it("includes MIDI when enabled", () => {
      panel.update(
        makeRunningState({
          midi: { enabled: true, connected: true },
        }),
      );
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toContain("MIDI");
    });

    it("appends recording indicator", () => {
      panel.update(makeRunningState({ recording: true }));
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toContain("$(record) recording");
    });

    it("appends panic indicator", () => {
      panel.update(makeRunningState({ panic: true }));
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toContain("$(alert) PANIC");
    });

    it("appends both recording and panic indicators", () => {
      panel.update(makeRunningState({ recording: true, panic: true }));
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toContain("$(record) recording");
      expect(item.text).toContain("$(alert) PANIC");
    });
  });

  describe("tooltip", () => {
    it('shows "stopped" message when not running', () => {
      panel.update({ running: false, panic: false, recording: false });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.tooltip).toBeDefined();
      const md = item.tooltip as { value: string };
      expect(md.value).toContain("stopped");
    });

    it("includes port table when running", () => {
      panel.update(makeRunningState());
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      const md = item.tooltip as { value: string };
      expect(md.value).toContain("relay");
      expect(md.value).toContain("9163");
      expect(md.value).toContain("http");
      expect(md.value).toContain("8080");
    });

    it('includes "Open runtime" link when runtimeUrl is set', () => {
      panel.update(makeRunningState());
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      const md = item.tooltip as { value: string };
      expect(md.value).toContain("[Open runtime]");
      expect(md.value).toContain("http://localhost:8080");
    });

    it('omits "Open runtime" link when runtimeUrl is not set', () => {
      panel.update(makeRunningState({ runtimeUrl: undefined }));
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      const md = item.tooltip as { value: string };
      expect(md.value).not.toContain("[Open runtime]");
    });
  });

  describe("subscribe()", () => {
    it("updates panic state from wire feedback", () => {
      panel.update(makeRunningState());
      const wire = new MockStatusWire();
      panel.subscribe(wire);
      wire.pushFeedback({ type: "panic:state", active: true });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toContain("$(alert) PANIC");
    });

    it("updates recording state from wire feedback", () => {
      panel.update(makeRunningState());
      const wire = new MockStatusWire();
      panel.subscribe(wire);
      wire.pushFeedback({ type: "capture:state", recording: true });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).toContain("$(record) recording");
    });

    it("clears panic state from wire feedback", () => {
      panel.update(makeRunningState({ panic: true }));
      const wire = new MockStatusWire();
      panel.subscribe(wire);
      wire.pushFeedback({ type: "panic:state", active: false });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).not.toContain("PANIC");
    });

    it("clears recording state from wire feedback", () => {
      panel.update(makeRunningState({ recording: true }));
      const wire = new MockStatusWire();
      panel.subscribe(wire);
      wire.pushFeedback({ type: "capture:state", recording: false });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).not.toContain("recording");
    });

    it("ignores unrelated feedback", () => {
      panel.update(makeRunningState());
      const wire = new MockStatusWire();
      panel.subscribe(wire);
      const before = (getStatusBarItems().at(-1) as { text: string }).text;
      wire.pushFeedback({ type: "fps", value: 60 });
      wire.pushFeedback({ type: "state", playing: true, bpm: 120 });
      const after = (getStatusBarItems().at(-1) as { text: string }).text;
      expect(after).toBe(before);
    });

    it("unsubscribe stops receiving feedback", () => {
      panel.update(makeRunningState());
      const wire = new MockStatusWire();
      const sub = panel.subscribe(wire);
      sub.dispose();
      wire.pushFeedback({ type: "panic:state", active: true });
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item.text).not.toContain("PANIC");
    });
  });

  describe("dispose()", () => {
    it("disposes the status bar item", () => {
      panel.dispose();
      const items = getStatusBarItems();
      const item = items[items.length - 1];
      expect(item).toBeDefined();
    });

    it("unsubscribes from wire feedback", () => {
      const wire = new MockStatusWire();
      panel.subscribe(wire);
      panel.dispose();
      expect(wire.feedbackHandlers.length).toBe(0);
    });
  });
});
