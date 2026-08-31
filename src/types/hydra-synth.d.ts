/// <reference path="./global.d.ts" />

// The Output, HydraSource, GlslSource and Audio types come from the global
// declarations in global.d.ts (single source of truth for the DSL).

/** Shader floating-point precision ('mediump' by default, 'highp' on iOS). */
export type Precision = "lowp" | "mediump" | "highp";

/**
 * Options for the HydraRenderer constructor. All optional; defaults shown.
 */
export interface HydraOpts {
  /** Optional peer-to-peer streaming instance (rtc-patch-bay), used by `initStream`. */
  pb?: any;
  /** Canvas width in pixels (default 1280, only used when no canvas is passed). */
  width?: number;
  /** Canvas height in pixels (default 720, only used when no canvas is passed). */
  height?: number;
  /** Number of sources `s0..` (default 4). */
  numSources?: number;
  /**
   * Number of outputs `o0..` (default 4). Note: the side-by-side view of
   * `render()` with no arguments always uses four outputs (`o0`–`o3`).
   */
  numOutputs?: number;
  /** Expose the DSL (osc, o0, s0, ...) on `window` (default true). */
  makeGlobal?: boolean;
  /** Start the render loop automatically (default true). */
  autoLoop?: boolean;
  /** Create the `a` audio analyzer + mic prompt (default true). */
  detectAudio?: boolean;
  /** Enable `captureStream` on the canvas (default true). */
  enableStreamCapture?: boolean;
  /** Render into an existing canvas instead of creating one. */
  canvas?: HTMLCanvasElement;
  /** Floating-point precision for all shaders. */
  precision?: Precision;
  /** Custom `{ name, type, inputs, glsl }` transforms/generators to register. */
  extendTransforms?: Record<string, any> | any[];
  /** Enable non-error console logging (default false). */
  debug?: boolean;
}

/**
 * The synth context: state + functions available in sketches and via
 * `hydra.synth`. Generators (`osc`, `noise`, ...) are added dynamically by
 * `GeneratorFactory`; outputs (`o0`-`o3`) and sources (`s0`-`s3`) by the
 * renderer, hence they are members here.
 */
export interface Synth {
  /** Elapsed time in seconds (scaled by `speed`). */
  time: number;
  /** Beats per minute — drives the Array rhythm sequences. */
  bpm: number;
  /** Global time multiplier. */
  speed: number;
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** Frame-rate cap (undefined/0 = uncapped). */
  fps: number | undefined;
  /** Measured rendering stats. */
  stats: { fps: number };
  /** Live mouse state (position, buttons, modifier keys). */
  mouse: {
    /** The element the listeners are attached to. */
    element: Window | HTMLElement;
    /** Whether the mouse listeners are attached (settable). */
    enabled: boolean;
    /** Cursor X position in pixels (read-only, updated by the listeners). */
    readonly x: number;
    /** Cursor Y position in pixels (read-only, updated by the listeners). */
    readonly y: number;
    /** Bitmask of currently pressed buttons (read-only). */
    readonly buttons: number;
    /** Currently pressed modifier keys (read-only reference). */
    readonly mods: { shift: boolean; alt: boolean; control: boolean; meta: boolean };
  };
  /** Choose which output is displayed; no args shows all four. */
  render: (output?: Output) => void;
  /** Resize the canvas and all outputs/sources. */
  setResolution: (width: number, height: number) => void;
  /** User-defined per-frame hook, called with dt in ms. Assign a function. */
  update: (dt: number) => void;
  /** User-defined hook run after rendering, called with dt in ms. Assign a function. */
  afterUpdate: (dt: number) => void;
  /**
   * Clear all sources and outputs (render solid black), reset the `update`
   * and `afterUpdate` hooks and render `o0`.
   */
  hush: () => void;
  /**
   * Render one frame (dt in ms); the loop calls this continuously.
   * @param uniforms - extra uniforms (currently unused)
   */
  tick: (dt: number, uniforms?: object) => void;
  /** Save a PNG of the current canvas to disk. */
  screencap: () => void;
  /** Register a custom transform/generator at runtime. */
  setFunction: (obj: any) => void;
  /** Audio analysis (present when detectAudio is true). */
  a?: Audio;
  /** WebM canvas recorder (present when enableStreamCapture is true). */
  vidRecorder?: {
    /** Start recording the canvas stream. */
    start(): void;
    /** Stop recording and download the result as a `.webm` file. */
    stop(): void;
  };
  /** Dynamically-added generators and outputs: osc, o0, s0, ... */
  [key: string]: any;

  // ── Outputs and sources (added dynamically by the renderer) ──
  // The default four; more/fewer depending on numOutputs/numSources.
  /** Render target 0 — the default output shown on the canvas. */
  o0: Output;
  /** Render target 1 (offscreen until rendered). */
  o1: Output;
  /** Render target 2 (offscreen until rendered). */
  o2: Output;
  /** Render target 3 (offscreen until rendered). */
  o3: Output;
  /** External source 0 — initialize with `s0.initCam()`, `s0.initVideo(url)`, ... */
  s0: HydraSource;
  /** External source 1. */
  s1: HydraSource;
  /** External source 2. */
  s2: HydraSource;
  /** External source 3. */
  s3: HydraSource;

  // ── Source generators (added dynamically by GeneratorFactory) ──
  /**
   * Oscillator: three phase-shifted sine waves (r, g, b).
   * `hydra.synth.osc(60, 0.1, 0.8).kaleid(3).out()`.
   * @param frequency - wave frequency, higher = more stripes (default 60)
   * @param sync - how fast the pattern scrolls over time (default 0.1)
   * @param offset - phase offset between channels (default 0)
   */
  osc(frequency?: Param, sync?: Param, offset?: Param): GlslSource;
  /**
   * Perlin noise.
   * @param scale - noise density, higher = finer detail (default 10)
   * @param offset - scrolls the noise over time (default 0.1)
   */
  noise(scale?: Param, offset?: Param): GlslSource;
  /**
   * Voronoi cells.
   * @param scale - cell size (default 5)
   * @param speed - animation speed (default 0.3)
   * @param blending - softness of cell borders (default 0.3)
   */
  voronoi(scale?: Param, speed?: Param, blending?: Param): GlslSource;
  /**
   * Geometric polygon.
   * @param sides - number of sides (default 3)
   * @param radius - size in [0, 1] (default 0.3)
   * @param smoothing - edge softness (default 0.01)
   */
  shape(sides?: Param, radius?: Param, smoothing?: Param): GlslSource;
  /**
   * Flat color.
   * @param r - red channel in [0, 1] (default 0)
   * @param g - green channel in [0, 1] (default 0)
   * @param b - blue channel in [0, 1] (default 0)
   * @param a - alpha in [0, 1] (default 1)
   */
  solid(r?: Param, g?: Param, b?: Param, a?: Param): GlslSource;
  /**
   * Horizontal color gradient.
   * @param speed - shifts the gradient over time (default 0)
   */
  gradient(speed?: Param): GlslSource;
  /**
   * Sample a texture source: a HydraSource (s0), an output (o0) or another
   * chain.
   * @param source - the texture input to sample
   */
  src(source: HydraSource | Output | GlslSource): GlslSource;
  /**
   * Feedback: render the previous frame (from the prevBuffer uniform).
   */
  prev(): GlslSource;
}

/**
 * The hydra-synth entry point. Creates the regl context, outputs, sources,
 * audio analyzer and synth context.
 *
 * ```js
 * // library mode: use hydra.synth.*
 * const hydra = new Hydra({ width: 1280, height: 720 })
 * hydra.synth.osc(20).out()
 * ```
 */
export default class HydraRenderer {
  /**
   * Create a hydra instance. If `makeGlobal` is true (default), the DSL
   * becomes available on `window` so sketches can call `osc().out()` directly;
   * otherwise use `hydra.synth.*`.
   * @param opts - constructor options (all optional)
   */
  constructor(opts?: HydraOpts);

  /** The rendering canvas (created or passed via opts.canvas). */
  canvas: HTMLCanvasElement;
  /** The regl instance. */
  regl: any;
  /** Optional peer-to-peer streaming instance (from opts.pb), used by `initStream`. */
  pb: any;

  /** Custom transforms passed at construction time. */
  extendTransforms: Record<string, any> | any[];
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** Current shader precision ('lowp' | 'mediump' | 'highp'). */
  precision: Precision;
  /** Whether the audio analyzer was created. */
  detectAudio: boolean;
  /** The regl command that draws all four outputs side-by-side. */
  renderAll: (props?: Record<string, any>) => void;
  /** The regl command that draws the current output to the canvas. */
  renderFbo: (props?: Record<string, any>) => void;
  /**
   * Whether all outputs are rendered side-by-side. Undefined until
   * `render()` is first called.
   */
  isRenderingAll: boolean | undefined;
  /** The canvas captureStream when enabled (null otherwise). */
  captureStream: MediaStream | null;
  /** The sources `s0..` (indexed). */
  s: HydraSource[];
  /** The outputs `o0..` (indexed). */
  o: Output[];
  /** The output currently being drawn (defaults to `o0`). */
  output: Output;
  /** The synth context (state + generators + outputs). */
  synth: Synth;
  /** The evaluation sandbox that exposes the DSL globally/eval. */
  sandbox: EvalSandbox;
  /** The generator factory that turns glsl-functions into the JS API. */
  generator: GeneratorFactory;

  /**
   * Evaluate code inside the synth sandbox.
   * @param code - hydra code, e.g. `'osc().out()'`
   */
  eval(code: string): void;
  /**
   * Capture the current canvas as a PNG blob.
   * @param callback - receives the image blob
   */
  getScreenImage(callback: (blob: Blob) => void): void;
  /**
   * Clear all sources and outputs (render solid black), reset the `update`
   * and `afterUpdate` hooks and render `o0`.
   */
  hush(): void;
  /**
   * Load and execute an external JS file as a script tag.
   * @param url - script URL to load
   */
  loadScript(url?: string): Promise<void>;
  /**
   * Resize the canvas and all outputs/sources.
   * @param width - new width in pixels
   * @param height - new height in pixels
   */
  setResolution(width: number, height: number): void;
  /**
   * Save the current canvas as a PNG (downloads the file). NOTE: the
   * `callback` parameter is currently ignored by the runtime — use
   * `getScreenImage(callback)` to receive the blob instead.
   * @param callback - currently ignored (see getScreenImage)
   */
  canvasToImage(callback?: (blob: Blob) => void): void;
  /**
   * Create a new external source and register it as `s<N>`.
   * @param i - the desired index (also used for the `s<i>` label)
   */
  createSource(i: number): HydraSource;
  /**
   * Render one frame.
   * @param dt - time in ms since the last frame
   * @param uniforms - extra uniforms to pass to the shaders
   */
  tick(dt: number, uniforms?: object): void;
}

// ── Internal shapes ──────────────────────────────────────────────
// These classes live in their own modules inside the package but are NOT
// re-exported by the entry point, so they are declared here only as the
// instance shapes used by HydraRenderer members.

/**
 * Turns the `glsl-functions.js` catalog into the JS API: `src`-type functions
 * become generators (return a GlslSource), the rest become chainable methods
 * on GlslSource's prototype. Custom functions can be added with `setFunction()`.
 */
interface GeneratorFactory {
  /** The output chains render into by default. */
  defaultOutput?: Output;
  /** Uniforms shared by every generated shader. */
  defaultUniforms?: Record<string, any>;
  /** Called when a generator/transform is added to the synth. */
  changeListener: (event: { type: string; method: string; synth: GeneratorFactory }) => void;
  /** Extra custom transforms registered on init. */
  extendTransforms: any[] | Record<string, any>;
  /** Generated JS functions keyed by method name (osc, noise, etc.). */
  generators: Record<string, (...args: any[]) => GlslSource>;
  /** Compiled GLSL transforms keyed by name. */
  glslTransforms: Record<string, any>;
  /** The GlslSource subclass whose prototype receives the transform methods. */
  sourceClass: new (obj: any) => GlslSource;

  /** (Re)build all generators from the glsl-functions catalog. */
  init(): void;
  /**
   * Register a single custom transform/generator, e.g.
   * `{ name: 'myFx', type: 'color', inputs: [{ name: 'amount', type: 'float', default: 1 }], glsl: 'return _c0 * amount;' }`.
   * @param obj - the transform/generator definition (see glsl-functions.js)
   */
  setFunction(obj: {
    name: string;
    type: string;
    inputs: Array<{ name: string; type: string; default: any }>;
    glsl: string;
  }): void;
}

/**
 * Evaluation sandbox: keeps synth state/functions available to evaluated
 * code and (when makeGlobal) on `window`.
 */
interface EvalSandbox {
  /** Whether props are mirrored on `window`. */
  makeGlobal: boolean;
  /** The underlying evaluation sandbox. */
  sandbox: {
    /** Prepend a `name = object` declaration to the evaluated scope. */
    addToContext(name: string, object: string): void;
    /** Evaluate code inside the sandbox. */
    eval(code: string): void;
  };
  /** The synth context object. */
  parent: Record<string, any>;
  /** User-writable props copied back each frame. */
  userProps: string[];

  /** Expose a synth property on `window` when makeGlobal is true. */
  add(name: string): void;
  /** Set a synth property (and on `window` when makeGlobal). */
  set(property: string, value: any): void;
  /** Copy user-writable window props back into the synth each frame. */
  tick(): void;
  /** Evaluate code inside the sandbox. */
  eval(code: string): void;
}
