import * as vscode from "vscode";

import { findPairedTag, getEnclosingTag, type Tag } from "./tagUtils";

type Direction = "next" | "previous";

type NormalizedSymbol = {
  symbol: vscode.DocumentSymbol;
  parent: NormalizedSymbol | null;
  children: NormalizedSymbol[];
};

const navigableSymbolKinds = new Set<vscode.SymbolKind>([
  vscode.SymbolKind.Class,
  vscode.SymbolKind.Constant,
  vscode.SymbolKind.Constructor,
  vscode.SymbolKind.Enum,
  vscode.SymbolKind.Field,
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Interface,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Module,
  vscode.SymbolKind.Namespace,
  vscode.SymbolKind.Package,
  vscode.SymbolKind.Property,
  vscode.SymbolKind.Struct,
  vscode.SymbolKind.Variable,
]);

function isDocumentSymbol(
  symbol: vscode.DocumentSymbol | vscode.SymbolInformation
): symbol is vscode.DocumentSymbol {
  return "selectionRange" in symbol;
}

function isNavigableSymbol(symbol: vscode.DocumentSymbol): boolean {
  return navigableSymbolKinds.has(symbol.kind);
}

function comparePositions(left: vscode.Position, right: vscode.Position): number {
  if (left.line !== right.line) {
    return left.line - right.line;
  }

  return left.character - right.character;
}

function compareSymbols(left: vscode.DocumentSymbol, right: vscode.DocumentSymbol): number {
  const selectionDiff = comparePositions(left.selectionRange.start, right.selectionRange.start);
  if (selectionDiff !== 0) {
    return selectionDiff;
  }

  return comparePositions(left.range.start, right.range.start);
}

function asDocumentSymbols(
  symbols: readonly (vscode.DocumentSymbol | vscode.SymbolInformation)[]
): vscode.DocumentSymbol[] {
  if (symbols.every(isDocumentSymbol)) {
    return [...symbols];
  }

  return symbols.map(symbol => {
    if (isDocumentSymbol(symbol)) {
      return symbol;
    }

    return new vscode.DocumentSymbol(
      symbol.name,
      symbol.containerName ?? "",
      symbol.kind,
      symbol.location.range,
      symbol.location.range
    );
  });
}

function normalizeSymbols(
  symbols: readonly vscode.DocumentSymbol[],
  parent: NormalizedSymbol | null
): NormalizedSymbol[] {
  const normalized: NormalizedSymbol[] = [];
  const sortedSymbols = [...symbols].sort(compareSymbols);

  for (const symbol of sortedSymbols) {
    if (isNavigableSymbol(symbol)) {
      const node: NormalizedSymbol = {
        symbol,
        parent,
        children: [],
      };
      node.children = normalizeSymbols(symbol.children, node);
      normalized.push(node);
      continue;
    }

    normalized.push(...normalizeSymbols(symbol.children, parent));
  }

  return normalized;
}

function findDeepestContainingSymbol(
  symbols: readonly NormalizedSymbol[],
  position: vscode.Position
): NormalizedSymbol | null {
  for (const symbol of symbols) {
    if (!symbol.symbol.range.contains(position)) {
      continue;
    }

    return findDeepestContainingSymbol(symbol.children, position) ?? symbol;
  }

  return null;
}

function findSiblingTarget(
  siblings: readonly NormalizedSymbol[],
  currentIndex: number,
  direction: Direction
): NormalizedSymbol | null {
  if (siblings.length <= 1 || currentIndex === -1) {
    return null;
  }

  const delta = direction === "next" ? 1 : -1;
  const wrappedIndex = (currentIndex + delta + siblings.length) % siblings.length;
  return siblings[wrappedIndex] ?? null;
}

function isPositionInsideTag(tag: Tag, position: vscode.Position): boolean {
  return !position.isBefore(tag.tagRange.start) && position.isBefore(tag.tagRange.end);
}

function findOnlySiblingTagPairTarget(
  document: vscode.TextDocument,
  symbol: NormalizedSymbol,
  position: vscode.Position
): vscode.Position | null {
  const openingTag = getEnclosingTag(document, symbol.symbol.selectionRange.start);
  if (!openingTag || openingTag.tagType !== "opening") {
    return null;
  }

  const pairedTag = findPairedTag(document, openingTag);
  if (!pairedTag) {
    return null;
  }

  if (isPositionInsideTag(openingTag, position)) {
    return pairedTag.tagRange.start.translate(0, 1);
  }

  if (isPositionInsideTag(pairedTag, position)) {
    return openingTag.tagRange.start.translate(0, 1);
  }

  return null;
}

function findOnlySiblingFallbackTarget(
  document: vscode.TextDocument,
  symbol: NormalizedSymbol,
  position: vscode.Position
): vscode.Position {
  const tagPairTarget = findOnlySiblingTagPairTarget(document, symbol, position);
  if (tagPairTarget) {
    return tagPairTarget;
  }

  if (position.isEqual(symbol.symbol.range.end)) {
    return symbol.symbol.selectionRange.start;
  }

  return symbol.symbol.range.end;
}

function findAdjacentSymbol(
  symbols: readonly NormalizedSymbol[],
  position: vscode.Position,
  direction: Direction
): NormalizedSymbol | null {
  if (direction === "next") {
    return symbols.find(symbol => symbol.symbol.selectionRange.start.isAfter(position)) ?? null;
  }

  for (let index = symbols.length - 1; index >= 0; index--) {
    const symbol = symbols[index];
    if (symbol.symbol.selectionRange.start.isBefore(position)) {
      return symbol;
    }
  }

  return null;
}

function findChildTarget(
  children: readonly NormalizedSymbol[],
): NormalizedSymbol | null {
  if (children.length === 0) {
    return null;
  }

  return children[0];
}

function findSiblingPositionTarget(
  document: vscode.TextDocument,
  roots: readonly NormalizedSymbol[],
  position: vscode.Position,
  direction: Direction
): vscode.Position | null {
  const currentSymbol = findDeepestContainingSymbol(roots, position);
  if (!currentSymbol) {
    if (roots.length === 1) {
      return findOnlySiblingFallbackTarget(document, roots[0], position);
    }

    const wrappedRoot =
      findAdjacentSymbol(roots, position, direction) ??
      (direction === "next" ? roots[0] : roots[roots.length - 1]);
    return wrappedRoot?.symbol.selectionRange.start ?? null;
  }

  const siblings = currentSymbol.parent?.children ?? roots;
  if (siblings.length === 1) {
    const tagPairTarget = findOnlySiblingTagPairTarget(document, currentSymbol, position);
    if (tagPairTarget) {
      return tagPairTarget;
    }
  }

  if (
    currentSymbol.children.length > 0 &&
    position.isAfterOrEqual(currentSymbol.children[0].symbol.range.start)
  ) {
    if (currentSymbol.children.length === 1) {
      return findOnlySiblingFallbackTarget(document, currentSymbol.children[0], position);
    }

    const childTarget = findAdjacentSymbol(currentSymbol.children, position, direction);
    if (childTarget) {
      return childTarget.symbol.selectionRange.start;
    }

    const wrappedChild =
      direction === "next"
        ? currentSymbol.children[0]
        : currentSymbol.children[currentSymbol.children.length - 1];
    return wrappedChild.symbol.selectionRange.start;
  }

  if (siblings.length === 1) {
    return findOnlySiblingFallbackTarget(document, currentSymbol, position);
  }

  const currentIndex = siblings.indexOf(currentSymbol);
  const siblingTarget = findSiblingTarget(siblings, currentIndex, direction);
  return siblingTarget?.symbol.selectionRange.start ?? null;
}

function findParentPositionTarget(
  roots: readonly NormalizedSymbol[],
  position: vscode.Position
): vscode.Position | null {
  const currentSymbol = findDeepestContainingSymbol(roots, position);
  if (!currentSymbol) {
    return null;
  }

  if (currentSymbol.symbol.selectionRange.contains(position)) {
    return currentSymbol.parent?.symbol.selectionRange.start ?? null;
  }

  return currentSymbol.symbol.selectionRange.start;
}

function findChildPositionTarget(
  roots: readonly NormalizedSymbol[],
  position: vscode.Position
): vscode.Position | null {
  const currentSymbol = findDeepestContainingSymbol(roots, position);
  if (!currentSymbol) {
    return findChildTarget(roots)?.symbol.selectionRange.start ?? null;
  }

  const childTarget = findChildTarget(currentSymbol.children);
  if (childTarget) {
    return childTarget.symbol.selectionRange.start;
  }

  const siblings = currentSymbol.parent?.children ?? roots;
  const currentIndex = siblings.indexOf(currentSymbol);
  return findSiblingTarget(siblings, currentIndex, "next")?.symbol.selectionRange.start ?? null;
}

async function getNavigableSymbols(document: vscode.TextDocument): Promise<NormalizedSymbol[]> {
  const symbols = await vscode.commands.executeCommand<
    (vscode.DocumentSymbol | vscode.SymbolInformation)[] | undefined
  >("vscode.executeDocumentSymbolProvider", document.uri);

  if (!symbols || symbols.length === 0) {
    return [];
  }

  return normalizeSymbols(asDocumentSymbols(symbols), null);
}

export async function findSiblingSymbolPositions(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  direction: Direction
): Promise<{ hasSymbols: boolean; positions: (vscode.Position | null)[] }> {
  const roots = await getNavigableSymbols(document);
  if (roots.length === 0) {
    return {
      hasSymbols: false,
      positions: selections.map(() => null),
    };
  }

  return {
    hasSymbols: true,
    positions: selections.map(selection =>
      findSiblingPositionTarget(document, roots, selection.active, direction)
    ),
  };
}

export async function findParentSymbolPositions(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[]
): Promise<{ hasSymbols: boolean; positions: (vscode.Position | null)[] }> {
  const roots = await getNavigableSymbols(document);
  if (roots.length === 0) {
    return {
      hasSymbols: false,
      positions: selections.map(() => null),
    };
  }

  return {
    hasSymbols: true,
    positions: selections.map(selection => findParentPositionTarget(roots, selection.active)),
  };
}

export async function findChildSymbolPositions(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[]
): Promise<{ hasSymbols: boolean; positions: (vscode.Position | null)[] }> {
  const roots = await getNavigableSymbols(document);
  if (roots.length === 0) {
    return {
      hasSymbols: false,
      positions: selections.map(() => null),
    };
  }

  return {
    hasSymbols: true,
    positions: selections.map(selection => findChildPositionTarget(roots, selection.active)),
  };
}
