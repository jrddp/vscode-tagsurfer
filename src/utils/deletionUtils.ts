import { Range, Position, TextDocument, TextEditorEdit } from "vscode";
import { addToRanges } from "./selectionUtils";

export interface LineDeletion {
  line: number;
  ranges: Range[];
  fullDelete: boolean;
}

// Generates a map of line numbers to ranges to delete on that line, including full deletions if only whitespace is left over
export function generateLineDeletions(
  document: TextDocument,
  originalRanges: Range[]
): LineDeletion[] {
  const lineDeletions: { [key: number]: LineDeletion } = {};

  for (const orange of originalRanges) {
    if (orange.isEmpty) {
      continue;
    }
    if (orange.isSingleLine) {
      const line = orange.start.line;
      if (!lineDeletions[line]) {
        lineDeletions[line] = { line: line, ranges: [orange], fullDelete: false };
      } else {
        addToRanges(lineDeletions[line].ranges, orange);
      }
    } else {
      // Multi-line range
      const startLine = orange.start.line;
      const startLineRange = new Range(
        orange.start,
        new Position(startLine, document.lineAt(startLine).text.length)
      );
      const endLine = orange.end.line;
      const endLineRange = new Range(new Position(endLine, 0), orange.end);

      if (!lineDeletions[startLine]) {
        lineDeletions[startLine] = { line: startLine, ranges: [startLineRange], fullDelete: false };
      } else {
        addToRanges(lineDeletions[startLine].ranges, startLineRange);
      }
      if (!lineDeletions[endLine]) {
        lineDeletions[endLine] = { line: endLine, ranges: [endLineRange], fullDelete: false };
      } else {
        addToRanges(lineDeletions[endLine].ranges, endLineRange);
      }

      // full delete all inner lines
      for (let line = orange.start.line + 1; line < orange.end.line; line++) {
        lineDeletions[line] = { line: line, ranges: [], fullDelete: true };
      }
    }
  }

  // mark full delete for any lines that would have only whitespace left
  for (const [line, deletion] of Object.entries(lineDeletions)) {
    if (deletion.fullDelete) {
      continue;
    }
    let lineText = document.lineAt(parseInt(line)).text;
    lineText = deleteRangesFromLine(lineText, deletion.ranges);
    const trimmedLine = lineText.trim();
    if (trimmedLine === "" || trimmedLine === ";") {
      deletion.fullDelete = true;
    }
  }

  return Object.values(lineDeletions);
}

// simulates deleting ranges from text
// text and ranges are assumed to be single line.
// ranges are assumed to not overlap.
// ranges are assumed to be in ascending order
export function deleteRangesFromLine(text: string, ranges: Range[]): string {
  for (let i = ranges.length - 1; i >= 0; i--) {
    const start = ranges[i].start.character;
    const end = ranges[i].end.character;
    text = text.slice(0, start) + text.slice(end);
  }

  return text;
}

export function applyLineDeletions(
  editBuilder: TextEditorEdit,
  lineDeletions: LineDeletion[]
): void {
  for (const deletion of lineDeletions) {
    if (deletion.fullDelete) {
      const lineRange = new Range(
        new Position(deletion.line, 0),
        new Position(deletion.line + 1, 0)
      );
      editBuilder.delete(lineRange);
    } else {
      for (const range of deletion.ranges) {
        editBuilder.delete(range);
      }
    }
  }
}
