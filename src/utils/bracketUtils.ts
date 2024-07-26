import { Position, Range, Selection, TextDocument } from "vscode";

export const openBrackets = ["(", "[", "{", "<"] as const;
export const closeBrackets = [")", "]", "}", ">"] as const;

type OpenBracket = (typeof openBrackets)[number];
type CloseBracket = (typeof closeBrackets)[number];
export type Bracket = OpenBracket | CloseBracket;

export type BracketLoc =
  | { bracket: OpenBracket; position: Position; type: "opening" }
  | { bracket: CloseBracket; position: Position; type: "closing" };

function isOpenBracket(character: string): character is OpenBracket {
  return (openBrackets as readonly string[]).includes(character);
}

function isCloseBracket(character: string): character is CloseBracket {
  return (closeBrackets as readonly string[]).includes(character);
}

function getMatch(bracket: Bracket): Bracket {
  return isOpenBracket(bracket)
    ? closeBrackets[openBrackets.indexOf(bracket)]
    : openBrackets[closeBrackets.indexOf(bracket)];
}

export function asBracketLoc(character: string, position: Position): BracketLoc | null {
  if (isOpenBracket(character)) {
    return {
      bracket: character,
      position,
      type: "opening",
    };
  } else if (isCloseBracket(character)) {
    return {
      bracket: character,
      position,
      type: "closing",
    };
  }
  return null;
}

export function findMatchingBracket(
  document: TextDocument,
  bracketLoc: BracketLoc
): Position | null {
  const isOpenBracket = bracketLoc.type === "opening";
  const bracket = bracketLoc.bracket;
  const matchBracket = getMatch(bracket);
  const startPosition = bracketLoc.position;

  let nestingLevel = 0;
  let quote = null;
  const searchForward = isOpenBracket;
  const maxLines = document.lineCount;

  if (searchForward) {
    for (let lineIndex = startPosition.line; lineIndex < maxLines; lineIndex++) {
      const line = document.lineAt(lineIndex).text;
      const startChar = lineIndex === startPosition.line ? startPosition.character + 1 : 0;

      for (let charIndex = startChar; charIndex < line.length; charIndex++) {
        if (quote) {
          if (line[charIndex] === quote) {
            quote = null;
          }
          continue;
        }
        if (line[charIndex] === '"' || line[charIndex] === "'" || line[charIndex] === "`") {
          quote = line[charIndex];
          continue;
        }
        if (line[charIndex] === bracket) {
          nestingLevel++;
          continue;
        }
        if (line[charIndex] === matchBracket) {
          if (nestingLevel === 0) {
            return new Position(lineIndex, charIndex);
          }
          nestingLevel--;
        }
      }
    }
  } else {
    for (let lineIndex = startPosition.line; lineIndex >= 0; lineIndex--) {
      const line = document.lineAt(lineIndex).text;
      const startChar =
        lineIndex === startPosition.line ? startPosition.character - 1 : line.length - 1;

      for (let charIndex = startChar; charIndex >= 0; charIndex--) {
        if (line[charIndex] === bracket) {
          nestingLevel++;
        }
        if (line[charIndex] === matchBracket) {
          if (nestingLevel === 0) {
            return new Position(lineIndex, charIndex);
          }
          nestingLevel--;
        }
      }
    }
  }

  return null; // No matching bracket found
}

export function getAllBracketsInSelection(
  document: TextDocument,
  selection: Range | Selection
): BracketLoc[] {
  let selStart = selection.start;
  let selEnd = selection.end;

  const text = document.getText(selection);
  const brackets: BracketLoc[] = [];

  for (let i = 0; i < text.length; i++) {
    const pos = document.positionAt(document.offsetAt(selection.start) + i);
    const bracketLoc = asBracketLoc(text[i], pos);
    if (bracketLoc) {
      brackets.push(bracketLoc);
    }
  }

  return brackets;
}
