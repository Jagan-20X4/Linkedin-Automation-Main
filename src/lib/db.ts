import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

function requirePgConfig() {
  const host = process.env.PG_HOST?.trim();
  const database = process.env.PG_DATABASE?.trim();
  const user = process.env.PG_USER?.trim();
  const password = process.env.PG_PASSWORD?.trim();
  if (!host || !database || !user || password === undefined) {
    throw new Error(
      "Database env missing: set PG_HOST, PG_DATABASE, PG_USER, PG_PASSWORD (and optionally PG_PORT). Run schema.sql on your database first.",
    );
  }
  const port = Number(process.env.PG_PORT?.trim() || "5432");
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("PG_PORT must be a valid port number.");
  }
  return { host, port, database, user, password };
}

export function getPool(): Pool {
  if (!pool) {
    const { host, port, database, user, password } = requirePgConfig();
    const ssl =
      process.env.PG_SSL === "1" || process.env.PG_SSL === "true"
        ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined;
    pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      max: Number(process.env.PG_POOL_MAX?.trim() || "10"),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ssl,
    });
  }
  return pool;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
