import * as vscode from "vscode";

/**
 * Manages a `vscode.DiagnosticCollection` for Hydra eval errors.
 *
 * Diagnostics surface in the Problems panel and map positions back to
 * the user's code (per the plugin spec: "Errors as `vscode.Diagnostic`
 * with mapped position").
 */
export class DiagnosticsManager implements vscode.Disposable {
  readonly #collection: vscode.DiagnosticCollection;

  constructor() {
    this.#collection = vscode.languages.createDiagnosticCollection("vscode-hydra");
  }

  /**
   * Appends a diagnostic to the collection for the given editor's document.
   * Multiple diagnostics can coexist on the same document.
   */
  report(
    editor: vscode.TextEditor,
    message: string,
    range: vscode.Range,
    severity: "error" | "warning" | "info",
  ): void {
    const sev =
      severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : severity === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(range, message, sev);
    diagnostic.source = "Hydra";

    const uri = editor.document.uri;
    const existing = this.#collection.get(uri) ?? [];
    this.#collection.set(uri, [...existing, diagnostic]);
  }

  /** Clears all diagnostics for a single document. */
  clear(uri: vscode.Uri): void {
    this.#collection.set(uri, []);
  }

  dispose(): void {
    this.#collection.dispose();
  }
}
