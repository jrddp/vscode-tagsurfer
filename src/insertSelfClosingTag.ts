import * as vscode from "vscode";
import { getSetting } from "./config";

export function insertSelfClosingTag(editor: vscode.TextEditor): void {
  const defaultTagName = getSetting("defaultSelfClosingTag");
  const autoRename = getSetting("autoRename");

  editor
    .edit(editBuilder => {
      editor.selections.forEach(selection => {
        const position = selection.active;
        editBuilder.insert(position, `<${defaultTagName} />`);
      });
    })
    .then(() => {
      // move the cursor to the tag name
      const newSelections = editor.selections.map(selection => {
        // from <div />$ to <di$v />
        const newPosition = selection.active.translate(0, -4);
        return new vscode.Selection(newPosition, newPosition);
      });
      editor.selections = newSelections;
      if (autoRename) {
        setImmediate(() => vscode.commands.executeCommand("editor.action.rename"));
      }
    });
}
