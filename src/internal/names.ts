import { shellQuote } from "./shellQuote";

export const pubName = (schema: string): string =>
  `pg_microsharding_move_${schema}_pub`;

export const subName = (schema: string): string =>
  `pg_microsharding_move_${schema}_sub`;

export const pgDump = (fromDsn: string): string =>
  `pg_dump --schema-only ${shellQuote(fromDsn)}`;

export const psql = (dsn: string): string =>
  `psql ${shellQuote(dsn)} --set ON_ERROR_STOP=on -At`;

export const shardNo = (schema: string): number | null =>
  schema.match(/(\d+)/) ? parseInt(RegExp.$1) : null;

export const schemaOld = (schema: string, dateSuffix: string): string =>
  `${schema}old${dateSuffix}`;

export const schemaNew = (schema: string): string => `${schema}new`;

export const schemaCleanupRe = (schemaNameRe: string): string =>
  `^(${schemaNameRe})(old_\\d+|old\\d*|new)$`;

export const libSchema = (): string => "microsharding";

export const dsnToShort = (fromDsn: string, toDsn: string): string => {
  const fromUrl = new URL(fromDsn);
  const toUrl = new URL(toDsn);
  const [fromStr, toStr] =
    fromUrl.hostname === toUrl.hostname
      ? [fromUrl.hostname + fromUrl.pathname, toUrl.hostname + toUrl.pathname]
      : [fromUrl.hostname, toUrl.hostname];
  return `from ${fromStr} to ${toStr}`;
};
