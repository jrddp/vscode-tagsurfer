import * as assert from "assert";
import * as vscode from "vscode";
import {
  getIndentationString,
  getCurrentIndentation,
  indentContent,
  wrapContent,
} from "../utils/tagUtils";

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

  test("indentContent", () => {
    const content = "line1\nline2\nline3";
    const indentation = "  ";
    const expected = "  line1\n  line2\n  line3";
    assert.strictEqual(indentContent(content, indentation), expected);
  });

  test("wrapContent inline", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    assert.strictEqual(wrapContent(mockEditor, "div", "content", true), "<div>content</div>");
  });

  test("wrapContent block with single line", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    const result = wrapContent(mockEditor, "div", "content", false);
    assert.strictEqual(result, "<div>\n  content\n</div>");
  });

  test("wrapContent block with multiple lines", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    const content = "line1\nline2\nline3";
    const result = wrapContent(mockEditor, "div", content, false);
    assert.strictEqual(result, "<div>\n  line1\n  line2\n  line3\n</div>");
  });

  test("wrapContent block with existing indentation", () => {
    const mockEditor = {
      options: {
        insertSpaces: true,
        tabSize: 2,
      },
    } as vscode.TextEditor;

    const content = "  existing\n  indentation";
    const result = wrapContent(mockEditor, "div", content, false);
    assert.strictEqual(result, "  <div>\n    existing\n    indentation\n  </div>");
  });
});
