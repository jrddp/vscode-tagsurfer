import { TextDocument } from "vscode";

type FileType = "html" | "jsx_tsx" | "other";

export function getFileType(document: TextDocument): FileType {
  const fileExtension = document.fileName.split(".").pop();
  switch (fileExtension) {
    case "html":
      return "html";
    case "jsx":
    case "tsx":
      return "jsx_tsx";
    default:
      return "other";
  }
}
