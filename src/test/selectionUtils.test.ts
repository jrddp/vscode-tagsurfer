import * as assert from "assert";
import * as vscode from "vscode";
import { addToRanges } from "../utils/selectionUtils";

suite("Deletion Functions Test Suite", () => {
  suite("addToRanges", () => {
    test("Add non-intersecting range", () => {
      const ranges: vscode.Range[] = [new vscode.Range(0, 0, 0, 5)];
      const newRange = new vscode.Range(0, 6, 0, 10);
      addToRanges(ranges, newRange);

      assert.strictEqual(ranges.length, 2);
      assert.deepStrictEqual(ranges, [new vscode.Range(0, 0, 0, 5), new vscode.Range(0, 6, 0, 10)]);
    });

    test("Merge intersecting range", () => {
      const ranges: vscode.Range[] = [new vscode.Range(0, 0, 0, 5)];
      const newRange = new vscode.Range(0, 3, 0, 8);
      addToRanges(ranges, newRange);

      assert.strictEqual(ranges.length, 1);
      assert.deepStrictEqual(ranges, [new vscode.Range(0, 0, 0, 8)]);
    });

    test("Add to empty array", () => {
      const ranges: vscode.Range[] = [];
      const newRange = new vscode.Range(0, 0, 0, 5);
      addToRanges(ranges, newRange);

      assert.strictEqual(ranges.length, 1);
      assert.deepStrictEqual(ranges, [new vscode.Range(0, 0, 0, 5)]);
    });

    test("Merge multiple intersecting ranges", () => {
      const ranges: vscode.Range[] = [new vscode.Range(0, 0, 0, 5), new vscode.Range(0, 10, 0, 15)];
      const newRange = new vscode.Range(0, 3, 0, 12);
      addToRanges(ranges, newRange);

      assert.strictEqual(ranges.length, 1);
      assert.deepStrictEqual(ranges, [new vscode.Range(0, 0, 0, 15)]);
    });
  });
});
