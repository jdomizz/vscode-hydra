import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";
import { getRigSettings, onSettingsChanged } from "./settings.js";
import { EditorService } from "./editor/index.js";
import { DiagnosticsManager } from "./diagnostics.js";
import { flashEditorForEval, errorRange } from "./decorations.js";
import { StatusPanel } from "./status/index.js";
import { RigWire, RigProcessSupervisor } from "./rig/index.js";
import { CapturePipeline } from "./capture/pipeline.js";
import open from "open";

/**
 * Deprecated alias commands — preserved as informational no-ops so users
 * upgrading from 0.3.x don't hit "command not found" errors. Per
 * m4-release-safety.md §P2.3.
 */
const DEPRECATED_ALIASES: ReadonlyArray<{ name: string; message: string }> = [
  { name: "startOscBridge", message: "the OSC bridge starts automatically" },
  { name: "stopOscBridge", message: "the OSC bridge is managed by the rig supervisor" },
  { name: "startHttpServer", message: "the HTTP server starts automatically" },
  { name: "stopHttpServer", message: "the HTTP server is managed by the rig supervisor" },
];

/** Current major version — increment to re-trigger what's-new notification on upgrade. */
const WHATS_NEW_VERSION = "1.0";

/**
 * Show a one-time info message if the user has any 0.3.x settings
 * (`jdomizz.vscode-hydra.*`) that v1.0 silently consumes / ignores.
 * Uses globalState to fire only once per session.
 */
function notifyMigrationIfNeeded(context: vscode.ExtensionContext): void {
  const legacy = vscode.workspace.getConfiguration("jdomizz.vscode-hydra");
  const knownKeys = ["width", "height", "loadScripts"];
  const hasLegacy = knownKeys.some((key) => {
    const inspected = legacy.inspect(key);
    return inspected?.workspaceValue !== undefined || inspected?.globalValue !== undefined;
  });
  if (!hasLegacy) return;

  const sessionKey = "vscode-hydra.migrationNoticeShown";
  if (context.globalState.get<boolean>(sessionKey)) return;
  void context.globalState.update(sessionKey, true);

  vscode.window.showInformationMessage(
    "vscode-hydra v1.0 detected legacy settings (`jdomizz.vscode-hydra.*`). `loadScripts` is honored as `rig.loadScripts`; `width` / `height` are silently ignored. See README → Upgrading from 0.3.x for the full migration map.",
    "OK",
  );
}

/**
 * Show a one-time "what's new in v1.0" notification the first time the
 * extension activates at this major version. Per m4-release-safety.md §P3.2.
 */
function notifyWhatsNewIfFirstActivation(context: vscode.ExtensionContext): void {
  const key = "vscode-hydra.whatsNewShownVersion";
  if (context.globalState.get<string>(key) === WHATS_NEW_VERSION) return;
  void context.globalState.update(key, WHATS_NEW_VERSION);

  vscode.window.showInformationMessage(
    `vscode-hydra ${WHATS_NEW_VERSION} shipped. Big changes: external browser runtime, single status panel, rig.* settings. See README → Upgrading from 0.3.x.`,
    "OK",
  );
}

/**
 * Extension activation — M3 v1.0 wiring.
 *
 * Activation sequence:
 * 1. Resolve settings (rig.* primary, hydra.* fallback).
 * 2. Start RigProcessSupervisor (in-process relay + HTTP server by default).
 * 3. Connect RigWire to the supervisor's relay URL.
 * 4. Register commands (eval, capture, openRuntime, panic).
 * 5. On wire ready, open the runtime page in the external browser.
 *
 * Deactivation reverses the order: wire → supervisor.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // One-time notifications (m4 §P2.1 migration + §P3.2 what's new).
  notifyMigrationIfNeeded(context);
  notifyWhatsNewIfFirstActivation(context);

  const settings = getRigSettings();
  const diagnostics = new DiagnosticsManager();
  const editor = new EditorService();
  const status = new StatusPanel();

  // Start the rig process supervisor (relay + HTTP server).
  // In-process by default; hybrid mode when rig.*Path settings point to
  // external binaries. Resolves when both relay and HTTP server are listening.
  const supervisor = new RigProcessSupervisor(settings);
  let relayUrl: string;
  let httpUrl: string;
  try {
    const urls = await supervisor.start();
    relayUrl = urls.relayUrl;
    httpUrl = urls.httpUrl;
  } catch (err) {
    const message = (err as Error).message;
    vscode.window.showErrorMessage(`Rig supervisor failed to start: ${message}`);
    context.subscriptions.push({
      dispose: () => {
        diagnostics.dispose();
        status.dispose();
      },
    });
    return;
  }

  // Set initial status context key so keybindings/menus resolve correctly.
  await vscode.commands.executeCommand("setContext", "vscode-hydra.status", "rendering");

  // Wire integration — connects to the supervisor's relay.
  const wire = new RigWire();
  wire.connect(relayUrl);

  // Status panel subscribes to wire feedback for panic/recording state.
  context.subscriptions.push(status.subscribe(wire));

  // Current runtime URL — updated when the wire connects, read by openRuntime command.
  let currentRuntimeUrl: string | null = null;

  // Wire ready (WebSocket open) → open the runtime page in external browser.
  // The `open` call is gated on non-test env so `npm test`'s mock-activations
  // do not spawn browser tabs. The status bar click (`vscode-hydra.openRuntime`,
  // below) still uses `vscode.env.openExternal`, which is VS Code's native
  // path and is unaffected by the `open` package.
  const openBrowser = process.env.VITEST ? () => {} : open;
  wire.onReady(() => {
    currentRuntimeUrl = `${httpUrl}/runtime/index.html?relay=${encodeURIComponent(relayUrl)}&context=hydra`;
    status.update({
      running: true,
      relay: { port: settings.relayPort, connected: true },
      http: { port: settings.httpPort, running: true },
      panic: false,
      recording: false,
      runtimeUrl: currentRuntimeUrl,
    });
    openBrowser(currentRuntimeUrl);
  });

  // Wire feedback → update status for state changes.
  wire.onFeedback((fb) => {
    if (fb.type === "state" || fb.type === "state:update") {
      status.update({
        running: true,
        relay: { port: settings.relayPort, connected: true },
        http: { port: settings.httpPort, running: true },
        panic: false,
        recording: false,
      });
    }
  });

  // Wire errors → surface as status update (disconnected).
  wire.onError((err) => {
    vscode.window.showErrorMessage(`Rig wire error: ${err.message}`);
    status.update({
      running: false,
      panic: false,
      recording: false,
    });
  });

  // Eval commands — use EditorService methods + flash + diagnostics.
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.evalDocument", async () => {
      try {
        const { code, range } = editor.document();
        await evalWithFlash(wire, diagnostics, code, range);
      } catch (err) {
        vscode.window.showErrorMessage(`Eval failed: ${(err as Error).message}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.evalLine", async () => {
      try {
        const { code, range } = editor.line();
        await evalWithFlash(wire, diagnostics, code, range);
      } catch (err) {
        vscode.window.showErrorMessage(`Eval failed: ${(err as Error).message}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.evalBlock", async () => {
      try {
        const { code, range } = editor.block();
        await evalWithFlash(wire, diagnostics, code, range);
      } catch (err) {
        vscode.window.showErrorMessage(`Eval failed: ${(err as Error).message}`);
      }
    }),
  );

  // Capture commands — the runtime downloads the file locally; the
  // pipeline only fires the wire command and awaits capture:state for
  // recording (no path returned in v1.0). See capture-download spec.
  const capture = new CapturePipeline(wire);
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.captureImage", async () => {
      try {
        const result = await capture.captureImage();
        if (result.ok) {
          status.markCaptured();
          vscode.window.showInformationMessage("Screenshot saved to your browser Downloads folder");
        } else {
          vscode.window.showErrorMessage("Screenshot failed");
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Screenshot failed: ${(err as Error).message}`);
      }
    }),
  );

  // Open the user's Downloads folder in the OS file manager. The
  // runtime downloads captures there (per the capture-download model).
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.openDownloadsFolder", () => {
      const downloads = path.join(os.homedir(), "Downloads");
      return vscode.env.openExternal(vscode.Uri.file(downloads));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.startRecorder", async () => {
      try {
        await capture.startRecording();
        vscode.window.showInformationMessage("Recording started");
      } catch (err) {
        vscode.window.showErrorMessage(`Recording failed: ${(err as Error).message}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.stopRecorder", async () => {
      try {
        await capture.stopRecording();
        vscode.window.showInformationMessage(
          "Recording stopped — file will appear in the browser Downloads folder",
        );
      } catch (err) {
        vscode.window.showErrorMessage(`Recording failed: ${(err as Error).message}`);
      }
    }),
  );

  // Deprecated alias commands — preserved for muscle-memory from 0.3.x.
  // The rig supervisor now starts these services automatically; these
  // commands exist only to avoid "command not found" surprises. They
  // will be removed in v1.1.
  for (const alias of DEPRECATED_ALIASES) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`hydra.${alias.name}`, async () => {
        vscode.window.showInformationMessage(
          `hydra.${alias.name} moved to the rig supervisor — ${alias.message}. See README → → Upgrading from 0.3.x.`,
          "OK",
        );
      }),
    );
  }

  // Open runtime in external browser — invoked by status bar click.
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.openRuntime", async () => {
      if (currentRuntimeUrl) {
        await vscode.env.openExternal(vscode.Uri.parse(currentRuntimeUrl));
      } else {
        vscode.window.showWarningMessage("Runtime is not ready yet");
      }
    }),
  );

  // Panic — silence all outputs immediately.
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-hydra.panic", async () => {
      try {
        await wire.sendCommand({ type: "panic" });
      } catch (err) {
        vscode.window.showErrorMessage(`Panic failed: ${(err as Error).message}`);
      }
    }),
  );

  // Subscribe to settings changes (hot-reload of rig.* values).
  context.subscriptions.push(
    onSettingsChanged((s) => {
      // Re-connect wire if relay port changed.
      const newRelayUrl = `ws://localhost:${s.relayPort}`;
      if (newRelayUrl !== relayUrl) {
        wire.connect(newRelayUrl);
      }
      // Update status with new ports.
      status.update({
        running: wire.connected,
        relay: { port: s.relayPort, connected: wire.connected },
        http: { port: s.httpPort, running: wire.connected },
        panic: false,
        recording: false,
      });
    }),
  );

  // Cleanup — reverse order of creation.
  context.subscriptions.push({
    dispose: () => {
      diagnostics.dispose();
      status.dispose();
      wire.dispose();
      void supervisor.stop();
    },
  });
}

/**
 * Evaluate code with visual flash and diagnostics.
 *
 * Flashes the evaluated range, sends the code to the runtime via the wire,
 * and surfaces errors as diagnostics + wavy underlines.
 */
async function evalWithFlash(
  wire: RigWire,
  diagnostics: DiagnosticsManager,
  code: string,
  range: vscode.Range,
): Promise<void> {
  const textEditor = vscode.window.activeTextEditor;
  if (!textEditor) {
    vscode.window.showWarningMessage("No active file editor");
    return;
  }

  // Clear prior diagnostics for this document before evaluating.
  diagnostics.clear(textEditor.document.uri);

  // Flash the evaluated range.
  flashEditorForEval(textEditor, code, range);

  // Send to runtime.
  const result = await wire.eval(code);

  // Surface errors as diagnostics + wavy underlines.
  if (!result.ok && result.feedback?.type === "error") {
    const message = result.feedback.message;
    diagnostics.report(textEditor, message, range, "error");
    errorRange(textEditor, range, message);
  }
}
