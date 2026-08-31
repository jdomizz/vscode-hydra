import { describe, it, expect, beforeEach } from "vitest";
import { Selection, makeDocument, window as mockWindow } from "../__mocks__/vscode";
import type { TextEditor } from "../__mocks__/vscode";
import { EditorService } from "./index";

function setEditor(content: string, cursorLine = 0, cursorChar = 0): void {
  const doc = makeDocument(content);
  const sel = new Selection(cursorLine, cursorChar, cursorLine, cursorChar);
  mockWindow.activeTextEditor = {
    document: doc,
    selection: sel,
    setDecorations: () => {
      /* noop */
    },
  } as unknown as TextEditor;
}

function setEditorWithSelection(
  content: string,
  anchorLine: number,
  anchorChar: number,
  activeLine: number,
  activeChar: number,
): void {
  const doc = makeDocument(content);
  const sel = new Selection(anchorLine, anchorChar, activeLine, activeChar);
  mockWindow.activeTextEditor = {
    document: doc,
    selection: sel,
    setDecorations: () => {
      /* noop */
    },
  } as unknown as TextEditor;
}

describe("EditorService", () => {
  let editor: EditorService;

  beforeEach(() => {
    editor = new EditorService();
    mockWindow.activeTextEditor = undefined;
    mockWindow.visibleTextEditors = [];
  });

  describe("document()", () => {
    it("returns the full document text", () => {
      setEditor("line0\nline1\nline2");
      const result = editor.document();
      expect(result.code).toBe("line0\nline1\nline2");
    });

    it("range spans the entire document", () => {
      setEditor("line0\nline1\nline2");
      const result = editor.document();
      expect(result.range.start.line).toBe(0);
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.line).toBe(2);
      expect(result.range.end.character).toBe(5);
    });
  });

  describe("line()", () => {
    it("returns the current line at cursor", () => {
      setEditor("line0\nline1\nline2", 1, 0);
      const result = editor.line();
      expect(result.code).toBe("line1");
    });

    it("returns the line even when there is a selection", () => {
      setEditorWithSelection("hello\nworld", 0, 0, 0, 3);
      const result = editor.line();
      // line() always returns the full line, ignoring selection
      expect(result.code).toBe("hello");
    });

    it("range covers the full line", () => {
      setEditor("abc\ndefgh\nij", 1, 2);
      const result = editor.line();
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.character).toBe(5);
    });
  });

  describe("block()", () => {
    it("returns the smallest enclosing {} block", () => {
      setEditor("function f() {\n  osc(4).out()\n}", 1, 4);
      const result = editor.block();
      expect(result.code).toBe("{\n  osc(4).out()\n}");
    });

    it("falls back to paragraph block when no braces enclose cursor", () => {
      setEditor("osc(4).out()\n\nsrc(out)", 0, 2);
      const result = editor.block();
      expect(result.code).toBe("osc(4).out()");
    });

    it("falls back to paragraph when braces are unbalanced", () => {
      setEditor("osc(4)\n.out()", 0, 2);
      const result = editor.block();
      expect(result.code).toBe("osc(4)\n.out()");
    });

    it("handles nested braces — returns innermost enclosing block", () => {
      setEditor("outer(() => {\n  inner(() => {\n    osc(4)\n  })\n})", 2, 6);
      const result = editor.block();
      expect(result.code).toBe("{\n    osc(4)\n  }");
    });
  });

  describe("selection()", () => {
    it("returns the selection when non-empty", () => {
      setEditorWithSelection("hello world", 0, 0, 0, 5);
      const result = editor.selection();
      expect(result.code).toBe("hello");
    });

    it("returns the current line when selection is empty", () => {
      setEditor("hello\nworld", 1, 2);
      const result = editor.selection();
      expect(result.code).toBe("world");
    });
  });

  describe("expression()", () => {
    it("returns the bracketed expression at cursor", () => {
      setEditor("function f() { osc(4).out() }", 0, 18);
      const result = editor.expression();
      expect(result.code).toBe("{ osc(4).out() }");
    });

    it("falls back to the word when no brackets enclose cursor", () => {
      setEditor("hello world", 0, 2);
      const result = editor.expression();
      expect(result.code).toBe("hello");
    });
  });

  describe("error handling", () => {
    it("throws when no file editor is active", () => {
      expect(() => editor.document()).toThrow("no active file editor");
    });
  });
});
