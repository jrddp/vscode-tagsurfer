import * as vscode from "vscode";
import { jumpToMatchingPair } from "./commands/jumpToMatchingPair";
import { surroundWithTag } from "./commands/surroundWithTag";
import { insertSelfClosingTag } from "./commands/insertSelfClosingTag";
import { deleteSurroundingTagPair } from "./commands/deleteSurroundingTagPair";
import { deleteSelectionWithMatchingPairs } from "./commands/deleteSelectionWithPairs";
import { focusClassName } from "./commands/focusClassName";
import {
  jumpToChildSymbol,
  jumpToNextSiblingSymbol,
  jumpToParentSymbol,
  jumpToPreviousSiblingSymbol,
} from "./commands/jumpToSiblingSymbol";
import { swapWithNextSibling, swapWithPreviousSibling } from "./commands/swapWithSibling";

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
  let nextSiblingDisposable = vscode.commands.registerCommand(
    "tagSurfer.jumpToNextSiblingSymbol",
    jumpToNextSiblingSymbol
  );
  let previousSiblingDisposable = vscode.commands.registerCommand(
    "tagSurfer.jumpToPreviousSiblingSymbol",
    jumpToPreviousSiblingSymbol
  );
  let parentSymbolDisposable = vscode.commands.registerCommand(
    "tagSurfer.jumpToParentSymbol",
    jumpToParentSymbol
  );
  let childSymbolDisposable = vscode.commands.registerCommand(
    "tagSurfer.jumpToChildSymbol",
    jumpToChildSymbol
  );
  let swapNextSiblingDisposable = vscode.commands.registerCommand(
    "tagSurfer.swapWithNextSiblingSymbol",
    swapWithNextSibling
  );
  let swapPreviousSiblingDisposable = vscode.commands.registerCommand(
    "tagSurfer.swapWithPreviousSiblingSymbol",
    swapWithPreviousSibling
  );

  context.subscriptions.push(
    surroundDisposable,
    jumpDisposable,
    selfClosingDisposable,
    deleteSurroundingDisposable,
    deleteWithPairsDisposable,
    findClassNameDisposable,
    nextSiblingDisposable,
    previousSiblingDisposable,
    parentSymbolDisposable,
    childSymbolDisposable,
    swapNextSiblingDisposable,
    swapPreviousSiblingDisposable
  );
}

export function deactivate() {}
