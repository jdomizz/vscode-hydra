/**
 * Pure settings resolver — no VS Code dependency.
 *
 * rig.* settings are primary; hydra.* settings are backward-compatible
 * fallbacks. Resolution order:
 *   1. rig.* if explicitly set by the user (even to its default value)
 *   2. hydra.* if explicitly set by the user
 *   3. hardcoded defaults
 */

export interface RigSettings {
  readonly instrument: 'sweep' | 'cycles';
  readonly target: 'sweep' | 'hydra' | 'default';
  readonly renderer: 'external' | 'webview';
  readonly relayPort: number;
  readonly httpPort: number;
  readonly udpIn: number;
  readonly udpOut: number;
  readonly midiEnabled: boolean;
  readonly sweepCliPath: string;
  readonly oscBridgePath: string;
  readonly midiBridgePath: string;
  readonly httpServerPath: string;
  readonly relayPath: string;
  readonly servePath: string;
  readonly loadScripts: string[];
  readonly capturePort: number;
  readonly captureTimeoutMs: number;
}

export const DEFAULTS: RigSettings = {
  instrument: 'sweep',
  target: 'default',
  renderer: 'external',
  relayPort: 9163,
  httpPort: 8080,
  udpIn: 9000,
  udpOut: 9001,
  midiEnabled: false,
  sweepCliPath: 'sweepctl',
  oscBridgePath: 'sweep-osc-bridge',
  midiBridgePath: 'sweep-midi-bridge',
  httpServerPath: 'sweep-http',
  relayPath: 'rig-relay',
  servePath: 'rig-serve',
  loadScripts: [],
  capturePort: 8081,
  captureTimeoutMs: 30000,
};

/**
 * Maps each rig.* key to its hydra.* fallback key (if any).
 * Keys without a fallback resolve to the hardcoded default only.
 */
const KEY_MAP: ReadonlyArray<{
  rigKey: keyof RigSettings;
  hydraKey: string | null;
}> = [
  { rigKey: 'instrument', hydraKey: null },
  { rigKey: 'target', hydraKey: null },
  { rigKey: 'renderer', hydraKey: null },
  { rigKey: 'relayPort', hydraKey: 'syncPort' },
  { rigKey: 'httpPort', hydraKey: 'httpPort' },
  { rigKey: 'udpIn', hydraKey: 'oscUdpPort' },
  { rigKey: 'udpOut', hydraKey: null },
  { rigKey: 'midiEnabled', hydraKey: null },
  { rigKey: 'sweepCliPath', hydraKey: 'sweepCliPath' },
  { rigKey: 'oscBridgePath', hydraKey: 'oscBridgePath' },
  { rigKey: 'midiBridgePath', hydraKey: null },
  { rigKey: 'httpServerPath', hydraKey: 'httpServerPath' },
  { rigKey: 'relayPath', hydraKey: null },
  { rigKey: 'servePath', hydraKey: null },
  { rigKey: 'loadScripts', hydraKey: 'loadScripts' },
  { rigKey: 'capturePort', hydraKey: null },
  { rigKey: 'captureTimeoutMs', hydraKey: null },
];

/**
 * Legacy 0.3.x namespace mapping — `jdomizz.vscode-hydra.*` keys that
 * ship in older installs and need to be honored as fallbacks for
 * v1.0's `rig.*` settings. Per m4-release-safety.md §Settings migration map.
 *
 * Add a row here when the README "Upgrading" section documents a
 * 0.3.x key. Keys NOT listed here are silently ignored (e.g. width/height).
 */
const LEGACY_KEY_MAP: ReadonlyArray<{
  rigKey: keyof RigSettings;
  legacyKey: string;
}> = [
  { rigKey: 'loadScripts', legacyKey: 'loadScripts' },
];

/**
 * Pure resolver: given a set of explicitly-set rig values, hydra values,
 * and legacy 0.3.x values, produce a fully-resolved RigSettings.
 *
 * Precedence: rig > hydra > legacy > defaults.
 */
export function resolveSettings(
  rigSet: Readonly<Record<string, unknown>>,
  hydraSet: Readonly<Record<string, unknown>>,
  legacySet: Readonly<Record<string, unknown>> = {},
): RigSettings {
  const result: Record<string, unknown> = {};

  for (const { rigKey, hydraKey } of KEY_MAP) {
    if (rigKey in rigSet) {
      result[rigKey] = rigSet[rigKey];
    } else if (hydraKey !== null && hydraKey in hydraSet) {
      result[rigKey] = hydraSet[hydraKey];
    } else {
      const legacy = LEGACY_KEY_MAP.find((m) => m.rigKey === rigKey);
      if (legacy && legacy.legacyKey in legacySet) {
        result[rigKey] = legacySet[legacy.legacyKey];
      } else {
        result[rigKey] = DEFAULTS[rigKey];
      }
    }
  }

  return result as unknown as RigSettings;
}

export { KEY_MAP, LEGACY_KEY_MAP };
