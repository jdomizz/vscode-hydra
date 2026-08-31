import * as vscode from "vscode";
import { resolveSettings, DEFAULTS, KEY_MAP } from "./settings-core";
import type { RigSettings } from "./settings-core";

export type { RigSettings } from "./settings-core";
export { resolveSettings, DEFAULTS } from "./settings-core";

/**
 * Collect explicitly-set values from a WorkspaceConfiguration by inspecting
 * each known key. Returns a plain object containing only keys the user has
 * set at global or workspace scope.
 */
function collectExplicit(
  config: vscode.WorkspaceConfiguration,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const inspected = config.inspect(key);
    if (!inspected) {
      continue;
    }
    // Workspace takes precedence over global within the same namespace.
    if (inspected.workspaceValue !== undefined) {
      out[key] = inspected.workspaceValue;
    } else if (inspected.globalValue !== undefined) {
      out[key] = inspected.globalValue;
    }
  }
  return out;
}

/** Resolve current settings from VS Code configuration. */
export function getRigSettings(): RigSettings {
  const rig = vscode.workspace.getConfiguration("rig");
  const hydra = vscode.workspace.getConfiguration("hydra");
  const legacy = vscode.workspace.getConfiguration("jdomizz.vscode-hydra");

  const rigKeys = KEY_MAP.map((m) => m.rigKey);
  const hydraKeys = KEY_MAP.map((m) => m.hydraKey).filter((k): k is string => k !== null);

  const rigSet = collectExplicit(rig, rigKeys);
  const hydraSet = collectExplicit(hydra, hydraKeys);
  // Only `loadScripts` is honored from the 0.3.x namespace; other keys
  // (width/height) are silently ignored per the migration map.
  const legacySet: Record<string, unknown> = {};
  if ("loadScripts" in legacy) {
    const inspected = legacy.inspect("loadScripts");
    if (inspected?.workspaceValue !== undefined) {
      legacySet["loadScripts"] = inspected.workspaceValue;
    } else if (inspected?.globalValue !== undefined) {
      legacySet["loadScripts"] = inspected.globalValue;
    }
  }

  return resolveSettings(rigSet, hydraSet, legacySet);
}

/**
 * Subscribe to changes on rig.*, hydra.*, or jdomizz.vscode-hydra.* namespaces.
 * Re-resolves settings and invokes handler on any change.
 */
export function onSettingsChanged(handler: (s: RigSettings) => void): vscode.Disposable {
  const d1 = vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("rig") ||
      e.affectsConfiguration("hydra") ||
      e.affectsConfiguration("jdomizz.vscode-hydra")
    ) {
      handler(getRigSettings());
    }
  });
  return d1;
}
