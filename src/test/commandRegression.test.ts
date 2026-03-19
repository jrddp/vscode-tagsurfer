import * as assert from "assert";
import * as vscode from "vscode";

import { deleteSelectionWithMatchingPairs } from "../commands/deleteSelectionWithPairs";
import { jumpToMatchingPair } from "../commands/jumpToMatchingPair";
import {
  jumpToChildSymbol,
  jumpToNextSiblingSymbol,
  jumpToParentSymbol,
  jumpToPreviousSiblingSymbol,
} from "../commands/jumpToSiblingSymbol";
import { swapWithNextSibling, swapWithPreviousSibling } from "../commands/swapWithSibling";
import { surroundWithTag } from "../commands/surroundWithTag";
import { flushEditorUpdates, showTestEditor } from "./common";

function nthIndexOf(text: string, needle: string, occurrence = 0): number {
  let searchStart = 0;
  let index = -1;

  for (let i = 0; i <= occurrence; i++) {
    index = text.indexOf(needle, searchStart);
    assert.notStrictEqual(index, -1, `Unable to find '${needle}' occurrence ${occurrence}.`);
    searchStart = index + needle.length;
  }

  return index;
}

function positionAtText(
  document: vscode.TextDocument,
  needle: string,
  occurrence = 0,
  offset = 0
): vscode.Position {
  return document.positionAt(nthIndexOf(document.getText(), needle, occurrence) + offset);
}

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

  test("jumpToNextSiblingSymbol moves between top-level TypeScript siblings", async () => {
    const editor = await showTestEditor(
      [
        "function first() {",
        "  return 1;",
        "}",
        "",
        "function second() {",
        "  return 2;",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(1, 2, 1, 2);
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 9));
  });

  test("jumpToPreviousSiblingSymbol stays within the current class level", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  alpha() {",
        "    return 1;",
        "  }",
        "",
        "  beta() {",
        "    return 2;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(6, 4, 6, 4);
    await flushEditorUpdates();

    await jumpToPreviousSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 2));
  });

  test("jumpToNextSiblingSymbol wraps to the first sibling after the last one", async () => {
    const editor = await showTestEditor(
      [
        "function first() {",
        "  return 1;",
        "}",
        "",
        "function second() {",
        "  return 2;",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(5, 2, 5, 2);
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 9));
  });

  test("jumpToPreviousSiblingSymbol wraps to the last sibling before the first one", async () => {
    const editor = await showTestEditor(
      [
        "function first() {",
        "  return 1;",
        "}",
        "",
        "function second() {",
        "  return 2;",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(0, 9, 0, 9);
    await flushEditorUpdates();

    await jumpToPreviousSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 9));
  });

  test("jumpToNextSiblingSymbol moves between scalar JSON object keys", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "type": "object",',
        '  "$id": "Item.json",',
        '  "title": "Item",',
        '  "hytale": {',
        '    "type": "object",',
        '    "internalKeys": [',
        '      "Unknown"',
        "    ],",
        '    "path": "Item/Items"',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"type"', 0),
      positionAtText(editor.document, '"type"', 0)
    );
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"$id"'));
  });

  test("jumpToPreviousSiblingSymbol moves backward between scalar JSON object keys", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "type": "object",',
        '  "$id": "Item.json",',
        '  "title": "Item",',
        '  "hytale": {',
        '    "type": "object",',
        '    "internalKeys": [',
        '      "Unknown"',
        "    ],",
        '    "path": "Item/Items"',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"$id"'),
      positionAtText(editor.document, '"$id"')
    );
    await flushEditorUpdates();

    await jumpToPreviousSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"type"', 0));
  });

  test("jumpToChildSymbol enters the first property of a JSON object value", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "type": "object",',
        '  "$id": "Item.json",',
        '  "title": "Item",',
        '  "hytale": {',
        '    "type": "object",',
        '    "internalKeys": [',
        '      "Unknown"',
        "    ],",
        '    "path": "Item/Items"',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"hytale"'),
      positionAtText(editor.document, '"hytale"')
    );
    await flushEditorUpdates();

    await jumpToChildSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"type"', 1));
  });

  test("jumpToParentSymbol moves from a nested JSON array item to its containing property", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "type": "object",',
        '  "$id": "Item.json",',
        '  "title": "Item",',
        '  "hytale": {',
        '    "type": "object",',
        '    "internalKeys": [',
        '      "Unknown"',
        "    ],",
        '    "path": "Item/Items",',
        '    "extension": ".json"',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"Unknown"'),
      positionAtText(editor.document, '"Unknown"')
    );
    await flushEditorUpdates();

    await jumpToParentSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"internalKeys"'));
  });

  test("jumpToNextSiblingSymbol moves between nested scalar JSON object keys", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "type": "object",',
        '  "$id": "Item.json",',
        '  "title": "Item",',
        '  "hytale": {',
        '    "type": "object",',
        '    "internalKeys": [',
        '      "Unknown"',
        "    ],",
        '    "path": "Item/Items"',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"type"', 1),
      positionAtText(editor.document, '"type"', 1)
    );
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"internalKeys"'));
  });

  test("jumpToNextSiblingSymbol toggles between header and end when there is only one sibling", async () => {
    const editor = await showTestEditor(
      [
        "class OnlyChild {",
        "  solo() {",
        "    return 1;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(1, 2, 1, 2);
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(3, 3));

    await jumpToNextSiblingSymbol();
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 2));
  });

  test("jumpToNextSiblingSymbol follows matching-pair behavior for an only-child JSON object value", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "config": {',
        '    "enabled": true',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, "{", 1),
      positionAtText(editor.document, "{", 1)
    );
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "}", 0));
  });

  test("jumpToPreviousSiblingSymbol follows matching-pair behavior for an only-child JSON object value", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "config": {',
        '    "enabled": true',
        "  }",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, "}", 0),
      positionAtText(editor.document, "}", 0)
    );
    await flushEditorUpdates();

    await jumpToPreviousSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "{", 1));
  });

  test("jumpToNextSiblingSymbol follows matching-pair behavior for an only-child JSON array item", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "items": [',
        "    {",
        '      "id": 1',
        "    }",
        "  ]",
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, "{", 1),
      positionAtText(editor.document, "{", 1)
    );
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "}", 0));
  });

  test("jumpToNextSiblingSymbol can move from parent body whitespace to the next child symbol", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  first() {",
        "    return 1;",
        "  }",
        "",
        "  second() {",
        "    return 2;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(4, 2, 4, 2);
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(5, 2));
  });

  test("jumpToNextSiblingSymbol follows matching-pair behavior for an only-child opening tag", async () => {
    const editor = await showTestEditor(
      [
        "<nav>",
        "  <ol>",
        '    <li><a href="/">Home</a></li>',
        '    <li><a href="/workspaces">Workspaces</a></li>',
        "    <li><span>Dashboard</span></li>",
        "  </ol>",
        "</nav>",
      ].join("\n"),
      "html"
    );
    editor.selection = new vscode.Selection(1, 3, 1, 3);
    await flushEditorUpdates();

    await jumpToNextSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(5, 3));
  });

  test("jumpToPreviousSiblingSymbol follows matching-pair behavior for an only-child closing tag", async () => {
    const editor = await showTestEditor(
      [
        "<nav>",
        "  <ol>",
        '    <li><a href="/">Home</a></li>',
        '    <li><a href="/workspaces">Workspaces</a></li>',
        "    <li><span>Dashboard</span></li>",
        "  </ol>",
        "</nav>",
      ].join("\n"),
      "html"
    );
    editor.selection = new vscode.Selection(5, 3, 5, 3);
    await flushEditorUpdates();

    await jumpToPreviousSiblingSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 3));
  });

  test("jumpToParentSymbol moves from a method body to its method header", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  alpha() {",
        "    return 1;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(2, 4, 2, 4);
    await flushEditorUpdates();

    await jumpToParentSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 2));
  });

  test("jumpToParentSymbol moves from a method header to its containing class header", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  alpha() {",
        "    return 1;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(1, 2, 1, 2);
    await flushEditorUpdates();

    await jumpToParentSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 6));
  });

  test("jumpToChildSymbol moves from a class header to its first child header", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  alpha() {",
        "    return 1;",
        "  }",
        "",
        "  beta() {",
        "    return 2;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(0, 6, 0, 6);
    await flushEditorUpdates();

    await jumpToChildSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 2));
  });

  test("jumpToChildSymbol returns the first child from parent-body whitespace", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  alpha() {",
        "    return 1;",
        "  }",
        "",
        "  beta() {",
        "    return 2;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(4, 2, 4, 2);
    await flushEditorUpdates();

    await jumpToChildSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 2));
  });

  test("jumpToChildSymbol falls back to the next sibling when the current symbol has no children", async () => {
    const editor = await showTestEditor(
      [
        "class ExampleRunner {",
        "  private beforeAll() {",
        "    return 'before';",
        "  }",
        "",
        "  run() {",
        "    return 'run';",
        "  }",
        "",
        "  private afterAll() {",
        "    return 'after';",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(1, 10, 1, 10);
    await flushEditorUpdates();

    await jumpToChildSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(5, 2));
  });

  test("jumpToChildSymbol always targets the first child of a symbol", async () => {
    const editor = await showTestEditor(
      [
        "class ExampleRunner {",
        "  private beforeAll() {",
        "    return 'before';",
        "  }",
        "",
        "  run() {",
        "    return 'run';",
        "  }",
        "",
        "  private afterAll() {",
        "    return 'after';",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(0, 6, 0, 6);
    await flushEditorUpdates();

    await jumpToChildSymbol();

    assert.deepStrictEqual(editor.selection.active, new vscode.Position(1, 10));
  });

  test("swapWithNextSibling swaps adjacent top-level TypeScript siblings", async () => {
    const editor = await showTestEditor(
      [
        "function first() {",
        "  return 1;",
        "}",
        "",
        "function second() {",
        "  return 2;",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(1, 2, 1, 2);

    await swapWithNextSibling();

    assert.strictEqual(
      editor.document.getText(),
      [
        "function second() {",
        "  return 2;",
        "}",
        "",
        "function first() {",
        "  return 1;",
        "}",
      ].join("\n")
    );
    assert.deepStrictEqual(
      editor.selection.active,
      positionAtText(editor.document, "return 1;")
    );
  });

  test("swapWithPreviousSibling swaps adjacent class methods", async () => {
    const editor = await showTestEditor(
      [
        "class Example {",
        "  alpha() {",
        "    return 1;",
        "  }",
        "",
        "  beta() {",
        "    return 2;",
        "  }",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(5, 3, 5, 3);

    await swapWithPreviousSibling();

    assert.strictEqual(
      editor.document.getText(),
      [
        "class Example {",
        "  beta() {",
        "    return 2;",
        "  }",
        "",
        "  alpha() {",
        "    return 1;",
        "  }",
        "}",
      ].join("\n")
    );
    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "beta()", 0, 1));
  });

  test("swapWithPreviousSibling keeps exported TypeScript declaration prefixes intact", async () => {
    const editor = await showTestEditor(
      [
        "export interface BlobLight {",
        "  xPx: number;",
        "  yPx: number;",
        "  radiusPx: number;",
        "  color: [number, number, number];",
        "  intensity: number;",
        "}",
        "",
        "export interface BlobLightSnapshot {",
        "  lights: BlobLight[];",
        "  cursorYPx: number;",
        "  cursorXPx: number;",
        "  hasCursor: boolean;",
        "  timestamp: number;",
        "}",
        "",
        "export interface BlobLightSource {",
        "  subscribe: (run: (snapshot: BlobLightSnapshot) => void) => () => void;",
        "  getSnapshot: () => BlobLightSnapshot;",
        "}",
        "",
        "export const BLOB_LIGHT_CONTEXT = Symbol('blob-light-context');",
        "",
        "export const EMPTY_BLOB_LIGHT_SNAPSHOT: BlobLightSnapshot = {",
        "  lights: [],",
        "  cursorXPx: 0,",
        "  cursorYPx: 0,",
        "  hasCursor: false,",
        "  timestamp: 0",
        "};",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, "BLOB_LIGHT_CONTEXT"),
      positionAtText(editor.document, "BLOB_LIGHT_CONTEXT")
    );

    await swapWithPreviousSibling();

    assert.strictEqual(
      editor.document.getText(),
      [
        "export interface BlobLight {",
        "  xPx: number;",
        "  yPx: number;",
        "  radiusPx: number;",
        "  color: [number, number, number];",
        "  intensity: number;",
        "}",
        "",
        "export interface BlobLightSnapshot {",
        "  lights: BlobLight[];",
        "  cursorYPx: number;",
        "  cursorXPx: number;",
        "  hasCursor: boolean;",
        "  timestamp: number;",
        "}",
        "",
        "export const BLOB_LIGHT_CONTEXT = Symbol('blob-light-context');",
        "",
        "export interface BlobLightSource {",
        "  subscribe: (run: (snapshot: BlobLightSnapshot) => void) => () => void;",
        "  getSnapshot: () => BlobLightSnapshot;",
        "}",
        "",
        "export const EMPTY_BLOB_LIGHT_SNAPSHOT: BlobLightSnapshot = {",
        "  lights: [],",
        "  cursorXPx: 0,",
        "  cursorYPx: 0,",
        "  hasCursor: false,",
        "  timestamp: 0",
        "};",
      ].join("\n")
    );
    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "BLOB_LIGHT_CONTEXT"));
  });

  test("swapWithNextSibling swaps adjacent JSON object properties", async () => {
    const editor = await showTestEditor(
      [
        "{",
        '  "type": "object",',
        '  "$id": "Item.json",',
        '  "title": "Item"',
        "}",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"$id"', 0, 1),
      positionAtText(editor.document, '"$id"', 0, 1)
    );

    await swapWithNextSibling();

    assert.strictEqual(
      editor.document.getText(),
      [
        "{",
        '  "type": "object",',
        '  "title": "Item",',
        '  "$id": "Item.json"',
        "}",
      ].join("\n")
    );
    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"$id"', 0, 1));
  });

  test("swapWithPreviousSibling swaps adjacent JSON array items", async () => {
    const editor = await showTestEditor(
      [
        "[",
        '  "one",',
        '  "two",',
        '  "three"',
        "]",
      ].join("\n"),
      "json"
    );
    editor.selection = new vscode.Selection(
      positionAtText(editor.document, '"two"', 0, 1),
      positionAtText(editor.document, '"two"', 0, 1)
    );

    await swapWithPreviousSibling();

    assert.strictEqual(
      editor.document.getText(),
      [
        "[",
        '  "two",',
        '  "one",',
        '  "three"',
        "]",
      ].join("\n")
    );
    assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, '"two"', 0, 1));
  });

  test("swapWithNextSibling does not wrap when there is no next sibling", async () => {
    const editor = await showTestEditor(
      [
        "function first() {",
        "  return 1;",
        "}",
        "",
        "function second() {",
        "  return 2;",
        "}",
      ].join("\n"),
      "ts"
    );
    editor.selection = new vscode.Selection(4, 10, 4, 10);

    await swapWithNextSibling();

    assert.strictEqual(
      editor.document.getText(),
      [
        "function first() {",
        "  return 1;",
        "}",
        "",
        "function second() {",
        "  return 2;",
        "}",
      ].join("\n")
    );
    assert.deepStrictEqual(editor.selection.active, new vscode.Position(4, 10));
  });
});
