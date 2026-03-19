import * as assert from "assert";
import * as vscode from "vscode";

import { deleteSelectionWithMatchingPairs } from "../commands/deleteSelectionWithPairs";
import { surroundWithTag } from "../commands/surroundWithTag";
import { showTestEditor } from "./common";

suite("Command Regression Test Suite", () => {
  test("surroundWithTag keeps same-line multi-cursor selections aligned", async () => {
    const editor = await showTestEditor("one two");
    editor.selections = [new vscode.Selection(0, 0, 0, 3), new vscode.Selection(0, 4, 0, 7)];

    await surroundWithTag();

    assert.strictEqual(editor.document.getText(), "<span>one</span> <span>two</span>");
    assert.deepStrictEqual(
      editor.selections.map(selection => selection.active),
      [new vscode.Position(0, 1), new vscode.Position(0, 18)]
    );
  });

  test("deleteSelectionWithMatchingPairs expands intersecting paired ranges", async () => {
    const editor = await showTestEditor("<div>Hello</div>");
    editor.selection = new vscode.Selection(0, 0, 0, 12);

    await deleteSelectionWithMatchingPairs();

    assert.strictEqual(editor.document.getText(), "");
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
  });
});
