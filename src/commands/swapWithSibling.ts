import * as vscode from "vscode";

import { findSiblingSwapOperation } from "../utils/documentSymbolUtils";

type Direction = "next" | "previous";

export async function swapWithNextSibling(): Promise<void> {
  await swapWithSibling("next");
}

export async function swapWithPreviousSibling(): Promise<void> {
  await swapWithSibling("previous");
}

async function swapWithSibling(direction: Direction): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  if (editor.selections.length !== 1) {
    vscode.window.showInformationMessage("Swap with sibling currently supports a single cursor.");
    return;
  }

  const result = await findSiblingSwapOperation(editor.document, editor.selection, direction);
  if (!result.hasSymbols) {
    vscode.window.showInformationMessage("No navigable document symbols found.");
    return;
  }

  if (!result.operation) {
    return;
  }

  const operation = result.operation;

  await editor.edit(
    editBuilder => {
      editBuilder.replace(operation.replaceRange, operation.replacementText);
    },
    { undoStopBefore: true, undoStopAfter: true }
  );

  const newPosition = editor.document.positionAt(operation.selectionOffset);
  editor.selection = new vscode.Selection(newPosition, newPosition);
  editor.revealRange(new vscode.Range(newPosition, newPosition));
}
