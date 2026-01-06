import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import { schema } from "./schema";

type DrizzleClient = NodePgDatabase<typeof schema>;

declare global {
  var __drizzleDb: DrizzleClient | undefined;
  var __pgPool: Pool | undefined;
}

function getOrInitClients(): { db: DrizzleClient; pgPool: Pool } {
  const existingDb = globalThis.__drizzleDb;
  const existingPool = globalThis.__pgPool;

  if (existingDb && existingPool) {
    return { db: existingDb, pgPool: existingPool };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "缺少 DATABASE_URL 环境变量，请在 .env.local 中配置 PostgreSQL 连接字符串。",
    );
  }

  const poolConfig: PoolConfig = {
    connectionString,
  };

  if (
    process.env.DATABASE_SSL === "true" ||
    (process.env.NODE_ENV === "production" && poolConfig.ssl === undefined)
  ) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pgPool = existingPool ?? new Pool(poolConfig);
  const db = existingDb ?? drizzle(pgPool, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__pgPool = pgPool;
    globalThis.__drizzleDb = db;
  }

  return { db, pgPool };
}

const db = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    const { db } = getOrInitClients();
    return (db as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

const pgPool = new Proxy({} as Pool, {
  get(_target, prop) {
    const { pgPool } = getOrInitClients();
    return (pgPool as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export { db, pgPool };
export type { DrizzleClient };
