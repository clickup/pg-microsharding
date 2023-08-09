import delay from "delay";
import { psql, pubName, subName } from "./names";
import runShell from "./runShell";

/**
 * Removes all traces of logical replication from the schema.
 */
export default async function cleanUpPubSub({
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
    `DROP SUBSCRIPTION IF EXISTS ${subName(schema)}`,
    quiet ? undefined : "Dropping destination subscription"
  );
  await delay(1000);
  await runShell(
    psql(fromDsn),
    "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots " +
      `WHERE slot_name='${subName(schema)}'`
  );
  await runShell(
    psql(fromDsn),
    `DROP PUBLICATION IF EXISTS ${pubName(schema)}`,
    quiet ? undefined : "Dropping source publication"
  );
}
