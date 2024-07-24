import { TextEditor, Range, TextDocument, Position } from "vscode";

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

export function getEnclosingTag(
  document: TextDocument,
  position: Position
): { tagName: string; isClosing: boolean; tagRange: Range } | null {
  const maxLines = 10; // Maximum number of lines to search in either direction
  let startLine = Math.max(0, position.line - maxLines);
  let endLine = Math.min(document.lineCount - 1, position.line + maxLines);

  let startPosition: Position | null = null;
  let endPosition: Position | null = null;

  // Search backwards for opening '<'
  let nestingLevel = 0;
  for (let i = position.line; i >= startLine; i--) {
    const line = document.lineAt(i).text;
    const startChar = i === position.line ? position.character : line.length - 1;
    for (let j = startChar; j >= 0; j--) {
      if (line[j] === "<") {
        if (nestingLevel === 0) {
          startPosition = new Position(i, j);
          break;
        }
        nestingLevel--;
      } else if (line[j] === ">") {
        nestingLevel++;
      }
    }
    if (startPosition) {
      break;
    }
  }

  if (!startPosition) {
    return null; // No opening '<' found
  }

  nestingLevel = 0;
  // Search forwards for closing '>'
  for (let i = position.line; i <= endLine; i++) {
    const line = document.lineAt(i).text;
    const startChar = i === position.line ? position.character : 0;
    for (let j = startChar; j < line.length; j++) {
      if (line[j] === ">") {
        if (nestingLevel === 0) {
          endPosition = new Position(i, j + 1);
          break;
        }
        nestingLevel--;
      } else if (line[j] === "<") {
        nestingLevel++;
      }
    }
    if (endPosition) {
      break;
    }
  }

  if (!endPosition) {
    return null; // No closing '>' found
  }

  const tagText = document.getText(new Range(startPosition, endPosition));
  const tagNameMatch = tagText.match(/<\/?(\w+)/);
  if (!tagNameMatch) {
    return null; // Invalid tag format
  }

  const tagName = tagNameMatch[1];
  const isClosing = tagText.startsWith("</");

  return {
    tagName,
    isClosing,
    tagRange: new Range(startPosition, endPosition),
  };
}
