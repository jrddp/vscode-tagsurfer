import * as vscode from "vscode";

let testDocumentId = 0;

export async function createTestDocument(
  content: string,
  fileExtension = "html"
): Promise<vscode.TextDocument> {
  const uri = vscode.Uri.parse(`untitled:tagsurfer-test-${testDocumentId++}.${fileExtension}`);
  let document = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), content);
  await vscode.workspace.applyEdit(edit);
  document = await vscode.workspace.openTextDocument(uri);
  return document;
}

export async function showTestEditor(
  content: string,
  fileExtension = "html"
): Promise<vscode.TextEditor> {
  const document = await createTestDocument(content, fileExtension);
  return vscode.window.showTextDocument(document);
}
