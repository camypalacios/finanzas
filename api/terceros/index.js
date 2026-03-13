// api/terceros/index.js  GET POST /api/terceros
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    const rows = await query(`
      SELECT t.*,
        COALESCE(SUM(CASE WHEN g.tercero_id=t.id THEN g.monto ELSE 0 END),0) AS total_gastos
      FROM terceros t
      LEFT JOIN gastos g ON g.tercero_id = t.id
      WHERE t.activo=1
      GROUP BY t.id
      ORDER BY t.nombre`);
    return res.json(rows);
  }
  if (req.method === 'POST') {
    const { nombre, relacion } = req.body;
    const [r] = await query('INSERT INTO terceros (nombre, relacion) VALUES (?,?)',
      [nombre, relacion || null]);
    return res.status(201).json({ id: r.insertId, nombre, relacion });
  }
  return res.status(405).end();
}
export default withAuth(handler);
