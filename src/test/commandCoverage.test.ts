import * as assert from "assert";
import * as vscode from "vscode";

import { deleteSelectionWithMatchingPairs } from "../commands/deleteSelectionWithPairs";
import { deleteSurroundingTagPair } from "../commands/deleteSurroundingTagPair";
import { focusClassName } from "../commands/focusClassName";
import { insertSelfClosingTag } from "../commands/insertSelfClosingTag";
import { jumpToMatchingPair } from "../commands/jumpToMatchingPair";
import { surroundWithTag } from "../commands/surroundWithTag";
import { showTestEditor, withTagSurferSetting } from "./common";

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
  offset = 0,
  occurrence = 0
): vscode.Position {
  return document.positionAt(nthIndexOf(document.getText(), needle, occurrence) + offset);
}

function cursor(line: number, character: number): vscode.Selection {
  const position = new vscode.Position(line, character);
  return new vscode.Selection(position, position);
}

suite("Command Coverage Test Suite", () => {
  suite("insertSelfClosingTag", () => {
    test("inserts the configured tag and places the cursor at the tag name start", async () => {
      await withTagSurferSetting("defaultSelfClosingTag", "img", async () => {
        const editor = await showTestEditor("Hello");
        editor.selection = cursor(0, 5);

        await insertSelfClosingTag(editor);

        assert.strictEqual(editor.document.getText(), "Hello<img />");
        assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<img />", 1));
      });
    });

    test("keeps same-line multi-cursor inserts aligned", async () => {
      await withTagSurferSetting("defaultSelfClosingTag", "br", async () => {
        const editor = await showTestEditor("one two");
        editor.selections = [cursor(0, 0), cursor(0, 4)];

        await insertSelfClosingTag(editor);

        assert.strictEqual(editor.document.getText(), "<br />one <br />two");
        assert.deepStrictEqual(
          editor.selections.map(selection => selection.active),
          [positionAtText(editor.document, "<br />", 1, 0), positionAtText(editor.document, "<br />", 1, 1)]
        );
      });
    });
  });

  suite("surroundWithTag", () => {
    test("uses the configured inline tag for inline selections", async () => {
      await withTagSurferSetting("defaultInlineTag", "strong", async () => {
        const editor = await showTestEditor("test value");
        editor.selection = new vscode.Selection(0, 0, 0, 4);

        await surroundWithTag();

        assert.strictEqual(editor.document.getText(), "<strong>test</strong> value");
        assert.deepStrictEqual(
          editor.selection.active,
          positionAtText(editor.document, "<strong>", 1)
        );
      });
    });

    test("uses the configured block tag for trailing-next-line selections", async () => {
      await withTagSurferSetting("defaultBlockTag", "section", async () => {
        const editor = await showTestEditor("alpha\nbeta\nomega");
        editor.options = { insertSpaces: true, tabSize: 2 };
        editor.selection = new vscode.Selection(0, 0, 2, 0);

        await surroundWithTag();

        assert.strictEqual(editor.document.getText(), "<section>\n  alpha\n  beta\n</section>\nomega");
        assert.deepStrictEqual(
          editor.selection.active,
          positionAtText(editor.document, "<section>", 1)
        );
      });
    });

    test("inserts an empty block tag and places the cursor between the tags for empty selections", async () => {
      await withTagSurferSetting("defaultBlockTag", "section", async () => {
        const editor = await showTestEditor("Hello");
        editor.selection = cursor(0, 5);

        await surroundWithTag();

        assert.strictEqual(editor.document.getText(), "Hello<section></section>");
        assert.deepStrictEqual(
          editor.selection.active,
          positionAtText(editor.document, "<section></section>", 9)
        );
      });
    });
  });

  suite("deleteSurroundingTagPair", () => {
    test("removes the surrounding tag pair around the cursor", async () => {
      const editor = await showTestEditor("<div>Hello</div>");
      editor.selection = cursor(0, 7);

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "Hello");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
    });

    test("removes self-closing tags", async () => {
      const editor = await showTestEditor("<div><img /></div>");
      editor.selection = cursor(0, 7);

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "<div></div>");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 5));
    });

    test("finds the matching opener when the cursor is inside a closing tag", async () => {
      const editor = await showTestEditor("<div>Hello</div>");
      editor.selection = cursor(0, 13);

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "Hello");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
    });

    test("keeps multi-cursor delete results in the original selection order", async () => {
      const editor = await showTestEditor("<div>a</div> <span>b</span>");
      editor.selections = [cursor(0, 6), cursor(0, 20)];

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "a b");
      assert.deepStrictEqual(
        editor.selections.map(selection => selection.active),
        [new vscode.Position(0, 0), new vscode.Position(0, 2)]
      );
    });
  });

  suite("focusClassName", () => {
    test("inserts class attributes in html files", async () => {
      const editor = await showTestEditor("<div></div>");
      editor.selection = cursor(0, 2);

      await focusClassName();

      assert.strictEqual(editor.document.getText(), '<div class=""></div>');
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, 'class=""', 7));
    });

    test("inserts className attributes in jsx/tsx files", async () => {
      const editor = await showTestEditor("<div></div>", "tsx");
      editor.selection = cursor(0, 2);

      await focusClassName();

      assert.strictEqual(editor.document.getText(), '<div className=""></div>');
      assert.deepStrictEqual(
        editor.selection.active,
        positionAtText(editor.document, 'className=""', 11)
      );
    });

    test("inserts class attributes in svelte files", async () => {
      const editor = await showTestEditor("<div></div>", "svelte");
      editor.selection = cursor(0, 2);

      await focusClassName();

      assert.strictEqual(editor.document.getText(), '<div class=""></div>');
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, 'class=""', 7));
    });

    test("moves the cursor to the end of an existing class list", async () => {
      const editor = await showTestEditor('<div class="one two"></div>');
      editor.selection = cursor(0, 2);

      await focusClassName();

      assert.strictEqual(editor.document.getText(), '<div class="one two"></div>');
      assert.deepStrictEqual(
        editor.selection.active,
        positionAtText(editor.document, 'one two"', 7)
      );
    });

    test("keeps same-line multi-cursor class focus aligned when earlier tags insert attributes", async () => {
      const editor = await showTestEditor('<div></div> <span class="two"></span>');
      editor.selections = [cursor(0, 2), cursor(0, 14)];

      await focusClassName();

      assert.strictEqual(editor.document.getText(), '<div class=""></div> <span class="two"></span>');
      assert.deepStrictEqual(
        editor.selections.map(selection => selection.active),
        [positionAtText(editor.document, 'class=""', 7, 0), positionAtText(editor.document, 'two"', 3)]
      );
    });
  });

  suite("deleteSelectionWithMatchingPairs", () => {
    test("deletes a bracket and its match for empty selections", async () => {
      const editor = await showTestEditor("(value)");
      editor.selection = cursor(0, 0);

      await deleteSelectionWithMatchingPairs();

      assert.strictEqual(editor.document.getText(), "value");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
    });

    test("extends full-line selections to remove the line break and matching pair cleanup", async () => {
      const editor = await showTestEditor("<div>\n  hello\n</div>\nnext");
      editor.selection = new vscode.Selection(0, 0, 0, 5);

      await deleteSelectionWithMatchingPairs();

      assert.strictEqual(editor.document.getText(), "  hello\nnext");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
    });
  });

  suite("jumpToMatchingPair", () => {
    test("jumps to matching brackets when the cursor is on a bracket", async () => {
      const editor = await showTestEditor("call(foo)");
      editor.selection = cursor(0, 4);

      jumpToMatchingPair();

      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, ")", 0));
    });

    test("jumps from opening tags to their closing tags", async () => {
      const editor = await showTestEditor("<div>Hello</div>");
      editor.selection = cursor(0, 2);

      jumpToMatchingPair();

      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "</div>", 1));
    });

    test("falls back to the end-of-line bracket when there is no bracket under the cursor", async () => {
      const editor = await showTestEditor("function test() {\n  return 1;\n}");
      editor.selection = cursor(0, 10);

      jumpToMatchingPair();

      assert.deepStrictEqual(editor.selection.active, new vscode.Position(2, 0));
    });

    test("extends full-line selections to the matching closing line", async () => {
      const editor = await showTestEditor("function test() {\n  return 1;\n}");
      editor.selection = new vscode.Selection(0, 0, 0, "function test() {".length);

      jumpToMatchingPair();

      assert.deepStrictEqual(editor.selection.start, new vscode.Position(0, 0));
      assert.deepStrictEqual(editor.selection.end, new vscode.Position(2, 1));
    });
  });
});
