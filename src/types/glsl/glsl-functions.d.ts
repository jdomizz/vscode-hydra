// Type declarations for the hydra-synth GLSL transform catalog
// (`hydra-synth/src/glsl/glsl-functions.js`).

/**
 * The transform category. Determines the generated GLSL signature:
 * - `'src'`:          `vec4(vec2 _st, ...)` — becomes a generator (osc, noise, ...)
 * - `'coord'`:        `vec2(vec2 _st, ...)` — chainable geometry transform
 * - `'color'`:        `vec4(vec4 _c0, ...)` — chainable color transform
 * - `'combine'`:      `vec4(vec4 _c0, vec4 _c1, ...)` — blend with a texture
 * - `'combineCoord'`: `vec2(vec2 _st, vec4 _c0, ...)` — modulate by a texture
 */
export type GlslFunctionType = 'src' | 'coord' | 'color' | 'combine' | 'combineCoord';

/** A transform input parameter. */
export interface GlslInput {
  /** Parameter name (used in the JS API and the GLSL signature). */
  name: string;
  /** GLSL type: 'float', 'sampler2D', 'vec2', 'vec4', ... */
  type: string;
  /** Default value used when the argument is omitted. */
  default: any;
}

/** A transform/generator definition. */
export interface GlslFunction {
  /** Name used in JS and GLSL. */
  name: string;
  /** The transform category. */
  type: GlslFunctionType;
  /** The declared input parameters. */
  inputs: GlslInput[];
  /** The GLSL body of the transform. */
  glsl: string;
}

/**
 * The full catalog of built-in transforms/generators used by hydra-synth to
 * build the JS API.
 * @returns the list of transform/generator definitions
 */
declare const glslFunctions: () => GlslFunction[];

export default glslFunctions;
