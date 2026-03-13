// api/gastos/[id].js — GET PUT DELETE PATCH /api/gastos/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const rows = await query(
      `SELECT g.*,
        c.nombre AS categoria_nombre,
        t.nombre AS tarjeta_nombre,
        te.nombre AS tercero_nombre,
        GROUP_CONCAT(DISTINCT e.id ORDER BY e.id SEPARATOR ',') AS etiqueta_ids,
        GROUP_CONCAT(DISTINCT e.nombre ORDER BY e.id SEPARATOR ',') AS etiquetas
       FROM gastos g
       LEFT JOIN categorias c ON g.categoria_id = c.id
       LEFT JOIN tarjetas t ON g.tarjeta_id = t.id
       LEFT JOIN terceros te ON g.tercero_id = te.id
       LEFT JOIN gasto_etiquetas ge ON g.id = ge.gasto_id
       LEFT JOIN etiquetas e ON ge.etiqueta_id = e.id
       WHERE g.id=? GROUP BY g.id`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json(rows[0]);
  }

  if (req.method === 'PUT') {
    const { descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
            es_fijo, notas, etiquetas = [], propagar_tercero = false } = req.body;
    await query(
      `UPDATE gastos SET descripcion=?, monto=?, moneda=?, fecha=?, categoria_id=?,
        tarjeta_id=?, tercero_id=?, es_fijo=?, notas=? WHERE id=?`,
      [descripcion, monto, moneda, fecha, categoria_id || null, tarjeta_id || null,
       tercero_id || null, es_fijo, notas, id]
    );

    // Propagar tercero a cuotas futuras
    if (propagar_tercero) {
      const gasto = await query('SELECT parent_id FROM gastos WHERE id=?', [id]);
      const pid = gasto[0]?.parent_id || id;
      await query('UPDATE gastos SET tercero_id=? WHERE parent_id=? AND id != ?', [tercero_id || null, pid, id]);
    }

    // Actualizar etiquetas
    await query('DELETE FROM gasto_etiquetas WHERE gasto_id=?', [id]);
    for (const etqId of etiquetas) {
      await query('INSERT IGNORE INTO gasto_etiquetas (gasto_id, etiqueta_id) VALUES (?,?)', [id, etqId]);
    }
    return res.json({ ok: true });
  }

  if (req.method === 'PATCH') {
    // Recategorizar rápido
    const { categoria_id } = req.body;
    await query('UPDATE gastos SET categoria_id=? WHERE id=?', [categoria_id, id]);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { eliminar_serie = false } = req.query;
    if (eliminar_serie === 'true') {
      const gasto = await query('SELECT parent_id FROM gastos WHERE id=?', [id]);
      const pid = gasto[0]?.parent_id || id;
      await query('DELETE FROM gastos WHERE parent_id=? OR id=?', [pid, pid]);
    } else {
      await query('DELETE FROM gastos WHERE id=?', [id]);
    }
    return res.json({ ok: true });
  }

  return res.status(405).end();
}

export default withAuth(handler);
