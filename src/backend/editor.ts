import * as vscode from 'vscode';

export class EditorService {

    get document(): string {
        return this.editor.document.getText();
    }

    get line(): string {
        return this.editor.document.getText(this.getLine());
    }

    get block(): string {
        return this.editor.document.getText(this.getBlock());
    }

    private get editor(): vscode.TextEditor {
        return vscode.window.activeTextEditor?.document.uri.scheme === 'file'
            ? vscode.window.activeTextEditor
            : vscode.window.visibleTextEditors.filter(editor => editor.document.uri.scheme === 'file')[0];
    }

    private getLine(): vscode.Range {
        return this.editor.selection.isEmpty
            ? this.editor.document.lineAt(this.editor.selection.active.line).range
            : this.editor.selection;
    }

    private getBlock(): vscode.Range {
        const currentLine = this.editor.selection.active.line;

        let startLine = currentLine;
        while (startLine > 0 && !this.isEmptyLine(startLine)) {
            startLine--;
        }

        let endLine = currentLine;
        while (endLine < this.editor.document.lineCount - 1 && !this.isEmptyLine(endLine)) {
            endLine++;
        }

        const start = this.editor.document.lineAt(startLine).range.start;
        const end = this.editor.document.lineAt(endLine).range.end;
        return new vscode.Range(start, end);
    }

    private isEmptyLine(position: number): boolean {
        const line = this.editor.document.lineAt(position).range;
        return this.editor.document.getText(line).trim() === '';
    }
}