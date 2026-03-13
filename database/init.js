// database/init.js — Inicializa el schema en Hostinger MySQL
// Uso: node database/init.js
import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function init() {
  const conn = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ssl: false,
  });

  console.log('✔ Conectado a MySQL:', process.env.DB_HOST);

  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('✔ Schema aplicado correctamente');

  // Hash inicial de contraseña
  const { hashSync } = await import('bcryptjs');
  const rawPassword = process.env.APP_PASSWORD_RAW || 'felipe2026';
  const hash = hashSync(rawPassword, 10);
  console.log('\n=== IMPORTANTE ===');
  console.log(`Agrega esto en tu .env:`);
  console.log(`APP_PASSWORD_HASH=${hash}`);
  console.log(`(contraseña: ${rawPassword})\n`);

  await conn.end();
}

// Cargar .env manualmente
import { config } from 'dotenv';
config();

init().catch(e => { console.error('✘ Error:', e.message); process.exit(1); });
