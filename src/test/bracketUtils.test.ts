import * as assert from "assert";
import * as vscode from "vscode";
import {
  asBracketLoc,
  findMatchingBracket,
  getAllBracketsInSelection,
} from "../utils/bracketUtils";
import { createTestDocument } from "./common";

suite("findMatchingBracket Test Suite", () => {
  test("Find matching parentheses - forward", async () => {
    const doc = await createTestDocument("(hello (world))");
    const bracketLoc = asBracketLoc("(", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 14));
  });

  test("Find matching parentheses - backward", async () => {
    const doc = await createTestDocument("(hello (world))");
    const bracketLoc = asBracketLoc(")", new vscode.Position(0, 14))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 0));
  });

  test("Find matching square brackets", async () => {
    const doc = await createTestDocument("[test [nested] bracket]");
    const bracketLoc = asBracketLoc("[", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 22));
  });

  test("Find matching curly braces", async () => {
    const doc = await createTestDocument("{test {nested} brace}");
    const bracketLoc = asBracketLoc("{", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 20));
  });

  test("Find matching angle brackets", async () => {
    const doc = await createTestDocument("<test <nested> bracket>");
    const bracketLoc = asBracketLoc("<", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 22));
  });

  test("Nested brackets of same type", async () => {
    const doc = await createTestDocument("((nested (deeply (nested))))");
    const bracketLoc = asBracketLoc("(", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 27));
  });

  test("No matching bracket - unbalanced", async () => {
    const doc = await createTestDocument("(unbalanced");
    const bracketLoc = asBracketLoc("(", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.strictEqual(result, null);
  });

  test("Multi-line bracket matching", async () => {
    const doc = await createTestDocument("(\n  multi\n  line\n)");
    const bracketLoc = asBracketLoc("(", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(3, 0));
  });

  test("Bracket at end of document", async () => {
    const doc = await createTestDocument("(end)");
    const bracketLoc = asBracketLoc(")", new vscode.Position(0, 4))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 0));
  });

  test("Bracket at start of document", async () => {
    const doc = await createTestDocument("(start)");
    const bracketLoc = asBracketLoc("(", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 6));
  });

  test("Ignore brackets in string literals", async () => {
    const doc = await createTestDocument('("(" )');
    const bracketLoc = asBracketLoc("(", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 5));
  });

  test("Complex nested structure", async () => {
    const doc = await createTestDocument('{ "array": [1, 2, {"nested": (3 + 4)}] }');
    const bracketLoc = asBracketLoc("{", new vscode.Position(0, 0))!;
    const result = findMatchingBracket(doc, bracketLoc);
    assert.deepStrictEqual(result, new vscode.Position(0, 39));
  });
});

suite("getAllBracketsInSelection Test Suite", () => {
  test("Single line with various brackets", async () => {
    const doc = await createTestDocument("(hello [world] {test})");
    const selection = new vscode.Range(0, 0, 0, 22);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 6);
    assert.deepStrictEqual(result[0], {
      bracket: "(",
      position: new vscode.Position(0, 0),
      type: "opening",
    });
    assert.deepStrictEqual(result[1], {
      bracket: "[",
      position: new vscode.Position(0, 7),
      type: "opening",
    });
    assert.deepStrictEqual(result[2], {
      bracket: "]",
      position: new vscode.Position(0, 13),
      type: "closing",
    });
    assert.deepStrictEqual(result[3], {
      bracket: "{",
      position: new vscode.Position(0, 15),
      type: "opening",
    });
    assert.deepStrictEqual(result[4], {
      bracket: "}",
      position: new vscode.Position(0, 20),
      type: "closing",
    });
    assert.deepStrictEqual(result[5], {
      bracket: ")",
      position: new vscode.Position(0, 21),
      type: "closing",
    });
  });

  test("Multi-line selection", async () => {
    const doc = await createTestDocument('function test() {\n  console.log("Hello");\n}');
    const selection = new vscode.Range(0, 0, 2, 2);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 6);
    assert.deepStrictEqual(result[0], {
      bracket: "(",
      position: new vscode.Position(0, 13),
      type: "opening",
    });
    assert.deepStrictEqual(result[1], {
      bracket: ")",
      position: new vscode.Position(0, 14),
      type: "closing",
    });
    assert.deepStrictEqual(result[2], {
      bracket: "{",
      position: new vscode.Position(0, 16),
      type: "opening",
    });
    assert.deepStrictEqual(result[3], {
      bracket: "(",
      position: new vscode.Position(1, 13),
      type: "opening",
    });
    assert.deepStrictEqual(result[4], {
      bracket: ")",
      position: new vscode.Position(1, 21),
      type: "closing",
    });
    assert.deepStrictEqual(result[5], {
      bracket: "}",
      position: new vscode.Position(2, 0),
      type: "closing",
    });
  });

  test("Partial line selection", async () => {
    const doc = await createTestDocument("(hello [world] {test})");
    const selection = new vscode.Range(0, 5, 0, 16);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(result[0], {
      bracket: "[",
      position: new vscode.Position(0, 7),
      type: "opening",
    });
    assert.deepStrictEqual(result[1], {
      bracket: "]",
      position: new vscode.Position(0, 13),
      type: "closing",
    });
    assert.deepStrictEqual(result[2], {
      bracket: "{",
      position: new vscode.Position(0, 15),
      type: "opening",
    });
  });

  test("Selection with no brackets", async () => {
    const doc = await createTestDocument("Hello world");
    const selection = new vscode.Range(0, 0, 0, 11);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 0);
  });

  test("Selection with angle brackets", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const selection = new vscode.Range(0, 0, 0, 16);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 4);
    assert.deepStrictEqual(result[0], {
      bracket: "<",
      position: new vscode.Position(0, 0),
      type: "opening",
    });
    assert.deepStrictEqual(result[1], {
      bracket: ">",
      position: new vscode.Position(0, 4),
      type: "closing",
    });
    assert.deepStrictEqual(result[2], {
      bracket: "<",
      position: new vscode.Position(0, 10),
      type: "opening",
    });
    assert.deepStrictEqual(result[3], {
      bracket: ">",
      position: new vscode.Position(0, 15),
      type: "closing",
    });
  });

  test("Reversed selection", async () => {
    const doc = await createTestDocument("(hello [world])");
    const selection = new vscode.Selection(0, 15, 0, 0);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 4);
    assert.deepStrictEqual(result[0], {
      bracket: "(",
      position: new vscode.Position(0, 0),
      type: "opening",
    });
    assert.deepStrictEqual(result[1], {
      bracket: "[",
      position: new vscode.Position(0, 7),
      type: "opening",
    });
    assert.deepStrictEqual(result[2], {
      bracket: "]",
      position: new vscode.Position(0, 13),
      type: "closing",
    });
    assert.deepStrictEqual(result[3], {
      bracket: ")",
      position: new vscode.Position(0, 14),
      type: "closing",
    });
  });

  test("Empty selection", async () => {
    const doc = await createTestDocument("(hello)");
    const selection = new vscode.Range(0, 3, 0, 3);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 0);
  });

  test("Selection ending with a bracket", async () => {
    const doc = await createTestDocument("hello (world)");
    const selection = new vscode.Range(0, 0, 0, 7);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], {
      bracket: "(",
      position: new vscode.Position(0, 6),
      type: "opening",
    });
  });

  test("Selection starting with a bracket", async () => {
    const doc = await createTestDocument("(hello) world");
    const selection = new vscode.Range(0, 6, 0, 12);
    const result = getAllBracketsInSelection(doc, selection);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], {
      bracket: ")",
      position: new vscode.Position(0, 6),
      type: "closing",
    });
  });
});
