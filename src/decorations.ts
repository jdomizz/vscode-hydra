import * as vscode from 'vscode';

// "Eurorack panel meets terminal" — dark background + mustard accent.
const FLASH_BACKGROUND = 'rgba(184, 164, 76, 0.25)';
const ERROR_UNDERLINE_COLOR = 'rgba(220, 50, 50, 0.8)';

/**
 * Temporarily highlights `range` with a mustard-tinted background for
 * `ms` milliseconds. Returns a disposable that cancels the flash early.
 */
export function flashRange(
    editor: vscode.TextEditor,
    range: vscode.Range,
    ms = 700,
): vscode.Disposable {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: FLASH_BACKGROUND,
        isWholeLine: true,
    });

    editor.setDecorations(decorationType, [range]);

    let disposed = false;
    const timer = setTimeout(() => {
        if (!disposed) {
            editor.setDecorations(decorationType, []);
            decorationType.dispose();
        }
    }, ms);

    return {
        dispose() {
            if (disposed) { return; }
            disposed = true;
            clearTimeout(timer);
            editor.setDecorations(decorationType, []);
            decorationType.dispose();
        },
    };
}

/**
 * Higher-level helper: flashes the range that was just eval'd.
 * `code` is accepted for future use (logging, tooltip) but not
 * required for the flash itself.
 */
export function flashEditorForEval(
    editor: vscode.TextEditor,
    _code: string,
    range: vscode.Range,
): vscode.Disposable {
    return flashRange(editor, range);
}

// ── Error decorations ────────────────────────────────────────────────
// Multiple error decorations can coexist on the same editor.

interface ErrorEntry {
    range: vscode.Range;
    message: string;
}

const errorEntries = new WeakMap<vscode.TextEditor, ErrorEntry[]>();
let errorDecorationType: vscode.TextEditorDecorationType | undefined;

function getErrorDecorationType(): vscode.TextEditorDecorationType {
    if (!errorDecorationType) {
        errorDecorationType = vscode.window.createTextEditorDecorationType({
            textDecoration: `underline wavy ${ERROR_UNDERLINE_COLOR}`,
            overviewRulerColor: ERROR_UNDERLINE_COLOR,
        });
    }
    return errorDecorationType;
}

/**
 * Applies a red wavy-underline decoration to `range` with a hover
 * message. Multiple errors can coexist on the same editor.
 */
export function errorRange(
    editor: vscode.TextEditor,
    range: vscode.Range,
    message: string,
): void {
    const entries = errorEntries.get(editor) ?? [];
    entries.push({ range, message });
    errorEntries.set(editor, entries);

    const decorationType = getErrorDecorationType();
    const decorations: vscode.DecorationOptions[] = entries.map(entry => ({
        range: entry.range,
        hoverMessage: new vscode.MarkdownString(`**Hydra:** ${entry.message}`),
    }));
    editor.setDecorations(decorationType, decorations);
}

/** Clears all error decorations for the given editor. */
export function clearErrors(editor: vscode.TextEditor): void {
    errorEntries.delete(editor);
    if (errorDecorationType) {
        editor.setDecorations(errorDecorationType, []);
    }
}
