import * as vscode from "vscode";
import { findPairedTag, getSurroundingTag, Tag } from "../utils/tagUtils";

type EditOperation = {
  startOffset: number;
  endOffset: number;
  replacementText: string;
};

function getTagEditOperations(document: vscode.TextDocument, tag: Tag): EditOperation[] {
  const operations: EditOperation[] = [];

  const addOperation = (range: vscode.Range, replacementText = "") => {
    operations.push({
      startOffset: document.offsetAt(range.start),
      endOffset: document.offsetAt(range.end),
      replacementText,
    });
  };

  const deleteStartLine =
    document.lineAt(tag.tagRange.start.line).text.slice(0, tag.tagRange.start.character).trim() ===
    "";
  const deleteEndLine =
    document.lineAt(tag.tagRange.end.line).text.slice(tag.tagRange.end.character).trim() === "";

  const startLine = tag.tagRange.start.line;
  const endLine = tag.tagRange.end.line;

  if (startLine === endLine) {
    if (deleteStartLine && deleteEndLine) {
      addOperation(new vscode.Range(startLine, 0, startLine + 1, 0));
    } else {
      addOperation(tag.tagRange);
    }
    return operations;
  }

  if (deleteStartLine) {
    addOperation(new vscode.Range(startLine, 0, startLine + 1, 0));
  } else {
    addOperation(
      new vscode.Range(
        tag.tagRange.start.line,
        tag.tagRange.start.character,
        tag.tagRange.start.line,
        document.lineAt(tag.tagRange.start.line).text.length
      )
    );
  }

  if (deleteEndLine) {
    addOperation(new vscode.Range(endLine, 0, endLine + 1, 0));
  } else {
    const lineText = document.lineAt(tag.tagRange.end.line).text;
    const leadingWhitespaceLength = lineText.match(/^\s*/)?.[0].length ?? 0;
    addOperation(
      new vscode.Range(tag.tagRange.end.line, 0, tag.tagRange.end.line, tag.tagRange.end.character),
      lineText.slice(0, leadingWhitespaceLength)
    );
  }

  for (let line = startLine + 1; line < endLine; line++) {
    addOperation(new vscode.Range(line, 0, line + 1, 0));
  }

  return operations;
}

function transformOffset(offset: number, operations: EditOperation[]): number {
  let delta = 0;

  for (const operation of operations) {
    const replacedLength = operation.endOffset - operation.startOffset;
    const deltaForOperation = operation.replacementText.length - replacedLength;

    if (operation.endOffset <= offset) {
      delta += deltaForOperation;
      continue;
    }

    if (operation.startOffset <= offset && offset <= operation.endOffset) {
      const preservedOffset = Math.min(offset - operation.startOffset, operation.replacementText.length);
      return operation.startOffset + delta + preservedOffset;
    }
  }

  return offset + delta;
}

export async function deleteSurroundingTagPair(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const selections = editor.selections;

  const deletePlans: {
    index: number;
    anchorOffset: number;
    operations: EditOperation[];
  }[] = [];

  selections.forEach((selection, index) => {
    const firstTag = getSurroundingTag(document, selection.active);
    if (!firstTag) {
      vscode.window.showInformationMessage("No surrounding tag found for one or more selections.");
      return;
    }

    const pairedTag = firstTag.tagType === "selfClosing" ? null : findPairedTag(document, firstTag);
    if (!pairedTag && firstTag.tagType !== "selfClosing") {
      vscode.window.showInformationMessage("No matching pair found for one or more tags.");
      return;
    }

    const anchorTag =
      firstTag.tagType === "closing" && pairedTag ? pairedTag : firstTag;
    const operations = [
      ...getTagEditOperations(document, firstTag),
      ...(pairedTag ? getTagEditOperations(document, pairedTag) : []),
    ];

    deletePlans.push({
      index,
      anchorOffset: document.offsetAt(anchorTag.tagRange.start),
      operations,
    });
  });

  const operationsByKey = new Map<string, EditOperation>();
  deletePlans.forEach(plan => {
    plan.operations.forEach(operation => {
      const key = `${operation.startOffset}:${operation.endOffset}:${operation.replacementText}`;
      if (!operationsByKey.has(key)) {
        operationsByKey.set(key, operation);
      }
    });
  });
  const operations = [...operationsByKey.values()].sort((a, b) =>
    a.startOffset === b.startOffset ? a.endOffset - b.endOffset : a.startOffset - b.startOffset
  );

  await editor.edit(
    editBuilder => {
      operations.forEach(operation => {
        const range = new vscode.Range(
          document.positionAt(operation.startOffset),
          document.positionAt(operation.endOffset)
        );
        if (operation.replacementText === "") {
          editBuilder.delete(range);
        } else {
          editBuilder.replace(range, operation.replacementText);
        }
      });
    },
    { undoStopBefore: true, undoStopAfter: true }
  );

  const newSelections: vscode.Selection[] = new Array(deletePlans.length);

  deletePlans.forEach(plan => {
    const newPosition = editor.document.positionAt(transformOffset(plan.anchorOffset, operations));
    newSelections[plan.index] = new vscode.Selection(newPosition, newPosition);
  });

  editor.selections = newSelections;
}
