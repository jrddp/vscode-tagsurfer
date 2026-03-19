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

  const selectionPlans: {
    index: number;
    anchorOffset: number;
    localOffset: number;
    insertText: string | null;
  }[] = [];
  let shouldEnterVimInsertMode = false;

  editor.selections.forEach((selection, index) => {
    const cursorPos = selection.active;

    let surroundingTag = getSurroundingTag(document, cursorPos);
    if (surroundingTag?.tagType === "closing") {
      surroundingTag = findPairedTag(document, surroundingTag);
    }
    if (!surroundingTag) {
      vscode.window.showInformationMessage("No surrounding tag found.");
      selectionPlans.push({
        index,
        anchorOffset: document.offsetAt(selection.active),
        localOffset: 0,
        insertText: null,
      });
      return;
    }

    const classNamePos = findClassNamePos(document, surroundingTag);
    const anchorOffset = document.offsetAt(classNamePos.position);

    if (classNamePos.positionType === "endOfName") {
      const addString = fileType === "jsx_tsx" ? ' className=""' : ' class=""';
      shouldEnterVimInsertMode = true;
      selectionPlans.push({
        index,
        anchorOffset,
        localOffset: addString.length - 1,
        insertText: addString,
      });
      return;
    }

    shouldEnterVimInsertMode = true;
    selectionPlans.push({
      index,
      anchorOffset,
      localOffset: 0,
      insertText: null,
    });
  });

  // Apply all edits in a single edit operation
  if (selectionPlans.some(plan => plan.insertText !== null)) {
    await editor.edit(
      editBuilder => {
        selectionPlans.forEach(plan => {
          if (plan.insertText) {
            editBuilder.insert(document.positionAt(plan.anchorOffset), plan.insertText);
          }
        });
      },
      { undoStopBefore: true, undoStopAfter: true }
    );
  }

  const newSelections: vscode.Selection[] = new Array(selectionPlans.length);
  let delta = 0;

  const orderedPlans = [...selectionPlans].sort((a, b) =>
    a.anchorOffset === b.anchorOffset ? a.index - b.index : a.anchorOffset - b.anchorOffset
  );

  for (const plan of orderedPlans) {
    const newPosition = editor.document.positionAt(plan.anchorOffset + delta + plan.localOffset);
    newSelections[plan.index] = new vscode.Selection(newPosition, newPosition);
    if (plan.insertText) {
      delta += plan.insertText.length;
    }
  }

  const applySelections = () => {
    editor.selections = newSelections;

    if (newSelections.length > 0) {
      const primarySelection = newSelections[0];
      editor.revealRange(new vscode.Range(primarySelection.start, primarySelection.end));
    }
  };

  applySelections();

  if (shouldEnterVimInsertMode) {
    try {
      await vscode.commands.executeCommand("extension.vim_insert");
    } catch (error) {
      // Continue anyways if Vim not installed or insert mode request fails
    }

    // Vim can overwrite the selection when entering insert mode, so reapply our target
    // selection on the next tick after requesting insert mode.
    setImmediate(() => {
      applySelections();
    });
  }
}
