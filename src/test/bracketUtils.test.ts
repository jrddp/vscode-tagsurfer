import * as assert from "assert";
import * as vscode from "vscode";
import { findMatchingBracket } from "../utils/bracketUtils";

suite("findMatchingBracket Test Suite", () => {
  async function createTestDocument(content: string): Promise<vscode.TextDocument> {
    const uri = vscode.Uri.parse("untitled:test.txt");
    const document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), content);
    await vscode.workspace.applyEdit(edit);
    return document;
  }

  test("Find matching parentheses - forward", async () => {
    const doc = await createTestDocument("(hello (world))");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "(");
    assert.deepStrictEqual(result, new vscode.Position(0, 14));
  });

  test("Find matching parentheses - backward", async () => {
    const doc = await createTestDocument("(hello (world))");
    const result = findMatchingBracket(doc, new vscode.Position(0, 14), ")");
    assert.deepStrictEqual(result, new vscode.Position(0, 0));
  });

  test("Find matching square brackets", async () => {
    const doc = await createTestDocument("[test [nested] bracket]");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "[");
    assert.deepStrictEqual(result, new vscode.Position(0, 22));
  });

  test("Find matching curly braces", async () => {
    const doc = await createTestDocument("{test {nested} brace}");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "{");
    assert.deepStrictEqual(result, new vscode.Position(0, 20));
  });

  test("Find matching angle brackets", async () => {
    const doc = await createTestDocument("<test <nested> bracket>");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "<");
    assert.deepStrictEqual(result, new vscode.Position(0, 22));
  });

  test("Nested brackets of same type", async () => {
    const doc = await createTestDocument("((nested (deeply (nested))))");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "(");
    assert.deepStrictEqual(result, new vscode.Position(0, 27));
  });

  test("No matching bracket - unbalanced", async () => {
    const doc = await createTestDocument("(unbalanced");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "(");
    assert.strictEqual(result, null);
  });

  test("Multi-line bracket matching", async () => {
    const doc = await createTestDocument("(\n  multi\n  line\n)");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "(");
    assert.deepStrictEqual(result, new vscode.Position(3, 0));
  });

  test("Bracket at end of document", async () => {
    const doc = await createTestDocument("(end)");
    const result = findMatchingBracket(doc, new vscode.Position(0, 4), ")");
    assert.deepStrictEqual(result, new vscode.Position(0, 0));
  });

  test("Bracket at start of document", async () => {
    const doc = await createTestDocument("(start)");
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "(");
    assert.deepStrictEqual(result, new vscode.Position(0, 6));
  });

  test("Ignore brackets in string literals", async () => {
    const doc = await createTestDocument('("(" )');
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "(");
    assert.deepStrictEqual(result, new vscode.Position(0, 5));
  });

  test("Complex nested structure", async () => {
    const doc = await createTestDocument('{ "array": [1, 2, {"nested": (3 + 4)}] }');
    const result = findMatchingBracket(doc, new vscode.Position(0, 0), "{");
    assert.deepStrictEqual(result, new vscode.Position(0, 39));
  });
});
