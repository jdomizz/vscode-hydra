/**
 * Runtime page entry — the external-browser render surface for vscode-hydra.
 *
 * Mounts `<hydra-element>` (D5: never imports `hydra-synth` directly),
 * connects to the rig-relay, and routes wire commands into the element.
 *
 * URL params:
 *   ?relay=ws://host:port   — relay WebSocket URL (default ws://localhost:9163)
 *   &context=hydra          — runtime context (default "hydra"; future: strudel, etc.)
 *
 * Exposes `window.hydraRuntime` for testing and debugging.
 */
import 'hydra-element';
import {
  TransportClient,
  isRigCommand,
  type RigCommand,
  type RigFeedback,
} from '@jdomizz/rig-transport';

const params = new URLSearchParams(globalThis.location.search);
const relayUrl = params.get('relay') ?? 'ws://localhost:9163';
const contextId = params.get('context') ?? 'hydra';

interface RuntimeState {
  recording: boolean;
  panicActive: boolean;
  fps: number;
}

interface HydraRuntime {
  readonly element: HTMLElement;
  readonly context: string;
  readonly relayUrl: string;
  readonly state: RuntimeState;
  dispose(): void;
}

const state: RuntimeState = {
  recording: false,
  panicActive: false,
  fps: 0,
};

// Mount <hydra-element>
const el = document.createElement('hydra-element') as HTMLElement & {
  code: string;
  readonly canvas: HTMLCanvasElement | null;
  readonly synth: unknown;
  readonly ready: Promise<{ synth: unknown }>;
  destroy(): void;
  loadScript(url: string): Promise<void>;
  addEventListener(type: 'hydra-ready', listener: (e: Event) => void): void;
  addEventListener(type: 'hydra-eval', listener: (e: CustomEvent) => void): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};
el.setAttribute('audio', 'false');
document.body.appendChild(el);

let client: TransportClient<RigCommand, RigFeedback> | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedBlobs: Blob[] = [];
let fpsInterval: ReturnType<typeof setInterval> | null = null;

function getCanvas(): HTMLCanvasElement | null {
  return el.canvas ?? null;
}

function getSynth(): unknown {
  return el.synth;
}

function sendFeedback(fb: RigFeedback): void {
  client?.sendFeedback(fb);
}

function startRecording(): void {
  const canvas = getCanvas();
  if (!canvas || state.recording) {
    return;
  }
  try {
    const stream = canvas.captureStream(25);
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });
    recordedBlobs = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedBlobs, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hydra-${Date.now()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
    mediaRecorder.start(100);
    state.recording = true;
  } catch (e) {
    sendFeedback({ type: 'error', message: `capture:start failed: ${String(e)}` });
  }
}

function stopRecording(): void {
  if (!state.recording || !mediaRecorder) {
    return;
  }
  mediaRecorder.stop();
  mediaRecorder = null;
  state.recording = false;
}

async function handleCommand(cmd: RigCommand): Promise<void> {
  const id = cmd.id;
  switch (cmd.type) {
    case 'eval:code': {
      try {
        // Listen for the next hydra-eval event to correlate success/error
        const evalPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
          const handler = (e: Event) => {
            el.removeEventListener('hydra-eval', handler);
            const detail = (e as CustomEvent).detail as { success: boolean; error?: string };
            resolve(detail);
          };
          el.addEventListener('hydra-eval', handler);
          // Timeout after 5s if no event fires
          setTimeout(() => {
            el.removeEventListener('hydra-eval', handler);
            resolve({ success: true });
          }, 5000);
        });
        el.code = cmd.code;
        const result = await evalPromise;
        if (result.success) {
          const synth = getSynth() as { bpm?: number } | null;
          sendFeedback({
            id,
            type: 'state',
            playing: true,
            bpm: synth?.bpm ?? 120,
          });
        } else {
          sendFeedback({ id, type: 'error', message: result.error ?? 'eval failed' });
        }
      } catch (e) {
        sendFeedback({ id, type: 'error', message: String(e) });
      }
      break;
    }
    case 'capture:image': {
      const synth = getSynth() as { screencap?: () => void } | null;
      synth?.screencap?.();
      if (id !== undefined) {
        sendFeedback({ id, type: 'capture:state', recording: state.recording });
      }
      break;
    }
    case 'capture:start': {
      startRecording();
      if (id !== undefined) {
        sendFeedback({ id, type: 'capture:state', recording: state.recording });
      }
      break;
    }
    case 'capture:stop': {
      stopRecording();
      if (id !== undefined) {
        sendFeedback({ id, type: 'capture:state', recording: state.recording });
      }
      break;
    }
    case 'panic': {
      state.panicActive = true;
      stopRecording();
      // Clear canvas by evaluating a blank scene
      el.code = 'solid(0, 0, 0).out()';
      if (id !== undefined) {
        sendFeedback({ id, type: 'panic:state', active: true });
      }
      break;
    }
    case 'state:query': {
      const synth = getSynth() as { bpm?: number } | null;
      sendFeedback({
        id,
        type: 'state',
        playing: true,
        bpm: synth?.bpm ?? 120,
      });
      break;
    }
    default: {
      // Unhandled command — ignore
      break;
    }
  }
}

// Connect to relay
client = new TransportClient<RigCommand, RigFeedback>(relayUrl);

client.onReady(() => {
  sendFeedback({ type: 'ready' });
});

client.onPush((msg: RigFeedback) => {
  // The relay forwards commands from editors. They arrive as "feedback"
  // from the TransportClient's perspective (no pending request on this side).
  // Cast to RigCommand and validate.
  if (isRigCommand(msg as unknown)) {
    void handleCommand(msg as unknown as RigCommand);
  }
});

client.onError((err: Error) => {
  sendFeedback({ type: 'error', message: err.message });
});

// Send fps feedback periodically
fpsInterval = setInterval(() => {
  // hydra-element doesn't expose fps directly; use a fixed estimate
  sendFeedback({ type: 'fps', value: 60 });
}, 1000);

// When the element is ready, send ready feedback
el.addEventListener('hydra-ready', () => {
  sendFeedback({ type: 'ready' });
});

// Expose for testing
const runtime: HydraRuntime = {
  element: el,
  context: contextId,
  relayUrl,
  state,
  dispose() {
    stopRecording();
    if (fpsInterval !== null) {
      clearInterval(fpsInterval);
      fpsInterval = null;
    }
    client?.dispose();
    client = null;
    el.destroy();
  },
};

(globalThis as unknown as { hydraRuntime: HydraRuntime }).hydraRuntime = runtime;
