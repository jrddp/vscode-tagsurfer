import * as vscode from "vscode";
import { getEnclosingTag, findPairedTag } from "./utils/tagUtils";
import { getSelectionType, updateSelection } from "./utils/selectionUtils";
import { Position, Range } from "vscode";
import { allBrackets, findMatchingBracket } from "./utils/bracketUtils";

export function jumpToMatchingPair(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const oldSelection = editor.selection;
  const selectionType = getSelectionType(oldSelection, document);
  let cursorPos: Position;
  if (selectionType === "fullLine" || selectionType === "multiFullLine") {
    cursorPos = new Position(
      oldSelection.active.line,
      document.lineAt(oldSelection.active.line).text.length - 2
    );
  } else {
    cursorPos = oldSelection.active;
    if (selectionType !== "none" && !oldSelection.isReversed) {
      cursorPos = cursorPos.translate(0, -1);
    }
  }

  let character = document.getText(new Range(cursorPos, cursorPos.translate(0, 1)));
  console.log(character);

  if (allBrackets.includes(character)) {
    const newPosition = findMatchingBracket(document, cursorPos, character);
    if (newPosition) {
      updateSelection(editor, oldSelection, newPosition);
    }
    return;
  }

  let enclosingTag = getEnclosingTag(document, cursorPos);

  if (!enclosingTag) {
    // nothing found under cursor, try last position on line
    cursorPos = new Position(
      oldSelection.active.line,
      document.lineAt(oldSelection.active.line).text.length - 1
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
  updateSelection(editor, oldSelection, newPosition);

  editor.revealRange(new vscode.Range(newPosition, newPosition));
}
