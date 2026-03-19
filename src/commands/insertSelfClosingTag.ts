import * as vscode from "vscode";
import { getSetting } from "../config";

export async function insertSelfClosingTag(editor: vscode.TextEditor): Promise<void> {
  const defaultTagName = getSetting("defaultSelfClosingTag");
  const autoRename = getSetting("autoRename");
  const document = editor.document;
  const insertText = `<${defaultTagName} />`;
  const insertPlans = editor.selections.map((selection, index) => ({
    index,
    anchorOffset: document.offsetAt(selection.active),
    insertText,
    cursorOffset: 1,
  }));

  await editor.edit(editBuilder => {
    insertPlans.forEach(plan => {
      editBuilder.insert(document.positionAt(plan.anchorOffset), plan.insertText);
    });
  });

  const newSelections: vscode.Selection[] = new Array(insertPlans.length);
  let delta = 0;

  const orderedPlans = [...insertPlans].sort((a, b) =>
    a.anchorOffset === b.anchorOffset ? a.index - b.index : a.anchorOffset - b.anchorOffset
  );

  for (const plan of orderedPlans) {
    const newPosition = editor.document.positionAt(plan.anchorOffset + delta + plan.cursorOffset);
    newSelections[plan.index] = new vscode.Selection(newPosition, newPosition);
    delta += plan.insertText.length;
  }

  editor.selections = newSelections;

  if (autoRename) {
    await vscode.commands.executeCommand("editor.action.rename");
  }
}
