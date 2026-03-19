import { TextEditor, Range, TextDocument, Position, TextEditorEdit, Selection } from "vscode";

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

function isPotentialTagStart(text: string, index: number): boolean {
  const nextChar = text[index + 1];
  return nextChar !== undefined && (nextChar === "!" || nextChar === "/" || nextChar === ">" || /[A-Za-z:_]/.test(nextChar));
}

function findTagEnd(text: string, startIndex: number): number {
  let quote: string | null = null;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (quote) {
      if (char === quote && text[i - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return i;
    }
  }

  return -1;
}

function parseTagText(tagText: string): Pick<Tag, "tagName" | "tagType"> | null {
  if (!tagText.startsWith("<") || !tagText.endsWith(">")) {
    return null;
  }

  if (tagText.startsWith("<!--")) {
    return null;
  }

  const innerText = tagText.slice(1, -1).trim();

  if (innerText.startsWith("!")) {
    return null;
  }

  if (innerText.startsWith("/")) {
    const tagName = innerText.slice(1).trim().match(/^[^\s/>]*/)?.[0] ?? "";
    return {
      tagName,
      tagType: "closing",
    };
  }

  const isSelfClosing = innerText.endsWith("/");
  const normalizedInnerText = isSelfClosing ? innerText.slice(0, -1).trimEnd() : innerText;
  const tagName = normalizedInnerText.match(/^[^\s/>]*/)?.[0] ?? "";

  return {
    tagName,
    tagType: isSelfClosing ? "selfClosing" : "opening",
  };
}

function scanTags(document: TextDocument, startOffset: number, endOffset: number): Tag[] {
  const fullText = document.getText();
  const clampedStart = Math.max(0, startOffset);
  const clampedEnd = Math.min(fullText.length, endOffset);
  const text = fullText.slice(clampedStart, clampedEnd);
  const tags: Tag[] = [];
  let index = 0;

  while (index < text.length) {
    const tagStart = text.indexOf("<", index);
    if (tagStart === -1) {
      break;
    }

    if (!isPotentialTagStart(text, tagStart)) {
      index = tagStart + 1;
      continue;
    }

    if (text.startsWith("<!--", tagStart)) {
      const commentEnd = text.indexOf("-->", tagStart + 4);
      if (commentEnd === -1) {
        break;
      }
      index = commentEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(text, tagStart + 1);
    if (tagEnd === -1) {
      break;
    }

    const parsedTag = parseTagText(text.slice(tagStart, tagEnd + 1));
    if (parsedTag) {
      const absoluteStart = clampedStart + tagStart;
      const absoluteEnd = clampedStart + tagEnd + 1;
      tags.push({
        ...parsedTag,
        tagRange: new Range(document.positionAt(absoluteStart), document.positionAt(absoluteEnd)),
      });
    }

    index = tagEnd + 1;
  }

  return tags;
}

function isPositionInsideRange(range: Range, position: Position): boolean {
  return !position.isBefore(range.start) && position.isBefore(range.end);
}

export function getEnclosingTag(document: TextDocument, position: Position): Tag | null {
  const maxLines = 10; // Maximum number of lines to search in either direction
  const startLine = Math.max(0, position.line - maxLines);
  const endLine = Math.min(document.lineCount - 1, position.line + maxLines);
  const startOffset = document.offsetAt(new Position(startLine, 0));
  const endOffset = document.offsetAt(new Position(endLine, document.lineAt(endLine).text.length));

  let matchingTag: Tag | null = null;
  for (const tag of scanTags(document, startOffset, endOffset)) {
    if (isPositionInsideRange(tag.tagRange, position)) {
      matchingTag = tag;
    }
  }

  return matchingTag ?? null;
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

  if (isOpeningTag) {
    const searchStartOffset = document.offsetAt(tag.tagRange.end);
    const searchEndOffset = document.offsetAt(
      new Position(searchEndLine, document.lineAt(searchEndLine).text.length)
    );
    const candidateTags = scanTags(document, searchStartOffset, searchEndOffset);
    let nestingLevel = 0;

    for (const candidateTag of candidateTags) {
      if (candidateTag.tagName !== tag.tagName || candidateTag.tagType === "selfClosing") {
        continue;
      }

      if (candidateTag.tagType === "opening") {
        nestingLevel++;
        continue;
      }

      if (nestingLevel === 0) {
        return candidateTag;
      }

      nestingLevel--;
    }
  } else {
    const searchStartOffset = document.offsetAt(new Position(searchEndLine, 0));
    const searchEndOffset = document.offsetAt(tag.tagRange.start);
    const candidateTags = scanTags(document, searchStartOffset, searchEndOffset);
    let nestingLevel = 0;

    for (let i = candidateTags.length - 1; i >= 0; i--) {
      const candidateTag = candidateTags[i];
      if (candidateTag.tagName !== tag.tagName || candidateTag.tagType === "selfClosing") {
        continue;
      }

      if (candidateTag.tagType === "closing") {
        nestingLevel++;
        continue;
      }

      if (nestingLevel === 0) {
        return candidateTag;
      }

      nestingLevel--;
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

export function getAllTagsInSelection(document: TextDocument, selection: Range | Selection): Tag[] {
  return scanTags(document, document.offsetAt(selection.start), document.offsetAt(selection.end));
}

type PositionType = "endOfName" | "endOfClassList";

type ClassNamePosition = {
  position: Position;
  positionType: PositionType;
};

export function findClassNamePos(document: TextDocument, tag: Tag): ClassNamePosition {
  const tagText = document.getText(tag.tagRange);

  // match class, className, or className={cn( up until (including) the closing quote
  const classNameRegex = /class(?:Name)?\s*=\s*(?:{cn\()?["'][^"']*/;
  const match = tagText.match(classNameRegex);

  if (match) {
    const matchStartOffset = match.index!;
    const matchEndOffset = matchStartOffset + match[0].length;
    let classNameEndPos = document.positionAt(
      document.offsetAt(tag.tagRange.start) + matchEndOffset
    );

    return {
      position: classNameEndPos,
      positionType: "endOfClassList",
    };
  } else {
    const tagNameEndPos = tag.tagRange.start.translate(0, tag.tagName.length + 1);

    return {
      position: tagNameEndPos,
      positionType: "endOfName",
    };
  }
}
