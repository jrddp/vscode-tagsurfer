import { Position, Range, TextDocument } from "vscode";

export type SvelteBlockKind = "if" | "each" | "await" | "key" | "snippet";
type SvelteBlockMarkerType = "start" | "branch" | "end";
type SvelteBranchKind = "else" | "else-if" | "then" | "catch";

export type SvelteBlockTag = {
  kind: SvelteBlockKind;
  markerType: SvelteBlockMarkerType;
  branchKind?: SvelteBranchKind;
  tagRange: Range;
};

type ParsedSvelteBlockTag =
  | (SvelteBlockTag & { markerType: "start" | "end" })
  | (Omit<SvelteBlockTag, "kind"> & { markerType: "branch"; kind: SvelteBlockKind | null });

type SvelteBlock = {
  kind: SvelteBlockKind;
  tags: SvelteBlockTag[];
};

const pairedBlockKinds: SvelteBlockKind[] = ["if", "each", "await", "key", "snippet"];

function isPositionInsideRange(range: Range, position: Position): boolean {
  return !position.isBefore(range.start) && position.isBefore(range.end);
}

function hasKeywordBoundary(content: string, keyword: string): boolean {
  const nextChar = content[keyword.length];
  return nextChar === undefined || /\s/.test(nextChar);
}

function findTagEnd(text: string, startIndex: number): number {
  let quote: string | null = null;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = startIndex + 2; i < text.length; i++) {
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

    if (char === "(") {
      parenDepth++;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(parenDepth - 1, 0);
      continue;
    }
    if (char === "[") {
      bracketDepth++;
      continue;
    }
    if (char === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0);
      continue;
    }
    if (char === "{") {
      braceDepth++;
      continue;
    }
    if (char === "}") {
      if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        return i;
      }
      braceDepth = Math.max(braceDepth - 1, 0);
    }
  }

  return -1;
}

function parseSvelteBlockTag(text: string, startIndex: number): ParsedSvelteBlockTag | null {
  if (text[startIndex] !== "{") {
    return null;
  }

  const prefix = text[startIndex + 1];
  if (prefix !== "#" && prefix !== ":" && prefix !== "/") {
    return null;
  }

  const endIndex = findTagEnd(text, startIndex);
  if (endIndex === -1) {
    return null;
  }

  const content = text.slice(startIndex + 1, endIndex).trim();
  const tagRange = new Range(0, startIndex, 0, endIndex + 1);

  for (const kind of pairedBlockKinds) {
    if (content.startsWith(`#${kind}`) && hasKeywordBoundary(content, `#${kind}`)) {
      return { kind, markerType: "start", tagRange };
    }
    if (content.startsWith(`/${kind}`) && hasKeywordBoundary(content, `/${kind}`)) {
      return { kind, markerType: "end", tagRange };
    }
  }

  if (/^:else\s+if(?:\s|$)/.test(content)) {
    return { kind: "if", markerType: "branch", branchKind: "else-if", tagRange };
  }
  if (/^:else(?:\s|$)/.test(content)) {
    return { kind: null, markerType: "branch", branchKind: "else", tagRange };
  }
  if (/^:then(?:\s|$)/.test(content)) {
    return { kind: "await", markerType: "branch", branchKind: "then", tagRange };
  }
  if (/^:catch(?:\s|$)/.test(content)) {
    return { kind: "await", markerType: "branch", branchKind: "catch", tagRange };
  }

  return null;
}

function normalizeRange(document: TextDocument, range: Range): Range {
  return new Range(document.positionAt(range.start.character), document.positionAt(range.end.character));
}

function scanSvelteBlocks(document: TextDocument): SvelteBlock[] {
  const text = document.getText();
  const blocks: SvelteBlock[] = [];
  const blockStack: SvelteBlock[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("<!--", i)) {
      const commentEnd = text.indexOf("-->", i + 4);
      if (commentEnd === -1) {
        break;
      }
      i = commentEnd + 2;
      continue;
    }

    if (text[i] !== "{") {
      continue;
    }

    const parsedTag = parseSvelteBlockTag(text, i);
    if (!parsedTag) {
      continue;
    }

    const tag: SvelteBlockTag = {
      ...parsedTag,
      kind: parsedTag.kind ?? "if",
      tagRange: normalizeRange(document, parsedTag.tagRange),
    };

    if (parsedTag.markerType === "start") {
      const block: SvelteBlock = { kind: parsedTag.kind, tags: [tag] };
      blocks.push(block);
      blockStack.push(block);
    } else if (parsedTag.markerType === "branch") {
      const activeBlock = blockStack[blockStack.length - 1];
      if (!activeBlock) {
        i = document.offsetAt(tag.tagRange.end) - 1;
        continue;
      }

      const branchKind = parsedTag.kind ?? activeBlock.kind;
      const canAttachElse =
        parsedTag.branchKind === "else" && (activeBlock.kind === "if" || activeBlock.kind === "each");
      const canAttachSpecific = parsedTag.kind === activeBlock.kind;

      if (canAttachElse || canAttachSpecific) {
        activeBlock.tags.push({ ...tag, kind: branchKind });
      }
    } else {
      const activeBlock = blockStack[blockStack.length - 1];
      if (activeBlock && activeBlock.kind === parsedTag.kind) {
        activeBlock.tags.push(tag);
        blockStack.pop();
      }
    }

    i = document.offsetAt(tag.tagRange.end) - 1;
  }

  return blocks;
}

export function findNextSvelteBlockTag(document: TextDocument, position: Position): SvelteBlockTag | null {
  const blocks = scanSvelteBlocks(document);

  for (const block of blocks) {
    for (let i = 0; i < block.tags.length; i++) {
      if (isPositionInsideRange(block.tags[i].tagRange, position)) {
        return block.tags[(i + 1) % block.tags.length];
      }
    }
  }

  return null;
}
