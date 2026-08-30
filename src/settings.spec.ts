import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveSettings, DEFAULTS } from './settings-core.js';
import type { RigSettings } from './settings-core.js';

describe('resolveSettings', () => {
  it('returns defaults when no settings are set', () => {
    const result = resolveSettings({}, {});
    assert.deepStrictEqual(result, DEFAULTS);
  });

  it('rig.* value wins over hydra.* value', () => {
    const rigSet = { relayPort: 7777 };
    const hydraSet = { syncPort: 5555 };
    const result = resolveSettings(rigSet, hydraSet);
    assert.equal(result.relayPort, 7777);
  });

  it('hydra.* fallback works when rig.* is absent', () => {
    const hydraSet = { syncPort: 5555 };
    const result = resolveSettings({}, hydraSet);
    assert.equal(result.relayPort, 5555);
  });

  it('explicit rig.* default still wins over hydra.* non-default', () => {
    // User explicitly set rig.relayPort = 9163 (the default), and
    // hydra.syncPort = 5555. The rig namespace should win because the
    // user explicitly chose it.
    const rigSet = { relayPort: 9163 };
    const hydraSet = { syncPort: 5555 };
    const result = resolveSettings(rigSet, hydraSet);
    assert.equal(result.relayPort, 9163);
  });

  it('resolves all mapped keys correctly', () => {
    const rigSet = {
      instrument: 'cycles',
      target: 'sweep',
      relayPort: 1111,
      httpPort: 2222,
      udpIn: 3333,
      udpOut: 4444,
      midiEnabled: true,
      sweepCliPath: '/a',
      oscBridgePath: '/b',
      midiBridgePath: '/c',
      httpServerPath: '/d',
      relayPath: '/e',
      servePath: '/f',
    };
    const result = resolveSettings(rigSet, {});
    assert.deepStrictEqual(result, rigSet as unknown as RigSettings);
  });

  it('hydra fallback uses correct key mapping', () => {
    // hydra.syncPort → rig.relayPort
    // hydra.httpPort → rig.httpPort
    // hydra.oscUdpPort → rig.udpIn
    // hydra.sweepCliPath → rig.sweepCliPath
    // hydra.oscBridgePath → rig.oscBridgePath
    // hydra.httpServerPath → rig.httpServerPath
    const hydraSet = {
      syncPort: 1000,
      httpPort: 2000,
      oscUdpPort: 3000,
      sweepCliPath: '/x',
      oscBridgePath: '/y',
      httpServerPath: '/z',
    };
    const result = resolveSettings({}, hydraSet);
    assert.equal(result.relayPort, 1000);
    assert.equal(result.httpPort, 2000);
    assert.equal(result.udpIn, 3000);
    assert.equal(result.sweepCliPath, '/x');
    assert.equal(result.oscBridgePath, '/y');
    assert.equal(result.httpServerPath, '/z');
    // Unmapped keys should still be defaults
    assert.equal(result.udpOut, DEFAULTS.udpOut);
    assert.equal(result.instrument, DEFAULTS.instrument);
  });

  it('partial rig.* overrides only those keys, hydra fills the rest', () => {
    const rigSet = { relayPort: 9999 };
    const hydraSet = { syncPort: 1111, httpPort: 2222 };
    const result = resolveSettings(rigSet, hydraSet);
    // rig wins for relayPort
    assert.equal(result.relayPort, 9999);
    // hydra fills httpPort (no rig override)
    assert.equal(result.httpPort, 2222);
    // default for udpOut (no override in either)
    assert.equal(result.udpOut, DEFAULTS.udpOut);
  });
});
