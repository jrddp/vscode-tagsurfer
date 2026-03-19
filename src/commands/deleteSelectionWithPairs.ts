import * as vscode from "vscode";
import { Position, Range, Selection } from "vscode";

import { findPairedTag, getAllTagsInSelection, Tag } from "../utils/tagUtils";
import { findPairedBracketPos, getAllBracketsInSelection } from "../utils/bracketUtils";
import { applyLineDeletions, generateLineDeletions, LineDeletion } from "../utils/deletionUtils";
import { getSelectionType } from "../utils/selectionUtils";
import { EditOperation, getWrappedBlockDeleteOperation } from "../utils/tagDeletionUtils";

function tagKey(tag: Tag): string {
  return `${tag.tagType}:${tag.tagName}:${tag.tagRange.start.line}:${tag.tagRange.start.character}:${tag.tagRange.end.line}:${tag.tagRange.end.character}`;
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

export async function deleteSelectionWithMatchingPairs() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  let effectiveSelections: Range[] = editor.selections.map(selection => {
    // if the selection is empty, expand to include character under cursor
    if (selection.isEmpty) {
      return new Range(selection.start, selection.start.translate(0, 1));
    }
    return new Range(selection.start, selection.end);
  });

  let allLineDeletions: LineDeletion[] = [];
  let wrappedBlockOperations: EditOperation[] = [];
  const anchorOffsets: number[] = [];

  for (let i = 0; i < effectiveSelections.length; i++) {
    let effectiveSelection = effectiveSelections[i];
    const tags = getAllTagsInSelection(editor.document, effectiveSelection);
    const bracketLocs = getAllBracketsInSelection(editor.document, effectiveSelection);
    anchorOffsets[i] = editor.document.offsetAt(effectiveSelection.start);

    const pairedTagsByKey = new Map<string, Tag>();
    const wrappedBlockOpsByKey = new Map<string, EditOperation>();
    const wrappedTagKeys = new Set<string>();
    tags.forEach(tag => {
      const pairedTag = findPairedTag(editor.document, tag);
      if (!pairedTag) {
        return;
      }

      pairedTagsByKey.set(tagKey(tag), pairedTag);
      const openingTag = tag.tagType === "closing" ? pairedTag : tag;
      const closingTag = tag.tagType === "closing" ? tag : pairedTag;
      const wrappedBlockOperation = getWrappedBlockDeleteOperation(editor, openingTag, closingTag);
      if (!wrappedBlockOperation) {
        return;
      }

      const operationKey = `${wrappedBlockOperation.startOffset}:${wrappedBlockOperation.endOffset}`;
      wrappedBlockOpsByKey.set(operationKey, wrappedBlockOperation);
      wrappedTagKeys.add(tagKey(tag));
      wrappedTagKeys.add(tagKey(pairedTag));
    });

    const wrappedBlockOperationsForSelection = [...wrappedBlockOpsByKey.values()];
    if (wrappedBlockOperationsForSelection.length > 0) {
      wrappedBlockOperations = wrappedBlockOperations.concat(wrappedBlockOperationsForSelection);
      effectiveSelection = new Range(effectiveSelection.start, effectiveSelection.start);
      effectiveSelections[i] = effectiveSelection;
      continue;
    }

    const pairedTags = tags
      .filter(tag => !wrappedTagKeys.has(tagKey(tag)))
      .map(tag => pairedTagsByKey.get(tagKey(tag)))
      .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined && tag !== null);

    const pairedBracketsPos = bracketLocs
      .map(bracketLoc => findPairedBracketPos(editor.document, bracketLoc))
      .filter((bracketPos): bracketPos is NonNullable<typeof bracketPos> => bracketPos !== null);

    let pairRanges: Range[] = [];

    // reduce selections of pairs and brackets to minimal selections per lines
    for (const tag of pairedTags) {
      let intersects = false;
      for (let i = 0; i < pairRanges.length; i++) {
        if (pairRanges[i].intersection(tag.tagRange)) {
          pairRanges[i] = pairRanges[i].union(tag.tagRange);
          intersects = true;
          break;
        }
      }
      if (!intersects) {
        pairRanges.push(tag.tagRange);
      }
    }
    for (const bracketPos of pairedBracketsPos) {
      const bracketRange = new Range(bracketPos, bracketPos.translate(0, 1));
      let intersects = false;
      for (let i = 0; i < pairRanges.length; i++) {
        if (pairRanges[i].intersection(bracketRange)) {
          pairRanges[i] = pairRanges[i].union(bracketRange);
          intersects = true;
          break;
        }
      }
      if (!intersects) {
        pairRanges.push(bracketRange);
      }
    }

    // remove any pairs that are already selected
    // if they intersect, remove them and extend the original selection
    pairRanges = pairRanges.filter(range => {
      if (effectiveSelection.contains(range)) {
        return false;
      }
      if (effectiveSelection.intersection(range)) {
        effectiveSelection = effectiveSelection.union(range);
        return false;
      }
      return true;
    });

    // ensure deletion of full line for full line selections
    const selectionType = getSelectionType(
      new Selection(effectiveSelection.start, effectiveSelection.end),
      editor.document
    );
    if (selectionType === "multiFullLine" || selectionType === "fullLine") {
      effectiveSelection = new Range(
        effectiveSelection.start,
        new Position(effectiveSelection.end.line + 1, 0)
      );
    }

    const lineDeletions = generateLineDeletions(editor.document, pairRanges);

    allLineDeletions = allLineDeletions.concat(lineDeletions);

    effectiveSelections[i] = effectiveSelection;
  }

  const operationsByKey = new Map<string, EditOperation>();
  wrappedBlockOperations.forEach(operation => {
    const key = `${operation.startOffset}:${operation.endOffset}:${operation.replacementText}`;
    if (!operationsByKey.has(key)) {
      operationsByKey.set(key, operation);
    }
  });
  const orderedWrappedBlockOperations = [...operationsByKey.values()].sort((a, b) =>
    a.startOffset === b.startOffset ? a.endOffset - b.endOffset : a.startOffset - b.startOffset
  );

  // delete those son of a guns!!
  await editor.edit(
    editBuilder => {
      for (const operation of orderedWrappedBlockOperations) {
        editBuilder.replace(
          new Range(
            editor.document.positionAt(operation.startOffset),
            editor.document.positionAt(operation.endOffset)
          ),
          operation.replacementText
        );
      }
      for (const effectiveSelection of effectiveSelections) {
        if (!effectiveSelection.isEmpty) {
          editBuilder.delete(effectiveSelection);
        }
      }
      applyLineDeletions(editBuilder, allLineDeletions);
    },
    { undoStopBefore: true, undoStopAfter: true }
  );

  // Clear selections after deletion
  const newSelectionPosition = editor.document.positionAt(
    transformOffset(anchorOffsets[0], orderedWrappedBlockOperations)
  );
  editor.selections = [new Selection(newSelectionPosition, newSelectionPosition)];

  // return to normal mode if using Vscode Vim
  try {
    await vscode.commands.executeCommand("extension.vim_escape");
  } catch (error) {}
}
