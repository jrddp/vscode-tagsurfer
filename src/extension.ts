import * as vscode from "vscode";
import { jumpToMatchingPair } from "./jumpToMatchingPair";
import { surroundWithTag } from "./surroundWithTag";

export function activate(context: vscode.ExtensionContext) {
  let surroundDisposable = vscode.commands.registerCommand(
    "tagSurfer.surroundWithTag",
    surroundWithTag
  );
  let jumpDisposable = vscode.commands.registerCommand(
    "tagSurfer.jumpToMatchingPair",
    jumpToMatchingPair
  );

  context.subscriptions.push(surroundDisposable, jumpDisposable);
}

export function deactivate() {}
