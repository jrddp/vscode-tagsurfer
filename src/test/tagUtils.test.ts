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
  getSurroundingTag,
  getAllTagsInSelection,
  findClassNamePos,
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

  test("getEnclosingTag with cursor on open bracket", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const result = getEnclosingTag(doc, new vscode.Position(0, 0));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("getEnclosingTag with cursor on closing bracket", async () => {
    const doc = await createTestDocument("<div>Hello</div>");
    const result = getEnclosingTag(doc, new vscode.Position(0, 4));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
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

suite("getSurroundingTag Test Suite", () => {
  test("Cursor inside tag", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 3));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Cursor in content", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 7));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Nested tags", async () => {
    const doc = await createTestDocument("<div><span>content</span></div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 12));
    assert.strictEqual(result?.tagName, "span");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 5, 0, 11));
  });

  test("Cursor at start of document", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 0));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Cursor at end of document", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 16));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "closing");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 12, 0, 18));
  });

  test("Avoid self-closing tag", async () => {
    const doc = await createTestDocument('<div><img src="test.jpg" />content</div>');
    const result = getSurroundingTag(doc, new vscode.Position(0, 27));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("Multiple nested tags", async () => {
    const doc = await createTestDocument("<div><span><p>content</p></span></div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 16));
    assert.strictEqual(result?.tagName, "p");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 11, 0, 14));
  });

  test("Tag with attributes", async () => {
    const doc = await createTestDocument('<div class="test" id="main">content</div>');
    const result = getSurroundingTag(doc, new vscode.Position(0, 29));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 28));
  });

  test("Cursor between tags", async () => {
    const doc = await createTestDocument("<div></div><span></span>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 12));
    assert.strictEqual(result?.tagName, "span");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 11, 0, 17));
  });

  test("Multi-line tag", async () => {
    const doc = await createTestDocument(
      '<div\n    class="test"\n    id="main">\n    content\n</div>'
    );
    const result = getSurroundingTag(doc, new vscode.Position(3, 7));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 2, 14));
  });

  test("Comment inside tag", async () => {
    const doc = await createTestDocument("<div><!-- <span> -->content</div>");
    const result = getSurroundingTag(doc, new vscode.Position(0, 22));
    assert.strictEqual(result?.tagName, "div");
    assert.strictEqual(result?.tagType, "opening");
    assert.deepStrictEqual(result?.tagRange, new vscode.Range(0, 0, 0, 5));
  });

  test("No surrounding tag", async () => {
    const doc = await createTestDocument("Just some text");
    const result = getSurroundingTag(doc, new vscode.Position(0, 10));
    assert.strictEqual(result, null);
  });
});

suite("getAllTagsInSelection Test Suite", () => {
  test("Single tag - Opening only", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const selection = new vscode.Range(0, 0, 0, 16);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    });
  });

  test("Single tag - Opening only, reversed selection", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const selection = new vscode.Selection(0, 16, 0, 0);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    });
  });

  test("Single tag - Opening and closing", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const selection = new vscode.Range(0, 0, 0, 18);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    });
    assert.deepStrictEqual(result[1], {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 12, 0, 18),
    });
  });

  test("Multiple tags in selection", async () => {
    const doc = await createTestDocument("<div><span>content</span></div>");
    const selection = new vscode.Range(0, 0, 0, 31);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 4);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    });
    assert.deepStrictEqual(result[1], {
      tagName: "span",
      tagType: "opening",
      tagRange: new vscode.Range(0, 5, 0, 11),
    });
    assert.deepStrictEqual(result[2], {
      tagName: "span",
      tagType: "closing",
      tagRange: new vscode.Range(0, 18, 0, 25),
    });
    assert.deepStrictEqual(result[3], {
      tagName: "div",
      tagType: "closing",
      tagRange: new vscode.Range(0, 25, 0, 31),
    });
  });

  test("Partial tag selection", async () => {
    const doc = await createTestDocument("<div>content</div>");
    const selection = new vscode.Range(0, 2, 0, 14);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 0);
  });

  test("Self-closing tag", async () => {
    const doc = await createTestDocument('<div><img src="test.jpg" /></div>');
    const selection = new vscode.Range(0, 0, 0, 32);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[1], {
      tagName: "img",
      tagType: "selfClosing",
      tagRange: new vscode.Range(0, 5, 0, 27),
    });
  });

  test("Tag with attributes", async () => {
    const doc = await createTestDocument('<div class="test" id="main">content</div>');
    const selection = new vscode.Range(0, 0, 0, 41);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 28),
    });
  });

  test("Multi-line selection", async () => {
    const doc = await createTestDocument("<div>\n  <span>content</span>\n</div>");
    const selection = new vscode.Range(0, 0, 2, 6);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 4);
    assert.deepStrictEqual(result[1], {
      tagName: "span",
      tagType: "opening",
      tagRange: new vscode.Range(1, 2, 1, 8),
    });
  });

  test("No tags in selection", async () => {
    const doc = await createTestDocument("Just some text without tags");
    const selection = new vscode.Range(0, 0, 0, 28);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 0);
  });

  test("Nested tags of same type", async () => {
    const doc = await createTestDocument("<div><div>nested</div></div>");
    const selection = new vscode.Range(0, 0, 0, 28);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 4);
    assert.deepStrictEqual(result[1], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 5, 0, 10),
    });
  });

  test("Comment within selection", async () => {
    const doc = await createTestDocument("<div><!-- <span> -->content</div>");
    const selection = new vscode.Range(0, 0, 0, 32);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 0, 5),
    });
  });

  test("Tag spanning multiple lines", async () => {
    const doc = await createTestDocument('<div\n  class="test"\n  id="main">\ncontent\n</div>');
    const selection = new vscode.Range(0, 0, 4, 6);
    const result = getAllTagsInSelection(doc, selection);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], {
      tagName: "div",
      tagType: "opening",
      tagRange: new vscode.Range(0, 0, 2, 12),
    });
  });
});

suite("findClassNamePos Tests", () => {
  test("Find className in simple tag", async () => {
    const document = await createTestDocument('<div className="test-class"></div>');
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 28),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 26));
  });

  test("Find class in simple tag", async () => {
    const document = await createTestDocument('<div class="test-class"></div>');
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 24),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 22));
  });

  test("Find className with cn function", async () => {
    const document = await createTestDocument('<div className={cn("test-class")}></div>');
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 34),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 30));
  });

  test("No className found", async () => {
    const document = await createTestDocument('<div id="test-id"></div>');
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 18),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfName");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 4));
  });

  test("className with single quotes", async () => {
    const document = await createTestDocument("<div className='test-class'></div>");
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 27),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 26));
  });

  test("className in multi-line tag: 2nd line", async () => {
    const document = await createTestDocument(`<div\n    className="test-class"\n    id="test-id"\n></div>`);
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 3, 1),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(1, 25));
  });

  test("className in multi-line tag: 3rd line", async () => {
    const document = await createTestDocument(`<div\n    id="test-id"\n    className="test-class"\n></div>`);
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 3, 1),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(2, 25));
  });

  test("className in multi-line tag with offset", async () => {
    const document = await createTestDocument(`  <div\n    className="test-class"\n    id="test-id"\n></div>`);
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 2, 3, 1),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(1, 25));
  });

  test("className in multi-line tag with offset: 3rd line", async () => {
    const document = await createTestDocument(`  <div\n    id="test-id"\n    className="test-class"\n></div>`);
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 2, 3, 1),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(2, 25));
  });

  test("className with multiple classes", async () => {
    const document = await createTestDocument('<div className="class1 class2 class3"></div>');
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 38),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 36));
  });

  test("Self-closing tag with className", async () => {
    const document = await createTestDocument('<input className="test-class" />');
    const tag = {
      tagName: "input",
      tagType: "selfClosing" as const,
      tagRange: new vscode.Range(0, 0, 0, 32),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 28));
  });

  test("className after other attributes", async () => {
    const document = await createTestDocument('<div id="test-id" className="test-class"></div>');
    const tag = {
      tagName: "div",
      tagType: "opening" as const,
      tagRange: new vscode.Range(0, 0, 0, 41),
    };

    const result = findClassNamePos(document, tag);

    assert.strictEqual(result.positionType, "endOfClassList");
    assert.deepStrictEqual(result.position, new vscode.Position(0, 39));
  });
});
