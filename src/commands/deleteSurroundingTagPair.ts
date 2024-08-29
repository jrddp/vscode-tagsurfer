import * as vscode from "vscode";
import { findPairedTag, deleteTag, getSurroundingTag } from "../utils/tagUtils";

export async function deleteSurroundingTagPair(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const selections = editor.selections;

  // Collect all the tags to delete
  const tagsToDelete: {
    first: ReturnType<typeof getSurroundingTag>;
    second: ReturnType<typeof findPairedTag>;
  }[] = [];

  selections.forEach(selection => {
    const firstTag = getSurroundingTag(document, selection.active);
    if (!firstTag) {
      vscode.window.showInformationMessage("No surrounding tag found for one or more selections.");
      return;
    }

    const pairedTag = firstTag.tagType === "selfClosing" ? null : findPairedTag(document, firstTag);
    if (!pairedTag && firstTag.tagType !== "selfClosing") {
      vscode.window.showInformationMessage("No matching pair found for one or more tags.");
      return;
    }

    tagsToDelete.push({ first: firstTag, second: pairedTag });
  });

  // Sort tags to delete in reverse order to avoid position shifts
  tagsToDelete.sort((a, b) => {
    if (!a.first || !b.first) {return 0;} // Handle null cases
    const posA = a.second
      ? Math.max(a.first.tagRange.end.line, a.second.tagRange.end.line)
      : a.first.tagRange.end.line;
    const posB = b.second
      ? Math.max(b.first.tagRange.end.line, b.second.tagRange.end.line)
      : b.first.tagRange.end.line;
    return posB - posA;
  });

  // Delete all collected tags in a single edit operation
  await editor.edit(
    editBuilder => {
      tagsToDelete.forEach(({ first, second }) => {
        if (first) {
          deleteTag(editor, first, editBuilder);
        }
        if (second) {
          deleteTag(editor, second, editBuilder);
        }
      });
    },
    { undoStopBefore: false, undoStopAfter: true }
  );

  // Update selections to the start of where the first tag was
  editor.selections = tagsToDelete.map(({ first }) => {
    if (first) {
      const pos = first.tagRange.start;
      return new vscode.Selection(pos, pos);
    }
    // If for some reason first is null, return the original selection
    return editor.selection;
  });
}
