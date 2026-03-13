// api/ingresos/[id].js — GET PUT DELETE /api/ingresos/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    const rows = await query('SELECT * FROM ingresos WHERE id=?', [id]);
    return rows.length ? res.json(rows[0]) : res.status(404).json({ error: 'No encontrado' });
  }
  if (req.method === 'PUT') {
    const { descripcion, monto, moneda, fecha, categoria_id, tercero_id, repetir_mensual, notas } = req.body;
    await query(
      `UPDATE ingresos SET descripcion=?,monto=?,moneda=?,fecha=?,categoria_id=?,tercero_id=?,repetir_mensual=?,notas=? WHERE id=?`,
      [descripcion, monto, moneda, fecha, categoria_id || null, tercero_id || null, repetir_mensual, notas, id]
    );
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    await query('DELETE FROM ingresos WHERE id=?', [id]);
    return res.json({ ok: true });
  }
  return res.status(405).end();
}
export default withAuth(handler);
