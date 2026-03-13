// api/etiquetas/index.js  GET POST /api/etiquetas
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  if (req.method === 'GET') return res.json(await query('SELECT * FROM etiquetas ORDER BY nombre'));
  if (req.method === 'POST') {
    const { nombre, color_hex = '#888888' } = req.body;
    const [r] = await query('INSERT IGNORE INTO etiquetas (nombre, color_hex) VALUES (?,?)', [nombre, color_hex]);
    return res.status(201).json({ id: r.insertId });
  }
  return res.status(405).end();
}
export default withAuth(handler);
