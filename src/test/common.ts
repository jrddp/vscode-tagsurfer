import * as vscode from "vscode";

export async function createTestDocument(content: string): Promise<vscode.TextDocument> {
  const uri = vscode.Uri.parse("untitled:tagsurfer-test.html");
  let document = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), content);
  await vscode.workspace.applyEdit(edit);
  document = await vscode.workspace.openTextDocument(uri);
  return document;
}
