import { TextEditor } from "vscode";

export function getIndentationString(editor: TextEditor): string {
  const spacesUsed = editor.options.insertSpaces as boolean;
  if (spacesUsed) {
    const numOfUsedSpaces = editor.options.tabSize as number;
    return " ".repeat(numOfUsedSpaces);
  }
  return "\t";
}

export function getCurrentIndentation(content: string): string {
  const lines = content.split("\n");
  const indentationMatch = lines[0].match(/^\s*/);
  const indentation = indentationMatch ? indentationMatch[0] : "";
  return indentation;
}

export function indentContent(content: string, indentation: string): string {
  return content
    .split("\n")
    .map(line => indentation + line)
    .join("\n");
}

export function wrapContent(
  editor: TextEditor,
  tagName: string,
  content: string,
  inline: boolean
): string {
  if (inline) {
    return `<${tagName}>${content}</${tagName}>`;
  } else {
    const existingIndentation = getCurrentIndentation(content);
    const indentedContent = indentContent(content, getIndentationString(editor));
    return `${existingIndentation}<${tagName}>\n${indentedContent}\n${existingIndentation}</${tagName}>`;
  }
}
