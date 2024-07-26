import * as vscode from "vscode";
import { findPairedTag, deleteTag, getSurroundingTag } from "../utils/tagUtils";

export async function deleteSurroundingTagPair(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const selection = editor.selection;

  const firstTag = getSurroundingTag(document, selection.active);
  if (!firstTag) {
    vscode.window.showInformationMessage("No surrounding tag found.");
    return;
  }

  const pairedTag = firstTag.tagType === "selfClosing" ? null : findPairedTag(document, firstTag);
  if (!pairedTag && firstTag.tagType !== "selfClosing") {
    vscode.window.showInformationMessage("No matching pair found for the current tag.");
    return;
  }

  await editor.edit(
    editBuilder => {
      deleteTag(editor, firstTag, editBuilder);
      if (pairedTag) {
        deleteTag(editor, pairedTag, editBuilder);
      }
    },
    { undoStopBefore: false, undoStopAfter: true }
  );
}
