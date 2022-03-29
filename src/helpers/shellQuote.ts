export default function shellQuote(s: string): string {
  return s.match(/^[-a-zA-Z_0-9:/@]+$/)
    ? s
    : "'" + s.replace(/'/g, "'\\''") + "'";
}
