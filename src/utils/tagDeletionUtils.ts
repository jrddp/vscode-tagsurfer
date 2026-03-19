import * as vscode from "vscode";

import { getIndentationString, Tag } from "./tagUtils";

export type EditOperation = {
  startOffset: number;
  endOffset: number;
  replacementText: string;
};

function removeOneIndentUnit(lineText: string, indentUnit: string): string {
  return lineText.startsWith(indentUnit) ? lineText.slice(indentUnit.length) : lineText;
}

export function getWrappedBlockDeleteOperation(
  editor: vscode.TextEditor,
  openingTag: Tag,
  closingTag: Tag
): EditOperation | null {
  const document = editor.document;
  if (openingTag.tagType !== "opening" || closingTag.tagType !== "closing") {
    return null;
  }

  if (openingTag.tagRange.start.line === closingTag.tagRange.start.line) {
    return null;
  }

  const openingStartLine = document.lineAt(openingTag.tagRange.start.line).text;
  const openingEndLine = document.lineAt(openingTag.tagRange.end.line).text;
  const closingStartLine = document.lineAt(closingTag.tagRange.start.line).text;
  const closingEndLine = document.lineAt(closingTag.tagRange.end.line).text;

  const beforeOpening = openingStartLine.slice(0, openingTag.tagRange.start.character);
  const afterOpening = openingEndLine.slice(openingTag.tagRange.end.character);
  const beforeClosing = closingStartLine.slice(0, closingTag.tagRange.start.character);
  const afterClosing = closingEndLine.slice(closingTag.tagRange.end.character);

  if (
    beforeOpening.trim() !== "" ||
    afterOpening.trim() !== "" ||
    beforeClosing.trim() !== "" ||
    afterClosing.trim() !== ""
  ) {
    return null;
  }

  const indentUnit = getIndentationString(editor);
  const innerLines: string[] = [];
  for (let line = openingTag.tagRange.end.line + 1; line < closingTag.tagRange.start.line; line++) {
    innerLines.push(removeOneIndentUnit(document.lineAt(line).text, indentUnit));
  }

  return {
    startOffset: document.offsetAt(new vscode.Position(openingTag.tagRange.start.line, 0)),
    endOffset: document.offsetAt(
      new vscode.Position(
        closingTag.tagRange.end.line,
        document.lineAt(closingTag.tagRange.end.line).text.length
      )
    ),
    replacementText: innerLines.join("\n"),
  };
}
