import { TextDocument } from "vscode";

export type FileType = "html" | "jsx_tsx" | "svelte" | "other";

export function getFileType(document: TextDocument): FileType {
  switch (document.languageId) {
    case "html":
      return "html";
    case "javascriptreact":
    case "typescriptreact":
    case "jsx":
    case "tsx":
      return "jsx_tsx";
    case "svelte":
      return "svelte";
  }

  const fileExtension = document.fileName.split(".").pop();
  switch (fileExtension) {
    case "html":
      return "html";
    case "jsx":
    case "tsx":
      return "jsx_tsx";
    case "svelte":
      return "svelte";
    default:
      return "other";
  }
}
