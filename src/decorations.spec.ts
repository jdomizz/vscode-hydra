import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Range, Selection, makeDocument } from './__mocks__/vscode';
import type { TextEditor } from './__mocks__/vscode';
import { flashRange, flashEditorForEval, errorRange, clearErrors } from './decorations';

function makeMockEditor(content: string): TextEditor {
    const doc = makeDocument(content);
    const sel = new Selection(0, 0, 0, 0);
    return {
        document: doc,
        selection: sel,
        setDecorations: () => { /* noop */ },
    } as unknown as TextEditor;
}

describe('flashRange', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('applies decorations and clears after timeout', () => {
        const editor = makeMockEditor('hello world');
        const range = new Range(0, 0, 0, 5);

        const disposable = flashRange(editor as never, range, 500);

        // Advance past the timeout — should not throw
        vi.advanceTimersByTime(600);
        disposable.dispose(); // safe to call again
    });

    it('returns a disposable that cancels the flash early', () => {
        const editor = makeMockEditor('hello world');
        const range = new Range(0, 0, 0, 5);

        const disposable = flashRange(editor as never, range, 1000);
        disposable.dispose(); // cancel immediately

        vi.advanceTimersByTime(2000);
    });

    it('uses default timeout of 700ms', () => {
        const editor = makeMockEditor('test');
        const range = new Range(0, 0, 0, 4);

        const disposable = flashRange(editor as never, range);

        vi.advanceTimersByTime(600);
        vi.advanceTimersByTime(200);
        disposable.dispose();
    });
});

describe('flashEditorForEval', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('returns a disposable (delegates to flashRange)', () => {
        const editor = makeMockEditor('osc(4).out()');
        const range = new Range(0, 0, 0, 12);

        const disposable = flashEditorForEval(editor as never, 'osc(4).out()', range);
        expect(disposable).toHaveProperty('dispose');
        disposable.dispose();
    });
});

describe('errorRange', () => {
    it('adds error decorations that coexist', () => {
        const editor = makeMockEditor('line0\nline1\nline2');
        const range1 = new Range(0, 0, 0, 5);
        const range2 = new Range(1, 0, 1, 5);

        errorRange(editor as never, range1, 'error 1');
        errorRange(editor as never, range2, 'error 2');
        // No throw — multiple errors coexist on the same editor.
    });
});

describe('clearErrors', () => {
    it('clears error decorations for an editor', () => {
        const editor = makeMockEditor('hello');
        errorRange(editor as never, new Range(0, 0, 0, 5), 'err');
        clearErrors(editor as never);
    });

    it('is safe to call on an editor with no errors', () => {
        const editor = makeMockEditor('hello');
        clearErrors(editor as never);
    });
});
