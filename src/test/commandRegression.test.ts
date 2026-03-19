import * as assert from "assert";
import * as vscode from "vscode";

import { deleteSelectionWithMatchingPairs } from "../commands/deleteSelectionWithPairs";
import { jumpToMatchingPair } from "../commands/jumpToMatchingPair";
import { surroundWithTag } from "../commands/surroundWithTag";
import { flushEditorUpdates, showTestEditor } from "./common";

suite("Command Regression Test Suite", () => {
  test("surroundWithTag keeps same-line multi-cursor selections aligned", async () => {
    const editor = await showTestEditor("one two");
    editor.selections = [new vscode.Selection(0, 0, 0, 3), new vscode.Selection(0, 4, 0, 7)];

    await surroundWithTag();
    await flushEditorUpdates();

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

  test("jumpToMatchingPair cycles through Svelte if branches on the same level", async () => {
    const editor = await showTestEditor(
      ["{#if foo}", "\tA", "{:else if bar}", "\tB", "{:else}", "\tC", "{/if}"].join("\n"),
      "svelte"
    );
    editor.selection = new vscode.Selection(0, 2, 0, 2);

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(2, 1));

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 1));

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(6, 1));

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 1));
  });

  test("jumpToMatchingPair keeps nested Svelte blocks on the correct level", async () => {
    const editor = await showTestEditor(
      ["{#if outer}", "  {#if inner}", "  {:else}", "  {/if}", "{:else}", "{/if}"].join("\n"),
      "svelte"
    );
    editor.selection = new vscode.Selection(1, 4, 1, 4);

    jumpToMatchingPair();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(2, 3));
  });

  test("jumpToMatchingPair cycles through Svelte each blocks with else", async () => {
    const editor = await showTestEditor(
      ["{#each items as item}", "\t<li>{item}</li>", "{:else}", "\t<p>empty</p>", "{/each}"].join(
        "\n"
      ),
      "svelte"
    );
    editor.selection = new vscode.Selection(0, 3, 0, 3);

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(2, 1));

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 1));
  });

  test("jumpToMatchingPair cycles through Svelte await branches", async () => {
    const editor = await showTestEditor(
      [
        "{#await promise}",
        "\t<p>loading</p>",
        "{:then value}",
        "\t<p>{value}</p>",
        "{:catch error}",
        "\t<p>{error.message}</p>",
        "{/await}",
      ].join("\n"),
      "svelte"
    );
    editor.selection = new vscode.Selection(0, 3, 0, 3);

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(2, 1));

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 1));

    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(6, 1));
  });

  test("jumpToMatchingPair supports paired Svelte key and snippet blocks", async () => {
    const editor = await showTestEditor(
      [
        "{#key value}",
        "\t{#snippet row(item)}",
        "\t\t<li>{item}</li>",
        "\t{/snippet}",
        "{/key}",
      ].join("\n"),
      "svelte"
    );

    editor.selection = new vscode.Selection(0, 3, 0, 3);
    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 1));

    editor.selection = new vscode.Selection(1, 5, 1, 5);
    jumpToMatchingPair();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(3, 2));
  });
});
