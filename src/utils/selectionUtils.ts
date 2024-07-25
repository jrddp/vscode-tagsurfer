import * as vscode from "vscode";
import { Position, Selection } from "vscode";

type SelectionType = "none" | "inline" | "fullLine" | "multiFullLine" | "multiInline";

export function getSelectionType(
  selection: vscode.Selection,
  document: vscode.TextDocument
): SelectionType {
  if (selection.isEmpty) {
    return "none";
  }
  const start = selection.start;
  const end = selection.end;
  if (start.character === 0 && end.character === document.lineAt(end.line).text.length) {
    return start.line === end.line ? "fullLine" : "multiFullLine";
  }
  return start.line === end.line ? "inline" : "multiInline";
}

export function getClosestSurroundingTag(
  position: vscode.Position,
  document: vscode.TextDocument
): vscode.Range | null {
  // This is a simplified implementation. A more robust version would use a parser.
  const line = document.lineAt(position.line).text;
  let startTag = line.lastIndexOf("<", position.character);
  let endTag = line.indexOf(">", position.character);

  if (startTag === -1 || endTag === -1) {
    return null;
  }

  return new vscode.Range(
    new vscode.Position(position.line, startTag),
    new vscode.Position(position.line, endTag + 1)
  );
}

export function updateSelection(
  editor: vscode.TextEditor,
  oldSelection: Selection,
  newPosition: Position
): void {
  const selectionType = getSelectionType(oldSelection, editor.document);
  const oldStart = oldSelection.start;
  const oldEnd = oldSelection.end;

  switch (selectionType) {
    case "none":
      editor.selection = new Selection(newPosition, newPosition);
      return;
    case "inline":
    case "multiInline":
      if (oldSelection.isReversed) {
        if (newPosition.isBefore(oldEnd)) {
          editor.selection = new Selection(oldEnd, newPosition);
        } else {
          editor.selection = new Selection(oldStart.translate(0, 1), newPosition.translate(0, 1));
        }
      } else {
        if (newPosition.isAfter(oldStart)) {
          editor.selection = new Selection(oldStart, newPosition.translate(0, 1));
        } else {
          editor.selection = new Selection(oldStart.translate(0, 1), newPosition);
        }
      }
      return;

    case "fullLine":
    case "multiFullLine":
      const newLine = editor.document.lineAt(newPosition.line);

      if (newLine.lineNumber < oldStart.line) {
        const newStart = new Position(newLine.lineNumber, 0);
        editor.selection = new Selection(oldEnd, newStart);
      } else if (oldSelection.isReversed) {
        const newStart = new Position(newLine.lineNumber, 0);
        editor.selection = new Selection(oldEnd, newStart);
      } else {
        const newEnd = new Position(newLine.lineNumber, newLine.text.length);
        editor.selection = new Selection(oldStart, newEnd);
      }
      return;
  }
}
