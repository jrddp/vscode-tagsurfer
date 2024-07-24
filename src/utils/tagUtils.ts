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

export function wrapContent(
  editor: TextEditor,
  tagName: string,
  content: string,
  inline: boolean
): string {
  if (inline) {
    return `<${tagName}>${content}</${tagName}>`;
  } else {
    const indentation = getCurrentIndentation(content);
    return `${indentation}<${tagName}>\n${getIndentationString(
      editor
    )}${content}\n${indentation}</${tagName}>`;
  }
}
