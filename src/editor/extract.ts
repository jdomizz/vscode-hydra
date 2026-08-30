import * as vscode from 'vscode';

/**
 * Returns the range of the identifier (word) under the cursor.
 * An identifier character matches `[a-zA-Z0-9_$]`.
 * If the cursor is not on an identifier, returns a zero-width range at position.
 */
export function getWordAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): vscode.Range {
    const lineText = document.lineAt(position.line).text;
    const col = position.character;

    let start = col;
    let end = col;

    while (start > 0 && isIdentChar(lineText[start - 1])) {
        start--;
    }
    while (end < lineText.length && isIdentChar(lineText[end])) {
        end++;
    }

    if (start === end) {
        return new vscode.Range(position, position);
    }
    return new vscode.Range(position.line, start, position.line, end);
}

/**
 * Returns the range of the smallest enclosing bracketed expression
 * (`{}`, `()`, or `[]`) around the cursor position.
 *
 * Falls back to {@link getWordAtPosition} when no enclosing brackets
 * are found or when they are unbalanced.
 */
export function getExpressionAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): vscode.Range {
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Walk backward from cursor to find the nearest unmatched opening bracket.
    let depth = 0;
    let start = -1;

    for (let i = offset - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === '}' || ch === ')' || ch === ']') {
            depth++;
        } else if (ch === '{' || ch === '(' || ch === '[') {
            if (depth === 0) {
                start = i;
                break;
            }
            depth--;
        }
    }

    if (start === -1) {
        return getWordAtPosition(document, position);
    }

    // Walk forward from the opening bracket to find its matching closer.
    const openCh = text[start];
    const closeCh = openCh === '{' ? '}' : openCh === '(' ? ')' : ']';
    depth = 1;
    let end = -1;

    for (let i = start + 1; i < text.length; i++) {
        if (text[i] === openCh) {
            depth++;
        } else if (text[i] === closeCh) {
            depth--;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }

    if (end === -1) {
        return getWordAtPosition(document, position);
    }

    return new vscode.Range(document.positionAt(start), document.positionAt(end + 1));
}

function isIdentChar(ch: string): boolean {
    return /[a-zA-Z0-9_$]/.test(ch);
}
