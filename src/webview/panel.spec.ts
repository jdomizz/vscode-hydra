import { describe, it, expect, beforeEach } from "vitest";
import {
  __getMockedWebviewPanels,
  __getWebviewCreateCount,
  __resetMockState,
  ViewColumn,
} from "../__mocks__/vscode";
import { RuntimeWebviewPanel } from "./panel.js";

const RUNTIME_URL = "http://localhost:8080/runtime/index.html?relay=ws%3A%2F%2Flocalhost%3A9163&context=hydra";
const RUNTIME_ORIGIN = "http://localhost:8080";

beforeEach(() => {
  __resetMockState();
});

describe("RuntimeWebviewPanel", () => {
  describe("create()", () => {
    it("creates a panel with correct viewType, title, viewColumn, and options", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);

      expect(__getWebviewCreateCount()).toBe(1);
      const captured = __getMockedWebviewPanels()[0];
      expect(captured.viewType).toBe("vscode-hydra.runtime");
      expect(captured.title).toBe("Hydra");
      expect(captured.viewColumn).toBe(ViewColumn.Two);
      expect(captured.options.enableScripts).toBe(true);
      expect(captured.options.retainContextWhenHidden).toBe(true);
    });

    it("sets the webview HTML containing the iframe with the resolved URL", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);

      const captured = __getMockedWebviewPanels()[0];
      expect(captured.html).toContain(`<iframe src="${RUNTIME_URL}"`);
      expect(captured.html).toContain('allow="microphone; camera"');
    });

    it("derives CSP `frame-src` from the URL origin", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);

      const html = __getMockedWebviewPanels()[0].html;
      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain(`frame-src ${RUNTIME_ORIGIN}`);
      expect(html).toContain("default-src 'none'");
    });

    it("works for tunneled remote-workspace URLs", () => {
      const tunneledUrl = "https://my-tunnel.example.com/runtime/index.html?relay=wss%3A%2F%2Fmy-tunnel.example.com&context=hydra";
      const panel = new RuntimeWebviewPanel();
      panel.create(tunneledUrl);

      const html = __getMockedWebviewPanels()[0].html;
      expect(html).toContain("frame-src https://my-tunnel.example.com");
      expect(html).toContain(`<iframe src="${tunneledUrl}"`);
    });

    it("exists returns true after creation", () => {
      const panel = new RuntimeWebviewPanel();
      expect(panel.exists).toBe(false);
      panel.create(RUNTIME_URL);
      expect(panel.exists).toBe(true);
    });
  });

  describe("create() on existing panel", () => {
    it("does not create a second panel — reuses and updates HTML", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);
      panel.create("http://localhost:8080/different.html");

      expect(__getWebviewCreateCount()).toBe(1);
      const captured = __getMockedWebviewPanels()[0];
      expect(captured.html).toContain("different.html");
    });

    it("clears `exists` after dispose; subsequent create works", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);
      panel.dispose();
      expect(panel.exists).toBe(false);

      panel.create(RUNTIME_URL);
      expect(__getWebviewCreateCount()).toBe(2);
      expect(panel.exists).toBe(true);
    });
  });

  describe("show()", () => {
    it("no-op when no panel exists (does not crash)", () => {
      const panel = new RuntimeWebviewPanel();
      expect(() => panel.show()).not.toThrow();
    });

    it("reveals an existing panel (mock does not throw)", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);
      expect(() => panel.show()).not.toThrow();
    });
  });

  describe("dispose()", () => {
    it("clears the panel reference", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);
      expect(panel.exists).toBe(true);
      panel.dispose();
      expect(panel.exists).toBe(false);
    });

    it("is idempotent — calling twice does not throw", () => {
      const panel = new RuntimeWebviewPanel();
      panel.create(RUNTIME_URL);
      panel.dispose();
      expect(() => panel.dispose()).not.toThrow();
    });
  });
});
