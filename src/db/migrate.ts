import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../core/db';
import { logger } from '../core/logger';

/**
 * Runner de migrations simples: roda em ordem alfabética os *.sql de
 * src/db/migrations que ainda não foram aplicados (registro em schema_migrations).
 * Uso: npm run migrate
 */
async function run(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const dir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      logger.debug({ file }, 'migration já aplicada, pulando');
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    logger.info({ file }, 'aplicando migration');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info({ file }, '✅ migration aplicada');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ file, err }, '❌ migration falhou');
      throw err;
    } finally {
      client.release();
    }
  }

  logger.info('migrations concluídas');
  await pool.end();
}

run().catch((err) => {
  logger.error({ err }, 'erro no runner de migrations');
  process.exit(1);
});
