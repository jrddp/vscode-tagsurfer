import * as vscode from "vscode";
import { Position, Range, Selection } from "vscode";

import { findPairedTag, getAllTagsInSelection } from "../utils/tagUtils";
import { findPairedBracketPos, getAllBracketsInSelection } from "../utils/bracketUtils";
import { applyLineDeletions, generateLineDeletions, LineDeletion } from "../utils/deletionUtils";
import { getSelectionType } from "../utils/selectionUtils";

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

  let allPairRanges: Range[] = [];
  let allLineDeletions: LineDeletion[] = [];

  for (let effectiveSelection of effectiveSelections) {
    const tags = getAllTagsInSelection(editor.document, effectiveSelection);
    const bracketLocs = getAllBracketsInSelection(editor.document, effectiveSelection);

    const pairedTags = tags
      .map(tag => findPairedTag(editor.document, tag))
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null);

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

    allPairRanges = allPairRanges.concat(pairRanges);
    allLineDeletions = allLineDeletions.concat(lineDeletions);

    effectiveSelections[effectiveSelections.indexOf(effectiveSelection)] = effectiveSelection;
  }

  // delete those son of a guns!!
  await editor.edit(
    editBuilder => {
      for (const effectiveSelection of effectiveSelections) {
        editBuilder.delete(effectiveSelection);
      }
      applyLineDeletions(editBuilder, allLineDeletions);
    },
    { undoStopBefore: false, undoStopAfter: true }
  );

  // Clear selections after deletion
  editor.selections = [new Selection(effectiveSelections[0].start, effectiveSelections[0].start)];

  // return to normal mode if using Vscode Vim
  try {
    await vscode.commands.executeCommand("extension.vim_escape");
  } catch (error) {}
}
