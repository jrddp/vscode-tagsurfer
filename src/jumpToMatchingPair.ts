import * as vscode from "vscode";
import { getEnclosingTag, findPairedTag } from "./utils/tagUtils";

export function jumpToMatchingPair(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const cursorPos = editor.selection.active;

  const enclosingTag = getEnclosingTag(document, cursorPos);

  if (!enclosingTag) {
    vscode.window.showInformationMessage("No enclosing tag found at the cursor position.");
    return;
  }

  const pairedTag = findPairedTag(document, enclosingTag);

  if (!pairedTag) {
    vscode.window.showInformationMessage("No matching pair found for the current tag.");
    return;
  }

  const newPosition = pairedTag.tagRange.start;
  editor.selection = new vscode.Selection(newPosition, newPosition);

  editor.revealRange(new vscode.Range(newPosition, newPosition));
}
