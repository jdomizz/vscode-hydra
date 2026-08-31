// Global type declarations for hydra live-coding sketches.
//
// Two ways to consume it:
//   - npm: /// <reference types="hydra-synth/global" />
//   - CDN: download this file next to your sketch and use
//       /// <reference path="./global.d.ts" />
//
// Self-contained on purpose (no imports, no triple-slash references): it must
// work in a folder without node_modules. This file is the SINGLE source of
// truth for the DSL types (Output, GlslSource, HydraSource, Audio, Array
// extensions and globals); the class .d.ts files reference it instead of
// redefining these types.
//
// Conventions: every scalar argument accepts a number, a per-frame function
// (osc(() => a.fft[0])) or a rhythmic array ([0, 1].fast(2)). Values are
// usually normalized to ~[0, 1].

declare global {
  /**
   * A dynamic shader argument. Accepted forms: a number; a per-frame function
   * `() => number` (e.g. `() => a.fft[0]`); or a rhythmic array `number[]`
   * (e.g. `[0, 1].fast(2)`). Values are usually normalized to ~[0, 1].
   */
  type Param = number | (() => number) | number[];

  /** A texture input: any source hydra can sample in a shader. */
  type SourceInput = GlslSource | HydraSource | Output;

  /**
   * Named easing functions available in `Array.prototype.ease()`
   * (see src/lib/easing-functions.js).
   */
  type EaseName =
    | "linear"
    | "easeInQuad"
    | "easeOutQuad"
    | "easeInOutQuad"
    | "easeInCubic"
    | "easeOutCubic"
    | "easeInOutCubic"
    | "easeInQuart"
    | "easeOutQuart"
    | "easeInOutQuart"
    | "easeInQuint"
    | "easeOutQuint"
    | "easeInOutQuint"
    | "sin";

  // ── Output (the o0-o3 render targets) ─────────────────────────
  /** A render target. The globals `o0`-`o3` hold the four default instances. */
  interface Output {
    /** The regl instance. */
    regl: any;
    /** Shader precision for this output ('lowp' | 'mediump' | 'highp'). */
    precision: "lowp" | "mediump" | "highp";
    /** Name of this output, e.g. `'o0'`. */
    label: string;
    /** Index of this output, assigned by the renderer. */
    id: number;
    /** Fullscreen triangle position buffer. */
    positionBuffer: any;
    /** The current regl draw command. */
    draw: (props?: any) => void;
    /** Active ping-pong framebuffer index (0 or 1). */
    pingPongIndex: number;
    /** The two ping-pong framebuffers. */
    fbos: any[];
    /** Default uniforms (time, resolution) merged into every pass. */
    uniforms: Record<string, any>;

    /** Resize both framebuffers. */
    resize(width: number, height: number): void;
    /** The framebuffer currently being drawn to. */
    getCurrent(): any;
    /** The other (available) framebuffer, used as texture input. */
    getTexture(): any;
    /** Reset the accumulated fragment shader. */
    init(): Output;
    /** Compile the given render passes into a draw command. */
    render(passes: Array<{ frag: string; uniforms: Record<string, any> }>): void;
    /** Draw one frame with the given props. */
    tick(props: Record<string, any>): void;
  }

  // ── GlslSource (the chainable visual pipeline) ────────────────
  /**
   * A chainable source of visuals. Generators (osc, noise, shape, ...) create
   * one; transforms (`.brightness()`, `.modulate()`, ...) return the same
   * instance and compose infinitely. The chain renders when it hits an
   * output: `osc(20, 0.1, 0.8).kaleid(3).saturate(2).out(o0)`.
   */
  interface GlslSource {
    /** The ordered transforms composing this chain. */
    transforms: Array<{ name: string; transform: any; userArgs: any[]; synth: any }>;
    /** The output `.out()` uses when none is passed. */
    defaultOutput: Output;
    /** The generator factory context. */
    synth: any;
    /** Always `'GlslSource'`. */
    type: string;
    /** Uniforms shared by all passes. */
    defaultUniforms: Record<string, any>;

    /** Append a transform to the chain. */
    addTransform(obj: { name: string; transform: any; userArgs: any[]; synth: any }): void;

    /**
     * Render the chain to an output. Defaults to `o0` if omitted.
     * @param output - the Output to draw into (o0-o3)
     */
    out(output?: Output): void;
    /** Compile the chain into a list of fragment-shader passes. */
    glsl(): Array<{ frag: string; uniforms: Record<string, any> }>;
    /** Compile a list of transforms into a single pass. */
    compile(transforms: any[]): { frag: string; uniforms: Record<string, any> };

    // ── Color modifiers ────────────────────────────────────────
    /**
     * Add `amount` to every channel. Positive brightens, negative darkens.
     * @param amount - amount added to each channel (default 0.4)
     */
    brightness(amount?: Param): GlslSource;
    /**
     * Stretch contrast around the midpoint.
     * @param amount - 1 = unchanged, >1 more contrast, <1 less (default 1.6)
     */
    contrast(amount?: Param): GlslSource;
    /**
     * Tint with r/g/b/a. Negative components invert that channel.
     * @param r - red tint, 1 = unchanged (default 1)
     * @param g - green tint, 1 = unchanged (default 1)
     * @param b - blue tint, 1 = unchanged (default 1)
     * @param a - alpha (default 1)
     */
    color(r?: Param, g?: Param, b?: Param, a?: Param): GlslSource;
    /**
     * Rotate hues through a rainbow cycle.
     * @param amount - rotation amount per frame (default 0.005)
     */
    colorama(amount?: Param): GlslSource;
    /**
     * Shift the hue of the source.
     * @param hue - hue rotation, added to the HSV hue component (default 0.4)
     */
    hue(hue?: Param): GlslSource;
    /**
     * Invert the colors.
     * @param amount - 0 = unchanged, 1 = full inversion (default 1)
     */
    invert(amount?: Param): GlslSource;
    /**
     * Keep only pixels brighter than `threshold`.
     * @param threshold - luminance cutoff in [0, 1] (default 0.5)
     * @param tolerance - softness around the cutoff (default 0.1)
     */
    luma(threshold?: Param, tolerance?: Param): GlslSource;
    /**
     * Quantize colors into `bins` levels per channel (poster look).
     * @param bins - number of levels per channel (default 3)
     * @param gamma - gamma correction (default 0.6)
     */
    posterize(bins?: Param, gamma?: Param): GlslSource;
    /**
     * Adjust saturation.
     * @param amount - 0 = grayscale, 1 = unchanged, >1 more saturated (default 2)
     */
    saturate(amount?: Param): GlslSource;
    /**
     * Shift each channel by its fractional part.
     * @param r - red shift (default 0.5)
     * @param g - green shift (default 0)
     * @param b - blue shift (default 0)
     * @param a - alpha shift (default 0)
     */
    shift(r?: Param, g?: Param, b?: Param, a?: Param): GlslSource;
    /**
     * Sum the scaled channels into a single-channel scalar.
     * @param scale - per-channel multiplier as a texture source (default
     * [1,1,1,1]). Note: array/number scales are rejected by the current
     * runtime (vec4 argument guard) — pass a texture or omit the argument.
     */
    sum(scale?: SourceInput): GlslSource;
    /**
     * Keep only luminance above `threshold`; alpha = luminance.
     * @param threshold - luminance cutoff in [0, 1] (default 0.5)
     * @param tolerance - softness around the cutoff (default 0.04)
     */
    thresh(threshold?: Param, tolerance?: Param): GlslSource;
    /**
     * Keep only the red channel.
     * @param scale - multiplier (default 1)
     * @param offset - value added (default 0)
     */
    r(scale?: Param, offset?: Param): GlslSource;
    /**
     * Keep only the green channel.
     * @param scale - multiplier (default 1)
     * @param offset - value added (default 0)
     */
    g(scale?: Param, offset?: Param): GlslSource;
    /**
     * Keep only the blue channel.
     * @param scale - multiplier (default 1)
     * @param offset - value added (default 0)
     */
    b(scale?: Param, offset?: Param): GlslSource;
    /**
     * Keep only the alpha channel.
     * @param scale - multiplier (default 1)
     * @param offset - value added (default 0)
     */
    a(scale?: Param, offset?: Param): GlslSource;

    // ── Geometry modifiers ─────────────────────────────────────
    /**
     * Mirror the image into `nSides` kaleidoscope segments.
     * @param nSides - number of mirror segments (default 4)
     */
    kaleid(nSides?: Param): GlslSource;
    /**
     * Blocky pixelation; each block is 1/pixelX × 1/pixelY of the screen.
     * @param pixelX - blocks across (default 20)
     * @param pixelY - blocks down (default 20)
     */
    pixelate(pixelX?: Param, pixelY?: Param): GlslSource;
    /**
     * Tile the image repeatX × repeatY with checkerboard offsets.
     * @param repeatX - tiles horizontally (default 3)
     * @param repeatY - tiles vertically (default 3)
     * @param offsetX - offset of alternating rows (default 0)
     * @param offsetY - offset of alternating columns (default 0)
     */
    repeat(repeatX?: Param, repeatY?: Param, offsetX?: Param, offsetY?: Param): GlslSource;
    /**
     * Tile `reps` times horizontally, alternating rows by `offset`.
     * @param reps - number of horizontal tiles (default 3)
     * @param offset - offset of alternating rows (default 0)
     */
    repeatX(reps?: Param, offset?: Param): GlslSource;
    /**
     * Tile `reps` times vertically, alternating columns by `offset`.
     * @param reps - number of vertical tiles (default 3)
     * @param offset - offset of alternating columns (default 0)
     */
    repeatY(reps?: Param, offset?: Param): GlslSource;
    /**
     * Rotate the image.
     * @param angle - rotation in radians (default 10)
     * @param speed - rotation speed in rad/s over time (default 0)
     */
    rotate(angle?: Param, speed?: Param): GlslSource;
    /**
     * Zoom the image.
     * @param amount - 1 = unchanged, >1 zooms in, <1 zooms out (default 1.5)
     * @param xMult - horizontal multiplier (default 1)
     * @param yMult - vertical multiplier (default 1)
     * @param offsetX - zoom pivot x, 0.5 = center (default 0.5)
     * @param offsetY - zoom pivot y, 0.5 = center (default 0.5)
     */
    scale(
      amount?: Param,
      xMult?: Param,
      yMult?: Param,
      offsetX?: Param,
      offsetY?: Param,
    ): GlslSource;
    /**
     * Scroll the image.
     * @param scrollX - horizontal offset (default 0.5)
     * @param scrollY - vertical offset (default 0.5)
     * @param speedX - horizontal drift per second (default 0)
     * @param speedY - vertical drift per second (default 0)
     */
    scroll(scrollX?: Param, scrollY?: Param, speedX?: Param, speedY?: Param): GlslSource;
    /**
     * Scroll horizontally.
     * @param scrollX - horizontal offset (default 0.5)
     * @param speed - drift per second (default 0)
     */
    scrollX(scrollX?: Param, speed?: Param): GlslSource;
    /**
     * Scroll vertically.
     * @param scrollY - vertical offset (default 0.5)
     * @param speed - drift per second (default 0)
     */
    scrollY(scrollY?: Param, speed?: Param): GlslSource;

    // ── Blend modifiers ────────────────────────────────────────
    /**
     * Add `texture` to this source.
     * @param texture - source to add
     * @param amount - crossfade: 0 = source only, 1 = pure sum (default 1)
     */
    add(texture: SourceInput, amount?: Param): GlslSource;
    /**
     * Crossfade between this source and `texture`.
     * @param texture - source to blend with
     * @param amount - 0 = this source, 1 = texture (default 0.5)
     */
    blend(texture: SourceInput, amount?: Param): GlslSource;
    /**
     * Absolute difference between this source and `texture` (edge/motion detection).
     * @param texture - source to compare with
     */
    diff(texture: SourceInput): GlslSource;
    /**
     * Composite `texture` on top using its alpha channel.
     * @param texture - source to layer on top
     */
    layer(texture: SourceInput): GlslSource;
    /**
     * Use the luminance of `texture` as an alpha mask over this source.
     * @param texture - source providing the mask
     */
    mask(texture: SourceInput): GlslSource;
    /**
     * Multiply this source by `texture`.
     * @param texture - source to multiply with
     * @param amount - crossfade: 0 = source only, 1 = pure product (default 1)
     */
    mult(texture: SourceInput, amount?: Param): GlslSource;
    /**
     * Subtract `texture` from this source.
     * @param texture - source to subtract
     * @param amount - crossfade: 0 = source only, 1 = pure difference (default 1)
     */
    sub(texture: SourceInput, amount?: Param): GlslSource;

    // ── Modulate modifiers ─────────────────────────────────────
    /**
     * Displace/warp the image using `texture`'s channels as offsets.
     * @param texture - source driving the warp
     * @param amount - displacement strength (default 0.1)
     */
    modulate(texture: SourceInput, amount?: Param): GlslSource;
    /**
     * Warp the hue of this source according to `texture`'s channels.
     * @param texture - source driving the warp
     * @param amount - warp strength (default 1)
     */
    modulateHue(texture: SourceInput, amount?: Param): GlslSource;
    /**
     * Mirror into `nSides` segments, warped by `texture`.
     * @param texture - source driving the warp
     * @param nSides - number of mirror segments (default 4)
     */
    modulateKaleid(texture: SourceInput, nSides?: Param): GlslSource;
    /**
     * Pixelate, with block size driven by `texture`'s channels.
     * @param texture - source driving the pixelation
     * @param multiple - block-size multiplier (default 10)
     * @param offset - base block size (default 3)
     */
    modulatePixelate(texture: SourceInput, multiple?: Param, offset?: Param): GlslSource;
    /**
     * Tile repeatX × repeatY, tile offsets driven by `texture`.
     * @param texture - source driving the offsets
     * @param repeatX - tiles horizontally (default 3)
     * @param repeatY - tiles vertically (default 3)
     * @param offsetX - offset strength horizontally (default 0.5)
     * @param offsetY - offset strength vertically (default 0.5)
     */
    modulateRepeat(
      texture: SourceInput,
      repeatX?: Param,
      repeatY?: Param,
      offsetX?: Param,
      offsetY?: Param,
    ): GlslSource;
    /**
     * Tile `reps` times horizontally, offset driven by `texture`.
     * @param texture - source driving the offset
     * @param reps - number of horizontal tiles (default 3)
     * @param offset - offset strength (default 0.5)
     */
    modulateRepeatX(texture: SourceInput, reps?: Param, offset?: Param): GlslSource;
    /**
     * Tile `reps` times vertically, offset driven by `texture`.
     * @param texture - source driving the offset
     * @param reps - number of vertical tiles (default 3)
     * @param offset - offset strength (default 0.5)
     */
    modulateRepeatY(texture: SourceInput, reps?: Param, offset?: Param): GlslSource;
    /**
     * Rotate the source, angle driven by `texture`'s red channel.
     * @param texture - source driving the rotation
     * @param multiple - rotation multiplier (default 1)
     * @param offset - base rotation (default 0)
     */
    modulateRotate(texture: SourceInput, multiple?: Param, offset?: Param): GlslSource;
    /**
     * Zoom the source, scale driven by `texture`'s channels.
     * @param texture - source driving the zoom
     * @param multiple - zoom multiplier (default 1)
     * @param offset - base zoom (default 1)
     */
    modulateScale(texture: SourceInput, multiple?: Param, offset?: Param): GlslSource;
    /**
     * Scroll horizontally, driven by `texture`'s red channel.
     * @param texture - source driving the scroll
     * @param scrollX - scroll strength (default 0.5)
     * @param speed - drift per second (default 0)
     */
    modulateScrollX(texture: SourceInput, scrollX?: Param, speed?: Param): GlslSource;
    /**
     * Scroll vertically, driven by `texture`'s red channel.
     * @param texture - source driving the scroll
     * @param scrollY - scroll strength (default 0.5)
     * @param speed - drift per second (default 0)
     */
    modulateScrollY(texture: SourceInput, scrollY?: Param, speed?: Param): GlslSource;
  }

  // ── HydraSource (cameras, videos, images, streams) ────────────
  /**
   * An external media source. The globals `s0`-`s3` are the default four;
   * initialize then sample them: `s0.initCam()` / `s0.initVideo(url)`, then
   * `src(s0)` or `osc().modulate(s0)`.
   */
  interface HydraSource {
    /** Name of this source, e.g. `'s0'`. */
    label: string;
    /** The regl instance. */
    regl: any;
    /** The media element (null until initialized). */
    src: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
    /** True when the texture re-uploads every frame (video/camera). */
    dynamic: boolean;
    /** Source width in pixels. */
    width: number;
    /** Source height in pixels. */
    height: number;
    /** The regl texture holding the media. */
    tex: any;
    /** Optional peer-to-peer streaming instance (rtc-patch-bay). */
    pb: any;
    /** Cache of 2D contexts created by `initCanvas`, keyed by label. */
    canvases: Record<string, CanvasRenderingContext2D>;

    /**
     * Initialize from a raw media element or dynamic flag.
     * @param opts - the media element and/or whether it is dynamic
     * @param params - extra regl texture options (width, height, ...)
     */
    init(
      opts: { src?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement; dynamic?: boolean },
      params?: Record<string, any>,
    ): void;
    /**
     * Initialize from the webcam.
     * @param index - camera index (default 0). Requires a user gesture.
     * @param params - extra regl texture options
     */
    initCam(index?: number, params?: Record<string, any>): void;
    /**
     * Initialize from a looping, muted video URL.
     * @param url - video source URL (CORS-enabled for cross-domain)
     * @param params - extra regl texture options
     */
    initVideo(url?: string, params?: Record<string, any>): void;
    /**
     * Initialize from an image URL.
     * @param url - image source URL (CORS-enabled for cross-domain)
     * @param params - extra regl texture options
     */
    initImage(url?: string, params?: Record<string, any>): void;
    /**
     * Initialize from a peer-to-peer stream (rtc-patch-bay) by name.
     * @param streamName - name of the stream
     * @param params - extra regl texture options
     */
    initStream(streamName: string, params?: Record<string, any>): void;
    /**
     * Initialize from a screen-capture stream. Requires a user gesture.
     * @param index - reserved for desktop integrations (atom-hydra);
     * currently ignored in the browser
     * @param params - extra regl texture options
     */
    initScreen(index?: number, params?: Record<string, any>): void;
    /**
     * Create (or reuse) an offscreen canvas and return its 2D context to draw on.
     * @param width - canvas width (default 1000)
     * @param height - canvas height (default 1000)
     */
    initCanvas(width?: number, height?: number): CanvasRenderingContext2D;
    /** Update the source dimensions. */
    resize(width: number, height: number): void;
    /** Stop active media tracks and reset the texture. */
    clear(): void;
    /** Re-upload media to the texture when dynamic. */
    tick(time: number): void;
    /** The texture to sample in shaders. */
    getTexture(): any;
  }

  // ── Audio (exposed globally as a) ─────────────────────────────
  /**
   * Live microphone analysis (created when `detectAudio: true`, the default).
   * `bins` are raw per-band loudness; `fft` are scaled to ~[0, 1] — use those
   * to drive visuals: `osc(() => a.fft[0]).out()`. `a.onBeat` fires on beats.
   */
  interface Audio {
    /** Current overall loudness (raw). */
    vol: number;
    /** FFT scaling applied to each band. */
    scale: number;
    /** @deprecated */
    max: number;
    /** Floor below which a band's fft value is 0. */
    cutoff: number;
    /** Smoothing of the `bins` values between frames. */
    smooth: number;
    /** Raw loudness per band. */
    bins: number[];
    /** Previous-frame `bins` (used for smoothing). */
    prevBins: number[];
    /**
     * Scaled loudness per band in [0, ~1] — drives visuals:
     * `osc(() => a.fft[0]).out()`.
     */
    fft: number[];
    /** Per-band { cutoff, scale, smooth } settings. */
    settings: Array<{ cutoff: number; scale: number; smooth: number }>;
    /** The visualization canvas (bottom-right corner). */
    canvas: HTMLCanvasElement;
    /** Whether the waveform visualization is drawn. */
    isDrawing: boolean;
    /** 2D context of the visualization canvas (used by `draw`). */
    ctx: CanvasRenderingContext2D;
    /** Callback invoked when a beat is detected. */
    onBeat: () => void;
    /** Beat-detection state. */
    beat: {
      /** Frames a beat keeps the cutoff elevated. */
      holdFrames: number;
      /** Minimum level to count as a beat. */
      threshold: number;
      /** Adaptive cutoff. */
      _cutoff: number;
      /** How fast the adaptive cutoff decays. */
      decay: number;
      /** Frames since the last beat. */
      _framesSinceBeat: number;
    };
    /** Meyda analyzer instance (set asynchronously after getUserMedia). */
    meyda?: any;
    /** MediaStream from getUserMedia (set asynchronously). */
    stream?: MediaStream;
    /** AudioContext instance (set asynchronously). */
    context?: AudioContext;

    /** Update beat-detection from a loudness level. */
    detectBeat(level: number): void;
    /** Read audio features and update bins/fft (called each frame). */
    tick(): void;
    /** Set the cutoff floor for all bands. */
    setCutoff(cutoff: number): void;
    /** Set the smoothing for all bands. */
    setSmooth(smooth: number): void;
    /** Resize the number of analysis bands. */
    setBins(numBins: number): void;
    /** Set the fft scaling for all bands. */
    setScale(scale: number): void;
    /** @deprecated */
    setMax(max: number): void;
    /** Hide the visualization canvas. */
    hide(): void;
    /** Show the visualization canvas. */
    show(): void;
    /** Draw the current waveform. */
    draw(): void;
  }

  // ── Array extensions (hydra's rhythmic sequencing) ────────────
  /**
   * Any array can be passed where a number is expected; it becomes a rhythmic
   * sequence driven by time and BPM: `shape(3, [0.1, 0.5, 0.9].fast(4)).out()`.
   */
  interface Array<T> {
    /**
     * Set playback speed multiplier for rhythmic sequencing.
     * `[0, 1, 2].fast(2)` cycles through the values twice as fast.
     * @param speed - speed multiplier (default 1)
     */
    fast(speed?: number): this;
    /**
     * Set interpolation between consecutive values. Without `smooth()`, the
     * sequence jumps directly between steps; `smooth()` (default 1)
     * interpolates fully from each value to the next, while values < 1
     * reach the next value early and hold it. `[0, 1].smooth(0.5)` blends
     * during the first half of each step and holds during the second half.
     * @param smooth - interpolation factor in [0, 1] (default 1)
     */
    smooth(smooth?: number): this;
    /**
     * Set an easing function for interpolation. Accepts a named easing
     * (`'linear'`, `'easeInQuad'`, `'easeOutQuad'`, `'sin'`, ...) or a custom
     * `(t: number) => number` function. Sets smooth to 1 internally.
     * @param ease - easing name or function (default `'linear'`)
     */
    ease(ease?: EaseName | ((t: number) => number)): this;
    /**
     * Shift the phase offset of the sequence.
     * `[0, 1].offset(0.5)` starts playback halfway into the cycle.
     * @param offset - phase offset in [0, 1) (default 0.5)
     */
    offset(offset?: number): this;
    /**
     * Map array values to [low, high], preserving speed/smooth/ease
     * modifiers. Returns a new array — the original is unchanged.
     * @param low - lower bound (default 0)
     * @param high - upper bound (default 1)
     */
    fit(low?: number, high?: number): number[];
  }

  // ── Source generators ─────────────────────────────────────────
  /**
   * Oscillator: three phase-shifted sine waves (r, g, b). The classic hydra
   * starting point: `osc(60, 0.1, 0.8).kaleid(3).out()`.
   * @param frequency - wave frequency, higher = more stripes (default 60)
   * @param sync - how fast the pattern scrolls over time (default 0.1)
   * @param offset - phase offset between channels (default 0)
   */
  function osc(frequency?: Param, sync?: Param, offset?: Param): GlslSource;
  /**
   * Perlin noise.
   * @param scale - noise density, higher = finer detail (default 10)
   * @param offset - scrolls the noise over time (default 0.1)
   */
  function noise(scale?: Param, offset?: Param): GlslSource;
  /**
   * Voronoi cells.
   * @param scale - cell size (default 5)
   * @param speed - animation speed (default 0.3)
   * @param blending - softness of cell borders (default 0.3)
   */
  function voronoi(scale?: Param, speed?: Param, blending?: Param): GlslSource;
  /**
   * Geometric polygon.
   * @param sides - number of sides (default 3)
   * @param radius - size in [0, 1] (default 0.3)
   * @param smoothing - edge softness (default 0.01)
   */
  function shape(sides?: Param, radius?: Param, smoothing?: Param): GlslSource;
  /**
   * Flat color.
   * @param r - red channel in [0, 1] (default 0)
   * @param g - green channel in [0, 1] (default 0)
   * @param b - blue channel in [0, 1] (default 0)
   * @param a - alpha in [0, 1] (default 1)
   */
  function solid(r?: Param, g?: Param, b?: Param, a?: Param): GlslSource;
  /**
   * Horizontal color gradient.
   * @param speed - shifts the gradient over time (default 0)
   */
  function gradient(speed?: Param): GlslSource;
  /**
   * Sample a texture source: a HydraSource (s0), an output (o0) or another
   * chain. `src(s0)` starts a pipeline with that source.
   * @param source - the texture input to sample
   */
  function src(source: SourceInput): GlslSource;
  /**
   * Feedback: render the previous frame (from the prevBuffer uniform).
   * Chain into a source for feedback effects: `src(o0).kaleid(3).out(o0)`.
   */
  function prev(): GlslSource;

  // ── Outputs ───────────────────────────────────────────────────
  /** Render target 0 — the default output shown on the canvas. */
  var o0: Output;
  /** Render target 1 (offscreen until rendered). */
  var o1: Output;
  /** Render target 2 (offscreen until rendered). */
  var o2: Output;
  /** Render target 3 (offscreen until rendered). */
  var o3: Output;

  // ── Sources ───────────────────────────────────────────────────
  /** External source 0 — initialize with `s0.initCam()`, `s0.initVideo(url)`, ... */
  var s0: HydraSource;
  /** External source 1. */
  var s1: HydraSource;
  /** External source 2. */
  var s2: HydraSource;
  /** External source 3. */
  var s3: HydraSource;

  // ── Audio ─────────────────────────────────────────────────────
  /**
   * Live audio analysis (microphone). See the Audio interface. Only created
   * when `detectAudio: true` (the default) — with `detectAudio: false` the
   * global does not exist and referencing it throws at runtime.
   */
  var a: Audio;
  /**
   * Per-band helper for `a.fft[0]`: `a0(2, 0.5)` returns a
   * `() => number` that yields `a.fft[0] * 2 + 0.5` per frame — passable
   * anywhere a Param is accepted, e.g. `osc(a0(2, 0.5)).out()`.
   * @param scale - multiplier (default 1)
   * @param offset - value added (default 0)
   */
  var a0: (scale?: number, offset?: number) => () => number;
  /**
   * Per-band helper for `a.fft[1]`: `a1(2, 0.5)` returns a
   * `() => number` that yields `a.fft[1] * 2 + 0.5` per frame — passable
   * anywhere a Param is accepted, e.g. `osc(a1(2, 0.5)).out()`.
   * @param scale - multiplier (default 1)
   * @param offset - value added (default 0)
   */
  var a1: (scale?: number, offset?: number) => () => number;
  /**
   * Per-band helper for `a.fft[2]`: `a2(2, 0.5)` returns a
   * `() => number` that yields `a.fft[2] * 2 + 0.5` per frame — passable
   * anywhere a Param is accepted, e.g. `osc(a2(2, 0.5)).out()`.
   * @param scale - multiplier (default 1)
   * @param offset - value added (default 0)
   */
  var a2: (scale?: number, offset?: number) => () => number;
  /**
   * Per-band helper for `a.fft[3]`: `a3(2, 0.5)` returns a
   * `() => number` that yields `a.fft[3] * 2 + 0.5` per frame — passable
   * anywhere a Param is accepted, e.g. `osc(a3(2, 0.5)).out()`.
   * @param scale - multiplier (default 1)
   * @param offset - value added (default 0)
   */
  var a3: (scale?: number, offset?: number) => () => number;

  // ── Synth state ───────────────────────────────────────────────
  /**
   * Global time multiplier. `speed = 2` runs hydra twice as fast; `0.5`
   * half speed.
   */
  var speed: number;
  /** Beats per minute — drives the Array rhythm sequences. */
  var bpm: number;
  /** Elapsed time in seconds (scaled by speed). */
  var time: number;
  /** Frame-rate cap (0/undefined = uncapped). */
  var fps: number | undefined;
  /** Canvas width in pixels. */
  var width: number;
  /** Canvas height in pixels. */
  var height: number;
  /** Measured rendering stats. */
  var stats: {
    /** Frames rendered per second. */
    fps: number;
  };
  /**
   * Render one frame (dt in ms); the internal loop calls this continuously.
   * Useful with `autoLoop: false`.
   * @param dt - time in ms since the last frame
   * @param uniforms - extra uniforms (currently unused)
   */
  var tick: (dt: number, uniforms?: object) => void;
  /**
   * Live mouse state. `mouse.x` / `mouse.y` give the cursor position;
   * `mouse.mods.shift` etc. detect modifier keys.
   */
  var mouse: {
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
    readonly mods: {
      /** Whether the shift key is pressed. */
      shift: boolean;
      /** Whether the alt key is pressed. */
      alt: boolean;
      /** Whether the control key is pressed. */
      control: boolean;
      /** Whether the meta key is pressed. */
      meta: boolean;
    };
  };

  /**
   * Choose which output is displayed on the canvas. With no args, all four
   * outputs render side-by-side.
   * @param output - the output to display
   */
  var render: (output?: Output) => void;
  /**
   * Resize the canvas and all outputs/sources.
   * @param width - new width in pixels
   * @param height - new height in pixels
   */
  var setResolution: (width: number, height: number) => void;
  /**
   * Clear all sources and outputs (render solid black), reset the `update`
   * and `afterUpdate` hooks and render `o0`.
   */
  var hush: () => void;
  /**
   * User-defined per-frame hook. Runs before rendering each frame.
   * @param dt - time in ms since the last frame
   */
  var update: (dt: number) => void;
  /**
   * User-defined hook run after rendering each frame.
   * @param dt - time in ms since the last frame
   */
  var afterUpdate: (dt: number) => void;
  /** Save a PNG of the current canvas to disk. */
  var screencap: () => void;
  /**
   * WebM canvas recorder (created when `enableStreamCapture` is true).
   * `start()` begins recording, `stop()` downloads the `.webm`.
   */
  var vidRecorder:
    | {
        /** Start recording the canvas stream. */
        start(): void;
        /** Stop recording and download the result as a `.webm` file. */
        stop(): void;
      }
    | undefined;
  /**
   * Register a custom transform/generator at runtime. The object must match
   * the `{ name, type, inputs, glsl }` shape of glsl-functions.js.
   * @param obj - the transform/generator definition
   */
  var setFunction: (obj: any) => void;
  /**
   * Load and execute an external JS file as a script tag.
   * @param url - script URL to load
   */
  var loadScript: (url?: string) => Promise<void>;

  /**
   * The Hydra instance. Set by the embedding app (e.g. the hydra web editor
   * assigns `window.hydra = new Hydra(...)`); hydra-synth does not set it.
   */
  var hydra: any;
}

export {};
