// ponytail: one-shot seed untuk user_list yang belum punya baris user_credentials
// (akibatnya login arsip balas 401 "Akun tidak ditemukan"). Read-only by default.
// Jalankan: node scripts/seed-credentials.mjs            -> hanya daftar
//            node scripts/seed-credentials.mjs --apply --password=XXX -> seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const apply = process.argv.includes('--apply');
const pwArg = process.argv.find((a) => a.startsWith('--password='));
const password = pwArg ? pwArg.slice('--password='.length) : null;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(`
  SELECT u."NIP" AS nip, u.username, u.role, u."Status"
    FROM user_list u
    LEFT JOIN user_credentials c ON c.nip = u."NIP"
   WHERE c.nip IS NULL AND u."NIP" IS NOT NULL
   ORDER BY u.username`);

console.log(`${rows.length} user tanpa baris user_credentials:`);
for (const r of rows) console.log(`  ${r.nip}  ${r.username}  (${r.role}/${r.Status})`);

if (apply) {
  if (!password) {
    console.error('--apply butuh --password=XXX');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  for (const r of rows) {
    await pool.query(
      `INSERT INTO user_credentials (nip, password_hash, role) VALUES ($1, $2, $3)`,
      [r.nip, hash, r.role]
    );
    console.log(`  + seeded ${r.nip}`);
  }
  console.log(`selesai: ${rows.length} baris.`);
} else if (rows.length) {
  console.log('\nDry-run. Untuk seed: node scripts/seed-credentials.mjs --apply --password=<pw>');
}
await pool.end();
