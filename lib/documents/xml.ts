/** Decodes the five XML entities plus numeric character references. */
export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, ref: string) => {
    switch (ref) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default: {
        const code = ref.startsWith("#x") ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }
    }
  });
}

/** Parses the attributes of an XML start tag into a map (namespace prefixes kept). */
export function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) result[m[1]] = decodeXml(m[2]);
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*'([^']*)'/g)) result[m[1]] = decodeXml(m[2]);
  return result;
}
