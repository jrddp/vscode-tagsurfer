import { TextEditor, Range, TextDocument, Position } from "vscode";

export type TagType = "opening" | "closing" | "selfClosing";
export type Tag = {
  tagName: string;
  tagType: TagType;
  // start inclusive, end exclusive
  tagRange: Range;
};

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

export function getEnclosingTag(document: TextDocument, position: Position): Tag | null {
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
        if (i !== position.line || j !== startChar) {
          nestingLevel++;
        }
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
        if (i !== position.line || j !== startChar) {
          nestingLevel++;
        }
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
  let tagType: "opening" | "closing" | "selfClosing";

  if (tagText.startsWith("</")) {
    tagType = "closing";
  } else if (tagText.endsWith("/>")) {
    tagType = "selfClosing";
  } else {
    tagType = "opening";
  }

  return {
    tagName,
    tagType,
    tagRange: new Range(startPosition, endPosition),
  };
}

export function findPairedTag(document: TextDocument, tag: Tag): Tag | null {
  if (tag.tagType === "selfClosing") {
    return null;
  }

  const maxLines = 1000; // Maximum number of lines to search in either direction
  const isOpeningTag = tag.tagType === "opening";
  const searchStartLine = isOpeningTag ? tag.tagRange.end.line : tag.tagRange.start.line;
  const searchEndLine = isOpeningTag
    ? Math.min(document.lineCount - 1, searchStartLine + maxLines)
    : Math.max(0, searchStartLine - maxLines);

  let nestingLevel = 0;
  let currentTagName = "";
  let parsingName = false;

  if (isOpeningTag) {
    // Search forward for closing tag
    let tagStart: Position | null = null;
    for (let i = searchStartLine; i <= searchEndLine; i++) {
      const line = document.lineAt(i).text;
      const startChar = i === searchStartLine ? tag.tagRange.end.character : 0;

      for (let j = startChar; j < line.length; j++) {
        if (line[j] === "<") {
          tagStart = new Position(i, j);
          currentTagName = "";
          parsingName = true;
        } else if (line[j] === ">") {
          if (currentTagName === "/" + tag.tagName) {
            if (nestingLevel === 0) {
              return {
                tagName: tag.tagName,
                tagType: "closing",
                tagRange: new Range(tagStart!, new Position(i, j + 1)),
              };
            }
            nestingLevel--;
          } else if (currentTagName === tag.tagName) {
            nestingLevel++;
          }
          currentTagName = "";
        } else if (parsingName) {
          const char = line[j];
          // check if char is a valid tag name character
          if (char.match(/[\/a-zA-Z0-9]/)) {
            currentTagName += char;
          } else {
            parsingName = false;
          }
        }
      }
    }
  } else {
    // Search backward for opening tag
    let tagEnd: Position | null = null;
    for (let i = searchStartLine; i >= searchEndLine; i--) {
      const line = document.lineAt(i).text;
      const startChar = i === searchStartLine ? tag.tagRange.start.character - 1 : line.length - 1;

      for (let j = startChar; j >= 0; j--) {
        if (line[j] === ">") {
          tagEnd = new Position(i, j + 1);
        } else if (line[j] === "<") {
          currentTagName = line.substring(j).match(/<([\/a-zA-Z0-9]+)/)?.[1] ?? "";
          if (currentTagName === tag.tagName) {
            if (nestingLevel === 0) {
              return {
                tagName: tag.tagName,
                tagType: "opening",
                tagRange: new Range(new Position(i, j), tagEnd!),
              };
            }
            nestingLevel--;
          } else if (currentTagName === "/" + tag.tagName) {
            nestingLevel++;
          }
        }
      }
    }
  }

  return null; // No matching tag found
}
