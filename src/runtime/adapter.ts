/**
 * Adapter: bridges `<hydra-element>` to rig-host's `HostEngine` seam.
 *
 * Maps the element's public surface (code setter, synth property, canvas,
 * hydra-eval event) to the HostEngine hooks rig-host expects. Hooks the
 * element cannot satisfy are omitted; rig-host supplies defaults (error
 * feedback, lastGoodCode replay) for those.
 *
 * See runtime-conformance spec §D4 for the full mapping table.
 */
import type { HostEngine } from '@jdomizz/rig-host';

/**
 * Create a {@link HostEngine} backed by a `<hydra-element>` instance.
 *
 * The element's `synth` property is reached at runtime for bpm/fps/screencap;
 * this does not violate D5 (no `hydra-synth` *import* — the synth is the
 * element's exposed property, not a direct module dependency).
 */
export function createHydraEngine(
  el: HTMLElement & {
    code: string;
    readonly canvas: HTMLCanvasElement | null;
    readonly synth: unknown;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  },
): HostEngine {
  let recorder: MediaRecorder | null = null;

  const getSynth = (): Record<string, unknown> | null =>
    (el.synth as Record<string, unknown> | null) ?? null;

  return {
    state() {
      const synth = getSynth();
      return {
        playing: true,
        // TODO(spec D4): hydra-element should expose a first-class state()
        // snapshot (playing, bpm, loop active). Until then, read bpm from
        // el.synth and assume playing: true while the loop is active.
        bpm: (synth?.bpm as number) ?? 120,
      };
    },

    async eval(code: string) {
      // Attach listener BEFORE setting code — the hydra-eval event fires
      // asynchronously as a result of the code assignment.
      const evalPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
        const handler = (e: Event) => {
          el.removeEventListener('hydra-eval', handler);
          const detail = (e as CustomEvent).detail as { success: boolean; error?: string };
          resolve(detail);
        };
        el.addEventListener('hydra-eval', handler);
        // Timeout after 5s if no event fires (preserved from pre-refactor)
        setTimeout(() => {
          el.removeEventListener('hydra-eval', handler);
          resolve({ success: true });
        }, 5000);
      });
      el.code = code;
      const result = await evalPromise;
      if (!result.success) {
        throw new Error(result.error ?? 'eval failed');
      }
    },

    // revert: omitted → rig-host replays lastGoodCode via eval
    // panic: omitted → rig-host emits panic:state + gates; canvas clear
    //   is editor-side (follow-up eval with solid(0,0,0).out())
    // tap: omitted → rig-host sends error feedback 'transport:tap not supported'

    setBpm(bpm: number) {
      const synth = getSynth();
      if (synth) {
        synth.bpm = bpm;
      }
    },

    async captureImage(): Promise<Blob> {
      const synth = getSynth();
      (synth?.screencap as (() => void) | undefined)?.();
      const canvas = el.canvas;
      if (!canvas) {
        throw new Error('canvas not available');
      }
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('toBlob returned null'));
          }
        });
      });
    },

    startCapture() {
      const canvas = el.canvas;
      if (!canvas || recorder) {
        return;
      }
      try {
        const stream = canvas.captureStream(25);
        recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
        });
        recorder.start(100);
      } catch {
        // TODO(spec D4): rig-host's handleCaptureStart does not try/catch
        // engine.startCapture(); swallow here to avoid crashing dispatch.
        // Follow up: rig-host should wrap in try/catch and emit error feedback.
        recorder = null;
      }
    },

    stopCapture() {
      if (recorder) {
        recorder.stop();
        recorder = null;
      }
    },

    getFps(): number {
      const synth = getSynth();
      const stats = synth?.stats as { fps?: number } | undefined;
      return stats?.fps ?? 0;
    },
  };
}
