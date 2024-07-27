import * as vscode from "vscode";
import { jumpToMatchingPair } from "./commands/jumpToMatchingPair";
import { surroundWithTag } from "./commands/surroundWithTag";
import { insertSelfClosingTag } from "./commands/insertSelfClosingTag";
import { deleteSurroundingTagPair } from "./commands/deleteSurroundingTagPair";
import { deleteSelectionWithMatchingPairs } from "./commands/deleteSelectionWithPairs";
import { focusClassName } from "./commands/focusClassName";

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
  let findClassNameDisposable = vscode.commands.registerTextEditorCommand(
    "tagSurfer.focusClassName",
    focusClassName
  );

  context.subscriptions.push(
    surroundDisposable,
    jumpDisposable,
    selfClosingDisposable,
    deleteSurroundingDisposable,
    deleteWithPairsDisposable,
    findClassNameDisposable
  );
}

export function deactivate() {}
