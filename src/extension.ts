import * as vscode from "vscode";
import { jumpToMatchingPair } from "./jumpToMatchingPair";
import { surroundWithTag } from "./surroundWithTag";
import { insertSelfClosingTag } from "./insertSelfClosingTag";
import { deleteSurroundingTagPair } from "./deleteSurroundingTagPair";

export function activate(context: vscode.ExtensionContext) {
  let surroundDisposable = vscode.commands.registerCommand(
    "tagSurfer.surroundWithTag",
    surroundWithTag
  );
  let jumpDisposable = vscode.commands.registerCommand(
    "tagSurfer.jumpToMatchingPair",
    jumpToMatchingPair
  );
  let selfClosingDisposable = vscode.commands.registerTextEditorCommand(
    "tagSurfer.insertSelfClosingTag",
    insertSelfClosingTag
  );
  let deleteDisposable = vscode.commands.registerTextEditorCommand(
    "tagSurfer.deleteSurroundingTagPair",
    deleteSurroundingTagPair
  );

  context.subscriptions.push(
    surroundDisposable,
    jumpDisposable,
    selfClosingDisposable,
    deleteDisposable
  );
}

export function deactivate() {}
