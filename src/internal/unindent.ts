export function unindent(text: string): string {
  text = text.replace(/^([ \t\r]*\n)+/s, "").trimEnd();
  const matches = text.match(/^[ \t]+/s);
  return matches ? text.replace(new RegExp("^" + matches[0], "mg"), "") : text;
}
