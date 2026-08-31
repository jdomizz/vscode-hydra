import * as vscode from "vscode";

/**
 * WebviewPanel containing the served runtime page in an <iframe>.
 *
 * The iframe loads the same URL the external browser receives, so there
 * is no duplicated logic — one runtime page, two mounts. The wire is the
 * platform; this panel is just one more host that displays the page.
 *
 * Limitations: VS Code webviews cannot use `navigator.mediaDevices.getUserMedia`
 * (see microsoft/vscode#250568), so the iframe inside this panel cannot access
 * camera/audio/MIDI. Users who need device access should set
 * `rig.renderer: 'external'`.
 */
export class RuntimeWebviewPanel {
  #panel: vscode.WebviewPanel | undefined;

  /** True if the panel currently exists (visible, hidden, or anywhere). */
  get exists(): boolean {
    return this.#panel !== undefined;
  }

  /**
   * Create the webview panel (if absent) and load the resolved runtime URL
   * into its iframe. The URL must be `asExternalUri`-resolved (works for
   * localhost and remote workspaces — the CSP is derived from its origin).
   *
   * If the panel already exists, it is revealed and the iframe `src` is
   * updated to the new URL (handles tunnel re-establishment in remote
   * workspaces).
   */
  create(runtimeUrl: string): void {
    if (this.#panel) {
      this.#panel.reveal();
      this.#panel.webview.html = this.#html(runtimeUrl);
      return;
    }

    this.#panel = vscode.window.createWebviewPanel(
      "vscode-hydra.runtime",
      "Hydra",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    this.#panel.webview.html = this.#html(runtimeUrl);
    this.#panel.onDidDispose(() => {
      this.#panel = undefined;
    });
  }

  /** Show an existing panel, or no-op if it doesn't exist. */
  show(): void {
    this.#panel?.reveal();
  }

  /** Dispose the panel (e.g. on extension deactivation). */
  dispose(): void {
    this.#panel?.dispose();
    this.#panel = undefined;
  }

  /**
   * Build the webview HTML — a single iframe that loads the runtime URL.
   * The CSP `frame-src` directive is derived from the URL's origin so the
   * iframe works for localhost, SSH/WSL tunnels, and VS Code for the Web.
   *
   * The `allow` attribute on the iframe forwards permission requests to
   * Chrome; even though the webview cannot currently grant mic/camera, the
   * attribute is included so the panel is forward-compatible with any
   * upstream relaxation of the VS Code permission policy.
   */
  #html(runtimeUrl: string): string {
    const origin = new URL(runtimeUrl).origin;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; frame-src ${origin};">
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    iframe { width: 100vw; height: 100vh; border: none; display: block; }
  </style>
</head>
<body>
  <iframe src="${runtimeUrl}" allow="microphone; camera"></iframe>
</body>
</html>`;
  }
}
