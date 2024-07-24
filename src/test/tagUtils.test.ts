import * as assert from "assert";
import * as vscode from "vscode";
import {
  getIndentationString,
  getCurrentIndentation,
  indentContent,
  wrapContent,
  getEnclosingTag,
  Tag,
  findPairedTag,
} from "../utils/tagUtils";
import { createTestDocument } from "./common";

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
  test("getEnclosingTag with cursor inside opening tag", async () => {
    const doc = await createTestDocument('<div class="test">Hello</div>');
    const result = getEnclosingTag(doc, new vscode.Position(0, 5));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 18));
  });

  test("getEnclosingTag with cursor inside closing tag", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const result = getEnclosingTag(doc, new vscode.Position(0, 12));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
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
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 2, 20));
  });

  test("getEnclosingTag with self-closing tag", async () => {
    const doc = await createTestDocument("<div>Hello<br/>World</div>");
    const result = getEnclosingTag(doc, new vscode.Position(0, 12));
    assert.strictEqual(result?.tagName, "br");
    assert.strictEqual(result?.tagType, "selfClosing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 10, 0, 15));
  });
});

suite("findPairedTag Test Suite", () => {
  test("Find paired tag - simple case", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 10, 0, 16));
  });

  test("Find paired tag - nested tags", async () => {
    const doc = await createTestDocument("<div><div>Hello</div></div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 21, 0, 27));
  });

  test("Find paired tag - multi-line", async () => {
    const doc = await createTestDocument("<div>\n  <p>Hello</p>\n</div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(2, 0, 2, 6));
  });

  test("Find paired tag - backward search", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 10, 0, 16),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Find paired tag - self-closing tag", async () => {
    const doc = await createTestDocument('<img src="test.jpg" />');
    const tag: Tag = {
      tagName: "img",
      tagType: "selfClosing",
      tagRange: new vscode.Range(0, 0, 0, 22),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result, null);
  });

  test("Find paired tag - with attributes", async () => {
    const doc = await createTestDocument('<div class="test" id="main">Hello</div>');
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 28),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 33, 0, 39));
  });

  test("Find paired tag - multiple nested tags", async () => {
    const doc = await createTestDocument("<div><span><div>Hello</div></span></div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 34, 0, 40));
  });

  test("Find paired tag - tag within comments", async () => {
    const doc = await createTestDocument("<div><!-- <div>Comment</div> --></div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 32, 0, 38));
  });

  test("Find paired tag - no matching tag", async () => {
    const doc = await createTestDocument("<div>Hello");
    const tag: Tag = {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result, null);
  });

  test("Backward search - nested tags", async () => {
    const doc = await createTestDocument("<div><span><div>Hello</div></span></div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 34, 0, 40),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Backward search - multiple nested tags of same type", async () => {
    const doc = await createTestDocument("<div><div><div>Hello</div></div></div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 32, 0, 38),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Backward search - with attributes", async () => {
    const doc = await createTestDocument('<div class="test"><span id="inner">Hello</span></div>');
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 44, 0, 50),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 18));
  });

  test("Backward search - multi-line", async () => {
    const doc = await createTestDocument("<div>\n  <span>\n    Hello\n  </span>\n</div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(4, 0, 4, 6),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Backward search - with comments", async () => {
    const doc = await createTestDocument(
      "<div><!-- <div>Comment</div> --><span>Hello</span></div>"
    );
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 51, 0, 57),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Backward search - no matching tag", async () => {
    const doc = await createTestDocument("<span>Hello</span></div>");
    const tag: Tag = {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 18, 0, 24),
    };
    const result = findPairedTag(doc, tag);
    assert.strictEqual(result, null);
  });
});
