import { TextEditor, Range, TextDocument, Position, TextEditorEdit } from "vscode";

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

export function getSurroundingTag(document: TextDocument, position: Position): Tag | null {
  // First, check if there's a directly enclosing tag
  const enclosingTag = getEnclosingTag(document, position);
  if (enclosingTag) {
    return enclosingTag;
  }

  // If no directly enclosing tag, search backwards for the start of a surrounding tag
  const maxLines = 1000; // Maximum number of lines to search backwards
  let startLine = Math.max(0, position.line - maxLines);
  let nestingLevel = 1; // we assume we are already nested inside a tag
  let inHtmlComment = false; // track comments (<!-- -->)

  for (let i = position.line; i >= startLine; i--) {
    const line = document.lineAt(i).text;
    const startChar = i === position.line ? position.character : line.length - 1;

    for (let j = startChar; j >= 0; j--) {
      if (line[j] === ">") {
        if (inHtmlComment) {
          continue;
        } else if (j > 1 && line[j - 1] === "-" && line[j - 2] === "-") {
          inHtmlComment = true;
          continue;
        } else if (j > 0 && line[j - 1] === "/") {
          nestingLevel++; // ignore next '<'
          continue; // Ignore self-closing tags
        }
      } else if (line[j] === "<") {
        if (inHtmlComment) {
          if (
            j + 3 < line.length &&
            line[j + 1] === "!" &&
            line[j + 2] === "-" &&
            line[j + 3] === "-"
          ) {
            inHtmlComment = false;
          }
          continue;
        } else if (j + 1 < line.length && line[j + 1] === "/") {
          nestingLevel++; // Found a closing tag
        } else {
          nestingLevel--; // Found an opening tag
          if (nestingLevel === 0) {
            const tagStart = new Position(i, j);
            return getEnclosingTag(document, tagStart);
          }
        }
      }
    }
  }

  return null;
}

// will delete the tag and any remaining lines that would be empty after deletion
export async function deleteTag(
  editor: TextEditor,
  tag: Tag,
  editBuilder?: TextEditorEdit
): Promise<void> {
  const document = editor.document;
  if (!editBuilder) {
    await editor.edit(editBuilder => {
      deleteTag(editor, tag, editBuilder);
    });
    return;
  }

  // delete start line if there is only whitespace before
  const deleteStartLine =
    document.lineAt(tag.tagRange.start.line).text.slice(0, tag.tagRange.start.character).trim() ===
    "";
  // delete end line if there is only whitespace after
  const deleteEndLine =
    document.lineAt(tag.tagRange.end.line).text.slice(tag.tagRange.end.character).trim() === "";

  const startLine = tag.tagRange.start.line;
  const endLine = tag.tagRange.end.line;
  if (startLine === endLine) {
    if (deleteStartLine && deleteEndLine) {
      editBuilder.delete(new Range(startLine, 0, startLine + 1, 0));
    } else {
      editBuilder.delete(tag.tagRange);
    }
  } else {
    // tag spans multiple lines
    if (deleteStartLine) {
      editBuilder.delete(new Range(startLine, 0, startLine + 1, 0));
    } else {
      // there is other content on the line. only delete the start of the tag onwards
      editBuilder.delete(
        new Range(
          tag.tagRange.start.line,
          tag.tagRange.start.character,
          tag.tagRange.start.line,
          document.lineAt(tag.tagRange.start.line).text.length
        )
      );
    }
    if (deleteEndLine) {
      editBuilder.delete(new Range(endLine, 0, endLine + 1, 0));
    } else {
      // there is other content on the line. only delete up to end of the tag and maintain indentation
      const lineText = document.lineAt(tag.tagRange.end.line).text;
      // the regex simply matches all starting whitespace until the first non-whitespace character
      const whiteSpace = document
        .lineAt(tag.tagRange.end.line)
        .text.slice(0, lineText.match(/^\s*/)?.[0].length ?? 0);
      editBuilder.replace(
        new Range(tag.tagRange.end.line, 0, tag.tagRange.end.line, tag.tagRange.end.character),
        whiteSpace
      );
    }
    for (let i = startLine + 1; i < endLine; i++) {
      editBuilder.delete(new Range(i, 0, i + 1, 0));
    }
  }
}
