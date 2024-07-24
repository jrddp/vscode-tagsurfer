# TagSurfer

> Streamline tag creation and pair navigation in HTML, JSX, and more.

## Features

### Surround with Tag

Surrounds the selected text with a new tag.

- When surrounding an inline selection, the tag defaults to a `<span>` and surrounds selected text directly.
- When surrounding a block selection, the tag defaults to a `<div>` and surrounds selected text on surrounding lines.
  - These are both configurable via `tagSurfer.defaultBlockTag` and `tagSurfer.defaultInlineTag`.

The cursor will be placed at the start of the name of the new opening tag, so it can be easily edited. I recommend using this alongside the Auto Rename Tag extension.

### Jump to Matching Pair

This combines the functionality of the Go to Matching Pair command from Emmet or Vim's '%' command.

- When the cursor is on some kind of bracket, it will jump to the matching bracket.
- When the cursor is inside a tag, it will jump to the matching closing tag.

### Why use TagSurfer?

There are plenty of extensions that provide tag surrounding functionality, such as Surround with Tag, htmltagwrap, or Wrap It. I made this extension because I could not find one that didn't have one of these problems:

- Awkward formatting of surrounding tags
- Glitchy behavior with VSCode's Vim extension
- Clunky workflow when creating empty JSX tags

TagSurfer solves all of these problems.

Similarly, I created the Jump to Matching Pair feature to avoid having seperate keybinds for Vim's '%' command and Emmet's 'Go to Matching Pair' command.
