/**
 * Optionally encloses a PG identifier (like table name) in "".
 */
export function quoteIdent(ident: string): string {
  return ident.match(/^[a-z_][a-z_0-9]*$/is)
    ? ident
    : '"' + ident.replace(/"/g, '""') + '"';
}
