import * as vscode from "vscode";

export function deleteSelectionWithMatchingPairs() {
  // output current selection start and end
  const editor = vscode.window.activeTextEditor!;
  const selection = editor.selection;
  vscode.window.showInformationMessage(
    `Selection start: ${selection.start.line}:${selection.start.character}, end: ${selection.end.line}:${selection.end.character}, is reversed: ${selection.isReversed}`
  );
}
