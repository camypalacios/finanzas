// api/auth/login.js — POST /api/auth/login  POST /api/auth/login?action=change-password
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { query } from '../_lib/db.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_dev');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // ── Cambio de contraseña ──────────────────────────────────
  if (req.query.action === 'change-password') {
    const { codigo, nuevaPassword } = req.body || {};
    if (!codigo || !nuevaPassword) return res.status(400).json({ error: 'Faltan campos requeridos' });
    if (codigo !== 'Felipe') return res.status(401).json({ error: 'Código de acceso incorrecto' });
    if (nuevaPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const hash = await bcrypt.hash(nuevaPassword, 10);
    const appUser = process.env.APP_USER || 'matias';
    await query('UPDATE usuarios SET password_hash = ? WHERE username = ?', [hash, appUser]);
    return res.status(200).json({ ok: true, message: 'Contraseña actualizada correctamente' });
  }

  // ── Login ─────────────────────────────────────────────────
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  const expectedUser = process.env.APP_USER || 'matias';
  if (username !== expectedUser) return res.status(401).json({ error: 'Credenciales incorrectas' });

  let valid = false;

  // 1. Hash almacenado en la BD (actualizado por change-password)
  try {
    const rows = await query('SELECT password_hash FROM usuarios WHERE username = ? LIMIT 1', [username]);
    const dbHash = rows[0]?.password_hash;
    if (dbHash && !dbHash.startsWith('$2a$10$placeholder')) {
      valid = await bcrypt.compare(password, dbHash);
    }
  } catch (_) { /* fallback si la BD no responde */ }

  // 2. Fallback: env var o contraseña inicial en texto plano
  if (!valid) {
    const passwordHash = process.env.APP_PASSWORD_HASH;
    if (passwordHash && !passwordHash.startsWith('$2a$10$placeholder')) {
      valid = await bcrypt.compare(password, passwordHash);
    } else {
      const rawPass = process.env.APP_PASSWORD_RAW || 'felipe2026';
      valid = password === rawPass;
    }
  }

  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = await new SignJWT({ sub: '1', username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET);

  return res.status(200).json({ token, username });
}
