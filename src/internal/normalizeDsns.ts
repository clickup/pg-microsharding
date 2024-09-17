import compact from "lodash/compact";
import uniq from "lodash/uniq";
import { isMasterDsn } from "./isMasterDsn";
import { mapJoin } from "./mapJoin";
import { normalizeDsn } from "./normalizeDsn";

/**
 * Same as normalizeDsn(), but assumes comma separated list of DSNs. Also,
 * allows passing numbers instead of DSNs; if so, the actual DSN will be chosen
 * by the index from islandDsns argument.
 */
export async function normalizeDsns(
  dsnsOrIslandNos: string | undefined,
  islandDsns?: string[],
): Promise<string[]> {
  const dsns = uniq(
    compact(
      dsnsOrIslandNos
        ?.split(/[,\s]+/s)
        .map((dsnOrIslandNo) => normalizeDsn(dsnOrIslandNo, islandDsns)),
    ),
  );
  const masterDsns = compact(
    await mapJoin(dsns, async (dsn) => ((await isMasterDsn(dsn)) ? dsn : null)),
  );
  return masterDsns;
}
