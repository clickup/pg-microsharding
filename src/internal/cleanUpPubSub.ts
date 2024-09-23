import delay from "delay";
import { psql, pubName, subName } from "./names";
import { quoteIdent } from "./quoteIdent";
import { quoteLiteral } from "./quoteLiteral";
import { runShell } from "./runShell";

/**
 * Removes all traces of logical replication from the schema.
 */
export async function cleanUpPubSub({
  fromDsn,
  toDsn,
  schema,
  quiet,
}: {
  fromDsn: string;
  toDsn: string;
  schema: string;
  quiet: boolean;
}): Promise<void> {
  await runShell(
    psql(toDsn),
    `DROP SUBSCRIPTION IF EXISTS ${quoteIdent(subName(schema))}`,
    quiet ? undefined : "Dropping destination subscription",
  );
  await delay(1000);
  await runShell(
    psql(fromDsn),
    "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots " +
      `WHERE slot_name=${quoteLiteral(subName(schema))}`,
  );
  await runShell(
    psql(fromDsn),
    `DROP PUBLICATION IF EXISTS ${quoteIdent(pubName(schema))}`,
    quiet ? undefined : "Dropping source publication",
  );
}
