import * as assert from "assert";
import * as vscode from "vscode";
import { wrapContent, getCurrentIndentation, getIndentationString } from "../utils/tagUtils";

suite("Tag Utils Test Suite", () => {
  test("getIndentationString with spaces", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    assert.strictEqual(getIndentationString(mockEditor), "  ");
  });

  test("getIndentationString with tabs", () => {
    const mockEditor = {
      options: {
        insertSpaces: false,
        tabSize: 4, // This shouldn't matter for tabs
      },
    } as vscode.TextEditor;

    assert.strictEqual(getIndentationString(mockEditor), "\t");
  });

  test("getCurrentIndentation", () => {
    assert.strictEqual(getCurrentIndentation("    some content"), "    ");
    assert.strictEqual(getCurrentIndentation("\tsome content"), "\t");
    assert.strictEqual(getCurrentIndentation("no indentation"), "");
  });

  test("createTag inline", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    assert.strictEqual(wrapContent(mockEditor, "div", "content", true), "<div>content</div>");
  });

  test("createTag block", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    const result = wrapContent(mockEditor, "div", "  content", false);
    assert.strictEqual(result, "  <div>\n    content\n  </div>");
  });
});
