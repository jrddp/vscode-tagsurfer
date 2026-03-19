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

export async function flushEditorUpdates(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setImmediate(resolve));
}

export async function withTagSurferSetting<T>(
  settingName: string,
  value: unknown,
  run: () => Promise<T>
): Promise<T> {
  const config = vscode.workspace.getConfiguration("tagSurfer");
  const inspect = config.inspect(settingName);
  const previousValue =
    inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;

  await config.update(settingName, value, vscode.ConfigurationTarget.Global);

  try {
    return await run();
  } finally {
    await config.update(settingName, previousValue, vscode.ConfigurationTarget.Global);
  }
}
