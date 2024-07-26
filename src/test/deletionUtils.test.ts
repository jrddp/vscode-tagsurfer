import * as assert from "assert";
import * as vscode from "vscode";
import { createTestDocument } from "./common";
import { deleteRangesFromLine, generateLineDeletions } from "../utils/deletionUtils";

suite("Deletion Functions Test Suite", () => {
  suite("generateLineDeletions", () => {
    test("Single line deletion", async () => {
      const document = await createTestDocument("This is a test line");
      const ranges = [new vscode.Range(0, 5, 0, 7)]; // Delete "is"
      const result = generateLineDeletions(document, ranges);

      assert.deepStrictEqual(result, {
        0: { ranges: [new vscode.Range(0, 5, 0, 7)], fullDelete: false },
      });
    });

    test("Multi-line deletion", async () => {
      const document = await createTestDocument("Line 1\nLine 2\nLine 3");
      const ranges = [new vscode.Range(0, 2, 2, 3)]; // Delete from "ne 1" to "ne "
      const result = generateLineDeletions(document, ranges);

      assert.deepStrictEqual(result, {
        0: { ranges: [new vscode.Range(0, 2, 0, 6)], fullDelete: false },
        1: { ranges: [], fullDelete: true },
        2: { ranges: [new vscode.Range(2, 0, 2, 3)], fullDelete: false },
      });
    });

    test("Full line deletion due to whitespace", async () => {
      const document = await createTestDocument("  This is a test  ");
      const ranges = [new vscode.Range(0, 2, 0, 16)]; // Delete "This is a test"
      const result = generateLineDeletions(document, ranges);

      assert.deepStrictEqual(result, {
        0: { ranges: [new vscode.Range(0, 2, 0, 16)], fullDelete: true },
      });
    });

    test("Multiple ranges on single line", async () => {
      const document = await createTestDocument("This is a test line");
      const ranges = [
        new vscode.Range(0, 0, 0, 4), // Delete "This"
        new vscode.Range(0, 8, 0, 9), // Delete "a"
      ];
      const result = generateLineDeletions(document, ranges);

      assert.deepStrictEqual(result, {
        0: {
          ranges: [new vscode.Range(0, 0, 0, 4), new vscode.Range(0, 8, 0, 9)],
          fullDelete: false,
        },
      });
    });

    test("Empty range", async () => {
      const document = await createTestDocument("This is a test line");
      const ranges = [new vscode.Range(0, 5, 0, 5)]; // Empty range
      const result = generateLineDeletions(document, ranges);

      assert.deepStrictEqual(result, {});
    });
  });

  suite("deleteRangesFromLine", () => {
    test("Single range", () => {
      const text = "This is a test line";
      const ranges = [new vscode.Range(0, 5, 0, 8)]; // Delete "is "
      const result = deleteRangesFromLine(text, ranges);

      assert.strictEqual(result, "This a test line");
    });

    test("Multiple ranges", () => {
      const text = "This is a test line";
      const ranges = [
        new vscode.Range(0, 0, 0, 5), // Delete "This "
        new vscode.Range(0, 7, 0, 9), // Delete "a "
      ];
      const result = deleteRangesFromLine(text, ranges);

      assert.strictEqual(result, "is test line");
    });

    test("Empty string", () => {
      const text = "";
      const ranges = [new vscode.Range(0, 0, 0, 0)];
      const result = deleteRangesFromLine(text, ranges);

      assert.strictEqual(result, "");
    });

    test("Delete entire line", () => {
      const text = "This is a test line";
      const ranges = [new vscode.Range(0, 0, 0, 19)];
      const result = deleteRangesFromLine(text, ranges);

      assert.strictEqual(result, "");
    });
  });
});
