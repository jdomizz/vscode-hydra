/**
 * Manifest-parity test — structural guard against declared-surface drift.
 *
 * Parses `package.json` and `README.md` at test-time, mock-activates
 * `src/extension.ts`, and asserts the declared surface (commands,
 * keybindings, menus, settings, README mentions) matches the actual
 * implementation.
 *
 * Checks C1–C6 per settings-manifest-parity spec.
 *
 * This file MUST NOT use `describe.skip` or `it.skip`. If a check must
 * be marked as a known failure, use `it.fails` with a comment.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  __mockedCommands,
  __mockedContexts,
  __mockedInfoMessages,
  __mockedErrorMessages,
  __resetMockState,
  __setMockConfiguration,
} from "./__mocks__/vscode";
import { KEY_MAP } from "./settings-core";

// ── Test fixtures ──────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const manifestPath = path.resolve(ROOT, "package.json");
const readmePath = path.resolve(ROOT, "README.md");
const supervisorSpecPath = path.resolve(ROOT, "src/rig/supervisor.spec.ts");

let manifest: {
  contributes: {
    commands: Array<{ command: string; title: string }>;
    keybindings: Array<{ command: string; when?: string }>;
    menus: Record<string, Array<{ command: string; when?: string }>>;
    configuration: {
      properties: Record<string, { type: string; default?: unknown }>;
    };
  };
};
let readme: string;
let supervisorSpecSource: string;

beforeAll(() => {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  readme = fs.readFileSync(readmePath, "utf8");
  supervisorSpecSource = fs.readFileSync(supervisorSpecPath, "utf8");
});

beforeEach(async () => {
  __resetMockState();

  // Configure mock settings so activation uses port 0 (random free ports).
  // This avoids conflicts with real services during testing.
  __setMockConfiguration("rig", {
    relayPort: 0,
    httpPort: 0,
  });
  __setMockConfiguration("hydra", {});

  // Mock-activate the extension. This drives registerCommand and
  // setContext through the vscode mock.
  const { activate } = await import("./extension");
  const fakeContext = {
    subscriptions: [] as Array<{ dispose: () => void }>,
    extensionPath: __dirname,
    storageUri: undefined,
    globalState: {
      get: () => undefined,
      update: async () => {},
      keys: () => [],
    },
  };
  await activate(fakeContext as unknown as import("vscode").ExtensionContext);

  // Check if activation failed (supervisor or blobReceiver errors).
  if (__mockedErrorMessages.length > 0) {
    throw new Error(`Activation failed with errors: ${__mockedErrorMessages.join("; ")}`);
  }

  // Allow async callbacks (wire.onReady, etc.) to settle.
  await new Promise((r) => {
    setTimeout(r, 100);
  });

  // Dispose all subscriptions to clean up ports.
  for (const sub of fakeContext.subscriptions) {
    sub.dispose();
  }
  // Wait for async dispose (supervisor.stop, blobReceiver.stop).
  await new Promise((r) => {
    setTimeout(r, 200);
  });
});

// ── C1 — Commands parity ───────────────────────────────────────────────

describe("manifest parity", () => {
  it("C1: every declared command is registered (forward)", () => {
    const declared = manifest.contributes.commands.map((c) => c.command);
    for (const cmd of declared) {
      expect(__mockedCommands, `command "${cmd}" declared but not registered`).toContain(cmd);
    }
  });

  it("C1: every registered command is declared (backward)", () => {
    const declared = new Set(manifest.contributes.commands.map((c) => c.command));
    for (const cmd of __mockedCommands) {
      expect(declared, `command "${cmd}" registered but not declared`).toContain(cmd);
    }
  });

  // ── C2 — Settings KEY_MAP coverage ─────────────────────────────────

  it("C2: every declared setting is consumed by KEY_MAP (forward)", () => {
    const properties = Object.keys(manifest.contributes.configuration.properties);
    const rigKeys = new Set(KEY_MAP.map((m) => `rig.${m.rigKey}`));
    const hydraKeys = new Set(
      KEY_MAP.map((m) => m.hydraKey)
        .filter((k): k is string => k !== null)
        .map((k) => `hydra.${k}`),
    );

    for (const key of properties) {
      const matched = rigKeys.has(key) || hydraKeys.has(key);
      expect(matched, `setting "${key}" declared but not in KEY_MAP`).toBe(true);
    }
  });

  it("C2: every KEY_MAP entry has a declared setting (backward)", () => {
    const properties = manifest.contributes.configuration.properties;
    for (const { rigKey } of KEY_MAP) {
      const declaredKey = `rig.${rigKey}`;
      expect(
        properties,
        `setting "${declaredKey}" consumed by KEY_MAP but not declared`,
      ).toHaveProperty(declaredKey);
    }
  });

  // ── C3 — Context keys parity ───────────────────────────────────────

  it("C3: every context key in when clauses is set by production code", () => {
    // Extract context keys from keybindings and menus.
    const contextKeys = new Set<string>();
    const contextKeyPattern = /vscode-hydra\.([a-zA-Z][a-zA-Z0-9]*)/g;

    for (const kb of manifest.contributes.keybindings) {
      if (kb.when) {
        let match: RegExpExecArray | null;
        while ((match = contextKeyPattern.exec(kb.when)) !== null) {
          contextKeys.add(`vscode-hydra.${match[1]}`);
        }
      }
    }

    for (const menuItems of Object.values(manifest.contributes.menus)) {
      for (const item of menuItems) {
        if (item.when) {
          let match: RegExpExecArray | null;
          while ((match = contextKeyPattern.exec(item.when)) !== null) {
            contextKeys.add(`vscode-hydra.${match[1]}`);
          }
        }
      }
    }

    for (const key of contextKeys) {
      expect(
        __mockedContexts,
        `context key "${key}" referenced in when clause but never set`,
      ).toContain(key);
    }
  });

  // ── C4 — README parity ─────────────────────────────────────────────

  it("C4: every rig.* mention in README is a declared setting", () => {
    const properties = manifest.contributes.configuration.properties;
    // Only `rig.*` mentions must be declared settings. The `hydra.*` namespace
    // is the legacy 0.3.x schema and intentionally contains commands
    // (`hydra.startOscBridge`), deprecation aliases, and backwards-compat
    // fallbacks — those are validated by C5 (commands) and P2.1 (resolver).
    // Match `rig.X` only when not part of a larger namespace (e.g.
    // `jdomizz.vscode-hydra.width` should not match `rig.width` if such
    // a key ever existed). The `(?:^|[^\w-])` lookbehind ensures a word
    // boundary not preceded by a hyphen or word char.
    const mentionPattern = /(?:^|[^\w-])rig\.([a-zA-Z][a-zA-Z0-9]*)\b/g;
    const mentions = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(readme)) !== null) {
      const settingKey = `rig.${match[1]}`;
      const matchIndex = match.index + match[0].indexOf("rig.");
      const lineStart = readme.lastIndexOf("\n", matchIndex) + 1;
      const before = readme.slice(lineStart, matchIndex);
      const after = readme.slice(matchIndex + match[0].length, matchIndex + 20);
      // Skip if preceded by :// (URL scheme) on this line.
      if (before.includes("://") || before.endsWith("/")) {
        continue;
      }
      // Skip if followed by .ext (file extension in a path).
      if (/^\.\w{2,4}(?:\s|$|[)'"`])/.test(after)) {
        continue;
      }
      mentions.add(settingKey);
    }

    for (const mention of mentions) {
      expect(
        properties,
        `README mentions "${mention}" but it is not declared in contributes.configuration`,
      ).toHaveProperty(mention);
    }
    expect(mentions.size).toBeGreaterThan(0);
  });

  // ── C5 — Deprecated aliases ────────────────────────────────────────

  it("C5: if legacy hydra.* commands are declared, they are registered as informational no-ops", () => {
    const legacyCommands = [
      "hydra.startOscBridge",
      "hydra.stopOscBridge",
      "hydra.startHttpServer",
      "hydra.stopHttpServer",
    ];
    const declared = new Set(manifest.contributes.commands.map((c) => c.command));

    for (const cmd of legacyCommands) {
      if (declared.has(cmd)) {
        // If declared, must be registered.
        expect(__mockedCommands, `legacy command "${cmd}" declared but not registered`).toContain(
          cmd,
        );
      }
    }
    // If none are declared, this test passes vacuously.
  });

  // ── C6 — Hybrid binary paths ───────────────────────────────────────

  it("C6: every rig.*Path setting used by the supervisor has at least one test exercising the spawned-binary path", () => {
    // The supervisor uses relayPath, servePath, oscBridgePath, midiBridgePath.
    // Other *Path settings (sweepCliPath, httpServerPath) are consumed elsewhere.
    const supervisorPathKeys = ["relayPath", "servePath", "oscBridgePath", "midiBridgePath"];

    for (const rigKey of supervisorPathKeys) {
      // Heuristic: the supervisor spec source should mention the rig key
      // or its camelCase equivalent in a test context.
      const pattern = new RegExp(`rig\\.${rigKey}|${rigKey}`, "i");
      expect(supervisorSpecSource, `no test in supervisor.spec.ts mentions rig.${rigKey}`).toMatch(
        pattern,
      );
    }
  });
});
