import * as vscode from "vscode";

type SwapRange = {
  startOffset: number;
  endOffset: number;
};

export type SiblingSwapOperation = {
  replaceRange: vscode.Range;
  replacementText: string;
  selectionOffset: number;
};

function clampOffset(offset: number, startOffset: number, endOffset: number): number {
  return Math.min(Math.max(offset, startOffset), endOffset);
}

export function buildSiblingSwapOperation(
  document: vscode.TextDocument,
  currentRange: SwapRange,
  targetRange: SwapRange,
  currentOffset: number
): SiblingSwapOperation | null {
  const currentIsFirst = currentRange.startOffset <= targetRange.startOffset;
  const firstRange = currentIsFirst ? currentRange : targetRange;
  const secondRange = currentIsFirst ? targetRange : currentRange;

  if (firstRange.endOffset > secondRange.startOffset) {
    return null;
  }

  const documentText = document.getText();
  const firstText = documentText.slice(firstRange.startOffset, firstRange.endOffset);
  const gapText = documentText.slice(firstRange.endOffset, secondRange.startOffset);
  const secondText = documentText.slice(secondRange.startOffset, secondRange.endOffset);
  const relativeCurrentOffset =
    clampOffset(currentOffset, currentRange.startOffset, currentRange.endOffset) -
    currentRange.startOffset;

  const selectionOffset = currentIsFirst
    ? firstRange.startOffset + secondText.length + gapText.length + relativeCurrentOffset
    : firstRange.startOffset + relativeCurrentOffset;

  return {
    replaceRange: new vscode.Range(
      document.positionAt(firstRange.startOffset),
      document.positionAt(secondRange.endOffset)
    ),
    replacementText: `${secondText}${gapText}${firstText}`,
    selectionOffset,
  };
}
