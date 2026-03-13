// api/metas/index.js  GET POST /api/metas
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(await query('SELECT * FROM metas_ahorro ORDER BY activa DESC, fecha_limite'));
  }
  if (req.method === 'POST') {
    const { nombre, monto_objetivo, moneda = 'ARS', fecha_limite, descripcion, icono, color_hex } = req.body;
    const [r] = await query(
      `INSERT INTO metas_ahorro (nombre, monto_objetivo, moneda, fecha_limite, descripcion, icono, color_hex)
       VALUES (?,?,?,?,?,?,?)`,
      [nombre, monto_objetivo, moneda, fecha_limite, descripcion || null,
       icono || 'target', color_hex || '#00ff87']
    );
    return res.status(201).json({ id: r.insertId });
  }
  return res.status(405).end();
}
export default withAuth(handler);
