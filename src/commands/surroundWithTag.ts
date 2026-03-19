import * as vscode from "vscode";
import { getSelectionType } from "../utils/selectionUtils";
import { wrapContent } from "../utils/tagUtils";
import { getSetting } from "../config";

function getWordRangeUnderCursor(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | null {
  const lineText = document.lineAt(position.line).text;
  if (position.character >= lineText.length) {
    return null;
  }

  const currentCharacter = lineText[position.character];
  if (/\s/.test(currentCharacter)) {
    return null;
  }

  return document.getWordRangeAtPosition(position) ?? null;
}

function getOpeningTagCursorOffset(newContent: string, tagName: string): number {
  const openingTagStart = newContent.indexOf(`<${tagName}>`);
  return openingTagStart >= 0 ? openingTagStart + 1 : 1;
}

export async function surroundWithTag() {
  const blockTag = getSetting("defaultBlockTag");
  const inlineTag = getSetting("defaultInlineTag");
  const autoRename = getSetting("autoRename");

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor");
    return;
  }

  const document = editor.document;
  const selections = editor.selections;

  const pendingEdits: {
    index: number;
    startOffset: number;
    endOffset: number;
    newContent: string;
    cursorOffset: number;
  }[] = [];

  await editor.edit(
    editBuilder => {
      selections.forEach((selection, index) => {
        let adjustedSelection = selection;
        if (selection.isEmpty) {
          const wordRange = getWordRangeUnderCursor(document, selection.active);
          if (wordRange) {
            adjustedSelection = new vscode.Selection(wordRange.start, wordRange.end);
          }
        }

        // adjust selections with trailing cursor on next line (happens when selecting with mouse)
        if (selection.start.line !== selection.end.line && selection.end.character === 0) {
          // set to end of previous line
          const newEnd = new vscode.Position(
            selection.end.line - 1,
            document.lineAt(selection.end.line - 1).text.length
          );
          adjustedSelection = new vscode.Selection(selection.start, newEnd);
        }

        const selectionType = getSelectionType(adjustedSelection, document);
        const tagName = selectionType === "inline" ? inlineTag : blockTag;
        const selectionRange = new vscode.Range(adjustedSelection.start, adjustedSelection.end);
        const selectedText = document.getText(selectionRange);

        let newContent: string;
        let cursorOffset: number;

        switch (selectionType) {
          case "inline":
          case "multiInline":
            newContent = wrapContent(editor, tagName, selectedText, true);
            cursorOffset = getOpeningTagCursorOffset(newContent, tagName);
            break;
          case "multiFullLine":
          case "fullLine":
            newContent = wrapContent(editor, tagName, selectedText, false);
            cursorOffset = getOpeningTagCursorOffset(newContent, tagName);
            break;
          case "none":
            newContent = wrapContent(editor, tagName, "", true);
            cursorOffset = getOpeningTagCursorOffset(newContent, tagName);
            break;
        }

        editBuilder.replace(selectionRange, newContent);
        pendingEdits.push({
          index,
          startOffset: document.offsetAt(selectionRange.start),
          endOffset: document.offsetAt(selectionRange.end),
          newContent,
          cursorOffset,
        });
      });
    },
    { undoStopBefore: true, undoStopAfter: true }
  );

  const newSelections: vscode.Selection[] = new Array(pendingEdits.length);
  let delta = 0;

  const orderedEdits = [...pendingEdits].sort((a, b) =>
    a.startOffset === b.startOffset ? a.index - b.index : a.startOffset - b.startOffset
  );

  for (const pendingEdit of orderedEdits) {
    const transformedStartOffset = pendingEdit.startOffset + delta;
    const newPosition = editor.document.positionAt(transformedStartOffset + pendingEdit.cursorOffset);
    newSelections[pendingEdit.index] = new vscode.Selection(newPosition, newPosition);
    delta += pendingEdit.newContent.length - (pendingEdit.endOffset - pendingEdit.startOffset);
  }

  // Vim can overwrite the selection when leaving visual mode, so reapply our target
  // selection on the next tick after requesting the escape.
  if (selections.some(selection => !selection.isEmpty)) {
    try {
      await vscode.commands.executeCommand("extension.vim_escape");
    } catch (error) {
      // Continue anyways if Vim not installed or escape fails
    }
  }

  setImmediate(() => {
    editor.selections = newSelections;
    if (autoRename) {
      setImmediate(() => {
        void vscode.commands.executeCommand("editor.action.rename");
      });
    }
  });
}
