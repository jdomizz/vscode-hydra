/**
 * Runtime page entry — the external-browser render surface for vscode-hydra.
 *
 * Mounts `<hydra-element>` (D5: never imports `hydra-synth` directly),
 * connects to the rig-relay via `@jdomizz/rig-host`'s `createRigHost`,
 * and delegates wire conformance to the rig-host kit.
 *
 * URL params:
 *   ?relay=ws://host:port   — relay WebSocket URL (default ws://localhost:9163)
 *   &context=hydra          — runtime context (default "hydra"; future: strudel, etc.)
 *
 * Exposes `window.hydraRuntime` for testing and debugging.
 */
import 'hydra-element';
import { createRigHost } from '@jdomizz/rig-host';
import { createHydraEngine } from './adapter.js';

const params = new URLSearchParams(globalThis.location.search);
const relayUrl = params.get('relay') ?? 'ws://localhost:9163';
const contextId = params.get('context') ?? 'hydra';

// Mount <hydra-element>
const el = document.createElement('hydra-element') as HTMLElement & {
  code: string;
  readonly canvas: HTMLCanvasElement | null;
  readonly synth: unknown;
};
el.setAttribute('audio', 'false');
document.body.appendChild(el);

const host = createRigHost({
  wsUrl: relayUrl,
  engine: createHydraEngine(el),
  fpsIntervalMs: 2000,
});

void host.start();

(globalThis as unknown as { hydraRuntime: {
  element: HTMLElement;
  context: string;
  relayUrl: string;
  dispose(): void;
} }).hydraRuntime = {
  element: el,
  context: contextId,
  relayUrl,
  dispose: () => host.dispose(),
};
