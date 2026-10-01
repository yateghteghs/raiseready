/**
 * Pulls the value of one string field out of a JSON document while it is
 * still streaming, so a long text field can be shown before the JSON is
 * complete. Returns the decoded text available so far.
 */
export function partialStringField(json: string, field: string): string | null {
  const key = new RegExp(`"${field}"\\s*:\\s*"`);
  const match = key.exec(json);
  if (!match) return null;

  let out = "";
  for (let i = match.index + match[0].length; i < json.length; i++) {
    const ch = json[i];
    if (ch === '"') return out;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = json[i + 1];
    if (next === undefined) return out; // escape split across chunks
    const simple: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
    if (next in simple) {
      out += simple[next];
      i++;
    } else if (next === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      i++;
    }
  }
  return out;
}
