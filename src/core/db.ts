import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';
import { logger } from './logger';

/**
 * Pool Postgres único da aplicação (evolução do antigo src/server/connect.js).
 * Credenciais vêm 100% de env — nada hardcoded.
 */
export const pool = new Pool({
  host: env.PGHOST,
  port: env.PGPORT,
  database: env.PGDATABASE,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  max: env.PG_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: true,
  statement_timeout: 30_000,
  query_timeout: 30_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'erro inesperado no pool de conexões pg');
});

/**
 * Executa uma query parametrizada e devolve as linhas tipadas.
 * Use SEMPRE com placeholders ($1,$2...) — nunca interpole strings.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const start = Date.now();
  const res = await pool.query<T>(sql, params as unknown[]);
  logger.debug({ ms: Date.now() - start, rows: res.rowCount }, 'sql');
  return res.rows;
}

/** Primeira linha ou null — açúcar para SELECTs de 1 registro. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Roda um callback dentro de uma transação. Commita no sucesso, rollback no erro.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<void> {
  await pool.query('SELECT 1');
}
