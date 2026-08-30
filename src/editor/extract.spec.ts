import { describe, it, expect, beforeEach } from 'vitest';
import { Position, makeDocument } from '../__mocks__/vscode';
import type { TextDocument } from '../__mocks__/vscode';
import { getWordAtPosition, getExpressionAtPosition } from './extract';

describe('getWordAtPosition', () => {
    let doc: TextDocument;

    beforeEach(() => {
        doc = makeDocument('src(out).modulate(osc(4))');
    });

    it('extracts the identifier under the cursor (middle of word)', () => {
        // 'src(out).modulate(osc(4))'
        // col 12 is inside "modulate"
        const range = getWordAtPosition(doc as never, new Position(0, 12));
        expect(doc.getText(range)).toBe('modulate');
    });

    it('extracts the identifier at the start of a word', () => {
        // col 10 is 'm' of modulate
        const range = getWordAtPosition(doc as never, new Position(0, 10));
        expect(doc.getText(range)).toBe('modulate');
    });

    it('extracts the word to the left when cursor is right after it', () => {
        // 'src(out).modulate(osc(4))'
        // col 17 is '(' — not ident. Walking back finds 'modulate' (cols 9-16).
        const range = getWordAtPosition(doc as never, new Position(0, 17));
        expect(doc.getText(range)).toBe('modulate');
    });

    it('returns zero-width range when cursor is between non-identifier chars', () => {
        // col 8 is '.' — not ident. Walking back: ')' at 7, not ident.
        // Walking forward: '.' at 8, not ident. Zero-width range.
        const range = getWordAtPosition(doc as never, new Position(0, 8));
        expect(range.isEmpty).toBe(true);
    });

    it('handles identifiers with $ and _ characters', () => {
        const d = makeDocument('let _foo$bar = 1');
        // '_foo$bar' starts at col 4
        const range = getWordAtPosition(d as never, new Position(0, 6));
        expect(d.getText(range)).toBe('_foo$bar');
    });

    it('works on multi-line documents', () => {
        const d = makeDocument('line0\nhello world\nline2');
        // 'hello' on line 1, cols 0-4
        const range = getWordAtPosition(d as never, new Position(1, 2));
        expect(d.getText(range)).toBe('hello');
    });
});

describe('getExpressionAtPosition', () => {
    it('returns the enclosing brace block', () => {
        const doc = makeDocument('function f() { osc(4).out() }');
        // cursor at col 18 ('o' of osc), inside braces
        const range = getExpressionAtPosition(doc as never, new Position(0, 18));
        expect(doc.getText(range)).toBe('{ osc(4).out() }');
    });

    it('returns the innermost enclosing paren block when cursor is inside it', () => {
        const doc = makeDocument('src(out).modulate(osc(4))');
        // col 22 is '4' — inside inner parens at cols 21-23
        const range = getExpressionAtPosition(doc as never, new Position(0, 22));
        expect(doc.getText(range)).toBe('(4)');
    });

    it('returns the outer paren when cursor is between inner and outer', () => {
        const doc = makeDocument('src(out).modulate(osc(4))');
        // col 20 is 'c' of 'osc' — inside outer paren at cols 17-24, before inner paren
        const range = getExpressionAtPosition(doc as never, new Position(0, 20));
        expect(doc.getText(range)).toBe('(osc(4))');
    });

    it('returns the outermost enclosing bracket when nested', () => {
        const doc = makeDocument('a({ b: c(1) })');
        // cursor at col 5 ('b'). Walking back: '{' at col 2.
        // Matching '}' at col 13.
        const range = getExpressionAtPosition(doc as never, new Position(0, 5));
        expect(doc.getText(range)).toBe('{ b: c(1) }');
    });

    it('falls back to word when no brackets enclose the cursor', () => {
        const doc = makeDocument('hello world');
        const range = getExpressionAtPosition(doc as never, new Position(0, 2));
        expect(doc.getText(range)).toBe('hello');
    });

    it('falls back to word on unbalanced brackets', () => {
        const doc = makeDocument('a({ b');
        // cursor at col 4 ('b'), '{' at col 2 but no matching '}'
        const range = getExpressionAtPosition(doc as never, new Position(0, 4));
        expect(doc.getText(range)).toBe('b');
    });

    it('handles square brackets', () => {
        const doc = makeDocument('[1, 2, 3]');
        const range = getExpressionAtPosition(doc as never, new Position(0, 3));
        expect(doc.getText(range)).toBe('[1, 2, 3]');
    });

    it('works on multi-line documents', () => {
        const doc = makeDocument('function f() {\n  osc(4).out()\n}');
        // cursor on line 1, col 4 ('o' of osc)
        const range = getExpressionAtPosition(doc as never, new Position(1, 4));
        expect(doc.getText(range)).toBe('{\n  osc(4).out()\n}');
    });
});
