import * as assert from "assert";
import * as vscode from "vscode";
import {
  getIndentationString,
  getCurrentIndentation,
  indentContent,
  wrapContent,
  getEnclosingTag,
} from "../utils/tagUtils";

suite("Tag Utils Test Suite: surroundWithTag", () => {
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

suite("Tag Utils Test Suite: jumpToMatchingPair", () => {
  async function createTestDocument(content: string): Promise<vscode.TextDocument> {
    const uri = vscode.Uri.parse("untitled:tagsurfer-test.html");
    let document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), content);
    await vscode.workspace.applyEdit(edit);
    document = await vscode.workspace.openTextDocument(uri);
    console.log("Document content:\n", document.getText());
    return document;
  }

  test("getEnclosingTag with cursor inside opening tag", async () => {
    const doc = await createTestDocument('<div class="test">Hello</div>');
    const result = getEnclosingTag(doc, new vscode.Position(0, 5));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.isClosing, false);
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 18));
  });

  test("getEnclosingTag with cursor inside closing tag", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const result = getEnclosingTag(doc, new vscode.Position(0, 12));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.isClosing, true);
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 10, 0, 16));
  });

  test("getEnclosingTag with cursor not inside a tag", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const result = getEnclosingTag(doc, new vscode.Position(0, 7));
    assert.strictEqual(result, null);
  });

  test("getEnclosingTag with multi-line tag", async () => {
    const doc = await createTestDocument(
      '<div\n    class="test"\n    id="multi-line">\nHello\n</div>'
    );
    const result = getEnclosingTag(doc, new vscode.Position(1, 5));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.isClosing, false);
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 2, 20));
  });
});
