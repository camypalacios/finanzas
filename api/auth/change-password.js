// api/auth/change-password.js — POST /api/auth/change-password
import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';

const ACCESS_CODE = 'Felipe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { codigo, nuevaPassword } = req.body || {};
  if (!codigo || !nuevaPassword) return res.status(400).json({ error: 'Faltan campos requeridos' });

  if (codigo !== ACCESS_CODE) {
    return res.status(401).json({ error: 'Código de acceso incorrecto' });
  }

  if (nuevaPassword.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const hash = await bcrypt.hash(nuevaPassword, 10);

  const username = process.env.APP_USER || 'matias';
  await query('UPDATE usuarios SET password_hash = ? WHERE username = ?', [hash, username]);

  return res.status(200).json({ ok: true, message: 'Contraseña actualizada correctamente' });
}
