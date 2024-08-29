import * as vscode from "vscode";
import { getSelectionType } from "../utils/selectionUtils";
import { wrapContent } from "../utils/tagUtils";
import { getSetting } from "../config";

export async function surroundWithTag() {
  const blockTag = getSetting("defaultBlockTag");
  const inlineTag = getSetting("defaultInlineTag");
  const autoRename = getSetting("autoRename");

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const selections = editor.selections;

  let newSelections: vscode.Selection[] = [];

  await editor.edit(
    editBuilder => {
      selections.forEach((selection, index) => {
        let adjustedSelection = selection;
        const startPos = selection.start;

        // adjust selections with trailing cursor on next line (happens when selecting with mouse)
        if (selection.start.line !== selection.end.line && selection.end.character === 0) {
          // set to end of previous line
          const newEnd = new vscode.Position(
            selection.end.line - 1,
            document.lineAt(selection.end.line - 1).text.length
          );
          adjustedSelection = new vscode.Selection(selection.start, newEnd);
        }

        const selectionType = getSelectionType(adjustedSelection, document);
        const tagName = selectionType === "inline" ? inlineTag : blockTag;
        const selectionRange = new vscode.Range(adjustedSelection.start, adjustedSelection.end);
        const selectedText = document.getText(selectionRange);

        let newContent: string;
        let newPosition: vscode.Position;

        switch (selectionType) {
          case "inline":
          case "multiInline":
            newContent = wrapContent(editor, tagName, selectedText, true);
            newPosition = new vscode.Position(startPos.line, startPos.character + 1);
            break;
          case "multiFullLine":
          case "fullLine":
            newContent = wrapContent(editor, tagName, selectedText, false);
            const lenFirstLine = newContent.split("\n")[0].length;
            newPosition = new vscode.Position(startPos.line, lenFirstLine - tagName.length - 1);
            break;
          case "none":
            newContent = wrapContent(editor, tagName, "", true);
            newPosition = new vscode.Position(
              startPos.line,
              startPos.character + tagName.length + 2
            );
            break;
        }

        editBuilder.replace(selectionRange, newContent);

        // Store the new selection
        newSelections.push(new vscode.Selection(newPosition, newPosition));
      });
    },
    { undoStopBefore: false, undoStopAfter: true }
  );

  // Set all new selections at once
  editor.selections = newSelections;

  // Force exit from Vim visual mode to normal mode
  if (selections.some(selection => !selection.isEmpty)) {
    try {
      await vscode.commands.executeCommand("extension.vim_escape");
    } catch (error) {
      // Continue anyways if Vim not installed or escape fails
    }
  }

  // If autoRename is enabled, trigger rename action
  if (autoRename) {
    vscode.commands.executeCommand("editor.action.rename");
  }
}
