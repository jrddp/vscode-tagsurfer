import { Position, TextDocument } from "vscode";

export function findMatchingBracket(
  document: TextDocument,
  startPosition: Position,
  bracket: string
): Position | null {
  const openBrackets = "([{<";
  const closeBrackets = ")]}>";
  const isOpenBracket = openBrackets.includes(bracket);
  const matchIndex = isOpenBracket ? openBrackets.indexOf(bracket) : closeBrackets.indexOf(bracket);
  const matchBracket = isOpenBracket ? closeBrackets[matchIndex] : openBrackets[matchIndex];

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
