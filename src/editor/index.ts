import * as vscode from "vscode";
import { getWordAtPosition, getExpressionAtPosition } from "./extract";

/**
 * The result of extracting code from the active editor.
 * `range` maps the extraction back to document coordinates so callers
 * can build diagnostics and decorations with position.
 */
export interface EditorExtraction {
  code: string;
  range: vscode.Range;
}

/**
 * Editor extraction service.
 *
 * Each method reads the active file editor and returns the extracted
 * code together with its source range. When no file editor is open,
 * methods throw — callers should guard with `vscode.window.activeTextEditor`.
 */
export class EditorService {
  /** Full document text. */
  document(): EditorExtraction {
    const editor = this.#requireEditor();
    const doc = editor.document;
    const lastLine = doc.lineAt(doc.lineCount - 1);
    return {
      code: doc.getText(),
      range: new vscode.Range(0, 0, doc.lineCount - 1, lastLine.text.length),
    };
  }

  /** Current line at the cursor (ignores selection). */
  line(): EditorExtraction {
    const editor = this.#requireEditor();
    const range = editor.document.lineAt(editor.selection.active.line).range;
    return {
      code: editor.document.getText(range),
      range,
    };
  }

  /**
   * Smallest enclosing `{}` block at the cursor.
   *
   * Walks backward from the cursor to find an unmatched `{`, then
   * forward to its matching `}`. Falls back to the paragraph block
   * (empty-line bounded) when no enclosing braces are found — this
   * preserves the original vscode-hydra "block" behavior for code
   * that does not use braces.
   */
  block(): EditorExtraction {
    const editor = this.#requireEditor();
    const range = this.#getBraceBlockRange(editor);
    return {
      code: editor.document.getText(range),
      range,
    };
  }

  /**
   * Current selection, or the current line when the selection is empty.
   * Used for "eval selection or current line" semantics.
   */
  selection(): EditorExtraction {
    const editor = this.#requireEditor();
    const range = editor.selection.isEmpty
      ? editor.document.lineAt(editor.selection.active.line).range
      : new vscode.Range(editor.selection.start, editor.selection.end);
    return {
      code: editor.document.getText(range),
      range,
    };
  }

  /**
   * Smallest enclosing bracketed expression at the cursor, falling back
   * to the word at the cursor when no brackets enclose it.
   *
   * Phase 2 heuristic — not a real parser.
   */
  expression(): EditorExtraction {
    const editor = this.#requireEditor();
    const range = getExpressionAtPosition(editor.document, editor.selection.active);
    return {
      code: editor.document.getText(range),
      range,
    };
  }

  // ── private ───────────────────────────────────────────────────────

  #requireEditor(): vscode.TextEditor {
    const active = vscode.window.activeTextEditor;
    if (active && active.document.uri.scheme === "file") {
      return active;
    }
    const fileEditor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.scheme === "file",
    );
    if (!fileEditor) {
      throw new Error("vscode-hydra: no active file editor");
    }
    return fileEditor;
  }

  /**
   * Finds the smallest `{}` block enclosing the cursor.
   * Falls back to paragraph (empty-line bounded) when no braces enclose.
   */
  #getBraceBlockRange(editor: vscode.TextEditor): vscode.Range {
    const doc = editor.document;
    const text = doc.getText();
    const offset = doc.offsetAt(editor.selection.active);

    // Walk backward to find the nearest unmatched '{'.
    let depth = 0;
    let start = -1;

    for (let i = offset - 1; i >= 0; i--) {
      if (text[i] === "}") {
        depth++;
      }
      if (text[i] === "{") {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }

    if (start === -1) {
      return this.#getParagraphBlock(editor);
    }

    // Walk forward from '{' to find its matching '}'.
    depth = 1;
    let end = -1;

    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === "{") {
        depth++;
      }
      if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) {
      return this.#getParagraphBlock(editor);
    }

    return new vscode.Range(doc.positionAt(start), doc.positionAt(end + 1));
  }

  /**
   * Paragraph block: contiguous non-empty lines around the cursor.
   * Preserves the original vscode-hydra block behavior.
   */
  #getParagraphBlock(editor: vscode.TextEditor): vscode.Range {
    const doc = editor.document;
    const currentLine = editor.selection.active.line;

    let startLine = currentLine;
    while (startLine > 0 && doc.lineAt(startLine - 1).text.trim() !== "") {
      startLine--;
    }

    let endLine = currentLine;
    while (endLine < doc.lineCount - 1 && doc.lineAt(endLine + 1).text.trim() !== "") {
      endLine++;
    }

    return new vscode.Range(doc.lineAt(startLine).range.start, doc.lineAt(endLine).range.end);
  }
}

// Re-export for callers that need the raw helpers.
export { getWordAtPosition, getExpressionAtPosition };
