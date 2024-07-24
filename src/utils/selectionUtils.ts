import * as vscode from "vscode";

type SelectionType = "none" | "inline" | "fullLine" | "multiLine";

export function getSelectionType(
  selection: vscode.Selection,
  document: vscode.TextDocument
): SelectionType {
  if (selection.isEmpty) {
    return "none";
  }
  const start = selection.start;
  const end = selection.end;
  if (start.line !== end.line) {
    return "multiLine";
  }
  if (start.character === 0 && end.character === document.lineAt(end.line).text.length) {
    return "fullLine";
  }
  return "inline";
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
