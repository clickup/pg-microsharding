import shellQuote from "./shellQuote";

export const pubName = (schema: string): string =>
  `pg_sharding_move_${schema}_pub`;

export const subName = (schema: string): string =>
  `pg_sharding_move_${schema}_sub`;

export const pgDump = (fromDsn: string): string =>
  `pg_dump --schema-only ${shellQuote(fromDsn)}`;

export const psql = (dsn: string): string =>
  `psql ${shellQuote(dsn)} --set ON_ERROR_STOP=on -At`;

export const shardNo = (schema: string): number | null =>
  schema.match(/(\d+)/) ? parseInt(RegExp.$1) : null;

export const schemaOld = (schema: string): string => `${schema}old`;

export const schemaNew = (schema: string): string => `${schema}new`;

export const libSchema = (): string => "sharding";

export const dsnToHost = (dsn: string): string => new URL(dsn).hostname;
