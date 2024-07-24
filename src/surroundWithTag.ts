import * as vscode from "vscode";
import { getClosestSurroundingTag, getSelectionType } from "./utils/selectionUtils";
import { wrapContent } from "./utils/tagUtils";

export async function surroundWithTag() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const selection = editor.selection;

  let tagName = await vscode.window.showInputBox({
    prompt: "Enter tag name",
    placeHolder: "div",
  });

  if (!tagName) {
    tagName = "div"; // Default to div if no input
  }

  editor.edit(editBuilder => {
    const selectionType = getSelectionType(selection, document);
    if (selectionType === "none") {
      // No selection, surround the closest tag
      const closestTag = getClosestSurroundingTag(selection.active, document);
      if (closestTag) {
        const tagContent = document.getText(closestTag);
        const newContent = wrapContent(editor, tagName, tagContent, true);
        editBuilder.replace(closestTag, newContent);
      } else {
        vscode.window.showInformationMessage("No surrounding tag found");
      }
    } else {
      const selectionRange = new vscode.Range(selection.start, selection.end);
      const selectedText = document.getText(selectionRange);

      switch (selectionType) {
        case "inline":
          const inlineResult = wrapContent(editor, tagName, selectedText, true);
          editBuilder.replace(selectionRange, inlineResult);
          break;
        case "multiLine":
        case "fullLine":
          const blockResult = wrapContent(editor, tagName, selectedText, false);
          editBuilder.replace(selectionRange, blockResult);
          break;
      }
    }
  });

  // Move cursor inside the tag for easy renaming
  const newPosition = new vscode.Position(
    editor.selection.start.line,
    editor.selection.start.character + tagName.length + 1
  );
  editor.selection = new vscode.Selection(newPosition, newPosition);
}
