import { describe, it, expect, afterEach } from 'vitest';
import { RigProcessSupervisor } from './supervisor.js';
import type { RigSettings } from '../settings.js';
import { DEFAULTS } from '../settings.js';

/** Build a RigSettings with the given overrides. */
function makeSettings(overrides: Partial<RigSettings> = {}): RigSettings {
  return { ...DEFAULTS, ...overrides };
}

describe('RigProcessSupervisor', () => {
  const supervisors: RigProcessSupervisor[] = [];

  afterEach(async () => {
    // Clean up any supervisors that weren't explicitly stopped.
    for (const supervisor of supervisors) {
      try {
        await supervisor.stop();
      } catch {
        // Ignore errors during cleanup.
      }
    }
    supervisors.length = 0;
  });

  describe('in-process mode', () => {
    it('starts relay and serve in-process and reports correct status', async () => {
      const settings = makeSettings({ relayPort: 0, httpPort: 0 });
      const supervisor = new RigProcessSupervisor(settings);
      supervisors.push(supervisor);

      const { relayUrl, httpUrl } = await supervisor.start();

      expect(relayUrl).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
      expect(httpUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const status = supervisor.getStatus();
      expect(status.relay.mode).toBe('in-process');
      expect(status.relay.running).toBe(true);
      expect(status.http.mode).toBe('in-process');
      expect(status.http.running).toBe(true);

      await supervisor.stop();

      const statusAfter = supervisor.getStatus();
      expect(statusAfter.relay.mode).toBe('stopped');
      expect(statusAfter.relay.running).toBe(false);
      expect(statusAfter.http.mode).toBe('stopped');
      expect(statusAfter.http.running).toBe(false);
    });

    it('relay listens on a random port when port is 0', async () => {
      const settings = makeSettings({ relayPort: 0, httpPort: 0 });
      const supervisor = new RigProcessSupervisor(settings);
      supervisors.push(supervisor);

      const { relayUrl } = await supervisor.start();
      const port = parseInt(relayUrl.split(':').pop()!, 10);
      expect(port).toBeGreaterThan(0);

      await supervisor.stop();
    });

    it('serve listens on a random port when port is 0', async () => {
      const settings = makeSettings({ relayPort: 0, httpPort: 0 });
      const supervisor = new RigProcessSupervisor(settings);
      supervisors.push(supervisor);

      const { httpUrl } = await supervisor.start();
      const port = parseInt(httpUrl.split(':').pop()!, 10);
      expect(port).toBeGreaterThan(0);

      await supervisor.stop();
    });

    it('reports all four services accurately in in-process mode', async () => {
      const settings = makeSettings({
        relayPort: 0,
        httpPort: 0,
        midiEnabled: false,
      });
      const supervisor = new RigProcessSupervisor(settings);
      supervisors.push(supervisor);

      await supervisor.start();

      const status = supervisor.getStatus();
      expect(status.relay.mode).toBe('in-process');
      expect(status.relay.running).toBe(true);
      expect(status.http.mode).toBe('in-process');
      expect(status.http.running).toBe(true);
      // OSC and MIDI bridges are only started in hybrid mode.
      expect(status.osc.mode).toBe('stopped');
      expect(status.osc.running).toBe(false);
      expect(status.midi.enabled).toBe(false);
      expect(status.midi.mode).toBe('stopped');
      expect(status.midi.running).toBe(false);

      await supervisor.stop();
    });

    it('cannot start after stop', async () => {
      const settings = makeSettings({ relayPort: 0, httpPort: 0 });
      const supervisor = new RigProcessSupervisor(settings);
      supervisors.push(supervisor);

      await supervisor.start();
      await supervisor.stop();

      await expect(supervisor.start()).rejects.toThrow(/cannot start after dispose/i);
    });
  });

  describe('status reporting', () => {
    it('reports stopped status before start', () => {
      const settings = makeSettings({ relayPort: 9163, httpPort: 8080 });
      const supervisor = new RigProcessSupervisor(settings);

      const status = supervisor.getStatus();
      expect(status.relay.mode).toBe('stopped');
      expect(status.relay.running).toBe(false);
      expect(status.relay.port).toBe(9163);
      expect(status.http.mode).toBe('stopped');
      expect(status.http.running).toBe(false);
      expect(status.http.port).toBe(8080);
    });

    it('reports correct port from settings', async () => {
      const settings = makeSettings({ relayPort: 0, httpPort: 0 });
      const supervisor = new RigProcessSupervisor(settings);
      supervisors.push(supervisor);

      await supervisor.start();

      const status = supervisor.getStatus();
      // Port 0 means random port, but status should report the configured port.
      expect(status.relay.port).toBe(0);
      expect(status.http.port).toBe(0);

      await supervisor.stop();
    });
  });
});
