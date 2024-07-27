import * as vscode from "vscode";
import { getSurroundingTag, findClassNamePos, findPairedTag } from "../utils/tagUtils"; // Adjust the import path as needed

export async function focusClassName(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const cursorPos = editor.selection.active;

  let surroundingTag = getSurroundingTag(document, cursorPos);
  if (surroundingTag?.tagType === "closing") {
    surroundingTag = findPairedTag(document, surroundingTag);
  }
  if (!surroundingTag) {
    vscode.window.showInformationMessage("No surrounding tag found.");
    return;
  }

  const classNamePos = findClassNamePos(document, surroundingTag);
  let newPosition = classNamePos.position;

  if (classNamePos.positionType === "endOfName") {
    editor.edit(editBuilder => {
      const addString = ' className=""';
      editBuilder.insert(newPosition, addString);
      newPosition = newPosition.translate(0, addString.length - 1);
    });
  }

  await vscode.commands.executeCommand("revealLine", { lineNumber: newPosition.line });
  editor.selection = new vscode.Selection(newPosition, newPosition);

  editor.revealRange(new vscode.Range(newPosition, newPosition));
}
