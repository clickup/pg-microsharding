import compact from "lodash/compact";
import { psql } from "./names";
import { quoteLiteral } from "./quoteLiteral";
import { runShell } from "./runShell";

/**
 * Advances all sequences on the destination (including sequences in other
 * schemas), so their values won't conflict with the ones on the source.
 */
export async function advanceSequences({
  fromDsn,
  toDsn,
}: {
  fromDsn: string;
  toDsn: string;
}): Promise<void> {
  const fromSequences = (
    await runShell(
      psql(fromDsn),
      "SELECT " +
        "quote_ident(sequence_schema) || '.' || quote_ident(sequence_name), " +
        "nextval(quote_ident(sequence_schema) || '.' || quote_ident(sequence_name))::text " +
        "FROM information_schema.sequences " +
        "ORDER BY 1",
    )
  ).map((str) => str.split("|") as [string, string]);
  const toSequences = await runShell(
    psql(toDsn),
    "SELECT quote_ident(sequence_schema) || '.' || quote_ident(sequence_name) " +
      "FROM information_schema.sequences",
  );
  const toSql = compact(
    fromSequences.map(([sequence, value]) =>
      toSequences.includes(sequence)
        ? `SELECT setval(${quoteLiteral(sequence)}, GREATEST(nextval(${quoteLiteral(sequence)}), ${value}) + 1000);`
        : null,
    ),
  );
  if (toSql.length > 0) {
    await runShell(
      psql(toDsn),
      toSql.join("\n"),
      "Advancing destination sequences",
    );
  }
}
