import { Position, Range, Selection, TextDocument, TextEditor } from "vscode";

type SelectionType = "none" | "inline" | "fullLine" | "multiFullLine" | "multiInline";

export function isBlock(type: SelectionType): boolean {
  return type === "fullLine" || type === "multiFullLine";
}

export function getSelectionType(selection: Selection, document: TextDocument): SelectionType {
  if (selection.isEmpty) {
    return "none";
  }
  const start = selection.start;
  const end = selection.end;
  if (start.character === 0 && end.character === document.lineAt(end.line).text.length) {
    return start.line === end.line ? "fullLine" : "multiFullLine";
  }
  return start.line === end.line ? "inline" : "multiInline";
}

export function getClosestSurroundingTag(position: Position, document: TextDocument): Range | null {
  // This is a simplified implementation. A more robust version would use a parser.
  const line = document.lineAt(position.line).text;
  let startTag = line.lastIndexOf("<", position.character);
  let endTag = line.indexOf(">", position.character);

  if (startTag === -1 || endTag === -1) {
    return null;
  }

  return new Range(new Position(position.line, startTag), new Position(position.line, endTag + 1));
}

export function updateSelection(
  editor: TextEditor,
  oldSelection: Selection,
  newPosition: Position
): void {
  const selectionType = getSelectionType(oldSelection, editor.document);
  const oldStart = oldSelection.start;
  const oldEnd = oldSelection.end;

  switch (selectionType) {
    case "none":
      editor.selection = new Selection(newPosition, newPosition);
      break;
    case "inline":
    case "multiInline":
      if (oldSelection.isReversed) {
        if (newPosition.isBefore(oldEnd)) {
          editor.selection = new Selection(oldEnd, newPosition);
        } else {
          editor.selection = new Selection(oldStart.translate(0, 1), newPosition.translate(0, 1));
        }
      } else {
        if (newPosition.isAfter(oldStart)) {
          editor.selection = new Selection(oldStart, newPosition.translate(0, 1));
        } else {
          editor.selection = new Selection(oldStart.translate(0, 1), newPosition);
        }
      }
      break;

    case "fullLine":
    case "multiFullLine":
      const newLine = editor.document.lineAt(newPosition.line);

      if (newLine.lineNumber < oldStart.line) {
        const newStart = new Position(newLine.lineNumber, 0);
        editor.selection = new Selection(oldEnd, newStart);
      } else if (oldSelection.isReversed) {
        const newStart = new Position(newLine.lineNumber, 0);
        editor.selection = new Selection(oldEnd, newStart);
      } else {
        const newEnd = new Position(newLine.lineNumber, newLine.text.length);
        editor.selection = new Selection(oldStart, newEnd);
      }
      break;
  }

  editor.revealRange(new Range(newPosition, newPosition));
}

// adds range in order while also merging with existing ranges
// assumes ascending order of given ranges
export function addToRanges(ranges: Range[], newRange: Range): void {
  let intersects = false;
  for (let i = 0; i < ranges.length; i++) {
    if (newRange.intersection(ranges[i])) {
      ranges[i] = ranges[i].union(newRange);
      // also check intersection of next range in case it intersects with both
      if (i < ranges.length - 1 && ranges[i].intersection(ranges[i + 1])) {
        ranges[i] = ranges[i].union(ranges[i + 1]);
        ranges.splice(i + 1, 1);
      }
      return;
    }
  }

  // find index to insert new range in order
  let insertIndex = ranges.findIndex(range => range.start.isAfterOrEqual(newRange.start));
  if (insertIndex === -1) {
    insertIndex = ranges.length;
  }

  // Insert the new range
  ranges.splice(insertIndex, 0, newRange);
}
