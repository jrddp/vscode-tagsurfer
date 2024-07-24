import * as vscode from "vscode";
import { surroundWithTag } from "./surroundWithTag";
import { jumpToMatchingPair } from "./jumpToMatchingPair";

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
