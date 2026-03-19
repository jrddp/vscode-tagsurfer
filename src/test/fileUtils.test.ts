import * as assert from "assert";
import * as vscode from "vscode";

import { getFileType } from "../utils/fileUtils";

function mockDocument(languageId: string, fileName: string): vscode.TextDocument {
  return {
    languageId,
    fileName,
  } as vscode.TextDocument;
}

suite("File Utils Test Suite", () => {
  test("detects html from languageId", () => {
    assert.strictEqual(getFileType(mockDocument("html", "/tmp/component.jsx")), "html");
  });

  test("detects jsx/tsx from languageId", () => {
    assert.strictEqual(getFileType(mockDocument("typescriptreact", "/tmp/component.html")), "jsx_tsx");
  });

  test("detects svelte from languageId", () => {
    assert.strictEqual(getFileType(mockDocument("svelte", "/tmp/component.html")), "svelte");
  });

  test("falls back to file extension", () => {
    assert.strictEqual(getFileType(mockDocument("plaintext", "/tmp/component.svelte")), "svelte");
  });
});
