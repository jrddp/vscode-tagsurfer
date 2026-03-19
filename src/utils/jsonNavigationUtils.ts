import * as vscode from "vscode";

type Direction = "next" | "previous";

type JsonNavNode = {
  anchorOffset: number;
  anchorEndOffset: number;
  startOffset: number;
  endOffset: number;
  parent: JsonNavNode | null;
  children: JsonNavNode[];
};

type ParsedJsonValue = {
  startOffset: number;
  endOffset: number;
  children: JsonNavNode[];
};

type JsonNavigationTree = {
  container: JsonNavNode;
  roots: JsonNavNode[];
};

function isJsonDocument(document: vscode.TextDocument): boolean {
  if (document.languageId === "json" || document.languageId === "jsonc") {
    return true;
  }

  const extension = document.fileName.split(".").pop()?.toLowerCase();
  return extension === "json" || extension === "jsonc";
}

function isWhitespace(character: string): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function skipTrivia(text: string, startOffset: number): number {
  let offset = startOffset;

  while (offset < text.length) {
    if (isWhitespace(text[offset])) {
      offset++;
      continue;
    }

    if (text.startsWith("//", offset)) {
      offset += 2;
      while (offset < text.length && text[offset] !== "\n" && text[offset] !== "\r") {
        offset++;
      }
      continue;
    }

    if (text.startsWith("/*", offset)) {
      const commentEnd = text.indexOf("*/", offset + 2);
      return commentEnd === -1 ? text.length : skipTrivia(text, commentEnd + 2);
    }

    break;
  }

  return offset;
}

function parseString(
  text: string,
  startOffset: number
): { startOffset: number; endOffset: number } | null {
  if (text[startOffset] !== '"') {
    return null;
  }

  let offset = startOffset + 1;
  while (offset < text.length) {
    const character = text[offset];
    if (character === "\\") {
      offset += 2;
      continue;
    }

    if (character === '"') {
      return {
        startOffset,
        endOffset: offset + 1,
      };
    }

    if (character === "\n" || character === "\r") {
      return null;
    }

    offset++;
  }

  return null;
}

function parseLiteral(text: string, startOffset: number): ParsedJsonValue | null {
  const slice = text.slice(startOffset);
  const numberMatch = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(slice);
  if (numberMatch) {
    return {
      startOffset,
      endOffset: startOffset + numberMatch[0].length,
      children: [],
    };
  }

  for (const literal of ["true", "false", "null"]) {
    if (slice.startsWith(literal)) {
      return {
        startOffset,
        endOffset: startOffset + literal.length,
        children: [],
      };
    }
  }

  return null;
}

function createNode(
  anchorOffset: number,
  anchorEndOffset: number,
  startOffset: number,
  endOffset: number,
  children: JsonNavNode[]
): JsonNavNode {
  const node: JsonNavNode = {
    anchorOffset,
    anchorEndOffset,
    startOffset,
    endOffset,
    parent: null,
    children,
  };

  for (const child of children) {
    child.parent = node;
  }

  return node;
}

function parseObject(text: string, startOffset: number): ParsedJsonValue | null {
  const children: JsonNavNode[] = [];
  let offset = startOffset + 1;

  while (offset < text.length) {
    offset = skipTrivia(text, offset);
    if (offset >= text.length) {
      return null;
    }

    if (text[offset] === "}") {
      return {
        startOffset,
        endOffset: offset + 1,
        children,
      };
    }

    const key = parseString(text, offset);
    if (!key) {
      return null;
    }

    offset = skipTrivia(text, key.endOffset);
    if (text[offset] !== ":") {
      return null;
    }

    offset = skipTrivia(text, offset + 1);
    const value = parseValue(text, offset);
    if (!value) {
      return null;
    }

    children.push(
      createNode(key.startOffset, key.endOffset, key.startOffset, value.endOffset, value.children)
    );

    offset = skipTrivia(text, value.endOffset);
    if (text[offset] === ",") {
      offset = skipTrivia(text, offset + 1);
      if (text[offset] === "}") {
        return {
          startOffset,
          endOffset: offset + 1,
          children,
        };
      }
      continue;
    }

    if (text[offset] === "}") {
      return {
        startOffset,
        endOffset: offset + 1,
        children,
      };
    }

    return null;
  }

  return null;
}

function parseArray(text: string, startOffset: number): ParsedJsonValue | null {
  const children: JsonNavNode[] = [];
  let offset = startOffset + 1;

  while (offset < text.length) {
    offset = skipTrivia(text, offset);
    if (offset >= text.length) {
      return null;
    }

    if (text[offset] === "]") {
      return {
        startOffset,
        endOffset: offset + 1,
        children,
      };
    }

    const value = parseValue(text, offset);
    if (!value) {
      return null;
    }

    children.push(
      createNode(
        value.startOffset,
        value.children.length > 0 ? value.startOffset + 1 : value.endOffset,
        value.startOffset,
        value.endOffset,
        value.children
      )
    );

    offset = skipTrivia(text, value.endOffset);
    if (text[offset] === ",") {
      offset = skipTrivia(text, offset + 1);
      if (text[offset] === "]") {
        return {
          startOffset,
          endOffset: offset + 1,
          children,
        };
      }
      continue;
    }

    if (text[offset] === "]") {
      return {
        startOffset,
        endOffset: offset + 1,
        children,
      };
    }

    return null;
  }

  return null;
}

function parseValue(text: string, startOffset: number): ParsedJsonValue | null {
  if (startOffset >= text.length) {
    return null;
  }

  const character = text[startOffset];
  if (character === "{") {
    return parseObject(text, startOffset);
  }

  if (character === "[") {
    return parseArray(text, startOffset);
  }

  if (character === '"') {
    const stringValue = parseString(text, startOffset);
    if (!stringValue) {
      return null;
    }

    return {
      startOffset,
      endOffset: stringValue.endOffset,
      children: [],
    };
  }

  return parseLiteral(text, startOffset);
}

function parseJsonNavigationTree(document: vscode.TextDocument): JsonNavigationTree | null {
  if (!isJsonDocument(document)) {
    return null;
  }

  const text = document.getText();
  const valueStart = skipTrivia(text, 0);
  const parsedValue = parseValue(text, valueStart);
  if (!parsedValue) {
    return null;
  }

  if (skipTrivia(text, parsedValue.endOffset) !== text.length) {
    return null;
  }

  const container = createNode(
    parsedValue.startOffset,
    parsedValue.children.length > 0 ? parsedValue.startOffset + 1 : parsedValue.endOffset,
    parsedValue.startOffset,
    parsedValue.endOffset,
    parsedValue.children
  );
  return {
    container,
    roots: container.children.length > 0 ? container.children : [container],
  };
}

function containsOffset(node: JsonNavNode, offset: number): boolean {
  return offset >= node.startOffset && offset < node.endOffset;
}

function isOffsetInAnchor(node: JsonNavNode, offset: number): boolean {
  return offset >= node.anchorOffset && offset < node.anchorEndOffset;
}

function findDeepestContainingNode(
  nodes: readonly JsonNavNode[],
  offset: number
): JsonNavNode | null {
  for (const node of nodes) {
    if (!containsOffset(node, offset)) {
      continue;
    }

    return findDeepestContainingNode(node.children, offset) ?? node;
  }

  return null;
}

function findAdjacentNode(
  nodes: readonly JsonNavNode[],
  offset: number,
  direction: Direction
): JsonNavNode | null {
  if (direction === "next") {
    return nodes.find(node => node.anchorOffset > offset) ?? null;
  }

  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index];
    if (node.anchorOffset < offset) {
      return node;
    }
  }

  return null;
}

function findSiblingTarget(
  siblings: readonly JsonNavNode[],
  currentIndex: number,
  direction: Direction
): JsonNavNode | null {
  if (siblings.length <= 1 || currentIndex === -1) {
    return null;
  }

  const delta = direction === "next" ? 1 : -1;
  return siblings[(currentIndex + delta + siblings.length) % siblings.length] ?? null;
}

function findSiblingPositionTarget(
  tree: JsonNavigationTree,
  offset: number,
  direction: Direction
): number | null {
  const currentNode = findDeepestContainingNode(tree.roots, offset);
  if (!currentNode) {
    if (tree.roots.length === 0) {
      return null;
    }

    const adjacentRoot =
      findAdjacentNode(tree.roots, offset, direction) ??
      (direction === "next" ? tree.roots[0] : tree.roots[tree.roots.length - 1]);
    return adjacentRoot?.anchorOffset ?? null;
  }

  if (currentNode.children.length > 0 && offset >= currentNode.children[0].startOffset) {
    const childTarget = findAdjacentNode(currentNode.children, offset, direction);
    if (childTarget) {
      return childTarget.anchorOffset;
    }

    const wrappedChild =
      direction === "next"
        ? currentNode.children[0]
        : currentNode.children[currentNode.children.length - 1];
    return wrappedChild?.anchorOffset ?? null;
  }

  const siblings = currentNode.parent?.children ?? tree.roots;
  const currentIndex = siblings.indexOf(currentNode);
  return findSiblingTarget(siblings, currentIndex, direction)?.anchorOffset ?? null;
}

function findChildPositionTarget(tree: JsonNavigationTree, offset: number): number | null {
  const currentNode = findDeepestContainingNode(tree.roots, offset);
  if (!currentNode) {
    return tree.roots[0]?.anchorOffset ?? null;
  }

  const childTarget = currentNode.children[0];
  if (childTarget) {
    return childTarget.anchorOffset;
  }

  const siblings = currentNode.parent?.children ?? tree.roots;
  const currentIndex = siblings.indexOf(currentNode);
  return findSiblingTarget(siblings, currentIndex, "next")?.anchorOffset ?? null;
}

function findParentPositionTarget(tree: JsonNavigationTree, offset: number): number | null {
  const currentNode = findDeepestContainingNode(tree.roots, offset);
  if (!currentNode) {
    return null;
  }

  if (currentNode.children.length === 0) {
    return currentNode.parent === tree.container ? null : currentNode.parent?.anchorOffset ?? null;
  }

  if (isOffsetInAnchor(currentNode, offset)) {
    return currentNode.parent === tree.container ? null : currentNode.parent?.anchorOffset ?? null;
  }

  return currentNode.anchorOffset;
}

export function findJsonSiblingPositions(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  direction: Direction
): { hasSymbols: boolean; positions: (vscode.Position | null)[] } | null {
  const tree = parseJsonNavigationTree(document);
  if (!tree) {
    return null;
  }

  if (tree.roots.length === 0) {
    return {
      hasSymbols: false,
      positions: selections.map(() => null),
    };
  }

  return {
    hasSymbols: true,
    positions: selections.map(selection => {
      const targetOffset = findSiblingPositionTarget(tree, document.offsetAt(selection.active), direction);
      return targetOffset === null ? null : document.positionAt(targetOffset);
    }),
  };
}

export function findJsonChildPositions(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[]
): { hasSymbols: boolean; positions: (vscode.Position | null)[] } | null {
  const tree = parseJsonNavigationTree(document);
  if (!tree) {
    return null;
  }

  if (tree.roots.length === 0) {
    return {
      hasSymbols: false,
      positions: selections.map(() => null),
    };
  }

  return {
    hasSymbols: true,
    positions: selections.map(selection => {
      const targetOffset = findChildPositionTarget(tree, document.offsetAt(selection.active));
      return targetOffset === null ? null : document.positionAt(targetOffset);
    }),
  };
}

export function findJsonParentPositions(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[]
): { hasSymbols: boolean; positions: (vscode.Position | null)[] } | null {
  const tree = parseJsonNavigationTree(document);
  if (!tree) {
    return null;
  }

  if (tree.roots.length === 0) {
    return {
      hasSymbols: false,
      positions: selections.map(() => null),
    };
  }

  return {
    hasSymbols: true,
    positions: selections.map(selection => {
      const targetOffset = findParentPositionTarget(tree, document.offsetAt(selection.active));
      return targetOffset === null ? null : document.positionAt(targetOffset);
    }),
  };
}
