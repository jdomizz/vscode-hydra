/**
 * Adapter: — bridges `<hydra-element>` to rig-host's `HostEngine` seam.
 *
 * Maps the element's public surface (code setter, synth property, canvas,
 * hydra-eval event) to the HostEngine hooks rig-host expects. Hooks the
 * element cannot satisfy are omitted; rig-host supplies defaults (error
 * feedback, lastGoodCode replay) for those.
 *
 * Capture model (v1.0): the engine itself triggers browser downloads via
 * `URL.createObjectURL` + anchor click. The runtime does NOT POST blobs
 * to the editor; the file lands in the browser's Downloads folder. The
 * editor pipeline is fire-and-forget for `capture:image` and only
 * round-trips `capture:state` for the recording indicator. See
 * capture-download spec.
 *
 * See runtime-r-comformance spec §D4 for the full HostEngine mapping table.
 */
import type { HostEngine } from "@jdomizz/rig-host";
import { Capture, downloadBlob, filenameWithStamp } from "@jdomizz/rig-capture";

/**
 * Create a {@link HostEngine} backed by a `<hydra-element>` instance.
 *
 * The element's `synth` property is reached at runtime for bpm/fps; this
 * does not violate D5 (no `hydra-synth` *import* — the synth is the
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
  const getSynth = (): Record<string, unknown> | null =>
    (el.synth as Record<string, unknown> | null) ?? null;

  // Capture lifecycle via the shared rig-capture core (single canvas, so
  // the target label is unused). Replaces the hand-rolled MediaRecorder
  // here with sweep's battle-tested MIME-fallback + bitrate implementation.
  const capture = new Capture(() => el.canvas);

  return {
    state() {
      const synth = getSynth();
      return {
        playing: true,
        bpm: (synth?.bpm as number) ?? 120,
      };
    },

    async eval(code: string) {
      // Attach listener BEFORE setting code — the hydra-eval event fires
      // asynchronously as a result of the code assignment.
      const evalPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
        const handler = (e: Event) => {
          el.removeEventListener("hydra-eval", handler);
          const detail = (e as CustomEvent).detail as { success: boolean; error?: string };
          resolve(detail);
        };
        el.addEventListener("hydra-eval", handler);
        // Timeout after 5s if no event fires (preserved from pre-refactor)
        setTimeout(() => {
          el.removeEventListener("hydra-eval", handler);
          resolve({ success: true });
        }, 5000);
      });
      el.code = code;
      const result = await evalPromise;
      if (!result.success) {
        throw new Error(result.error ?? "eval failed");
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

    async captureImage(): Promise<void> {
      const synth = getSynth();
      (synth?.screencap as (() => void) | undefined)?.();
      if (!el.canvas) {
        throw new Error("canvas not available");
      }
      const blob = await capture.snapshot();
      downloadBlob(blob, filenameWithStamp("hydra-capture", "png"));
    },

    startCapture() {
      capture.startRecording();
    },

    async stopCapture(): Promise<void> {
      if (!capture.recording) {
        return;
      }
      const blob = await capture.stopRecording();
      downloadBlob(blob, filenameWithStamp("hydra-capture", "webm"));
    },

    getFps(): number {
      const synth = getSynth();
      const stats = synth?.stats as { fps?: number } | undefined;
      return stats?.fps ?? 0;
    },
  };
}
