// api/_lib/auth.js — Middleware JWT para Vercel Functions
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_dev');

export async function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('No token');
  const { payload } = await jwtVerify(token, SECRET);
  return payload;
}

export function withAuth(handler) {
  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      return res.status(200).end();
    }
    try {
      const user = await verifyToken(req);
      req.user = user;
      return handler(req, res);
    } catch {
      return res.status(401).json({ error: 'No autorizado' });
    }
  };
}
