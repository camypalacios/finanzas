// api/tarjetas/index.js  GET POST /api/tarjetas
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(await query('SELECT * FROM tarjetas WHERE activa=1 ORDER BY id'));
  }
  if (req.method === 'POST') {
    const { nombre, tipo = 'credito', ultimos_digitos, color_hex } = req.body;
    const [r] = await query(
      'INSERT INTO tarjetas (nombre, tipo, ultimos_digitos, color_hex) VALUES (?,?,?,?)',
      [nombre, tipo, ultimos_digitos || null, color_hex || '#1a73e8']
    );
    return res.status(201).json({ id: r.insertId });
  }
  return res.status(405).end();
}
export default withAuth(handler);
