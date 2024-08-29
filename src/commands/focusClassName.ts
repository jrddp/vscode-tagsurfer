import * as vscode from "vscode";
import { getSurroundingTag, findClassNamePos, findPairedTag } from "../utils/tagUtils";
import { getFileType } from "../utils/fileUtils";

export async function focusClassName(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const fileType = getFileType(document);

  if (fileType === "other") {
    console.error("TagSurfer: Focus className - Unsupported file type");
    return;
  }

  let editsToApply: { position: vscode.Position; text: string }[] = [];
  let newSelections: vscode.Selection[] = [];

  editor.selections.forEach(selection => {
    const cursorPos = selection.active;

    let surroundingTag = getSurroundingTag(document, cursorPos);
    if (surroundingTag?.tagType === "closing") {
      surroundingTag = findPairedTag(document, surroundingTag);
    }
    if (!surroundingTag) {
      vscode.window.showInformationMessage("No surrounding tag found.");
      newSelections.push(selection); // Keep original selection if no tag found
      return;
    }

    const classNamePos = findClassNamePos(document, surroundingTag);
    let newPosition = classNamePos.position;

    if (classNamePos.positionType === "endOfName") {
      const addString = fileType === "html" ? ' class=""' : ' className=""';
      editsToApply.push({ position: newPosition, text: addString });
      newPosition = newPosition.translate(0, addString.length - 1);
    }

    newSelections.push(new vscode.Selection(newPosition, newPosition));
  });

  // Apply all edits in a single edit operation
  if (editsToApply.length > 0) {
    await editor.edit(editBuilder => {
      editsToApply.forEach(edit => {
        editBuilder.insert(edit.position, edit.text);
      });
    });
  }

  editor.selections = newSelections;

  // Reveal the primary selection (first cursor)
  if (newSelections.length > 0) {
    const primarySelection = newSelections[0];
    editor.revealRange(new vscode.Range(primarySelection.start, primarySelection.end));
  }
}
