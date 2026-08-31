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

  // Recording state. MediaRecorder is created on `startCapture` and torn
  // down on `stopCapture`; chunks accumulate via `ondataavailable`.
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

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
      const canvas = el.canvas;
      if (!canvas) {
        throw new Error("canvas not available");
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))));
      });
      downloadBlob(blob, filename("png"));
    },

    startCapture() {
      const canvas = el.canvas;
      if (!canvas || recorder) {
        return;
      }
      try {
        const stream = canvas.captureStream(25);
        recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9",
        });
        chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        recorder.start(100);
      } catch {
        // rig-host now wraps engine.startCapture in try/catch and emits
        // error feedback; the throw is re-thrown so that path activates.
        recorder = null;
        chunks = [];
        throw new Error("MediaRecorder start failed");
      }
    },

    async stopCapture(): Promise<void> {
      if (!recorder) {
        return;
      }
      const currentRecorder = recorder;
      recorder = null;
      // Wait for the recorder's `onstop` event so the final
      // `ondataavailable` chunks land in `chunks` before we concat.
      await new Promise<void>((resolve) => {
        currentRecorder.addEventListener("stop", () => resolve(), { once: true });
        currentRecorder.stop();
      });
      const blob = new Blob(chunks, { type: "video/webm" });
      chunks = [];
      downloadBlob(blob, filename("webm"));
    },

    getFps(): number {
      const synth = getSynth();
      const stats = synth?.stats as { fps?: number } | undefined;
      return stats?.fps ?? 0;
    },
  };
}

/**
 * Trigger a browser download by creating an Object URL, an invisible
 * anchor element with a `download` attribute, and a synthetic click.
 * Revokes the URL on next tick to release the blob memory.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filename(ext: "png" | "webm"): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return ext === "png" ? `hydra-capture-${ts}.${ext}` : `hydra-recording-${ts}.${ext}`;
}
