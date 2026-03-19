import * as vscode from "vscode";

import {
  findChildSymbolPositions,
  findParentSymbolPositions,
  findSiblingSymbolPositions,
} from "../utils/documentSymbolUtils";

type Direction = "next" | "previous";

export async function jumpToNextSiblingSymbol(): Promise<void> {
  await jumpToSymbol({
    kind: "sibling",
    direction: "next",
    emptyMessage: "No navigable document symbols found.",
    missingMessage: "No next sibling symbol found.",
  });
}

export async function jumpToPreviousSiblingSymbol(): Promise<void> {
  await jumpToSymbol({
    kind: "sibling",
    direction: "previous",
    emptyMessage: "No navigable document symbols found.",
    missingMessage: "No previous sibling symbol found.",
  });
}

export async function jumpToParentSymbol(): Promise<void> {
  await jumpToSymbol({
    kind: "parent",
  });
}

export async function jumpToChildSymbol(): Promise<void> {
  await jumpToSymbol({
    kind: "child",
  });
}

type SymbolJumpRequest =
  | {
      kind: "sibling";
      direction: Direction;
      emptyMessage: string;
      missingMessage: string;
    }
  | {
      kind: "parent" | "child";
    };

async function jumpToSymbol(request: SymbolJumpRequest): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const result =
    request.kind === "sibling"
      ? await findSiblingSymbolPositions(editor.document, editor.selections, request.direction)
      : request.kind === "parent"
      ? await findParentSymbolPositions(editor.document, editor.selections)
      : await findChildSymbolPositions(editor.document, editor.selections);
  const { hasSymbols, positions } = result;

  if (!hasSymbols) {
    if (request.kind === "sibling") {
      vscode.window.showInformationMessage(request.emptyMessage);
    }
    return;
  }

  let moved = false;
  const newSelections = editor.selections.map((selection, index) => {
    const position = positions[index];
    if (!position) {
      return selection;
    }

    moved = true;
    return new vscode.Selection(position, position);
  });

  if (!moved) {
    if (request.kind === "sibling") {
      vscode.window.showInformationMessage(request.missingMessage);
    }
    return;
  }

  editor.selections = newSelections;
  editor.revealRange(new vscode.Range(newSelections[0].active, newSelections[0].active));
}
