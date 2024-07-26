import * as vscode from "vscode";
import { findPairedTag, getAllTagsInSelection } from "./utils/tagUtils";
import { findPairedBracketPos, getAllBracketsInSelection } from "./utils/bracketUtils";
import { Range, TextEditorDecorationType } from "vscode";

const pinkHighlight = vscode.window.createTextEditorDecorationType({
  backgroundColor: "#FEF08A",
  border: "1px solid #000000",
});

export function deleteSelectionWithMatchingPairs() {
  // output current selection start and end
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }
  let effectiveSelection: Range = editor.selection;

  // if the selection is empty, expand to include character under cursor
  if (effectiveSelection.isEmpty) {
    effectiveSelection = new Range(
      effectiveSelection.start,
      effectiveSelection.start.translate(0, 1)
    );
  }

  const tags = getAllTagsInSelection(editor.document, effectiveSelection);
  const bracketLocs = getAllBracketsInSelection(editor.document, effectiveSelection);

  const pairedTags = tags
    .map(tag => {
      return findPairedTag(editor.document, tag);
    })
    .filter(tag => tag !== null);

  const pairedBracketsPos = bracketLocs
    .map(bracketLoc => {
      return findPairedBracketPos(editor.document, bracketLoc);
    })
    .filter(bracketLoc => bracketLoc !== null);

  // map line numbers to selections on that line
  let pairRanges: Range[] = [];

  // reduce selections of pairs and brackets to minimal selections per lines
  for (const tag of pairedTags) {
    let intersects = false;
    for (let i = 0; i < pairRanges.length; i++) {
      // create a union if they are intersecting
      if (pairRanges[i].intersection(tag.tagRange)) {
        pairRanges[i] = pairRanges[i].union(tag.tagRange);
        intersects = true;
        break;
      }
    }
    if (!intersects) {
      // add as new range otherwise
      pairRanges.push(tag.tagRange);
    }
  }
  for (const bracketPos of pairedBracketsPos) {
    const bracketRange = new Range(bracketPos, bracketPos.translate(0, 1));
    let intersects = false;
    for (let i = 0; i < pairRanges.length; i++) {
      // create a union if they are intersecting
      if (pairRanges[i].intersection(bracketRange)) {
        pairRanges[i] = pairRanges[i].union(bracketRange);
        intersects = true;
        break;
      }
    }
    if (!intersects) {
      // add as new range otherwise
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

  // delete those son of a guns!!
  editor.edit(
    editBuiler => {
      editBuiler.delete(effectiveSelection);
      for (const range of pairRanges) {
        editBuiler.delete(range);
      }
    },
    { undoStopBefore: false, undoStopAfter: true }
  );

  // editor.setDecorations(pinkHighlight, pairRanges);

  // setTimeout(() => {
  //   editor.setDecorations(pinkHighlight, []);
  //   pinkHighlight.dispose();
  // }, 3000);
}
