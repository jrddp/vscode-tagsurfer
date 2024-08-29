import * as vscode from "vscode";
import { getEnclosingTag, findPairedTag } from "../utils/tagUtils";
import { getSelectionType, isBlock, updateSelection } from "../utils/selectionUtils";
import { Position, Range } from "vscode";
import { asBracketLoc, findPairedBracketPos } from "../utils/bracketUtils";

export function jumpToMatchingPair(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const selections = editor.selections;

  const newSelections = selections.map((selection, index) => {
    const selectionType = getSelectionType(selection, document);

    // not block level. use active cursor position and prioritize brackets
    if (!isBlock(selectionType)) {
      const cursorPos = selection.active;
      const character = document.getText(new Range(cursorPos, cursorPos.translate(0, 1)));

      if (attemptBracketJump(editor, selection, cursorPos, character, index)) {
        return editor.selections[index];
      }

      if (attempTagJump(editor, selection, cursorPos, index)) {
        return editor.selections[index];
      }
    }

    // cursor position failed or selection is block level. use end of line and prioritize tags
    let cursorPos = new Position(
      selection.active.line,
      document.lineAt(selection.active.line).text.length - 1
    );
    // ignore trailing semicolon
    if (document.getText(new Range(cursorPos, cursorPos.translate(0, 1))) === ";") {
      cursorPos = cursorPos.translate(0, -1);
    }
    const character = document.getText(new Range(cursorPos, cursorPos.translate(0, 1)));

    if (attempTagJump(editor, selection, cursorPos, index)) {
      return editor.selections[index];
    }

    if (attemptBracketJump(editor, selection, cursorPos, character, index)) {
      return editor.selections[index];
    }

    return selection; // Return original selection if no jump was made
  });

  editor.selections = newSelections;
}

function attemptBracketJump(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  cursorPos: Position,
  character: string,
  selectionId: number
): boolean {
  const bracketLoc = asBracketLoc(character, cursorPos);
  if (!bracketLoc) {
    return false;
  }

  const newPosition = findPairedBracketPos(editor.document, bracketLoc);
  if (newPosition) {
    updateSelection(editor, selection, newPosition, selectionId);
    return true;
  } else {
    vscode.window.showInformationMessage(`Unable to find matching pair for '${character}'.`);
    return false;
  }
}

function attempTagJump(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  cursorPos: Position,
  selectionId: number
): boolean {
  const enclosingTag = getEnclosingTag(editor.document, cursorPos);
  if (enclosingTag) {
    const pairedTag = findPairedTag(editor.document, enclosingTag);
    if (pairedTag) {
      const newPosition = pairedTag.tagRange.start.translate(0, 1);
      updateSelection(editor, selection, newPosition, selectionId);
      return true;
    } else {
      vscode.window.showInformationMessage(
        `Unable to find matching pair for <${enclosingTag.tagName}>.`
      );
    }
  }
  return false;
}
