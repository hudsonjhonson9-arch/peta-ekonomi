import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const setup = async () => {
  try {
    console.log('Creating table bapperida_kategori_dokumen...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bapperida_kategori_dokumen (
        id SERIAL PRIMARY KEY,
        nama VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Altering user_credentials to add last_login...');
    await pool.query(`
      ALTER TABLE user_credentials ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
    `);
    
    console.log('Inserting initial categories...');
    const categories = [
      'Perencanaan Jangka Panjang',
      'Perencanaan Jangka Menengah',
      'Perencanaan Tahunan (RKPD)',
      'Evaluasi & Pelaporan',
      'RPJMD',
      'Renstra',
      'Renja',
      'RKA',
      'Kajian Ekonomi',
      'Laporan Evaluasi',
      'Data Statistik',
      'Notulen Rapat'
    ];
    
    for (const cat of categories) {
      await pool.query(
        'INSERT INTO bapperida_kategori_dokumen (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING',
        [cat]
      );
    }
    
    console.log('Inserting user_credentials for Bidang Ekonomi dan SDA employees...');
    const users = [
      { nip: '197711222005011009', role: 'Reviewer' }, // Alvian Zadrakh Tiluata Kosi, S. Pt
      { nip: '198204012009032011', role: 'Staf' },     // Cherryllena Tila Mateos, SST, Par
      { nip: '199305252025211040', role: 'Staf' },     // Mikhael Roberto awang
      { nip: '198504292025211042', role: 'Staf' },     // Titus Mezango
      { nip: '197101202012122001', role: 'Staf' },     // Ribka Joriantje
      { nip: '198303162025211053', role: 'Staf' },     // Heribertus Riano Juse
      { nip: '198908242025212117', role: 'Staf' },     // Ester Jola Larra, SP
      { nip: '003', role: 'Staf' }                      // Risnawati Goro
    ];
    
    const defaultHash = '$2b$10$vgAo0ik8CSJ2vaoaM6Lh9OXfn3Tt2Mv/edTx1ZzdmqKD6AGvnhREq'; // Bidangekonomi2026
    
    for (const u of users) {
      await pool.query(
        'INSERT INTO user_credentials (nip, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (nip) DO NOTHING',
        [u.nip, defaultHash, u.role]
      );
    }
    
    console.log('Database setup completed successfully.');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await pool.end();
  }
};

setup();
