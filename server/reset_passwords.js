import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const NEW_PASSWORD = 'BapperidaSB2026';
const hash = bcrypt.hashSync(NEW_PASSWORD, 10);

console.log(`Updating all passwords to: ${NEW_PASSWORD}`);
console.log(`Hash: ${hash}`);

const result = await pool.query('UPDATE user_credentials SET password_hash = $1', [hash]);
console.log(`Updated ${result.rowCount} accounts.`);

// Verify one
const verify = await pool.query('SELECT nip, role FROM user_credentials LIMIT 1');
if (verify.rows.length) {
  const cred = await pool.query('SELECT password_hash FROM user_credentials WHERE nip = $1', [verify.rows[0].nip]);
  console.log(`Verify (${verify.rows[0].nip}):`, bcrypt.compareSync(NEW_PASSWORD, cred.rows[0].password_hash));
}

await pool.end();
