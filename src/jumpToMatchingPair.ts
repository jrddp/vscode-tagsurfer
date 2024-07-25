import * as vscode from "vscode";
import { getEnclosingTag, findPairedTag } from "./utils/tagUtils";
import { getSelectionType } from "./utils/selectionUtils";
import { Position, Range } from "vscode";
import { allBrackets, findMatchingBracket } from "./utils/bracketUtils";

export function jumpToMatchingPair(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const selection = editor.selection;
  const selectionType = getSelectionType(selection, document);
  let cursorPos: Position;
  if (selectionType === "fullLine" || selectionType === "multiFullLine") {
    cursorPos = new Position(
      selection.active.line,
      document.lineAt(selection.active.line).text.length - 1
    );
  } else {
    cursorPos = selection.active;
  }

  let character = document.getText(new Range(cursorPos, cursorPos.translate(0, 1)));

  if (allBrackets.includes(character)) {
    const newPosition = findMatchingBracket(document, cursorPos, character);
    if (newPosition) {
      editor.selection = new vscode.Selection(newPosition, newPosition);
    }
    return;
  }

  let enclosingTag = getEnclosingTag(document, cursorPos);

  if (!enclosingTag) {
    // nothing found under cursor, try last position on line
    cursorPos = new Position(
      selection.active.line,
      document.lineAt(selection.active.line).text.length - 1
    );
    character = document.getText(new Range(cursorPos, cursorPos.translate(0, 1)));

    if (allBrackets.includes(character)) {
      const newPosition = findMatchingBracket(document, cursorPos, character);
      if (newPosition) {
        editor.selection = new vscode.Selection(newPosition, newPosition);
      }
      return;
    }
    return;
  }

  const pairedTag = findPairedTag(document, enclosingTag);

  if (!pairedTag) {
    vscode.window.showInformationMessage("No matching pair found for the current tag.");
    return;
  }

  const newPosition = pairedTag.tagRange.start.translate(0, 1);
  editor.selection = new vscode.Selection(newPosition, newPosition);

  editor.revealRange(new vscode.Range(newPosition, newPosition));
}
