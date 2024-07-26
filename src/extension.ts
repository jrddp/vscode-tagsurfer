import * as vscode from "vscode";
import { jumpToMatchingPair } from "./jumpToMatchingPair";
import { surroundWithTag } from "./surroundWithTag";
import { insertSelfClosingTag } from "./insertSelfClosingTag";
import { deleteSurroundingTagPair } from "./deleteSurroundingTagPair";
import { deleteSelectionWithMatchingPairs } from "./deleteSelectionWithPairs";

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
  let deleteSurroundingDisposable = vscode.commands.registerTextEditorCommand(
    "tagSurfer.deleteSurroundingTagPair",
    deleteSurroundingTagPair
  );
  let deleteWithPairsDisposable = vscode.commands.registerTextEditorCommand(
    "tagSurfer.deleteSelectionWithPairs",
    deleteSelectionWithMatchingPairs
  );

  context.subscriptions.push(
    surroundDisposable,
    jumpDisposable,
    selfClosingDisposable,
    deleteSurroundingDisposable,
    deleteWithPairsDisposable
  );
}

export function deactivate() {}
