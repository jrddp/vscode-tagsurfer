import * as assert from "assert";
import * as vscode from "vscode";

import { deleteSelectionWithMatchingPairs } from "../commands/deleteSelectionWithPairs";
import { deleteSurroundingTagPair } from "../commands/deleteSurroundingTagPair";
import { focusClassName } from "../commands/focusClassName";
import { insertSelfClosingTag } from "../commands/insertSelfClosingTag";
import { jumpToMatchingPair } from "../commands/jumpToMatchingPair";
import { surroundWithTag } from "../commands/surroundWithTag";
import { swapWithNextSibling, swapWithPreviousSibling } from "../commands/swapWithSibling";
import { flushEditorUpdates, showTestEditor, withTagSurferSetting } from "./common";

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

function createSvelteScriptConstantSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
  return ["first", "second", "third"].map(name => {
    const line = positionAtText(document, name).line;
    const lineText = document.lineAt(line).text;
    const nameStart = lineText.indexOf(name);

    return new vscode.DocumentSymbol(
      name,
      "",
      vscode.SymbolKind.Constant,
      new vscode.Range(line, 2, line, lineText.length),
      new vscode.Range(line, nameStart, line, nameStart + name.length)
    );
  });
}

function createMethodSymbol(
  document: vscode.TextDocument,
  name: string,
  startLine: number,
  endLine: number
): vscode.DocumentSymbol {
  const lineText = document.lineAt(startLine).text;
  const nameStart = lineText.indexOf(name);
  return new vscode.DocumentSymbol(
    name,
    "",
    vscode.SymbolKind.Method,
    new vscode.Range(startLine, 2, endLine, document.lineAt(endLine).text.length),
    new vscode.Range(startLine, nameStart, startLine, nameStart + name.length)
  );
}

function createClassSymbol(
  document: vscode.TextDocument,
  name: string,
  startLine: number,
  endLine: number,
  children: vscode.DocumentSymbol[]
): vscode.DocumentSymbol {
  const lineText = document.lineAt(startLine).text;
  const nameStart = lineText.indexOf(name);
  const symbol = new vscode.DocumentSymbol(
    name,
    "",
    vscode.SymbolKind.Class,
    new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length),
    new vscode.Range(startLine, nameStart, startLine, nameStart + name.length)
  );
  symbol.children.push(...children);
  return symbol;
}

function createNestedSvelteClassSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
  const alphaLine = positionAtText(document, "Alpha").line;
  const betaLine = positionAtText(document, "Beta").line;
  const oneLine = positionAtText(document, "one").line;
  const twoLine = positionAtText(document, "two").line;
  const redLine = positionAtText(document, "red").line;
  const blueLine = positionAtText(document, "blue").line;

  return [
    createClassSymbol(document, "Alpha", alphaLine, alphaLine + 8, [
      createMethodSymbol(document, "one", oneLine, oneLine + 2),
      createMethodSymbol(document, "two", twoLine, twoLine + 2),
    ]),
    createClassSymbol(document, "Beta", betaLine, betaLine + 8, [
      createMethodSymbol(document, "red", redLine, redLine + 2),
      createMethodSymbol(document, "blue", blueLine, blueLine + 2),
    ]),
  ];
}

async function withCapturedWindowMessages<T>(
  run: (messages: { info: string[]; error: string[] }) => Promise<T> | T
): Promise<T> {
  const messages = { info: [] as string[], error: [] as string[] };
  const windowApi = vscode.window as unknown as {
    showInformationMessage: (...args: any[]) => Thenable<unknown>;
    showErrorMessage: (...args: any[]) => Thenable<unknown>;
  };
  const originalShowInformationMessage = windowApi.showInformationMessage;
  const originalShowErrorMessage = windowApi.showErrorMessage;

  windowApi.showInformationMessage = async (...args: any[]) => {
    messages.info.push(String(args[0]));
    return undefined;
  };
  windowApi.showErrorMessage = async (...args: any[]) => {
    messages.error.push(String(args[0]));
    return undefined;
  };

  try {
    return await run(messages);
  } finally {
    windowApi.showInformationMessage = originalShowInformationMessage;
    windowApi.showErrorMessage = originalShowErrorMessage;
  }
}

async function withMockedExecuteCommand<T>(
  mock: (command: string, ...args: any[]) => Thenable<unknown> | unknown,
  run: () => Promise<T> | T
): Promise<T> {
  const commandsApi = vscode.commands as unknown as {
    executeCommand: (command: string, ...args: any[]) => Thenable<unknown>;
  };
  const originalExecuteCommand = commandsApi.executeCommand;

  commandsApi.executeCommand = async (command: string, ...args: any[]) => mock(command, ...args);

  try {
    return await run();
  } finally {
    commandsApi.executeCommand = originalExecuteCommand;
  }
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
        await flushEditorUpdates();

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
        await flushEditorUpdates();

        assert.strictEqual(editor.document.getText(), "<section>\n  alpha\n  beta\n</section>\nomega");
        assert.deepStrictEqual(
          editor.selection.active,
          positionAtText(editor.document, "<section>", 1)
        );
      });
    });

    test("places the cursor on the opening tag name for indented multiline surrounds", async () => {
      const editor = await showTestEditor("  alpha\n  beta\nomega");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = new vscode.Selection(0, 0, 2, 0);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(editor.document.getText(), "  <div>\n    alpha\n    beta\n  </div>\nomega");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 3));
    });

    test("inserts an empty block tag and leaves the cursor on the opening tag name for empty selections", async () => {
      await withTagSurferSetting("defaultBlockTag", "section", async () => {
        const editor = await showTestEditor("Hello");
        editor.selection = cursor(0, 5);

        await surroundWithTag();
        await flushEditorUpdates();

        assert.strictEqual(editor.document.getText(), "Hello<section></section>");
        assert.deepStrictEqual(
          editor.selection.active,
          positionAtText(editor.document, "<section></section>", 1)
        );
      });
    });

    test("wraps the word under the cursor when there is no explicit selection", async () => {
      const editor = await showTestEditor("hello world");
      editor.selection = cursor(0, 1);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(editor.document.getText(), "<span>hello</span> world");
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<span>", 1));
    });

    test("wraps the surrounding tag when the cursor is inside an opening tag definition", async () => {
      const editor = await showTestEditor("<div></div>");
      editor.selection = cursor(0, 2);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(editor.document.getText(), "<span><div></div></span>");
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<span>", 1));
    });

    test("wraps the surrounding tag when the cursor is inside a closing tag definition", async () => {
      const editor = await showTestEditor("<div></div>");
      editor.selection = cursor(0, 8);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(editor.document.getText(), "<span><div></div></span>");
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<span>", 1));
    });

    test("wraps self-closing tags instead of the tag name text", async () => {
      const editor = await showTestEditor("<img />");
      editor.selection = cursor(0, 2);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(editor.document.getText(), "<span><img /></span>");
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<span>", 1));
    });

    test("wraps multiline tags as block selections when the cursor is inside the tag definition", async () => {
      await withTagSurferSetting("defaultBlockTag", "section", async () => {
        const editor = await showTestEditor("<div>\n  alpha\n</div>\nomega");
        editor.options = { insertSpaces: true, tabSize: 2 };
        editor.selection = cursor(0, 2);

        await surroundWithTag();
        await flushEditorUpdates();

        assert.strictEqual(
          editor.document.getText(),
          "<section>\n  <div>\n    alpha\n  </div>\n</section>\nomega"
        );
        assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<section>", 1));
      });
    });

    test("wraps indented multiline tags as block selections when the cursor is inside the tag definition", async () => {
      const editor = await showTestEditor(
        [
          "          <div class=\"flex-1\">",
          "            <p>alpha</p>",
          "          </div>",
        ].join("\n")
      );
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = cursor(0, 12);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(
        editor.document.getText(),
        [
          "          <div>",
          "            <div class=\"flex-1\">",
          "              <p>alpha</p>",
          "            </div>",
          "          </div>",
        ].join("\n")
      );
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 11));
    });

    test("keeps empty block insertion behavior on whitespace and leaves the cursor on the opening tag name", async () => {
      const editor = await showTestEditor("hello world");
      editor.selection = cursor(0, 5);

      await surroundWithTag();
      await flushEditorUpdates();

      assert.strictEqual(editor.document.getText(), "hello<div></div> world");
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<div></div>", 1));
    });

    test("reapplies the opening-tag cursor after Vim escape runs", async () => {
      const editor = await showTestEditor("hello world");
      editor.selection = new vscode.Selection(0, 0, 0, 5);

      await withMockedExecuteCommand(async command => {
        if (command === "extension.vim_escape") {
          editor.selection = cursor(0, 18);
        }
        return undefined;
      }, async () => {
        await surroundWithTag();
        await flushEditorUpdates();
      });

      assert.strictEqual(editor.document.getText(), "<span>hello</span> world");
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "<span>", 1));
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

    test("unindents block wrappers created by surroundWithTag", async () => {
      const editor = await showTestEditor("<div>\n  alpha\n</div>");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = cursor(0, 2);

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "alpha");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
    });

    test("unindents indented block wrappers while preserving outer indentation", async () => {
      const editor = await showTestEditor("  <div>\n    alpha\n  </div>");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = cursor(0, 4);

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "  alpha");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 2));
    });

    test("unindents wrappers when the opening tag spans multiple tag-only lines", async () => {
      const editor = await showTestEditor("  <div\n    class=\"x\"\n  >\n    alpha\n  </div>");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = cursor(1, 8);

      await deleteSurroundingTagPair(editor);

      assert.strictEqual(editor.document.getText(), "  alpha");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 2));
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

    test("reapplies the class cursor after Vim insert runs", async () => {
      const editor = await showTestEditor("<div></div>");
      editor.selection = cursor(0, 2);

      let vimInsertCalls = 0;

      await withMockedExecuteCommand(async command => {
        if (command === "extension.vim_insert") {
          vimInsertCalls += 1;
          editor.selection = cursor(0, 18);
        }
        return undefined;
      }, async () => {
        await focusClassName();
        await flushEditorUpdates();
        await flushEditorUpdates();
      });

      assert.strictEqual(editor.document.getText(), '<div class=""></div>');
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, 'class=""', 7));
      assert.strictEqual(vimInsertCalls, 1);
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

    test("unindents wrapped block content when deleting an opening tag with its matching pair", async () => {
      const editor = await showTestEditor("<div>\n  alpha\n</div>");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = new vscode.Selection(0, 0, 0, 5);

      await deleteSelectionWithMatchingPairs();

      assert.strictEqual(editor.document.getText(), "alpha");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 0));
    });

    test("preserves outer indentation when deleting an indented opening tag with its matching pair", async () => {
      const editor = await showTestEditor("  <div>\n    alpha\n  </div>");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = new vscode.Selection(0, 2, 0, 7);

      await deleteSelectionWithMatchingPairs();

      assert.strictEqual(editor.document.getText(), "  alpha");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 2));
    });

    test("unindents wrappers when deleting a multiline opening tag with its matching pair", async () => {
      const editor = await showTestEditor("  <div\n    class=\"x\"\n  >\n    alpha\n  </div>");
      editor.options = { insertSpaces: true, tabSize: 2 };
      editor.selection = new vscode.Selection(0, 2, 2, 3);

      await deleteSelectionWithMatchingPairs();

      assert.strictEqual(editor.document.getText(), "  alpha");
      assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 2));
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

    test("ignores self-closing tags without showing a message", async () => {
      const editor = await showTestEditor("<CharacterSprite />");
      editor.selection = cursor(0, 2);

      await withCapturedWindowMessages(messages => {
        jumpToMatchingPair();

        assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 2));
        assert.deepStrictEqual(messages.info, []);
        assert.deepStrictEqual(messages.error, []);
      });
    });

    test("shows an error when a non-self-closing tag is missing its pair", async () => {
      const editor = await showTestEditor("<div>Hello");
      editor.selection = cursor(0, 2);

      await withCapturedWindowMessages(messages => {
        jumpToMatchingPair();

        assert.deepStrictEqual(editor.selection.active, new vscode.Position(0, 2));
        assert.deepStrictEqual(messages.info, []);
        assert.deepStrictEqual(messages.error, ["Unable to find matching pair for <div>."]);
      });
    });
  });

  suite("swapWithSibling", () => {
    test("reuses the symbol provider result across consecutive swaps in the same document", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      const originalText = editor.document.getText();
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "first"),
        positionAtText(editor.document, "first")
      );
      const symbols = createSvelteScriptConstantSymbols(editor.document);

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return symbols;
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 1);
      assert.strictEqual(editor.document.getText(), originalText);
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "first"));
    });

    test("invalidates the swap cache after the cursor moves before the next swap", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "first"),
        positionAtText(editor.document, "first")
      );
      const symbols = createSvelteScriptConstantSymbols(editor.document);

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return symbols;
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        editor.selection = new vscode.Selection(
          positionAtText(editor.document, "third"),
          positionAtText(editor.document, "third")
        );
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 2);
    });

    test("reuses the symbol provider result across a longer swap chain without cursor movement", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "first"),
        positionAtText(editor.document, "first")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return createSvelteScriptConstantSymbols(editor.document);
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        await swapWithPreviousSibling();
        await swapWithNextSibling();
      });

      assert.strictEqual(providerCalls, 1);
      assert.strictEqual(
        editor.document.getText(),
        [
          "<script lang=\"ts\">",
          "  export const second = 2;",
          "  export const first = 1;",
          "  export const third = 3;",
          "</script>",
        ].join("\n")
      );
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "first"));
    });

    test("invalidates the swap cache when moving to leading indentation before the same symbol", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      const originalText = editor.document.getText();
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "first"),
        positionAtText(editor.document, "first")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return createSvelteScriptConstantSymbols(editor.document);
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        editor.selection = cursor(positionAtText(editor.document, "first").line, 0);
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 2);
      assert.strictEqual(editor.document.getText(), originalText);
      assert.deepStrictEqual(
        editor.selection.active,
        new vscode.Position(
          positionAtText(editor.document, "first").line,
          editor.document.lineAt(positionAtText(editor.document, "first").line).firstNonWhitespaceCharacterIndex
        )
      );
    });

    test("invalidates the swap cache when moving to a nested child inside the cached parent range", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "class Alpha {",
          "  one() {",
          "    return 1;",
          "  }",
          "",
          "  two() {",
          "    return 2;",
          "  }",
          "}",
          "",
          "class Beta {",
          "  red() {",
          "    return 3;",
          "  }",
          "",
          "  blue() {",
          "    return 4;",
          "  }",
          "}",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "Alpha"),
        positionAtText(editor.document, "Alpha")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return createNestedSvelteClassSymbols(editor.document);
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        editor.selection = new vscode.Selection(
          positionAtText(editor.document, "blue"),
          positionAtText(editor.document, "blue")
        );
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 2);
      assert.strictEqual(
        editor.document.getText(),
        [
          "<script lang=\"ts\">",
          "class Beta {",
          "  blue() {",
          "    return 4;",
          "  }",
          "",
          "  red() {",
          "    return 3;",
          "  }",
          "}",
          "",
          "class Alpha {",
          "  one() {",
          "    return 1;",
          "  }",
          "",
          "  two() {",
          "    return 2;",
          "  }",
          "}",
          "</script>",
        ].join("\n")
      );
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "blue"));
    });

    test("invalidates the swap cache when moving to nested child indentation inside the cached parent range", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "class Alpha {",
          "  one() {",
          "    return 1;",
          "  }",
          "",
          "  two() {",
          "    return 2;",
          "  }",
          "}",
          "",
          "class Beta {",
          "  red() {",
          "    return 3;",
          "  }",
          "",
          "  blue() {",
          "    return 4;",
          "  }",
          "}",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "Alpha"),
        positionAtText(editor.document, "Alpha")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return createNestedSvelteClassSymbols(editor.document);
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        editor.selection = cursor(positionAtText(editor.document, "blue").line, 0);
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 2);
      assert.strictEqual(
        editor.document.getText(),
        [
          "<script lang=\"ts\">",
          "class Beta {",
          "  blue() {",
          "    return 4;",
          "  }",
          "",
          "  red() {",
          "    return 3;",
          "  }",
          "}",
          "",
          "class Alpha {",
          "  one() {",
          "    return 1;",
          "  }",
          "",
          "  two() {",
          "    return 2;",
          "  }",
          "}",
          "</script>",
        ].join("\n")
      );
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "blue"));
    });

    test("invalidates the swap cache when moving into a nested method body before the next swap", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "class Alpha {",
          "  one() {",
          "    return 1;",
          "  }",
          "",
          "  two() {",
          "    return 2;",
          "  }",
          "}",
          "",
          "class Beta {",
          "  red() {",
          "    return 3;",
          "  }",
          "",
          "  blue() {",
          "    return 4;",
          "  }",
          "}",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "Alpha"),
        positionAtText(editor.document, "Alpha")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return createNestedSvelteClassSymbols(editor.document);
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        editor.selection = new vscode.Selection(
          positionAtText(editor.document, "return 4;"),
          positionAtText(editor.document, "return 4;")
        );
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 2);
      assert.strictEqual(
        editor.document.getText(),
        [
          "<script lang=\"ts\">",
          "class Beta {",
          "  blue() {",
          "    return 4;",
          "  }",
          "",
          "  red() {",
          "    return 3;",
          "  }",
          "}",
          "",
          "class Alpha {",
          "  one() {",
          "    return 1;",
          "  }",
          "",
          "  two() {",
          "    return 2;",
          "  }",
          "}",
          "</script>",
        ].join("\n")
      );
      assert.deepStrictEqual(editor.selection.active, positionAtText(editor.document, "return 4;"));
    });

    test("invalidates the swap cache after an unrelated document edit changes the version", async () => {
      const editor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      editor.selection = new vscode.Selection(
        positionAtText(editor.document, "first"),
        positionAtText(editor.document, "first")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          return createSvelteScriptConstantSymbols(editor.document);
        }

        return undefined;
      }, async () => {
        await swapWithNextSibling();
        await editor.edit(editBuilder => {
          editBuilder.insert(new vscode.Position(4, editor.document.lineAt(4).text.length), " ");
        });
        await swapWithPreviousSibling();
      });

      assert.strictEqual(providerCalls, 2);
    });

    test("does not reuse a cached swap group across different documents", async () => {
      const firstEditor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      firstEditor.selection = new vscode.Selection(
        positionAtText(firstEditor.document, "first"),
        positionAtText(firstEditor.document, "first")
      );
      const secondEditor = await showTestEditor(
        [
          "<script lang=\"ts\">",
          "  export const first = 1;",
          "  export const second = 2;",
          "  export const third = 3;",
          "</script>",
        ].join("\n"),
        "svelte"
      );
      secondEditor.selection = new vscode.Selection(
        positionAtText(secondEditor.document, "first"),
        positionAtText(secondEditor.document, "first")
      );

      let providerCalls = 0;
      await withMockedExecuteCommand(async command => {
        if (command === "vscode.executeDocumentSymbolProvider") {
          providerCalls += 1;
          const activeDocument = vscode.window.activeTextEditor?.document;
          return activeDocument ? createSvelteScriptConstantSymbols(activeDocument) : undefined;
        }

        return undefined;
      }, async () => {
        await vscode.window.showTextDocument(firstEditor.document);
        await swapWithNextSibling();
        await vscode.window.showTextDocument(secondEditor.document);
        await swapWithNextSibling();
      });

      assert.strictEqual(providerCalls, 2);
    });
  });
});
