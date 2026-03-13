// api/ingresos/index.js — GET POST /api/ingresos  GET PUT DELETE /api/ingresos/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;

  // ── Rutas con :id ─────────────────────────────────────────
  if (id) {
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

  // ── Rutas de colección ─────────────────────────────────────
  if (req.method === 'GET') {
    const { mes, anio } = req.query;
    let sql = `SELECT i.*, c.nombre AS categoria_nombre FROM ingresos i
               LEFT JOIN categorias c ON i.categoria_id = c.id WHERE 1=1`;
    const params = [];
    if (mes && anio) { sql += ' AND MONTH(i.fecha)=? AND YEAR(i.fecha)=?'; params.push(mes, anio); }
    sql += ' ORDER BY i.fecha DESC';
    return res.json(await query(sql, params));
  }
  if (req.method === 'POST') {
    const { descripcion, monto, moneda = 'ARS', fecha, categoria_id, tercero_id, repetir_mensual = 0, notas } = req.body;
    const [r] = await query(
      `INSERT INTO ingresos (descripcion, monto, moneda, fecha, categoria_id, tercero_id, repetir_mensual, notas)
       VALUES (?,?,?,?,?,?,?,?)`,
      [descripcion, monto, moneda, fecha, categoria_id || null, tercero_id || null, repetir_mensual, notas || null]
    );
    return res.status(201).json({ id: r.insertId });
  }
  return res.status(405).end();
}
export default withAuth(handler);
