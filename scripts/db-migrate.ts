// Applies supabase/migrations/*.sql in filename order, once each.
// Usage: npm run db:migrate   (needs DATABASE_URL in .env)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes('[YOUR-PASSWORD]')) {
  console.error('Set DATABASE_URL in .env (with your real database password) before migrating.');
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  await client.query(`create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  // No policies: invisible to the Supabase REST API, usable only by this script.
  await client.query('alter table public._migrations enable row level security');
  const { rows } = await client.query<{ name: string }>('select name from public._migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    console.log(`Applying ${file}`);
    await client.query('begin');
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('insert into public._migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
  console.log('Database is up to date.');
} finally {
  await client.end();
}
