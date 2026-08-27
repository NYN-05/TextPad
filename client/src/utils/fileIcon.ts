export function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":   return "\u{1F7E8}";
    case "jsx":  return "\u269B\uFE0F";
    case "ts":   return "\u{1F535}";
    case "tsx":  return "\u269B\uFE0F";
    case "css":  return "\u{1F7EA}";
    case "scss":
    case "sass": return "\u{1F7E3}";
    case "html": return "\u{1F7E7}";
    case "py":   return "\u{1F40D}";
    case "md":   return "\u{1F4DD}";
    case "json": return "\u{1F4CB}";
    case "xml":
    case "txt":  return "\u{1F4C4}";
    case "cpp":
    case "c":
    case "h":    return "\u{1F537}";
    default:     return "\u{1F4C4}";
  }
}
