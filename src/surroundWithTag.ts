import * as vscode from "vscode";
import { getSelectionType } from "./utils/selectionUtils";
import { wrapContent } from "./utils/tagUtils";
import { getSetting } from "./config";

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
  let selection = editor.selection;
  const startPos = selection.start;

  // adjust selections with trailing cursor on next line (happens when selecting with mouse)
  if (selection.start.line !== selection.end.line && selection.end.character === 0) {
    // set to end of previous line
    const newEnd = new vscode.Position(
      selection.end.line - 1,
      document.lineAt(selection.end.line - 1).text.length
    );
    selection = new vscode.Selection(selection.start, newEnd);
  }

  const selectionType = getSelectionType(selection, document);

  const tagName = selectionType === "inline" ? inlineTag : blockTag;

  let newPosition: vscode.Position;
  await editor.edit(
    editBuilder => {
      const selectionRange = new vscode.Range(selection.start, selection.end);
      const selectedText = document.getText(selectionRange);

      switch (selectionType) {
        case "inline":
        case "multiInline":
          const inlineResult = wrapContent(editor, tagName, selectedText, true);
          editBuilder.replace(selectionRange, inlineResult);
          newPosition = new vscode.Position(startPos.line, startPos.character + 1);
          break;
        case "multiFullLine":
        case "fullLine":
          const blockResult = wrapContent(editor, tagName, selectedText, false);
          const lenFirstLine = blockResult.split("\n")[0].length;
          editBuilder.replace(selectionRange, blockResult);
          newPosition = new vscode.Position(startPos.line, lenFirstLine - tagName.length - 1);
          break;
        case "none":
          // No selection. Input tag at cursor.
          const newContent = wrapContent(editor, tagName, "", true);
          editBuilder.insert(selection.active, newContent);
          newPosition = new vscode.Position(startPos.line, startPos.character + tagName.length + 2);
          break;
      }
    },
    { undoStopBefore: false, undoStopAfter: true }
  );

  // Force exit from Vim visual mode to normal mode
  if (selectionType !== "none") {
    try {
      await vscode.commands.executeCommand("extension.vim_escape");
    } catch (error) {
      // Continue anyways if Vim not installed or escape fails
    }
  }

  // setImmediate ensures the edit has been applied before updating the selection
  setImmediate(() => {
    editor.selection = new vscode.Selection(newPosition, newPosition);
    if (autoRename) {
      setImmediate(() => vscode.commands.executeCommand("editor.action.rename"));
    }
  });
}
