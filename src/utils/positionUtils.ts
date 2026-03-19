import * as vscode from "vscode";

export function getActionPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Position {
  const line = document.lineAt(position.line);
  if (line.isEmptyOrWhitespace) {
    return position;
  }

  const firstNonWhitespaceCharacter = line.firstNonWhitespaceCharacterIndex;
  if (position.character <= firstNonWhitespaceCharacter) {
    return new vscode.Position(position.line, firstNonWhitespaceCharacter);
  }

  return position;
}
