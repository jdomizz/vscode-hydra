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
 * Pure resolver: given a set of explicitly-set rig values and hydra values,
 * produce a fully-resolved RigSettings.
 *
 * "Explicitly set" means the user wrote the key in settings.json (global or
 * workspace scope). Values absent from both maps fall through to DEFAULTS.
 */
export function resolveSettings(
  rigSet: Readonly<Record<string, unknown>>,
  hydraSet: Readonly<Record<string, unknown>>,
): RigSettings {
  const result: Record<string, unknown> = {};

  for (const { rigKey, hydraKey } of KEY_MAP) {
    if (rigKey in rigSet) {
      result[rigKey] = rigSet[rigKey];
    } else if (hydraKey !== null && hydraKey in hydraSet) {
      result[rigKey] = hydraSet[hydraKey];
    } else {
      result[rigKey] = DEFAULTS[rigKey];
    }
  }

  return result as unknown as RigSettings;
}

export { KEY_MAP };
