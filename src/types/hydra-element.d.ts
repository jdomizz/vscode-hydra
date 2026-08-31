// Type shim for hydra-element — the package ships JS only (no .d.ts).
// Declares the custom element's public surface so the runtime can use it
// under TypeScript strict without `any`.

interface HydraElementReadyDetail {
  synth: unknown;
}

interface HydraElementEvalDetail {
  success: boolean;
  error?: string;
}

interface HydraElementResizeDetail {
  width: number;
  height: number;
}

interface HydraElement extends HTMLElement {
  /** Get or set the scene code. Setting triggers evaluation. */
  code: string;
  /** The canvas element backing the render. */
  readonly canvas: HTMLCanvasElement | null;
  /** Read-only hydra-synth instance. */
  readonly synth: unknown;
  /** Resolves with `{ synth }` once Hydra is initialized. */
  readonly ready: Promise<{ synth: unknown }>;
  /** Tear the element down without removing it from the DOM. */
  destroy(): void;
  /** Load an extension script scoped to this element. */
  loadScript(url: string): Promise<void>;
}

interface HydraElementConstructor {
  new (): HydraElement;
  readonly prototype: HydraElement;
}

declare global {
  interface HTMLElementTagNameMap {
    "hydra-element": HydraElement;
  }
}

declare module "hydra-element" {
  export const HydraElement: HydraElementConstructor;
}

declare module "hydra-element/eval" {
  /**
   * Evaluate code using a hydra-synth instance as scope.
   * NOT a sandbox — user code has full access to browser globals.
   */
  export function hydraEval(
    code: string,
    synth: unknown,
    scope?: Record<string, unknown>,
  ): Promise<unknown>;
}
