import compact from "lodash/compact";
import { psql } from "./names";
import runShell from "./runShell";

/**
 * Advances all sequences on the destination (including sequences in other
 * schemas), so their values won't conflict with the ones on the source.
 */
export default async function advanceSequences({
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
        "sequence_schema || '.' || sequence_name, " +
        "nextval(sequence_schema || '.' || sequence_name)::text " +
        "FROM information_schema.sequences " +
        "ORDER BY 1",
    )
  ).map((s) => s.split("|") as [string, string]);
  const toSequences = await runShell(
    psql(toDsn),
    "SELECT sequence_schema || '.' || sequence_name FROM information_schema.sequences",
  );
  const toSql = compact(
    fromSequences.map(([sequence, value]) =>
      toSequences.includes(sequence)
        ? `SELECT setval('${sequence}', GREATEST(nextval('${sequence}'), ${value}) + 1000);`
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
