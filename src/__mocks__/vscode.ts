/**
 * Minimal vscode mock for unit tests.
 *
 * Only the types used by the editor extraction and decoration modules
 * are stubbed. The real `vscode` module is not available outside the
 * extension host.
 */

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(
    startLine: number | Position,
    startChar: number | Position,
    endLine?: number,
    endChar?: number,
  ) {
    if (startLine instanceof Position && startChar instanceof Position) {
      this.start = startLine;
      this.end = startChar;
    } else {
      this.start = new Position(startLine as number, startChar as number);
      this.end = new Position(endLine!, endChar!);
    }
  }

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }
}

export class Uri {
  constructor(
    public readonly scheme: string,
    public readonly path: string,
  ) {}

  get fsPath(): string {
    return this.path;
  }

  static file(path: string): Uri {
    return new Uri("file", path);
  }
}

export interface TextLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly range: Range;
}

export interface TextDocument {
  readonly uri: Uri;
  readonly lineCount: number;
  readonly lineAt: (line: number) => TextLine;
  readonly getText: (range?: Range) => string;
  readonly offsetAt: (position: Position) => number;
  readonly positionAt: (offset: number) => Position;
}

/**
 * Builds a fake `TextDocument` from a multi-line string.
 */
export function makeDocument(content: string): TextDocument {
  const lines = content.split("\n");
  const uri = Uri.file("/test/fake.js");

  const lineAt = (line: number): TextLine => ({
    lineNumber: line,
    text: lines[line] ?? "",
    range: new Range(line, 0, line, (lines[line] ?? "").length),
  });

  const getText = (range?: Range): string => {
    if (!range) {
      return content;
    }
    const startOffset = offsetAt(range.start);
    const endOffset = offsetAt(range.end);
    return content.slice(startOffset, endOffset);
  };

  const offsetAt = (position: Position): number => {
    let offset = 0;
    for (let i = 0; i < position.line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for '\n'
    }
    offset += position.character;
    return offset;
  };

  const positionAt = (offset: number): Position => {
    let remaining = offset;
    for (let i = 0; i < lines.length; i++) {
      if (remaining <= lines[i].length) {
        return new Position(i, remaining);
      }
      remaining -= lines[i].length + 1;
    }
    return new Position(lines.length - 1, lines[lines.length - 1].length);
  };

  return {
    uri,
    lineCount: lines.length,
    lineAt,
    getText,
    offsetAt,
    positionAt,
  };
}

// ── Selection & TextEditor ───────────────────────────────────────────

export class Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;

  constructor(anchorLine: number, anchorChar: number, activeLine: number, activeChar: number) {
    super(anchorLine, anchorChar, activeLine, activeChar);
    this.anchor = new Position(anchorLine, anchorChar);
    this.active = new Position(activeLine, activeChar);
  }
}

export interface TextEditor {
  readonly document: TextDocument;
  readonly selection: Selection;
  setDecorations: (type: unknown, ranges: unknown[]) => void;
}

/**
 * Builds a fake `TextEditor` from document content and a cursor position.
 */
export function makeEditor(
  content: string,
  cursorLine = 0,
  cursorChar = 0,
  selectionEndLine?: number,
  selectionEndChar?: number,
): TextEditor {
  const doc = makeDocument(content);
  const sel = new Selection(
    cursorLine,
    cursorChar,
    selectionEndLine ?? cursorLine,
    selectionEndChar ?? cursorChar,
  );
  return {
    document: doc,
    selection: sel,
    setDecorations: () => {
      /* noop */
    },
  };
}

// ── Mutable window state (tests can set activeTextEditor) ────────────

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export interface StatusBarItem {
  text: string;
  tooltip?: string | MarkdownString;
  command?: string;
  show: () => void;
  hide: () => void;
  dispose: () => void;
}

interface StatusBarState {
  items: StatusBarItem[];
}

const statusBarState: StatusBarState = { items: [] };

// ── Webview stubs (dual-mount-renderer) ──────────────────────────────

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
  Beside = -2,
  Active = -1,
}

export interface Webview {
  html: string;
}

export interface WebviewPanel {
  readonly webview: Webview;
  readonly viewType: string;
  readonly title: string;
  readonly viewColumn: ViewColumn | undefined;
  reveal: (column?: ViewColumn) => void;
  dispose: () => void;
  onDidDispose: (handler: () => void) => { dispose: () => void };
}

interface WebviewPanelState {
  viewType: string;
  title: string;
  viewColumn: ViewColumn | undefined;
  options: Record<string, unknown>;
  html: string;
  disposeHandler: (() => void) | null;
}

interface WebviewPanelsState {
  panels: WebviewPanelState[];
  createCount: number;
}

const webviewPanelsState: WebviewPanelsState = {
  panels: [],
  createCount: 0,
};

/**
 * Captured webview panel states for tests.
 * Reset via {@link __resetMockState}.
 */
export function __getMockedWebviewPanels(): readonly WebviewPanelState[] {
  return webviewPanelsState.panels;
}

export function __getWebviewCreateCount(): number {
  return webviewPanelsState.createCount;
}

/** Captured information messages for manifest-parity tests (C5 deprecated aliases). */
export const __mockedInfoMessages: string[] = [];

/** Captured error messages for tests. */
export const __mockedErrorMessages: string[] = [];

export const window = {
  activeTextEditor: undefined as TextEditor | undefined,
  visibleTextEditors: [] as TextEditor[],
  createTextEditorDecorationType: (_opts: unknown) => ({
    dispose: () => {
      /* noop */
    },
  }),
  createStatusBarItem(_alignment?: StatusBarAlignment, _priority?: number): StatusBarItem {
    const item: StatusBarItem = {
      text: "",
      tooltip: undefined,
      command: undefined,
      show: () => {
        /* noop */
      },
      hide: () => {
        /* noop */
      },
      dispose: () => {
        /* noop */
      },
    };
    statusBarState.items.push(item);
    return item;
  },
  createWebviewPanel(
    viewType: string,
    title: string,
    viewColumn: ViewColumn | undefined,
    options?: Record<string, unknown>,
  ): WebviewPanel {
    webviewPanelsState.createCount++;
    const state: WebviewPanelState = {
      viewType,
      title,
      viewColumn,
      options: options ?? {},
      html: "",
      disposeHandler: null,
    };
    const panel: WebviewPanel = {
      webview: {
        get html(): string {
          return state.html;
        },
        set html(value: string) {
          state.html = value;
        },
      },
      viewType: state.viewType,
      title: state.title,
      viewColumn: state.viewColumn,
      reveal: (_column?: ViewColumn) => {
        /* noop — tests don't render */
      },
      dispose: () => {
        const idx = webviewPanelsState.panels.indexOf(state);
        if (idx >= 0) webviewPanelsState.panels.splice(idx, 1);
        if (state.disposeHandler) state.disposeHandler();
      },
      onDidDispose: (handler: () => void) => {
        state.disposeHandler = handler;
        return { dispose: () => { state.disposeHandler = null; } };
      },
    };
    webviewPanelsState.panels.push(state);
    return panel;
  },
  showInformationMessage: (msg: string) => {
    __mockedInfoMessages.push(msg);
  },
  showWarningMessage: (_msg: string) => {
    /* noop */
  },
  showErrorMessage: (msg: string) => {
    __mockedErrorMessages.push(msg);
  },
};

export function getStatusBarItems(): StatusBarItem[] {
  return statusBarState.items;
}

// ── Diagnostic stubs ─────────────────────────────────────────────────

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Diagnostic {
  source?: string;
  constructor(
    public readonly range: Range,
    public readonly message: string,
    public readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {}
}

export class MarkdownString {
  isTrusted = false;
  value = "";
  constructor(value?: string) {
    this.value = value ?? "";
  }
  appendMarkdown(text: string): this {
    this.value += text;
    return this;
  }
}

// ── DiagnosticCollection stub ────────────────────────────────────────

interface DiagnosticCollectionState {
  items: Map<string, Diagnostic[]>;
  disposed: boolean;
}

export const languages = {
  createDiagnosticCollection: (_name?: string): DiagnosticCollection => {
    const state: DiagnosticCollectionState = { items: new Map(), disposed: false };
    return {
      get(uri: Uri): Diagnostic[] | undefined {
        return state.items.get(uri.path);
      },
      set(uri: Uri, diagnostics: Diagnostic[]): void {
        state.items.set(uri.path, diagnostics);
      },
      clear(): void {
        state.items.clear();
      },
      dispose(): void {
        state.disposed = true;
      },
    };
  },
};

export interface DiagnosticCollection {
  get(uri: Uri): Diagnostic[] | undefined;
  set(uri: Uri, diagnostics: Diagnostic[]): void;
  clear(): void;
  dispose(): void;
}

// ── env + commands stubs ─────────────────────────────────────────────

export const env = {
  openExternal: async (_uri: Uri): Promise<boolean> => true,
  /** Passthrough — tests run in a local (non-remote) context. */
  asExternalUri: async (uri: Uri): Promise<Uri> => uri,
};

/**
 * Captured command registrations for manifest-parity tests.
 * Reset via {@link __resetMockState}.
 */
export const __mockedCommands = new Set<string>();

/**
 * Captured context keys set via `executeCommand('setContext', key, value)`.
 * Reset via {@link __resetMockState}.
 */
export const __mockedContexts = new Set<string>();

/**
 * Reset all captured mock state. Call in beforeEach/beforeAll of tests
 * that depend on the captured sets.
 */
export function __resetMockState(): void {
  __mockedCommands.clear();
  __mockedContexts.clear();
  __mockedInfoMessages.length = 0;
  __mockedErrorMessages.length = 0;
  statusBarState.items.length = 0;
  webviewPanelsState.panels.length = 0;
  webviewPanelsState.createCount = 0;
}

export const commands = {
  registerCommand: (id: string, _handler: (...args: unknown[]) => unknown) => {
    __mockedCommands.add(id);
    return {
      dispose: () => {
        /* keep in captured set for manifest-parity assertions */
      },
    };
  },
  executeCommand: async (command: string, ...args: unknown[]) => {
    if (command === "setContext" && args.length >= 2) {
      __mockedContexts.add(args[0] as string);
    }
  },
};

// ── workspace configuration stubs ────────────────────────────────────

interface MockConfiguration {
  [key: string]: unknown;
}

const mockConfigurations: Record<string, MockConfiguration> = {};

/**
 * Set mock configuration values for a namespace. Tests call this to
 * control what `workspace.getConfiguration(ns)` returns.
 */
export function __setMockConfiguration(namespace: string, values: MockConfiguration): void {
  mockConfigurations[namespace] = { ...values };
}

interface MockInspected {
  globalValue?: unknown;
  workspaceValue?: unknown;
  defaultValue?: unknown;
}

export const workspace = {
  getConfiguration: (namespace?: string) => {
    const values = namespace ? (mockConfigurations[namespace] ?? {}) : {};
    return {
      get<T>(key: string, defaultValue?: T): T {
        return (values[key] as T) ?? (defaultValue as T);
      },
      inspect(key: string): MockInspected | undefined {
        if (key in values) {
          return { workspaceValue: values[key] };
        }
        return undefined;
      },
      has(key: string): boolean {
        return key in values;
      },
      update: async () => {
        /* noop */
      },
    };
  },
  onDidChangeConfiguration: (_handler: unknown) => ({
    dispose: () => {
      /* noop */
    },
  }),
};
